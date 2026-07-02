import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const DEFAULT_TRANSLATION_EDITION = 'en.sahih';
const BISMILLAH_TRANSLATION =
  'In the name of Allah, the Entirely Merciful, the Especially Merciful.';

// Minimum seconds a real spoken word must take.
// Whisper hallucinations (from on-screen text, watermarks, silence) typically
// produce words with near-zero duration like 0.02s. Real Arabic speech is
// never faster than ~0.08s per word even at rapid recitation speed.
const MIN_WORD_DURATION = 0.08;

// If a cluster of 3+ consecutive words spans less than this many seconds in
// total, the whole cluster is treated as a hallucination and dropped.
const MIN_CLUSTER_DURATION = 0.25;

// ---------- TEXT CLEANUP ----------

// Strip diacritics + unify letter variants so fuzzy matching isn't thrown off
// by tashkeel or alif/yaa differences. Used ONLY for scoring, never display.
function normalize(t: string): string {
  return (t || '')
    .normalize('NFKC')
    .replace(/[ًٌٍَُِّْٰٟۖ-ۭ]/g, '')   // remove diacritics
    .replace(/[إأآٱ]/g, 'ا')             // unify alif variants → ا
    .replace(/ى/g, 'ي')                  // unify yaa variants
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')                  // taa marbuta → haa
    .replace(/ـ/g, '')                   // remove tatweel
    .replace(/[^\u0621-\u064A\s]/g, ' ') // drop non-Arabic chars
    .replace(/\s+/g, ' ')
    .trim();
}

// Some Quran editions include the Bismillah as the first 4 words of ayah 1.
// Strip it off so we can match the actual ayah text cleanly.
function stripBismillah(text: string): string {
  const bismillahNorm = normalize('بسم الله الرحمن الرحيم');
  const textNorm = normalize(text);
  if (textNorm.startsWith(bismillahNorm)) {
    return text.trim().split(/\s+/).slice(4).join(' ');
  }
  return text;
}

// ---------- HALLUCINATION FILTER ----------

// Whisper sometimes transcribes on-screen text, watermarks, channel names, or
// silence as Arabic words. These fake words have two telltale signs:
//  1. Individual word duration is near-zero (e.g. 0.02s per word).
//  2. A burst of several words all crammed into a tiny total time span.
// This function removes both kinds so they never reach the matcher.
function filterHallucinatedWords(words: { word: string; start: number; end: number }[]) {
  // Pass 1: drop any word whose own duration is impossibly short.
  // Even the fastest Quranic recitation takes at least MIN_WORD_DURATION per word.
  const pass1 = words.filter((w) => (w.end - w.start) >= MIN_WORD_DURATION);

  // Pass 2: scan consecutive groups and drop any cluster where many words
  // finish in almost no time — another Whisper hallucination signature.
  const result: typeof words = [];
  let i = 0;

  while (i < pass1.length) {
    // Look ahead to see how many consecutive words fit inside MIN_CLUSTER_DURATION.
    let j = i + 1;
    while (j < pass1.length && (pass1[j].end - pass1[i].start) < MIN_CLUSTER_DURATION) {
      j++;
    }
    const clusterSize = j - i;

    // A cluster of 3+ words that all finish in under MIN_CLUSTER_DURATION is fake.
    if (clusterSize >= 3) {
      // Skip the whole cluster — it's a hallucination burst.
      i = j;
    } else {
      // Single word or small cluster that passed pass 1 — keep it.
      result.push(pass1[i]);
      i++;
    }
  }

  return result;
}

// ---------- FUZZY MATCHING ----------

// Minimum edit distance between two strings.
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

