import type { PsreIntegrationConfig, PsreProviderId } from '../types/signature';

export interface PsreProviderSpec {
  id: PsreProviderId;
  name: string;
  status: string;
  defaultSandboxUrl: string;
  requiredEnvVars: string[];
  notes: string;
}

export const INDONESIAN_PSRE_PROVIDERS: PsreProviderSpec[] = [
  {
    id: 'NONE',
    name: 'Mode A — Tanda Tangan Elektronik Sederhana (Non-PSrE)',
    status: 'Aktif Lokal',
    defaultSandboxUrl: '',
    requiredEnvVars: [],
    notes: 'Menggunakan identitas penandatangan, persetujuan eksplisit, timestamp, SHA-256 hash dokumen, dan audit trail. Belum tersertifikasi PSrE.',
  },
  {
    id: 'PRIVY',
    name: 'PrivyID (PT Privy Identitas Digital)',
    status: 'Adaptor Siap Integrasi',
    defaultSandboxUrl: 'https://stg-core.privy.id/v1',
    requiredEnvVars: ['PSRE_PRIVY_MERCHANT_KEY', 'PSRE_PRIVY_CLIENT_ID', 'PSRE_PRIVY_SECRET'],
    notes: 'Memerlukan akun enterprise PrivyID & kredensial API resmi di server environment.',
  },
  {
    id: 'VIDA',
    name: 'VIDA (PT Indonesia Digital Identity)',
    status: 'Adaptor Siap Integrasi',
    defaultSandboxUrl: 'https://sandbox.vida.id/api/v1',
    requiredEnvVars: ['PSRE_VIDA_CLIENT_ID', 'PSRE_VIDA_CLIENT_SECRET'],
    notes: 'Memerlukan aktivasi layanan tanda tangan tersertifikasi VIDA & webhook callback.',
  },
  {
    id: 'PERURI',
    name: 'Peruri Sign (Perum Percetakan Uang RI)',
    status: 'Adaptor Siap Integrasi',
    defaultSandboxUrl: 'https://apidev.peruri.co.id:9090',
    requiredEnvVars: ['PSRE_PERURI_SYSTEM_ID', 'PSRE_PERURI_API_KEY'],
    notes: 'Mendukung tanda tangan tersertifikasi dan integrasi e-Meterai Peruri melalui server proxy.',
  },
  {
    id: 'TEKENSIGN',
    name: 'TekenAja / TekenSign (PSrE Komdigi)',
    status: 'Adaptor Siap Integrasi',
    defaultSandboxUrl: 'https://sandbox-api.tekenaja.id/v1',
    requiredEnvVars: ['PSRE_TEKEN_API_KEY', 'PSRE_TEKEN_SECRET'],
    notes: 'Memerlukan registrasi aplikasi dan sertifikat klien PSrE terdaftar.',
  },
];

export interface PsreServerStatusResponse {
  configured: boolean;
  provider: PsreProviderId;
  environment: 'SANDBOX' | 'PRODUCTION';
  message: string;
}

export async function fetchPsreServerStatus(): Promise<PsreServerStatusResponse> {
  const res = await fetch('/api/psre/status', { credentials: 'include' });
  if (!res.ok) {
    return {
      configured: false,
      provider: 'NONE',
      environment: 'SANDBOX',
      message: 'Layanan PSrE belum dikonfigurasi pada server.',
    };
  }
  return res.json();
}

export async function updatePsreConfig(
  contractId: string,
  config: PsreIntegrationConfig
): Promise<{ ok: boolean; psre: PsreIntegrationConfig; message: string }> {
  const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}/psre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Gagal memperbarui konfigurasi PSrE' }));
    throw new Error(err.error || 'Gagal memperbarui konfigurasi PSrE');
  }
  return res.json();
}
