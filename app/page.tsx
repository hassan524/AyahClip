'use client';

import { useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import LandingHero from '@/components/LandingHero';
import HowItWorks from '@/components/HowItWorks';
import FAQs from '@/components/FAQs';
import LandingFooter from '@/components/LandingFooter';
import QuranQuoteToast from '@/components/QuranQuoteToast';
import VideoUploader from '@/components/VideoUploader';
import VoiceRecorder from '@/components/VoiceRecorder';
import CreateFromVerse from '@/components/CreateFromVerse';
import BackgroundPicker from '@/components/BackgroundPicker';
import AyahTimeline from '@/components/AyahTimeline';
import VideoPreview, { TextPosition, AspectRatio } from '@/components/VideoPreview';
import {
  TextAnimation,
  AyahSegmentStyle,
  TEXT_ANIMATION_OPTIONS,
} from '@/lib/ayah-styles';
import ExportPanel from '@/components/ExportPanel';
import Dialog from '@/components/Dialog';

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
  isIstiadhah?: boolean;
  isChunk?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  startTime: number;
  endTime: number;
  duration?: number;
  displayStart?: number;
  displayEnd?: number;
  words?: WordTimestamp[];
  style?: AyahSegmentStyle;
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

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: '9:16', label: 'Mobile (9:16)' },
  { value: '16:9', label: 'Desktop (16:9)' },
  { value: '1:1', label: 'Square (1:1)' },
  { value: '4:5', label: 'Portrait (4:5)' },
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

