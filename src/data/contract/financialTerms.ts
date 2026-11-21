import type { FinancialInfo } from '../../types/contract';
import { calculateRemainingPayment } from '../../utils/currency';

/**
 * Pengaturan Nilai Kontrak, Pengakuan Pembayaran DP Sebelumnya, Pajak, dan Termin Pembayaran.
 * Rumus resmi: Sisa Pembayaran = Total Nilai Kontrak - Total Pembayaran DP yang Telah Diterima.
 * Sesuaikan angka totalValue dan downPaymentPaid pada konstanta di bawah ini sesuai kesepakatan komersial.
 */
export const CONTRACT_SUBTOTAL_DPP = 1_800_000;
export const CONTRACT_TAXABLE_INFRA_DPP = 500_000; // Domain (200k) + Hosting (50k) + Database & Cloud (250k)
export const CONTRACT_PPN_RATE = 11;
export const CONTRACT_PPN_AMOUNT = Math.round((CONTRACT_TAXABLE_INFRA_DPP * CONTRACT_PPN_RATE) / 100); // 55.000
export const CONTRACT_TOTAL_VALUE = CONTRACT_SUBTOTAL_DPP + CONTRACT_PPN_AMOUNT; // 1.855.000
export const PRIOR_DOWN_PAYMENT_PAID = 0;

const TERMIN_1_AMOUNT = 700_000;
const TERMIN_2_AMOUNT = CONTRACT_TOTAL_VALUE - TERMIN_1_AMOUNT; // 1.155.000 (pelunasan sisa termasuk PPN 11% Rp 55.000)

const TERMIN_1_PERCENTAGE = Math.round((TERMIN_1_AMOUNT / CONTRACT_TOTAL_VALUE) * 10000) / 100; // 37.74
const TERMIN_2_PERCENTAGE = Math.round((100 - TERMIN_1_PERCENTAGE) * 100) / 100; // 62.26

