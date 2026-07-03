import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { matchAyahsWithAI, InputWord } from '@/lib/ai-match';

export const runtime = 'nodejs';
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type RawWord = {
  word?: string;
  start?: number | string;
  end?: number | string;
};

type RawSegment = {
  id?: number;
  seek?: number;
  start?: number | string;
  end?: number | string;
  text?: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeArabicWord(input: string): string {
  return input
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isArabicLike(text: string): boolean {
  if (!text) return false;
  const cleaned = normalizeArabicWord(text);
  if (!cleaned) return false;

  const arabicChars = cleaned.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || [];
  return arabicChars.length >= Math.max(1, Math.floor(cleaned.length * 0.5));
}

function cleanWords(words: RawWord[]) {
  const cleaned: Array<{ word: string; start: number; end: number }> = [];

  for (const w of words) {
    const word = normalizeArabicWord(String(w.word || ''));
    const start = toNumber(w.start, -1);
    const end = toNumber(w.end, -1);
    const duration = end - start;

    if (!word) continue;
    if (!isArabicLike(word)) continue;
    if (start < 0 || end < 0) continue;
    if (end <= start) continue;
    if (duration < 0.05) continue;
    if (duration > 3.5) continue;

    cleaned.push({ word, start, end });
  }

  return cleaned;
}

function cleanSegments(segments: RawSegment[]) {
  return segments
    .map((s) => ({
      id: typeof s.id === 'number' ? s.id : 0,
      seek: typeof s.seek === 'number' ? s.seek : 0,
      start: toNumber(s.start, 0),
      end: toNumber(s.end, 0),
      text: String(s.text || '').trim(),
      tokens: Array.isArray(s.tokens) ? s.tokens : [],
      temperature: toNumber(s.temperature, 0),
      avg_logprob: toNumber(s.avg_logprob, 0),
      compression_ratio: toNumber(s.compression_ratio, 0),
      no_speech_prob: toNumber(s.no_speech_prob, 0),
    }))
    .filter((s) => s.end > s.start)
    .filter((s) => {
      const text = normalizeArabicWord(s.text);
      return !s.text || isArabicLike(text);
    });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const words: InputWord[] = Array.isArray(body.words) ? body.words : [];
      const segments = Array.isArray(body.segments) ? body.segments : [];

      if (words.length === 0 && segments.length === 0) {
        return NextResponse.json({ ayahs: [] });
      }

      // Use the new AI matching engine to definitively match the flawed transcription
      const ayahs = await matchAyahsWithAI(words, segments);

      return NextResponse.json({ ayahs });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: 'Uploaded audio file is empty' },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Audio file exceeds the 25MB limit' },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileStream = await Groq.toFile(buffer, audioFile.name);

    const transcription = (await groq.audio.transcriptions.create({
      file: fileStream,
      model: WHISPER_MODEL,
      language: 'ar',
      response_format: 'verbose_json',
      temperature: 0,
      timestamp_granularities: ['segment', 'word'],
    })) as any;

    const rawSegments: RawSegment[] = Array.isArray(transcription?.segments)
      ? transcription.segments
      : [];

    const rawWords: RawWord[] = Array.isArray(transcription?.words)
      ? transcription.words
      : [];

    const segments = cleanSegments(rawSegments);
    let words = cleanWords(rawWords);

    // 🌟 FALLBACK ENGINE: If Groq skips word-level timings, generate them synthetically from segments
    if (words.length === 0 && segments.length > 0) {
      const synthesizedWords: Array<{ word: string; start: number; end: number }> = [];

      for (const seg of segments) {
        // Split the original segment text by spaces to count words
        const rawSegmentWords = seg.text.split(/\s+/).filter(Boolean);
        if (rawSegmentWords.length === 0) continue;

        const duration = seg.end - seg.start;
        const uniformWordDuration = duration / rawSegmentWords.length;

        for (let i = 0; i < rawSegmentWords.length; i++) {
          const cleanedWord = normalizeArabicWord(rawSegmentWords[i]);
          // Only map words that pass validation checks
          if (!cleanedWord || !isArabicLike(cleanedWord)) continue;

          synthesizedWords.push({
            word: cleanedWord,
            start: Number((seg.start + i * uniformWordDuration).toFixed(3)),
            end: Number((seg.start + (i + 1) * uniformWordDuration).toFixed(3)),
          });
        }
      }
      words = synthesizedWords;
    }

    // Secondary fallback validation
    if (segments.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid Arabic audio data or text blocks could be determined from this audio track.',
          segments: [],
          words: [],
        },
        { status: 422 }
      );
    }

    // Return successfully with code 200 so your frontend can complete the matching cycle
    return NextResponse.json({
      segments,
      words,
    });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transcription failed',
      },
      { status: 500 }
    );
  }
}