'use client';

interface Props {
  onSelectUpload: () => void;
  onSelectRecord: () => void;
  onSelectCreate: () => void;
}

export default function LandingHero({ onSelectUpload, onSelectRecord, onSelectCreate }: Props) {
  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">
          Free Quran recitation video maker
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-950 leading-tight">
          Turn Quran Recitations Into Video Clips
        </h1>
        <p className="text-zinc-600 text-sm sm:text-base mt-3 leading-relaxed">
          Upload a file, record your voice, or pick a verse and reciter. AyahClip adds
          timestamped Arabic text and English translation automatically.
        </p>
      </div>

      <div id="options" className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        <button
          type="button"
          onClick={onSelectUpload}
          className="text-left border border-zinc-200 rounded-md p-4 bg-white hover:border-emerald-700 hover:bg-emerald-50/40 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-md bg-emerald-900 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-emerald-950">Upload</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">Video or audio file from your device.</p>
        </button>

        <button
          type="button"
          onClick={onSelectRecord}
          className="text-left border border-zinc-200 rounded-md p-4 bg-white hover:border-emerald-700 hover:bg-emerald-50/40 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-md bg-emerald-900 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-emerald-950">Record Voice</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">Recite in the browser with your microphone.</p>
        </button>

        <button
          type="button"
          onClick={onSelectCreate}
          className="text-left border border-zinc-200 rounded-md p-4 bg-white hover:border-emerald-700 hover:bg-emerald-50/40 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-md bg-emerald-900 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-emerald-950">From Verse</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">Pick reciter, surah, and ayah range.</p>
        </button>
      </div>
    </section>
  );
}
