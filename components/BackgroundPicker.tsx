'use client';

import { useRef } from 'react';
import { BackgroundConfig } from '@/app/page';

interface Props {
  value: BackgroundConfig;
  onChange: (bg: BackgroundConfig) => void;
}

const PRESET_COLORS = ['#0a0a1a', '#0d1f0d', '#1a0a0a', '#0a0d1a', '#1a1a0a', '#000000'];
const PRESET_GRADIENTS: { from: string; to: string; label: string }[] = [
  { from: '#0a0a1a', to: '#0d3320', label: 'Midnight' },
  { from: '#0d0d0d', to: '#1a0a2e', label: 'Deep' },
  { from: '#071a0d', to: '#0a1a2e', label: 'Forest' },
  { from: '#1a0a0d', to: '#0a0a2e', label: 'Dusk' },
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
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
        {(['color', 'gradient', 'image', 'video'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              if (type === 'image') { imageInputRef.current?.click(); return; }
              if (type === 'video') { videoInputRef.current?.click(); return; }
              if (type === 'color') onChange({ type: 'color', value: '#0a0a1a' });
              if (type === 'gradient') onChange({ type: 'gradient', from: '#0a0a1a', to: '#0d3320' });
            }}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors capitalize
              ${value.type === type ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
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
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ type: 'color', value: c })}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${value.value === c ? 'border-emerald-400 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.value}
                onChange={(e) => onChange({ type: 'color', value: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 bg-transparent"
                title="Custom color"
              />
              <input
                type="text"
                value={value.value}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing, validate that it has a # and is up to 7 characters
                  if (val.startsWith('#') && val.length <= 7) {
                    onChange({ type: 'color', value: val });
                  } else if (!val.startsWith('#') && val.length <= 6) {
                    onChange({ type: 'color', value: '#' + val });
                  }
                }}
                placeholder="#000000"
                className="bg-zinc-800 text-white border border-white/10 rounded px-2 py-1 text-xs w-20 outline-none focus:border-emerald-500 transition-colors"
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
                className={`h-12 rounded-lg border-2 transition-all text-xs text-white/60
                  ${value.type === 'gradient' && value.from === g.from ? 'border-emerald-400' : 'border-transparent'}`}
                style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-white/40">From</span>
            <input type="color" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-xs text-white/40">To</span>
            <input type="color" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
          </div>
        </div>
      )}

      {/* Image/Video preview */}
      {(value.type === 'image' || value.type === 'video') && (
        <div className="space-y-2">
          <div className="h-20 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
            {value.type === 'image' ? (
              <img src={value.url} className="h-full w-full object-cover opacity-70" alt="bg" />
            ) : (
              <video src={value.url} className="h-full w-full object-cover opacity-70" muted />
            )}
          </div>
          <p className="text-xs text-white/40 text-center">
            {value.type === 'video' ? '🔇 Video will be muted + blurred in export' : '🖼️ Image background'}
          </p>
          <button
            onClick={() => value.type === 'image' ? imageInputRef.current?.click() : videoInputRef.current?.click()}
            className="w-full py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/60"
          >
            Change {value.type}
          </button>
        </div>
      )}
    </div>
  );
}