// 0..1 similarity for a single word pair. 1 = identical.
function getWordSimilarity(w1: string, w2: string): number {
  const s1 = normalize(w1);
  const s2 = normalize(w2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

// 0..1 similarity for two whole phrases: what fraction of words in `a`
// have a close match (>0.75) somewhere in `b`.
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

// ---------- MUQATTA'AT (DISJOINTED LETTERS) ----------
//
// 29 surahs open with disjointed Arabic letters (al-Huruf al-Muqatta'at),
// e.g. Surah Maryam opens with "كهيعص" (recited letter-by-letter: kaf-ha-ya-ayn-saad).
// Whisper transcribes these as the SPOKEN LETTER NAMES, not the fused DB form
// — and crucially, Whisper's word-splitting for those names is unpredictable.

// Maps each individual Arabic letter to how it's pronounced/spelled when
// recited aloud (its "name"), used to auto-derive the spoken form from the
// literal fused Quran-text form below.
const LETTER_NAMES: Record<string, string> = {
  'ا': 'الف',
  'ل': 'لام',
  'م': 'ميم',
  'ص': 'صاد',
  'ر': 'را',
  'ك': 'كاف',
  'ه': 'ها',
  'ي': 'يا',
  'ع': 'عين',
  'ط': 'طا',
  'س': 'سين',
  'ح': 'حا',
  'ق': 'قاف',
  'ن': 'نون',
};

function lettersToSpokenConcat(fused: string): string {
  return fused
    .replace(/\s+/g, '')
    .split('')
    .map((ch) => LETTER_NAMES[ch] || ch)
    .join('');
}

function findClauseBreaks(translationWords: string[]): number[] {
  const breaks: number[] = [];
  for (let i = 0; i < translationWords.length; i++) {
    if (/[,;:]$/.test(translationWords[i])) breaks.push(i + 1); // cut AFTER this word
  }
  return breaks;
}

// `fused`: literal Quran-DB text for the muqatta'at (used for display).
// `display`: optional override for how it should render (defaults to fused).
// `nextAyah`: إذا كانت الحروف المقطعة تشكل الآية الأولى كاملة، ننتقل للآية 2.
// أما إذا كانت الحروف المقطعة مجرد بداية للآية الأولى، نضع القيمة 1 ليكمل الخوارزمية مطابقة بقية الآية.
const MUQATTAAT_BY_SURAH: Record<
  number,
  { fused: string; display?: string; nextAyah: number }
> = {
  2: { fused: 'الم', nextAyah: 2 },
  3: { fused: 'الم', nextAyah: 2 },
  7: { fused: 'المص', nextAyah: 2 },
  10: { fused: 'الر', nextAyah: 1 }, // تم الإصلاح: الر جزء من الآية 1 وليست آية كاملة
  11: { fused: 'الر', nextAyah: 1 }, // تم الإصلاح
  12: { fused: 'الر', nextAyah: 1 }, // تم الإصلاح
  13: { fused: 'المر', nextAyah: 1 }, // تم الإصلاح
  14: { fused: 'الر', nextAyah: 1 }, // تم الإصلاح
  15: { fused: 'الر', nextAyah: 1 }, // تم الإصلاح
  19: { fused: 'كهيعص', nextAyah: 2 },
  20: { fused: 'طه', nextAyah: 2 },
  26: { fused: 'طسم', nextAyah: 2 },
  27: { fused: 'طس', nextAyah: 1 }, // تم الإصلاح
  28: { fused: 'طسم', nextAyah: 2 },
  29: { fused: 'الم', nextAyah: 2 },
  30: { fused: 'الم', nextAyah: 2 },
  31: { fused: 'الم', nextAyah: 2 },
  32: { fused: 'الم', nextAyah: 2 },
  36: { fused: 'يس', nextAyah: 2 },
  38: { fused: 'ص', nextAyah: 1 }, // تم الإصلاح
  40: { fused: 'حم', nextAyah: 2 },
  41: { fused: 'حم', nextAyah: 2 },
  // Surah 42: "حم" is ayah 1, "عسق" is its own ayah 2. Matched/displayed as
  // one combined unit, then the loop resumes at ayah 3.
  42: { fused: 'حمعسق', display: 'حم عسق', nextAyah: 3 },
  43: { fused: 'حم', nextAyah: 2 },
  44: { fused: 'حم', nextAyah: 2 },
  45: { fused: 'حم', nextAyah: 2 },
  46: { fused: 'حم', nextAyah: 2 },
  50: { fused: 'ق', nextAyah: 1 }, // تم الإصلاح
  68: { fused: 'ن', nextAyah: 1 }, // تم الإصلاح: حرف ن جزء من الآية الأولى "ن والقلم وما يسطرون"
};

// Precompute the derived spoken-name concat string for each surah once,
// so we're not re-deriving it on every request.
const MUQATTAAT_ENTRIES = Object.entries(MUQATTAAT_BY_SURAH).map(([numStr, cfg]) => ({
  surahNumber: Number(numStr),
  fused: cfg.fused,
  display: cfg.display ?? cfg.fused,
  nextAyah: cfg.nextAyah,
  spokenConcat: lettersToSpokenConcat(cfg.fused),
}));

const MUQATTAAT_MATCH_THRESHOLD = 0.68;
const MUQATTAAT_MAX_WINDOW = 8; // max spoken words to try consuming
const MUQATTAAT_MIN_LEN_RATIO = 0.5;
const MUQATTAAT_MAX_LEN_RATIO = 1.6;

// Tries every window size (1..MUQATTAAT_MAX_WINDOW words) starting at
// `startIdx`, concatenates those words with spaces stripped, and compares
// the resulting character sequence against each surah's derived letter-name
// sequence — completely independent of how Whisper happened to split words.
function detectMuqattaat(
  wordStream: WordTs[],
  startIdx: number
): { surahNumber: number; consumedCount: number } | null {
  let best: { surahNumber: number; consumedCount: number; score: number } | null = null;

  const maxTry = Math.min(MUQATTAAT_MAX_WINDOW, wordStream.length - startIdx);
  if (maxTry < 1) return null;

  for (const entry of MUQATTAAT_ENTRIES) {
    const refConcat = entry.spokenConcat;
    if (!refConcat) continue;

    for (let w = 1; w <= maxTry; w++) {
      const candidateConcat = wordStream
        .slice(startIdx, startIdx + w)
        .map((x) => x.word)
        .join('');

      // Cheap length-based prefilter before running Levenshtein.
      const candNorm = normalize(candidateConcat);
      const refNorm = normalize(refConcat);
      if (!candNorm || !refNorm) continue;

      const lenRatio = candNorm.length / refNorm.length;
      if (lenRatio < MUQATTAAT_MIN_LEN_RATIO || lenRatio > MUQATTAAT_MAX_LEN_RATIO) continue;

      const score = getWordSimilarity(candNorm, refNorm);

      if (score >= MUQATTAAT_MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { surahNumber: entry.surahNumber, consumedCount: w, score };
      }
    }
  }

  return best ? { surahNumber: best.surahNumber, consumedCount: best.consumedCount } : null;
}

// ---------- TYPES ----------

type WordTs = { word: string; start: number; end: number };
type AyahCandidate = { surah: any; ayah: any };
type AyahMatch = { surah: any; ayahNumber: number; ayahText: string; score: number };

type ResultAyah = {
  surah: number | null;
  surahName: string | null;
  surahEnglishName: string | null;
  ayahNumber: number | null;
  isBismillah?: boolean;
  isMuqattaat?: boolean;
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

// ---------- HELPERS ----------

// Search the whole Quran for the ayah that best matches a spoken text snippet.
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
      best = { surah, ayahNumber: ayah.numberInSurah, ayahText: ayahClean, score };
    }
  }
  return best;
}

