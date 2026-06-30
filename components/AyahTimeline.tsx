'use client';

import { useState } from 'react';
import { MatchedAyah } from '@/app/page';

interface Props {
  ayahs: MatchedAyah[];
  onUpdate: (ayahs: MatchedAyah[]) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AyahTimeline({ ayahs, onUpdate }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const remove = (i: number) => onUpdate(ayahs.filter((_, idx) => idx !== i));

  const updateField = (index: number, field: keyof MatchedAyah, value: any) => {
    const updated = ayahs.map((ayah, idx) => {
      if (idx === index) {
        return { ...ayah, [field]: value };
      }
      return ayah;
    });
    onUpdate(updated);
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {ayahs.map((ayah, i) => (
        <div key={i} className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
          <div
            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
              {ayah.ayahNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 truncate">{ayah.surahEnglishName}</p>
              <p className="text-[10px] text-white/30">{formatTime(ayah.startTime)} – {formatTime(ayah.endTime)}</p>
            </div>
            <p className="text-sm text-right flex-shrink-0 max-w-[140px] truncate" style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}>
              {ayah.arabic}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="text-white/20 hover:text-red-400 transition-colors text-xs flex-shrink-0 p-1"
            >✕</button>
          </div>

          {expanded === i && (
            <div className="px-3 pb-3 border-t border-white/10 pt-2.5 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">Arabic Text</label>
                <textarea
                  value={ayah.arabic}
                  onChange={(e) => updateField(i, 'arabic', e.target.value)}
                  className="w-full bg-zinc-900/80 text-white border border-white/10 rounded p-2 text-sm outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                  style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">Translation</label>
                <textarea
                  value={ayah.translation}
                  onChange={(e) => updateField(i, 'translation', e.target.value)}
                  className="w-full bg-zinc-900/80 text-white border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">Start Time (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ayah.startTime}
                    onChange={(e) => updateField(i, 'startTime', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900/80 text-white border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">End Time (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ayah.endTime}
                    onChange={(e) => updateField(i, 'endTime', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900/80 text-white border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {ayahs.length === 0 && (
        <p className="text-xs text-white/30 text-center py-4">No ayahs detected</p>
      )}
    </div>
  );
}
