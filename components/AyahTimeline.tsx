'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MatchedAyah } from '@/app/page';
import {
  AyahSegmentStyle,
  GlobalTextStyle,
  TEXT_ANIMATION_OPTIONS,
  hasStyleOverride,
  resolveAyahStyle,
} from '@/lib/ayah-styles';

interface Props {
  ayahs: MatchedAyah[];
  onUpdate: (ayahs: MatchedAyah[]) => void;
  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  globalTextStyle: GlobalTextStyle;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function colorFor(ayah: MatchedAyah): string {
  if (ayah.isBismillah) return '#f59e0b';
  if (ayah.isIstiadhah) return '#8b5cf6';
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

function snapTo(t: number, targets: number[], thresholdSec: number): { value: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = thresholdSec;
  for (const target of targets) {
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return best !== null ? { value: best, snapped: best } : { value: t, snapped: null };
}

export default function AyahTimeline({ ayahs, onUpdate, duration = 0, currentTime = 0, onSeek, globalTextStyle }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detecting, setDetecting] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [trackWidth, setTrackWidth] = useState(1000);
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode>(null);

  const safeDuration = duration > 0 ? duration : (ayahs.length ? ayahs[ayahs.length - 1].endTime : 1);

  const ayahsRef = useRef(ayahs);
  useEffect(() => { ayahsRef.current = ayahs; }, [ayahs]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const safeDurationRef = useRef(safeDuration);
  useEffect(() => { safeDurationRef.current = safeDuration; }, [safeDuration]);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

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

  const timeFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Number((pct * safeDurationRef.current).toFixed(2));
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const liveAyahs = ayahsRef.current;
    const liveDuration = safeDurationRef.current;
    const liveCurrentTime = currentTimeRef.current;
    const list = [...liveAyahs];

    const trackPxWidth = trackRef.current?.getBoundingClientRect().width || 1000;
    // Smaller pixel radius = you can freely place a segment anywhere; it only
    // locks on once you actually drag it right up against another edge.
    const snapThresholdSec = (liveDuration / trackPxWidth) * 5;

    const snapTargets: number[] = [liveCurrentTime];
    liveAyahs.forEach((a, idx) => {
      if (idx === drag.index) return;
      snapTargets.push(a.startTime, a.endTime);
    });

    if (drag.kind === 'resize') {
      const item = { ...list[drag.index] };
      const prev = list[drag.index - 1];
      const next = list[drag.index + 1];
      const raw = timeFromClientX(e.clientX);
      const { value: t, snapped } = snapTo(raw, snapTargets, snapThresholdSec);

      if (drag.edge === 'start') {
        const min = prev ? prev.endTime + 0.05 : 0;
        const max = item.endTime - 0.1;
        item.startTime = Number(Math.min(max, Math.max(min, t)).toFixed(2));
      } else {
        const min = item.startTime + 0.1;
        const max = next ? next.startTime - 0.05 : liveDuration;
        item.endTime = Number(Math.max(min, Math.min(max, t)).toFixed(2));
      }
      list[drag.index] = item;
      setSnapGuide(snapped);
    } else {
      const item = { ...list[drag.index] };
      const dur = item.endTime - item.startTime;
      const prev = list[drag.index - 1];
      const next = list[drag.index + 1];
      const rawStart = timeFromClientX(e.clientX) - drag.grabOffset;
      const rawEnd = rawStart + dur;

      const startSnap = snapTo(rawStart, snapTargets, snapThresholdSec);
      const endSnap = snapTo(rawEnd, snapTargets, snapThresholdSec);

      let newStart = rawStart;
      let guide: number | null = null;
      if (startSnap.snapped !== null && endSnap.snapped !== null) {
        const startDist = Math.abs(rawStart - startSnap.value);
        const endDist = Math.abs(rawEnd - endSnap.value);
        if (startDist <= endDist) {
          newStart = startSnap.value;
          guide = startSnap.snapped;
        } else {
          newStart = endSnap.value - dur;
          guide = endSnap.snapped;
        }
      } else if (startSnap.snapped !== null) {
        newStart = startSnap.value;
        guide = startSnap.snapped;
      } else if (endSnap.snapped !== null) {
        newStart = endSnap.value - dur;
        guide = endSnap.snapped;
      }

      const min = prev ? prev.endTime + 0.05 : 0;
      const max = (next ? next.startTime - 0.05 : liveDuration) - dur;
      newStart = Math.min(Math.max(min, newStart), Math.max(min, max));

      item.startTime = Number(newStart.toFixed(2));
      item.endTime = Number((newStart + dur).toFixed(2));
      list[drag.index] = item;
      setSnapGuide(guide);
    }

    onUpdateRef.current(list);
  }, [timeFromClientX]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    setSnapGuide(null);
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
    dragRef.current = { kind: 'move', index, grabOffset: grabTime - ayahsRef.current[index].startTime };
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
  const snapGuidePct = snapGuide !== null && safeDuration > 0 ? Math.min(100, (snapGuide / safeDuration) * 100) : null;

  const remove = (i: number) => onUpdate(ayahs.filter((_, idx) => idx !== i));

  const duplicate = (index: number) => {
    const ayah = ayahs[index];
    const dur = ayah.endTime - ayah.startTime;
    const gap = 0.05;
    const newStart = Number((ayah.endTime + gap).toFixed(2));
    const newEnd = Number((newStart + dur).toFixed(2));
    const timeShift = newStart - ayah.startTime;

    const copy: MatchedAyah = {
      ...ayah,
      startTime: newStart,
      endTime: newEnd,
      displayStart: ayah.displayStart !== undefined ? newStart : undefined,
      displayEnd: ayah.displayEnd !== undefined ? newEnd : undefined,
      style: ayah.style ? { ...ayah.style } : undefined,
      words: ayah.words?.map((w) => ({
        ...w,
        start: Number((w.start + timeShift).toFixed(2)),
        end: Number((w.end + timeShift).toFixed(2)),
      })),
    };

    const list = [...ayahs];
    list.splice(index + 1, 0, copy);
    onUpdate(list);
    setExpanded(index + 1);
    onSeek?.(newStart);
  };

  // Inserts a Bismillah or Isti'adhah text segment at the very start of the
  // timeline WITHOUT touching any existing ayah's timing. It fits into
  // whatever gap exists before the first ayah (up to 3s); if there's no gap,
  // it's inserted with a small default length and you can drag/resize it
  // into place yourself — nothing else on the timeline moves.
  const insertIntroSegment = (kind: 'bismillah' | 'istiadhah') => {
    const firstAyahStart = ayahs.length > 0 ? ayahs[0].startTime : safeDuration;
    const availableGap = Math.max(0, firstAyahStart);
    const insertDuration = availableGap > 0.3 ? Math.min(3, availableGap) : 1;

    const introSegment: MatchedAyah = kind === 'bismillah'
      ? {
        surah: null,
        surahName: null,
        surahEnglishName: null,
        ayahNumber: null,
        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'In the name of Allah, the Most Gracious, the Most Merciful',
        isFullAyah: false,
        isBismillah: true,
        startTime: 0,
        endTime: insertDuration,
      }
      : {
        surah: null,
        surahName: null,
        surahEnglishName: null,
        ayahNumber: null,
        arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
        translation: 'I seek refuge in Allah from Satan, the accursed',
        isFullAyah: false,
        isIstiadhah: true,
        startTime: 0,
        endTime: insertDuration,
      };

    onUpdate([introSegment, ...ayahs]);
    setExpanded(0);
    onSeek?.(0);
  };

  const updateField = (index: number, field: keyof MatchedAyah, value: unknown) => {
    onUpdate(ayahs.map((ayah, idx) => (idx === index ? { ...ayah, [field]: value } : ayah)));
  };

  const updateStyle = (index: number, patch: Partial<AyahSegmentStyle>) => {
    onUpdate(ayahs.map((ayah, idx) => {
      if (idx !== index) return ayah;
      const merged = { ...(ayah.style ?? {}), ...patch };
      (Object.keys(merged) as (keyof AyahSegmentStyle)[]).forEach((key) => {
        if (merged[key] === undefined) delete merged[key];
      });
      return {
        ...ayah,
        style: Object.keys(merged).length > 0 ? merged : undefined,
      };
    }));
  };

  const clearStyle = (index: number) => {
    onUpdate(ayahs.map((ayah, idx) => (idx === index ? { ...ayah, style: undefined } : ayah)));
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
      <style>{`
        .ayah-scroll {
          scrollbar-width: thin;
          scrollbar-color: #d4d4d8 transparent;
        }
        .ayah-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .ayah-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .ayah-scroll::-webkit-scrollbar-thumb {
          background-color: #d4d4d8;
          border-radius: 9999px;
        }
      `}</style>

      {/* Insert intro segment buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => insertIntroSegment('istiadhah')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
          title="Insert Isti'adhah (A'udhu billah) at the start"
        >
          + Isti&apos;adhah
        </button>
        <button
          onClick={() => insertIntroSegment('bismillah')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer"
          title="Insert Bismillah at the start"
        >
          + Bismillah
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} /> Matched ayah</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /> Bismillah</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8b5cf6' }} /> Isti&apos;adhah</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#71717a' }} /> Unmatched</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <span className="w-8 text-center">{zoom}x</span>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            disabled={zoom <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 disabled:opacity-35 text-base leading-none transition-all cursor-pointer font-bold"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(8, z + 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 text-base leading-none transition-all cursor-pointer font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* Big horizontal timeline */}
      <div className="ayah-scroll overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 shadow-inner">
        <div style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
          {/* Ruler */}
          <div className="relative h-6 border-b border-zinc-200 select-none bg-zinc-100/60 rounded-t-xl">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full flex flex-col items-start"
                style={{ left: `${(t / safeDuration) * 100}%` }}
              >
                <div className="w-px h-1.5 bg-zinc-400" />
                <span className="text-[10px] text-zinc-500 font-mono -translate-x-1/2 mt-0.5">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Track */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative h-24 cursor-pointer"
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px bg-zinc-200 pointer-events-none"
                style={{ left: `${(t / safeDuration) * 100}%` }}
              />
            ))}

