'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

type RecordingState = 'idle' | 'confirm' | 'recording' | 'stopped' | 'permission-denied';

interface Props {
  onRecordingComplete: (file: File, url: string, duration: number) => void;
}

export default function VoiceRecorder({ onRecordingComplete }: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  /* ---------- helpers ---------- */
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  /* ---------- waveform ---------- */
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 48;
      const gap = 3;
      const barW = (width - gap * (barCount - 1)) / barCount;
      const step = Math.floor(bufLen / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] / 255;
        const barH = Math.max(3, val * height * 0.9);
        const x = i * (barW + gap);
        const y = (height - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fillStyle = val > 0.6
          ? 'rgba(5,150,105,0.9)'   /* emerald-600 */
          : val > 0.3
            ? 'rgba(16,185,129,0.7)' /* emerald-500 */
            : 'rgba(167,243,208,0.5)'; /* emerald-200 */
        ctx.fill();
      }
    };
    draw();
  }, []);

  /* ---------- start ---------- */
  const requestStart = useCallback(() => {
    setState('confirm');
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      /* audio context for visualiser */
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      /* media recorder */
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('stopped');
        cleanup();
      };

      recorder.start(200);
      startTimeRef.current = Date.now();
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      setState('recording');
      drawWaveform();
    } catch {
      setState('permission-denied');
    }
  }, [cleanup, drawWaveform]);

  /* ---------- stop ---------- */
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  /* ---------- re-record ---------- */
  const reRecord = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    audioBlobRef.current = null;
    setElapsed(0);
    setState('idle');
  }, [audioUrl]);

  /* ---------- confirm ---------- */
  const confirmRecording = useCallback(() => {
    if (!audioBlobRef.current || !audioUrl) return;
    const file = new File([audioBlobRef.current], 'recitation.webm', {
      type: 'audio/webm',
    });
    onRecordingComplete(file, audioUrl, elapsed);
  }, [audioUrl, elapsed, onRecordingComplete]);

  /* ---------- retry permission ---------- */
  const retryPermission = useCallback(() => {
    setState('idle');
    startRecording();
  }, [startRecording]);

  /* ================================================================
     RENDER
     ================================================================ */

  /* Permission denied */
  if (state === 'permission-denied') {
    return (
      <div className="border border-zinc-200 rounded-md bg-white p-10 text-center space-y-4">
        {/* shield-x icon */}
        <svg className="w-12 h-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 9l-6 6M9 9l6 6" />
        </svg>
        <h3 className="text-lg font-semibold text-emerald-950">Microphone Access Required</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          AyahClip needs microphone permission to record your recitation. Please allow
          microphone access in your browser settings and try again.
        </p>
        <button
          onClick={retryPermission}
          className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-md font-medium transition-colors"
        >
          {/* refresh icon */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h5M20 20v-5h-5M5.64 19.36A9 9 0 0020.49 9M3.51 15a9 9 0 0014.85-5.36" />
          </svg>
          Try Again
        </button>
      </div>
    );
  }

  /* Stopped — preview */
  if (state === 'stopped' && audioUrl) {
    return (
      <div className="border border-zinc-200 rounded-md bg-white p-8 space-y-6">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-emerald-950">Recording Complete</h3>
          <p className="text-sm text-zinc-500">
            Preview your recitation below. Duration:&nbsp;
            <span className="font-medium text-emerald-800">{fmt(elapsed)}</span>
          </p>
        </div>

        {/* audio preview */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4">
          <audio controls src={audioUrl} className="w-full" />
        </div>

        {/* actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reRecord}
            className="inline-flex items-center gap-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 px-5 py-2.5 rounded-md font-medium transition-colors bg-white"
          >
            {/* arrow-path icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h5M20 20v-5h-5M5.64 19.36A9 9 0 0020.49 9M3.51 15a9 9 0 0014.85-5.36" />
            </svg>
            Re-record
          </button>
          <button
            onClick={confirmRecording}
            className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-md font-medium transition-colors"
          >
            {/* check icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 13l4 4L19 7" />
            </svg>
            Use This Recording
          </button>
        </div>
      </div>
    );
  }

  /* Idle / Confirm / Recording */
  if (state === 'confirm') {
    return (
      <div className="border border-zinc-200 rounded-md bg-white p-8 space-y-5">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-emerald-950">Before You Record</h3>
          <p className="text-sm text-zinc-500">A few tips for the best ayah matching</p>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
          <p className="font-medium">Please make sure:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-900/90 leading-relaxed">
            <li>Your <strong>tajweed</strong> is correct and pronunciation is clear</li>
            <li>You record in a <strong>quiet place</strong> with minimal background noise</li>
            <li>Your <strong>voice is clear</strong> and at a steady, moderate pace</li>
            <li>You recite one ayah at a time with a brief pause between ayahs</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setState('idle')}
            className="px-5 py-2.5 rounded-md border border-zinc-300 text-zinc-700 text-sm font-medium bg-white hover:bg-zinc-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-md text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Start Recording
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 rounded-md bg-white p-8 space-y-6">
      {/* heading */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-emerald-950">Record Your Recitation</h3>
        <p className="text-sm text-zinc-500">
          Record your Quran recitation directly in the browser
        </p>
      </div>

      {/* microphone button */}
      <div className="flex justify-center">
        <button
          onClick={state === 'idle' ? requestStart : stopRecording}
          className="relative group focus:outline-none"
          aria-label={state === 'idle' ? 'Start recording' : 'Stop recording'}
        >
          <span
            className={`relative flex items-center justify-center w-20 h-20 rounded-full shadow-md
              ${state === 'recording'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-800 hover:bg-emerald-700'
              }`}
          >
            {state === 'recording' ? (
              /* stop (square) icon */
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              /* microphone icon */
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 10v1a7 7 0 01-14 0v-1M12 18v4m-3 0h6" />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* status text / timer */}
      <p className="text-center text-sm text-zinc-500">
        {state === 'recording' ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="font-mono text-lg font-semibold text-emerald-900">{fmt(elapsed)}</span>
            <span className="text-zinc-400 text-xs">recording</span>
          </span>
        ) : (
          'Tap the microphone to start recording'
        )}
      </p>

      {/* waveform canvas */}
      <div
        className={`overflow-hidden ${state === 'recording' ? 'block' : 'hidden'}`}
      >
        <canvas
          ref={canvasRef}
          width={480}
          height={72}
          className="w-full h-[72px] rounded-md bg-zinc-50 border border-zinc-200"
        />
      </div>

      {/* footnote */}
      <p className="text-center text-xs text-zinc-400">
        Audio is recorded locally and never leaves your browser until you choose to use it
      </p>
    </div>
  );
}
