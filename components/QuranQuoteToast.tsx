'use client';

import { useEffect, useRef, useState } from 'react';

interface AyahData {
  text: string;
  translation: string;
  surahEnglishName: string;
  numberInSurah: number;
}

interface ActiveQuote {
  id: string;
  ayah: AyahData;
  cornerId: string;
  classes: string;
}

interface Props {
  enabled: boolean;
}

const CORNERS = [
  { id: 'top-left', classes: 'top-4 left-4' },
  { id: 'top-right', classes: 'top-4 right-4' },
  { id: 'bottom-left', classes: 'bottom-4 left-4' },
  { id: 'bottom-right', classes: 'bottom-4 right-4' }
];

const DISPLAY_MS = 12000; // Stay on screen for 12 seconds
const DELAYS_MS = [20000, 120000, 180000]; // 20 seconds, 2 minutes, 3 minutes

const BEAUTIFUL_AYAH_ARRAY: AyahData[] = [
  {
    text: "مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ",
    translation: "Your Lord has not taken leave of you, nor has He detested you.",
    surahEnglishName: "Ad-Duha",
    numberInSurah: 3,
  },
  {
    text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا • إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.",
    surahEnglishName: "Ash-Sharh",
    numberInSurah: 5,
  },
  {
    text: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ",
    translation: "And when My servants ask you concerning Me - indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.",
    surahEnglishName: "Al-Baqarah",
    numberInSurah: 186,
  },
  {
    text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    translation: "Allah does not charge a soul except [with that within] its capacity.",
    surahEnglishName: "Al-Baqarah",
    numberInSurah: 286,
  },
  {
    text: "لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا",
    translation: "Do not despair of the mercy of Allah. Indeed, Allah forgives all sins.",
    surahEnglishName: "Az-Zumar",
    numberInSurah: 53,
  },
  {
    text: "وَاللَّهُ خَيْرُ الْمَاكِرِينَ",
    translation: "And Allah is the best of planners.",
    surahEnglishName: "Al-Anfal",
    numberInSurah: 30,
  },
  {
    text: "لَا تَخَافَا ۖ إِنَّنِي مَعَكُمَا أَسْمَعُ وَأَرَىٰ",
    translation: "Fear not. Indeed, I am with you; I hear and I see.",
    surahEnglishName: "Taha",
    numberInSurah: 46,
  },
  {
    text: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ",
    translation: "And He is with you wherever you are.",
    surahEnglishName: "Al-Hadid",
    numberInSurah: 4,
  },
  {
    text: "وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ",
    translation: "And your Lord says, 'Call upon Me; I will respond to you.'",
    surahEnglishName: "Ghafir",
    numberInSurah: 60,
  },
  {
    text: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    translation: "Unquestionably, by the remembrance of Allah hearts are assured.",
    surahEnglishName: "Ar-Ra'd",
    numberInSurah: 28,
  }
];

export default function QuranQuoteToast({ enabled }: Props) {
  const [activeQuotes, setActiveQuotes] = useState<ActiveQuote[]>([]);
  const activeQuotesRef = useRef<ActiveQuote[]>([]);
  activeQuotesRef.current = activeQuotes;

  const getNextAyah = (): AyahData => {
    // Filter out ayahs that are already displayed to avoid duplicates
    const activeTexts = activeQuotesRef.current.map(q => q.ayah.text);
    const availableAyahs = BEAUTIFUL_AYAH_ARRAY.filter(a => !activeTexts.includes(a.text));
    
    const pool = availableAyahs.length > 0 ? availableAyahs : BEAUTIFUL_AYAH_ARRAY;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const spawnQuote = () => {
    if (activeQuotesRef.current.length >= 3) {
      // Remove oldest quote to make space
      const oldest = activeQuotesRef.current[0];
      removeQuote(oldest.id);
    }

    const ayahData = getNextAyah();

    // Find occupied corners
    const occupiedCornerIds = activeQuotesRef.current.map(q => q.cornerId);
    // Find free corners
    const freeCorners = CORNERS.filter(c => !occupiedCornerIds.includes(c.id));
    
    if (freeCorners.length === 0) return;

    // Randomly pick a free corner
    const selectedCorner = freeCorners[Math.floor(Math.random() * freeCorners.length)];
    const quoteId = Math.random().toString(36).substring(2, 9);

    const newQuote: ActiveQuote = {
      id: quoteId,
      ayah: ayahData,
      cornerId: selectedCorner.id,
      classes: selectedCorner.classes
    };

    setActiveQuotes(prev => [...prev, newQuote]);

    // Schedule auto-removal
    setTimeout(() => {
      removeQuote(quoteId);
    }, DISPLAY_MS);
  };

  const removeQuote = (id: string) => {
    setActiveQuotes(prev => prev.filter(q => q.id !== id));
  };

  useEffect(() => {
    if (!enabled) {
      setActiveQuotes([]);
      return;
    }

    // Spawn first quote immediately
    spawnQuote();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let delayIndex = 0;

    const scheduleNext = () => {
      const currentDelay = delayIndex < DELAYS_MS.length 
        ? DELAYS_MS[delayIndex] 
        : DELAYS_MS[DELAYS_MS.length - 1];
      
      if (delayIndex < DELAYS_MS.length) {
        delayIndex++;
      }

      timeoutId = setTimeout(() => {
        spawnQuote();
        scheduleNext();
      }, currentDelay);
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled || activeQuotes.length === 0) return null;

  return (
    <>
      {activeQuotes.map(quote => (
        <div
          key={quote.id}
          className={`fixed z-[60] ${quote.classes} w-[320px] sm:w-[380px] md:w-[440px] bg-white/95 border border-emerald-800/10 rounded-xl shadow-lg shadow-emerald-950/5 p-3 pr-7 flex items-center justify-between gap-3 animate-scale-up hover:shadow-emerald-950/10 transition-all`}
        >
          {/* Main Horizontal Box */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {/* Left Column: Translation & Citation */}
            <div className="flex-1 min-w-0">
            <p className="text-zinc-600 text-[11px] sm:text-xs italic leading-snug break-words">
                "{quote.ayah.translation}"
              </p>
              <p className="text-emerald-700 text-[9px] sm:text-[10px] font-semibold mt-0.5 whitespace-nowrap">
                — {quote.ayah.surahEnglishName} {quote.ayah.numberInSurah}
              </p>
            </div>
            
            {/* Elegant Divider */}
            <div className="h-8 w-px bg-emerald-800/10 flex-shrink-0" />
            
            {/* Right Column: Arabic Script */}
            <div className="flex-1 text-right min-w-0" dir="rtl">
            <p className="text-emerald-950 text-xs sm:text-sm font-medium leading-relaxed break-words">
                {quote.ayah.text}
              </p>
            </div>
          </div>

          {/* Absolute Position Close Button */}
          <button
            onClick={() => removeQuote(quote.id)}
            className="absolute top-1.5 right-1.5 text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </>
  );
}
