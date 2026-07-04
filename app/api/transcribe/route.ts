import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { matchAyahsWithAI, InputWord } from '@/lib/ai-match';

export const runtime = 'nodejs';
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type RawWord = { word?: string; start?: number | string; end?: number | string; };
type RawSegment = { id?: number; seek?: number; start?: number | string; end?: number | string; text?: string; tokens?: number[]; };

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeArabicWord(input: string): string {
  return input.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, '').replace(/\s+/g, ' ').trim();
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
    if (!word || !isArabicLike(word) || start < 0 || end < 0 || end <= start || duration < 0.05 || duration > 3.5) continue;
    cleaned.push({ word, start, end });
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Handle Direct JSON Requests
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const words: InputWord[] = Array.isArray(body.words) ? body.words : [];
      const segments = Array.isArray(body.segments) ? body.segments : [];
      
      if (words.length === 0 && segments.length === 0) return NextResponse.json({ ayahs: [] });

      const ayahs = await matchAyahsWithAI(words, segments);
      return NextResponse.json({ ayahs });
    }

    // Handle Audio Upload Requests
    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof File)) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    if (audioFile.size === 0) return NextResponse.json({ error: 'Uploaded audio file is empty' }, { status: 400 });
    if (audioFile.size > MAX_FILE_SIZE_BYTES) return NextResponse.json({ error: 'Audio file exceeds the 25MB limit' }, { status: 413 });

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileStream = await Groq.toFile(buffer, audioFile.name);

    // Call Groq Whisper
    const transcription = (await groq.audio.transcriptions.create({
      file: fileStream,
      model: WHISPER_MODEL,
      language: 'ar',
      response_format: 'verbose_json',
      temperature: 0,
      timestamp_granularities: ['segment', 'word'],
    })) as any;

    const rawSegments: RawSegment[] = Array.isArray(transcription?.segments) ? transcription.segments : [];
    let words = cleanWords(Array.isArray(transcription?.words) ? transcription.words : []);

    // SYNTHETIC TIMESTAMPS FALLBACK: If Whisper misses word boundaries, generate them from segments
    if (words.length === 0 && rawSegments.length > 0) {
      const synthesizedWords: Array<{ word: string; start: number; end: number }> = [];
      for (const seg of rawSegments) {
        const rawSegmentWords = (seg.text || "").split(/\s+/).filter(Boolean);
        if (rawSegmentWords.length === 0) continue;
        const segStart = toNumber(seg.start, 0);
        const segEnd = toNumber(seg.end, 0);
        const duration = segEnd - segStart;
        const uniformWordDuration = duration / rawSegmentWords.length;
        
        for (let i = 0; i < rawSegmentWords.length; i++) {
          const cleanedWord = normalizeArabicWord(rawSegmentWords[i]);
          if (!cleanedWord || !isArabicLike(cleanedWord)) continue;
          synthesizedWords.push({
            word: cleanedWord,
            start: Number((segStart + i * uniformWordDuration).toFixed(3)),
            end: Number((segStart + (i + 1) * uniformWordDuration).toFixed(3)),
          });
        }
      }
      words = synthesizedWords;
    }

    if (words.length === 0) {
      return NextResponse.json({ error: 'No valid Arabic audio data could be determined.', segments: [], words: [] }, { status: 422 });
    }

    // Call the Alignment Engine
    let ayahs: any[] = [];
    try {
      ayahs = await matchAyahsWithAI(words, rawSegments);
    } catch (matchError) {
      console.error('Alignment Engine Error:', matchError);
    }

    return NextResponse.json({
      segments: rawSegments,
      words,
      ayahs
    });
  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transcription failed' }, { status: 500 });
  }
}