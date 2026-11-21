import type { ContractClause } from '../../types/contract';

/**
 * PASAL 1 - PASAL 4: Definisi Hukum, Ruang Lingkup Pekerjaan, serta Hak dan Kewajiban Para Pihak.
 */
export const CLAUSES_DEFINITIONS_AND_OBLIGATIONS: ContractClause[] = [
  {
    id: 'pasal-1',
    articleNumber: 1,
    title: 'DEFINISI DAN RUANG LINGKUP PERJANJIAN',
    sectionGroup: 'agreement-info',
    enabled: true,
    optional: false,
    legalBasisHint: 'Asas kepastian hukum perikatan (Pasal 1320 & Pasal 1338 KUHPerdata)',
    paragraphs: [
      {
        id: 'p1-1',
        optional: false,
        enabled: true,
        text: '"Perjanjian" adalah Surat Perjanjian Kerja Sama Jasa Pembuatan dan Pengembangan Website ini beserta seluruh lampiran, rincian teknis, jadwal pelaksanaan, matriks layanan, dan setiap adendum tertulis yang ditandatangani oleh Para Pihak.',
      },
      {
        id: 'p1-2',
        optional: false,
        enabled: true,
        text: '"Pihak Pertama" adalah Shansus Dzar Indonesia, badan usaha yang bergerak di bidang Interior Design & Building, selaku pengguna jasa yang memesan dan menerima hasil pengembangan Website.',
      },
      {
        id: 'p1-3',
        optional: false,
        enabled: true,
        text: '"Pihak Kedua" adalah AlinLabs Indonesia, badan usaha yang bergerak di bidang Digital Agency, Website Development, Artificial Intelligence & Digital Solutions, selaku penyedia jasa pengembangan.',
      },
      {
        id: 'p1-4',
        optional: false,
        enabled: true,
        text: '"Website" adalah keseluruhan sistem aplikasi web, antarmuka pengguna (UI/UX), struktur halaman, sistem manajemen konten (CMS), basis data, konfigurasi server produksi, dan integrasi terkait untuk proyek {{NAMA_PROYEK}}.',
      },
      {
        id: 'p1-5',
        optional: false,
        enabled: true,
        text: '"Jasa Pengembangan" adalah serangkaian pekerjaan profesional meliputi analisis kebutuhan, perancangan desain UI/UX, pemrograman frontend dan backend, integrasi sistem, pengujian kelayakan (QA), pendampingan User Acceptance Testing (UAT), serta peluncuran (deployment) ke lingkungan produksi.',
      },
      {
        id: 'p1-6',
        optional: false,
        enabled: true,
        text: '"Deliverables" atau Hasil Pekerjaan adalah seluruh keluaran terukur yang wajib diserahkan oleh Pihak Kedua kepada Pihak Pertama sebagaimana dirinci dalam Pasal 2, Pasal 7, dan Lampiran Perjanjian ini.',
      },
      {
        id: 'p1-7',
        optional: false,
        enabled: true,
        text: '"Perubahan Pekerjaan (Change Request)" adalah setiap permintaan penambahan, pengurangan, atau modifikasi atas arsitektur, jumlah halaman, alur bisnis, desain pasca-persetujuan, atau integrasi pihak ketiga di luar spesifikasi Pasal 2.',
      },
      {
        id: 'p1-8',
        optional: false,
        enabled: true,
        text: '"Bug" adalah galat pemrograman, cacat fungsi, atau ketidaksesuaian perilaku sistem terhadap spesifikasi teknis yang telah disepakati pada tahap desain dan pengembangan, yang bukan disebabkan oleh perubahan kode oleh pihak lain atau gangguan infrastruktur eksternal.',
      },
      {
        id: 'p1-9',
        optional: false,
        enabled: true,
        text: '"Garansi & Update Source" adalah tanggung jawab penuh Pihak Kedua atas error pada code/source code dengan garansi selamanya tanpa biaya, berbeda dengan kebutuhan update source akibat perubahan kebijakan pihak ketiga/Google maupun perubahan fitur/perombakan pasca deploy.',
      },
      {
        id: 'p1-10',
        optional: false,
        enabled: true,
        text: '"Hari Kerja" adalah hari Senin sampai dengan hari Jumat, kecuali hari libur nasional dan cuti bersama yang ditetapkan secara resmi oleh Pemerintah Republik Indonesia.',
      },
      {
        id: 'p1-11',
        optional: false,
        enabled: true,
        text: '"Berita Acara Serah Terima (BAST)" adalah dokumen tertulis atau elektronik yang ditandatangani oleh Para Pihak sebagai bukti sah bahwa Hasil Pekerjaan telah diuji, diterima, dan diserahterimakan.',
      },
    ],
  },
  {
    id: 'pasal-2',
    articleNumber: 2,
    title: 'RUANG LINGKUP PEKERJAAN',
    sectionGroup: 'scope-of-work',
    enabled: true,
    optional: false,
    legalBasisHint: 'Hal tertentu sebagai objek perjanjian yang sah (Pasal 1320 KUHPerdata)',
    paragraphs: [
      {
        id: 'p2-1',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama menunjuk Pihak Kedua untuk merancang, membangun, menguji, dan meluncurkan Website sesuai rincian spesifikasi teknis yang tercantum pada tabel Rincian Ruang Lingkup Teknis Pekerjaan di bawah pasal ini.',
      },
      {
        id: 'p2-2',
        optional: false,
        enabled: true,
        text: 'Setelah tahap pengerjaan awal (maksimal 3 hari kalender), Pihak Kedua menyerahkan hasil Website kepada Pihak Pertama untuk uji coba pengguna (user test) selama maksimal {{FEEDBACK_KLIEN_HARI}} (lima) hari kalender masa percobaan guna pengajuan revisi, yang selanjutnya diselesaikan dalam 3 (tiga) hari kalender sekaligus peluncuran (deploy/publish) ke internet.',
      },
      {
        id: 'p2-3',
        optional: false,
        enabled: true,
        text: 'Setiap fitur Artificial Intelligence (AI), modul automasi lanjutan, sistem transaksi pembayaran daring kompleks, atau integrasi perangkat lunak eksternal yang tidak tercantum secara eksplisit dalam tabel spesifikasi Pasal 2 tidak termasuk dalam Nilai Kontrak ini dan hanya dapat dilaksanakan berdasarkan persetujuan Change Request tertulis.',
      },
      {
        id: 'p2-4',
        optional: false,
        enabled: true,
        text: 'Pekerjaan di luar ruang lingkup yang dimintakan oleh Pihak Pertama wajib didahului dengan penawaran teknis, estimasi biaya tambahan, serta penyesuaian jadwal yang disetujui secara tertulis oleh kedua belah pihak sebelum Pihak Kedua berkewajiban mengerjakannya.',
      },
    ],
  },
  {
    id: 'pasal-3',
    articleNumber: 3,
    title: 'HAK DAN KEWAJIBAN PIHAK PERTAMA',
    sectionGroup: 'rights-obligations',
    enabled: true,
    optional: false,
    legalBasisHint: 'Kewajiban kerja sama & prestasi timbal balik pemberi kerja (Pasal 1338 KUHPerdata)',
    paragraphs: [
      {
        id: 'p3-1',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama berhak menerima hasil pengembangan Website sesuai spesifikasi teknis pada Pasal 2, melakukan masa percobaan uji coba (user test) maksimal 5 hari kalender, mengajukan revisi dalam masa percobaan tersebut, serta memperoleh garansi perbaikan selamanya atas error dari code/source code buatan Pihak Kedua.',
      },
      {
        id: 'p3-2',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama wajib menyediakan seluruh materi konten perusahaan yang dibutuhkan untuk pengisian Website, termasuk profil perusahaan, deskripsi layanan desain interior dan bangunan, foto/gambar portofolio proyek resolusi tinggi, logo resmi, panduan merek (brand guidelines), serta salinan teks dalam format digital yang siap digunakan.',
      },
      {
        id: 'p3-3',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama wajib menyediakan seluruh akses teknis yang diperlukan oleh Pihak Kedua tepat waktu, termasuk akses pengelolaan domain/DNS, akun layanan cloud atau hosting produksi, akun analitik/peta pihak ketiga, serta kredensial SMTP/email perusahaan.',
      },
      {
        id: 'p3-4',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama wajib menunjuk minimal 1 (satu) orang perwakilan proyek yang berwenang melakukan user test dan menyampaikan daftar revisi serta persetujuan tertulis selambat-lambatnya {{FEEDBACK_KLIEN_HARI}} (lima) hari kalender selama masa percobaan sejak akses uji coba diserahkan oleh Pihak Kedua.',
      },
      {
        id: 'p3-5',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama wajib melaksanakan seluruh kewajiban pembayaran tepat waktu sesuai Nilai Kontrak dan jadwal termin sebagaimana diatur dalam Pasal 5 Perjanjian ini.',
      },
      {
        id: 'p3-6',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama menjamin penuh bahwa seluruh aset merek, foto proyek interior/konstruksi, teks, video, dan materi lain yang diserahkan kepada Pihak Kedua merupakan milik sah atau telah berlisensi resmi, serta membebaskan Pihak Kedua dari segala tuntutan pihak ketiga atas pelanggaran Hak Kekayaan Intelektual yang bersumber dari materi yang disediakan Pihak Pertama.',
      },
    ],
  },
  {
    id: 'pasal-4',
    articleNumber: 4,
    title: 'HAK DAN KEWAJIBAN PIHAK KEDUA',
    sectionGroup: 'rights-obligations',
    enabled: true,
    optional: false,
    legalBasisHint: 'Standar profesionalisme pelaksana jasa teknologi digital (Pasal 1338 KUHPerdata)',
    paragraphs: [
      {
        id: 'p4-1',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua berhak menerima pembayaran penuh sesuai jadwal termin pada Pasal 5, memperoleh kelengkapan materi dan akses teknis dari Pihak Pertama, serta memperoleh kepastian persetujuan tertulis pada setiap milestone proyek.',
      },
      {
        id: 'p4-2',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua wajib melaksanakan Jasa Pengembangan secara profesional, cermat, dan sesuai standar praktik rekayasa perangkat lunak modern dengan memperhatikan keamanan sistem, kebersihan arsitektur kode, serta optimalisasi performa peramban desktop dan seluler.',
      },
      {
        id: 'p4-3',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua wajib menyampaikan pembaruan status progres proyek secara berkala kepada Pihak Pertama dan segera menginformasikan apabila terdapat hambatan teknis atau ketergantungan materi yang berpotensi memengaruhi jadwal penyelesaian.',
      },
      {
        id: 'p4-4',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua wajib menjaga kerahasiaan seluruh informasi bisnis, kredensial akses sistem, dan data pelanggan milik Pihak Pertama sesuai ketentuan Pasal 9 Perjanjian ini dan peraturan perlindungan data pribadi yang berlaku.',
      },
      {
        id: 'p4-5',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua wajib melaksanakan pengujian fungsional, pengujian tampilan lintas ukuran layar, dan verifikasi keamanan dasar pada lingkungan staging sebelum menyerahkan Website kepada Pihak Pertama untuk tahap UAT.',
      },
      {
        id: 'p4-6',
        optional: false,
        enabled: true,
        text: 'Pihak Kedua wajib memperbaiki setiap error atau Bug yang bersumber dari code/source code buatan Pihak Kedua secara bertanggung jawab dan bergaransi selamanya sesuai Pasal 10 serta Lampiran I, dan melaksanakan serah terima Deliverables sesuai Pasal 7.',
      },
    ],
  },
];
