import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { ContractDocument } from '../../types/contract';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  generateContractPdfBytes,
  type PdfGenerationOutput,
} from '../../services/pdfEngine';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

async function loadPdfDocumentSafely(pdfBytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  try {
    return await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/worker|fetch|import/i.test(msg)) {
      throw err;
    }
    // Fallback: load worker handler via Vite-bundled module and reset PDFWorker cache
    const g = globalThis as Record<string, unknown>;
    if (!g.pdfjsWorker) {
      // @ts-expect-error pdfjs-dist worker module does not ship TypeScript declarations
      g.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
    }
    const workerClass = (pdfjsLib as unknown as { PDFWorker?: Record<string, unknown> }).PDFWorker;
    if (workerClass && '_setupFakeWorkerGlobal' in workerClass) {
      delete workerClass._setupFakeWorkerGlobal;
    }
    return await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  }
}

export type ZoomPreset =
  | '50'
  | '75'
  | '100'
  | '125'
  | '150'
  | '175'
  | '200'
  | '225'
  | '250'
  | 'fit-width'
  | 'fit-page'
  | 'custom';

export const ZOOM_STEPS: ZoomPreset[] = [
  '50',
  '75',
  '100',
  '125',
  '150',
  '175',
  '200',
  '225',
  '250',
];
export const BASE_100_SCALE = 1.22;
export const MIN_ZOOM_SCALE = 0.45;
export const MAX_ZOOM_SCALE = 3.05;

function clampScale(scale: number): number {
  return Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, scale));
}

interface PdfLivePreviewProps<T = ContractDocument> {
  doc: T;
  zoomPreset: ZoomPreset;
  customScale?: number | null;
  targetPageRequest?: { page: number; nonce: number } | null;
  generateBytes?: (doc: T) => Promise<PdfGenerationOutput>;
  onEffectiveZoomChange?: (percent: number) => void;
  onPinchZoom?: (nextScale: number) => void;
  onUserScroll?: () => void;
  onPdfGenerated?: (
    bytes: Uint8Array,
    pageCount: number,
    anchorPages: Record<string, number>
  ) => void;
}

interface PageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  isPriority: boolean;
  wrapperRef?: (el: HTMLDivElement | null) => void;
}

const PdfPageCanvas: React.FC<PageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  isPriority,
  wrapperRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedStateRef = useRef<{
    pdfDoc: pdfjsLib.PDFDocumentProxy;
    scale: number;
  } | null>(null);

  const targetWidthPx = Math.max(1, Math.floor(A4_WIDTH_PT * scale));
  const targetHeightPx = Math.max(1, Math.floor(A4_HEIGHT_PT * scale));

  useEffect(() => {
    const prevRendered = renderedStateRef.current;
    if (
      prevRendered &&
      prevRendered.pdfDoc === pdfDoc &&
      Math.abs(prevRendered.scale - scale) < 0.002
    ) {
      return;
    }

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    // Priority pages coalesce briefly so continuous pinch-to-zoom scales smoothly via CSS
    // without restarting heavy vector rasterization on every touch/wheel frame.
    const hasExistingBitmap = Boolean(prevRendered);
    const delayMs = isPriority ? (hasExistingBitmap ? 85 : 0) : 240;

    const timer = window.setTimeout(async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const visibleCanvas = canvasRef.current;
        if (!visibleCanvas) return;

        const rawDpr = window.devicePixelRatio || 1;
        const maxDpr = scale > 2.0 ? 1.35 : scale > 1.35 ? 1.65 : 2.25;
        const dpr = Math.min(Math.max(rawDpr, 1.35), maxDpr);
        const renderViewport = page.getViewport({ scale: scale * dpr });

        // Render into an offscreen buffer so the visible canvas never clears/flickers mid-zoom
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.max(1, Math.floor(renderViewport.width));
        offscreen.height = Math.max(1, Math.floor(renderViewport.height));
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;

        renderTask = page.render({
          canvasContext: offCtx,
          viewport: renderViewport,
          canvas: offscreen,
        });
        await renderTask.promise;
        if (cancelled) return;

        const targetCanvas = canvasRef.current;
        if (!targetCanvas) return;
        targetCanvas.width = offscreen.width;
        targetCanvas.height = offscreen.height;
        const targetCtx = targetCanvas.getContext('2d');
        if (targetCtx) {
          targetCtx.drawImage(offscreen, 0, 0);
        }
        renderedStateRef.current = { pdfDoc, scale };
      } catch {
        // Ignore cancellation errors on rapid zooming or document updates
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale, isPriority]);

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      style={{ width: `${targetWidthPx}px`, height: `${targetHeightPx}px` }}
      className="relative shrink-0 bg-white shadow-sm ring-1 ring-slate-300/80"
    >
      <canvas
        ref={canvasRef}
        data-testid={`pdf-preview-page-${pageNumber}`}
        className="block h-full w-full"
      />
    </div>
  );
};

