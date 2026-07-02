'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MatchedAyah } from '@/app/page';

interface Props {
  ayahs: MatchedAyah[];
  onUpdate: (ayahs: MatchedAyah[]) => void;
  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function colorFor(ayah: MatchedAyah): string {
  if (ayah.isBismillah) return '#f59e0b';
  if (ayah.surah === null || !ayah.isFullAyah) return '#71717a';
  return '#10b981';
}

// Picks a "nice" tick interval (in seconds) so the ruler never looks crowded
// or too sparse regardless of video length / zoom level.
function pickTickInterval(pxPerSecond: number): number {
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const minPxPerTick = 70;
  for (const c of candidates) {
    if (c * pxPerSecond >= minPxPerTick) return c;
  }
  return 600;
}

type DragMode =
  | { kind: 'resize'; index: number; edge: 'start' | 'end' }
  | { kind: 'move'; index: number; grabOffset: number }
  | null;

export default function AyahTimeline({ ayahs, onUpdate, duration = 0, currentTime = 0, onSeek }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detecting, setDetecting] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [trackWidth, setTrackWidth] = useState(1000);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode>(null);

  const safeDuration = duration > 0 ? duration : (ayahs.length ? ayahs[ayahs.length - 1].endTime : 1);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setTrackWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerSecond = safeDuration > 0 ? trackWidth / safeDuration : 0;
  const tickInterval = useMemo(() => pickTickInterval(pxPerSecond), [pxPerSecond]);
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let t = 0; t <= safeDuration; t += tickInterval) arr.push(t);
    return arr;
  }, [safeDuration, tickInterval]);

  // ---------- drag / seek ----------

  const timeFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Number((pct * safeDuration).toFixed(2));
  }, [safeDuration]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const list = [...ayahs];

    if (drag.kind === 'resize') {
      const item = { ...list[drag.index] };
      const prev = list[drag.index - 1];
      const next = list[drag.index + 1];
      const t = timeFromClientX(e.clientX);

      if (drag.edge === 'start') {
        const min = prev ? prev.endTime + 0.05 : 0;
        const max = item.endTime - 0.1;
        item.startTime = Math.min(max, Math.max(min, t));
      } else {
        const min = item.startTime + 0.1;
        const max = next ? next.startTime - 0.05 : safeDuration;
        item.endTime = Math.max(min, Math.min(max, t));
      }
      list[drag.index] = item;
    } else {
      // Whole-segment move: keep duration fixed, shift both start & end.
      const item = { ...list[drag.index] };
      const dur = item.endTime - item.startTime;
      const prev = list[drag.index - 1];
      const next = list[drag.index + 1];
      const rawStart = timeFromClientX(e.clientX) - drag.grabOffset;

      const min = prev ? prev.endTime + 0.05 : 0;
      const max = (next ? next.startTime - 0.05 : safeDuration) - dur;
      const newStart = Math.min(Math.max(min, rawStart), Math.max(min, max));

      item.startTime = Number(newStart.toFixed(2));
      item.endTime = Number((newStart + dur).toFixed(2));
      list[drag.index] = item;
    }

    onUpdate(list);
  }, [ayahs, onUpdate, safeDuration, timeFromClientX]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [handlePointerMove]);

  const startResize = (index: number, edge: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: 'resize', index, edge };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const startMove = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const grabTime = timeFromClientX(e.clientX);
    dragRef.current = { kind: 'move', index, grabOffset: grabTime - ayahs[index].startTime };
    setExpanded(index);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [handlePointerMove, stopDrag]);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragRef.current) return;
    onSeek?.(timeFromClientX(e.clientX));
  };

  const playheadPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  // ---------- list ----------

  const remove = (i: number) => onUpdate(ayahs.filter((_, idx) => idx !== i));

  const updateField = (index: number, field: keyof MatchedAyah, value: any) => {
    onUpdate(ayahs.map((ayah, idx) => (idx === index ? { ...ayah, [field]: value } : ayah)));
  };

  const handleDetect = async (index: number) => {
    const ayah = ayahs[index];
    if (!ayah.arabic.trim()) return;

    setDetecting(index);
    try {
      const res = await fetch('/api/match-ayahs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ayah.arabic }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.ayah) {
        onUpdate(ayahs.map((item, idx) => (idx === index ? {
          ...item,
          arabic: data.ayah.arabic,
          translation: data.ayah.translation,
          surah: data.ayah.surah,
          surahName: data.ayah.surahName,
          surahEnglishName: data.ayah.surahEnglishName,
          ayahNumber: data.ayah.ayahNumber,
          isFullAyah: true,
        } : item)));
      } else {
        alert(data.error || 'No matching ayah found in database.');
      }
    } catch (err) {
      console.error('Error detecting ayah:', err);
      alert('Failed to connect to the matching service.');
    } finally {
      setDetecting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} /> Matched ayah</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /> Bismillah</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#71717a' }} /> Unmatched</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="w-8 text-center">{zoom}x</span>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            disabled={zoom <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-base leading-none"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(8, z + 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-base leading-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Big horizontal timeline */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
        <div style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
          {/* Ruler */}
          <div className="relative h-6 border-b border-white/10 select-none">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full flex flex-col items-start"
                style={{ left: `${(t / safeDuration) * 100}%` }}
              >
                <div className="w-px h-1.5 bg-white/20" />
                <span className="text-[10px] text-white/40 font-mono -translate-x-1/2 mt-0.5">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Track */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative h-24 cursor-pointer"
          >
            {/* faint vertical gridlines aligned to ruler ticks */}
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px bg-white/5 pointer-events-none"
                style={{ left: `${(t / safeDuration) * 100}%` }}
              />
            ))}

            {ayahs.map((ayah, i) => {
              const left = safeDuration > 0 ? (ayah.startTime / safeDuration) * 100 : 0;
              const width = safeDuration > 0 ? Math.max(0.4, ((ayah.endTime - ayah.startTime) / safeDuration) * 100) : 0;
              const isSelected = expanded === i;
              const label = ayah.isBismillah
                ? 'Bismillah'
                : (ayah.ayahNumber !== null && ayah.isFullAyah)
                  ? `${ayah.surah}:${ayah.ayahNumber}`
                  : '?';

              return (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setExpanded(i); }}
                  onPointerDown={startMove(i)}
                  className="absolute top-2 bottom-2 rounded-lg flex flex-col items-center justify-center overflow-hidden select-none shadow-lg cursor-grab active:cursor-grabbing transition-[outline] px-1"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: colorFor(ayah),
                    opacity: isSelected ? 1 : 0.82,
                    outline: isSelected ? '3px solid white' : '2px solid rgba(0,0,0,0.2)',
                    outlineOffset: '-2px',
                  }}
                  title={`${ayah.surahEnglishName || ''} ${label} · ${formatTime(ayah.startTime)}–${formatTime(ayah.endTime)}`}
                >
                  <span className="text-sm font-bold text-white/95 truncate pointer-events-none leading-tight">
                    {label}
                  </span>
                  <span className="text-[10px] text-white/80 font-mono truncate pointer-events-none leading-tight">
                    {formatTime(ayah.startTime)}–{formatTime(ayah.endTime)}
                  </span>

                  {/* Resize handles — big, obvious grab strips */}
                  <div
                    onPointerDown={startResize(i, 'start')}
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/0 hover:bg-white/40 flex items-center justify-center"
                  >
                    <div className="w-0.5 h-6 rounded-full bg-white/70" />
                  </div>
                  <div
                    onPointerDown={startResize(i, 'end')}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/0 hover:bg-white/40 flex items-center justify-center"
                  >
                    <div className="w-0.5 h-6 rounded-full bg-white/70" />
                  </div>
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-0.5 -left-[5px] w-3 h-3 rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/30">
        Drag the middle of a block to move it, drag an edge to resize it, click empty space to seek.
      </p>

      {/* Detail list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {ayahs.map((ayah, i) => (
          <div key={i} className={`bg-white/5 rounded-xl overflow-hidden border transition-colors ${expanded === i ? 'border-emerald-500/50' : 'border-white/10'}`}>
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold flex-shrink-0"
                style={{ backgroundColor: `${colorFor(ayah)}33`, color: colorFor(ayah) }}
              >
                {ayah.ayahNumber ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{ayah.surahEnglishName || (ayah.isBismillah ? 'Bismillah' : 'Unmatched')}</p>
                <p className="text-[10px] text-white/30">{formatTime(ayah.startTime)} – {formatTime(ayah.endTime)}</p>
              </div>
              <p
                className="text-sm text-right flex-shrink-0 max-w-[140px] truncate"
                style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}
              >
                {ayah.arabic}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                className="text-white/20 hover:text-red-400 transition-colors text-xs flex-shrink-0 p-1"
              >
                ✕
              </button>
            </div>

            {expanded === i && (
              <div className="px-3 pb-3 border-t border-white/10 pt-2.5 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">
                      Arabic Text
                    </label>
                    <button
                      onClick={() => handleDetect(i)}
                      disabled={detecting !== null}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:text-white/20 font-medium transition-colors"
                    >
                      {detecting === i ? 'Detecting…' : 'Re-match ayah'}
                    </button>
                  </div>
                  <textarea
                    value={ayah.arabic}
                    onChange={(e) => updateField(i, 'arabic', e.target.value)}
                    className="w-full bg-zinc-900/80 text-white border border-white/10 rounded p-2 text-sm outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                    style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">
                    Translation
                  </label>
                  <textarea
                    value={ayah.translation}
                    onChange={(e) => updateField(i, 'translation', e.target.value)}
                    className="w-full bg-zinc-900/80 text-white border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">
                      Start Time (sec)
                    </label>
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
                    <label className="text-[9px] text-white/40 uppercase tracking-wider block font-semibold">
                      End Time (sec)
                    </label>
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
    </div>
  );
}