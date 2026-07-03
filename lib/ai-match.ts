import Groq from 'groq-sdk';

export type InputWord = {
  word: string;
  start: number;
  end: number;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function matchAyahsWithAI(words: InputWord[], segments: any[] = []) {
  const prompt = `
You are an expert Quranic scholar processing a flawed phonetic transcription that has been broken down into specific SEGMENTS.

Your task:
1. You are provided with an array of transcription SEGMENTS.
2. For EACH segment, determine which Surah and Ayah(s) it belongs to.
3. Correct the phonetic text of that segment to exact Uthmani script with full Tashkeel (diacritics).
4. Provide the English translation for ONLY that specific segment's text.

CRITICAL INSTRUCTION: YOU MUST MAINTAIN A STRICT 1-TO-1 MAPPING WITH THE INPUT SEGMENTS.
The user has provided exactly ${segments.length} segments. You MUST output exactly ${segments.length} objects in your \`ayahs\` array.
DO NOT combine segments, even if they belong to the same Ayah. 
If segment 1 is the first half of Ayah 2:285, and segment 2 is the second half, keep them as TWO separate objects.
DO NOT hallucinate the rest of a verse. ONLY translate and output the Arabic for the words actually recited in that segment.

IMPORTANT QURANIC RULE (Muqatta'at):
Transcription engines often spell out disjointed letters phonetically (e.g., "كافها يا عين صاد" -> Kaaf Ha Ya 'Ayn Saad, "الف لام ميم" -> Alif Laam Meem).
You MUST recognize these phonetic spellings as Quranic Muqatta'at and correct them to their proper Uthmani script (e.g., "كهيعص", "الم"). Do not output the phonetic spelling.

Output your response as a JSON object with the following structure:
{
  "reasoning": "Explain your step-by-step matching for each segment, ensuring you don't combine them.",
  "ayahs": [
    {
      "surah": integer (e.g. 2),
      "ayahNumber": integer (e.g. 285),
      "surahName": "Arabic name",
      "surahEnglishName": "English name",
      "arabic": "The EXACT Uthmani text (with Tashkeel) for THIS SEGMENT ONLY.",
      "translation": "The English translation for THIS SEGMENT ONLY.",
      "isFullAyah": boolean (false if this segment only contains part of the ayah)
    }
  ]
}

User Transcription Segments:
${JSON.stringify(segments)}
`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a helpful expert in Quranic text and timestamps. You must output only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Even lower temperature to prevent hallucination
      max_tokens: 8000, // Explicitly increase max tokens to handle many segments
    });

    const content = response.choices[0].message?.content;
    if (!content) {
      throw new Error('No response from AI model');
    }

    const parsed = JSON.parse(content);
    let ayahs = parsed.ayahs || [];
    
    // Ensure we don't process more output blocks than input segments
    if (segments.length > 0) {
      ayahs = ayahs.slice(0, segments.length);
    }

    // Definitive algorithmic fallback: 
    // Bind each output block to its corresponding input segment and synthetically generate word timestamps
    for (let i = 0; i < ayahs.length; i++) {
      const ayah = ayahs[i];
      const segment = segments[i]; // The corresponding input segment
      
      if (!segment) continue;

      ayah.startTime = segment.start;
      ayah.endTime = segment.end;
      
      // Reconstruct the words array algorithmically from the corrected Arabic text
      const correctedWords = (ayah.arabic || '').split(/\\s+/).filter(Boolean);
      ayah.words = [];
      
      if (correctedWords.length > 0) {
        const duration = segment.end - segment.start;
        const timePerWord = Math.max(0.1, duration / correctedWords.length);
        
        for (let wIdx = 0; wIdx < correctedWords.length; wIdx++) {
          ayah.words.push({
            word: correctedWords[wIdx],
            start: Number((segment.start + (wIdx * timePerWord)).toFixed(3)),
            end: Number((segment.start + ((wIdx + 1) * timePerWord)).toFixed(3))
          });
        }
      }
      
      // If we clipped it heavily, it's definitely not a full ayah
      if (ayah.isFullAyah && correctedWords.length < 4) {
        ayah.isFullAyah = false;
      }
    }
    
    // Filter out completely emptied ayahs
    return ayahs.filter((a: any) => a.arabic && a.arabic.trim().length > 0);
  } catch (error) {
    console.error('Error in matchAyahsWithAI:', error);
    throw error;
  }
}