// Flatten surah->ayahs structure into one big searchable array.
function buildAllCandidates(surahsList: any[]): AyahCandidate[] {
  const all: AyahCandidate[] = [];
  for (const surah of surahsList) {
    for (const ayah of surah.ayahs) {
      all.push({ surah, ayah });
    }
  }
  return all;
}

// Build a fast "surah:ayah" -> translation string lookup map.
function buildTranslationMap(translationSurahs: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const surah of translationSurahs || []) {
    for (const ayah of surah.ayahs || []) {
      map.set(`${surah.number}:${ayah.numberInSurah}`, (ayah.text || '').trim());
    }
  }
  return map;
}

// Returns true if the first few spoken words sound like the Bismillah.
function isBismillahChunk(words: WordTs[]): boolean {
  const chunk = words.map((w) => w.word).join(' ');
  return getTextSimilarity(chunk, 'بسم الله الرحمن الرحيم') >= 0.6;
}

// Returns true if the consumed words reach the last word of the canonical ayah.
function reachedAyahEnd(consumedWords: WordTs[], ayahWords: string[]): boolean {
  if (!ayahWords.length || !consumedWords.length) return false;
  const lastAyahWord = ayahWords[ayahWords.length - 1];
  return consumedWords.slice(-3).some((w) => getWordSimilarity(w.word, lastAyahWord) > 0.7);
}

