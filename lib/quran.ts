// lib/quran.ts
// Uses api.alquran.cloud - completely free, no key needed

export interface Ayah {
  number: number;
  numberInSurah: number;
  surah: number;
  surahName: string;
  surahEnglishName: string;
  arabic: string;
  translation: string;
  juz: number;
}

export interface MatchedAyah extends Ayah {
  startTime: number; // seconds
  endTime: number;   // seconds
  confidence: number;
}

// Normalize Arabic text for comparison - remove diacritics
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/\u0622|\u0623|\u0625/g, '\u0627') // normalize alef
    .replace(/\u0649/g, '\u064A') // normalize ya
    .replace(/\u0629/g, '\u0647') // normalize ta marbuta
    .replace(/\s+/g, ' ')
    .trim();
}

// Search Quran for matching ayah by Arabic text fragment with robust fallbacks
export async function searchQuranByText(query: string): Promise<Ayah[]> {
  const trySearch = async (q: string) => {
    const normalized = normalizeArabic(q);
    if (normalized.length < 4) return [];
    const encoded = encodeURIComponent(normalized);
    try {
      const res = await fetch(
        `https://api.alquran.cloud/v1/search/${encoded}/all/quran-simple-clean`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.status === 'OK' && data.data && data.data.matches) {
        return data.data.matches;
      }
    } catch (e) {
      console.warn('AlQuran Cloud Search partial failed:', e);
    }
    return [];
  };

  try {
    const words = query.trim().split(/\s+/);
    if (words.length === 0 || (words.length === 1 && words[0] === '')) return [];

    // Try first 5 words
    let matches = await trySearch(words.slice(0, 5).join(' '));
    if (matches && matches.length > 0) return mapMatches(matches);

    // Fallback: try first 3 words
    if (words.length > 3) {
      matches = await trySearch(words.slice(0, 3).join(' '));
      if (matches && matches.length > 0) return mapMatches(matches);
    }

    // Fallback: try middle 4 words
    if (words.length > 4) {
      matches = await trySearch(words.slice(1, 5).join(' '));
      if (matches && matches.length > 0) return mapMatches(matches);
    }

    // Fallback: try the raw query slice
    matches = await trySearch(query.slice(0, 40));
    if (matches && matches.length > 0) return mapMatches(matches);

    return [];
  } catch (error) {
    console.error('searchQuranByText error:', error);
    return [];
  }
}

function mapMatches(matches: any[]): Ayah[] {
  return matches.slice(0, 5).map((m: any) => ({
    number: m.number,
    numberInSurah: m.numberInSurah,
    surah: m.surah.number,
    surahName: m.surah.name,
    surahEnglishName: m.surah.englishName,
    arabic: m.text,
    translation: '',
    juz: m.juz,
  }));
}

// Get full ayah with translation
export async function getAyahWithTranslation(
  surah: number,
  ayah: number,
  edition = 'en.sahih'
): Promise<{ arabic: string; translation: string } | null> {
  try {
    const res = await fetch(
      `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,${edition}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return {
      arabic: data.data[0].text,
      translation: data.data[1].text,
    };
  } catch {
    return null;
  }
}

// Get surah info
export async function getSurahInfo(surahNumber: number) {
  try {
    const res = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return {
      number: data.data.number,
      name: data.data.name,
      englishName: data.data.englishName,
      numberOfAyahs: data.data.numberOfAyahs,
    };
  } catch {
    return null;
  }
}
