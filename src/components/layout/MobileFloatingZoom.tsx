import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ZoomPreset } from '../document-preview/PdfLivePreview';

interface MobileFloatingZoomProps {
  zoomPreset: ZoomPreset;
  effectivePercent: number;
  visible: boolean;
  onStepZoom: (dir: -1 | 1) => void;
  onInteract?: () => void;
}

export const MobileFloatingZoom: React.FC<MobileFloatingZoomProps> = ({
  zoomPreset,
  effectivePercent,
  visible,
  onStepZoom,
  onInteract,
}) => {
  const isMaxZoom = effectivePercent >= 250;
  const isMinZoom = effectivePercent <= 40;

  const handleClick = (dir: -1 | 1) => {
    onInteract?.();
    onStepZoom(dir);
  };

  return (
    <div
      role="group"
      aria-label="Kontrol Zoom Mobile"
      aria-hidden={!visible}
      className={`no-print fixed bottom-[72px] right-3.5 z-30 flex flex-col gap-2.5 lg:hidden transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        visible
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : 'translate-x-[calc(100%+24px)] opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={() => handleClick(1)}
        disabled={isMaxZoom}
        tabIndex={visible ? 0 : -1}
        aria-label="Perbesar zoom"
        title="Perbesar"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.12)] backdrop-blur-md hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-40 transition-all"
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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.12)] backdrop-blur-md hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-40 transition-all"
      >
        <ZoomOut className="h-4.5 w-4.5" aria-hidden="true" />
      </button>
    </div>
  );
};
