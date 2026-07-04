'use client';

import { useEffect, useRef, useState } from 'react';

interface AyahData {
  text: string;
  translation: string;
  surahEnglishName: string;
  numberInSurah: number;
}

interface Props {
  enabled: boolean;
}

// cycle: 1min, then 3min, then 2min, then repeats
const INTERVALS_MIN = [1, 3, 2];
const DISPLAY_MS = 9000;
const POSITIONS = ['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'];

export default function QuranQuoteToast({ enabled }: Props) {
  const [ayah, setAyah] = useState<AyahData | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState(POSITIONS[0]);
  const cycleIndexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAyah = async () => {
    try {
      const res = await fetch(
        'https://api.alquran.cloud/v1/ayah/random/editions/quran-simple,en.sahih',
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.code === 200 && Array.isArray(data.data) && data.data.length >= 2) {
        const arabic = data.data[0];
        const english = data.data[1];
        setAyah({
          text: arabic.text,
          translation: english.text,
          surahEnglishName: arabic.surah?.englishName || '',
          numberInSurah: arabic.numberInSurah || 1,
        });
      }
    } catch (err) {
      console.error('Failed to fetch ayah for toast:', err);
    }
  };

  const showToast = async () => {
    await fetchAyah();
    setPosition(POSITIONS[Math.floor(Math.random() * POSITIONS.length)]);
    setVisible(true);
    hideTimeoutRef.current = setTimeout(() => setVisible(false), DISPLAY_MS);
  };

  const scheduleNext = () => {
    const minutes = INTERVALS_MIN[cycleIndexRef.current % INTERVALS_MIN.length];
    cycleIndexRef.current += 1;
    timeoutRef.current = setTimeout(() => {
      showToast();
      scheduleNext();
    }, minutes * 60 * 1000);
  };

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    if (!enabled) {
      setVisible(false);
      return;
    }

    cycleIndexRef.current = 0;
    scheduleNext();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled || !visible || !ayah) return null;

  return (
    <div className={`fixed z-[60] ${position} w-72 bg-white border border-emerald-800 rounded-md shadow-lg p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-emerald-800">Qur'an</span>
        <button onClick={() => setVisible(false)} className="text-zinc-400 hover:text-zinc-700 text-xs">
          ✕
        </button>
      </div>
      <p dir="rtl" className="text-emerald-950 text-base leading-relaxed mb-2">{ayah.text}</p>
      <p className="text-zinc-600 text-xs leading-relaxed mb-2">"{ayah.translation}"</p>
      <p className="text-emerald-700 text-[11px] font-medium">— {ayah.surahEnglishName} {ayah.numberInSurah}</p>
    </div>
  );
}