'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

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

interface Reciter {
  id: string;
  name: string;
  initials: string;
}

interface Surah {
  number: number;
  name: string;
  arabic: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const RECITERS: Reciter[] = [
  { id: 'alafasy',   name: 'Mishary Rashid Alafasy',   initials: 'MA' },
  { id: 'sudais',    name: 'Abdul Rahman Al-Sudais',   initials: 'AS' },
  { id: 'abdulbasit',name: 'Abdul Basit Abdul Samad',  initials: 'AB' },
  { id: 'muaiqly',   name: 'Maher Al Muaiqly',         initials: 'MM' },
  { id: 'shuraim',   name: 'Saud Al-Shuraim',          initials: 'SS' },
  { id: 'ghamdi',    name: 'Saad Al-Ghamdi',           initials: 'SG' },
  { id: 'rifai',     name: 'Hani Ar-Rifai',            initials: 'HR' },
  { id: 'dosari',    name: 'Yasser Al-Dosari',         initials: 'YD' },
  { id: 'shatri',    name: 'Abu Bakr Al-Shatri',       initials: 'AS' },
  { id: 'ajmi',      name: 'Ahmad Al-Ajmi',            initials: 'AA' },
];

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

const SURAHS: Surah[] = SURAH_NAMES.map((name, i) => ({
  number: i + 1,
  name,
  arabic: SURAH_ARABIC[i],
}));

const BG_PRESETS = [
  { label: 'Black',      value: '#000000' },
  { label: 'Dark Green',  value: '#052e16' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreateFromVerse({ onGenerate }: Props) {
  /* ---------- state ---------- */
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);
  const [reciterOpen, setReciterOpen] = useState(false);

  const [surah, setSurah] = useState<Surah>(SURAHS[0]);
  const [surahOpen, setSurahOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState('');

  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);

  const [bgMode, setBgMode] = useState<'preset' | 'custom'>('preset');
  const [bgColor, setBgColor] = useState('#000000');
  const [customColor, setCustomColor] = useState('#1a1a2e');

  /* ---------- refs for click-outside ---------- */
  const reciterRef = useRef<HTMLDivElement>(null);
  const surahRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reciterRef.current && !reciterRef.current.contains(e.target as Node)) setReciterOpen(false);
      if (surahRef.current && !surahRef.current.contains(e.target as Node)) setSurahOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ---------- filtered surahs ---------- */
  const filteredSurahs = useMemo(() => {
    if (!surahSearch.trim()) return SURAHS;
    const q = surahSearch.toLowerCase();
    return SURAHS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.arabic.includes(surahSearch) ||
        String(s.number).includes(q),
    );
  }, [surahSearch]);

  /* ---------- validation ---------- */
  const ayahError = useMemo(() => {
    if (fromAyah < 1) return 'From Ayah must be at least 1';
    if (toAyah < fromAyah) return 'To Ayah must be ≥ From Ayah';
    if (fromAyah > 300 || toAyah > 300) return 'Ayah number seems too large';
    return '';
  }, [fromAyah, toAyah]);

  /* ---------- active bg color ---------- */
  const activeBg = bgMode === 'custom' ? customColor : bgColor;

