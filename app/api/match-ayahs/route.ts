import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const DEFAULT_TRANSLATION_EDITION = 'en.sahih';
const BISMILLAH_TRANSLATION =
  'In the name of Allah, the Entirely Merciful, the Especially Merciful.';

const CHUNK_SIZE = 8;
const MAX_ARABIC_LINES_TARGET = 2;

function normalize(t: string): string {
  return (t || '')
    .normalize('NFKC')
    .replace(/[ًٌٍَُِّْٰٟۖ-ۭ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBismillah(text: string): string {
  const bismillahNorm = normalize('بسم الله الرحمن الرحيم');
  const textNorm = normalize(text);
  if (textNorm.startsWith(bismillahNorm)) {
    const wordList = text.trim().split(/\s+/);
    return wordList.slice(4).join(' ');
  }
  return text;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

function getWordSimilarity(w1: string, w2: string): number {
  const s1 = normalize(w1);
  const s2 = normalize(w2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function getTextSimilarity(a: string, b: string): number {
  const wa = normalize(a).split(' ').filter(Boolean);
  const wb = normalize(b).split(' ').filter(Boolean);
  if (!wa.length || !wb.length) return 0;

  let matches = 0;
  for (const w of wa) {
    if (wb.some((x) => getWordSimilarity(w, x) > 0.75)) matches++;
  }
  return matches / Math.max(wa.length, wb.length);
}

type WordTs = { word: string; start: number; end: number };

type AyahCandidate = { surah: any; ayah: any };

type AyahMatch = {
  surah: any;
  ayahNumber: number;
  ayahText: string;
  score: number;
};

type ChunkedTranslationPart = {
  text: string;
  fromWord: number;
  toWord: number;
};

type ResultAyah = {
  surah: number | null;
  surahName: string | null;
  surahEnglishName: string | null;
  ayahNumber: number | null;
  isBismillah?: boolean;
  arabic: string;
  translation: string;
  isFullAyah: boolean;
  isChunk?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  startTime: number;
  endTime: number;
  displayStart?: number;
  displayEnd?: number;
  words: WordTs[];
};

function searchCandidates(
  segmentText: string,
  candidates: AyahCandidate[],
  threshold: number
): AyahMatch | null {
  let best: AyahMatch | null = null;
  let bestScore = threshold;

  for (const { surah, ayah } of candidates) {
    const ayahClean = stripBismillah(ayah.text);
    const score = getTextSimilarity(segmentText, ayahClean);
    if (score > bestScore) {
      bestScore = score;
      best = {
        surah,
        ayahNumber: ayah.numberInSurah,
        ayahText: ayahClean,
        score,
      };
    }
  }

  return best;
}

function buildAllCandidates(surahsList: any[]): AyahCandidate[] {
  const all: AyahCandidate[] = [];
  for (const surah of surahsList) {
    for (const ayah of surah.ayahs) {
      all.push({ surah, ayah });
    }
  }
  return all;
}

function buildTranslationMap(translationSurahs: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const surah of translationSurahs || []) {
    for (const ayah of surah.ayahs || []) {
      map.set(`${surah.number}:${ayah.numberInSurah}`, (ayah.text || '').trim());
    }
  }
  return map;
}

function isBismillahChunk(words: WordTs[]): boolean {
  const chunk = words.map((w) => w.word).join(' ');
  const score = getTextSimilarity(chunk, 'بسم الله الرحمن الرحيم');
  return score >= 0.6;
}

function reachedAyahEnd(consumedWords: WordTs[], ayahWords: string[]): boolean {
  if (ayahWords.length === 0 || consumedWords.length === 0) return false;
  const lastAyahWord = ayahWords[ayahWords.length - 1];
  const tailWindow = consumedWords.slice(-3);
  return tailWindow.some((w) => getWordSimilarity(w.word, lastAyahWord) > 0.7);
}

function estimateArabicChunkSize(wordsCount: number): number {
  if (wordsCount <= 8) return wordsCount;
  if (wordsCount <= 12) return 6;
  if (wordsCount <= 16) return 7;
  if (wordsCount <= 22) return 8;
  return 9;
}

function splitArabicWordsForDisplay(arabic: string): string[][] {
  const words = arabic.split(/\s+/).filter(Boolean);
  if (words.length <= 8) return [words];

  const chunkSize = estimateArabicChunkSize(words.length);
  const chunks: string[][] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize));
  }

  return chunks;
}

function splitTranslationIntoUnits(translation: string): string[] {
  const clean = (translation || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentenceLike =
    clean.match(/[^.!?;:]+[.!?;:]*/g)?.map((s) => s.trim()).filter(Boolean) || [];

  if (sentenceLike.length > 1) return sentenceLike;

  const clauseLike = clean
    .split(/,\s+|;\s+|:\s+|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (clauseLike.length > 1) return clauseLike;

  const words = clean.split(/\s+/).filter(Boolean);
  const units: string[] = [];
  const step = 6;

  for (let i = 0; i < words.length; i += step) {
    units.push(words.slice(i, i + step).join(' '));
  }

  return units.length ? units : [clean];
}

function mapTranslationToArabicChunks(
  translation: string,
  totalArabicWords: number,
  chunks: { fromWord: number; toWord: number }[]
): ChunkedTranslationPart[] {
  const clean = (translation || '').trim();
  if (!clean) {
    return chunks.map((c) => ({ text: '', fromWord: c.fromWord, toWord: c.toWord }));
  }

  const units = splitTranslationIntoUnits(clean);
  const totalUnits = units.length;

  if (chunks.length === 1) {
    return [{ text: clean, fromWord: chunks[0].fromWord, toWord: chunks[0].toWord }];
  }

  if (totalUnits === 1) {
    return chunks.map((c, idx) => ({
      text: idx === 0 ? clean : '',
      fromWord: c.fromWord,
      toWord: c.toWord,
    }));
  }

  return chunks.map((c) => {
    const startRatio = totalArabicWords > 0 ? c.fromWord / totalArabicWords : 0;
    const endRatio = totalArabicWords > 0 ? c.toWord / totalArabicWords : 1;

    let unitStart = Math.floor(startRatio * totalUnits);
    let unitEnd = Math.ceil(endRatio * totalUnits);

    unitStart = Math.max(0, Math.min(unitStart, totalUnits - 1));
    unitEnd = Math.max(unitStart + 1, Math.min(unitEnd, totalUnits));

    const text = units.slice(unitStart, unitEnd).join(', ').trim();

    return {
      text,
      fromWord: c.fromWord,
      toWord: c.toWord,
    };
  });
}

function buildDisplayChunksFromMatchedWords(item: ResultAyah): ResultAyah[] {
  const dbWords = item.arabic.split(/\s+/).filter(Boolean);
  const spokenWords = item.words || [];

  if (!item.isFullAyah || dbWords.length <= 8 || spokenWords.length === 0) {
    return [{ ...item, isChunk: false, chunkIndex: 0, totalChunks: 1 }];
  }

  const arabicChunks = splitArabicWordsForDisplay(item.arabic);
  const ranges: { fromWord: number; toWord: number }[] = [];

  let cursor = 0;
  for (const chunkWords of arabicChunks) {
    const fromWord = cursor;
    const toWord = cursor + chunkWords.length;
    ranges.push({ fromWord, toWord });
    cursor = toWord;
  }

  const translationParts = mapTranslationToArabicChunks(
    item.translation,
    dbWords.length,
    ranges
  );

  const result: ResultAyah[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const chunkArabicWords = dbWords.slice(range.fromWord, range.toWord);

    const startIdx = Math.min(range.fromWord, spokenWords.length - 1);
    const endIdxExclusive = Math.min(range.toWord, spokenWords.length);
    const chunkWords = spokenWords.slice(startIdx, endIdxExclusive);

    if (chunkWords.length === 0) continue;

    result.push({
      surah: item.surah,
      surahName: item.surahName,
      surahEnglishName: item.surahEnglishName,
      ayahNumber: item.ayahNumber,
      isBismillah: false,
      arabic: chunkArabicWords.join(' '),
      translation: translationParts[i]?.text || '',
      isFullAyah: true,
      isChunk: true,
      chunkIndex: i,
      totalChunks: ranges.length,
      startTime: Number(chunkWords[0].start.toFixed(2)),
      endTime: Number(chunkWords[chunkWords.length - 1].end.toFixed(2)),
      words: chunkWords.map((w) => ({
        word: w.word,
        start: Number(w.start.toFixed(2)),
        end: Number(w.end.toFixed(2)),
      })),
    });
  }

  return result.length ? result : [{ ...item, isChunk: false, chunkIndex: 0, totalChunks: 1 }];
}

function buildFinalAyahs(results: ResultAyah[], videoDuration: number) {
  const expanded = results.flatMap((item) => buildDisplayChunksFromMatchedWords(item));

  return expanded.map((item, idx) => {
    const next = expanded[idx + 1];

    const displayStart = item.startTime;
    const displayEnd = next
      ? next.startTime
      : videoDuration > 0
        ? videoDuration
        : item.endTime;

    return {
      surah: item.surah,
      surahName: item.surahName,
      surahEnglishName: item.surahEnglishName,
      ayahNumber: item.isBismillah ? 0 : item.ayahNumber,
      isBismillah: !!item.isBismillah,
      arabic: item.arabic,
      translation: item.translation,
      isFullAyah: item.isFullAyah,
      isChunk: !!item.isChunk,
      chunkIndex: item.chunkIndex ?? 0,
      totalChunks: item.totalChunks ?? 1,
      startTime: Number(item.startTime.toFixed(2)),
      endTime: Number(item.endTime.toFixed(2)),
      duration: Number((item.endTime - item.startTime).toFixed(2)),
      displayStart: Number(displayStart.toFixed(2)),
      displayEnd: Number(displayEnd.toFixed(2)),
      words: item.words,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { words = [], videoDuration = 0 } = body;

    const wordStream: WordTs[] = (Array.isArray(words) ? words : [])
      .filter((w: any) => w.word && w.word.trim())
      .map((w: any) => ({
        word: w.word.trim(),
        start: Number(w.start ?? 0),
        end: Number(w.end ?? 0),
      }));

    if (wordStream.length === 0) {
      return NextResponse.json({ error: 'No words provided.' }, { status: 400 });
    }

    const [quranRes, translationRes] = await Promise.all([
      fetch('https://api.alquran.cloud/v1/quran/ar.quran-uthmani', { cache: 'force-cache' }),
      fetch(`https://api.alquran.cloud/v1/quran/${DEFAULT_TRANSLATION_EDITION}`, {
        cache: 'force-cache',
      }),
    ]);

    const quranData = await quranRes.json();
    const translationData = await translationRes.json();

    const surahsList: any[] = quranData?.data?.surahs || [];
    const translationMap = buildTranslationMap(translationData?.data?.surahs || []);
    const allCandidates = buildAllCandidates(surahsList);
    const getTranslation = (s: number, a: number) => translationMap.get(`${s}:${a}`) || '';

    const results: ResultAyah[] = [];
    let p = 0;

    if (wordStream.length >= 4 && isBismillahChunk(wordStream.slice(0, 4))) {
      const chunk = wordStream.slice(0, 4);
      results.push({
        surah: null,
        surahName: null,
        surahEnglishName: null,
        ayahNumber: 0,
        isBismillah: true,
        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: BISMILLAH_TRANSLATION,
        isFullAyah: true,
        startTime: Number(chunk[0].start.toFixed(2)),
        endTime: Number(chunk[chunk.length - 1].end.toFixed(2)),
        words: chunk.map((w) => ({
          word: w.word,
          start: Number(w.start.toFixed(2)),
          end: Number(w.end.toFixed(2)),
        })),
      });
      p = 4;
    }

    const initialChunk = wordStream.slice(p, p + 12).map((w) => w.word).join(' ');
    const anchor = searchCandidates(initialChunk, allCandidates, 0.3);

    if (!anchor) {
      if (p < wordStream.length) {
        const rest = wordStream.slice(p);
        results.push({
          surah: null,
          surahName: null,
          surahEnglishName: null,
          ayahNumber: null,
          arabic: rest.map((w) => w.word).join(' '),
          translation: '',
          isFullAyah: false,
          startTime: Number(rest[0].start.toFixed(2)),
          endTime: Number(rest[rest.length - 1].end.toFixed(2)),
          words: rest.map((w) => ({
            word: w.word,
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2)),
          })),
        });
      }

      return NextResponse.json({ ayahs: buildFinalAyahs(results, videoDuration) });
    }

    let curSurahNum = anchor.surah.number;
    let curAyahNum = anchor.ayahNumber;
    let safety = 0;

    while (p < wordStream.length && safety < wordStream.length * 3) {
      safety++;

      const surah = surahsList.find((s) => s.number === curSurahNum);
      if (!surah) break;

      const ayah = surah.ayahs.find((a: any) => a.numberInSurah === curAyahNum);
      if (!ayah) {
        const nextSurah = surahsList.find((s) => s.number === curSurahNum + 1);
        if (!nextSurah) break;
        curSurahNum = nextSurah.number;
        curAyahNum = 1;
        continue;
      }

      const ayahClean = stripBismillah(ayah.text);
      const ayahWords = normalize(ayahClean).split(' ').filter(Boolean);
      const ayahWordCount = ayahWords.length;

      let bestWindow: number | null = null;
      let bestScore = 0.32;

      const minW = Math.max(1, ayahWordCount - 3);
      const maxW = Math.min(wordStream.length - p, ayahWordCount + 5);

      for (let w = minW; w <= maxW; w++) {
        const chunkText = wordStream.slice(p, p + w).map((x) => x.word).join(' ');
        const score = getTextSimilarity(chunkText, ayahClean);
        if (score > bestScore) {
          bestScore = score;
          bestWindow = w;
        }
      }

      if (bestWindow !== null) {
        const consumed = wordStream.slice(p, p + bestWindow);
        const fullEnough = bestScore >= 0.55 && reachedAyahEnd(consumed, ayahWords);
        const spokenText = consumed.map((w) => w.word).join(' ');

        results.push({
          surah: surah.number,
          surahName: surah.name,
          surahEnglishName: surah.englishName,
          ayahNumber: fullEnough ? curAyahNum : null,
          arabic: fullEnough ? ayahClean : spokenText,
          translation: fullEnough ? getTranslation(surah.number, curAyahNum) : '',
          isFullAyah: fullEnough,
          startTime: Number(consumed[0].start.toFixed(2)),
          endTime: Number(consumed[consumed.length - 1].end.toFixed(2)),
          words: consumed.map((w) => ({
            word: w.word,
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2)),
          })),
        });

        p += bestWindow;
        curAyahNum += 1;
      } else {
        const lookahead = wordStream.slice(p, p + 12).map((x) => x.word).join(' ');
        const reAnchor = searchCandidates(lookahead, allCandidates, 0.3);

        if (reAnchor && (reAnchor.surah.number !== curSurahNum || reAnchor.ayahNumber !== curAyahNum)) {
          curSurahNum = reAnchor.surah.number;
          curAyahNum = reAnchor.ayahNumber;
          continue;
        }

        const w = wordStream[p];
        const last = results[results.length - 1];

        if (last && last.surah === null && !last.isBismillah) {
          last.endTime = Number(w.end.toFixed(2));
          last.arabic += ` ${w.word}`;
          last.words.push({
            word: w.word,
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2)),
          });
        } else {
          results.push({
            surah: null,
            surahName: null,
            surahEnglishName: null,
            ayahNumber: null,
            arabic: w.word,
            translation: '',
            isFullAyah: false,
            startTime: Number(w.start.toFixed(2)),
            endTime: Number(w.end.toFixed(2)),
            words: [
              {
                word: w.word,
                start: Number(w.start.toFixed(2)),
                end: Number(w.end.toFixed(2)),
              },
            ],
          });
        }

        p += 1;
      }
    }

    return NextResponse.json({
      ayahs: buildFinalAyahs(results, videoDuration),
    });
  } catch (error: any) {
    console.error('[match] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Matching failed' },
      { status: 500 }
    );
  }
}
