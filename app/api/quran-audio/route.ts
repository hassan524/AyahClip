import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Only allow proxying from known Quran audio CDN hosts, to avoid this
// route being abused as an open proxy. everyayah.com is required here
// because the extended reciter set in lib/reciters.ts (Yasser Al-Dosari,
// Saad Al-Ghamdi, Nasser Al Qatami, etc.) serves audio from there.
const ALLOWED_HOSTS = ['cdn.islamic.network', 'cdn.alquran.cloud', 'everyayah.com'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json({ error: 'URL host not allowed' }, { status: 400 });
    }

    const audioRes = await fetch(parsed.toString(), { cache: 'no-store' });
    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio from CDN' }, { status: 502 });
    }

    const arrayBuffer = await audioRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': audioRes.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('quran-audio route error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}