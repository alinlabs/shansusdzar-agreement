import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ZoomPreset } from '../document-preview/PdfLivePreview';

interface MobileFloatingZoomProps {
  zoomPreset: ZoomPreset;
  effectivePercent: number;
  visible: boolean;
  currentPage?: number;
  pageCount?: number;
  hasBottomBar?: boolean;
  onStepZoom: (dir: -1 | 1) => void;
  onInteract?: () => void;
}

export const MobileFloatingZoom: React.FC<MobileFloatingZoomProps> = ({
  effectivePercent,
  visible,
  currentPage = 1,
  pageCount = 1,
  hasBottomBar = true,
  onStepZoom,
  onInteract,
}) => {
  const isMaxZoom = effectivePercent >= 250;
  const isMinZoom = effectivePercent <= 40;
  const bottomPosClass = hasBottomBar
    ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
    : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))]';

  const handleClick = (dir: -1 | 1) => {
    onInteract?.();
    onStepZoom(dir);
  };

  return (
    <>
      {pageCount > 1 && (
        <div
          aria-hidden={!visible}
          data-testid="mobile-page-indicator"
          className={`no-print pointer-events-none fixed left-3.5 z-20 ${bottomPosClass} lg:hidden transition-opacity duration-200 ease-out ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 font-mono text-[11px] font-medium tabular-nums text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.12)]">
            Hal. {currentPage}/{pageCount}
          </div>
        </div>
      )}

      <div
        role="group"
        aria-label="Kontrol Zoom Mobile"
        aria-hidden={!visible}
        className={`no-print fixed right-3.5 z-20 ${bottomPosClass} flex flex-col gap-2.5 lg:hidden transition-opacity duration-200 ease-out ${
          visible
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => handleClick(1)}
          disabled={isMaxZoom}
          tabIndex={visible ? 0 : -1}
          aria-label="Perbesar zoom"
          title="Perbesar"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-40 transition-colors"
        >
          <ZoomIn className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => handleClick(-1)}
          disabled={isMinZoom}
          tabIndex={visible ? 0 : -1}
          aria-label="Perkecil zoom"
          title="Perkecil"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.12)] hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-40 transition-colors"
        >
          <ZoomOut className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>
    </>
  );
};
