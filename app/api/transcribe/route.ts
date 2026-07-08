import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash';

// Gemini occasionally returns 503 UNAVAILABLE / 429 RESOURCE_EXHAUSTED under load.
// These are transient — retry with exponential backoff instead of failing the whole chunk.
function isRetryableError(err: any): boolean {
  const status = err?.status ?? err?.error?.code;
  const message = String(err?.message || err?.error?.message || '');
  return (
    status === 503 ||
    status === 429 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(message)
  );
}

async function generateContentWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0],
  maxRetries = 4
) {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxRetries) throw err;

      // Exponential backoff with jitter: ~1s, 2s, 4s, 8s (+ up to 500ms jitter)
      const delayMs = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
      console.warn(
        `Gemini overloaded (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delayMs)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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

    // System prompt ordering Gemini to track the audio timestamps
    const prompt = `
      You are an expert Quranic transcription system. Listen to the provided audio file with maximum focus.
      Transcribe the audio accurately into Arabic text and capture the exact start_time and end_time (in seconds) for each recited segment.
      
      Strict Rules:
      1. Group the output such that there is strictly ONLY ONE Ayah per block. Do not merge two verses together.
      2. Listen meticulously for Muqatta'at (disjoined letters) at the opening of Surahs (e.g., "الٓر"). Capture its specific start and end timestamp completely separate from the next verse.
    `;

    // We use Structured Outputs (responseSchema) to guarantee a flawless JSON response
    const response = await generateContentWithRetry({
      model: GEMINI_MODEL,
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
    });

    const responseText = response.text || '{"ayahs":[]}';
    const parsedData = JSON.parse(responseText);

    // Process and attach the normalized text version for your matching engine
    const finalizedAyahs = parsedData.ayahs.map((ayah: any) => ({
      id: ayah.id,
      text: ayah.text,
      normalized: normalizeArabicWord(ayah.text),
      start: ayah.start_time,
      end: ayah.end_time
    }));

    // SYNTHETIC WORDS ARRAY GENERATION
    // Since Audio LLMs don't natively output per-word timestamps, we cleanly distribute 
    // the uniform duration across words inside each ayah segment so your frontend doesn't crash!
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

    // Return the response structures that your frontend expects
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
    return NextResponse.json(
      {
        error: overloaded
          ? 'The transcription service is temporarily overloaded. Please try again in a moment.'
          : 'Failed to process audio structure',
      },
      { status: overloaded ? 503 : 500 }
    );
  }
}