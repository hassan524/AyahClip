'use client';

import { useState, useCallback } from 'react';
import VideoUploader from '@/components/VideoUploader';
import BackgroundPicker from '@/components/BackgroundPicker';
import AyahTimeline from '@/components/AyahTimeline';
import VideoPreview from '@/components/VideoPreview';
import ExportPanel from '@/components/ExportPanel';

export type BackgroundConfig =
  | { type: 'color'; value: string }
  | { type: 'gradient'; from: string; to: string }
  | { type: 'image'; url: string; file?: File }
  | { type: 'video'; url: string; file: File };

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface MatchedAyah {
  surah: number | null;
  surahName: string | null;
  surahEnglishName: string | null;
  ayahNumber: number | null;
  arabic: string;
  translation: string;
  isFullAyah: boolean;
  isBismillah?: boolean;
  isChunk?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  startTime: number;
  endTime: number;
  duration?: number;
  displayStart?: number;
  displayEnd?: number;
  words?: WordTimestamp[];
}



export type Step = 'upload' | 'processing' | 'edit' | 'export';
export type Feature = 'create' | 'upload' | 'record';

const ARABIC_FONTS = [
  'Scheherazade New', 'Amiri', 'Cairo', 'Noto Naskh Arabic',
  'Reem Kufi', 'Tajawal', 'El Messiri', 'Almarai',
  'Harmattan', 'Lateef', 'Lalezar', 'Aref Ruqaa', 'Kufam'
];

const ENGLISH_FONTS = [
  'Inter', 'Roboto', 'Playfair Display', 'Outfit',
  'Montserrat', 'Poppins', 'Lato', 'Open Sans',
  'Quicksand', 'Caveat', 'Cormorant Garamond', 'Cinzel'
];

