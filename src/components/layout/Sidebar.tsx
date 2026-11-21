import React from 'react';
import { ExternalLink } from 'lucide-react';
import { DOCUMENT_TOC_ITEMS, type DocumentTocItem } from '../../data/contract/index';
import type { WorkspaceRoute } from './Header';

interface SidebarProps {
  activeAnchorId: string;
  onJumpToAnchor: (item: DocumentTocItem) => void;
  onNavigate?: (route: WorkspaceRoute) => void;
  showMobileSwitcher?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeAnchorId,
  onJumpToAnchor,
  onNavigate,
  showMobileSwitcher = false,
}) => {
  return (
    <aside className="no-print flex h-full w-full flex-col border-r border-slate-200 bg-white">
      {/* Document Table of Contents */}
      <nav aria-label="Daftar Isi Dokumen Kontrak" className="flex-1 overflow-y-auto px-2.5 py-3">
        <ul className="space-y-0.5">
          {DOCUMENT_TOC_ITEMS.map((item) => {
            const isActive = activeAnchorId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onJumpToAnchor(item)}
                  className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                    isActive
                      ? 'bg-blue-600 font-medium text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile Drawer Route Switcher (desktop uses bottom-left corner box in DocumentBottomNav) */}
      {showMobileSwitcher && onNavigate && (
        <div className="h-14 border-t border-slate-200 bg-white lg:hidden">
          <a
            href="/penawaran"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate('/penawaran');
            }}
            className="flex h-full w-full items-center justify-between gap-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <span className="truncate">Buka Dokumen Penawaran</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>
      )}
    </aside>
  );
};
