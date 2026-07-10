import { MatchedAyah } from '@/app/page';
import { GlobalTextStyle, resolveAyahStyle } from '@/lib/ayah-styles';
import { applyCanvasAdaptiveShadow, clearCanvasShadow } from '@/lib/text-shadow';
import type { AspectRatio, SurahLabelLang, TextPosition } from '@/components/VideoPreview';

const LINGER_SEC = 0.5;
const ANIM_DURATION = 0.35; // seconds — matches CSS animation duration

export const CANVAS_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

function toArabicNumeral(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toString().split('').map((d) => String.fromCharCode(0x0660 + parseInt(d))).join('');
}

export function getAyahAt(time: number, ayahs: MatchedAyah[]): MatchedAyah | null {
  for (let i = 0; i < ayahs.length; i++) {
    const a = ayahs[i];
    const dispStart = a.displayStart ?? a.startTime;
    const dispEnd = a.displayEnd ?? a.endTime;
    const nextStart = ayahs[i + 1]?.displayStart ?? ayahs[i + 1]?.startTime ?? Infinity;
    const hideAt = Math.min(dispEnd + LINGER_SEC, nextStart);
    if (time >= dispStart && time < hideAt) return a;
  }
  return null;
}

export function buildSurahLabelText(
  ayah: MatchedAyah,
  showSurahLabel: boolean,
  surahLabelLang: SurahLabelLang,
): string {
  if (!showSurahLabel || ayah.ayahNumber === 0) return '';

  const ar = ayah.surahName || '';
  const en = ayah.surahEnglishName || '';
  const ayahNum = ayah.isFullAyah && ayah.ayahNumber ? ayah.ayahNumber : null;

  if (surahLabelLang === 'arabic') {
    if (!ar) return '';
    return ayahNum ? `${ar} ${toArabicNumeral(ayahNum)}` : ar;
  }
  if (surahLabelLang === 'english') {
    if (!en) return '';
    return ayahNum ? `${en} · ${ayah.surah}:${ayahNum}` : en;
  }
  const parts = [en, ar].filter(Boolean);
  if (parts.length === 0) return '';
  return ayahNum ? `${parts.join(' · ')} · ${ayahNum}` : parts.join(' · ');
}

function resolvePositions(
  ayah: MatchedAyah,
  verticalPosition: 'center' | 'bottom',
  arabicPosition: TextPosition | null,
  englishPosition: TextPosition | null,
) {
  const defaultArabic: TextPosition = { x: 50, y: verticalPosition === 'center' ? 42 : 72 };
  const defaultEnglish: TextPosition = { x: 50, y: verticalPosition === 'center' ? 58 : 86 };
  return {
    arabic: ayah.style?.arabicPosition ?? arabicPosition ?? defaultArabic,
    english: ayah.style?.englishPosition ?? englishPosition ?? defaultEnglish,
  };
}

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

