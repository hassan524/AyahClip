'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { BackgroundConfig, MatchedAyah } from '@/app/page';

interface Props {
  videoUrl: string;
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
}

export default function VideoPreview({
  videoUrl, ayahs, background, textColor, showTranslation, duration,
  videoOpacity, overlayType, overlayOpacity, arabicFont, englishFont,
  arabicAlign, englishAlign, verticalPosition, arabicFontSize, englishFontSize,
  wordHighlight = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const rafRef = useRef<number>(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setPlaying(true); rafRef.current = requestAnimationFrame(tick); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(rafRef.current); setCurrentTime(video.currentTime); };
    const onSeeked = () => setCurrentTime(video.currentTime);
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
  }, [tick]);

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
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const toArabicNumeral = (n: number | null): string => {
    if (n === null || n === undefined) return '';
    return n.toString().split('').map(d => String.fromCharCode(0x0660 + parseInt(d))).join('');
  };

  const renderArabic = (ayah: MatchedAyah) => {
    const dbWords = ayah.arabic.split(/\s+/).filter(Boolean);
    const wWords = ayah.words || [];

    if (!wordHighlight) {
      return (
        <span style={{ color: textColor, textShadow: '0 2px 8px rgba(0,0,0,1)' }}>
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
                color: i === activeIdx ? '#34d399' : textColor,
                opacity: i < activeIdx ? 1 : i === activeIdx ? 1 : 0.3,
                textShadow:
                  i === activeIdx
                    ? '0 0 18px rgba(52,211,153,0.8), 0 2px 8px rgba(0,0,0,1)'
                    : '0 2px 8px rgba(0,0,0,1)',
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
                color: isActive ? '#34d399' : textColor,
                opacity: isPast ? 1 : isActive ? 1 : 0.3,
                textShadow: isActive
                  ? '0 0 20px rgba(52,211,153,0.9), 0 2px 8px rgba(0,0,0,1)'
                  : '0 2px 8px rgba(0,0,0,1)',
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

  const getTextContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute', left: 0, right: 0,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      padding: verticalPosition === 'bottom' ? '16px 24px 64px' : '16px 24px',
      pointerEvents: 'none',
    };
    if (verticalPosition === 'center') {
      return { ...base, top: '50%', transform: visible ? 'translateY(-50%)' : 'translateY(-46%)' };
    }
    return { ...base, bottom: 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' };
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

  const overlayLabel = currentAyah
    ? currentAyah.ayahNumber === 0
      ? 'Bismillah'
      : currentAyah.isFullAyah && currentAyah.ayahNumber
        ? `${currentAyah.surahEnglishName} · ${currentAyah.surah}:${currentAyah.ayahNumber}`
        : currentAyah.surahEnglishName
          ? `${currentAyah.surahEnglishName} · partial`
          : ''
    : '';

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-2xl overflow-hidden aspect-video bg-black shadow-2xl border border-white/5 group"
        onMouseMove={resetControlsTimer}
        onMouseEnter={resetControlsTimer}
        onClick={togglePlay}
      >
        {/* Background layer */}
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

        {/* Main video */}
        {background.type === 'video'
          ? <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
          : <video ref={videoRef} src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: videoOpacity }} playsInline />
        }

        {/* Overlays */}
        {overlayType === 'full' && (
          <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: overlayOpacity }} />
        )}
        {overlayType === 'bottom' && (
          <div className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none"
            style={{ background: `linear-gradient(to top, rgba(0,0,0,${overlayOpacity}) 0%, rgba(0,0,0,${overlayOpacity * 0.6}) 50%, transparent 100%)` }} />
        )}

        {/* Arabic + translation text */}
        <div style={getTextContainerStyle()}>
          {currentAyah && (
            <>
              <div style={{
                fontFamily: `"${arabicFont}", serif`,
                fontSize: `${arabicFontSize}px`,
                lineHeight: 1.75,
                direction: 'rtl',
                textAlign: arabicAlign,
                marginBottom: '12px',
                maxWidth: 'min(92%, 900px)',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as any,
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}>

                {renderArabic(currentAyah)}

                {currentAyah.isFullAyah && currentAyah.ayahNumber !== null && currentAyah.ayahNumber !== 0 && (
                  <span style={{
                    display: 'inline-block',
                    marginRight: '8px',
                    position: 'relative',
                    verticalAlign: 'middle',
                    lineHeight: 1,
                  }}>
                    <span style={{
                      fontSize: `${arabicFontSize * 1.1}px`,
                      color: textColor,
                      opacity: 0.85,
                      textShadow: `0 0 16px rgba(52,211,153,0.5), 0 2px 8px rgba(0,0,0,1)`,
                      fontFamily: `"Scheherazade New", "Amiri", serif`,
                    }}>
                      ۝
                    </span>
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${Math.max(10, arabicFontSize * 0.32)}px`,
                      color: textColor,
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

              {showTranslation && currentAyah.translation && (
                <div style={{
                  width: '40px', height: '1px',
                  backgroundColor: textColor, opacity: 0.25,
                  marginBottom: '10px',
                  marginLeft: englishAlign === 'left' ? 0 : 'auto',
                  marginRight: englishAlign === 'left' ? 'auto' : 0,
                }} />
              )}

              {showTranslation && currentAyah.translation && (
                <p style={{
                  color: textColor, opacity: 0.88,
                  fontFamily: `"${englishFont}", sans-serif`,
                  fontSize: `${englishFontSize}px`,
                  textAlign: englishAlign,
                  lineHeight: 1.6,
                  textShadow: '0 1px 6px rgba(0,0,0,0.95)',
                  margin: 0,
                }}>
                  {currentAyah.translation}
                </p>
              )}

              {overlayLabel && (
                <p style={{
                  color: textColor, opacity: 0.4,
                  fontFamily: `"${englishFont}", sans-serif`,
                  fontSize: '11px',
                  textAlign: englishAlign,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: '8px 0 0',
                }}>
                  {overlayLabel}
                </p>
              )}
            </>
          )}
        </div>

        {/* Center play/pause icon */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Controls bar */}
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

      <div className="flex items-center justify-between px-1 sm:hidden">
        <p className="text-xs text-white/30 truncate">{ayahLabel}</p>
        <p className="text-xs text-white/20 font-mono flex-shrink-0 ml-2">
          {formatTime(currentTime)}{duration ? ` / ${formatTime(duration)}` : ''}
        </p>
      </div>
    </div>
  );
}