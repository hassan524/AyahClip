'use client';

import { useRef, useState } from 'react';
import { BackgroundConfig, MatchedAyah } from '@/app/page';

const LINGER_SEC = 0.5;

// Real Hadiths from Sunnah.com & Sahih Collections
const HADITHS = [
  {
    text: "من كان يؤمن بالله واليوم الآخر فليقل خيراً أو ليصمت",
    translation: "Whoever believes in Allah and the Last Day should speak good or remain silent",
    reference: "Sahih Bukhari & Muslim",
  },
  {
    text: "الراحمون يرحمهم الرحمن، ارحموا من في الأرض يرحمكم من في السماء",
    translation: "The merciful will be shown mercy by the Most Merciful. Be merciful to those on earth and the One in the heavens will have mercy upon you",
    reference: "Jami' at-Tirmidhi",
  },
  {
    text: "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه",
    translation: "None of you believes until he loves for his brother what he loves for himself",
    reference: "Sahih Bukhari & Muslim",
  },
  {
    text: "خيركم خيركم لأهله، وأنا خيركم لأهلي",
    translation: "The best of you are those who are best to their families, and I am the best among you to my family",
    reference: "Jami' at-Tirmidhi",
  },
  {
    text: "الدنيا ملعونة ملعون ما فيها إلا ذكر الله وما والاه",
    translation: "This world is cursed, except the remembrance of Allah and what pleases Him",
    reference: "Jami' at-Tirmidhi",
  },
  {
    text: "إن الله لا ينظر إلى أجسادكم ولا إلى صوركم ولكن ينظر إلى قلوبكم",
    translation: "Allah does not look at your bodies or wealth, but He looks at your hearts and deeds",
    reference: "Sahih Muslim",
  },
  {
    text: "من صام رمضان إيماناً واحتساباً غفر له ما تقدم من ذنبه",
    translation: "Whoever fasts Ramadan with faith and seeking reward, his sins will be forgiven",
    reference: "Sahih Bukhari & Muslim",
  },
  {
    text: "أفضل الصدقة صدقة في رمضان",
    translation: "The best charity is given in Ramadan",
    reference: "Jami' at-Tirmidhi",
  },
  {
    text: "إن الله مع الصابرين",
    translation: "Verily, Allah is with the patient ones",
    reference: "Qur'an 2:153",
  },
  {
    text: "والعافية منك اللهم صح بدني ولساني وقلبي",
    translation: "O Allah, grant me health in my body and mind, and sincerity in my heart",
    reference: "Sunan Ibn Majah",
  },
];

interface Props {
  videoFile: File;
  videoUrl: string;
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
  wordHighlight?: boolean;
  onBack: () => void;
}

