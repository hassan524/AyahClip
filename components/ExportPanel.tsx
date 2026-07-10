'use client';

import { useRef, useState, useEffect } from 'react';
import { BackgroundConfig, MatchedAyah } from '@/app/page';
import { GlobalTextStyle } from '@/lib/ayah-styles';
import { HADITH_QUOTES } from '@/lib/export-quotes';
import { CANVAS_SIZE, drawExportFrame } from '@/lib/export-render';
import { convertWebmToMp4, pickMimeType, preloadFfmpeg } from '@/lib/webm-to-mp4';
import type { AspectRatio, SurahLabelLang, TextPosition } from '@/components/VideoPreview';

type ExportPhase = 'working' | 'done' | 'error';

interface Props {
  videoFile: File;
  videoUrl: string;
  isAudioOnly?: boolean;
  ayahs: MatchedAyah[];
  background: BackgroundConfig;
  textColor: string;
  showTranslation: boolean;
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
  textAnimation?: GlobalTextStyle['textAnimation'];
  arabicLineHeight?: number;
  englishLineHeight?: number;
  arabicPadding?: number;
  englishPadding?: number;
  wordHighlight?: boolean;
  aspectRatio?: AspectRatio;
  arabicPosition?: TextPosition | null;
  englishPosition?: TextPosition | null;
  showSurahLabel?: boolean;
  surahLabelLang?: SurahLabelLang;
  surahLabelFontSize?: number;
  onBack: () => void;
}