interface ScrollMetrics {
  scale: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

export function PdfLivePreview<T = ContractDocument>({
  doc,
  zoomPreset,
  customScale,
  targetPageRequest,
  generateBytes,
  onEffectiveZoomChange,
  onPinchZoom,
  onUserScroll,
  onPdfGenerated,
}: PdfLivePreviewProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const onPdfGeneratedRef = useRef(onPdfGenerated);
  onPdfGeneratedRef.current = onPdfGenerated;
  const onEffectiveZoomChangeRef = useRef(onEffectiveZoomChange);
  onEffectiveZoomChangeRef.current = onEffectiveZoomChange;
  const onPinchZoomRef = useRef(onPinchZoom);
  onPinchZoomRef.current = onPinchZoom;
  const onUserScrollRef = useRef(onUserScroll);
  onUserScrollRef.current = onUserScroll;
  const generateBytesRef = useRef(generateBytes);
  generateBytesRef.current = generateBytes;
  const prevMetricsRef = useRef<ScrollMetrics | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);

  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [visiblePages, setVisiblePages] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [containerSize, setContainerSize] = useState({ width: 640, height: 760 });
  const [renderError, setRenderError] = useState<string | null>(null);

  const markProgrammaticScroll = () => {
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticScrollTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, []);

  // Measure preview viewport for Fit Width / Fit Page calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const nextWidth = el.clientWidth;
      const nextHeight = el.clientHeight;
      setContainerSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate exact vector PDF bytes from the single-source-of-truth pdfEngine
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setRenderError(null);
      try {
        const generator = generateBytesRef.current;
        const { pdfBytes, pageCount: totalPages, anchorPages } = generator
          ? await generator(doc)
          : await generateContractPdfBytes(doc as unknown as ContractDocument);
        if (cancelled) return;
        onPdfGeneratedRef.current?.(pdfBytes, totalPages, anchorPages);

        // Pass a copy to PDF.js because getDocument transfers the buffer to worker
        const loaded = await loadPdfDocumentSafely(pdfBytes);
        if (cancelled) {
          loaded.cleanup();
          return;
        }
        setPdfProxy((prev) => {
          prev?.cleanup();
          return loaded;
        });
        setPageCount(loaded.numPages);
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Gagal merender preview PDF');
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc]);

  // Observe which pages are inside or near the viewport to prioritize sharp rendering
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !pdfProxy) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const entry of entries) {
            const pAttr = (entry.target as HTMLElement).dataset.pageNumber;
            const pNum = pAttr ? Number(pAttr) : 0;
            if (!pNum) continue;
            if (Boolean(next[pNum]) !== entry.isIntersecting) {
              next[pNum] = entry.isIntersecting;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      {
        root,
        rootMargin: '550px 200px',
        threshold: 0.01,
      }
    );

    for (let i = 1; i <= pageCount; i += 1) {
      const node = pageWrapperRefs.current[i];
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [pdfProxy, pageCount]);

  // Jump to requested page from Table of Contents navigation
  useEffect(() => {
    if (!targetPageRequest || !pdfProxy) return;
    const clamped = Math.max(1, Math.min(pageCount, targetPageRequest.page));

    const frame = requestAnimationFrame(() => {
      const targetEl = pageWrapperRefs.current[clamped];
      if (targetEl) {
        markProgrammaticScroll();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [targetPageRequest, pageCount, pdfProxy]);

  // Calculate effective PDF.js scale:
  // Fit Width on desktop matches the exact header content area width (px-6 = 24px each side -> 48px total).
  const computeScale = (): number => {
    const horizPad = containerSize.width < 640 ? 32 : 48;
    const usableWidth = Math.max(240, containerSize.width - horizPad);
    const usableHeight = Math.max(320, containerSize.height - horizPad);

    if (zoomPreset === 'custom' && typeof customScale === 'number' && customScale > 0) {
      return clampScale(customScale);
    }

    switch (zoomPreset) {
      case '50':
        return (50 / 100) * BASE_100_SCALE;
      case '75':
        return (75 / 100) * BASE_100_SCALE;
      case '100':
        return BASE_100_SCALE;
      case '125':
        return (125 / 100) * BASE_100_SCALE;
      case '150':
        return (150 / 100) * BASE_100_SCALE;
      case '175':
        return (175 / 100) * BASE_100_SCALE;
      case '200':
        return (200 / 100) * BASE_100_SCALE;
      case '225':
        return (225 / 100) * BASE_100_SCALE;
      case '250':
        return (250 / 100) * BASE_100_SCALE;
      case 'fit-page': {
        const scaleW = usableWidth / A4_WIDTH_PT;
        const scaleH = usableHeight / A4_HEIGHT_PT;
        return clampScale(Math.min(scaleW, scaleH));
      }
      case 'fit-width':
      default: {
        const scaleW = usableWidth / A4_WIDTH_PT;
        return clampScale(scaleW);
      }
    }
  };

  const effectiveScale = computeScale();
  const effectiveScaleRef = useRef(effectiveScale);
  effectiveScaleRef.current = effectiveScale;

  const isFixedNumericPreset =
    zoomPreset === '50' ||
    zoomPreset === '75' ||
    zoomPreset === '100' ||
    zoomPreset === '125' ||
    zoomPreset === '150' ||
    zoomPreset === '175' ||
    zoomPreset === '200' ||
    zoomPreset === '225' ||
    zoomPreset === '250';

  const effectivePercent = isFixedNumericPreset
    ? Number(zoomPreset)
    : Math.round((effectiveScale / BASE_100_SCALE) * 100);

  useEffect(() => {
    onEffectiveZoomChangeRef.current?.(effectivePercent);
  }, [effectivePercent]);

  // Pinch-to-Zoom handler for BOTH Mobile (2-finger touch pinch) and Desktop (trackpad pinch / Ctrl+wheel / Safari gesture)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartDist = 0;
    let touchStartScale = effectiveScaleRef.current;
    let gestureStartScale = effectiveScaleRef.current;
    let pendingScale: number | null = null;
    let rafId: number | null = null;

    const flushPinchScale = () => {
      rafId = null;
      if (pendingScale !== null) {
        const commit = pendingScale;
        pendingScale = null;
        onPinchZoomRef.current?.(commit);
      }
    };

    const schedulePinchScale = (nextScale: number) => {
      pendingScale = clampScale(nextScale);
      if (rafId === null) {
        rafId = window.requestAnimationFrame(flushPinchScale);
      }
    };

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDist = getTouchDist(e.touches[0], e.touches[1]);
        touchStartScale = effectiveScaleRef.current;
        onUserScrollRef.current?.();
      } else {
        touchStartDist = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const ratio = dist / touchStartDist;
        schedulePinchScale(touchStartScale * ratio);
        onUserScrollRef.current?.();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchStartDist = 0;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const normalizedDelta =
          e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
        const clampedDelta = Math.max(-60, Math.min(60, normalizedDelta));
        const factor = Math.exp(-clampedDelta * 0.0065);
        const base = pendingScale ?? effectiveScaleRef.current;
        schedulePinchScale(base * factor);
      }
    };

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartScale = effectiveScaleRef.current;
      onUserScrollRef.current?.();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureScale = (e as unknown as { scale?: number }).scale;
      if (typeof gestureScale === 'number' && gestureScale > 0) {
        schedulePinchScale(gestureStartScale * gestureScale);
      }
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('gesturestart', handleGestureStart, { passive: false });
    el.addEventListener('gesturechange', handleGestureChange, { passive: false });
    el.addEventListener('gestureend', handleGestureEnd, { passive: false });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('gesturestart', handleGestureStart);
      el.removeEventListener('gesturechange', handleGestureChange);
      el.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  // Always calibrate paper horizontally to center whenever zooming in/out (and preserve vertical focal ratio)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !pdfProxy) return;

    const calibrateCenter = () => {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      markProgrammaticScroll();
      el.scrollLeft = maxScrollLeft > 0 ? Math.round(maxScrollLeft / 2) : 0;
    };

    const prev = prevMetricsRef.current;
    if (prev && Math.abs(prev.scale - effectiveScale) > 0.001) {
      calibrateCenter();

      if (prev.scrollHeight > prev.clientHeight + 2 && el.scrollHeight > el.clientHeight) {
        const ratioY = (prev.scrollTop + prev.clientHeight / 2) / prev.scrollHeight;
        const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
        markProgrammaticScroll();
        el.scrollTop = Math.max(0, Math.min(maxScrollTop, el.scrollHeight * ratioY - el.clientHeight / 2));
      }
    } else if (!prev) {
      calibrateCenter();
    } else {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScrollLeft === 0 && el.scrollLeft !== 0) {
        markProgrammaticScroll();
        el.scrollLeft = 0;
      }
    }

    prevMetricsRef.current = {
      scale: effectiveScale,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    };
  }, [effectiveScale, pdfProxy, pageCount, containerSize.width]);

  const handleContainerScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    prevMetricsRef.current = {
      scale: effectiveScale,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    };
    if (!isProgrammaticScrollRef.current) {
      onUserScrollRef.current?.();
    }
  };

  const pagesToShow = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      {/* Continuous Bidirectional Scroll Document Viewport with Pinch-to-Zoom */}
      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        style={{ touchAction: 'pan-x pan-y' }}
        data-testid="preview-page-count"
        data-page-count={pageCount}
        className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
      >
        {renderError ? (
          <div className="m-4 sm:m-6 mx-auto max-w-md rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            Gagal merender dokumen PDF: {renderError}
          </div>
        ) : !pdfProxy ? (
          <div className="flex h-64 items-center justify-center p-4 text-xs text-slate-500">
            Menyiapkan pratinjau dokumen A4 vektor...
          </div>
        ) : (
          <div className="flex min-w-full w-max flex-col items-center gap-5 p-4 sm:p-6">
            {pagesToShow.map((pNum) => (
              <PdfPageCanvas
                key={pNum}
                pdfDoc={pdfProxy}
                pageNumber={pNum}
                scale={effectiveScale}
                isPriority={Boolean(visiblePages[pNum]) || pNum <= 2}
                wrapperRef={(el) => {
                  pageWrapperRefs.current[pNum] = el;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