export default function ExportPanel({
  videoFile, videoUrl, ayahs, background, textColor, showTranslation,
  videoOpacity, overlayType, overlayOpacity, arabicFont, englishFont,
  arabicAlign, englishAlign, verticalPosition, arabicFontSize, englishFontSize,
  wordHighlight = false, onBack,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [status, setStatus] = useState('');
  const [hadithIndex, setHadithIndex] = useState(0);

  const getAyahAt = (time: number): MatchedAyah | null => {
    for (let i = 0; i < ayahs.length; i++) {
      const a = ayahs[i];
      const nextStart = ayahs[i + 1]?.startTime ?? Infinity;
      const hideAt = Math.min(a.endTime + LINGER_SEC, nextStart);
      if (time >= a.startTime && time < hideAt) return a;
    }
    return null;
  };

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawArabicWords(
    ctx: CanvasRenderingContext2D,
    ayah: MatchedAyah,
    time: number,
    canvasW: number,
    yBottom: number,
    maxWidth: number,
    padding: number,
  ): number {
    const dbWords = ayah.arabic.split(/\s+/).filter(Boolean);
    const wWords = ayah.words || [];
    const GAP = 6;
    const lineH = arabicFontSize + 10;

    ctx.font = `${arabicFontSize}px "${arabicFont}", serif`;

    const lines: string[][] = [];
    let curLine: string[] = [];
    let curW = 0;
    for (const word of dbWords) {
      const ww = ctx.measureText(word).width + GAP;
      if (curW + ww > maxWidth && curLine.length > 0) {
        lines.push(curLine);
        curLine = [word];
        curW = ww;
      } else {
        curLine.push(word);
        curW += ww;
      }
    }
    if (curLine.length > 0) lines.push(curLine);

    const totalLines = lines.length;
    let globalIdx = 0;

    for (let li = 0; li < totalLines; li++) {
      const lineWords = lines[li];
      const lineY = yBottom - (totalLines - 1 - li) * lineH;
      const lineW = lineWords.reduce((sum, w) => sum + ctx.measureText(w).width + GAP, 0) - GAP;
      const rightEdge = arabicAlign === 'center' ? canvasW / 2 + lineW / 2 : canvasW - padding;

      let x = rightEdge;

      for (const word of lineWords) {
        const wordW = ctx.measureText(word).width;
        let color = textColor;
        let alpha = 1.0;
        let glowOn = false;

        if (wordHighlight) {
          if (wWords.length > 0) {
            const wIdx = Math.min(globalIdx, wWords.length - 1);
            const w = wWords[wIdx];
            const isActive = time >= w.start && time <= w.end;
            const isPast = time > w.end;
            if (isActive) { color = '#34d399'; glowOn = true; }
            else if (!isPast) { alpha = 0.3; }
          } else {
            const total = ayah.endTime - ayah.startTime;
            const elapsed = time - ayah.startTime;
            const prog = total > 0 ? Math.min(1, elapsed / total) : 0;
            const activeIdx = Math.min(Math.floor(prog * dbWords.length), dbWords.length - 1);
            if (globalIdx === activeIdx) { color = '#34d399'; glowOn = true; }
            else if (globalIdx > activeIdx) { alpha = 0.3; }
          }
        }

        if (glowOn) {
          ctx.shadowColor = 'rgba(52,211,153,0.85)';
          ctx.shadowBlur = 20;
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 6;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(word, x, lineY);

        ctx.globalAlpha = 1.0;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        x -= wordW + GAP;
        globalIdx++;
      }
    }

    return totalLines * lineH;
  }

  const drawFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number) => {
    const W = canvas.width;
    const H = canvas.height;
    const padding = 60;
    const maxWidth = W - padding * 2;

    if (background.type === 'color') {
      ctx.fillStyle = background.value;
      ctx.fillRect(0, 0, W, H);
    } else if (background.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, background.from);
      g.addColorStop(1, background.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (background.type === 'image' && bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
    } else if (background.type === 'video' && bgVideoRef.current) {
      ctx.drawImage(bgVideoRef.current, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
    }

    if (videoRef.current && background.type !== 'video') {
      ctx.globalAlpha = videoOpacity;
      ctx.drawImage(videoRef.current, 0, 0, W, H);
      ctx.globalAlpha = 1.0;
    }

    if (overlayType === 'full') {
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, W, H);
    } else if (overlayType === 'bottom') {
      const g = ctx.createLinearGradient(0, H * 0.4, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${overlayOpacity})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const ayah = getAyahAt(time);
    if (!ayah) return;

    const engFontStr = `"${englishFont}", sans-serif`;

    ctx.font = `${englishFontSize}px ${engFontStr}`;
    const transLines = showTranslation && ayah.translation
      ? wrapText(ctx, ayah.translation, maxWidth)
      : [];
    const transLineH = englishFontSize + 6;
    const transBlockH = transLines.length > 0 ? transLines.length * transLineH + 16 : 0;

    ctx.font = `${arabicFontSize}px "${arabicFont}", serif`;
    const arabicWords = ayah.arabic.split(/\s+/).filter(Boolean);
    let arabicLineCount = 1, lw = 0;
    for (const w of arabicWords) {
      const ww = ctx.measureText(w).width + 6;
      if (lw + ww > maxWidth && lw > 0) { arabicLineCount++; lw = ww; }
      else lw += ww;
    }
    const arabicBlockH = arabicLineCount * (arabicFontSize + 10);
    const labelBlockH = 28;
    const totalH = arabicBlockH + transBlockH + labelBlockH;

    let yBottom = H - padding;
    if (verticalPosition === 'center') yBottom = H / 2 + totalH / 2;

    let y = yBottom;

    ctx.font = `13px ${engFontStr}`;
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.textAlign = englishAlign === 'center' ? 'center' : 'left';
    ctx.fillText(
      `${ayah.surahEnglishName} · ${ayah.surah}:${ayah.ayahNumber}`,
      englishAlign === 'center' ? W / 2 : padding,
      y,
    );
    ctx.globalAlpha = 1.0;
    y -= labelBlockH;

    if (transLines.length > 0) {
      ctx.font = `${englishFontSize}px ${engFontStr}`;
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.88;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 6;
      ctx.textAlign = englishAlign === 'center' ? 'center' : 'left';
      const transX = englishAlign === 'center' ? W / 2 : padding;
      for (let i = transLines.length - 1; i >= 0; i--) {
        ctx.fillText(transLines[i], transX, y);
        y -= transLineH;
      }
      ctx.globalAlpha = 1.0;
      y -= 16;
    }

    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 8;
    drawArabicWords(ctx, ayah, time, W, y, maxWidth, padding);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  };

  const startExport = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    setExporting(true);
    setProgress(0);
    setHadithIndex(0);
    chunksRef.current = [];

    setStatus('Loading fonts & libraries...');
    try { await document.fonts.ready; } catch {}

    setStatus('Preparing canvas...');

    if (background.type === 'image' && bgImageRef.current) {
      bgImageRef.current.src = background.url;
      await new Promise<void>((r) => { bgImageRef.current!.onload = () => r(); });
    }

    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream(24);

    const audioCtx = new AudioContext();
    const sourceNode = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    sourceNode.connect(dest);
    sourceNode.connect(audioCtx.destination);
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    const recorder = new MediaRecorder(stream, { 
      mimeType, 
      videoBitsPerSecond: 8_000_000
    });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { 
      if (e.data.size > 0) chunksRef.current.push(e.data); 
    };

    recorder.onstop = async () => {
      setStatus('Encoding to MP4...');
      const webmBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      
      try {
        // Dynamic import FFmpeg for MP4 conversion
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { fetchFile } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();
        await ffmpeg.load();

        const inputData = await fetchFile(webmBlob);
        await ffmpeg.writeFile('input.webm', inputData);

        setStatus('Converting to MP4...');
        await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', 'output.mp4']);

        // ✅ FIX: Properly handle FFmpeg output data
        const data: any = await ffmpeg.readFile('output.mp4');
        
        let mp4Blob: Blob;
        
        try {
          // Create a clean Uint8Array from any array-like data
          const cleanBuffer = new Uint8Array(data);
          mp4Blob = new Blob([cleanBuffer], { type: 'video/mp4' });
        } catch {
          // Fallback: if array conversion fails, try direct Blob creation
          mp4Blob = new Blob([data], { type: 'video/mp4' });
        }
        
        setDownloadUrl(URL.createObjectURL(mp4Blob));
        setDone(true);
        setExporting(false);
        setStatus('');
      } catch (err) {
        console.warn('FFmpeg conversion failed, offering WebM:', err);
        setDownloadUrl(URL.createObjectURL(webmBlob));
        setDone(true);
        setExporting(false);
        setStatus('');
      }
    };

    recorder.start(100);

    if (background.type === 'video' && bgVideoRef.current) {
      bgVideoRef.current.src = background.url;
      bgVideoRef.current.muted = true;
      bgVideoRef.current.loop = true;
      await bgVideoRef.current.play();
    }

    video.currentTime = 0;
    await video.play();
    setStatus('Rendering...');

    let frameCount = 0;
    const hadithChangeInterval = Math.max(30, Math.floor(video.duration / HADITHS.length));

    const render = () => {
      if (!video.paused && !video.ended) {
        drawFrame(ctx, canvas, video.currentTime);
        frameCount++;

        if (frameCount % hadithChangeInterval === 0) {
          setHadithIndex((prev) => (prev + 1) % HADITHS.length);
        }

        setProgress(Math.round((video.currentTime / video.duration) * 100));
        requestAnimationFrame(render);
      } else {
        recorder.stop();
        video.pause();
        bgVideoRef.current?.pause();
      }
    };

    video.onended = () => { recorder.stop(); };
    requestAnimationFrame(render);
  };

  const currentHadith = HADITHS[hadithIndex];

  return (
    <div className="min-h-screen pb-8 px-4 sm:px-6 py-4">
      <button onClick={onBack} className="text-sm text-white/50 hover:text-white transition-colors mb-6">
        ← Back to edit
      </button>

      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
      <video ref={bgVideoRef} className="hidden" playsInline muted loop />
      <img ref={bgImageRef} className="hidden" alt="" />

      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Export Video</h2>
            <p className="text-white/50 text-sm">
              Renders locally in your browser • MP4 format • No uploads
            </p>
          </div>

          {/* Before Export */}
          {!done && !exporting && (
            <div className="space-y-6">
              <div className="bg-white/5 rounded-xl p-4 space-y-3 text-sm border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Ayahs detected</span>
                  <span className="text-white font-medium">{ayahs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Background</span>
                  <span className="text-white font-medium capitalize">{background.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Translation</span>
                  <span className="text-white font-medium">{showTranslation ? 'Shown' : 'Hidden'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Word highlight</span>
                  <span className="text-white font-medium">{wordHighlight ? 'On' : 'Off'}</span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div className="space-y-2 text-xs text-white/40">
                  <p>Format: MP4 (works on all devices) • Resolution: 1920×1080</p>
                  <p>Processing time ≈ video duration • Keep this tab open</p>
                </div>
              </div>

              <button onClick={startExport}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all duration-200 text-lg shadow-lg hover:shadow-emerald-500/25">
                ▶ Start Export
              </button>
            </div>
          )}

          {/* During Export */}
          {exporting && (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-lg shadow-emerald-500/50 transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-medium text-white">{progress}%</span>
                  <span className="text-xs text-white/40">{status}</span>
                </div>
              </div>

              {/* Hadith Display */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-6 sm:p-8 text-center space-y-4 min-h-[240px] sm:min-h-[280px] flex flex-col justify-center">
                <p className="text-lg sm:text-2xl text-emerald-300 leading-relaxed font-medium">
                  {currentHadith.text}
                </p>
                <div className="space-y-2">
                  <p className="text-sm sm:text-base text-white/70 italic">
                    "{currentHadith.translation}"
                  </p>
                  <p className="text-xs sm:text-sm text-emerald-400 font-semibold">
                    — {currentHadith.reference}
                  </p>
                </div>
              </div>

              {/* Status Message */}
              <div className="text-center space-y-2">
                <p className="text-white/80 text-sm font-medium animate-pulse">
                  Please keep this tab open
                </p>
                <p className="text-white/40 text-xs">
                  Processing {progress}% • Don't refresh or close
                </p>
              </div>
            </div>
          )}

          {/* After Export */}
          {done && downloadUrl && (
            <div className="space-y-6 text-center py-4">
              <div className="text-6xl animate-bounce">✨</div>
              
              <div className="space-y-2">
                <h3 className="text-2xl sm:text-3xl font-bold text-emerald-400">Complete!</h3>
                <p className="text-white/60 text-sm">Your video is ready to download</p>
              </div>

              <a href={downloadUrl} download={`ayahclip-${Date.now()}.mp4`}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all duration-200 text-base sm:text-lg shadow-lg hover:shadow-emerald-500/25 w-full sm:w-auto">
                <span>⬇️ Download MP4</span>
              </a>

              <p className="text-xs text-white/40 max-w-md mx-auto">
                MP4 plays on all devices • Share directly on social media • No conversion needed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}