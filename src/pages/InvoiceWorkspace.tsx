import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { InvoiceDocument } from '../types/invoice';
import { loadContract, loadInvoiceForContract } from '../services/documentService';
import { generateInvoicePdfBytes, INVOICE_TOC_ITEMS } from '../services/invoicePdfEngine';
import { printPdfFromBytes } from '../utils/pdfPrint';
import { Header, type WorkspaceRoute } from '../components/layout/Header';
import { DocumentBottomNav } from '../components/layout/DocumentBottomNav';
import { MobileFloatingZoom } from '../components/layout/MobileFloatingZoom';
import { InvoiceSidebar } from '../components/invoice/InvoiceSidebar';
import {
  PdfLivePreview,
  ZOOM_STEPS,
  type ZoomPreset,
} from '../components/document-preview/PdfLivePreview';

interface InvoiceWorkspaceProps {
  onNavigate: (route: WorkspaceRoute) => void;
}

export const InvoiceWorkspace: React.FC<InvoiceWorkspaceProps> = ({ onNavigate }) => {
  const [invoice, setInvoice] = useState<InvoiceDocument | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('inv-header');
  const [anchorPages, setAnchorPages] = useState<Record<string, number>>({});
  const [targetPageRequest, setTargetPageRequest] = useState<{
    page: number;
    nonce: number;
  } | null>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileZoomVisible, setMobileZoomVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit-width');
  const [customScale, setCustomScale] = useState<number | null>(null);
  const [effectivePercent, setEffectivePercent] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [toast, setToast] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const latestPdfBytesRef = useRef<Uint8Array | null>(null);
  const mobileZoomTimerRef = useRef<number | null>(null);
  const manualNavLockUntilRef = useRef<number>(0);

  const triggerMobileZoomReveal = useCallback(() => {
    setMobileZoomVisible(true);
    if (mobileZoomTimerRef.current !== null) {
      window.clearTimeout(mobileZoomTimerRef.current);
    }
    mobileZoomTimerRef.current = window.setTimeout(() => {
      setMobileZoomVisible(false);
      mobileZoomTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    const resetWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    const vv = window.visualViewport;
    vv?.addEventListener('resize', resetWindowScroll);
    vv?.addEventListener('scroll', resetWindowScroll);
    return () => {
      vv?.removeEventListener('resize', resetWindowScroll);
      vv?.removeEventListener('scroll', resetWindowScroll);
      if (mobileZoomTimerRef.current !== null) {
        window.clearTimeout(mobileZoomTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      setMobileZoomVisible(false);
      if (mobileZoomTimerRef.current !== null) {
        window.clearTimeout(mobileZoomTimerRef.current);
        mobileZoomTimerRef.current = null;
      }
    }
  }, [mobileNavOpen]);

  useEffect(() => {
    latestPdfBytesRef.current = null;
  }, [invoice]);

  const showToast = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const handleZoomPresetChange = useCallback((preset: ZoomPreset) => {
    setCustomScale(null);
    setZoomPreset(preset);
  }, []);

  const handlePinchZoom = useCallback((nextScale: number) => {
    setCustomScale(nextScale);
    setZoomPreset('custom');
  }, []);

  const handleStepZoom = useCallback(
    (dir: -1 | 1) => {
      setCustomScale(null);
      setZoomPreset((current) => {
        const idx = ZOOM_STEPS.indexOf(current);
        if (idx === -1) {
          const numericSteps = [50, 75, 100, 125, 150, 175, 200, 225, 250];
          if (dir > 0) {
            const nextStep = numericSteps.find((s) => s > effectivePercent + 3);
            return String(nextStep ?? 250) as ZoomPreset;
          }
          const prevSteps = numericSteps.filter((s) => s < effectivePercent - 3);
          if (prevSteps.length > 0) {
            return String(prevSteps[prevSteps.length - 1]) as ZoomPreset;
          }
          return typeof window !== 'undefined' && window.innerWidth < 640 ? 'fit-width' : '50';
        }
        if (dir < 0 && idx === 0 && typeof window !== 'undefined' && window.innerWidth < 640) {
          return 'fit-width';
        }
        const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir));
        return ZOOM_STEPS[nextIdx];
      });
    },
    [effectivePercent]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const contract = await loadContract();
        if (!active) return;
        const loadedInvoice = loadInvoiceForContract(contract);
        setInvoice(loadedInvoice);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Gagal memuat data penawaran');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleJumpToAnchor = useCallback(
    (anchorId: string) => {
      manualNavLockUntilRef.current = Date.now() + 700;
      setActiveAnchorId(anchorId);
      setMobileNavOpen(false);
      const targetPage = anchorPages[anchorId] ?? 1;
      setCurrentPage(targetPage);
      setTargetPageRequest({ page: targetPage, nonce: Date.now() });
    },
    [anchorPages]
  );

  const handleVisiblePageChange = useCallback(
    (page: number, total: number) => {
      setCurrentPage(page);
      setPageCount(total);
      if (Date.now() < manualNavLockUntilRef.current) return;
      let matchedId = INVOICE_TOC_ITEMS[0]?.id ?? 'inv-header';
      for (const item of INVOICE_TOC_ITEMS) {
        const startPage = anchorPages[item.id];
        if (typeof startPage === 'number' && startPage <= page) {
          matchedId = item.id;
        }
      }
      setActiveAnchorId(matchedId);
    },
    [anchorPages]
  );

  const handleGeneratePdf = async () => {
    if (!invoice) return;
    setIsGeneratingPdf(true);
    try {
      const result = await generateInvoicePdfBytes(invoice);
      latestPdfBytesRef.current = result.pdfBytes;
      const blob = new Blob([Uint8Array.from(result.pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeNum = (invoice.invoiceNumber || 'ALIN-QUOTATION').replace(/[^a-zA-Z0-9_-]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `QUOTATION-${safeNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showToast(`PDF Penawaran resmi (${safeNum}.pdf) berhasil diunduh.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat file PDF Penawaran', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!invoice) return;
    const safeNum = invoice.invoiceNumber || 'ALIN-QUOTATION';
    const title = `Surat Penawaran - ${safeNum}`;
    const cachedBytes = latestPdfBytesRef.current;

    if (cachedBytes) {
      try {
        await printPdfFromBytes(cachedBytes, { title });
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal membuka pratinjau PDF penawaran di tab baru.',
          'error'
        );
      }
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const { pdfBytes } = await generateInvoicePdfBytes(invoice);
      latestPdfBytesRef.current = pdfBytes;
      await printPdfFromBytes(pdfBytes, { title });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membuka pratinjau PDF penawaran di tab baru.',
        'error'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <img
            src="/logo-alinlabs.webp"
            alt="Logo ALINLABS INDONESIA"
            className="mx-auto mb-2.5 h-10 w-10 object-contain"
          />
          <div className="font-display text-sm font-semibold text-slate-900">
            Alin Labs — Quotation Generator
          </div>
          <p className="mt-1 text-xs text-slate-500">Menyiapkan dokumen penawaran resmi...</p>
        </div>
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-5 text-center">
          <h1 className="font-display text-base font-semibold text-slate-900">
            Gagal Memuat Penawaran
          </h1>
          <p className="mt-1 text-xs text-red-700">{loadError || 'Terjadi kesalahan sistem'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50">
      <Header
        activeRoute="/penawaran"
        isGeneratingPdf={isGeneratingPdf}
        zoomPreset={zoomPreset}
        effectivePercent={effectivePercent}
        currentPage={currentPage}
        pageCount={pageCount}
        onZoomChange={handleZoomPresetChange}
        onStepZoom={handleStepZoom}
        onGeneratePdf={handleGeneratePdf}
        onPrintPdf={handlePrintPdf}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden w-[272px] shrink-0 lg:block">
          <InvoiceSidebar
            activeAnchorId={activeAnchorId}
            anchorPages={anchorPages}
            onJumpToAnchor={handleJumpToAnchor}
          />
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-50 flex h-full w-72 max-w-[85vw] flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src="/logo-alinlabs.webp"
                    alt="Logo AlinLabs Indonesia"
                    className="h-7 w-7 shrink-0 object-contain"
                  />
                  <div className="min-w-0 leading-tight">
                    <div className="font-display text-sm font-bold text-blue-600 whitespace-nowrap">
                      AlinLabs Indonesia
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                      Agency &amp; Digital Solution
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Tutup navigasi"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <InvoiceSidebar
                  activeAnchorId={activeAnchorId}
                  anchorPages={anchorPages}
                  onJumpToAnchor={handleJumpToAnchor}
                  showMobileSwitcher
                  onNavigate={(route) => {
                    setMobileNavOpen(false);
                    onNavigate(route);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Center: Live Vector A4 PDF Preview */}
        <section aria-label="Pratinjau Dokumen Penawaran PDF A4" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PdfLivePreview
            doc={invoice}
            zoomPreset={zoomPreset}
            customScale={customScale}
            targetPageRequest={targetPageRequest}
            generateBytes={generateInvoicePdfBytes}
            onEffectiveZoomChange={setEffectivePercent}
            onPinchZoom={handlePinchZoom}
            onUserScroll={triggerMobileZoomReveal}
            onVisiblePageChange={handleVisiblePageChange}
            onPdfGenerated={(bytes, totalPages, anchors) => {
              latestPdfBytesRef.current = bytes;
              setPageCount(totalPages);
              setAnchorPages(anchors);
            }}
          />
          <MobileFloatingZoom
            zoomPreset={zoomPreset}
            effectivePercent={effectivePercent}
            visible={mobileZoomVisible}
            currentPage={currentPage}
            pageCount={pageCount}
            hasBottomBar={false}
            onStepZoom={handleStepZoom}
            onInteract={triggerMobileZoomReveal}
          />
        </section>
      </div>

      {/* Full-Width Docked Bottom Bar (desktop switcher corner box only; no signing action) */}
      <DocumentBottomNav
        activeRoute="/penawaran"
        onNavigate={onNavigate}
      />

      {toast && (
        <div
          role="status"
          className={`fixed top-16 right-4 z-50 max-w-sm rounded-md border px-4 py-2.5 text-xs font-medium shadow-lg ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-slate-200 bg-slate-900 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};
