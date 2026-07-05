import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reciterName = searchParams.get('reciterName') || '';
    const surahNumber = searchParams.get('surahNumber');
    const fromAyah = Number(searchParams.get('fromAyah') || '1');
    const toAyah = Number(searchParams.get('toAyah') || '1');

    if (!reciterName || !surahNumber) {
      return NextResponse.json({ error: 'Missing reciterName or surahNumber' }, { status: 400 });
    }

    // 1. Find the reciter's audio edition identifier (server-side, no CORS issue here)
    const editionsRes = await fetch('https://api.alquran.cloud/v1/edition?format=audio&language=ar', {
      cache: 'no-store',
    });
    if (!editionsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch reciter list from Quran API' }, { status: 502 });
    }
    const editionsJson = await editionsRes.json();
    const editions: any[] = editionsJson?.data || [];

    const target = normalize(reciterName);
    let bestEdition = editions.find(
      (e) => normalize(e.englishName || '') === target || normalize(e.name || '') === target
    );

    if (!bestEdition) {
      const words = reciterName.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      const scored = editions
        .map((e) => ({
          e,
          score: words.filter((w: string) => (e.englishName || '').toLowerCase().includes(w)).length,
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      bestEdition = scored[0]?.e;
    }

    if (!bestEdition) {
      return NextResponse.json(
        { error: `Could not find an audio edition for "${reciterName}". Try a different reciter.` },
        { status: 404 }
      );
    }

    const editionId = bestEdition.identifier;

    // 2. Fetch the surah in that reciter's edition + English translation, in one call
    const surahRes = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/${editionId},en.sahih`,
      { cache: 'no-store' }
    );
    if (!surahRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch surah data from Quran API' }, { status: 502 });
    }
    const surahJson = await surahRes.json();
    const surahData = surahJson?.data;

    if (!Array.isArray(surahData) || surahData.length < 2) {
      return NextResponse.json({ error: 'Unexpected response shape from Quran API' }, { status: 502 });
    }

    const allAyahs: any[] = surahData[0]?.ayahs || [];
    const allTranslations: any[] = surahData[1]?.ayahs || [];

    const from = Math.max(1, fromAyah);
    const to = Math.min(allAyahs.length, toAyah);

    if (from > to || allAyahs.length === 0) {
      return NextResponse.json({ error: 'Invalid ayah range for this surah' }, { status: 400 });
    }

    const selectedAyahs = allAyahs.slice(from - 1, to);
    const selectedTranslations = allTranslations.slice(from - 1, to);

    const result = selectedAyahs.map((ayah: any, i: number) => ({
      ayahNumber: ayah.numberInSurah,
      arabic: ayah.text || '',
      translation: selectedTranslations[i]?.text || '',
      // Audio URL stays pointed at the CDN — the client will fetch it through
      // the /api/quran-audio proxy below instead of hitting it directly.
      audioUrl: ayah.audio || ayah.audioSecondary?.[0] || null,
    }));

    return NextResponse.json({ editionId, ayahs: result });
  } catch (err: any) {
    console.error('quran-surah route error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}