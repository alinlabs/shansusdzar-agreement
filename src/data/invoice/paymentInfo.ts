import type { InvoiceBankInfo } from '../../types/invoice';

/**
 * Data rekening tujuan pembayaran resmi penerbit penawaran (Pihak Kedua / ALINLABS INDONESIA).
 * Ubah langsung nilai di file ini sesuai rekening resmi perusahaan.
 */
export const INVOICE_BANK_INFO: InvoiceBankInfo = {
  bankName: 'SeaBank',
  accountNumber: '901387277710',
  accountHolder: 'Mela Melati Aprilia',
  accountRole: 'Finance AlinLabs Indonesia',
};

/**
 * Catatan instruksi pembayaran resmi pada dokumen Penawaran Resmi (Quotation).
 */
export const INVOICE_PAYMENT_NOTES =
  'Transfer ke SeaBank 901387277710 a.n. Mela Melati Aprilia (Finance AlinLabs Indonesia) dalam 2 tahap: Pembayaran I (DP) Rp 700.000 saat persetujuan dan Pembayaran II (Pelunasan) Rp 1.155.000 termasuk PPN 11% setelah tester sebelum deploy/publikasi lengkap. Batas jatuh tempo maksimal 7 hari kalender sejak tanggal penawaran.';
