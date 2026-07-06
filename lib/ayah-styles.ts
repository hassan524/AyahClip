export type TextAnimation = 'none' | 'fade' | 'slide-up' | 'scale';

export interface AyahSegmentStyle {
  textAnimation?: TextAnimation;
  arabicFontSize?: number;
  englishFontSize?: number;
  arabicLineHeight?: number;
  englishLineHeight?: number;
  arabicPadding?: number;
  englishPadding?: number;
  textColor?: string;
}

export interface GlobalTextStyle {
  textAnimation: TextAnimation;
  arabicFontSize: number;
  englishFontSize: number;
  arabicLineHeight: number;
  englishLineHeight: number;
  arabicPadding: number;
  englishPadding: number;
  textColor: string;
}

export const TEXT_ANIMATION_OPTIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade in' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'scale', label: 'Scale in' },
];

export function resolveAyahStyle(
  segmentStyle: AyahSegmentStyle | undefined,
  global: GlobalTextStyle,
) {
  const s = segmentStyle ?? {};
  return {
    textAnimation: s.textAnimation ?? global.textAnimation,
    arabicFontSize: s.arabicFontSize ?? global.arabicFontSize,
    englishFontSize: s.englishFontSize ?? global.englishFontSize,
    arabicLineHeight: s.arabicLineHeight ?? global.arabicLineHeight,
    englishLineHeight: s.englishLineHeight ?? global.englishLineHeight,
    arabicPadding: s.arabicPadding ?? global.arabicPadding,
    englishPadding: s.englishPadding ?? global.englishPadding,
    textColor: s.textColor ?? global.textColor,
  };
}

export function hasStyleOverride(
  segmentStyle: AyahSegmentStyle | undefined,
  field: keyof AyahSegmentStyle,
): boolean {
  return segmentStyle?.[field] !== undefined;
}
