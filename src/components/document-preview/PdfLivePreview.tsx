import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { ContractDocument } from '../../types/contract';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  generateContractPdfBytes,
  type PdfGenerationOutput,
} from '../../services/pdfEngine';
import {
  computePaperWidthPx,
  resolveRenderDpr,
  shouldAllowHorizontalScroll,
} from '../../utils/previewViewport';

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

interface RenderQueueItem {
  pageNumber: number;
  run: () => Promise<void>;
}

/**
 * Lightweight concurrency scheduler so visible PDF pages rasterize immediately
 * while offscreen pages trickle in smoothly without starving mobile/iOS compositing
 * or cancelling in-flight renders during momentum scrolling.
 */
class PdfRenderCoordinator {
  private activeCount = 0;
  private readonly maxConcurrent = 2;
  private queue: RenderQueueItem[] = [];
  private priorityPages: Set<number> = new Set([1, 2]);
  private pumpTimer: number | null = null;

  setPriorityPages(next: Set<number>) {
    this.priorityPages = next;
    this.schedulePump();
  }

  enqueue(item: RenderQueueItem): () => void {
    this.queue = this.queue.filter((q) => q.pageNumber !== item.pageNumber);
    this.queue.push(item);
    this.schedulePump();
    return () => {
      this.queue = this.queue.filter((q) => q !== item);
    };
  }

  clear() {
    this.queue = [];
    if (this.pumpTimer !== null) {
      window.clearTimeout(this.pumpTimer);
      this.pumpTimer = null;
    }
  }

  private schedulePump(delayMs = 0) {
    if (this.pumpTimer !== null) return;
    this.pumpTimer = window.setTimeout(() => {
      this.pumpTimer = null;
      this.pump();
    }, delayMs);
  }

  private pump() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      let nextIdx = this.queue.findIndex(
        (item) => this.priorityPages.has(item.pageNumber) || item.pageNumber <= 2
      );
      if (nextIdx === -1) {
        // Keep at most 1 background offscreen render active at once so scroll stays silky
        if (this.activeCount >= 1) return;
        nextIdx = 0;
      }
      const [nextItem] = this.queue.splice(nextIdx, 1);
      if (!nextItem) break;
      this.activeCount += 1;
      void nextItem.run().finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.schedulePump(20);
      });
    }
  }
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
  onVisiblePageChange?: (page: number, pageCount: number) => void;
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
  coordinator: PdfRenderCoordinator;
  onRegisterWrapper: (pageNumber: number, el: HTMLDivElement | null) => void;
}

const PdfPageCanvas = memo<PageCanvasProps>(
  ({ pdfDoc, pageNumber, scale, coordinator, onRegisterWrapper }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderedStateRef = useRef<{
      pdfDoc: pdfjsLib.PDFDocumentProxy;
      scale: number;
    } | null>(null);
    const [hasRendered, setHasRendered] = useState(false);

    const targetWidthPx = computePaperWidthPx(A4_WIDTH_PT, scale);
    const targetHeightPx = Math.max(1, Math.floor(A4_HEIGHT_PT * scale));

    const handleWrapperRef = useCallback(
      (el: HTMLDivElement | null) => {
        onRegisterWrapper(pageNumber, el);
      },
      [pageNumber, onRegisterWrapper]
    );

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
      let cancelQueue: (() => void) | null = null;
      let renderTask: pdfjsLib.RenderTask | null = null;

      // Keep pinch-to-zoom smooth: coalesce brief zoom bursts before rasterizing
      const delayMs = prevRendered ? 85 : 0;

      const timer = window.setTimeout(() => {
        if (cancelled) return;
        cancelQueue = coordinator.enqueue({
          pageNumber,
          run: async () => {
            if (cancelled) return;
            try {
              const page = await pdfDoc.getPage(pageNumber);
              if (cancelled) return;

              const visibleCanvas = canvasRef.current;
              if (!visibleCanvas) return;

              const dpr = resolveRenderDpr(window.devicePixelRatio || 1, scale);
              const physicalWidth = Math.max(1, Math.round(targetWidthPx * dpr));
              const physicalHeight = Math.max(1, Math.round(targetHeightPx * dpr));
              const renderViewport = page.getViewport({ scale: physicalWidth / A4_WIDTH_PT });

              // Opaque white offscreen canvas prevents iOS/WebKit alpha-blending text ghosting during scroll
              const offscreen = document.createElement('canvas');
              offscreen.width = physicalWidth;
              offscreen.height = physicalHeight;
              const offCtx = offscreen.getContext('2d', { alpha: false });
              if (!offCtx) return;

              offCtx.fillStyle = '#ffffff';
              offCtx.fillRect(0, 0, physicalWidth, physicalHeight);

              renderTask = page.render({
                canvasContext: offCtx,
                viewport: renderViewport,
                canvas: offscreen,
              });
              await renderTask.promise;
              if (cancelled) return;

              const targetCanvas = canvasRef.current;
              if (!targetCanvas) return;
              targetCanvas.width = physicalWidth;
              targetCanvas.height = physicalHeight;
              const targetCtx = targetCanvas.getContext('2d', { alpha: false });
              if (targetCtx) {
                targetCtx.drawImage(offscreen, 0, 0);
              }
              renderedStateRef.current = { pdfDoc, scale };
              setHasRendered(true);
            } catch {
              // Ignore cancellation errors on rapid zooming or document updates
            }
          },
        });
      }, delayMs);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        if (cancelQueue) {
          cancelQueue();
        }
        if (renderTask) {
          renderTask.cancel();
        }
      };
    }, [pdfDoc, pageNumber, scale, targetWidthPx, targetHeightPx, coordinator]);

    return (
      <div
        ref={handleWrapperRef}
        data-page-number={pageNumber}
        style={{
          width: `${targetWidthPx}px`,
          height: `${targetHeightPx}px`,
          contain: 'layout paint',
        }}
        className="relative shrink-0 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)] ring-1 ring-slate-300/75"
      >
        {!hasRendered && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-50"
          >
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              Halaman {pageNumber}
            </span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          data-testid={`pdf-preview-page-${pageNumber}`}
          className="block h-full w-full"
        />
      </div>
    );
  }
);

