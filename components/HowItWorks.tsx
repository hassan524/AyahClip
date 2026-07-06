'use client';

const START_OPTIONS = [
  {
    id: 'upload',
    title: 'Upload Video or Audio',
    description:
      'Upload a recitation file from your device. AyahClip transcribes the audio and matches each ayah to verified Uthmani Arabic and English translation.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    id: 'record',
    title: 'Record Your Voice',
    description:
      'Record your recitation in the browser. Speak clearly with good tajweed — AyahClip detects ayahs from your voice the same way as an upload.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: 'create',
    title: 'Create From Verse',
    description:
      'Choose a reciter, surah, and ayah range. AyahClip fetches the official audio and text — no upload or recording needed.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const SHARED_STEPS = [
  {
    num: '2',
    title: 'Automatic Matching',
    description: 'Speech is matched to the Quran database with Arabic script and translation on a timeline.',
  },
  {
    num: '3',
    title: 'Review & Style',
    description: 'Check Arabic and translation below the preview, adjust timing, fonts, colors, and backgrounds.',
  },
  {
    num: '4',
    title: 'Export',
    description: 'Render and download an MP4 ready to share on social media.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 px-4 sm:px-6 bg-zinc-50 border-b border-zinc-200">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-emerald-950 mb-2">How It Works</h2>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            Three ways to start. After that, review ayahs, style your clip, and export.
          </p>
        </div>

        {/* Step 1 — three entry points */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3 text-center">
            Step 1 — Choose how to start
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {START_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                className="bg-white border border-zinc-200 rounded-md p-4"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-8 h-8 rounded-md bg-emerald-900 text-white flex items-center justify-center flex-shrink-0">
                    {opt.icon}
                  </span>
                  <p className="font-semibold text-emerald-950 text-xs sm:text-sm">{opt.title}</p>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">{opt.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Steps 2–4 — same for every path */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SHARED_STEPS.map((step) => (
            <div key={step.num} className="bg-white border border-zinc-200 rounded-md p-4">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Step {step.num}</p>
              <p className="font-semibold text-emerald-950 text-sm mb-1">{step.title}</p>
              <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
