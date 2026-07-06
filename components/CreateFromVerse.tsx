'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RECITERS, type Reciter } from "@/lib/reciters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  onGenerate: (config: {
    reciterId: string;
    reciterName: string;
    surahNumber: number;
    surahName: string;
    fromAyah: number;
    toAyah: number;
    backgroundColor: string;
  }) => void;
}

interface Surah {
  number: number;
  name: string;
  arabic: string;
  ayahCount: number;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const SURAH_NAMES = [
  'Al-Fatihah','Al-Baqarah','Ali \'Imran','An-Nisa','Al-Ma\'idah','Al-An\'am',
  'Al-A\'raf','Al-Anfal','At-Tawbah','Yunus','Hud','Yusuf','Ar-Ra\'d','Ibrahim',
  'Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha','Al-Anbiya','Al-Hajj',
  'Al-Mu\'minun','An-Nur','Al-Furqan','Ash-Shu\'ara','An-Naml','Al-Qasas',
  'Al-Ankabut','Ar-Rum','Luqman','As-Sajdah','Al-Ahzab','Saba','Fatir','Ya-Sin',
  'As-Saffat','Sad','Az-Zumar','Ghafir','Fussilat','Ash-Shura','Az-Zukhruf',
  'Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf',
  'Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman','Al-Waqi\'ah',
  'Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah','As-Saf','Al-Jumu\'ah',
  'Al-Munafiqun','At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam',
  'Al-Haqqah','Al-Ma\'arij','Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir',
  'Al-Qiyamah','Al-Insan','Al-Mursalat','An-Naba','An-Nazi\'at','Abasa',
  'At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq',
  'Al-A\'la','Al-Ghashiyah','Al-Fajr','Al-Balad','Ash-Shams','Al-Layl','Ad-Duha',
  'Ash-Sharh','At-Tin','Al-Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah',
  'Al-Adiyat','Al-Qari\'ah','At-Takathur','Al-Asr','Al-Humazah','Al-Fil',
  'Quraysh','Al-Ma\'un','Al-Kawthar','Al-Kafirun','An-Nasr','Al-Masad',
  'Al-Ikhlas','Al-Falaq','An-Nas',
];

const SURAH_ARABIC = [
  'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال',
  'التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف',
  'مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل',
  'القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس',
  'الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية',
  'الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر',
  'الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة',
  'المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج',
  'نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات',
  'عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى',
  'الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق',
  'القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة',
  'الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص',
  'الفلق','الناس',
];

const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

const SURAHS: Surah[] = SURAH_NAMES.map((name, i) => ({
  number: i + 1,
  name,
  arabic: SURAH_ARABIC[i],
  ayahCount: SURAH_AYAH_COUNTS[i],
}));

const BG_PRESETS = [
  { label: 'Black', value: '#000000' },
  { label: 'Dark Green', value: '#052e16' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreateFromVerse({ onGenerate }: Props) {
  const [reciterId, setReciterId] = useState<string>(RECITERS[0].id);
  const [surahNumber, setSurahNumber] = useState<number>(1);

  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);

  const [bgMode, setBgMode] = useState<'preset' | 'custom'>('preset');
  const [bgColor, setBgColor] = useState('#000000');
  const [customColor, setCustomColor] = useState('#1a1a2e');

  const reciter = useMemo(
    () => RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0],
    [reciterId],
  );
  const surah = useMemo(
    () => SURAHS.find((s) => s.number === surahNumber) ?? SURAHS[0],
    [surahNumber],
  );

  // Reset ayah range when surah changes
  useEffect(() => {
    setFromAyah(1);
    setToAyah(Math.min(7, surah.ayahCount));
  }, [surah]);

  /* ---------- validation ---------- */
  const ayahError = useMemo(() => {
    if (fromAyah < 1) return 'From Ayah must be at least 1';
    if (toAyah < fromAyah) return 'To Ayah must be ≥ From Ayah';
    if (fromAyah > surah.ayahCount || toAyah > surah.ayahCount) {
      return `Surah ${surah.name} only has ${surah.ayahCount} ayahs`;
    }
    return '';
  }, [fromAyah, toAyah, surah]);

  const activeBg = bgMode === 'custom' ? customColor : bgColor;

  const handleGenerate = useCallback(() => {
    if (ayahError) return;
    onGenerate({
      reciterId: reciter.id,
      reciterName: reciter.name,
      surahNumber: surah.number,
      surahName: surah.name,
      fromAyah,
      toAyah,
      backgroundColor: activeBg,
    });
  }, [reciter, surah, fromAyah, toAyah, activeBg, ayahError, onGenerate]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4 text-sm">
      {/* Reciter */}
      <section className="bg-white rounded-lg border border-zinc-200 p-4">
        <label className="block text-xs font-semibold text-emerald-950 mb-1.5">
          Reciter
        </label>
        <select
          value={reciterId}
          onChange={(e) => setReciterId(e.target.value)}
          className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-zinc-50 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </section>

      {/* Surah */}
      <section className="bg-white rounded-lg border border-zinc-200 p-4">
        <label className="block text-xs font-semibold text-emerald-950 mb-1.5">
          Surah
        </label>
        <select
          value={surahNumber}
          onChange={(e) => setSurahNumber(Number(e.target.value))}
          className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-zinc-50 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          {SURAHS.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name}
            </option>
          ))}
        </select>
      </section>

      {/* Ayah Range */}
      <section className="bg-white rounded-lg border border-zinc-200 p-4">
        <label className="block text-xs font-semibold text-emerald-950 mb-1.5">
          Ayah Range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[11px] text-zinc-500 mb-1">From</span>
            <input
              type="number"
              min={1}
              max={surah.ayahCount}
              value={fromAyah}
              onChange={(e) =>
                setFromAyah(Math.max(1, Math.min(surah.ayahCount, Number(e.target.value))))
              }
              className="w-full border border-zinc-200 rounded-md px-2.5 py-2 text-sm bg-zinc-50 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <span className="block text-[11px] text-zinc-500 mb-1">To</span>
            <input
              type="number"
              min={1}
              max={surah.ayahCount}
              value={toAyah}
              onChange={(e) =>
                setToAyah(Math.max(1, Math.min(surah.ayahCount, Number(e.target.value))))
              }
              className="w-full border border-zinc-200 rounded-md px-2.5 py-2 text-sm bg-zinc-50 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        {ayahError && (
          <p className="mt-1.5 text-[11px] text-red-600 font-medium">{ayahError}</p>
        )}
      </section>

      {/* Background */}
      <section className="bg-white rounded-lg border border-zinc-200 p-4">
        <label className="block text-xs font-semibold text-emerald-950 mb-1.5">
          Background Color
        </label>
        <div className="flex gap-2 flex-wrap">
          {BG_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setBgMode('preset'); setBgColor(p.value); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
                ${bgMode === 'preset' && bgColor === p.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}
            >
              <span
                className="w-3 h-3 rounded-full border border-zinc-300 shrink-0"
                style={{ backgroundColor: p.value }}
              />
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBgMode('custom')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
              ${bgMode === 'custom'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}
          >
            Custom
          </button>
        </div>

        {bgMode === 'custom' && (
          <div className="mt-2.5 flex items-center gap-2 pt-2.5 border-t border-zinc-100">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-8 h-8 rounded-md cursor-pointer border border-zinc-200 bg-transparent shrink-0"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('#') && v.length <= 7) setCustomColor(v);
                else if (!v.startsWith('#') && v.length <= 6) setCustomColor('#' + v);
              }}
              placeholder="#1a1a2e"
              className="bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-md px-2 py-1.5 text-xs w-24 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>
        )}
      </section>

      {/* Generate */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!!ayahError}
        className={`w-full py-3 rounded-lg text-white font-semibold text-sm transition-colors
          ${ayahError
            ? 'bg-zinc-300 cursor-not-allowed'
            : 'bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98]'}`}
      >
        Generate Clip
      </button>

      <p className="text-center text-[11px] text-zinc-400">
        Audio will be fetched from online Quran recitation sources
      </p>
    </div>
  );
}