// How many Arabic words should sit on one display line, based on ayah length.
function estimateArabicChunkSize(wordsCount: number): number {
  if (wordsCount <= 8) return wordsCount;
  if (wordsCount <= 12) return 6;
  if (wordsCount <= 16) return 7;
  if (wordsCount <= 22) return 8;
  return 9;
}

// Splits the English translation into N portions, preferring to cut at
// clause boundaries (commas) near the ideal word-count split point rather
// than slicing straight through the middle of a phrase.
function splitTranslationForChunks(translation: string, numChunks: number): string[] {
  if (!translation || numChunks <= 1) return [translation];

  const words = translation.split(/\s+/).filter(Boolean);
  if (words.length === 0) return Array(numChunks).fill('');

  // Fewer words than chunks — can't manufacture text that isn't there.
  if (words.length <= numChunks) {
    const parts = [...words];
    while (parts.length < numChunks) parts.push('');
    return parts;
  }

  const idealChunkSize = words.length / numChunks;
  const searchWindow = Math.max(2, Math.round(idealChunkSize * 0.6));

  const cutPoints: number[] = [];
  let prevCut = 0;

  for (let i = 1; i < numChunks; i++) {
    const idealEnd = Math.round(i * idealChunkSize);
    let cutAt = idealEnd;
    let found = false;

    for (let offset = 0; offset <= searchWindow && !found; offset++) {
      const forwardIdx = idealEnd + offset;
      if (
        forwardIdx > prevCut &&
        forwardIdx < words.length &&
        /[,;:]$/.test(words[forwardIdx - 1])
      ) {
        cutAt = forwardIdx;
        found = true;
        break;
      }
      const backwardIdx = idealEnd - offset;
      if (
        backwardIdx > prevCut &&
        backwardIdx < words.length &&
        /[,;:]$/.test(words[backwardIdx - 1])
      ) {
        cutAt = backwardIdx;
        found = true;
        break;
      }
    }

    cutAt = Math.max(prevCut + 1, Math.min(cutAt, words.length - (numChunks - i)));
    cutPoints.push(cutAt);
    prevCut = cutAt;
  }

  cutPoints.push(words.length);

  const parts: string[] = [];
  let start = 0;
  for (const cut of cutPoints) {
    parts.push(words.slice(start, cut).join(' '));
    start = cut;
  }
  return parts;
}

