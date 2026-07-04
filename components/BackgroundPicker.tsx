'use client';

import { useRef } from 'react';
import { BackgroundConfig } from '@/app/page';

interface Props {
  value: BackgroundConfig;
  onChange: (bg: BackgroundConfig) => void;
}

const PRESET_COLORS = ['#ffffff', '#f8faf7', '#d1e7dd', '#198754', '#0f5132', '#171717'];
const PRESET_GRADIENTS: { from: string; to: string; label: string }[] = [
  { from: '#ffffff', to: '#d1e7dd', label: 'Mint Glow' },
  { from: '#f8faf7', to: '#e2ebd5', label: 'Soft Sage' },
  { from: '#d1e7dd', to: '#a3cfbb', label: 'Classic Mint' },
  { from: '#0f5132', to: '#1b3a2b', label: 'Deep Forest' },
];

export default function BackgroundPicker({ value, onChange }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ type: 'image', url, file });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ type: 'video', url, file });
  };

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/40">
        {(['color', 'gradient', 'image', 'video'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              if (type === 'image') { imageInputRef.current?.click(); return; }
              if (type === 'video') { videoInputRef.current?.click(); return; }
              if (type === 'color') onChange({ type: 'color', value: '#ffffff' });
              if (type === 'gradient') onChange({ type: 'gradient', from: '#ffffff', to: '#d1e7dd' });
            }}
            className={`flex-1 py-1.5 text-xs rounded-lg transition-all capitalize cursor-pointer font-medium
              ${value.type === type ? 'bg-white text-emerald-950 shadow-sm border border-emerald-100/30' : 'text-zinc-500 hover:text-emerald-700'}`}
          >
            {type}
          </button>
        ))}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

      {/* Color presets */}
      {value.type === 'color' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ type: 'color', value: c })}
                className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${value.value === c ? 'border-emerald-500 scale-110 shadow-sm shadow-emerald-500/20' : 'border-zinc-200'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.value}
                onChange={(e) => onChange({ type: 'color', value: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 bg-transparent"
                title="Custom color"
              />
              <input
                type="text"
                value={value.value}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('#') && val.length <= 7) {
                    onChange({ type: 'color', value: val });
                  } else if (!val.startsWith('#') && val.length <= 6) {
                    onChange({ type: 'color', value: '#' + val });
                  }
                }}
                placeholder="#ffffff"
                className="bg-white text-zinc-900 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs w-24 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Gradient presets */}
      {value.type === 'gradient' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PRESET_GRADIENTS.map((g) => (
              <button
                key={g.label}
                onClick={() => onChange({ type: 'gradient', from: g.from, to: g.to })}
                className={`h-12 rounded-lg border-2 transition-all text-xs text-zinc-800 font-semibold cursor-pointer shadow-sm
                  ${value.type === 'gradient' && value.from === g.from ? 'border-emerald-500' : 'border-zinc-200'}`}
                style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex gap-4 items-center pt-2 border-t border-zinc-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">From</span>
              <input type="color" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-zinc-200" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">To</span>
              <input type="color" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-zinc-200" />
            </div>
          </div>
        </div>
      )}

      {/* Image/Video preview */}
      {(value.type === 'image' || value.type === 'video') && (
        <div className="space-y-2">
          <div className="h-20 rounded-lg overflow-hidden bg-zinc-50 border border-zinc-200 flex items-center justify-center shadow-inner">
            {value.type === 'image' ? (
              <img src={value.url} className="h-full w-full object-cover opacity-80" alt="bg" />
            ) : (
              <video src={value.url} className="h-full w-full object-cover opacity-80" muted />
            )}
          </div>
          <p className="text-xs text-zinc-400 text-center font-medium">
            {value.type === 'video' ? '🔇 Video will be muted + blurred in export' : '🖼️ Image background'}
          </p>
          <button
            onClick={() => value.type === 'image' ? imageInputRef.current?.click() : videoInputRef.current?.click()}
            className="w-full py-2 text-xs bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-700 font-semibold cursor-pointer"
          >
            Change {value.type}
          </button>
        </div>
      )}
    </div>
  );
}
