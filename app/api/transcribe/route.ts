import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Single model. Kept as an array so generateContentWithRetry's loop logic
// (retries + model-gone fallback) doesn't need to change.
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
];

function isRetryableError(err: any): boolean {
  const status = err?.status ?? err?.error?.code;
  const message = String(err?.message || err?.error?.message || '');
  return (
    status === 503 ||
    status === 429 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(message)
  );
}

function isModelGoneError(err: any): boolean {
  const status = err?.status ?? err?.error?.code;
  const message = String(err?.message || err?.error?.message || '');
  return status === 404 || /is no longer available|NOT_FOUND/i.test(message);
}

async function generateContentWithRetry(
  buildParams: (model: string) => Parameters<typeof ai.models.generateContent>[0],
  maxRetriesPerModel = 3
) {
  let lastErr: any;

  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        return await ai.models.generateContent(buildParams(model));
      } catch (err: any) {
        lastErr = err;

        if (isModelGoneError(err)) {
          console.warn(`Model ${model} is unavailable, trying next candidate...`);
          break; // stop retrying this model, move to next one in outer loop
        }

        if (!isRetryableError(err) || attempt === maxRetriesPerModel) {
          if (isRetryableError(err)) break; // exhausted retries on this model, try next
          throw err; // non-retryable, non-"model gone" error — fail immediately
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
        console.warn(
          `${model} overloaded (attempt ${attempt + 1}/${maxRetriesPerModel + 1}), retrying in ${Math.round(delayMs)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastErr;
}

function normalizeArabicWord(input: string): string {
  return input.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, '').replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    const prompt = `
      You are an expert Quranic transcription system. Listen to the provided audio file with maximum focus.
      Transcribe the audio accurately into Arabic text and capture the exact start_time and end_time (in seconds) for each recited segment.
      
      Strict Rules:
      1. Group the output such that there is strictly ONLY ONE Ayah per block. Do not merge two verses together.
      2. Listen meticulously for Muqatta'at (disjoined letters) at the opening of Surahs (e.g., "الٓر"). Capture its specific start and end timestamp completely separate from the next verse.
    `;

    const response = await generateContentWithRetry((model) => ({
      model,
      contents: [
        {
          inlineData: {
            mimeType: audioFile.type || 'audio/mp3',
            data: base64Audio
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ayahs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                  start_time: { type: Type.NUMBER, description: "The start timestamp of this specific ayah recitation in seconds" },
                  end_time: { type: Type.NUMBER, description: "The end timestamp of this specific ayah recitation in seconds" }
                },
                required: ["id", "text", "start_time", "end_time"]
              }
            }
          },
          required: ["ayahs"]
        }
      }
    }));

    const responseText = response.text || '{"ayahs":[]}';
    const parsedData = JSON.parse(responseText);

    const finalizedAyahs = parsedData.ayahs.map((ayah: any) => ({
      id: ayah.id,
      text: ayah.text,
      normalized: normalizeArabicWord(ayah.text),
      start: ayah.start_time,
      end: ayah.end_time
    }));

    const syntheticWords: Array<{ word: string; start: number; end: number }> = [];

    for (const ayah of finalizedAyahs) {
      const wordsInAyah = ayah.text.split(/\s+/).filter(Boolean);
      if (wordsInAyah.length === 0) continue;

      const duration = ayah.end - ayah.start;
      const uniformDuration = duration / wordsInAyah.length;

      wordsInAyah.forEach((w: string, idx: number) => {
        const cleaned = normalizeArabicWord(w);
        if (cleaned) {
          syntheticWords.push({
            word: cleaned,
            start: Number((ayah.start + idx * uniformDuration).toFixed(3)),
            end: Number((ayah.start + (idx + 1) * uniformDuration).toFixed(3))
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      segments: finalizedAyahs.map((a: any) => ({
        id: a.id,
        start: a.start,
        end: a.end,
        text: a.text
      })),
      words: syntheticWords,
      ayahs: finalizedAyahs
    });

  } catch (error: any) {
    console.error('Gemini Routing Error:', error);
    const overloaded = isRetryableError(error);
    const gone = isModelGoneError(error);
    return NextResponse.json(
      {
        error: overloaded
          ? 'The transcription service is temporarily overloaded. Please try again in a moment.'
          : gone
          ? 'All configured Gemini models are currently unavailable. Update MODEL_CANDIDATES in route.ts.'
          : 'Failed to process audio structure',
      },
      { status: overloaded ? 503 : 500 }
    );
  }
}