// ---------- CHUNKING ----------
function buildDisplayChunksFromMatchedWords(item: ResultAyah): ResultAyah[] {
  const dbWords = item.arabic.split(/\s+/).filter(Boolean);
  const spokenWords = item.words || [];

  // Short ayah / unmatched / no timestamps → single unsplit line.
  if (!item.isFullAyah || dbWords.length <= 8 || spokenWords.length === 0) {
    return [{ ...item, isChunk: false, chunkIndex: 0, totalChunks: 1 }];
  }

  const totalSpoken = spokenWords.length;
  const targetChunkSize = estimateArabicChunkSize(dbWords.length);
  const idealNumChunks = Math.max(1, Math.ceil(totalSpoken / targetChunkSize));

  const translationWords = item.translation
    ? item.translation.split(/\s+/).filter(Boolean)
    : [];

  const cutProportions: number[] = [];

  if (idealNumChunks > 1 && translationWords.length > 1) {
    const clauseBreaks = findClauseBreaks(translationWords);
    const usedBreaks = new Set<number>();
    const maxDist = translationWords.length / idealNumChunks;

    for (let i = 1; i < idealNumChunks; i++) {
      const idealWordIdx = Math.round((i / idealNumChunks) * translationWords.length);
      let chosenIdx = idealWordIdx;
      let bestDist = Infinity;

      for (const b of clauseBreaks) {
        if (usedBreaks.has(b)) continue;
        const dist = Math.abs(b - idealWordIdx);
        if (dist < bestDist && dist <= maxDist) {
          chosenIdx = b;
          bestDist = dist;
        }
      }
      if (bestDist !== Infinity) usedBreaks.add(chosenIdx);

      const prevIdx = cutProportions.length
        ? Math.round(cutProportions[cutProportions.length - 1] * translationWords.length)
        : 0;
      chosenIdx = Math.max(prevIdx + 1, Math.min(chosenIdx, translationWords.length - 1));
      cutProportions.push(chosenIdx / translationWords.length);
    }
  } else {
    for (let i = 1; i < idealNumChunks; i++) {
      cutProportions.push(i / idealNumChunks);
    }
  }

  if (cutProportions.length === 0) {
    return [{ ...item, isChunk: false, chunkIndex: 0, totalChunks: 1 }];
  }

  const toMonotonicCuts = (length: number, buffer = 0) => {
    const cuts: number[] = [];
    let prev = 0;
    for (const p of cutProportions) {
      const idx = Math.max(prev + 1, Math.min(Math.round(p * length) + buffer, length - 1));
      cuts.push(idx);
      prev = idx;
    }
    return cuts;
  };

  const dbCuts = toMonotonicCuts(dbWords.length, 1); 
  const trCuts = toMonotonicCuts(translationWords.length);
  const spCuts = toMonotonicCuts(totalSpoken);

  const boundaries = dbCuts.length + 1;
  const built: ResultAyah[] = [];
  let dbStart = 0, trStart = 0, spStart = 0;

  for (let i = 0; i < boundaries; i++) {
    const isLast = i === boundaries - 1;
    const dbEnd = isLast ? dbWords.length : dbCuts[i];
    const trEnd = isLast ? translationWords.length : trCuts[i];
    const spEnd = isLast ? totalSpoken : spCuts[i];

    const chunkSpokenWords = spokenWords.slice(spStart, Math.max(spStart + 1, spEnd));

    if (chunkSpokenWords.length > 0) {
      built.push({
        surah: item.surah,
        surahName: item.surahName,
        surahEnglishName: item.surahEnglishName,
        ayahNumber: item.ayahNumber,
        isBismillah: false,
        arabic: dbWords.slice(dbStart, Math.max(dbStart + 1, dbEnd)).join(' '),
        translation: translationWords.slice(trStart, trEnd).join(' '),
        isFullAyah: true,
        isChunk: true,
        startTime: Number(chunkSpokenWords[0].start.toFixed(2)),
        endTime: Number(chunkSpokenWords[chunkSpokenWords.length - 1].end.toFixed(2)),
        words: chunkSpokenWords.map((w) => ({
          word: w.word,
          start: Number(w.start.toFixed(2)),
          end: Number(w.end.toFixed(2)),
        })),
      });
    }

    dbStart = dbEnd;
    trStart = trEnd;
    spStart = spEnd;
  }

  if (built.length === 0) {
    return [{ ...item, isChunk: false, chunkIndex: 0, totalChunks: 1 }];
  }

  return built.map((b, idx) => ({ ...b, chunkIndex: idx, totalChunks: built.length }));
}

// ---------- FINAL ASSEMBLY ----------

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
      isMuqattaat: !!item.isMuqattaat,
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

