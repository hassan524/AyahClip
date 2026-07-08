import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface OfficialAyahData {
  arabicWords: string[];
  translation: string;
  surahName: string;
  surahEnglishName: string;
}

function splitByWhitespace(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function stripDiacritics(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').trim();
}

function normalizeForCompare(text: string): string {
  return stripDiacritics(text)
    .replace(/[إأٱآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي');
}

const BISMILLAH_SKELETON = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

const MUQATTAAT = new Set(
  ['الم', 'المص', 'الر', 'المر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن']
    .map((w) => normalizeForCompare(w))
);

function isMuqattaatWord(word: string): boolean {
  return MUQATTAAT.has(normalizeForCompare(word));
}

// Uthmani script sometimes writes a vocative particle joined to the noun as ONE
// written word (e.g. "يَٰٓأَبَتِ" = "يا" + "أبت"), but Whisper transcribes them as
// TWO spoken words. This causes the transcribed-word pointer to drift by one for
// every such word in the ayah unless we count it as 2 when slicing. Add more
// normalized forms here if you hit the same drift elsewhere (e.g. "يٰبني").
const JOINED_VOCATIVE_FORMS = new Set(
  ['يأبت', 'يبني', 'يقوم', 'يعبادي', 'يااسفى'].map((w) => normalizeForCompare(w))
);

function spokenWordCount(officialWord: string): number {
  return JOINED_VOCATIVE_FORMS.has(normalizeForCompare(officialWord)) ? 2 : 1;
}

// Long ayahs (in transcribed-word count) get natural mid-ayah split points from
// the AI. Short/medium ayahs are always shown whole.
const LONG_AYAH_WORD_THRESHOLD = 12;

async function fetchOfficialAyahData(surah: number, ayah: number): Promise<OfficialAyahData | null> {
  try {
    const [arabicRes, transRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`),
      fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.sahih`),
    ]);

    if (!arabicRes.ok || !transRes.ok) return null;

    const arabicData = await arabicRes.json();
    const transData = await transRes.json();

    let arabicWords = splitByWhitespace(arabicData.data.text);
    arabicWords = arabicWords.filter((w) => stripDiacritics(w).length > 0);

    if (ayah === 1 && surah !== 1 && surah !== 9 && arabicWords.length > BISMILLAH_SKELETON.length) {
      const openingSkeleton = arabicWords.slice(0, 4).map(normalizeForCompare);
      const isBismillah = openingSkeleton.every((w, i) => w === BISMILLAH_SKELETON[i]);
      if (isBismillah) {
        arabicWords = arabicWords.slice(4);
      } else {
        let stripCount = 0;
        for (let i = 0; i < Math.min(4, arabicWords.length); i++) {
          if (normalizeForCompare(arabicWords[i]) === BISMILLAH_SKELETON[i]) stripCount++;
          else break;
        }
        if (stripCount === 4) arabicWords = arabicWords.slice(4);
      }
    }

    return {
      arabicWords,
      translation: transData.data.text,
      surahName: arabicData.data.surah.name,
      surahEnglishName: arabicData.data.surah.englishName,
    };
  } catch (err) {
    console.error(`Official ayah fetch failed for ${surah}:${ayah}`, err);
    return null;
  }
}

function splitMuqattaatTranslation(translation: string): [string, string] {
  const clean = translation.trim();
  const match = clean.match(/^([^.!?]*[.!?])\s*(.*)$/s);
  if (match && match[1] && match[2]) {
    return [match[1].trim(), match[2].trim()];
  }
  return [clean, ''];
}

// Asks the AI to pick natural phrase-level break points for a long ayah, given
// its arabic words (numbered) and the official translation. It must return
// word-index groups that cover every word exactly once, in order — we never
// let it touch the arabic text or invent a translation, just decide WHERE to
// break and how to divide the given translation across those breaks.
async function getNaturalChunks(
  arabicWords: string[],
  translation: string
): Promise<{ wordCount: number; translation: string }[] | null> {
  const numbered = arabicWords.map((w, i) => `${i + 1}:${w}`).join(' ');

  const prompt = `Here is one ayah of Quran, word by word with numbers: ${numbered}
Full official translation: "${translation}"

Split this into 2-4 natural chunks the way a human would read it aloud in short phrases for video subtitles — like splitting a long sentence at commas or natural pauses, not in the middle of a phrase. Keep grammatically connected words together (e.g. don't separate "he said" from what follows it if it's short).

Respond ONLY with JSON: { "chunks": [ { "wordCount": number, "translation": "..." } ] }
The wordCount values must add up to exactly ${arabicWords.length}. The translation pieces must be exact substrings/rephrasing of the official translation above, in order, covering all of it — do not add or remove meaning.`;

  try {
    const res = await groq.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    const chunks = parsed.chunks;

    if (!Array.isArray(chunks) || chunks.length === 0) return null;

    const total = chunks.reduce((sum: number, c: any) => sum + Number(c.wordCount || 0), 0);
    if (total !== arabicWords.length) return null; // don't trust it if counts don't add up

    return chunks.map((c: any) => ({
      wordCount: Number(c.wordCount),
      translation: String(c.translation || '').trim(),
    }));
  } catch (err) {
    console.error('Natural chunk split failed, falling back to whole ayah:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const words: WordTiming[] = body.words;

    if (!words || words.length === 0) {
      return NextResponse.json({ ayahs: [] });
    }

    const fullTranscribedText = words.map((w) => w.word).join(' ');

    const identifyPrompt = `
You are an expert Quranic reference locator. Analyze these transcribed Arabic words:
"${fullTranscribedText.substring(0, 300)}"

Determine exactly which Surah number and starting Ayah number this corresponds to.
Respond ONLY with valid JSON: { "surahNumber": number, "startingAyahNumber": number }
    `;

    const idResponse = await groq.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      messages: [{ role: 'user', content: identifyPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const idText = idResponse.choices[0]?.message?.content || '{"surahNumber":1,"startingAyahNumber":1}';
    const { surahNumber, startingAyahNumber } = JSON.parse(idText);

    let ayahIndex = startingAyahNumber;
    let wordPointer = 0;
    let safety = 0;

    const matchedAyahs: any[] = [];

    while (wordPointer < words.length && safety < 300) {
      safety++;
      const officialData = await fetchOfficialAyahData(surahNumber, ayahIndex);
      if (!officialData) break;

      // Total transcribed words this ayah should consume, accounting for
      // joined-vocative words that count as 2 spoken words.
      const expectedSpokenCount = officialData.arabicWords.reduce(
        (sum, w) => sum + spokenWordCount(w),
        0
      );

      const groupWords = words.slice(wordPointer, wordPointer + expectedSpokenCount);
      if (groupWords.length === 0) break;

      wordPointer += groupWords.length;
      ayahIndex += 1;

      const cutOffMidAyah = groupWords.length < expectedSpokenCount;

      const hasMuqattaat =
        !cutOffMidAyah &&
        officialData.arabicWords.length > 1 &&
        isMuqattaatWord(officialData.arabicWords[0]);

      if (hasMuqattaat) {
        const [muqattaatTranslation, restTranslation] = splitMuqattaatTranslation(officialData.translation);
        const muqattaatWord = groupWords[0];
        const restWords = groupWords.slice(1);

        matchedAyahs.push({
          surah: surahNumber,
          ayahNumber: ayahIndex - 1,
          surahName: officialData.surahName,
          surahEnglishName: officialData.surahEnglishName,
          arabic: officialData.arabicWords[0],
          translation: muqattaatTranslation,
          startTime: Number(muqattaatWord.start.toFixed(3)),
          endTime: Number(muqattaatWord.end.toFixed(3)),
          isFullAyah: false,
          words: [muqattaatWord],
        });

        if (restWords.length > 0) {
          matchedAyahs.push({
            surah: surahNumber,
            ayahNumber: ayahIndex - 1,
            surahName: officialData.surahName,
            surahEnglishName: officialData.surahEnglishName,
            arabic: officialData.arabicWords.slice(1).join(' '),
            translation: restTranslation,
            startTime: Number(restWords[0].start.toFixed(3)),
            endTime: Number(restWords[restWords.length - 1].end.toFixed(3)),
            isFullAyah: false,
            words: restWords,
          });
        }
        continue;
      }

      const fullArabic = cutOffMidAyah
        ? officialData.arabicWords.slice(0, groupWords.length).join(' ')
        : officialData.arabicWords.join(' ');

      // Only try natural splitting on long, fully-captured ayahs. Short ayahs,
      // and any ayah cut off mid-recording, are always shown whole.
      const shouldTrySplit = !cutOffMidAyah && groupWords.length > LONG_AYAH_WORD_THRESHOLD;

      const naturalChunks = shouldTrySplit
        ? await getNaturalChunks(officialData.arabicWords, officialData.translation)
        : null;

      if (!naturalChunks) {
        matchedAyahs.push({
          surah: surahNumber,
          ayahNumber: ayahIndex - 1,
          surahName: officialData.surahName,
          surahEnglishName: officialData.surahEnglishName,
          arabic: fullArabic,
          translation: officialData.translation,
          startTime: Number(groupWords[0].start.toFixed(3)),
          endTime: Number(groupWords[groupWords.length - 1].end.toFixed(3)),
          isFullAyah: true,
          words: groupWords,
        });
        continue;
      }

// Map each AI-chosen chunk to REAL word timestamps — not estimated.
      const spokenOffsets: number[] = [0];
      for (const w of officialData.arabicWords) {
        spokenOffsets.push(spokenOffsets[spokenOffsets.length - 1] + spokenWordCount(w));
      }

      let arabicCursor = 0;
      naturalChunks.forEach((chunk, i) => {
        const chunkArabicWords = officialData.arabicWords.slice(arabicCursor, arabicCursor + chunk.wordCount);
        const spokenStart = spokenOffsets[arabicCursor];
        const spokenEnd = spokenOffsets[arabicCursor + chunk.wordCount];
        const chunkGroupWords = groupWords.slice(spokenStart, spokenEnd);
        arabicCursor += chunk.wordCount;

        if (chunkGroupWords.length === 0) return;

        matchedAyahs.push({
          surah: surahNumber,
          ayahNumber: ayahIndex - 1,
          surahName: officialData.surahName,
          surahEnglishName: officialData.surahEnglishName,
          arabic: chunkArabicWords.join(' '),
          translation: chunk.translation,
          startTime: Number(chunkGroupWords[0].start.toFixed(3)),
          endTime: Number(chunkGroupWords[chunkGroupWords.length - 1].end.toFixed(3)),
          isFullAyah: true,
          isChunk: true,
          chunkIndex: i,
          totalChunks: naturalChunks.length,
          words: chunkGroupWords,
        });
      });
    }

    return NextResponse.json({ ayahs: matchedAyahs });
  } catch (error) {
    console.error('Alignment pipeline execution error:', error);
    return NextResponse.json({ error: 'Failed to process audio structure' }, { status: 500 });
  }
}