import React, { useState } from 'react';
import { Copy, FileDown, FolderOpen, Printer, X } from 'lucide-react';
import type { ContractDocument } from '../../types/contract';
import type { ContractSummaryItem } from '../../services/documentService';
import { formatAuditActionLabel } from '../../services/auditService';
import { formatDateTimeID } from '../../utils/date';
import { formatIDR } from '../../utils/currency';

interface DocumentHistoryModalProps {
  open: boolean;
  doc: ContractDocument;
  contractsList: ContractSummaryItem[];
  onClose: () => void;
  onSelectContract: (id: string) => void;
  onDuplicate: () => void;
  onDownloadDraftJson: () => void;
  onPrintPdf: () => void;
}

export const DocumentHistoryModal: React.FC<DocumentHistoryModalProps> = ({
  open,
  doc,
  contractsList,
  onClose,
  onSelectContract,
  onDuplicate,
  onDownloadDraftJson,
  onPrintPdf,
}) => {
  const [tab, setTab] = useState<'audit' | 'versions' | 'documents'>('audit');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Riwayat Dokumen, Versi, dan Audit Trail"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Riwayat Dokumen, Versi & Audit Trail
            </h2>
            <p className="text-xs text-slate-500">
              {doc.agreement.contractNumber} · Versi {doc.version} · Terakhir diperbarui {formatDateTimeID(doc.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal riwayat"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
          <div className="flex items-center gap-1 rounded-md bg-slate-200/70 p-0.5">
            <button
              type="button"
              onClick={() => setTab('audit')}
              className={`rounded px-3 py-1 text-xs font-medium ${
                tab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({doc.auditTrail.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('versions')}
              className={`rounded px-3 py-1 text-xs font-medium ${
                tab === 'versions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Riwayat Versi ({doc.snapshots.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('documents')}
              className={`rounded px-3 py-1 text-xs font-medium ${
                tab === 'documents' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Dokumen ({contractsList.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Duplikasi</span>
            </button>
            <button
              type="button"
              onClick={onDownloadDraftJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unduh Draft (.json)</span>
            </button>
            <button
              type="button"
              onClick={onPrintPdf}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cetak Dokumen</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'audit' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Waktu</th>
                    <th className="pb-2 pr-3 font-medium">Aktivitas</th>
                    <th className="pb-2 pr-3 font-medium">Aktor</th>
                    <th className="pb-2 pr-3 font-medium">Versi</th>
                    <th className="pb-2 font-medium">Keterangan & Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doc.auditTrail.map((ev) => (
                    <tr key={ev.id} className="align-top">
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTimeID(ev.timestamp)}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {formatAuditActionLabel(ev.action)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{ev.actor}</td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        v{ev.versionBefore} → v{ev.versionAfter}
                      </td>
                      <td className="py-2.5 text-slate-700">
                        <div>{ev.summary}</div>
                        {ev.documentHash && (
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                            SHA-256: {ev.documentHash.slice(0, 20)}...
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'versions' && (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {doc.snapshots.map((snap, i) => (
                <li key={`${snap.version}-${i}`} className="flex items-center justify-between gap-4 p-3.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Versi {snap.version} · {snap.status}
                    </div>
                    <div className="mt-0.5 text-slate-600">{snap.note}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                      Hash: {snap.documentHash ? snap.documentHash.slice(0, 24) : '-'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{formatDateTimeID(snap.savedAt)}</div>
                    <div>{snap.savedBy}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'documents' && (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {contractsList.map((item) => {
                const isCurrent = item.id === doc.id;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-4 p-3.5 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-900">
                          {item.contractNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-medium text-blue-800">{item.status}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono tabular-nums text-slate-600">v{item.version}</span>
                      </div>
                      <div className="mt-0.5 truncate font-medium text-slate-800">
                        {item.projectName}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {item.firstPartyName} × {item.secondPartyName} · {formatIDR(item.totalValue)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        onSelectContract(item.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isCurrent ? 'Sedang Dibuka' : 'Buka'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