function drawArabicBlock(
  ctx: CanvasRenderingContext2D,
  ayah: MatchedAyah,
  time: number,
  centerX: number,
  centerY: number,
  maxWidth: number,
  arabicFont: string,
  arabicAlign: 'center' | 'right',
  style: ReturnType<typeof resolveAyahStyle>,
  wordHighlight: boolean,
  animAlpha: number = 1,
) {
  const dbWords = ayah.arabic.split(/\s+/).filter(Boolean);
  const wWords = ayah.words || [];
  const GAP = 6;
  const lineH = style.arabicFontSize * style.arabicLineHeight;
  const color = style.textColor;

  ctx.font = `${style.arabicFontSize}px "${arabicFont}", serif`;
  ctx.direction = 'rtl';

  // Measure the marker width so we can include it in the last line's
  // width calculation — the CSS preview has the marker inline so
  // text-align:center centres the whole line INCLUDING the marker.
  const hasMarker = ayah.isFullAyah && ayah.ayahNumber !== null && ayah.ayahNumber !== 0;
  let markerTotalW = 0;
  if (hasMarker) {
    const savedFont = ctx.font;
    ctx.font = `${style.arabicFontSize * 1.1}px "Scheherazade New", "Amiri", serif`;
    markerTotalW = ctx.measureText('۝').width + 8; // 8px = marginRight in preview
    ctx.font = savedFont;
  }

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

  const totalBlockH = lines.length * lineH;
  let y = centerY - totalBlockH / 2 + lineH * 0.75;
  let globalIdx = 0;

  let markerAnchorX = centerX;
  let markerAnchorY = y;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineWords = lines[lineIdx];
    const isLastLine = lineIdx === lines.length - 1;
    const wordsW = lineWords.reduce((sum, w) => sum + ctx.measureText(w).width + GAP, 0) - GAP;
    // Include marker width in the last line so centering accounts for it
    const lineW = isLastLine && hasMarker ? wordsW + markerTotalW + GAP : wordsW;
    let x: number;
    if (arabicAlign === 'center') {
      x = centerX + lineW / 2;
    } else {
      x = centerX + maxWidth / 2;
    }

    for (const word of lineWords) {
      const wordW = ctx.measureText(word).width;
      let fill = color;
      let alpha = 1;
      let glow = false;

      if (wordHighlight) {
        if (wWords.length > 0) {
          const wIdx = Math.min(globalIdx, wWords.length - 1);
          const w = wWords[wIdx];
          const isActive = time >= w.start && time <= w.end;
          const isPast = time > w.end;
          if (isActive) { fill = '#34d399'; glow = true; }
          else if (!isPast) { alpha = 0.3; }
        } else {
          const total = ayah.endTime - ayah.startTime;
          const elapsed = time - ayah.startTime;
          const prog = total > 0 ? Math.min(1, elapsed / total) : 0;
          const activeIdx = Math.min(Math.floor(prog * dbWords.length), dbWords.length - 1);
          if (globalIdx === activeIdx) { fill = '#34d399'; glow = true; }
          else if (globalIdx > activeIdx) { alpha = 0.3; }
        }
      }

      applyCanvasAdaptiveShadow(ctx, color, glow ? 'rgba(52,211,153,0.8)' : undefined);
      ctx.globalAlpha = alpha * animAlpha;
      ctx.fillStyle = fill;
      ctx.textAlign = 'right';
      ctx.fillText(word, x, y);
      clearCanvasShadow(ctx);
      ctx.globalAlpha = 1;

      x -= wordW + GAP;
      globalIdx++;

      if (globalIdx === dbWords.length) {
        markerAnchorX = x + GAP - 8;
        markerAnchorY = y;
      }
    }
    y += lineH;
  }

  if (hasMarker) {
    const markerY = markerAnchorY;
    const markerFontSize = style.arabicFontSize * 1.1;

    applyCanvasAdaptiveShadow(ctx, color, 'rgba(52,211,153,0.5)');
    ctx.font = `${markerFontSize}px "Scheherazade New", "Amiri", serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85 * animAlpha;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('۝', markerAnchorX, markerY);

    const markerMetrics = ctx.measureText('۝');
    const markerWidth = markerMetrics.width;
    const mCenterX = markerAnchorX - markerWidth / 2;

    const ascent = markerMetrics.actualBoundingBoxAscent || markerFontSize * 0.75;
    const descent = markerMetrics.actualBoundingBoxDescent || markerFontSize * 0.05;
    const mCenterY = markerY - ascent + (ascent + descent) / 2;

    clearCanvasShadow(ctx);
    ctx.font = `${Math.max(10, style.arabicFontSize * 0.32)}px "Scheherazade New", "Amiri", serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1 * animAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toArabicNumeral(ayah.ayahNumber!), mCenterX, mCenterY);
    ctx.textBaseline = 'alphabetic';
  }

  ctx.direction = 'ltr';
}

