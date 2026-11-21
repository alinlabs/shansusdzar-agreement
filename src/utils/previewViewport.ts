export function computePaperWidthPx(paperWidthPt: number, effectiveScale: number): number {
  if (!Number.isFinite(paperWidthPt) || !Number.isFinite(effectiveScale)) {
    return 1;
  }
  return Math.max(1, Math.floor(paperWidthPt * effectiveScale));
}

/**
 * Horizontal scroll/pan is allowed ONLY when the rendered paper itself is wider
 * than the visible viewport container (edges are actually clipped).
 */
export function shouldAllowHorizontalScroll(
  paperWidthPx: number,
  containerWidthPx: number
): boolean {
  if (!Number.isFinite(paperWidthPx) || !Number.isFinite(containerWidthPx)) {
    return false;
  }
  if (containerWidthPx <= 0) {
    return false;
  }
  return paperWidthPx > containerWidthPx;
}

/**
 * Resolves a crisp backing-store DPR for PDF.js page canvases across iOS Retina (2x/3x),
 * Android (1.5x-3x), and Microsoft Windows (1x, 1.25x, 1.5x, 2x) while capping VRAM
 * at high zoom levels so long multi-page PDFs never trigger WebKit tile ghosting.
 */
export function resolveRenderDpr(rawDpr: number, scale: number): number {
  const safeRawDpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
  if (scale > 2.0) {
    return 1.5;
  }
  if (scale > 1.35) {
    return safeRawDpr >= 1.75 ? 2 : 1.5;
  }
  if (scale < 0.85) {
    if (safeRawDpr >= 2.5) return 2.5;
    if (safeRawDpr >= 1.5) return 2;
    return 1.5;
  }
  if (safeRawDpr >= 1.75) {
    return 2;
  }
  return 1.5;
}
