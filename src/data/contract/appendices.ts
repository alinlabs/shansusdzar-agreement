/**
 * Lampiran Resmi Perjanjian Kerja Sama (Lampiran I & Lampiran II).
 * Dirender sebagai bagian akhir terstruktur dalam dokumen hukum & PDF final.
 */
export const WARRANTY_SLA_MATRIX = [
  {
    severity: 'P1 — Kritis (System Down)',
    definition: 'Website tidak dapat diakses sama sekali (HTTP 5xx), kegagalan fatal formulir konsultasi utama, atau celah keamanan kritis pada aplikasi.',
    responseSla: 'Maksimal 4 jam kerja sejak laporan diterima',
    targetResolution: '24 jam kerja (hotfix prioritas)',
  },
  {
    severity: 'P2 — Tinggi (Fungsionalitas Mayor Terganggu)',
    definition: 'Fitur CMS admin, galeri portofolio proyek, atau integrasi utama tidak berfungsi normal meskipun website tetap dapat diakses.',
    responseSla: 'Maksimal 12 jam kerja sejak laporan diterima',
    targetResolution: '2 - 3 Hari Kerja',
  },
  {
    severity: 'P3 — Sedang / Minor (Tampilan atau Bug Non-Blokir)',
    definition: 'Ketidaksesuaian tata letak minor pada resolusi layar tertentu, kesalahan teks/label sistem, atau kendala kosmetik akibat error source code.',
    responseSla: 'Maksimal 24 jam kerja sejak laporan diterima',
    targetResolution: '3 - 5 Hari Kerja (Garansi Selamanya Gratis)',
  },
];

export const HANDOVER_CHECKLIST_ITEMS = [
  [
    '1',
    'Akses Produksi Website (shansusdzar.com)',
    'URL produksi https://shansusdzar.com live pada Alinlabs Server dengan SSL/TLS 1.3 + HSTS, WAF, Security Headers, & sitemap.xml/llms.txt aktif.',
  ],
  [
    '2',
    'Kredensial Administrator (RBAC) & Hak Akses',
    'Akun Super Admin / Owner Dashboard CMS (Session Token Cookie/JWT, PBKDF2/Argon2id, Rate Limiting), Halaman Hak Akses (invite, persetujuan, & pengaturan hak akses akun admin), serta Halaman Pengaturan (bahasa, tema, & perubahan kredensial akun).',
  ],
  [
    '3',
    'Hak Akses Operasional & Lisensi Sistem',
    'Aktivasi hak guna operasional Website sesuai ketentuan lisensi Pasal 8 (source code tetap menjadi milik eksklusif AlinLabs Indonesia).',
  ],
  [
    '4',
    'Dokumentasi Teknis & Panduan CMS',
    'Manual pengoperasian CMS, Halaman Admin Keuangan, Halaman Pengaturan, & Halaman Hak Akses (Halaman Info, Portofolio, katalog, testimoni, profil workshop, log pesanan, pembukuan keuangan, serta invite/persetujuan admin), konfigurasi GA4/Search Console, dan daftar dependensi sistem.',
  ],
  [
    '5',
    'Berita Acara Serah Terima (BAST)',
    'Dokumen pengesahan hasil user test/revisi pada staging https://shansusdzar.vercel.app dan serah terima resmi yang menandai berlakunya garansi selamanya atas error code/source code.',
  ],
];