export default function ExportPanel({
  videoUrl, isAudioOnly = false, ayahs, background, textColor, showTranslation,
  videoOpacity, overlayType, overlayOpacity, arabicFont, englishFont,
  arabicAlign, englishAlign, verticalPosition, arabicFontSize, englishFontSize,
  textAnimation = 'fade',
  arabicLineHeight = 1.75,
  englishLineHeight = 1.6,
  arabicPadding = 0,
  englishPadding = 0,
  wordHighlight = false,
  aspectRatio = '9:16',
  arabicPosition = null,
  englishPosition = null,
  showSurahLabel = true,
  surahLabelLang = 'english',
  surahLabelFontSize = 16,
  onBack,
}: Props) {
  const globalTextStyle: GlobalTextStyle = {
    textAnimation,
    arabicFontSize,
    englishFontSize,
    arabicLineHeight,
    englishLineHeight,
    arabicPadding,
    englishPadding,
    textColor,
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafIdRef = useRef<number>(0);
  const exportGenRef = useRef(0);
  const downloadUrlRef = useRef<string>('');

  const [phase, setPhase] = useState<ExportPhase>('working');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [exportError, setExportError] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * HADITH_QUOTES.length));

  const hadith = HADITH_QUOTES[quoteIndex % HADITH_QUOTES.length];

  useEffect(() => {
    if (phase !== 'working') return;
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % HADITH_QUOTES.length);
    }, 12000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const gen = ++exportGenRef.current;
    startExport(gen);
    return () => {
      exportGenRef.current++;
      cancelAnimationFrame(rafIdRef.current);
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch { /* ignore */ }
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startExport = async (gen: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    setPhase('working');
    setExportError('');
    setProgress(0);
    chunksRef.current = [];

    const { mimeType, needsConversion } = pickMimeType();
    if (needsConversion) preloadFfmpeg();

    try {
      const { width, height } = CANVAS_SIZE[aspectRatio];
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      const canvasStream = canvas.captureStream(30);

      video.currentTime = 0;
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) resolve();
        else {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load media'));
        }
      });

      const captureVideo = video as HTMLVideoElement & {
        captureStream(frameRate?: number): MediaStream;
      };
      const mediaStream = captureVideo.captureStream(30);
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }

      // Mute speakers — audio still records via captureStream track
      video.muted = true;
      video.volume = 0;

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      mediaRecorderRef.current = recorder;
      let stopped = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (gen !== exportGenRef.current) return;
        setProgress(96);

        try {
          let finalBlob: Blob;
          let ext = 'mp4';

          if (needsConversion) {
            const webmBlob = new Blob(chunksRef.current, { type: 'video/webm' });
            finalBlob = await convertWebmToMp4(webmBlob);
          } else {
            finalBlob = new Blob(chunksRef.current, { type: mimeType });
            ext = 'mp4';
          }

          if (gen !== exportGenRef.current) return;

          if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
          const url = URL.createObjectURL(finalBlob);
          downloadUrlRef.current = url;
          setDownloadUrl(url);
          setProgress(100);
          setPhase('done');
        } catch (err: unknown) {
          if (gen !== exportGenRef.current) return;
          setExportError(err instanceof Error ? err.message : 'Export failed');
          setPhase('error');
        }
      };

      if (background.type === 'video' && bgVideoRef.current) {
        bgVideoRef.current.src = background.url;
        bgVideoRef.current.muted = true;
        bgVideoRef.current.loop = true;
        await bgVideoRef.current.play();
      }

      if (background.type === 'image' && bgImageRef.current) {
        bgImageRef.current.src = background.url;
        await new Promise<void>((r) => { bgImageRef.current!.onload = () => r(); });
      }

      recorder.start(200);
      video.currentTime = 0;
      await video.play();

      const drawOpts = {
        ayahs,
        background,
        isAudioOnly,
        videoOpacity,
        overlayType,
        overlayOpacity,
        showTranslation,
        arabicFont,
        englishFont,
        arabicAlign,
        englishAlign,
        verticalPosition,
        wordHighlight,
        globalTextStyle,
        arabicPosition,
        englishPosition,
        showSurahLabel,
        surahLabelLang,
        surahLabelFontSize,
        videoEl: video,
        bgVideoEl: bgVideoRef.current,
        bgImageEl: bgImageRef.current,
      };

      const stopRecording = () => {
        if (stopped || gen !== exportGenRef.current) return;
        stopped = true;
        cancelAnimationFrame(rafIdRef.current);
        setProgress(92);
        try { recorder.stop(); } catch { /* ignore */ }
        video.pause();
        bgVideoRef.current?.pause();
      };

      const render = () => {
        if (gen !== exportGenRef.current) return;
        if (!video.paused && !video.ended) {
          drawExportFrame(ctx, canvas, video.currentTime, drawOpts);
          const perc = video.duration
            ? Math.round((video.currentTime / video.duration) * 90)
            : 0;
          setProgress(perc);
          rafIdRef.current = requestAnimationFrame(render);
        } else {
          stopRecording();
        }
      };

      video.onended = stopRecording;
      rafIdRef.current = requestAnimationFrame(render);
    } catch (e: unknown) {
      if (gen !== exportGenRef.current) return;
      setExportError(e instanceof Error ? e.message : 'Export failed');
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <video ref={videoRef} src={videoUrl} className="hidden" playsInline muted />
      <video ref={bgVideoRef} className="hidden" playsInline muted loop />
      <img ref={bgImageRef} className="hidden" alt="" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={onBack}
          disabled={phase === 'working'}
          className="text-sm text-zinc-500 hover:text-white transition-colors disabled:opacity-30"
        >
          ← Back
        </button>
        {phase === 'working' && (
          <span className="text-sm text-zinc-400 tabular-nums">{progress}%</span>
        )}
      </div>

      {/* Progress bar */}
      {phase === 'working' && (
        <div className="px-5">
          <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 pb-16 max-w-xl mx-auto w-full">

        {exportError && (
          <div className="text-center space-y-4">
            <p className="text-red-400 text-sm">{exportError}</p>
            <button
              onClick={() => startExport(++exportGenRef.current)}
              className="text-sm text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'working' && !exportError && (
          <div key={quoteIndex} className="text-center space-y-6 w-full">
            <p
              className="text-xl sm:text-2xl leading-loose text-white"
              dir="rtl"
              style={{ fontFamily: '"Scheherazade New", "Amiri", serif' }}
            >
              {hadith.text}
            </p>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              {hadith.translation}
            </p>
            <p className="text-zinc-600 text-xs">— {hadith.source}</p>
          </div>
        )}

        {phase === 'done' && downloadUrl && (
          <div className="text-center space-y-6 w-full">
            <p className="text-white text-lg font-medium">Done</p>
            <a
              href={downloadUrl}
              download={`ayahclip-${Date.now()}.mp4`}
              className="block w-full py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Download MP4
            </a>
            <button
              onClick={onBack}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Back to edit
            </button>
          </div>
        )}
      </div>

      {phase === 'working' && !exportError && (
        <p className="text-center text-zinc-700 text-xs pb-6">
          Keep this tab open
        </p>
      )}
    </div>
  );
}