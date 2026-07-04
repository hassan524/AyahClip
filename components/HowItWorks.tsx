'use client';

const STEPS = [
  {
    num: '1',
    title: 'Upload Recitation',
    description: 'Select an audio or video file of Quran recitation.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    num: '2',
    title: 'Automatic Matching',
    description: 'Speech is transcribed and matched to the Uthmani script and translation.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    num: '3',
    title: 'Adjust & Style',
    description: 'Fix timestamps if needed, choose fonts, colors, and background.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    num: '4',
    title: 'Export',
    description: 'Render and download an MP4, ready to share.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 10l5 5 5-5M12 15V3" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 px-4 sm:px-6 bg-zinc-50 border-b border-zinc-200">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xl font-bold text-emerald-950 mb-2">How It Works</h2>
          <p className="text-sm text-zinc-500">Four steps from raw recitation to finished clip.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, idx) => (
            <div
              key={step.num}
              className="relative bg-white border border-zinc-200 rounded-md p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex-shrink-0 w-9 h-9 rounded-md bg-emerald-900 text-white flex items-center justify-center">
                  {step.icon}
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  Step {step.num}
                </span>
              </div>
              <p className="font-semibold text-emerald-950 text-sm mb-1">{step.title}</p>
              <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>

              {idx < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2.5 w-5 h-px bg-zinc-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}