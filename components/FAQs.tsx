'use client';

import { useState } from 'react';

const FAQ_ITEMS = [
  {
    question: "What is AyahClip?",
    answer: "AyahClip is a web application designed to help you create beautiful, high-quality videos of Quranic recitations. It automatically detects and transcribes audio to align it with Uthmani Arabic script and English translations, allowing you to customize backgrounds, fonts, and layout before exporting."
  },
  {
    question: "How does the automatic matching work?",
    answer: "When you upload a recitation, our audio processing engine extracts the audio track and sends it to our speech-recognition models. The transcript is then mapped directly to the corresponding Surah and Ayah in our database to pull the precise Arabic script and Sahih International translation."
  },
  {
    question: "Can I use custom video backgrounds?",
    answer: "Yes! You can choose from various preset solid colors, modern gradients, or high-definition curated imagery. Additionally, you can upload your own custom video or image background to personalize the recitation clip."
  },
  {
    question: "Is AyahClip completely free to use?",
    answer: "Yes, AyahClip is a project created to serve the Quran community and is completely free. All processing and rendering is performed client-side or through our services without any subscriptions."
  }
];

export default function FAQs() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faqs" className="py-16 px-4 sm:px-6 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xl font-bold text-emerald-950 mb-2">Frequently Asked Questions</h2>
          <p className="text-sm text-zinc-500">Quick answers to common questions about AyahClip.</p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className="border border-zinc-200 rounded-xl overflow-hidden hover:border-emerald-200"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-emerald-950 text-sm sm:text-base bg-zinc-50/50 hover:bg-zinc-50 cursor-pointer"
                >
                  <span>{item.question}</span>
                  <svg 
                    className={`w-5 h-5 text-emerald-600 ${isOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-100 bg-white">
                    <p className="p-5 text-zinc-600 text-sm leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
