'use client';

import { useState, useEffect } from 'react';

interface AyahData {
  text: string;
  translation: string;
  surahName: string;
  surahEnglishName: string;
  numberInSurah: number;
}

export default function QuranQuoteWidget() {
  const [ayah, setAyah] = useState<AyahData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [animating, setAnimating] = useState(false);

  const fetchRandomAyah = async () => {
    setLoading(true);
    setError(false);
    setAnimating(true);
    try {
      const res = await fetch(
        'https://api.alquran.cloud/v1/ayah/random/editions/quran-simple,en.sahih',
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.code === 200 && Array.isArray(data.data) && data.data.length >= 2) {
        const arabic = data.data[0];
        const english = data.data[1];
        setAyah({
          text: arabic.text,
          translation: english.text,
          surahName: arabic.surah?.name || '',
          surahEnglishName: arabic.surah?.englishName || '',
          numberInSurah: arabic.numberInSurah || 1,
        });
      } else {
        throw new Error('Malformed response');
      }
    } catch (err) {
      console.error('Error fetching random ayah:', err);
      setError(true);
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 500);
    }
  };

  useEffect(() => {
    fetchRandomAyah();
  }, []);

  const handleCopy = () => {
    if (!ayah) return;
    const textToCopy = `"${ayah.text}"\n\nTranslation: "${ayah.translation}"\n\n— Quran [${ayah.surahEnglishName} ${ayah.surahName} - ${ayah.numberInSurah}]`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="random-quote" className="w-full bg-white border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-500/5 hover:shadow-emerald-500/10 transition-all flex flex-col justify-between min-h-[360px] relative overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full blur-2xl -z-10" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-50/50 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-emerald-800 tracking-wide uppercase">Ayah of the Moment</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={loading || error}
            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
            title="Copy Quote"
          >
            {copied ? (
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
          <button
            onClick={fetchRandomAyah}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
            title="Next Quote"
          >
            <svg className={`w-5 h-5 ${animating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.75L21 9M9 9h9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 bg-zinc-100 rounded-lg animate-pulse w-3/4 mx-auto" />
            <div className="h-4 bg-zinc-100 rounded-lg animate-pulse w-full" />
            <div className="h-4 bg-zinc-100 rounded-lg animate-pulse w-5/6 mx-auto" />
          </div>
        ) : error ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-zinc-500 text-sm">Failed to retrieve quote from the database.</p>
            <button
              onClick={fetchRandomAyah}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : ayah ? (
          <div className="space-y-6 text-center">
            {/* Arabic Script */}
            <p className="text-emerald-950 text-2xl sm:text-3xl font-normal leading-loose tracking-wide font-serif" dir="rtl">
              {ayah.text}
            </p>
            {/* English Translation */}
            <p className="text-zinc-600 text-sm sm:text-base italic leading-relaxed max-w-xl mx-auto px-2">
              "{ayah.translation}"
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer / Reference */}
      {!loading && !error && ayah && (
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-medium text-emerald-800">
          <span>Surah {ayah.surahEnglishName}</span>
          <span className="font-serif">{ayah.surahName} : {ayah.numberInSurah}</span>
        </div>
      )}
    </div>
  );
}