export interface DrawFrameOptions {
  ayahs: MatchedAyah[];
  background: import('@/app/page').BackgroundConfig;
  isAudioOnly: boolean;
  videoOpacity: number;
  overlayType: 'none' | 'bottom' | 'full';
  overlayOpacity: number;
  showTranslation: boolean;
  arabicFont: string;
  englishFont: string;
  arabicAlign: 'center' | 'right';
  englishAlign: 'center' | 'left';
  verticalPosition: 'center' | 'bottom';
  wordHighlight: boolean;
  globalTextStyle: GlobalTextStyle;
  arabicPosition: TextPosition | null;
  englishPosition: TextPosition | null;
  showSurahLabel: boolean;
  surahLabelLang: SurahLabelLang;
  /** Font size (px, authored against the real export canvas resolution) for the small surah/ayah reference label. */
  surahLabelFontSize: number;
  videoEl: HTMLVideoElement | null;
  bgVideoEl: HTMLVideoElement | null;
  bgImageEl: HTMLImageElement | null;
}

export function drawExportFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  time: number,
  opts: DrawFrameOptions,
) {
  const W = canvas.width;
  const H = canvas.height;

  const { background } = opts;

  if (background.type === 'color') {
    ctx.fillStyle = background.value;
    ctx.fillRect(0, 0, W, H);
  } else if (background.type === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, background.from);
    g.addColorStop(1, background.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (background.type === 'image' && opts.bgImageEl) {
    ctx.drawImage(opts.bgImageEl, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
  } else if (background.type === 'video' && opts.bgVideoEl) {
    ctx.drawImage(opts.bgVideoEl, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
  }

  if (opts.videoEl && background.type !== 'video' && !opts.isAudioOnly) {
    ctx.globalAlpha = opts.videoOpacity;
    ctx.drawImage(opts.videoEl, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (opts.overlayType === 'full') {
    ctx.fillStyle = `rgba(0,0,0,${opts.overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.overlayType === 'bottom') {
    const g = ctx.createLinearGradient(0, H * 0.33, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(0,0,0,${opts.overlayOpacity * 0.6})`);
    g.addColorStop(1, `rgba(0,0,0,${opts.overlayOpacity})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const ayah = getAyahAt(time, opts.ayahs);
  if (!ayah) return;

  // ---- Animation: compute fade-in opacity matching the CSS preview ----
  const animType = resolveAyahStyle(ayah.style, opts.globalTextStyle).textAnimation;
  const dispStart = ayah.displayStart ?? ayah.startTime;
  const elapsed = time - dispStart;
  let animAlpha = 1;
  let animOffsetY = 0;
  let animScale = 1;
  if (animType !== 'none' && elapsed < ANIM_DURATION) {
    // CSS ease = cubic-bezier(0.25, 0.1, 0.25, 1.0)
    const t = Math.max(0, Math.min(1, elapsed / ANIM_DURATION));
    const eased = cubicBezierEase(t);
    animAlpha = eased;
    if (animType === 'slide-up') {
      animOffsetY = (1 - eased) * 16; // 16px slide like CSS
    } else if (animType === 'scale') {
      animScale = 0.9 + 0.1 * eased; // scale 0.9 → 1.0
    }
  }

  const style = resolveAyahStyle(ayah.style, opts.globalTextStyle);
  const color = style.textColor;
  const engFontStr = `"${opts.englishFont}", sans-serif`;
  const positions = resolvePositions(ayah, opts.verticalPosition, opts.arabicPosition, opts.englishPosition);
  const surahLabel = buildSurahLabelText(ayah, opts.showSurahLabel, opts.surahLabelLang);

  const arabicCenterX = (positions.arabic.x / 100) * W;
  const arabicCenterY = (positions.arabic.y / 100) * H + animOffsetY;
  const englishCenterX = (positions.english.x / 100) * W;
  const englishCenterY = (positions.english.y / 100) * H + animOffsetY;

  // Match the preview's containers exactly:
  //   Arabic:  width: min(92%, 900px)
  //   English: width: min(90%, 800px)
  // Tailwind's global border-box sizing means padding subtracts from that
  // width rather than adding to it, so we subtract it here too.
  const arabicMaxWidth = Math.min(W * 0.92, 900) - style.arabicPadding * 2;
  const englishMaxWidth = Math.min(W * 0.90, 800) - style.englishPadding * 2;

  // Apply animation: wrap the entire text-drawing section with animAlpha
  // and optional scale transform so the export matches the CSS animation.
  if (animScale !== 1) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(animScale, animScale);
    ctx.translate(-W / 2, -H / 2);
  }
  const savedGlobalAlpha = ctx.globalAlpha;

  drawArabicBlock(
    ctx, ayah, time, arabicCenterX, arabicCenterY, arabicMaxWidth,
    opts.arabicFont, opts.arabicAlign, style, opts.wordHighlight, animAlpha,
  );

  ctx.font = `${style.englishFontSize}px ${engFontStr}`; // set BEFORE measuring, or wrap widths are wrong
  const transLines = opts.showTranslation && ayah.translation
    ? wrapText(ctx, ayah.translation, englishMaxWidth)
    : [];
  const transLineH = style.englishFontSize * style.englishLineHeight;
  const labelFontSize = opts.surahLabelFontSize;
  // Match preview CSS: the label <p> has line-height ~1.2 (browser default
  // for a block-level element) and margin-top: 8px when following translation.
  const labelLineH = labelFontSize * 1.2;
  const labelGap = 8; // matches CSS margin: '8px 0 0'
  const labelH = surahLabel ? labelLineH : 0;
  const englishBlockH =
    (transLines.length > 0 ? transLines.length * transLineH + (surahLabel ? labelGap : 0) : 0) + labelH;

  if (englishBlockH > 0) {
    // When there ARE translation lines, start drawing at the baseline offset;
    // when there are only surah labels (no translation), shift by labelLineH baseline instead.
    const baselineOffset = transLines.length > 0 ? transLineH * 0.8 : labelLineH * 0.8;
    let y = englishCenterY - englishBlockH / 2 + baselineOffset;
    const textX = opts.englishAlign === 'center' ? englishCenterX : englishCenterX - englishMaxWidth / 2;

    if (transLines.length > 0) {
      ctx.font = `${style.englishFontSize}px ${engFontStr}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9 * animAlpha;
      applyCanvasAdaptiveShadow(ctx, color);
      ctx.textAlign = opts.englishAlign;
      for (const line of transLines) {
        ctx.fillText(line, textX, y);
        y += transLineH;
      }
      clearCanvasShadow(ctx);
      ctx.globalAlpha = savedGlobalAlpha;
      if (surahLabel) y += labelGap;
    }

    if (surahLabel) {
      ctx.font = `${labelFontSize}px ${engFontStr}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45 * animAlpha;
      clearCanvasShadow(ctx);
      ctx.textAlign = opts.englishAlign;
      ctx.fillText(
        surahLabelLangUppercase(surahLabel, opts.surahLabelLang),
        textX,
        y + labelLineH * 0.8,
      );
      ctx.globalAlpha = savedGlobalAlpha;
    }
  }

  // Restore animation transforms
  ctx.globalAlpha = savedGlobalAlpha;
  if (animScale !== 1) {
    ctx.restore();
  }
}

function surahLabelLangUppercase(text: string, lang: SurahLabelLang): string {
  return lang === 'arabic' ? text : text.toUpperCase();
}

/**
 * Attempt to approximate CSS `ease` (cubic-bezier(0.25, 0.1, 0.25, 1.0)).
 * Uses a simple iterative De Casteljau evaluation.
 */
function cubicBezierEase(t: number): number {
  // P0=(0,0) P1=(0.25,0.1) P2=(0.25,1.0) P3=(1,1)
  // We need to solve for y given the progress ratio t mapped to the
  // cubic-bezier's x axis.  A simple approximation: since the x-control
  // points (0.25, 0.25) are close to linear, we can just evaluate y(t)
  // directly for a reasonable match.
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  // y(t) = 3*mt²*t*0.1 + 3*mt*t²*1.0 + t³*1.0
  return 3 * mt2 * t * 0.1 + 3 * mt * t2 * 1.0 + t3 * 1.0;
}