            {ayahs.map((ayah, i) => {
              const left = safeDuration > 0 ? (ayah.startTime / safeDuration) * 100 : 0;
              const width = safeDuration > 0 ? Math.max(0.4, ((ayah.endTime - ayah.startTime) / safeDuration) * 100) : 0;
              const isSelected = expanded === i;
              const label = ayah.isBismillah
                ? 'Bismillah'
                : ayah.isIstiadhah
                  ? "Isti'adhah"
                  : (ayah.ayahNumber !== null && ayah.isFullAyah)
                    ? `${ayah.surah}:${ayah.ayahNumber}`
                    : '?';

              return (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setExpanded(i); }}
                  onPointerDown={startMove(i)}
                  className="absolute top-2 bottom-2 rounded-lg flex flex-col items-center justify-center overflow-hidden select-none shadow-md cursor-grab active:cursor-grabbing transition-[outline] px-1 group"
                  style={{
                    touchAction: 'none',
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: colorFor(ayah),
                    opacity: isSelected ? 1 : 0.85,
                    outline: isSelected ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.1)',
                    outlineOffset: '1px',
                  }}
                  title={`${ayah.surahEnglishName || ''} ${label} · ${formatTime(ayah.startTime)}–${formatTime(ayah.endTime)}`}
                >
                  <span className="text-[11px] font-bold text-white/95 truncate pointer-events-none leading-tight">
                    {label}
                    {ayah.style && Object.keys(ayah.style).length > 0 && (
                      <span className="ml-1 opacity-80" title="Custom appearance">✦</span>
                    )}
                  </span>
                  <span className="text-[9px] text-white/80 font-mono truncate pointer-events-none leading-tight">
                    {formatTime(ayah.startTime)}–{formatTime(ayah.endTime)}
                  </span>

                  <div
                    onPointerDown={startResize(i, 'start')}
                    className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-black/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <div className="w-1 h-8 rounded-full bg-white shadow-sm" />
                  </div>
                  <div
                    onPointerDown={startResize(i, 'end')}
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-black/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <div className="w-1 h-8 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
              );
            })}

            {snapGuidePct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-pink-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(236,72,153,0.9)]"
                style={{ left: `${snapGuidePct}%` }}
              >
                <div className="absolute -top-1 -left-[3px] w-2 h-2 rotate-45 bg-pink-500" />
              </div>
            )}

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-0.5 -left-[5px] w-3 h-3 rounded-full bg-red-500" />
              {safeDuration > 0 && (
                <div className="absolute top-full mt-1 -left-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  {formatTime(currentTime)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 font-medium">
        Click a block to edit it. Drag to move, drag edges to resize. Use Appearance to set animation, font size, line height, and padding per ayah — or keep Global defaults from the right panel.
      </p>

      {/* Detail list */}
      <div className="ayah-scroll space-y-2 max-h-96 overflow-y-auto pr-1 mt-4">
        {ayahs.map((ayah, i) => (
          <div key={i} className={`bg-white rounded-xl overflow-hidden border transition-all shadow-sm ${expanded === i ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-zinc-200'}`}>
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-50 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold flex-shrink-0 shadow-sm"
                style={{ backgroundColor: `${colorFor(ayah)}20`, color: colorFor(ayah) }}
              >
                {ayah.ayahNumber ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-800 font-semibold truncate">{ayah.surahEnglishName || (ayah.isBismillah ? 'Bismillah' : ayah.isIstiadhah ? "Isti'adhah" : 'Unmatched')}</p>
                <p className="text-[10px] text-zinc-500">{formatTime(ayah.startTime)} – {formatTime(ayah.endTime)}</p>
              </div>
              <p
                className="text-sm text-right flex-shrink-0 max-w-[140px] truncate font-bold text-zinc-800"
                style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}
              >
                {ayah.arabic}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); duplicate(i); }}
                className="text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs flex-shrink-0 p-1.5 cursor-pointer"
                title="Duplicate segment"
              >
                ⧉
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                className="text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs flex-shrink-0 p-1.5 cursor-pointer"
                title="Remove segment"
              >
                ✕
              </button>
            </div>

            {expanded === i && (() => {
              const resolved = resolveAyahStyle(ayah.style, globalTextStyle);
              const customBadge = (field: keyof AyahSegmentStyle) =>
                hasStyleOverride(ayah.style, field) ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Custom</span>
                ) : (
                  <span className="text-[9px] text-zinc-400">Global</span>
                );

              return (
                <div className="px-3 pb-3 border-t border-zinc-150 pt-3 space-y-4 bg-zinc-50/50">
                  {/* Text */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Text</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-zinc-500 font-medium">Arabic</label>
                        <button
                          onClick={() => handleDetect(i)}
                          disabled={detecting !== null}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 disabled:text-zinc-400 font-semibold transition-colors cursor-pointer"
                        >
                          {detecting === i ? 'Detecting…' : 'Re-match ayah'}
                        </button>
                      </div>
                      <textarea
                        value={ayah.arabic}
                        onChange={(e) => updateField(i, 'arabic', e.target.value)}
                        className="w-full bg-white text-zinc-900 font-medium border border-zinc-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all leading-relaxed shadow-inner"
                        style={{ fontFamily: '"Scheherazade New", serif', direction: 'rtl' }}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-medium block">Translation</label>
                      <textarea
                        value={ayah.translation}
                        onChange={(e) => updateField(i, 'translation', e.target.value)}
                        className="w-full bg-white text-zinc-900 border border-zinc-200 rounded-lg p-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all leading-relaxed shadow-inner"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Timing */}
                  <div className="space-y-2 pt-1 border-t border-zinc-200/80">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Timing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-medium block">Start (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={ayah.startTime}
                          onChange={(e) => updateField(i, 'startTime', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white text-zinc-950 font-mono font-medium border border-zinc-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-medium block">End (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={ayah.endTime}
                          onChange={(e) => updateField(i, 'endTime', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white text-zinc-950 font-mono font-medium border border-zinc-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSeek?.(ayah.startTime)}
                      className="text-[10px] text-emerald-700 hover:underline font-medium"
                    >
                      Jump to this segment in preview
                    </button>
                  </div>

                  {/* Appearance — per-segment overrides */}
                  <div className="space-y-3 pt-1 border-t border-zinc-200/80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Appearance</p>
                      {ayah.style && (
                        <button
                          type="button"
                          onClick={() => clearStyle(i)}
                          className="text-[10px] text-zinc-500 hover:text-emerald-700 font-medium"
                        >
                          Reset to global
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-medium block">Entrance animation</label>
                      <div className="grid grid-cols-2 gap-1">
                        {TEXT_ANIMATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (opt.value === globalTextStyle.textAnimation) {
                                updateStyle(i, { textAnimation: undefined });
                              } else {
                                updateStyle(i, { textAnimation: opt.value });
                              }
                            }}
                            className={`px-2 py-1 rounded text-[10px] transition-colors ${resolved.textAnimation === opt.value
                              ? 'bg-emerald-700 text-white'
                              : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {([
                      ['arabicFontSize', 'Arabic font size', 16, 80, 1, 'px'] as const,
                      ['englishFontSize', 'English font size', 12, 60, 1, 'px'] as const,
                      ['arabicLineHeight', 'Arabic line height', 1, 3, 0.05, ''] as const,
                      ['englishLineHeight', 'English line height', 1, 3, 0.05, ''] as const,
                      ['arabicPadding', 'Arabic padding', 0, 48, 1, 'px'] as const,
                      ['englishPadding', 'English padding', 0, 48, 1, 'px'] as const,
                    ]).map(([field, label, min, max, step, suffix]) => {
                      const globalVal = globalTextStyle[field];
                      const val = resolved[field];
                      const isCustom = hasStyleOverride(ayah.style, field);
                      return (
                        <div key={field} className="space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <label className="text-[10px] text-zinc-500 font-medium">{label}</label>
                            <div className="flex items-center gap-2">
                              {customBadge(field)}
                              <span className="text-[10px] font-mono text-zinc-600">
                                {suffix === 'px' ? `${val}px` : val.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={val}
                            onChange={(e) => {
                              const num = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value);
                              if (num === globalVal) {
                                updateStyle(i, { [field]: undefined });
                              } else {
                                updateStyle(i, { [field]: num });
                              }
                            }}
                            className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                          />
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => updateStyle(i, { [field]: undefined })}
                              className="text-[9px] text-zinc-400 hover:text-emerald-600"
                            >
                              Use global ({suffix === 'px' ? `${globalVal}px` : globalVal.toFixed(2)})
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[10px] text-zinc-500 font-medium">Segment text color</label>
                      <div className="flex items-center gap-2">
                        {customBadge('textColor')}
                        <input
                          type="color"
                          value={resolved.textColor}
                          onChange={(e) => {
                            if (e.target.value === globalTextStyle.textColor) {
                              updateStyle(i, { textColor: undefined });
                            } else {
                              updateStyle(i, { textColor: e.target.value });
                            }
                          }}
                          className="w-7 h-7 rounded cursor-pointer border border-zinc-200 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => duplicate(i)}
                      className="flex-1 py-2 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Duplicate segment
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
        {ayahs.length === 0 && (
          <p className="text-xs text-gray-500 font-medium text-center py-4">No ayahs detected</p>
        )}
      </div>
    </div>
  );
}