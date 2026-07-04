'use client';

interface Props {
  onSelectUpload: () => void;
  onSelectRecord: () => void;
  onSelectCreate: () => void;
}

export default function LandingHero({ onSelectUpload, onSelectRecord, onSelectCreate }: Props) {
  return (
    <section className="px-4 sm:px-6 py-14 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-emerald-950">
          Turn Quran Recitations Into Video Clips
        </h1>
        <p className="text-zinc-600 text-base max-w-2xl mx-auto">
          Upload a recitation video, record your own voice, or pick a reciter and verse — AyahClip
          matches the ayahs and adds timestamped captions automatically.
        </p>
      </div>

      <div id="options" className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
        <button
          onClick={onSelectUpload}
          className="text-left border border-emerald-800 rounded-md p-5 hover:bg-emerald-50 transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-semibold text-emerald-900">Upload & Edit Video</p>
          </div>
          <p className="text-sm text-zinc-500">Upload a recitation video. Ayahs are detected automatically.</p>
        </button>

        <button
          onClick={onSelectRecord}
          className="text-left border border-emerald-800 rounded-md p-5 hover:bg-emerald-50 transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm font-semibold text-emerald-900">Record Your Voice</p>
          </div>
          <p className="text-sm text-zinc-500">Record recitation directly in-browser and auto-detect ayahs.</p>
        </button>

        <button
          onClick={onSelectCreate}
          className="text-left border border-emerald-800 rounded-md p-5 hover:bg-emerald-50 transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm font-semibold text-emerald-900">Create From Verse</p>
          </div>
          <p className="text-sm text-zinc-500">Pick a reciter and Surah/ayah range, no upload required.</p>
        </button>
      </div>
    </section>
  );
}