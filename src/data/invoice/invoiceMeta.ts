import type { InvoicePaymentStatus, InvoiceTerminMode } from '../../types/invoice';

export interface InvoiceBillingConfig {
  sequenceNumber: number;
  terminMode: InvoiceTerminMode;
  paymentTermsDays: number;
  /** Kosongkan ('') untuk mengikuti tanggal perjanjian kontrak */
  issueDateOverride: string;
  /** Kosongkan ('') untuk otomatis issueDate + paymentTermsDays */
  dueDateOverride: string;
  /** Kosongkan ('') untuk mengikuti kota penandatanganan kontrak */
  cityOverride: string;
  /** 'AUTO' mengikuti status DP kontrak, atau paksa 'UNPAID' / 'PAID' */
  statusOverride: InvoicePaymentStatus | 'AUTO';
  /** 0 berarti mengikuti total nilai kontrak pada src/data/contract/financialTerms.ts */
  customTotalOverride: number;
  /** Potongan pembayaran sebelumnya (IDR) */
  priorPaymentDeducted: number;
}

/**
 * Konfigurasi utama dokumen Penawaran Resmi (Quotation).
 * Ubah nilai pada file ini untuk mengatur nomor urut, skema termin, masa berlaku / jatuh tempo, dan status penawaran.
 */
export const INVOICE_BILLING_CONFIG: InvoiceBillingConfig = {
  sequenceNumber: 127,
  terminMode: 'TERMIN_1_DP',
  paymentTermsDays: 7,
  issueDateOverride: '2026-11-22',
  dueDateOverride: '',
  cityOverride: 'Purwakarta',
  statusOverride: 'AUTO',
  customTotalOverride: 0,
  priorPaymentDeducted: 0,
};
