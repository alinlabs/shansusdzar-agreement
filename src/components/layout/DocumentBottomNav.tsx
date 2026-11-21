import React from 'react';
import { ExternalLink, PenTool, RefreshCw } from 'lucide-react';
import type { WorkspaceRoute } from './Header';

interface DocumentBottomNavProps {
  activeRoute: WorkspaceRoute;
  isSigned?: boolean;
  onOpenSigning?: () => void;
  onNavigate: (route: WorkspaceRoute) => void;
}

export const DocumentBottomNav: React.FC<DocumentBottomNavProps> = ({
  activeRoute,
  isSigned = false,
  onOpenSigning,
  onNavigate,
}) => {
  const isQuotation = activeRoute === '/penawaran' || activeRoute === '/invoice';
  const showSigningAction = !isQuotation && Boolean(onOpenSigning);
  const targetRoute: WorkspaceRoute = isQuotation ? '/kontrak' : '/penawaran';
  const switcherLabel = isQuotation ? 'Buka Dokumen Kontrak' : 'Buka Dokumen Penawaran';

  return (
    <footer
      className={`no-print relative z-30 min-h-14 w-full shrink-0 touch-none select-none border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] ${
        showSigningAction ? 'flex' : 'hidden lg:flex'
      }`}
    >
      {/* Desktop Corner Box aligned flush with 272px Sidebar above (mirrors Header corner box) */}
      <div className="hidden h-14 w-[272px] shrink-0 border-r border-slate-200 lg:flex">
        <a
          href={targetRoute}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onNavigate(targetRoute);
          }}
          className="flex h-full w-full items-center justify-between gap-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
        >
          <span className="truncate">{switcherLabel}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      </div>

      {/* Main Bottom Action Bar (rendered only for signable Contract route) */}
      {showSigningAction && onOpenSigning && (
        <nav
          aria-label="Kontrol Persetujuan dan Tanda Tangan"
          className="flex h-14 min-w-0 flex-1 items-center justify-center px-3 sm:px-4 lg:px-6"
        >
          <button
            type="button"
            onClick={onOpenSigning}
            data-testid="bottom-nav-sign-button"
            data-signed={isSigned ? 'true' : 'false'}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white shadow-xs transition-colors whitespace-nowrap shrink-0 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isSigned
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700'
            }`}
          >
            {isSigned ? (
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <PenTool className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{isSigned ? 'Hapus Atau Ubah Tanda Tangan' : 'Setujui & Tanda Tangan'}</span>
          </button>
        </nav>
      )}
    </footer>
  );
};
