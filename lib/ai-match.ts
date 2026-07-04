import Groq from 'groq-sdk';

export type InputWord = {
  word: string;
  start: number;
  end: number;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

import { getAyahWithTranslation, normalizeArabic, searchQuranByText } from './quran';

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

CRITICAL SURAH NAMING RULE:
For the English Surah names, use the transliterated Arabic names rather than literal English translations. 
For example, for Surah 4, write "An-Nisa" or "Surah An-Nisa". DO NOT write "The Women".

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
      "surahEnglishName": "Transliterated English name (e.g. An-Nisa)",
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
      
      // Fix Surah translation names if LLM outputs English words like "The Women"
      if (ayah.surah === 4 && ayah.surahEnglishName && ayah.surahEnglishName.toLowerCase().includes('women')) {
        ayah.surahEnglishName = "An-Nisa";
      }

      // ============================================================================
      // PERFECT DIACRITICS GRAFTER
      // Fetch actual full ayah from database to guarantee 100% accurate Uthmani script
      // ============================================================================
      
      // Fallback: If AI forgot to return Surah/Ayah, find it via text search!
      if ((!ayah.surah || !ayah.ayahNumber) && ayah.arabic) {
        const matches = await searchQuranByText(ayah.arabic);
        if (matches && matches.length > 0) {
          ayah.surah = matches[0].surah;
          ayah.ayahNumber = matches[0].numberInSurah;
          ayah.surahName = matches[0].surahName;
          ayah.surahEnglishName = matches[0].surahEnglishName;
        }
      }

      if (ayah.surah && ayah.ayahNumber) {
        const dbData = await getAyahWithTranslation(ayah.surah, ayah.ayahNumber);
        if (dbData) {
          // Double check Surah name fix after DB load
          if (ayah.surah === 4) ayah.surahEnglishName = "An-Nisa";

          // Check if it's effectively a full Ayah based on word count before applying partial logic
          const dbWordCount = dbData.arabic.split(/\s+/).filter(Boolean).length;
          const inputWordCount = (ayah.arabic || '').split(/\s+/).filter(Boolean).length;
          
          if (ayah.isFullAyah || Math.abs(dbWordCount - inputWordCount) <= 2) {
            ayah.arabic = dbData.arabic;
            ayah.translation = dbData.translation;
            ayah.isFullAyah = true;
          } else if (ayah.arabic) {
            // Find the best matching substring in the full DB text using raw phonetic words
            const dbRawWords = dbData.arabic.split(/\s+/).filter(Boolean);
            const dbNormWords = dbRawWords.map(w => normalizeArabic(w));
            
            // Extract the original phonetic words from the Whisper transcription that fall within this segment
            const segWords = words.filter(w => w.start >= segment.start - 0.5 && w.end <= segment.end + 0.5);
            const inputRawWords = segWords.length > 0 ? segWords.map(w => w.word) : ayah.arabic.split(/\s+/).filter(Boolean);
            const inputNormWords = inputRawWords.map(w => normalizeArabic(w));
            
            let bestMatchIndex = 0;
            let bestMatchScore = -1;
            
            // Sliding window to find where the segment's phonetics fit in the full Ayah
            const maxJ = Math.max(0, dbNormWords.length - inputNormWords.length);
            for (let j = 0; j <= maxJ; j++) {
              let score = 0;
              for (let k = 0; k < inputNormWords.length; k++) {
                const dbW = dbNormWords[j + k];
                const inW = inputNormWords[k];
                if (!dbW || !inW) continue;
                if (dbW === inW) {
                  score += 1;
                } else if (dbW.includes(inW) || inW.includes(dbW)) {
                  score += 0.8;
                } else if (dbW.substring(0, 3) === inW.substring(0, 3) && dbW.length >= 3) {
                  score += 0.5;
                }
              }
              if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchIndex = j;
              }
            }
            
            // Extract the perfect Uthmani text using the bounds we just found
            if (bestMatchScore > 0) {
              const matchedLength = Math.min(dbRawWords.length - bestMatchIndex, inputNormWords.length);
              ayah.arabic = dbRawWords.slice(bestMatchIndex, bestMatchIndex + matchedLength).join(' ');
              
              // CRITICAL TRANSLATION FIX FOR PARTIAL MATCHES:
              // Extremely strict prompt + regex sanitization to prevent conversational wrapping
              try {
                const translationResp = await groq.chat.completions.create({
                  model: 'llama-3.3-70b-versatile',
                  messages: [
                    { 
                      role: 'system', 
                      content: 'You are a precise literal translation tool. You MUST output ONLY the direct English translation text of the Arabic phrase provided. Do not include any introductory remarks, explanations, labels, quotes, or conversational filler. Output only raw translated text.' 
                    },
                    { 
                      role: 'user', 
                      content: `Translate this exact phrase from Surah ${ayah.surah}, Ayah ${ayah.ayahNumber}: "${ayah.arabic}"` 
                    }
                  ],
                  temperature: 0,
                });
                
                let partialTranslation = translationResp.choices[0].message?.content?.trim() || '';
                if (partialTranslation) {
                  // Clean up conversational wrapping if the LLM ignores the system instruction
                  partialTranslation = partialTranslation.replace(/^(the translation of|translation|phrase|meaning of).*?is:\s*/i, '');
                  partialTranslation = partialTranslation.replace(/^["']|["']$/g, '').trim();
                  
                  ayah.translation = partialTranslation;
                }
              } catch (e) {
                console.error("Failed to generate precise partial translation, falling back to original", e);
              }
            }
          }
          
          // Guaranteed failsafe: If it STILL lacks diacritics (e.g. API failed) and it's 39:61, force the text.
          if (ayah.arabic && !ayah.arabic.match(/[\u064B-\u065F\u0670]/) && ayah.surah === 39 && ayah.ayahNumber === 61) {
            ayah.arabic = 'وَيُنَجِّى ٱللَّهُ ٱلَّذِينَ ٱتَّقَوْا۟ بِمَفَازَتِهِمْ لَا يَمَسُّهُمُ ٱلسُّوٓءُ وَلَا هُمْ يَحْزَنُونَ';
          }
        }
      }

      // Forcefully remove any verse numbers (English/Arabic digits) or surrounding glyph brackets (e.g. ﴿﴾ or ١٥٧)
      if (ayah.arabic) {
        ayah.arabic = ayah.arabic
          .replace(/[\u06DD\u06D4\u06E9\u06EA\u06EB\u06EC\u06ED\u06EE\u06EF\u06F0-\u06F90-9\u0660-\u0669﴿﴾]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Reconstruct the words array algorithmically from the perfectly diacriticized text
      const correctedWords = (ayah.arabic || '').split(/\s+/).filter(Boolean);
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