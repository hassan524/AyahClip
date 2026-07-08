'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { BackgroundConfig, MatchedAyah } from '@/app/page';
import {
  TextAnimation,
  GlobalTextStyle,
  resolveAyahStyle,
} from '@/lib/ayah-styles';

// ============================================================
// TYPES
// ============================================================

export interface TextPosition {
  x: number;
  y: number;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';
export type SurahLabelLang = 'arabic' | 'english' | 'both';
export type { TextAnimation };

interface Props {
  videoUrl: string;
  isAudioOnly?: boolean;
  ayahs: MatchedAyah[];
  background: BackgroundConfig;
  textColor: string;
  showTranslation: boolean;
  duration: number;
  videoOpacity: number;
  overlayType: 'none' | 'bottom' | 'full';
  overlayOpacity: number;
  arabicFont: string;
  englishFont: string;
  arabicAlign: 'center' | 'right';
  englishAlign: 'center' | 'left';
  verticalPosition: 'center' | 'bottom';
  arabicFontSize: number;
  englishFontSize: number;
  wordHighlight?: boolean;
  onTimeUpdate?: (time: number) => void;
  seekTo?: { time: number; token: number } | null;
  aspectRatio?: AspectRatio;
  textAnimation?: TextAnimation;
  arabicLineHeight?: number;
  englishLineHeight?: number;
  arabicPadding?: number;
  englishPadding?: number;
  arabicPosition?: TextPosition | null;
  englishPosition?: TextPosition | null;
  onArabicPositionChange?: (pos: TextPosition) => void;
  onEnglishPositionChange?: (pos: TextPosition) => void;
  showSurahLabel?: boolean;
  surahLabelLang?: SurahLabelLang;
}

const ASPECT_RATIO_CSS: Record<AspectRatio, string> = {
  '16:9': '16 / 9',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '4:5': '4 / 5',
};

const ASPECT_CONTAINER_CLASS: Record<AspectRatio, string> = {
  '16:9': 'w-full',
  '1:1': 'w-full max-w-2xl mx-auto',
  '9:16': 'w-full max-w-sm mx-auto',
  '4:5': 'w-full max-w-md mx-auto',
};

const SNAP_THRESHOLD = 3;

// Picks a shadow color that stays readable against the chosen text color,
// instead of a hardcoded black shadow that disappears (or looks like a smudge)
// whenever the text itself is dark/black on a light background.
function getAdaptiveShadow(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Light text (white/near-white) -> dark shadow for contrast on any background.
  // Dark text (black/near-black) -> soft light shadow instead of invisible black-on-black.
  return luminance > 0.6
    ? '0 2px 8px rgba(0,0,0,0.85)'
    : '0 1px 4px rgba(255,255,255,0.5)';
}

export default function VideoPreview({
  videoUrl, isAudioOnly = false, ayahs, background, textColor, showTranslation, duration,
  videoOpacity, overlayType, overlayOpacity, arabicFont, englishFont,
  arabicAlign, englishAlign, verticalPosition, arabicFontSize, englishFontSize,
  wordHighlight = false, onTimeUpdate, seekTo,
  aspectRatio = '16:9',
  textAnimation = 'fade',
  arabicLineHeight = 1.75,
  englishLineHeight = 1.6,
  arabicPadding = 0,
  englishPadding = 0,
  arabicPosition = null,
  englishPosition = null,
  onArabicPositionChange,
  onEnglishPositionChange,
  showSurahLabel = true,
  surahLabelLang = 'english',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const arabicElRef = useRef<HTMLDivElement>(null);
  const englishElRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const rafRef = useRef<number>(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeekTokenRef = useRef<number | null>(null);

  const dragRef = useRef<{
    target: 'arabic' | 'english';
    origX: number;
    origY: number;
    startClientX: number;
    startClientY: number;
    liveX: number;
    liveY: number;
  } | null>(null);

  const [draggingTarget, setDraggingTarget] = useState<'arabic' | 'english' | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  const hasDraggedRef = useRef(false);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    controlsTimerRef.current && clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    return () => { controlsTimerRef.current && clearTimeout(controlsTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      controlsTimerRef.current && clearTimeout(controlsTimerRef.current);
    }
  }, [playing]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setPlaying(true); rafRef.current = requestAnimationFrame(tick); };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const onSeeked = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const onEnded = () => { setPlaying(false); cancelAnimationFrame(rafRef.current); };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
    };
  }, [tick, onTimeUpdate]);

  useEffect(() => {
    if (!seekTo) return;
    if (lastSeekTokenRef.current === seekTo.token) return;
    lastSeekTokenRef.current = seekTo.token;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seekTo.time;
    setCurrentTime(seekTo.time);
    onTimeUpdate?.(seekTo.time);
  }, [seekTo, onTimeUpdate]);

  const currentAyah: MatchedAyah | null = (() => {
    if (ayahs.length === 0) return null;
    let current: MatchedAyah | null = null;
    for (const ayah of ayahs) {
      const dispStart = ayah.displayStart ?? ayah.startTime;
      const dispEnd = ayah.displayEnd ?? ayah.endTime;
      if (currentTime >= dispStart && currentTime <= dispEnd) {
        current = ayah;
      }
    }
    return current;
  })();

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val === 0) { v.muted = true; setMuted(true); }
    else { v.muted = false; setMuted(false); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    v.currentTime = newTime;
    setCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const toArabicNumeral = (n: number | null): string => {
    if (n === null || n === undefined) return '';
    return n.toString().split('').map(d => String.fromCharCode(0x0660 + parseInt(d))).join('');
  };

  const renderArabic = (ayah: MatchedAyah, color: string) => {
    const dbWords = ayah.arabic.split(/\s+/).filter(Boolean);
    const wWords = ayah.words || [];

    if (!wordHighlight) {
      return (
        <span style={{ color, textShadow: getAdaptiveShadow(color) }}>
          {ayah.arabic}
        </span>
      );
    }

    if (wWords.length === 0) {
      const total = ayah.endTime - ayah.startTime;
      const elapsed = currentTime - ayah.startTime;
      const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
      const activeIdx = Math.min(
        Math.floor(progress * dbWords.length),
        Math.max(0, dbWords.length - 1)
      );

      return (
        <span>
          {dbWords.map((word, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 3px',
                color: i === activeIdx ? '#34d399' : color,
                opacity: i < activeIdx ? 1 : i === activeIdx ? 1 : 0.3,
                textShadow:
                  i === activeIdx
                    ? `0 0 18px rgba(52,211,153,0.8), ${getAdaptiveShadow(color)}`
                    : getAdaptiveShadow(color),
                transition: 'opacity 0.1s, color 0.1s',
              }}
            >
              {word}
            </span>
          ))}
        </span>
      );
    }

    return (
      <span>
        {dbWords.map((word, i) => {
          const wIdx = Math.min(i, wWords.length - 1);
          const w = wWords[wIdx];
          const isActive = currentTime >= w.start && currentTime <= w.end;
          const isPast = currentTime > w.end;

          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 3px',
                color: isActive ? '#34d399' : color,
                opacity: isPast ? 1 : isActive ? 1 : 0.3,
                textShadow: isActive
                  ? `0 0 20px rgba(52,211,153,0.9), ${getAdaptiveShadow(color)}`
                  : getAdaptiveShadow(color),
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'opacity 0.08s, color 0.08s, transform 0.08s',
              }}
            >
              {word}
            </span>
          );
        })}
      </span>
    );
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    switch (background.type) {
      case 'color': return { backgroundColor: background.value };
      case 'gradient': return { background: `linear-gradient(135deg, ${background.from}, ${background.to})` };
      case 'image': return { backgroundImage: `url(${background.url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      default: return { backgroundColor: '#0a0a1a' };
    }
  };

  const visible = currentAyah !== null;

  const globalStyle: GlobalTextStyle = {
    textAnimation,
    arabicFontSize,
    englishFontSize,
    arabicLineHeight,
    englishLineHeight,
    arabicPadding,
    englishPadding,
    textColor,
  };

  const activeStyle = currentAyah
    ? resolveAyahStyle(currentAyah.style, globalStyle)
    : globalStyle;

  const renderColor = activeStyle.textColor;

  const defaultArabicPos: TextPosition = { x: 50, y: verticalPosition === 'center' ? 42 : 72 };
  const defaultEnglishPos: TextPosition = { x: 50, y: verticalPosition === 'center' ? 58 : 86 };

  const arabicPos = arabicPosition ?? defaultArabicPos;
  const englishPos = englishPosition ?? defaultEnglishPos;

  const applyTransform = (target: 'arabic' | 'english', xPct: number, yPct: number) => {
    const el = target === 'arabic' ? arabicElRef.current : englishElRef.current;
    if (el) {
      el.style.left = `${xPct}%`;
      el.style.top = `${yPct}%`;
    }
  };

  const startDrag = (target: 'arabic' | 'english') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = target === 'arabic' ? arabicPos : englishPos;
    dragRef.current = {
      target,
      origX: pos.x,
      origY: pos.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      liveX: pos.x,
      liveY: pos.y,
    };
    hasDraggedRef.current = false;
    setDraggingTarget(target);
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const handleDragMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    const deltaXPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const deltaYPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

    if (Math.abs(deltaXPct) > 0.3 || Math.abs(deltaYPct) > 0.3) {
      hasDraggedRef.current = true;
    }

    let newX = Math.min(96, Math.max(4, drag.origX + deltaXPct));
    let newY = Math.min(96, Math.max(4, drag.origY + deltaYPct));

    const snappedX = Math.abs(newX - 50) < SNAP_THRESHOLD;
    const snappedY = Math.abs(newY - 50) < SNAP_THRESHOLD;
    if (snappedX) newX = 50;
    if (snappedY) newY = 50;

    drag.liveX = newX;
    drag.liveY = newY;

    applyTransform(drag.target, newX, newY);

    setSnapGuides({ x: snappedX, y: snappedY });
  }, []);

  const stopDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag) {
      if (drag.target === 'arabic') onArabicPositionChange?.({ x: drag.liveX, y: drag.liveY });
      else onEnglishPositionChange?.({ x: drag.liveX, y: drag.liveY });
    }
    dragRef.current = null;
    setDraggingTarget(null);
    setSnapGuides({ x: false, y: false });
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [handleDragMove, onArabicPositionChange, onEnglishPositionChange]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [handleDragMove, stopDrag]);

  const handleContainerClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    togglePlay();
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const ayahLabel = currentAyah
    ? currentAyah.ayahNumber === 0
      ? 'Bismillah'
      : currentAyah.isFullAyah && currentAyah.ayahNumber
        ? `${currentAyah.surahEnglishName} ${currentAyah.surah}:${currentAyah.ayahNumber}`
        : currentAyah.surahEnglishName
          ? `${currentAyah.surahEnglishName} (partial)`
          : 'Recitation'
    : 'Press play to preview';

  const surahLabelText = (() => {
    if (!currentAyah || !showSurahLabel) return '';
    const ar = currentAyah.surahName || '';
    const en = currentAyah.surahEnglishName || '';
    const ayahNum = currentAyah.isFullAyah && currentAyah.ayahNumber ? currentAyah.ayahNumber : null;

    if (surahLabelLang === 'arabic') {
      if (!ar) return '';
      return ayahNum ? `${ar} ${toArabicNumeral(ayahNum)}` : ar;
    }
    if (surahLabelLang === 'english') {
      if (!en) return '';
      return ayahNum ? `${en} · ${currentAyah.surah}:${ayahNum}` : en;
    }
    const parts = [en, ar].filter(Boolean);
    if (parts.length === 0) return '';
    return ayahNum ? `${parts.join(' · ')} · ${ayahNum}` : parts.join(' · ');
  })();

  const animClass = activeStyle.textAnimation === 'none'
    ? ''
    : `ayahclip-anim-${activeStyle.textAnimation}`;

  return (
    <div className="space-y-2">
      <style>{`
        @keyframes ayahclip-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ayahclip-slide-up-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes ayahclip-scale-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        .ayahclip-anim-fade { animation: ayahclip-fade-in 0.35s ease both; }
        .ayahclip-anim-slide-up { animation: ayahclip-slide-up-in 0.35s ease both; }
        .ayahclip-anim-scale { animation: ayahclip-scale-in 0.35s ease both; }
      `}</style>

      <div className={ASPECT_CONTAINER_CLASS[aspectRatio]}>
        <div
          ref={containerRef}
          className="relative rounded-md overflow-hidden bg-black border border-zinc-200 group"
          style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] }}
          onMouseMove={resetControlsTimer}
          onMouseEnter={resetControlsTimer}
          onClick={handleContainerClick}
        >
          <div className="absolute inset-0" style={getBackgroundStyle()}>
            {background.type === 'image' && (
              <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
            )}
            {background.type === 'video' && (
              <>
                <video ref={bgVideoRef} src={background.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay loop muted playsInline />
                <div className="absolute inset-0 backdrop-blur-md bg-black/50" />
              </>
            )}
          </div>

          {background.type === 'video' || isAudioOnly
            ? <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
            : <video ref={videoRef} src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: videoOpacity }} playsInline />
          }

          {overlayType === 'full' && (
            <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: overlayOpacity }} />
          )}
          {overlayType === 'bottom' && (
            <div className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none"
              style={{ background: `linear-gradient(to top, rgba(0,0,0,${overlayOpacity}) 0%, rgba(0,0,0,${overlayOpacity * 0.6}) 50%, transparent 100%)` }} />
          )}

          {draggingTarget && snapGuides.x && (
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-400 pointer-events-none z-40 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          )}
          {draggingTarget && snapGuides.y && (
            <div className="absolute left-0 right-0 top-1/2 h-px bg-emerald-400 pointer-events-none z-40 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          )}

          {currentAyah && (
            <div
              key={`ar-${currentAyah.startTime}`}
              ref={arabicElRef}
              onPointerDown={startDrag('arabic')}
              className={`absolute cursor-grab active:cursor-grabbing select-none ${animClass}`}
              style={{
                left: `${arabicPos.x}%`,
                top: `${arabicPos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 'min(92%, 900px)',
                padding: `${activeStyle.arabicPadding}px`,
                touchAction: 'none',
                outline: draggingTarget === 'arabic' ? '1px dashed rgba(255,255,255,0.6)' : 'none',
                outlineOffset: '6px',
              }}
            >
              <div style={{
                fontFamily: `"${arabicFont}", serif`,
                fontSize: `${activeStyle.arabicFontSize}px`,
                lineHeight: activeStyle.arabicLineHeight,
                direction: 'rtl',
                textAlign: arabicAlign,
                wordBreak: 'break-word',
              }}>
                {renderArabic(currentAyah, renderColor)}

                {currentAyah.isFullAyah && currentAyah.ayahNumber !== null && currentAyah.ayahNumber !== 0 && (
                  <span style={{
                    display: 'inline-block',
                    marginRight: '8px',
                    position: 'relative',
                    verticalAlign: 'middle',
                    lineHeight: 1,
                  }}>
                    <span style={{
                      fontSize: `${activeStyle.arabicFontSize * 1.1}px`,
                      color: renderColor,
                      opacity: 0.85,
                      textShadow: `0 0 16px rgba(52,211,153,0.5), ${getAdaptiveShadow(renderColor)}`,
                      fontFamily: `"Scheherazade New", "Amiri", serif`,
                    }}>
                      ۝
                    </span>
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${Math.max(10, activeStyle.arabicFontSize * 0.32)}px`,
                      color: renderColor,
                      fontFamily: `"Scheherazade New", "Amiri", serif`,
                      pointerEvents: 'none',
                      lineHeight: 1,
                      marginTop: '1px',
                    }}>
                      {toArabicNumeral(currentAyah.ayahNumber)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          {currentAyah && (showTranslation || surahLabelText) && (
            <div
              key={`en-${currentAyah.startTime}`}
              ref={englishElRef}
              onPointerDown={startDrag('english')}
              className={`absolute cursor-grab active:cursor-grabbing select-none ${animClass}`}
              style={{
                left: `${englishPos.x}%`,
                top: `${englishPos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 'min(90%, 800px)',
                padding: `${activeStyle.englishPadding}px`,
                touchAction: 'none',
                outline: draggingTarget === 'english' ? '1px dashed rgba(255,255,255,0.6)' : 'none',
                outlineOffset: '6px',
              }}
            >
              {showTranslation && currentAyah.translation && (
                <p style={{
                  color: renderColor, opacity: 0.9,
                  fontFamily: `"${englishFont}", sans-serif`,
                  fontSize: `${activeStyle.englishFontSize}px`,
                  textAlign: englishAlign,
                  lineHeight: activeStyle.englishLineHeight,
                  textShadow: getAdaptiveShadow(renderColor),
                  margin: 0,
                }}>
                  {currentAyah.translation}
                </p>
              )}

              {surahLabelText && (
                <p style={{
                  color: renderColor, opacity: 0.45,
                  fontFamily: `"${englishFont}", sans-serif`,
                  fontSize: '11px',
                  textAlign: englishAlign,
                  letterSpacing: '0.08em',
                  textTransform: surahLabelLang === 'arabic' ? 'none' : 'uppercase',
                  direction: surahLabelLang === 'arabic' ? 'rtl' : 'ltr',
                  margin: showTranslation ? '8px 0 0' : 0,
                }}>
                  {surahLabelText}
                </p>
              )}
            </div>
          )}

          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          )}

          <div
            className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-3 pb-1">
              <div className="relative h-1 group/seek">
                <input
                  type="range" min="0" max="100" step="0.01" value={progressPercent}
                  onChange={handleSeek}
                  onMouseDown={() => setSeeking(true)}
                  onMouseUp={() => setSeeking(false)}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-4 -top-1.5 z-10"
                />
                <div className="absolute inset-0 bg-white/20 rounded-full" />
                <div className="absolute left-0 top-0 bottom-0 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{ width: `${progressPercent}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-lg"
                  style={{ left: `calc(${progressPercent}% - 6px)` }} />
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 pb-3 pt-1">
              <button onClick={togglePlay} className="text-white hover:text-emerald-400 transition-colors flex-shrink-0">
                {playing
                  ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                }
              </button>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={toggleMute} className="text-white hover:text-emerald-400 transition-colors">
                  {muted || volume === 0
                    ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                    : volume < 0.5
                      ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                      </svg>
                      : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                  }
                </button>
                <input type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 h-1 accent-emerald-400 cursor-pointer" />
              </div>

              <span className="text-white/70 text-xs font-mono flex-shrink-0">
                {formatTime(currentTime)}{duration ? ` / ${formatTime(duration)}` : ''}
              </span>

              <div className="flex-1" />

              {currentAyah && (
                <span className="text-white/50 text-xs truncate hidden sm:block">{ayahLabel}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 text-center">
        Drag the Arabic or translation text to reposition it. It snaps to center automatically.
      </p>
    </div>
  );
}