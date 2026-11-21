import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Send, Trash2, X } from 'lucide-react';
import type { ContractDocument } from '../types/contract';
import { DOCUMENT_TOC_ITEMS, type DocumentTocItem } from '../data/contract/index';
import { printPdfFromBytes } from '../utils/pdfPrint';
import { generateContractPdfBytes } from '../services/pdfEngine';
import {
  applyLocalFirstPartySignature,
  clearLocalFirstPartyOverride,
  duplicateContract,
  listContracts,
  loadContract,
  saveLocalFirstPartyOverride,
  type ContractSummaryItem,
  type FirstPartyLocalSignPayload,
} from '../services/documentService';
import { Header, type WorkspaceRoute } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { DocumentBottomNav } from '../components/layout/DocumentBottomNav';
import { MobileFloatingZoom } from '../components/layout/MobileFloatingZoom';
import { SignaturePanel } from '../components/signature/SignaturePanel';
import {
  PdfLivePreview,
  ZOOM_STEPS,
  type ZoomPreset,
} from '../components/document-preview/PdfLivePreview';
import { DocumentHistoryModal } from '../components/dashboard/DocumentHistoryModal';

interface ContractWorkspaceProps {
  onNavigate: (route: WorkspaceRoute) => void;
}

export const ContractWorkspace: React.FC<ContractWorkspaceProps> = ({ onNavigate }) => {
  const [doc, setDoc] = useState<ContractDocument | null>(null);
  const [contractsList, setContractsList] = useState<ContractSummaryItem[]>([]);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('opening');
  const [anchorPages, setAnchorPages] = useState<Record<string, number>>({});
  const [targetPageRequest, setTargetPageRequest] = useState<{
    page: number;
    nonce: number;
  } | null>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingModalOpen, setSigningModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [signResetNonce, setSignResetNonce] = useState(0);
  const [isSubmittingSign, setIsSubmittingSign] = useState(false);
  const [mobileZoomVisible, setMobileZoomVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit-width');
  const [customScale, setCustomScale] = useState<number | null>(null);
  const [effectivePercent, setEffectivePercent] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

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
    const handleFocusOut = () => {
      window.setTimeout(resetWindowScroll, 60);
    };
    const vv = window.visualViewport;
    vv?.addEventListener('resize', resetWindowScroll);
    vv?.addEventListener('scroll', resetWindowScroll);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      vv?.removeEventListener('resize', resetWindowScroll);
      vv?.removeEventListener('scroll', resetWindowScroll);
      window.removeEventListener('focusout', handleFocusOut);
      if (mobileZoomTimerRef.current !== null) {
        window.clearTimeout(mobileZoomTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (signingModalOpen || mobileNavOpen) {
      setMobileZoomVisible(false);
      if (mobileZoomTimerRef.current !== null) {
        window.clearTimeout(mobileZoomTimerRef.current);
        mobileZoomTimerRef.current = null;
      }
    }
  }, [signingModalOpen, mobileNavOpen]);

  useEffect(() => {
    latestPdfBytesRef.current = null;
  }, [doc]);

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

  const showToast = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const items = await listContracts();
      setContractsList(items);
    } catch {
      // Ignore secondary list error
    }
  }, []);

  // Load contract generated from modular .ts files
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await loadContract();
        if (!active) return;
        setDoc(loaded);
        await refreshList();
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Gagal memuat kontrak');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshList]);

  // Allow closing signing modal with Escape key
  useEffect(() => {
    if (!signingModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSigningModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [signingModalOpen]);

  const handleJumpToAnchor = useCallback(
    (item: DocumentTocItem) => {
      manualNavLockUntilRef.current = Date.now() + 700;
      setActiveAnchorId(item.id);
      const page = anchorPages[item.id] ?? 1;
      setCurrentPage(page);
      setTargetPageRequest({ page, nonce: Date.now() });
      setMobileNavOpen(false);
    },
    [anchorPages]
  );

  const handleVisiblePageChange = useCallback(
    (page: number, total: number) => {
      setCurrentPage(page);
      setPageCount(total);
      if (Date.now() < manualNavLockUntilRef.current) return;
      let matchedId = DOCUMENT_TOC_ITEMS[0]?.id ?? 'opening';
      for (const item of DOCUMENT_TOC_ITEMS) {
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
    if (!doc) return;
    setIsGeneratingPdf(true);
    try {
      const { pdfBytes } = await generateContractPdfBytes(doc);
      latestPdfBytesRef.current = pdfBytes;
      const safeBytes = new Uint8Array(pdfBytes);
      const blob = new Blob([safeBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeNum = (doc.agreement.contractNumber || 'Kontrak_AlinLabs').replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      );
      link.href = url;
      link.download = `Perjanjian_${safeNum}_v${doc.version}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Dokumen PDF vektor A4 berhasil dibuat dan diunduh.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat PDF', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!doc) return;
    const safeNum = doc.agreement.contractNumber || 'Kontrak_AlinLabs';
    const title = `Perjanjian Kerja Sama - ${safeNum}`;
    const cachedBytes = latestPdfBytesRef.current;

    if (cachedBytes) {
      try {
        await printPdfFromBytes(cachedBytes, { title });
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal membuka pratinjau PDF di tab baru.',
          'error'
        );
      }
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const { pdfBytes } = await generateContractPdfBytes(doc);
      latestPdfBytesRef.current = pdfBytes;
      await printPdfFromBytes(pdfBytes, { title });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Gagal membuka pratinjau PDF di tab baru.',
        'error'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadDraftJson = () => {
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kontrak_${doc.id}_v${doc.version}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleDuplicate = async () => {
    if (!doc) return;
    try {
      const cloned = await duplicateContract(doc.id);
      setDoc(cloned);
      await refreshList();
      setHistoryOpen(false);
      showToast(`Dokumen diduplikasi dengan nomor ${cloned.agreement.contractNumber}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menduplikasi dokumen', 'error');
    }
  };

  const handleSelectContract = async (id: string) => {
    try {
      const loaded = await loadContract(id);
      setDoc(loaded);
      showToast(`Membuka kontrak ${loaded.agreement.contractNumber}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat kontrak', 'error');
    }
  };

  const handleResetSignatureAndCanvas = async () => {
    setSignResetNonce((n) => n + 1);
    if (!doc || !doc.signatures.firstParty.signed) return;
    try {
      clearLocalFirstPartyOverride();
      const resetDoc = await loadContract(doc.id, { ignoreLocalOverride: true });
      setDoc(resetDoc);
      showToast('Tanda tangan dan perubahan lokal Pihak Pertama telah direset.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mereset tanda tangan', 'error');
    }
  };

  const handleDeleteSignatureAndClose = async () => {
    await handleResetSignatureAndCanvas();
    setSigningModalOpen(false);
  };

  const handleSignFirstParty = async (payload: FirstPartyLocalSignPayload) => {
    if (!doc) return;
    const signed = await applyLocalFirstPartySignature(doc, payload);
    saveLocalFirstPartyOverride(
      signed.id,
      payload,
      signed.signatures.firstParty.signedAt
    );
    setDoc(signed);
    setSigningModalOpen(false);
    // Jump preview directly to signature block page so signer sees embedded PNG signature
    const sigPage = anchorPages['signing'];
    if (sigPage) {
      setActiveAnchorId('signing');
      setTargetPageRequest({ page: sigPage, nonce: Date.now() });
    }
    showToast(
      'Tanda tangan Pihak Pertama dan sertifikasi PSrE berhasil diterapkan pada dokumen.'
    );
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
            Alin Labs — Contract Management
          </div>
          <p className="mt-1 text-xs text-slate-500">Memuat dokumen perjanjian kerja sama...</p>
        </div>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-5 text-center">
          <h1 className="font-display text-base font-semibold text-slate-900">
            Gagal Memuat Dokumen
          </h1>
          <p className="mt-1 text-xs text-red-700">{loadError || 'Terjadi kesalahan sistem'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50">
      <Header
        activeRoute="/kontrak"
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

      {/* Main 2-Pane Workspace: TOC Sidebar | Live A4 PDF Preview */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar: Table of Contents */}
        <div className="hidden w-[272px] shrink-0 lg:block">
          <Sidebar
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
                <Sidebar
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

        {/* Center/Full Panel: Exact Vector A4 Live PDF Preview */}
        <section
          aria-label="Pratinjau Dokumen PDF A4"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <PdfLivePreview
            doc={doc}
            zoomPreset={zoomPreset}
            customScale={customScale}
            targetPageRequest={targetPageRequest}
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
            hasBottomBar
            onStepZoom={handleStepZoom}
            onInteract={triggerMobileZoomReveal}
          />
        </section>
      </div>

      {/* Full-Width Docked Bottom Bar matching Header with 272px Corner Box */}
      <DocumentBottomNav
        activeRoute="/kontrak"
        isSigned={doc.signatures.firstParty.signed}
        onOpenSigning={() => setSigningModalOpen(true)}
        onNavigate={onNavigate}
      />

      {/* First-Party Local Signing Modal (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {signingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            doc.signatures.firstParty.signed
              ? 'Hapus Atau Ubah Tanda Tangan'
              : 'Setujui & Tanda Tangan'
          }
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 lg:items-center lg:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSigningModalOpen(false);
            }
          }}
        >
          <div className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl lg:max-h-[90vh] lg:max-w-xl lg:rounded-xl lg:border lg:shadow-xl">
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-300 lg:hidden" aria-hidden="true" />
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 lg:py-3.5 lg:px-5">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {doc.signatures.firstParty.signed
                    ? 'Hapus Atau Ubah Tanda Tangan'
                    : 'Setujui & Tanda Tangan'}
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Shansus Dzar Indonesia
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetSignatureAndCanvas}
                  aria-label="Hapus dan reset tanda tangan"
                  title="Hapus / Reset Tanda Tangan"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setSigningModalOpen(false)}
                  aria-label="Tutup panel tanda tangan"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:p-5">
              <SignaturePanel
                doc={doc}
                formId="contract-signing-form"
                resetNonce={signResetNonce}
                onSubmittingChange={setIsSubmittingSign}
                onSignFirstParty={handleSignFirstParty}
                onClearCanvas={() => setSignResetNonce((n) => n + 1)}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:py-3 lg:px-5">
              {doc.signatures.firstParty.signed && (
                <button
                  type="button"
                  onClick={handleDeleteSignatureAndClose}
                  disabled={isSubmittingSign}
                  data-testid="modal-delete-signature-button"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus Tanda Tangan</span>
                </button>
              )}
              <button
                type="submit"
                form="contract-signing-form"
                disabled={isSubmittingSign}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isSubmittingSign
                    ? 'Mengirim...'
                    : doc.signatures.firstParty.signed
                      ? 'Ubah Tanda Tangan'
                      : 'Kirim'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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

      {/* History & Version Management Modal */}
      <DocumentHistoryModal
        open={historyOpen}
        doc={doc}
        contractsList={contractsList}
        onClose={() => setHistoryOpen(false)}
        onSelectContract={handleSelectContract}
        onDuplicate={handleDuplicate}
        onDownloadDraftJson={handleDownloadDraftJson}
        onPrintPdf={handlePrintPdf}
      />
    </div>
  );
};