PdfPageCanvas.displayName = 'PdfPageCanvas';

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
  onVisiblePageChange,
  onPdfGenerated,
}: PdfLivePreviewProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const coordinatorRef = useRef<PdfRenderCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new PdfRenderCoordinator();
  }
  const priorityPagesRef = useRef<Set<number>>(new Set([1, 2]));

  const onPdfGeneratedRef = useRef(onPdfGenerated);
  onPdfGeneratedRef.current = onPdfGenerated;
  const onEffectiveZoomChangeRef = useRef(onEffectiveZoomChange);
  onEffectiveZoomChangeRef.current = onEffectiveZoomChange;
  const onPinchZoomRef = useRef(onPinchZoom);
  onPinchZoomRef.current = onPinchZoom;
  const onUserScrollRef = useRef(onUserScroll);
  onUserScrollRef.current = onUserScroll;
  const onVisiblePageChangeRef = useRef(onVisiblePageChange);
  onVisiblePageChangeRef.current = onVisiblePageChange;
  const generateBytesRef = useRef(generateBytes);
  generateBytesRef.current = generateBytes;

  const prevMetricsRef = useRef<ScrollMetrics | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);
  const lastReportedVisibleRef = useRef<{ page: number; count: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const lastUserScrollNotifyTsRef = useRef(0);

  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 640, height: 760 });
  const [renderError, setRenderError] = useState<string | null>(null);

  const registerPageWrapper = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    pageWrapperRefs.current[pageNumber] = el;
  }, []);

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
    const coordinator = coordinatorRef.current;
    return () => {
      coordinator?.clear();
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Measure preview viewport accurately (clientWidth excludes OS/Windows vertical scrollbar)
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
        coordinatorRef.current?.clear();
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

  // Observe visible/near-viewport pages via mutable Set (zero React re-renders during scroll)
  useEffect(() => {
    const root = containerRef.current;
    const coordinator = coordinatorRef.current;
    if (!root || !pdfProxy || !coordinator) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        const nextSet = new Set(priorityPagesRef.current);
        for (const entry of entries) {
          const pAttr = (entry.target as HTMLElement).dataset.pageNumber;
          const pNum = pAttr ? Number(pAttr) : 0;
          if (!pNum) continue;
          if (entry.isIntersecting && !nextSet.has(pNum)) {
            nextSet.add(pNum);
            changed = true;
          } else if (!entry.isIntersecting && pNum > 2 && nextSet.has(pNum)) {
            nextSet.delete(pNum);
            changed = true;
          }
        }
        if (changed) {
          priorityPagesRef.current = nextSet;
          coordinator.setPriorityPages(nextSet);
        }
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

  // Jump to requested page from Table of Contents navigation (strictly scrolling inner container, never window)
  useEffect(() => {
    if (!targetPageRequest || !pdfProxy) return;
    const clamped = Math.max(1, Math.min(pageCount, targetPageRequest.page));

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      const targetEl = pageWrapperRefs.current[clamped];
      if (container && targetEl) {
        markProgrammaticScroll();
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const padTop = container.clientWidth < 640 ? 14 : 22;
        const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - padTop;
        container.scrollTo({
          top: Math.max(0, nextTop),
          behavior: 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [targetPageRequest, pageCount, pdfProxy]);

  const reportVisiblePage = useCallback(() => {
    const el = containerRef.current;
    if (!el || pageCount <= 0) return;
    const focusY = el.getBoundingClientRect().top + el.clientHeight * 0.32;
    let bestPage = 1;
    let bestDist = Infinity;
    for (let i = 1; i <= pageCount; i += 1) {
      const wrapper = pageWrapperRefs.current[i];
      if (!wrapper) continue;
      const rect = wrapper.getBoundingClientRect();
      if (rect.top <= focusY && rect.bottom >= focusY) {
        bestPage = i;
        break;
      }
      const mid = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(mid - focusY);
      if (dist < bestDist) {
        bestDist = dist;
        bestPage = i;
      }
    }
    const prev = lastReportedVisibleRef.current;
    if (!prev || prev.page !== bestPage || prev.count !== pageCount) {
      lastReportedVisibleRef.current = { page: bestPage, count: pageCount };
      onVisiblePageChangeRef.current?.(bestPage, pageCount);
    }
  }, [pageCount]);

  useEffect(() => {
    if (!pdfProxy) return;
    const frame = requestAnimationFrame(reportVisiblePage);
    return () => cancelAnimationFrame(frame);
  }, [pdfProxy, pageCount, reportVisiblePage]);

  // Calculate effective PDF.js scale:
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

  const paperWidthPx = computePaperWidthPx(A4_WIDTH_PT, effectiveScale);
  const isPaperClippedHoriz = shouldAllowHorizontalScroll(paperWidthPx, containerSize.width);
  const isPaperClippedHorizRef = useRef(isPaperClippedHoriz);
  isPaperClippedHorizRef.current = isPaperClippedHoriz;

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

  // Pinch-to-Zoom handler for Mobile (2-finger pinch), Desktop trackpad (Ctrl+wheel), and Safari gesture events
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

  // Calibrate paper horizontally to center whenever zooming in/out, and keep scrollLeft=0 unless paper clips
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !pdfProxy) return;

    const calibrateCenter = () => {
      if (!isPaperClippedHoriz) {
        if (el.scrollLeft !== 0) {
          markProgrammaticScroll();
          el.scrollLeft = 0;
        }
        return;
      }
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
    } else if (!isPaperClippedHoriz && el.scrollLeft !== 0) {
      markProgrammaticScroll();
      el.scrollLeft = 0;
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
  }, [effectiveScale, pdfProxy, pageCount, containerSize.width, isPaperClippedHoriz]);

  const handleContainerScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!isPaperClippedHorizRef.current && el.scrollLeft !== 0) {
      el.scrollLeft = 0;
    }

    prevMetricsRef.current = {
      scale: effectiveScaleRef.current,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    };

    if (scrollRafRef.current === null) {
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        reportVisiblePage();
      });
    }

    if (!isProgrammaticScrollRef.current) {
      const now = Date.now();
      if (now - lastUserScrollNotifyTsRef.current >= 250) {
        lastUserScrollNotifyTsRef.current = now;
        onUserScrollRef.current?.();
      }
    }
  };

  const pagesToShow = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-100">
      {/* Vertical-locked viewport by default; unlocks horizontal pan ONLY when paper itself exceeds screen width */}
      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        style={{ touchAction: isPaperClippedHoriz ? 'pan-x pan-y' : 'pan-y' }}
        data-testid="preview-page-count"
        data-page-count={pageCount}
        data-paper-width-px={paperWidthPx}
        data-horiz-scrollable={isPaperClippedHoriz ? 'true' : 'false'}
        className={`pdf-scroll-viewport min-h-0 min-w-0 flex-1 overscroll-y-contain ${
          isPaperClippedHoriz ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'
        }`}
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
          <div
            className={`flex flex-col items-center gap-5 py-4 sm:py-6 ${
              isPaperClippedHoriz
                ? 'min-w-full w-max px-4 sm:px-6'
                : 'w-full overflow-x-hidden px-0'
            }`}
          >
            {pagesToShow.map((pNum) => (
              <PdfPageCanvas
                key={pNum}
                pdfDoc={pdfProxy}
                pageNumber={pNum}
                scale={effectiveScale}
                coordinator={coordinatorRef.current!}
                onRegisterWrapper={registerPageWrapper}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