  /* ---------- generate ---------- */
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
    <div className="space-y-5">
      {/* -------- 1 · Reciter -------- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-emerald-950 mb-2.5">
          Reciter
        </label>

        <div ref={reciterRef} className="relative">
          <button
            type="button"
            onClick={() => setReciterOpen((o) => !o)}
            className="w-full flex items-center gap-3 border border-zinc-200 rounded-lg px-3.5 py-2.5 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left cursor-pointer group"
          >
            {/* avatar */}
            <span className="shrink-0 w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold tracking-wide shadow-sm">
              {reciter.initials}
            </span>
            <span className="flex-1 text-sm font-medium text-zinc-900 truncate">
              {reciter.name}
            </span>
            {/* chevron */}
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${reciterOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {reciterOpen && (
            <ul className="absolute z-30 mt-1.5 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 overflow-y-auto py-1 animate-[fadeIn_120ms_ease-out]">
              {RECITERS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { setReciter(r); setReciterOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer
                      ${r.id === reciter.id ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-zinc-50 text-zinc-800'}`}
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-700/90 flex items-center justify-center text-white text-[11px] font-bold tracking-wide">
                      {r.initials}
                    </span>
                    <span className="text-sm font-medium truncate">{r.name}</span>
                    {r.id === reciter.id && (
                      <svg className="ml-auto w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* -------- 2 · Surah -------- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-emerald-950 mb-2.5">
          Surah
        </label>

        <div ref={surahRef} className="relative">
          <button
            type="button"
            onClick={() => { setSurahOpen((o) => !o); setSurahSearch(''); }}
            className="w-full flex items-center gap-3 border border-zinc-200 rounded-lg px-3.5 py-2.5 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left cursor-pointer"
          >
            <span className="shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
              {surah.number}
            </span>
            <span className="flex-1 text-sm font-medium text-zinc-900 truncate">
              {surah.name}
            </span>
            <span className="text-sm text-zinc-400 font-arabic">{surah.arabic}</span>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${surahOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {surahOpen && (
            <div className="absolute z-30 mt-1.5 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden animate-[fadeIn_120ms_ease-out]">
              {/* search */}
              <div className="px-3 py-2 border-b border-zinc-100">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search surah name or number…"
                    value={surahSearch}
                    onChange={(e) => setSurahSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-zinc-200 bg-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-400"
                  />
                </div>
              </div>

              {/* list */}
              <ul className="max-h-56 overflow-y-auto py-1">
                {filteredSurahs.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-zinc-400">No surahs found</li>
                )}
                {filteredSurahs.map((s) => (
                  <li key={s.number}>
                    <button
                      type="button"
                      onClick={() => { setSurah(s); setSurahOpen(false); setSurahSearch(''); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors cursor-pointer
                        ${s.number === surah.number ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-zinc-50 text-zinc-800'}`}
                    >
                      <span className="shrink-0 w-7 h-7 rounded-md bg-zinc-100 text-zinc-600 flex items-center justify-center text-[11px] font-bold">
                        {s.number}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                      <span className="text-sm text-zinc-400 font-arabic">{s.arabic}</span>
                      {s.number === surah.number && (
                        <svg className="ml-1 w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* -------- 3 · Ayah Range -------- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-emerald-950 mb-2.5">
          Ayah Range
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-xs text-zinc-500 mb-1 font-medium">From Ayah</span>
            <input
              type="number"
              min={1}
              value={fromAyah}
              onChange={(e) => setFromAyah(Math.max(1, Number(e.target.value)))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-zinc-900 font-medium"
            />
          </div>
          <div>
            <span className="block text-xs text-zinc-500 mb-1 font-medium">To Ayah</span>
            <input
              type="number"
              min={1}
              value={toAyah}
              onChange={(e) => setToAyah(Math.max(1, Number(e.target.value)))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-zinc-900 font-medium"
            />
          </div>
        </div>

        {ayahError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {ayahError}
          </p>
        )}
      </section>

      {/* -------- 4 · Background -------- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <label className="block text-sm font-semibold text-emerald-950 mb-2.5">
          Background Color
        </label>

        <div className="flex gap-2 flex-wrap">
          {BG_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setBgMode('preset'); setBgColor(p.value); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer
                ${bgMode === 'preset' && bgColor === p.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-500/10'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'}`}
            >
              <span
                className="w-4 h-4 rounded-full border border-zinc-300 shrink-0"
                style={{ backgroundColor: p.value }}
              />
              {p.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setBgMode('custom')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer
              ${bgMode === 'custom'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-500/10'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'}`}
          >
            <span
              className="w-4 h-4 rounded-full border border-zinc-300 shrink-0"
              style={{ background: 'conic-gradient(red, orange, yellow, green, blue, violet, red)' }}
            />
            Custom Color
          </button>
        </div>

        {bgMode === 'custom' && (
          <div className="mt-3 flex items-center gap-3 pt-3 border-t border-zinc-100">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border border-zinc-200 bg-transparent shrink-0"
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
              className="bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 text-xs w-28 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
            />
            <div className="flex-1 h-9 rounded-lg border border-zinc-200 shadow-inner" style={{ backgroundColor: customColor }} />
          </div>
        )}
      </section>

      {/* -------- 5 · Generate -------- */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!!ayahError}
          className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-md
            ${ayahError
              ? 'bg-zinc-300 cursor-not-allowed shadow-none'
              : 'bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] cursor-pointer shadow-emerald-700/20 hover:shadow-emerald-600/30'}`}
        >
          {/* play-circle icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Generate Clip
        </button>

        <p className="text-center text-xs text-zinc-400 font-medium">
          Audio will be fetched from online Quran recitation sources
        </p>
      </section>
    </div>
  );
}