// ---------- ROUTE HANDLER ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { words = [], videoDuration = 0 } = body;

    const rawWords: WordTs[] = (Array.isArray(words) ? words : [])
      .filter((w: any) => w.word && w.word.trim())
      .map((w: any) => ({
        word: w.word.trim(),
        start: Number(w.start ?? 0),
        end: Number(w.end ?? 0),
      }));

    const wordStream = filterHallucinatedWords(rawWords);

    if (wordStream.length === 0) {
      return NextResponse.json({ error: 'No words provided.' }, { status: 400 });
    }

    const [quranRes, translationRes] = await Promise.all([
      fetch('https://api.alquran.cloud/v1/quran/ar.quran-uthmani', { cache: 'force-cache' }),
      fetch(`https://api.alquran.cloud/v1/quran/${DEFAULT_TRANSLATION_EDITION}`, { cache: 'force-cache' }),
    ]);

    const quranData = await quranRes.json();
    const translationData = await translationRes.json();

    const surahsList: any[] = quranData?.data?.surahs || [];
    const translationMap = buildTranslationMap(translationData?.data?.surahs || []);
    const allCandidates = buildAllCandidates(surahsList);
    const getTranslation = (s: number, a: number) => translationMap.get(`${s}:${a}`) || '';

    const results: ResultAyah[] = [];
    let p = 0; 

    // --- Step 3: detect opening Bismillah ---
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

    let curSurahNum: number | null = null;
    let curAyahNum: number | null = null;

    // --- Step 3.5: detect opening muqatta'at (disjointed letters) ---
    const muqattaatHit = detectMuqattaat(wordStream, p);
    if (muqattaatHit) {
      const letters = MUQATTAAT_BY_SURAH[muqattaatHit.surahNumber];
      const chunk = wordStream.slice(p, p + muqattaatHit.consumedCount);
      const surahMeta = surahsList.find((s) => s.number === muqattaatHit.surahNumber);

      results.push({
        surah: muqattaatHit.surahNumber,
        surahName: surahMeta?.name ?? null,
        surahEnglishName: surahMeta?.englishName ?? null,
        ayahNumber: 1,
        isMuqattaat: true,
        arabic: letters.display ?? letters.fused,
        translation: '', 
        isFullAyah: true,
        startTime: Number(chunk[0].start.toFixed(2)),
        endTime: Number(chunk[chunk.length - 1].end.toFixed(2)),
        words: chunk.map((w) => ({
          word: w.word,
          start: Number(w.start.toFixed(2)),
          end: Number(w.end.toFixed(2)),
        })),
      });

      p += muqattaatHit.consumedCount;
      curSurahNum = muqattaatHit.surahNumber;
      curAyahNum = letters.nextAyah;
    }

    // --- Step 4: find the anchor ayah ---
    if (curSurahNum === null) {
      const initialChunk = wordStream.slice(p, p + 12).map((w) => w.word).join(' ');
      const anchor = searchCandidates(initialChunk, allCandidates, 0.3);

      if (!anchor) {
        if (p < wordStream.length) {
          const rest = wordStream.slice(p);
          results.push({
            surah: null, surahName: null, surahEnglishName: null, ayahNumber: null,
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

      curSurahNum = anchor.surah.number;
      curAyahNum = anchor.ayahNumber;
    }

    let safety = 0;

    // --- Step 5: walk forward ayah-by-ayah ---
    while (p < wordStream.length && safety < wordStream.length * 3) {
      safety++;

      const surah = surahsList.find((s) => s.number === curSurahNum);
      if (!surah) break;

      const ayah = surah.ayahs.find((a: any) => a.numberInSurah === curAyahNum);
      if (!ayah) {
        const nextSurah = surahsList.find((s) => s.number === (curSurahNum as number) + 1);
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
        if (score > bestScore) { bestScore = score; bestWindow = w; }
      }

      if (bestWindow !== null) {
        const consumed = wordStream.slice(p, p + bestWindow);
        const isConfidentMatch = bestScore >= 0.45;

        results.push({
          surah: surah.number,
          surahName: surah.name,
          surahEnglishName: surah.englishName,
          ayahNumber: isConfidentMatch ? curAyahNum : null,
          arabic: isConfidentMatch ? ayahClean : consumed.map((w) => w.word).join(' '),
          translation: isConfidentMatch ? getTranslation(surah.number, curAyahNum as number) : '',
          isFullAyah: isConfidentMatch,
          startTime: Number(consumed[0].start.toFixed(2)),
          endTime: Number(consumed[consumed.length - 1].end.toFixed(2)),
          words: consumed.map((w) => ({
            word: w.word,
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2)),
          })),
        });

        p += bestWindow;
        curAyahNum = (curAyahNum as number) + 1;
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
            surah: null, surahName: null, surahEnglishName: null, ayahNumber: null,
            arabic: w.word, translation: '', isFullAyah: false,
            startTime: Number(w.start.toFixed(2)),
            endTime: Number(w.end.toFixed(2)),
            words: [{ word: w.word, start: Number(w.start.toFixed(2)), end: Number(w.end.toFixed(2)) }],
          });
        }

        p += 1;
      }
    }

    return NextResponse.json({ ayahs: buildFinalAyahs(results, videoDuration) });

  } catch (error: any) {
    console.error('[match] Error:', error);
    return NextResponse.json({ error: error?.message || 'Matching failed' }, { status: 500 });
  }
}