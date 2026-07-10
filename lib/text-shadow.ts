export function getTextLuminance(hexColor: string): number {
  const clean = hexColor.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** CSS text-shadow string — matches VideoPreview rendering */
export function getAdaptiveShadow(hexColor: string): string {
  return getTextLuminance(hexColor) > 0.6
    ? '0 2px 8px rgba(0,0,0,0.85)'
    : '0 1px 4px rgba(255,255,255,0.5)';
}

/** Apply preview-matching shadow on a canvas 2D context */
export function applyCanvasAdaptiveShadow(
  ctx: CanvasRenderingContext2D,
  hexColor: string,
  glowColor?: string,
) {
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }
  const light = getTextLuminance(hexColor) > 0.6;
  ctx.shadowColor = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.5)';
  ctx.shadowBlur = light ? 8 : 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = light ? 2 : 1;
}

export function clearCanvasShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
