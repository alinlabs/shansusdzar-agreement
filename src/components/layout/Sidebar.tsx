import React from 'react';
import { DOCUMENT_TOC_ITEMS, type DocumentTocItem } from '../../data/contract/index';
import type { WorkspaceRoute } from './Header';

interface SidebarProps {
  activeAnchorId: string;
  anchorPages?: Record<string, number>;
  onJumpToAnchor: (item: DocumentTocItem) => void;
  onNavigate?: (route: WorkspaceRoute) => void;
  showMobileSwitcher?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeAnchorId,
  anchorPages,
  onJumpToAnchor,
  onNavigate,
  showMobileSwitcher = false,
}) => {
  return (
    <aside className="no-print flex h-full w-full flex-col border-r border-slate-200 bg-white">
      {/* Mobile Quick Document Switcher at Top of Drawer */}
      {showMobileSwitcher && onNavigate && (
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/70 p-2.5 lg:hidden">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/75 p-1">
            <button
              type="button"
              onClick={() => onNavigate('/kontrak')}
              className="flex min-h-[38px] items-center justify-center rounded-md bg-white px-2.5 text-xs font-semibold text-blue-700 shadow-xs"
            >
              Kontrak
            </button>
            <a
              href="/penawaran"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate('/penawaran');
              }}
              className="flex min-h-[38px] items-center justify-center rounded-md px-2.5 text-xs font-medium text-slate-700 hover:bg-white/60 hover:text-slate-900 transition-colors"
            >
              Penawaran
            </a>
          </div>
        </div>
      )}

      {/* Document Table of Contents */}
      <nav aria-label="Daftar Isi Dokumen Kontrak" className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-3">
        <ul className="space-y-0.5">
          {DOCUMENT_TOC_ITEMS.map((item) => {
            const isActive = activeAnchorId === item.id;
            const pageNum = anchorPages?.[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onJumpToAnchor(item)}
                  className={`flex min-h-[36px] lg:min-h-0 w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                    isActive
                      ? 'bg-blue-600 font-medium text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {typeof pageNum === 'number' && (
                    <span
                      className={`shrink-0 font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {pageNum}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
