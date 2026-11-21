import type { AuditEvent } from '../types/contract';

export function createAuditEvent(params: {
  actor: string;
  action: AuditEvent['action'];
  summary: string;
  versionBefore: number;
  versionAfter: number;
  documentHash: string;
}): AuditEvent {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    actor: params.actor || 'Pengguna Workspace',
    action: params.action,
    summary: params.summary,
    versionBefore: params.versionBefore,
    versionAfter: params.versionAfter,
    documentHash: params.documentHash,
  };
}

export function formatAuditActionLabel(action: AuditEvent['action']): string {
  const labels: Record<AuditEvent['action'], string> = {
    CREATED: 'Dokumen Dibuat',
    UPDATED: 'Kontrak Diperbarui',
    AUTOSAVED: 'Penyimpanan Otomatis',
    DUPLICATED: 'Dokumen Diduplikasi',
    VALIDATED: 'Pemeriksaan Dokumen',
    LOCKED_FOR_SIGNING: 'Dikunci sebagai Final',
    UNLOCKED_INVALIDATED: 'Kunci & TTD Dibatalkan (Revisi)',
    SIGNED_FIRST_PARTY: 'Ditandatangani Pihak Pertama',
    SIGNED_SECOND_PARTY: 'Ditandatangani Pihak Kedua',
    PDF_EXPORTED: 'Ekspor PDF Final',
    PSRE_CONFIG_UPDATED: 'Konfigurasi PSrE Diperbarui',
  };
  return labels[action] ?? action;
}