function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const result = buffer.getChannelData(0);
  const bufferLength = result.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength, true);
  floatTo16BitPCM(view, 44, result);
  return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [activeFeature, setActiveFeature] = useState<Feature>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [ayahs, setAyahs] = useState<MatchedAyah[]>([]);
  const [background, setBackground] = useState<BackgroundConfig>({ type: 'color', value: '#0a0a1a' });
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [showTranslation, setShowTranslation] = useState(true);
  const [videoOpacity, setVideoOpacity] = useState(1.0);
  const [overlayType, setOverlayType] = useState<'none' | 'bottom' | 'full'>('bottom');
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const [arabicFont, setArabicFont] = useState('Scheherazade New');
  const [englishFont, setEnglishFont] = useState('Inter');
  const [arabicAlign, setArabicAlign] = useState<'center' | 'right'>('center');
  const [englishAlign, setEnglishAlign] = useState<'center' | 'left'>('center');
  const [verticalPosition, setVerticalPosition] = useState<'center' | 'bottom'>('bottom');
  const [arabicFontSize, setArabicFontSize] = useState(36);
  const [englishFontSize, setEnglishFontSize] = useState(20);
  const [wordHighlight, setWordHighlight] = useState(false);

  const handleVideoSelected = useCallback(async (file: File, url: string, duration: number) => {
    setVideoFile(file);
    setVideoUrl(url);
    setVideoDuration(duration);
    setError('');
    setStep('processing');

    try {
      setProcessingStatus('Extracting audio track from video...');
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
        fileReader.onerror = () => reject(new Error('Failed to read video file.'));
        fileReader.readAsArrayBuffer(file);
      });

      setProcessingStatus('Decoding audio track...');
      const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      setProcessingStatus('Downsampling audio to 16kHz mono...');
      const targetSampleRate = 16000;
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.round(originalBuffer.duration * targetSampleRate),
        targetSampleRate
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = originalBuffer;
      source.connect(offlineCtx.destination);
      source.start();
      const renderedBuffer = await offlineCtx.startRendering();

      const chunkSizeSec = 300;
      const chunkSizeSamples = chunkSizeSec * targetSampleRate;
      const totalSamples = renderedBuffer.length;
      const totalChunks = Math.ceil(totalSamples / chunkSizeSamples);
      const allSegments: any[] = [];
      const allWords: any[] = [];

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        setProcessingStatus(`Transcribing audio chunk ${chunkIdx + 1} of ${totalChunks}...`);

        const startSample = chunkIdx * chunkSizeSamples;
        const endSample = Math.min(totalSamples, startSample + chunkSizeSamples);
        const chunkLength = endSample - startSample;

        if (chunkLength < targetSampleRate * 2) continue;

        const chunkData = new Float32Array(chunkLength);
        renderedBuffer.copyFromChannel(chunkData, 0, startSample);

        const chunkOfflineCtx = new OfflineAudioContext(1, chunkLength, targetSampleRate);
        const chunkBuffer = chunkOfflineCtx.createBuffer(1, chunkLength, targetSampleRate);
        chunkBuffer.copyToChannel(chunkData, 0);

        const wavBlob = bufferToWav(chunkBuffer);
        const wavFile = new File([wavBlob], `chunk-${chunkIdx}.wav`, { type: 'audio/wav' });
        const audioFormData = new FormData();
        audioFormData.append('audio', wavFile, wavFile.name);

        const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: audioFormData });
        const transcribeText = await transcribeRes.text();

        let transcribeData: any;
        try {
          transcribeData = JSON.parse(transcribeText);
        } catch {
          console.error('Non-JSON from transcribe:', transcribeText.slice(0, 300));
          throw new Error('Transcription server error');
        }

        if (!transcribeRes.ok) {
          throw new Error(transcribeData.error || `Transcription failed at chunk ${chunkIdx + 1}`);
        }

        const { segments, words } = transcribeData;
        const offsetSec = chunkIdx * chunkSizeSec;

        if (segments && Array.isArray(segments)) {
          for (const seg of segments) {
            allSegments.push({ ...seg, start: seg.start + offsetSec, end: seg.end + offsetSec });
          }
        }
        if (words && Array.isArray(words)) {
          for (const w of words) {
            allWords.push({ ...w, start: w.start + offsetSec, end: w.end + offsetSec });
          }
        }
      }

      if (allSegments.length === 0) {
        throw new Error('No speech detected. Make sure video has clear Quran recitation.');
      }


      setProcessingStatus('Matching ayahs from Quran database...');
      const matchRes = await fetch('/api/match-ayahs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: allWords,
          segments: allSegments,
          videoDuration: duration
        }),
      });

      const matchText = await matchRes.text();

      let matchData: any;
      try {
        matchData = JSON.parse(matchText);
      } catch {
        console.error('Non-JSON from match-ayahs:', matchText.slice(0, 300));
        throw new Error('Ayah matching server error');
      }

      if (!matchRes.ok) {
        throw new Error(matchData.error || 'Ayah matching failed');
      }


      const matched = Array.isArray(matchData?.ayahs) ? matchData.ayahs : [];

      if (!matchRes.ok) {
        throw new Error(matchData?.error || 'Ayah matching failed');
      }

      if (matched.length === 0) {
        throw new Error(
          matchData?.error ||
          'Could not identify Quran ayahs. Try a clearer recording.'
        );
      }


      setAyahs(matched);
      setStep('edit');
    } catch (e: any) {
      console.error('Processing error:', e);
      setError(e.message || 'Processing failed');
      setStep('upload');
    } finally {
      setProcessingStatus('');
    }
  }, []);

  const reset = () => {
    setStep('upload');
    setAyahs([]);
    setVideoFile(null);
    setVideoUrl('');
    setError('');
  };

  // Show hero only on initial upload step
  const showHero = step === 'upload' && !videoUrl;

  return (
    <main className="min-h-screen bg-[#070714] text-white">
      <header className="border-b border-white/10 px-4 sm:px-6 py-4 sticky top-0 z-50 backdrop-blur-sm bg-[#070714]/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-sm font-bold">آ</div>
            <span className="font-semibold text-lg tracking-tight">AyahClip</span>
          </div>
          {step !== 'upload' && (
            <button onClick={reset} className="text-sm text-white/50 hover:text-white transition-colors">
              ← Back Home
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      {showHero && (
        <section className="relative overflow-hidden px-4 sm:px-6 py-16 sm:py-24">
          {/* Gradient Background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  Transform Quran Recitation
                </span>
                <br />
                <span className="text-white">Into Stunning Video Clips</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
                AI-powered Quranic video editor. Automatically detect ayahs, add translations, customize backgrounds, and export in MP4. Perfect for content creators and educators.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 pt-8 border-t border-white/10">
              {/* Feature 1 */}
              <div className="group cursor-not-allowed opacity-50 hover:opacity-75 transition-opacity">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-3 h-full">
                  <div className="text-4xl">📚</div>
                  <h3 className="text-lg font-semibold text-white">Create Quranic Video</h3>
                  <p className="text-sm text-white/50">Select Surah, ayah, translator & recitor</p>
                  <div className="pt-2 text-xs text-white/30 italic">Coming Soon</div>
                </div>
              </div>

              {/* Feature 2 - Active */}
              <div className="md:scale-105">
                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 rounded-2xl p-6 text-center space-y-3 h-full shadow-lg shadow-emerald-500/20">
                  <div className="text-4xl">🎬</div>
                  <h3 className="text-lg font-semibold text-white">Upload & Edit Video</h3>
                  <p className="text-sm text-white/70">Add translations, change background</p>
                  <div className="inline-block px-3 py-1 bg-emerald-500 text-white text-xs rounded-full font-medium">Active</div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group cursor-not-allowed opacity-50 hover:opacity-75 transition-opacity">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-3 h-full">
                  <div className="text-4xl">🎙️</div>
                  <h3 className="text-lg font-semibold text-white">Record Recitation</h3>
                  <p className="text-sm text-white/50">Record and auto-detect with translation</p>
                  <div className="pt-2 text-xs text-white/30 italic">Coming Soon</div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-8">
              <button
                onClick={() => document.querySelector('#uploader')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all duration-200 text-lg shadow-lg hover:shadow-emerald-500/25"
              >
                <span>Get Started</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <div id="uploader" className="space-y-8">
            {!videoUrl && (
              <>
                <div className="text-center space-y-3 mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold">Upload Your Quran Recitation</h2>
                  <p className="text-white/50 max-w-2xl mx-auto">
                    Upload any Quranic recitation video. Our AI will automatically detect ayahs and timestamps.
                  </p>
                </div>
                <div className="max-w-2xl mx-auto">
                  <VideoUploader onVideoSelected={handleVideoSelected} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">آ</div>
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-lg">{processingStatus}</p>
              <p className="text-white/40 text-sm mt-1">This may take a moment for longer videos</p>
            </div>
          </div>
        )}

        {/* Edit Step */}
        {step === 'edit' && videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            <VideoPreview
              videoUrl={videoUrl}
              ayahs={ayahs}
              background={background}
              textColor={textColor}
              showTranslation={showTranslation}
              duration={videoDuration}
              videoOpacity={videoOpacity}
              overlayType={overlayType}
              overlayOpacity={overlayOpacity}
              arabicFont={arabicFont}
              englishFont={englishFont}
              arabicAlign={arabicAlign}
              englishAlign={englishAlign}
              verticalPosition={verticalPosition}
              arabicFontSize={arabicFontSize}
              englishFontSize={englishFontSize}
              wordHighlight={wordHighlight}
            />

            {/* Edit Panel */}
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Background */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Background</h3>
                <BackgroundPicker value={background} onChange={setBackground} />
                {background.type !== 'video' && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Video opacity</span>
                      <span>{Math.round(videoOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={videoOpacity}
                      onChange={(e) => setVideoOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                )}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Overlay type</span>
                    <select
                      value={overlayType}
                      onChange={(e) => setOverlayType(e.target.value as any)}
                      className="bg-zinc-800 text-white border border-white/10 rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value="none">None</option>
                      <option value="bottom">Bottom Gradient</option>
                      <option value="full">Full Black Overlay</option>
                    </select>
                  </div>
                  {overlayType !== 'none' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-white/60">
                        <span>Overlay strength</span>
                        <span>{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Typography */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Typography & Layout</h3>

                {/* Text Color */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Text color</span>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-white/20 bg-transparent"
                  />
                </div>

                {/* Arabic Font */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-white/60 block">Arabic Font</label>
                  <select
                    value={arabicFont}
                    onChange={(e) => setArabicFont(e.target.value)}
                    className="w-full bg-zinc-800 text-white border border-white/10 rounded p-1.5 text-xs outline-none"
                    style={{ fontFamily: arabicFont }}
                  >
                    {ARABIC_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* English Font */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-white/60 block">English Font</label>
                  <select
                    value={englishFont}
                    onChange={(e) => setEnglishFont(e.target.value)}
                    className="w-full bg-zinc-800 text-white border border-white/10 rounded p-1.5 text-xs outline-none"
                    style={{ fontFamily: englishFont }}
                  >
                    {ENGLISH_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Sizes */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Arabic font size</span>
                      <span>{arabicFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="80"
                      step="1"
                      value={arabicFontSize}
                      onChange={(e) => setArabicFontSize(parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>English font size</span>
                      <span>{englishFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="60"
                      step="1"
                      value={englishFontSize}
                      onChange={(e) => setEnglishFontSize(parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Show translation</span>
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${showTranslation ? 'bg-emerald-500' : 'bg-white/20'
                        }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showTranslation ? 'left-5' : 'left-1'
                          }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-white/60">Word highlight</span>
                      <p className="text-xs text-white/30 mt-0.5">Highlight each word as recited</p>
                    </div>
                    <button
                      onClick={() => setWordHighlight(!wordHighlight)}
                      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${wordHighlight ? 'bg-emerald-500' : 'bg-white/20'
                        }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${wordHighlight ? 'left-5' : 'left-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Position & Alignment */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Vertical Position</span>
                    <div className="flex gap-1">
                      {(['bottom', 'center'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setVerticalPosition(p)}
                          className={`px-3 py-1 rounded-lg text-xs transition-colors capitalize ${verticalPosition === p
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-white/50 hover:bg-white/20'
                            }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Arabic Align</span>
                    <div className="flex gap-1">
                      {(['right', 'center'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setArabicAlign(a)}
                          className={`px-2 py-1 rounded text-xs transition-colors capitalize ${arabicAlign === a
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-white/50 hover:bg-white/20'
                            }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">English Align</span>
                    <div className="flex gap-1">
                      {(['left', 'center'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setEnglishAlign(a)}
                          className={`px-2 py-1 rounded text-xs transition-colors capitalize ${englishAlign === a
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 text-white/50 hover:bg-white/20'
                            }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ayah Timeline */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <h3 className="text-sm font-semibold mb-3 text-white/70 uppercase tracking-wider">
                  Detected Ayahs ({ayahs.length})
                </h3>
                <AyahTimeline ayahs={ayahs} onUpdate={setAyahs} />
              </div>

              {/* Export Button */}
              <button
                onClick={() => setStep('export')}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-colors text-lg shadow-lg"
              >
                Export Video →
              </button>
            </div>
          </div>
        )}

        {/* Export Step */}
        {step === 'export' && videoFile && (
          <ExportPanel
            videoFile={videoFile}
            videoUrl={videoUrl}
            ayahs={ayahs}
            background={background}
            textColor={textColor}
            showTranslation={showTranslation}
            videoOpacity={videoOpacity}
            overlayType={overlayType}
            overlayOpacity={overlayOpacity}
            arabicFont={arabicFont}
            englishFont={englishFont}
            arabicAlign={arabicAlign}
            englishAlign={englishAlign}
            verticalPosition={verticalPosition}
            arabicFontSize={arabicFontSize}
            englishFontSize={englishFontSize}
            onBack={() => setStep('edit')}
            wordHighlight={wordHighlight}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/5 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-sm font-bold">
                  آ
                </div>
                <span className="font-semibold text-lg">AyahClip</span>
              </div>
              <p className="text-sm text-white/50">Transform Quran recitation into stunning video clips with AI-powered editing.</p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white/70 uppercase text-sm tracking-wider">Features</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="hover:text-white/70 transition-colors">Upload & Edit</li>
                <li className="opacity-50 cursor-not-allowed">Create Video</li>
                <li className="opacity-50 cursor-not-allowed">Record Recitation</li>
              </ul>
            </div>

            {/* Resources */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white/70 uppercase text-sm tracking-wider">Resources</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="hover:text-white/70 transition-colors cursor-pointer">Documentation</li>
                <li className="hover:text-white/70 transition-colors cursor-pointer">FAQ</li>
                <li className="hover:text-white/70 transition-colors cursor-pointer">Support</li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-semibold text-white/70 uppercase text-sm tracking-wider">Connect</h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li className="hover:text-white/70 transition-colors cursor-pointer">Twitter</li>
                <li className="hover:text-white/70 transition-colors cursor-pointer">GitHub</li>
                <li className="hover:text-white/70 transition-colors cursor-pointer">Contact</li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-white/40">
              <p>© 2024 AyahClip. All rights reserved.</p>
              <p className="mt-4 sm:mt-0">Made with ❤️ by <span className="text-emerald-400 font-semibold">Hassan Rehan</span></p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}