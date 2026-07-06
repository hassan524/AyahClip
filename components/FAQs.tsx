'use client';

const FAQ_ITEMS = [
  {
    question: 'What is AyahClip?',
    answer:
      'AyahClip helps you create Quran recitation videos with timestamped Uthmani Arabic and English translation. Upload a file, record your voice, or pick a verse and reciter — then style and export.',
  },
  {
    question: 'Can I upload audio or video?',
    answer:
      'Yes. Upload a recitation video or audio file. AyahClip extracts the audio, transcribes it, and matches each ayah automatically.',
  },
  {
    question: 'Can I record my own recitation?',
    answer:
      'Yes. Use Record Voice in the browser. Speak clearly with good tajweed in a quiet room for the best matching results.',
  },
  {
    question: 'What is Create From Verse?',
    answer:
      'Pick a reciter, surah, and ayah range. AyahClip fetches official recitation audio and verified Arabic text — no upload needed.',
  },
  {
    question: 'Is AyahClip free?',
    answer:
      'Yes. AyahClip is free to use for the Quran community. Rendering happens in your browser.',
  },
];

export default function FAQs() {
  return (
    <section id="faqs" className="py-14 px-4 sm:px-6 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-emerald-950 mb-2">Frequently Asked Questions</h2>
          <p className="text-sm text-zinc-500">Quick answers about the three ways to create a clip.</p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="border border-zinc-200 rounded-md p-4 bg-zinc-50/30">
              <p className="font-semibold text-emerald-950 text-sm mb-1.5">{item.question}</p>
              <p className="text-zinc-600 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
