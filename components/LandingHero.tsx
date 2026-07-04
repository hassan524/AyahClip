'use client';

interface Props {
  onSelectUpload: () => void;
}

export default function LandingHero({ onSelectUpload }: Props) {
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
          className="text-left border border-emerald-800 rounded-md p-5 hover:bg-emerald-50 transition-colors"
        >
          <p className="text-sm font-semibold text-emerald-900 mb-1">Upload & Edit Video</p>
          <p className="text-sm text-zinc-500">Upload a recitation video. Ayahs are detected automatically.</p>
        </button>

        <div className="text-left border border-zinc-200 rounded-md p-5 opacity-60 cursor-not-allowed">
          <p className="text-sm font-semibold text-zinc-700 mb-1">Record Your Voice</p>
          <p className="text-sm text-zinc-500">Record recitation directly in-browser and auto-detect ayahs.</p>
          <p className="text-xs text-zinc-400 mt-2">Coming soon</p>
        </div>

        <div className="text-left border border-zinc-200 rounded-md p-5 opacity-60 cursor-not-allowed">
          <p className="text-sm font-semibold text-zinc-700 mb-1">Create From Verse</p>
          <p className="text-sm text-zinc-500">Pick a reciter and Surah/ayah range, no upload required.</p>
          <p className="text-xs text-zinc-400 mt-2">Coming soon</p>
        </div>
      </div>
    </section>
  );
}