import type { InvoiceAdditionalOfferItem } from '../../types/invoice';

/**
 * Penawaran layanan tambahan eksklusif khusus untuk Shansus Dzar Indonesia
 * yang dilampirkan pada bagian akhir Surat Penawaran Resmi (Quotation) setelah blok tanda tangan.
 * Bersifat opsional di luar paket kontrak utama dan hanya ditagihkan apabila dipilih terpisah.
 */
export const INVOICE_ADDITIONAL_OFFERS: InvoiceAdditionalOfferItem[] = [
  {
    id: 'addon-marketing-automation',
    serviceName: 'Halaman Marketing (Otomatisasi Email & WhatsApp)',
    description:
      'Halaman promosi dan otomatisasi pengiriman email serta WhatsApp berbasis trigger untuk pelanggan (hemat Rp 150.000).',
    normalPriceLabel: 'Rp 599.000',
    offerPriceLabel: 'Rp 449.000\n(Hemat 25%)',
    totalPrice: 449_000,
  },
  {
    id: 'addon-alinlabs-ai-chat',
    serviceName: 'Otomatisasi Chat Berbasis AI (AlinLabs AI)',
    description:
      'Asisten chat cerdas AlinLabs AI tanpa batas token selama 12 bulan untuk respons pelanggan 24/7 (hemat Rp 200.000).',
    normalPriceLabel: 'Rp 799.000/thn',
    offerPriceLabel: 'Rp 599.000/thn\n(Hemat 25%)',
    durationMonths: 12,
    totalPrice: 599_000,
  },
  {
    id: 'addon-chat-client-direct',
    serviceName: 'Halaman Chat Client (Direct Chat Website)',
    description:
      'Antarmuka direct chat real-time di dalam website antara pelanggan dan admin (hemat Rp 150.000).',
    normalPriceLabel: 'Rp 599.000',
    offerPriceLabel: 'Rp 449.000\n(Hemat 25%)',
    totalPrice: 449_000,
  },
  {
    id: 'addon-social-content-plan',
    serviceName: 'Fitur Content Plan Sosial Media',
    description:
      'Halaman terpusat untuk mengatur rencana konten sosial media, target capaian, jadwal publikasi, dan brief materi (hemat Rp 150.000).',
    normalPriceLabel: 'Rp 549.000',
    offerPriceLabel: 'Rp 399.000\n(Hemat 27%)',
    totalPrice: 399_000,
  },
  {
    id: 'addon-db-maintenance-1y',
    serviceName: 'Maintenance Database Bulanan (1 Tahun)',
    description:
      'Pemeliharaan rutin, pemantauan performa query, backup, dan optimasi Alinlabs Cloud SQL selama 12 bulan.',
    normalPriceLabel: 'Rp 149.000/bln',
    offerPriceLabel: 'Rp 149.000/bln\n(Rp 1.788.000/thn)',
    monthlyPrice: 149_000,
    durationMonths: 12,
    totalPrice: 1_788_000,
  },
  {
    id: 'addon-extract-25gb',
    serviceName: 'Extract Data 25 GB',
    description:
      'Ekspor penuh data database/storage hingga 25 GB dalam format terstruktur (Rp 10.000/GB).',
    normalPriceLabel: 'Rp 250.000',
    offerPriceLabel: 'Rp 250.000\n(Rp 10.000/GB)',
    capacityGb: 25,
    totalPrice: 250_000,
  },
  {
    id: 'addon-extract-50gb',
    serviceName: 'Extract Data 50 GB (Hemat 10%)',
    description:
      'Ekspor data database/storage hingga 50 GB dengan tarif hemat Rp 9.000/GB (hemat Rp 50.000).',
    normalPriceLabel: 'Rp 500.000',
    offerPriceLabel: 'Rp 450.000\n(Rp 9.000/GB)',
    capacityGb: 50,
    totalPrice: 450_000,
  },
  {
    id: 'addon-extract-100gb',
    serviceName: 'Extract Data 100 GB (Hemat 20%)',
    description:
      'Ekspor data skala besar hingga 100 GB dengan tarif ekonomis Rp 8.000/GB (hemat Rp 200.000).',
    normalPriceLabel: 'Rp 1.000.000',
    offerPriceLabel: 'Rp 800.000\n(Rp 8.000/GB)',
    capacityGb: 100,
    totalPrice: 800_000,
  },
];

export const INVOICE_ADDITIONAL_OFFERS_NOTE =
  'Seluruh tarif di atas bersifat opsional di luar Nilai Kontrak Utama Rp 1.855.000, khusus untuk Shansus Dzar Indonesia, dan hanya ditagihkan jika disetujui tertulis.';
