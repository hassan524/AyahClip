import { NextRequest, NextResponse } from 'next/server';
import { findReciter } from '@/lib/reciters';

export const dynamic = 'force-dynamic';

function pad3(n: number) {
  return String(n).padStart(3, '0');
}

// alquran.cloud's `quran-uthmani` edition bundles the Bismillah into ayah 1's
// text for every surah EXCEPT Al-Fatihah (surah 1, where Bismillah IS ayah 1)
// and At-Tawbah (surah 9, which has no Bismillah at all). Strip it so ayah 1
// displays as just the verse, matching every other ayah's format.
// Matches ALL Quranic diacritics/annotation marks, regardless of exact combo
const DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08FF]/;

function normalizeAlef(ch: string): string {
  return ch === 'إ' || ch === 'أ' || ch === 'آ' || ch === 'ٱ' ? 'ا' : ch;
}

const BISMILLAH_BASE = 'بسم الله الرحمن الرحيم';

function stripBismillah(text: string, surahNumber: number, ayahNumber: number): string {
  if (ayahNumber !== 1 || surahNumber === 9) return text;

  // Build a diacritic-free, alef-normalized "base" version of the text,
  // tracking which ORIGINAL index each base char came from.
  let base = '';
  const origIndexForBaseChar: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (DIACRITICS_REGEX.test(ch)) continue;
    base += normalizeAlef(ch);
    origIndexForBaseChar.push(i);
  }

  // Doesn't actually start with Bismillah -> leave it alone.
  if (!base.startsWith(BISMILLAH_BASE)) return text;

  let baseCharsConsumed = BISMILLAH_BASE.length;
  if (base[baseCharsConsumed] === ' ') baseCharsConsumed++;

  // Whole ayah IS just the Bismillah (e.g. Al-Fatihah 1:1) — nothing left.
  if (baseCharsConsumed >= origIndexForBaseChar.length) return '';

  const cutoffOrigIndex = origIndexForBaseChar[baseCharsConsumed];
  return text.slice(cutoffOrigIndex).trim();
}


async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // reciterId is now a stable key from lib/reciters.ts (e.g. "dosari",
    // "alafasy") — NOT a free-text name. This is what actually fixes the
    // matching bug: there is nothing left to fuzzy-match.
    const reciterId = searchParams.get('reciterId') || '';
    const surahNumber = Number(searchParams.get('surahNumber'));
    const fromAyah = Number(searchParams.get('fromAyah') || '1');
    const toAyah = Number(searchParams.get('toAyah') || '1');

    if (!reciterId || !surahNumber) {
      return NextResponse.json({ error: 'Missing reciterId or surahNumber' }, { status: 400 });
    }

    const reciter = findReciter(reciterId);
    if (!reciter) {
      return NextResponse.json(
        { error: `Unknown reciterId "${reciterId}". Add it to lib/reciters.ts first.` },
        { status: 404 },
      );
    }

    // 1. Always pull Arabic text + English translation from alquran.cloud,
    //    independent of which reciter/audio source we're using. This is
    //    the piece that guarantees translations keep working no matter
    //    where the audio comes from.
    const textRes = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,en.sahih`,
      { cache: 'no-store' },
    );
    if (!textRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch surah text from Quran API' }, { status: 502 });
    }
    const textJson = await textRes.json();
    const textData = textJson?.data;
    if (!Array.isArray(textData) || textData.length < 2) {
      return NextResponse.json({ error: 'Unexpected response shape from Quran API' }, { status: 502 });
    }
    const allArabic: any[] = textData[0]?.ayahs || [];
    const allTranslations: any[] = textData[1]?.ayahs || [];

    const from = Math.max(1, fromAyah);
    const to = Math.min(allArabic.length, toAyah);
    if (from > to || allArabic.length === 0) {
      return NextResponse.json({ error: 'Invalid ayah range for this surah' }, { status: 400 });
    }

    const arabicSlice = allArabic.slice(from - 1, to);
    const translationSlice = allTranslations.slice(from - 1, to);

    // 2. Build per-ayah audio URLs from whichever source this reciter uses.
    //
    //    IMPORTANT: for a SINGLE edition, use the singular endpoint
    //    /v1/surah/{n}/{edition} — its `data` is an OBJECT with `.ayahs`.
    //    The plural /v1/surah/{n}/editions/{a},{b} endpoint (used above
    //    for text+translation) always returns `data` as an ARRAY, one
    //    entry per edition requested — using it here with `data.ayahs`
    //    silently returns undefined -> [] -> every ayah gets null audio,
    //    which is exactly the "Missing audio" bug this fixes.
    let audioEdition: any[] | null = null;
    if (reciter.source === 'alquran') {
      const audioRes = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahNumber}/${reciter.sourceId}`,
        { cache: 'no-store' },
      );
      if (!audioRes.ok) {
        return NextResponse.json({ error: `Failed to fetch audio edition "${reciter.sourceId}"` }, { status: 502 });
      }
      const audioJson = await audioRes.json();
      audioEdition = audioJson?.data?.ayahs || [];

      if (audioEdition?.length === 0) {
        return NextResponse.json(
          { error: `Audio edition "${reciter.sourceId}" returned no ayahs — check the identifier in lib/reciters.ts` },
          { status: 502 },
        );
      }
    }

    const result = await Promise.all(
      arabicSlice.map(async (ayah: any, i: number) => {
        let audioUrl: string | null = null;

        if (reciter.source === 'alquran' && audioEdition) {
          const match = audioEdition[from - 1 + i];
          audioUrl = match?.audio || match?.audioSecondary?.[0] || null;
        } else if (reciter.source === 'everyayah') {
          const candidate = `https://everyayah.com/data/${reciter.sourceId}/${pad3(surahNumber)}${pad3(ayah.numberInSurah)}.mp3`;
          audioUrl = (await urlExists(candidate)) ? candidate : null;
        }

        return {
          ayahNumber: ayah.numberInSurah,
          arabic: stripBismillah(ayah.text || '', surahNumber, ayah.numberInSurah),
          translation: translationSlice[i]?.text || '',
          audioUrl,
        };
      }),
    );

    const missingAudio = result.filter((r) => !r.audioUrl).length;

    return NextResponse.json({
      reciterId: reciter.id,
      reciterName: reciter.name,
      ayahs: result,
      // Surfaces a warning instead of silently failing if a folder name
      // in lib/reciters.ts turns out to be wrong for some ayahs.
      warning: missingAudio > 0 ? `${missingAudio} ayah(s) had no audio available for this reciter.` : null,
    });
  } catch (err: any) {
    console.error('quran-surah route error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}