export const FINANCIAL_TERMS_DATA: FinancialInfo = {
  totalValue: CONTRACT_TOTAL_VALUE,
  downPaymentPaid: PRIOR_DOWN_PAYMENT_PAID,
  downPaymentDate: '',
  downPaymentInvoiceNumber: '',
  downPaymentReference: '',
  downPaymentMethod:
    'Transfer Bank SeaBank — No. Rekening 901387277710 a.n. Mela Melati Aprilia (Finance AlinLabs Indonesia)',
  taxMode: 'INCLUDE_PPN',
  ppnPercentage: CONTRACT_PPN_RATE,
  taxableBaseValue: CONTRACT_TAXABLE_INFRA_DPP,
  taxNote:
    'PPN 11% (Rp 55.000) hanya dikenakan atas komponen Domain (shansusdzar.com), Hosting (Alinlabs Server), serta Database & Cloud (Alinlabs Cloud) dengan dasar pengenaan Rp 500.000; komponen jasa pembuatan halaman website, halaman admin keuangan, halaman pengaturan, dan halaman hak akses tidak dikenakan PPN. Total Nilai Kontrak sebesar Rp 1.855.000 (dibayarkan dalam 2 tahap: DP Rp 700.000 dan pelunasan sisa setelah tester sebelum deploy/publikasi lengkap sebesar Rp 1.155.000 termasuk PPN).',
  additionalCostsNote:
    'Biaya registrasi awal Domain shansusdzar.com berlaku untuk masa aktif 1 (satu) tahun sejak aktivasi; setelah masa 1 tahun berakhir, domain otomatis tidak aktif dan wajib direaktifkan kembali oleh Pihak Pertama dengan nominal perpanjangan yang belum ditetapkan secara tetap namun berada pada kisaran harga yang sama atau tidak jauh berbeda, menyesuaikan perubahan tarif resmi provider domain maupun fluktuasi kurs mata uang. Biaya perpanjangan Hosting (Alinlabs Server) maupun penambahan kapasitas Database & Cloud (Alinlabs Cloud) periode berikutnya ditanggung Pihak Pertama sesuai tagihan aktual. Pengelolaan backup server dan cloud tidak termasuk dalam kontrak awal dan diserahkan kepada Pihak Pertama; apabila diserahkan kepada Pihak Kedua untuk melakukan backup yang rapi sekaligus refresh serta pengoptimalisasian server kembali, dikenakan biaya tambahan berkisar Rp 150.000 - Rp 250.000 per project backup & refresh. Update source akibat perubahan kebijakan pihak ketiga (seperti Google dll) dikenakan biaya Rp 50.000 - Rp 150.000, sedangkan pergantian fitur atau perombakan pasca deploy (minor/mayor) dikenakan charge update mulai dari Rp 100.000 sesuai kompleksitas.',
  costBreakdown: [
    {
      id: 'cost-1',
      itemName: 'Halaman : Beranda',
      description:
        'Hero/Banner, Promo/Countdown Timer, sekilas portofolio, sekilas katalog, sekilas tips & info, sekilas tata cara pemesanan, serta Maps lokasi usaha.',
      amount: 100_000,
      originalAmount: 119_000,
      taxable: false,
    },
    {
      id: 'cost-2',
      itemName: 'Halaman : Tentang',
      description: 'Deskripsi perusahaan, Visi, Misi, Keunggulan, profil Owner, dan Tim.',
      amount: 100_000,
      originalAmount: 119_000,
      taxable: false,
    },
    {
      id: 'cost-3',
      itemName: 'Halaman : Katalog',
      description: 'Katalog gambar dan harga produk/jasa serta kalkulator estimator.',
      amount: 150_000,
      originalAmount: 169_000,
      taxable: false,
    },
    {
      id: 'cost-4',
      itemName: 'Halaman : Pemesanan',
      description: 'Form pembeli dan integrasi langsung WhatsApp.',
      amount: 150_000,
      originalAmount: 169_000,
      taxable: false,
    },
    {
      id: 'cost-5',
      itemName: 'Halaman : Info (Tips, Edukasi & Berita)',
      description: 'Halaman artikel Tips, Edukasi & Berita beserta panel admin pengelolaannya.',
      amount: 200_000,
      originalAmount: 229_000,
      taxable: false,
    },
    {
      id: 'cost-6',
      itemName: 'Halaman : Portofolio',
      description: 'Halaman Portofolio (gambar, detail & harga) beserta panel admin pengelolaannya.',
      amount: 200_000,
      originalAmount: 229_000,
      taxable: false,
    },
    {
      id: 'cost-7',
      itemName: 'Halaman Admin : Keuangan',
      description:
        'Panel admin keuangan terproteksi RBAC untuk pencatatan pemasukan, pengeluaran, rekap transaksi, arus kas, dan laporan keuangan usaha.',
      amount: 400_000,
      originalAmount: 549_000,
      taxable: false,
    },
    {
      id: 'cost-8',
      itemName: 'Halaman : Pengaturan',
      description:
        'Halaman pengaturan untuk mengubah bahasa, tema tampilan, kredensial akun, dan konfigurasi akun sejenisnya.',
      amount: 0,
      originalAmount: 99_000,
      note: 'Promo Gratis',
      taxable: false,
    },
    {
      id: 'cost-9',
      itemName: 'Halaman Admin : Hak Akses',
      description:
        'Halaman hak akses untuk Super Admin / Owner melakukan invite, persetujuan (approval), atau pengaturan hak akses akun-akun admin.',
      amount: 0,
      originalAmount: 149_000,
      note: 'Promo Gratis',
      taxable: false,
    },
    {
      id: 'cost-10',
      itemName: 'Domain : shansusdzar.com + Config',
      description:
        'Managed Domain & DNS 1 Pintu (A/CNAME, TXT, DNSSEC) shansusdzar.com masa aktif 1 tahun; setelah 1 tahun nonaktif dan wajib direaktifkan kembali sesuai tarif provider/kurs (kena PPN 11%).',
      amount: 200_000,
      originalAmount: 229_000,
      taxable: true,
    },
    {
      id: 'cost-11',
      itemName: 'Hosting : Alinlabs Server + Config',
      description:
        'Managed Edge & Static Hosting pada Alinlabs Server (Global CDN Cache, WAF/DDoS, Security Headers, & SSL/TLS 1.3 HTTPS) + staging shansusdzar.vercel.app (kena PPN 11%).',
      amount: 50_000,
      originalAmount: 57_000,
      taxable: true,
    },
    {
      id: 'cost-12',
      itemName: 'Database & Cloud 10GB : Alinlabs Cloud',
      description:
        'Alinlabs Cloud SQL Database (Drizzle ORM) + Object Storage 10GB CDN cache; integrasi Visa Card / Payment Gateway PCI-DSS opsional fase lanjutan (kena PPN 11%).',
      amount: 250_000,
      originalAmount: 285_000,
      taxable: true,
    },
    {
      id: 'cost-13',
      itemName: 'Setup Search Console, GA4 & GEO',
      description:
        'Verifikasi DNS TXT Google Search Console, sitemap.xml, robots.txt, JSON-LD Schema.org, Google Analytics 4 (GA4), serta GEO /llms.txt.',
      amount: 0,
      originalAmount: 99_000,
      note: 'Promo Gratis',
      taxable: false,
    },
  ],
  termins: [
    {
      id: 'term-1',
      description: 'Pembayaran I — Uang Muka / DP (Rp 700.000)',
      percentage: TERMIN_1_PERCENTAGE,
      amount: TERMIN_1_AMOUNT,
      trigger: 'Pada saat penandatanganan Perjanjian Kerja Sama (atau diakui apabila telah dibayarkan sebelumnya)',
      dueDate: '',
      isPriorDp: true,
      status: PRIOR_DOWN_PAYMENT_PAID >= TERMIN_1_AMOUNT ? 'PAID' : 'PENDING',
    },
    {
      id: 'term-2',
      description: 'Pembayaran II — Pelunasan Sisa Setelah Tester Sebelum Deploy (Termasuk PPN 11%)',
      percentage: TERMIN_2_PERCENTAGE,
      amount: TERMIN_2_AMOUNT,
      trigger: 'Setelah masa uji coba (tester / user test) selesai dan wajib dilunasi sebelum Website di-deploy atau dipublikasikan lengkap ke internet (termasuk PPN Rp 55.000)',
      dueDate: '',
      isPriorDp: false,
      status: 'PENDING',
    },
  ],
};
