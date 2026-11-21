import type { ScopeOfWork } from '../../types/contract';

/**
 * Spesifikasi teknis ruang lingkup pekerjaan pembuatan dan pengembangan website.
 * Setiap komponen terstruktur agar batas lingkup proyek jelas dan terukur.
 */
export const SCOPE_OF_WORK_DATA: ScopeOfWork = {
  pagesList: [
    '**Beranda**\n  Hero video VP9 ringan + poster WebP, Promo/Countdown Timer, sekilas portofolio, katalog, tips & info, tata cara pemesanan, serta peta vektor SVG lokasi usaha Purwakarta.',
    '**Tentang**\n  Profil workshop Shansus Dzar Indonesia, Visi, Misi, Keunggulan, profil Owner, & Tim.',
    '**Katalog**\n  Katalog produk & jasa terhubung Alinlabs Cloud SQL Database beserta Kalkulator Estimator.',
    '**Pemesanan**\n  Form pembeli dengan HTML5 Geolocation opt-in, ringkasan PDF A4, & integrasi WhatsApp (https://wa.me/6285314205258).',
    '**Info (Tips, Edukasi & Berita)**\n  Publikasi artikel informasi beserta Panel Admin CMS pengelolaan konten.',
    '**Portofolio**\n  Galeri gambar, detail & harga proyek beserta Panel Admin CMS pengelolaan portofolio.',
    '**Halaman Admin Keuangan**\n  Panel administrasi khusus pengelolaan keuangan usaha (pencatatan pemasukan, pengeluaran, rekap transaksi, arus kas, & laporan keuangan) dengan proteksi RBAC.',
    '**Halaman Pengaturan**\n  Pengaturan preferensi sistem & akun untuk mengubah bahasa, tema tampilan (gelap/terang), kredensial akun, serta konfigurasi akun sejenisnya.',
    '**Halaman Hak Akses (Super Admin / Owner)**\n  Panel otorisasi khusus Super Admin / Owner untuk melakukan invite (undangan), persetujuan (approval), serta pengaturan hak akses akun-akun admin.',
  ],
  featuresList: [
    '**Arsitektur Modern**\n  SPA React 19 (19.0.1) + Vite 8 (8.3.0) + React Router v8 (8.5.1) & TypeScript (7.0.2) terhubung Edge API Backend (Alinlabs Server TypeScript).',
    '**Katalog & Pemesanan WhatsApp**\n  Katalog harga + Kalkulator Estimator interaktif, dokumen ringkasan PDF A4 (jsPDF + pdfjs-dist), serta integrasi langsung WhatsApp (085314205258) dengan Web Share API & fallback unduh PDF.',
    '**Panel Admin CMS, Keuangan, Pengaturan & Hak Akses**\n  Pengelolaan Halaman Info, Portofolio, katalog produk, testimoni, profil workshop, log pesanan, modul Admin Keuangan (pemasukan, pengeluaran, & laporan kas), Halaman Pengaturan (bahasa, tema, kredensial akun), serta Halaman Hak Akses Super Admin / Owner (invite, persetujuan, & hak akses akun-akun admin) dengan proteksi RBAC + Session Token terenkripsi.',
    '**Infrastruktur 1 Pintu Alinlabs (Domain 1 Tahun)**\n  Managed Domain shansusdzar.com (masa aktif 1 tahun; wajib reaktivasi setelah 1 tahun pada kisaran harga setara/menyesuaikan tarif provider & kurs), Hosting Alinlabs Server, URL Staging https://shansusdzar.vercel.app, serta Database SQL (Drizzle ORM) + Object Storage 10GB di Alinlabs Cloud.',
    '**SEO, Analitik & GEO (AI Search)**\n  Setup Google Search Console (DNS TXT & Sitemap XML), Google Analytics 4 (GA4), Schema.org FurnitureStore/Product, robots.txt, & /llms.txt.',
    '**Pembayaran Kartu (Opsional)**\n  Integrasi Visa Card / Payment Gateway berstandar PCI-DSS belum diaktifkan pada fase awal (kesiapan arsitektur tersedia untuk fase lanjutan).',
  ],
  uiUxDesign: [
    '• **Framework & Design System**\n  Tailwind CSS v4 (4.3.3) + Custom CSS Design Tokens (src/styles/tokens.css).',
    '• **Tema & Tipografi**\n  Default tema gelap dengan opsi tema terang, serta self-hosted font @fontsource-variable/inter (WOFF2).',
    '• **Interaksi & Ikon**\n  Animasi halus menggunakan Motion (12.23.24) & ikon Lucide React (0.546.0).',
  ].join('\n'),
  responsiveness: [
    '• **Mobile-First Responsive**\n  Desktop (1440px+), Laptop (1024px+), Tablet (768px+), & Smartphone (320px-480px+).',
    '• **Navigasi & Aksesibilitas**\n  Header desktop, bottom navigation bar seluler, safe-area-inset, ARIA labels, & prefers-reduced-motion.',
    '• **Peramban Target**\n  Google Chrome, Apple Safari (Desktop & iOS), Mozilla Firefox, & Microsoft Edge versi modern.',
  ].join('\n'),
  apiIntegrations: [
    '• **Backend & Database**\n  Edge API Backend (Alinlabs Server TypeScript) & Alinlabs Cloud SQL Database dengan Drizzle ORM (migrasi skema & prepared statements).',
    '• **State & Cache Klien**\n  Zustand (5.1.0), Service Worker (public/sw.js), Cache Storage, & localStorage.',
    '• **Media & File Storage**\n  Alinlabs Cloud Object Storage 10GB (S3-Compatible + CDN cache).',
  ].join('\n'),
  thirdPartyIntegrations: [
    '• **Peta & Lokasi Workshop**\n  Peta vektor SVG interaktif ringan (tanpa ketergantungan kuota API berbayar) tertaut Google Maps lokasi Purwakarta + HTML5 Geolocation opt-in.',
    '• **WhatsApp Direct**\n  https://wa.me/6285314205258 (085314205258) dengan pesan otomatis & Web Share API PDF.',
    '• **Search & Analitik**\n  Google Search Console (verifikasi DNS TXT) & Google Analytics 4 (GA4).',
    '• **Payment Gateway (Opsional)**\n  Kesiapan arsitektur PCI-DSS (Visa Card belum diaktifkan pada fase awal).',
  ].join('\n'),
  cmsAdmin: [
    '• **Autentikasi & Otorisasi**\n  Session Token terenkripsi (HttpOnly, Secure, SameSite=Strict Cookie / JWT berjangka pendek), hashing PBKDF2/Argon2id, & RBAC.',
    '• **Proteksi Gerbang Admin**\n  Rate Limiting login, verifikasi anti-bot, proteksi CSRF token mutasi, & Presigned Upload (validasi MIME & batas ukuran).',
    '• **Cakupan Manajemen, Keuangan & Hak Akses**\n  Halaman Info, Portofolio, Katalog, Testimoni, Profil Workshop, Log Pesanan, Halaman Admin Keuangan (pencatatan pemasukan, pengeluaran, & laporan arus kas), Halaman Pengaturan (bahasa, tema, & kredensial akun), serta Halaman Hak Akses Super Admin / Owner (invite, persetujuan, & pengaturan hak akses akun-akun admin).',
  ].join('\n'),
  includeAiFeatures: false,
  aiFeaturesDetail: [
    '• **Status Modul Chatbot / LLM API**\n  Tidak termasuk fitur chatbot atau pemanggilan LLM API berbayar dalam lingkup inti.',
    '• **AI Search / GEO**\n  Disediakan berkas standar /llms.txt (dan opsional /llms-full.txt) di root domain shansusdzar.com.',
  ].join('\n'),
  deploymentServer: [
    '• **Managed Domain & DNS 1 Pintu (Masa Aktif 1 Tahun)**\n  shansusdzar.com berlaku 1 (satu) tahun sejak aktivasi awal (A/CNAME, TXT, DNSSEC oleh AlinLabs Indonesia). Setelah 1 tahun domain tidak dapat aktif secara otomatis dan wajib direaktifkan kembali dengan nominal yang belum ditetapkan secara tetap namun berada di kisaran harga yang sama atau tidak jauh berbeda, menyesuaikan perubahan tarif provider maupun kurs mata uang.',
    '• **Hosting Produksi**\n  Alinlabs Server (Managed Edge & Static Hosting, Global CDN Cache, SPA Routing, Security Headers, & SSL/TLS 1.3 + HSTS).',
    '• **URL Staging / User Test**\n  https://shansusdzar.vercel.app.',
    '• **Cloud & Storage**\n  Alinlabs Cloud SQL Database + Object Storage 10GB.',
    '• **Pengelolaan Backup Server & Cloud (Tanggung Jawab Pihak Pertama / Opsional Berbayar)**\n  Pengelolaan backup rutin server dan Alinlabs Cloud tidak termasuk dalam paket kontrak awal dan diserahkan kepada Pihak Pertama. Apabila pengelolaan backup, penataan backup yang rapi, serta refresh dan pengoptimalisasian server kembali diserahkan kepada Pihak Kedua, dikenakan biaya tambahan sekitar Rp 150.000 hingga Rp 250.000 per project backup & refresh.',
  ].join('\n'),
  technicalDocumentation: [
    '• Panduan penggunaan Panel Admin CMS, Halaman Admin Keuangan, Halaman Pengaturan (bahasa, tema, & kredensial akun), serta Halaman Hak Akses Super Admin / Owner (invite, persetujuan, & hak akses akun admin).',
    '• Ringkasan konfigurasi arsitektur React, Vite, Edge API, & akun Search Console / GA4.',
    '• Checklist serah terima teknis (BAST) dan pengujian fungsi di staging.',
  ].join('\n'),
  techStackDetail: [
    '• **Frontend & Routing**\n  React 19 (19.0.1), Vite 8 (8.3.0), React Router v8 (8.5.1), TypeScript (7.0.2), & Tailwind CSS v4 (4.3.3).',
    '• **UI, State & Dokumen PDF**\n  Lucide React (0.546.0), Motion (12.23.24), Zustand (5.1.0), jsPDF (4.2.1), & pdfjs-dist (6.5.438).',
    '• **Backend, Database & Cache**\n  Edge API (Alinlabs Server TypeScript), Drizzle ORM, Alinlabs Cloud SQL & Object Storage 10GB (S3-Compatible), & Service Worker (public/sw.js).',
  ].join('\n'),
  securityArchitecture: [
    '• **Transport & Perimeter**\n  HTTPS/TLS 1.3 + HSTS, Web Application Firewall (WAF), & Mitigasi DDoS pada Alinlabs Server.',
    '• **HTTP Security Headers**\n  CSP (domain utama & GA4), X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Referrer-Policy, & Permissions-Policy.',
    '• **Aplikasi & Rahasia Server**\n  Anti-XSS, anti-SQL Injection (parameterized query), CSRF token, Presigned Upload tervalidasi, & isolasi penuh Server Secrets.',
    '• **Komitmen Kepemilikan & Kerahasiaan Data**\n  Seluruh data usaha, data keuangan pada Halaman Admin Keuangan, basis data pelanggan, serta Informasi Rahasia di dalam sistem sepenuhnya merupakan hak milik mutlak dan kerahasiaan penuh Shansus Dzar Indonesia.',
  ].join('\n'),
  seoGeoPerformance: [
    '• **On-Page & Schema.org**\n  Meta Title/Description dinamis, Canonical URL https://shansusdzar.com, OpenGraph, Twitter Card, & JSON-LD FurnitureStore + Product.',
    '• **Indexing & GEO (AI Search)**\n  robots.txt, sitemap.xml (https://shansusdzar.com/sitemap.xml), & /llms.txt agar dikutip akurat oleh ChatGPT, Gemini, Perplexity, & Claude.',
    '• **Optimasi Media & Vitals**\n  Gambar WebP, video hero VP9 (~4 MB) + poster fetchPriority="high", Save-Data, Vite code-splitting, Cache-Control immutable 1 tahun, & optimasi LCP/CLS.',
  ].join('\n'),
  includedRevisions: 2,
  outOfScopePolicy:
    'Error yang bersumber dari code atau source code buatan AlinLabs Indonesia sepenuhnya menjadi tanggung jawab Pihak Kedua dengan garansi selamanya gratis. Dikecualikan untuk update source akibat perubahan kebijakan eksternal (seperti kebijakan Google dll) yang dikenakan biaya Rp 50.000 - Rp 150.000. Apabila terjadi pergantian fitur hingga perombakan setelah deploy (publish) baik minor maupun mayor, dikenakan charge biaya update berkisar mulai dari Rp 100.000 hingga seterusnya tergantung kompleksitas yang diminta. Pengelolaan backup server dan cloud tidak termasuk layanan rutin kontrak awal dan diserahkan kepada Pihak Pertama; apabila diserahkan kepada Pihak Kedua untuk penataan backup yang rapi serta refresh dan pengoptimalisasian server kembali, dikenakan biaya tambahan sekitar Rp 150.000 - Rp 250.000 per project backup & refresh.',
};
