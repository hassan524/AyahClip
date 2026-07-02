import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const maxDuration = 60;

// Biases Whisper's vocabulary toward Quranic Arabic recitation so it is
// less likely to mis-hear classical/Quranic words as everyday colloquial
// ones (e.g. "يتفطرن" mis-heard as "يتفضلون"). This does NOT make Whisper
// skip silence or wait for recitation to begin — it only nudges word choice.
const QURAN_PROMPT =
  "This audio is a recitation of the Holy Quran in Classical Arabic. Use the exact Quranic text and spellings. If the recitation contains the disjointed Quranic letters (Muqatta'at), transcribe them as separate letters exactly as they appear in the Quran, for example: كٓ هٰ يٰ عٓ صٓ, ا ل م, ا ل م ص, ا ل ر, طٰ هٰ, يٰ سٓ, حٰ مٓ, قٓ, نٓ. Also look for Bismillah or Auzibillah.";
  
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
      language: 'ar',
      temperature: 0,
      prompt: QURAN_PROMPT,
    });

    const rawSegments = Array.isArray((transcription as any).segments)
      ? (transcription as any).segments
      : [];

    const rawWords = Array.isArray((transcription as any).words)
      ? (transcription as any).words
      : [];

    const segments = rawSegments
      .map((s: any) => ({
        id: typeof s.id === 'number' ? s.id : 0,
        seek: typeof s.seek === 'number' ? s.seek : 0,
        start: Number(s.start ?? 0),
        end: Number(s.end ?? 0),
        text: (s.text || '').trim(),
        tokens: Array.isArray(s.tokens) ? s.tokens : [],
        temperature: Number(s.temperature ?? 0),
        avg_logprob: Number(s.avg_logprob ?? 0),
        compression_ratio: Number(s.compression_ratio ?? 0),
        no_speech_prob: Number(s.no_speech_prob ?? 0),
      }))
      .filter((s: any) => s.text.length > 0);

    const words = rawWords
      .map((w: any) => ({
        word: (w.word || '').trim(),
        start: Number(w.start ?? 0),
        end: Number(w.end ?? 0),
      }))
      .filter((w: any) => w.word.length > 0);

    return NextResponse.json({
      text: ((transcription as any).text || '').trim(),
      segments,
      words,
      duration: Number((transcription as any).duration ?? 0),
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error?.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}