function normalizeArabicWord(input: string): string {
  return input
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [activeFeature, setActiveFeature] = useState<Feature>('upload');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [ayahs, setAyahs] = useState<MatchedAyah[]>([]);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);
  const [videoOpacity, setVideoOpacity] = useState(1.0);
  const [overlayType, setOverlayType] = useState<'none' | 'bottom' | 'full'>('bottom');
  const [arabicFont, setArabicFont] = useState('Scheherazade New');
  const [englishFont, setEnglishFont] = useState('Inter');
  const [arabicAlign, setArabicAlign] = useState<'center' | 'right'>('center');
  const [englishAlign, setEnglishAlign] = useState<'center' | 'left'>('center');
  const [wordHighlight, setWordHighlight] = useState(false);
  const [quotesEnabled, setQuotesEnabled] = useState(true);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const [background, setBackground] = useState<BackgroundConfig>({ type: 'color', value: '#000000' });
  const [textColor, setTextColor] = useState('#ffffff');
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [verticalPosition, setVerticalPosition] = useState<'center' | 'bottom'>('center');
  const [arabicFontSize, setArabicFontSize] = useState(20);
  const [englishFontSize, setEnglishFontSize] = useState(18);
  const [textAnimation, setTextAnimation] = useState<TextAnimation>('fade');
  const [arabicLineHeight, setArabicLineHeight] = useState(1.75);
  const [englishLineHeight, setEnglishLineHeight] = useState(1.6);
  const [arabicPadding, setArabicPadding] = useState(0);
  const [englishPadding, setEnglishPadding] = useState(0);

  const globalTextStyle = {
    textAnimation,
    arabicFontSize,
    englishFontSize,
    arabicLineHeight,
    englishLineHeight,
    arabicPadding,
    englishPadding,
    textColor,
  };

  // ---- Draggable text positions (ONE global position each, applies to every ayah) ----
  const [arabicPosition, setArabicPosition] = useState<TextPosition | null>(null);
  const [englishPosition, setEnglishPosition] = useState<TextPosition | null>(null);

  // ---- Aspect ratio / format ----
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  const [currentTime, setCurrentTime] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ time: number; token: number } | null>(null);

  const handleTimelineSeek = useCallback((time: number) => {
    setSeekRequest({ time, token: Date.now() });
  }, []);

  const handleVideoSelected = useCallback(async (file: File, url: string, duration: number) => {
    setVideoFile(file);
    setVideoUrl(url);
    setVideoDuration(duration);
    setError('');
    setStep('processing');
    setIsAudioOnly(file.type.startsWith('audio/') || activeFeature === 'record');

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

        const chunkSegments: any[] = [];
        if (segments && Array.isArray(segments)) {
          for (const seg of segments) {
            if (
              Number.isFinite(Number(seg.start)) &&
              Number.isFinite(Number(seg.end)) &&
              Number(seg.end) > Number(seg.start)
            ) {
              const normalizedSeg = {
                ...seg,
                start: Number(seg.start) + offsetSec,
                end: Number(seg.end) + offsetSec,
              };
              allSegments.push(normalizedSeg);
              chunkSegments.push(normalizedSeg);
            }
          }
        }

        if (words && Array.isArray(words) && words.length > 0) {
          for (const w of words) {
            if (
              typeof w.word === 'string' &&
              w.word.trim() &&
              Number.isFinite(Number(w.start)) &&
              Number.isFinite(Number(w.end)) &&
              Number(w.end) > Number(w.start)
            ) {
              allWords.push({
                word: w.word.trim(),
                start: Number(w.start) + offsetSec,
                end: Number(w.end) + offsetSec,
              });
            }
          }
        } else {
          for (const seg of chunkSegments) {
            const splitWords = (seg.text || '').split(/\s+/).filter(Boolean);
            if (splitWords.length === 0) continue;

            const segDuration = seg.end - seg.start;
            const uniformDuration = segDuration / splitWords.length;

            for (let i = 0; i < splitWords.length; i++) {
              const cleaned = normalizeArabicWord(splitWords[i]);
              if (!cleaned) continue;

              allWords.push({
                word: cleaned,
                start: Number((seg.start + i * uniformDuration).toFixed(3)),
                end: Number((seg.start + (i + 1) * uniformDuration).toFixed(3)),
              });
            }
          }
        }
      }

      if (allSegments.length === 0) {
        throw new Error('No audio transcription segments could be extracted. The file may be silent or corrupted.');
      }

      setProcessingStatus('Matching ayahs from Quran...');
      const matchRes = await fetch('/api/match-ayahs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: allWords,
          segments: allSegments,
        }),
      });

      const matchText = await matchRes.text();
      let matchData: any;
      try {
        matchData = JSON.parse(matchText);
      } catch {
        console.error('Non-JSON from match-ayahs:', matchText.slice(0, 300));
        throw new Error('Ayah matching server encountered an unreadable response.');
      }

      if (!matchRes.ok) {
        throw new Error(matchData?.error || 'Ayah matching pipeline failed.');
      }

      const matched = Array.isArray(matchData?.ayahs) ? matchData.ayahs : [];

      if (matched.length === 0) {
        throw new Error(
          matchData?.error || 'Could not identify matching Quran ayahs from this recording.'
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

  /**
   * "Create from Verse" flow: uses our own /api/quran-surah and
   * /api/quran-audio proxy routes (instead of calling alquran.cloud
   * directly from the browser, which was hitting CORS/"Failed to fetch")
   * to get ayah text, translation, and audio for the selected range,
   * stitches the audio together with exact timestamps, and drops the
   * user straight into the edit step — same as upload/record.
   */
  function splitByWords(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function estimateArabicLines(text: string): number {
    const words = splitByWords(text);
    const weightedLength = words.reduce((sum, word) => sum + word.length, 0);

    return Math.ceil(weightedLength / 58);
  }

  function splitArabicIntoDisplayChunks(text: string, maxEstimatedLines = 2): string[] {
    const clean = text.trim();
    if (!clean) return [];

    // Keep short/medium ayahs complete.
    if (estimateArabicLines(clean) <= maxEstimatedLines) {
      return [clean];
    }

    const words = splitByWords(clean);
    const stopMarks = new Set(['ۚ', 'ۗ', 'ۖ', 'ۙ', 'ۘ', 'ۛ', 'ۜ', '۝', 'ؕ', '،', '؛']);

    const chunks: string[] = [];
    let current: string[] = [];

    for (const word of words) {
      current.push(word);

      const currentText = current.join(' ');
      const hasStopMark = [...word].some((char) => stopMarks.has(char));
      const currentLines = estimateArabicLines(currentText);
      const enoughWords = current.length >= 7;

      if (currentLines >= maxEstimatedLines && hasStopMark && enoughWords) {
        chunks.push(currentText);
        current = [];
        continue;
      }

      if (currentLines > maxEstimatedLines) {
        if (current.length > 1) {
          const lastWord = current.pop()!;
          chunks.push(current.join(' '));
          current = [lastWord];
        } else {
          chunks.push(currentText);
          current = [];
        }
      }
    }

    if (current.length > 0) {
      chunks.push(current.join(' '));
    }

    // Prevent tiny last chunks like only "يُبْصِرُونَ".
    if (chunks.length > 1) {
      const last = chunks[chunks.length - 1];
      const lastWordCount = splitByWords(last).length;

      if (lastWordCount <= 3) {
        chunks[chunks.length - 2] = `${chunks[chunks.length - 2]} ${last}`.trim();
        chunks.pop();
      }
    }

    return chunks;
  }

  function splitTranslationByArabicRatio(translation: string, arabicChunks: string[], fullArabic: string): string[] {
    const clean = translation.trim();
    if (!clean) return [];

    if (arabicChunks.length <= 1) {
      return [clean];
    }

    const translationWords = splitByWords(clean);
    const arabicWordCounts = arabicChunks.map((chunk) => splitByWords(chunk).length);
    const totalArabicWords = Math.max(1, splitByWords(fullArabic).length);

    const chunks: string[] = [];
    let cursor = 0;

    for (let i = 0; i < arabicChunks.length; i++) {
      const isLast = i === arabicChunks.length - 1;

      if (isLast) {
        chunks.push(translationWords.slice(cursor).join(' '));
        break;
      }

      const ratio = arabicWordCounts[i] / totalArabicWords;
      let take = Math.round(ratio * translationWords.length);

      take = Math.max(4, take);
      take = Math.min(take, translationWords.length - cursor - 3);

      let end = cursor + take;

      for (let j = end; j < Math.min(translationWords.length - 1, end + 5); j++) {
        if (/[,.!?;:]$/.test(translationWords[j])) {
          end = j + 1;
          break;
        }
      }

      for (let j = end - 1; j > Math.max(cursor + 3, end - 5); j--) {
        if (/[,.!?;:]$/.test(translationWords[j])) {
          end = j + 1;
          break;
        }
      }

      chunks.push(translationWords.slice(cursor, end).join(' '));
      cursor = end;
    }

    return chunks;
  }

  const handleCreateFromVerse = useCallback(
    async (config: {
      reciterId: string;
      reciterName: string;
      surahNumber: number;
      surahName: string;
      fromAyah: number;
      toAyah: number;
      backgroundColor: string;
    }) => {
      setError('');
      setStep('processing');

      try {
        setProcessingStatus('Fetching ayah text and audio...');
        const params = new URLSearchParams({
          reciterId: config.reciterId,
          surahNumber: String(config.surahNumber),
          fromAyah: String(config.fromAyah),
          toAyah: String(config.toAyah),
        });

        const surahRes = await fetch(`/api/quran-surah?${params.toString()}`);
        const surahJson = await surahRes.json();
        if (!surahRes.ok) {
          throw new Error(surahJson?.error || 'Failed to fetch surah data.');
        }

        if (surahJson.warning) {
          console.warn('quran-surah warning:', surahJson.warning);
        }

        const selectedAyahs: {
          ayahNumber: number;
          arabic: string;
          translation: string;
          audioUrl: string | null;
        }[] = surahJson.ayahs || [];

        if (selectedAyahs.length === 0) {
          throw new Error('No ayahs found in the selected range.');
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedBuffers: AudioBuffer[] = [];

        for (let i = 0; i < selectedAyahs.length; i++) {
          setProcessingStatus(`Downloading recitation audio ${i + 1} of ${selectedAyahs.length}...`);
          const ayah = selectedAyahs[i];

          if (!ayah.audioUrl) {
            throw new Error(`Missing audio for ayah ${ayah.ayahNumber}. This reciter may not have audio for this ayah — try a different reciter.`);
          }

          const proxiedUrl = `/api/quran-audio?url=${encodeURIComponent(ayah.audioUrl)}`;
          const arrayBuffer = await fetch(proxiedUrl).then((r) => {
            if (!r.ok) throw new Error(`Failed to download audio for ayah ${ayah.ayahNumber}.`);
            return r.arrayBuffer();
          });

          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          decodedBuffers.push(decoded);

        }

        setProcessingStatus('Stitching ayahs together...');
        const sampleRate = decodedBuffers[0].sampleRate;

        const crossfadeSeconds = 0.045;
        const crossfadeSamples = Math.round(crossfadeSeconds * sampleRate);

        const totalSamples =
          decodedBuffers.reduce((sum, b) => sum + b.length, 0) -
          crossfadeSamples * Math.max(0, decodedBuffers.length - 1);

        const combinedBuffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
        const combinedData = combinedBuffer.getChannelData(0);

        const builtAyahs: MatchedAyah[] = [];
        let cursor = 0;


        for (let i = 0; i < decodedBuffers.length; i++) {
          const buf = decodedBuffers[i];
          const sourceData = buf.getChannelData(0);
          const fadeSamples = i === 0 ? 0 : Math.min(crossfadeSamples, sourceData.length, cursor);

          const startTime = (cursor - fadeSamples) / sampleRate;
          const endTime = (cursor - fadeSamples + buf.length) / sampleRate;
          const ayahMeta = selectedAyahs[i];

          if (i === 0 || fadeSamples <= 0) {
            combinedData.set(sourceData, cursor);
          } else {
            for (let s = 0; s < fadeSamples; s++) {
              const fadeIn = s / fadeSamples;
              const fadeOut = 1 - fadeIn;

              combinedData[cursor - fadeSamples + s] =
                combinedData[cursor - fadeSamples + s] * fadeOut + sourceData[s] * fadeIn;
            }

            combinedData.set(sourceData.subarray(fadeSamples), cursor);
          }


          const wordsArr = (ayahMeta.arabic || '').split(/\s+/).filter(Boolean);
          const wordsList: WordTimestamp[] = [];
          if (wordsArr.length > 0) {
            const dur = endTime - startTime;
            const perWord = Math.max(0.1, dur / wordsArr.length);
            for (let wIdx = 0; wIdx < wordsArr.length; wIdx++) {
              wordsList.push({
                word: wordsArr[wIdx],
                start: Number((startTime + wIdx * perWord).toFixed(3)),
                end: Number((startTime + (wIdx + 1) * perWord).toFixed(3)),
              });
            }
          }

          const arabicChunks = splitArabicIntoDisplayChunks(ayahMeta.arabic, 2);
          const translationChunks = splitTranslationByArabicRatio(
            ayahMeta.translation,
            arabicChunks,
            ayahMeta.arabic,
          );

          const chunkCount = arabicChunks.length;

          const chunkWeights = arabicChunks.map((c) =>
            Math.max(1, splitByWords(c).reduce((sum, w) => sum + w.length, 0)),
          );
          const totalWeight = chunkWeights.reduce((a, b) => a + b, 0);
          const ayahDuration = endTime - startTime;

          const chunkBounds: { start: number; end: number }[] = [];
          let boundsCursor = startTime;
          for (let ci = 0; ci < chunkCount; ci++) {
            const isLast = ci === chunkCount - 1;
            const cStart = boundsCursor;
            const cEnd = isLast ? endTime : cStart + (chunkWeights[ci] / totalWeight) * ayahDuration;
            chunkBounds.push({ start: cStart, end: cEnd });
            boundsCursor = cEnd;
          }

          for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
            const chunkStart = chunkBounds[chunkIndex].start;
            const chunkEnd = chunkBounds[chunkIndex].end;

            const chunkArabic = arabicChunks[chunkIndex] || '';
            const chunkTranslation =
              translationChunks[chunkIndex] ||
              translationChunks[translationChunks.length - 1] ||
              '';


            const chunkWordsArr = chunkArabic.split(/\s+/).filter(Boolean);
            const chunkWordsList: WordTimestamp[] = [];

            if (chunkWordsArr.length > 0) {
              const dur = chunkEnd - chunkStart;
              const perWord = Math.max(0.1, dur / chunkWordsArr.length);

              for (let wIdx = 0; wIdx < chunkWordsArr.length; wIdx++) {
                chunkWordsList.push({
                  word: chunkWordsArr[wIdx],
                  start: Number((chunkStart + wIdx * perWord).toFixed(3)),
                  end: Number((chunkStart + (wIdx + 1) * perWord).toFixed(3)),
                });
              }
            }

            builtAyahs.push({
              surah: config.surahNumber,
              surahName: config.surahName,
              surahEnglishName: config.surahName,
              ayahNumber: ayahMeta.ayahNumber,
              arabic: chunkArabic,
              translation: chunkTranslation,
              isFullAyah: true,
              isChunk: chunkCount > 1,
              chunkIndex,
              totalChunks: chunkCount,
              startTime: chunkStart,
              endTime: chunkEnd,
              duration: chunkEnd - chunkStart,
              words: chunkWordsList,
            });
          }


          cursor += i === 0 ? buf.length : buf.length - crossfadeSamples;

        }

        const totalDuration = totalSamples / sampleRate;

        setProcessingStatus('Converting audio...');
        const wavBlob = bufferToWav(combinedBuffer);
        const audioFileOut = new File([wavBlob], 'ayahclip-verse.wav', { type: 'audio/wav' });
        const audioUrlOut = URL.createObjectURL(wavBlob);

        setIsAudioOnly(true);
        setBackground({ type: 'color', value: config.backgroundColor });
        setVideoFile(audioFileOut);
        setVideoUrl(audioUrlOut);
        setVideoDuration(totalDuration);
        setAyahs(builtAyahs);
        setStep('edit');
      } catch (e: any) {
        console.error('Create-from-verse error:', e);
        setError(e.message || 'Failed to generate clip from verse selection.');
        setStep('upload');
        setActiveFeature('create');
      } finally {
        setProcessingStatus('');
      }
    },
    [],
  );

  const reset = () => {
    setStep('upload');
    setAyahs([]);
    setVideoFile(null);
    setVideoUrl('');
    setError('');
    setCurrentTime(0);
    setSeekRequest(null);
    setArabicPosition(null);
    setEnglishPosition(null);
    setIsAudioOnly(false);
  };

  const scrollToUploader = () => {
    document.querySelector('#uploader')?.scrollIntoView({ behavior: 'smooth' });
  };

  const showLanding = step === 'upload' && !videoUrl;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <Navbar
        step={step}
        onReset={reset}
        quotesEnabled={quotesEnabled}
        onToggleQuotes={() => setQuotesEnabled((v) => !v)}
        onContactClick={() => setIsContactOpen(true)}
      />

      <QuranQuoteToast enabled={quotesEnabled} />

      {showLanding && (
        <>
          <LandingHero
            onSelectUpload={() => { setActiveFeature('upload'); scrollToUploader(); }}
            onSelectRecord={() => { setActiveFeature('record'); scrollToUploader(); }}
            onSelectCreate={() => { setActiveFeature('create'); scrollToUploader(); }}
          />
          <HowItWorks />
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Upload / Record / Create Step */}
        {step === 'upload' && (
          <div id="uploader" className="space-y-8">
            {!videoUrl && (
              <>
                {/* Feature Tabs */}
                <div className="flex justify-center w-full">
                  <div className="flex w-full max-w-lg bg-zinc-100 rounded-lg p-1 gap-1">
                    <button
                      onClick={() => setActiveFeature('upload')}
                      className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${activeFeature === 'upload'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1.5">
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>

                        <span className="text-[10px] sm:text-sm text-center leading-tight whitespace-nowrap">
                          Upload Video
                        </span>
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveFeature('record')}
                      className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${activeFeature === 'record'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1.5">
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>

                        <span className="text-[10px] sm:text-sm text-center leading-tight whitespace-nowrap">
                          Record Voice
                        </span>
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveFeature('create')}
                      className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${activeFeature === 'create'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                        }`}
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1.5">
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>

                        <span className="text-[10px] sm:text-sm text-center leading-tight">
                          <span className="hidden sm:inline whitespace-nowrap">
                            Create from Verse
                          </span>

                          <span className="sm:hidden">
                            Create
                            <br />
                            from Verse
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                {/* Upload Tab Content */}
                {activeFeature === 'upload' && (
                  <>
                    <div className="text-center space-y-2 mb-8">
                      <h2 className="text-2xl font-bold text-emerald-950">Upload Your Quran Recitation</h2>
                      <p className="text-zinc-500 max-w-2xl mx-auto text-sm">
                        Upload a Quranic recitation video. Ayahs and timestamps will be detected automatically.
                      </p>
                    </div>
                    <div className="max-w-2xl mx-auto">
                      <VideoUploader onVideoSelected={handleVideoSelected} />
                    </div>
                  </>
                )}

                {/* Record Tab Content */}
                {activeFeature === 'record' && (
                  <div className="max-w-2xl mx-auto">
                    <VoiceRecorder
                      onRecordingComplete={(file, url, duration) => {
                        handleVideoSelected(file, url, duration);
                      }}
                    />
                  </div>
                )}

                {/* Create from Verse Tab Content */}
                {activeFeature === 'create' && (
                  <div className="max-w-2xl mx-auto">
                    <CreateFromVerse onGenerate={handleCreateFromVerse} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-200" />
              <div className="absolute inset-0 rounded-full border-2 border-t-emerald-700 animate-spin" />
              <svg className="absolute inset-0 m-auto w-6 h-6 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-emerald-950 font-medium">{processingStatus}</p>
              <p className="text-zinc-400 text-sm mt-1">This may take a moment for longer videos</p>
            </div>
          </div>
        )}

        {/* Edit Step — side-by-side: video+timeline LEFT, settings RIGHT */}
        {step === 'edit' && videoUrl && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT column — Video preview + Timeline (close together) */}
            <div className="flex flex-col gap-2 lg:w-[55%] lg:sticky lg:top-24 lg:self-start">
              <VideoPreview
                videoUrl={videoUrl}
                isAudioOnly={isAudioOnly}
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
                onTimeUpdate={setCurrentTime}
                seekTo={seekRequest}
                aspectRatio={aspectRatio}
                arabicPosition={arabicPosition}
                englishPosition={englishPosition}
                onArabicPositionChange={setArabicPosition}
                onEnglishPositionChange={setEnglishPosition}
                textAnimation={textAnimation}
                arabicLineHeight={arabicLineHeight}
                englishLineHeight={englishLineHeight}
                arabicPadding={arabicPadding}
                englishPadding={englishPadding}
              />

              <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                <p className="font-medium">Check Arabic &amp; translation below</p>
                <p className="text-emerald-800/80 text-xs mt-0.5 leading-relaxed">
                  You can review the Arabic text and English translation for each ayah in the timeline below. Play the preview, open any segment, and fix wording or timing before exporting.
                </p>
              </div>

              {/* Timeline directly below video */}
              <div className="bg-white rounded-md p-4 border border-zinc-200">
                <h3 className="text-sm font-semibold mb-3 text-emerald-900 uppercase tracking-wide">
                  Detected Ayahs ({ayahs.length})
                </h3>
                <AyahTimeline
                  ayahs={ayahs}
                  onUpdate={setAyahs}
                  duration={videoDuration}
                  currentTime={currentTime}
                  onSeek={handleTimelineSeek}
                  globalTextStyle={globalTextStyle}
                />
              </div>
            </div>

            {/* RIGHT column — All editing controls */}
            <div className="lg:w-[45%] space-y-4">
              <div className="bg-white rounded-md p-4 border border-zinc-200 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-900 uppercase tracking-wide">Format</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`px-3 py-2 rounded text-xs transition-colors ${aspectRatio === opt.value ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-md p-4 border border-zinc-200 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-900 uppercase tracking-wide">Background</h3>
                <BackgroundPicker value={background} onChange={setBackground} />
                {background.type !== 'video' && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Video opacity</span>
                      <span>{Math.round(videoOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={videoOpacity}
                      onChange={(e) => setVideoOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                )}
                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Overlay type</span>
                    <select
                      value={overlayType}
                      onChange={(e) => setOverlayType(e.target.value as any)}
                      className="bg-white text-zinc-800 border border-zinc-200 rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value="none">None</option>
                      <option value="bottom">Bottom Gradient</option>
                      <option value="full">Full Black Overlay</option>
                    </select>
                  </div>
                  {overlayType !== 'none' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Overlay strength</span>
                        <span>{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-md p-4 border border-zinc-200 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-900 uppercase tracking-wide">Typography & Layout</h3>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">Text color</span>
                  <input
                    type="color" value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-zinc-200 bg-transparent"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                  <label className="text-xs text-zinc-500 block">Arabic Font</label>
                  <select
                    value={arabicFont}
                    onChange={(e) => setArabicFont(e.target.value)}
                    className="w-full bg-white text-zinc-800 border border-zinc-200 rounded p-1.5 text-xs outline-none"
                    style={{ fontFamily: arabicFont }}
                  >
                    {ARABIC_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                  <label className="text-xs text-zinc-500 block">English Font</label>
                  <select
                    value={englishFont}
                    onChange={(e) => setEnglishFont(e.target.value)}
                    className="w-full bg-white text-zinc-800 border border-zinc-200 rounded p-1.5 text-xs outline-none"
                    style={{ fontFamily: englishFont }}
                  >
                    {ENGLISH_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Arabic font size</span>
                      <span>{arabicFontSize}px</span>
                    </div>
                    <input
                      type="range" min="16" max="80" step="1"
                      value={arabicFontSize}
                      onChange={(e) => setArabicFontSize(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>English font size</span>
                      <span>{englishFontSize}px</span>
                    </div>
                    <input
                      type="range" min="12" max="60" step="1"
                      value={englishFontSize}
                      onChange={(e) => setEnglishFontSize(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-500 block">Entrance animation (default for all ayahs)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TEXT_ANIMATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTextAnimation(opt.value)}
                          className={`px-2 py-1.5 rounded text-xs transition-colors ${textAnimation === opt.value ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-400">Override per ayah in the timeline below.</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Arabic line height</span>
                      <span>{arabicLineHeight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="1" max="3" step="0.05"
                      value={arabicLineHeight}
                      onChange={(e) => setArabicLineHeight(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>English line height</span>
                      <span>{englishLineHeight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min="1" max="3" step="0.05"
                      value={englishLineHeight}
                      onChange={(e) => setEnglishLineHeight(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Arabic padding</span>
                      <span>{arabicPadding}px</span>
                    </div>
                    <input
                      type="range" min="0" max="48" step="1"
                      value={arabicPadding}
                      onChange={(e) => setArabicPadding(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>English padding</span>
                      <span>{englishPadding}px</span>
                    </div>
                    <input
                      type="range" min="0" max="48" step="1"
                      value={englishPadding}
                      onChange={(e) => setEnglishPadding(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">Show translation</span>
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${showTranslation ? 'bg-emerald-700' : 'bg-zinc-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showTranslation ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-zinc-600">Word highlight</span>
                      <p className="text-xs text-zinc-400 mt-0.5">Highlight each word as recited</p>
                    </div>
                    <button
                      onClick={() => setWordHighlight(!wordHighlight)}
                      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${wordHighlight ? 'bg-emerald-700' : 'bg-zinc-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${wordHighlight ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">Vertical Position (default)</span>
                    <div className="flex gap-1">
                      {(['bottom', 'center'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setVerticalPosition(p);
                            // reset manual drag positions so the new default takes effect
                            setArabicPosition(null);
                            setEnglishPosition(null);
                          }}
                          className={`px-3 py-1 rounded text-xs transition-colors capitalize ${verticalPosition === p ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(arabicPosition || englishPosition) && (
                    <button
                      onClick={() => {
                        setArabicPosition(null);
                        setEnglishPosition(null);
                      }}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      Reset text position to default
                    </button>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Arabic Align</span>
                    <div className="flex gap-1">
                      {(['right', 'center'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setArabicAlign(a)}
                          className={`px-2 py-1 rounded text-xs transition-colors capitalize ${arabicAlign === a ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">English Align</span>
                    <div className="flex gap-1">
                      {(['left', 'center'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setEnglishAlign(a)}
                          className={`px-2 py-1 rounded text-xs transition-colors capitalize ${englishAlign === a ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('export')}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold rounded-md transition-colors"
              >
                Export Video
              </button>
            </div>
          </div>
        )}

        {/* Export Step */}
        {step === 'export' && videoFile && (
          <ExportPanel
            videoFile={videoFile}
            videoUrl={videoUrl}
            isAudioOnly={isAudioOnly}
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
            textAnimation={textAnimation}
            arabicLineHeight={arabicLineHeight}
            englishLineHeight={englishLineHeight}
            arabicPadding={arabicPadding}
            englishPadding={englishPadding}
            onBack={() => setStep('edit')}
            wordHighlight={wordHighlight}
          />
        )}
      </div>

      {showLanding && <FAQs />}
      {showLanding && <LandingFooter onContactClick={() => setIsContactOpen(true)} />}

      <Dialog
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        title="Contact Us"
        text={
          <>
            Thank you for using AyahClip! If you have any questions, feedback, or
            found any issue with the app, please reach out directly.
            <br />
            <br />
            Email:{' '}
            <a 
              href="mailto:hassanrehan9975@gmail.com"
              className="text-emerald-700 hover:underline"
            >
              hassanrehan9975@gmail.com
            </a>
          </>
        }
      />
    </main >
  );
}