import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Menu, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import type { ZoomPreset } from '../document-preview/PdfLivePreview';

export type WorkspaceRoute = '/kontrak' | '/penawaran' | '/invoice';

interface HeaderProps {
  activeRoute: WorkspaceRoute;
  isGeneratingPdf: boolean;
  zoomPreset: ZoomPreset;
  effectivePercent: number;
  currentPage?: number;
  pageCount?: number;
  onZoomChange: (preset: ZoomPreset) => void;
  onStepZoom: (dir: -1 | 1) => void;
  onGeneratePdf: () => void;
  onPrintPdf: () => void;
  onOpenMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  isGeneratingPdf,
  zoomPreset,
  effectivePercent,
  currentPage = 1,
  pageCount = 1,
  onZoomChange,
  onStepZoom,
  onGeneratePdf,
  onPrintPdf,
  onOpenMobileNav,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomMenuRef = useRef<HTMLDivElement | null>(null);

  const documentTitle =
    activeRoute === '/penawaran' || activeRoute === '/invoice'
      ? 'Surat Penawaran'
      : 'Surat Perjanjian Kerja Sama';

  useEffect(() => {
    if (!menuOpen && !zoomMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && menuContainerRef.current && !menuContainerRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (zoomMenuOpen && zoomMenuRef.current && !zoomMenuRef.current.contains(target)) {
        setZoomMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setZoomMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, zoomMenuOpen]);

  return (
    <header className="no-print relative z-30 flex min-h-14 w-full shrink-0 touch-none select-none border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
      {/* Desktop Sidebar Header Corner Box aligned flush with 272px Sidebar below */}
      <div className="hidden h-14 w-[272px] shrink-0 items-center border-r border-slate-200 px-4 lg:flex">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/logo-alinlabs.webp"
            alt="Logo AlinLabs Indonesia"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-sm font-bold tracking-normal text-blue-600 whitespace-nowrap">
              AlinLabs Indonesia
            </div>
            <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
              Agency &amp; Digital Solution
            </div>
          </div>
        </div>
      </div>

      {/* Main Header: Mobile Brand Lockup / Desktop Title on Left, Page Readout, Zoom Card & Print Menu on Right */}
      <div className="flex h-14 min-w-0 flex-1 items-center justify-between gap-2.5 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Navigasi dokumen"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 lg:hidden shrink-0 transition-colors"
          >
            <Menu className="h-4.5 w-4.5" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <img
              src="/logo-alinlabs.webp"
              alt="Logo AlinLabs Indonesia"
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="min-w-0 leading-tight">
              <div className="font-display text-sm font-bold tracking-normal text-blue-600 truncate">
                AlinLabs Indonesia
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {documentTitle}
              </div>
            </div>
          </div>

          <h1 className="hidden lg:block font-display text-base font-semibold text-slate-900 truncate">
            {documentTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {pageCount > 1 && (
            <span
              data-testid="desktop-page-indicator"
              className="hidden lg:inline-flex items-center font-mono text-xs font-medium tabular-nums text-slate-500 whitespace-nowrap"
            >
              Hal. {currentPage}/{pageCount}
            </span>
          )}

          {/* Desktop Single Zoom Card: Zoom Out | Percent | Zoom In with Custom Fit Popup */}
          <div ref={zoomMenuRef} className="relative hidden lg:block">
            <div
              role="group"
              aria-label="Kontrol Ukuran Tampilan PDF"
              className="inline-flex h-9 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs"
            >
              <button
                type="button"
                onClick={() => {
                  setZoomMenuOpen(false);
                  onStepZoom(-1);
                }}
                disabled={effectivePercent <= 40}
                aria-label="Perkecil zoom"
                title="Perkecil"
                className="inline-flex h-full w-8 items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <div className="h-5 w-px bg-slate-200" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setZoomMenuOpen((prev) => !prev);
                }}
                aria-label={`Ukuran tampilan ${effectivePercent}%, buka pilihan penyesuaian`}
                aria-haspopup="menu"
                aria-expanded={zoomMenuOpen}
                title="Pilih Fit Width atau Fit Page"
                className="inline-flex h-full min-w-[54px] items-center justify-center px-2.5 font-mono text-xs font-medium tabular-nums text-slate-800 hover:bg-slate-50 transition-colors"
              >
                {effectivePercent}%
              </button>

              <div className="h-5 w-px bg-slate-200" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  setZoomMenuOpen(false);
                  onStepZoom(1);
                }}
                disabled={effectivePercent >= 250}
                aria-label="Perbesar zoom"
                title="Perbesar"
                className="inline-flex h-full w-8 items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {zoomMenuOpen && (
              <div
                role="menu"
                aria-label="Pilihan penyesuaian halaman"
                className="absolute right-0 top-full z-50 mt-1.5 w-max min-w-max rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={zoomPreset === 'fit-width'}
                  onClick={() => {
                    onZoomChange('fit-width');
                    setZoomMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-2 text-left text-xs transition-colors ${
                    zoomPreset === 'fit-width'
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>Fit Width</span>
                  {zoomPreset === 'fit-width' && (
                    <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={zoomPreset === 'fit-page'}
                  onClick={() => {
                    onZoomChange('fit-page');
                    setZoomMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-2 text-left text-xs transition-colors ${
                    zoomPreset === 'fit-page'
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>Fit Page</span>
                  {zoomPreset === 'fit-page' && (
                    <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="hidden h-5 w-px bg-slate-200 lg:block" aria-hidden="true" />

          <div ref={menuContainerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setZoomMenuOpen(false);
                setMenuOpen((prev) => !prev);
              }}
              disabled={isGeneratingPdf}
              aria-label="Cetak atau Download PDF"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={isGeneratingPdf ? 'Menyiapkan dokumen PDF...' : 'Cetak / Download PDF'}
              className="inline-flex h-10 w-10 lg:h-9 lg:w-9 items-center justify-center rounded-md border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <Printer
                className={`h-4 w-4 ${isGeneratingPdf ? 'animate-pulse text-blue-600' : ''}`}
                aria-hidden="true"
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Pilihan cetak dan unduh"
                className="absolute right-0 top-full z-50 mt-1.5 w-max min-w-max rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={isGeneratingPdf}
                  onClick={() => {
                    setMenuOpen(false);
                    onPrintPdf();
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span>{isGeneratingPdf ? 'Menyiapkan...' : 'Cetak Print'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isGeneratingPdf}
                  onClick={() => {
                    setMenuOpen(false);
                    onGeneratePdf();
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span>{isGeneratingPdf ? 'Mengunduh...' : 'Download'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
