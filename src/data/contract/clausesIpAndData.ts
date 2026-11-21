import type { ContractClause } from '../../types/contract';

/**
 * PASAL 8 - PASAL 9: Hak Kekayaan Intelektual (UU No. 28 Tahun 2014) dan Kerahasiaan serta Pelindungan Data Pribadi (UU No. 27 Tahun 2022).
 */
export const CLAUSES_IP_AND_DATA_PROTECTION: ContractClause[] = [
  {
    id: 'pasal-8',
    articleNumber: 8,
    title: 'HAK KEKAYAAN INTELEKTUAL',
    sectionGroup: 'intellectual-property',
    enabled: true,
    optional: false,
    legalBasisHint: 'UU No. 28 Tahun 2014 tentang Hak Cipta — Kepemilikan eksklusif source code oleh AlinLabs Indonesia & lisensi hak guna operasional',
    paragraphs: [
      {
        id: 'p8-1',
        optional: false,
        enabled: true,
        text: 'KEPEMILIKAN EKSKLUSIF SOURCE CODE OLEH ALINLABS INDONESIA: Berdasarkan Undang-Undang Nomor 28 Tahun 2014 tentang Hak Cipta, seluruh kode sumber (source code), program komputer, struktur arsitektur sistem, skrip frontend dan backend, komponen antarmuka, kerangka kerja internal (internal boilerplate), modul utilitas, serta rancangan teknis Website ini tetap merupakan Hak Kekayaan Intelektual yang dimiliki secara eksklusif dan penuh oleh Pihak Kedua (AlinLabs Indonesia). Perjanjian ini tidak mengalihkan kepemilikan atau hak cipta atas source code kepada Pihak Pertama.',
      },
      {
        id: 'p8-2',
        optional: false,
        enabled: true,
        text: 'LISENSI HAK GUNA & LARANGAN MENGEDIT, MENGUBAH, ATAU MENJUAL SOURCE CODE: Dengan dipenuhinya kewajiban pembayaran Nilai Kontrak oleh Pihak Pertama, Pihak Kedua memberikan izin atau lisensi penggunaan operasional non-eksklusif kepada Pihak Pertama untuk memanfaatkan Website bagi kegiatan usaha Shansus Dzar Indonesia. Pihak Pertama dilarang keras untuk mengedit, mengubah, memodifikasi, menyalin sebagian atau seluruhnya, melakukan rekayasa balik (reverse engineering), mendistribusikan ulang, menyewakan, memperjualbelikan, atau memindahtangankan dalam bentuk apa pun seluruh atau sebagian source code dan komponen program Website ini kepada pihak lain tanpa persetujuan tertulis resmi dari AlinLabs Indonesia.',
      },
      {
        id: 'p8-3',
        optional: false,
        enabled: true,
        text: 'PENGELOLAAN KONTEN & DATA MELALUI PANEL ADMIN: Pihak Pertama berhak penuh mengelola dan memperbarui data konten operasional, preferensi akun, otorisasi admin, serta pembukuan (artikel pada Halaman Info, item Portofolio, data Katalog/profil, data transaksi pada Halaman Admin Keuangan, bahasa/tema/kredensial pada Halaman Pengaturan, serta invite/persetujuan/hak akses admin oleh Super Admin/Owner pada Halaman Hak Akses) melalui Panel Admin / CMS yang telah disediakan, sedangkan segala bentuk perbaikan galat (error/bug) maupun pembaruan kode sumber (update source) hanya boleh dikerjakan oleh Pihak Kedua sesuai Pasal 10 dan Pasal 11.',
      },
      {
        id: 'p8-4',
        optional: false,
        enabled: true,
        text: 'FRAMEWORK, OPEN-SOURCE LIBRARY & LISENSI PIHAK KETIGA: Dalam pengembangannya, Website turut memanfaatkan framework dan pustaka sumber terbuka (open-source software seperti lisensi MIT, Apache 2.0, atau BSD) serta layanan/API pihak ketiga yang masing-masing tetap tunduk pada ketentuan lisensi pemegang hak aslinya.',
      },
      {
        id: 'p8-5',
        optional: false,
        enabled: true,
        text: 'KEPEMILIKAN KONTEN & MEREK PIHAK PERTAMA: Seluruh materi konten bisnis, merek dagang, nama dagang "Shansus Dzar Indonesia", logo, foto/video proyek desain interior, dan data pelanggan yang disediakan Pihak Pertama tetap sepenuhnya menjadi milik sah Pihak Pertama, dan Pihak Kedua hanya memanfaatkannya sebatas untuk kebutuhan pengembangan serta operasional Website.',
      },
      {
        id: 'p8-6',
        optional: true,
        enabled: true,
        text: 'PENGGUNAAN PORTOFOLIO: {{PORTOFOLIO_KLAUSUL}}',
      },
    ],
  },
  {
    id: 'pasal-9',
    articleNumber: 9,
    title: 'KERAHASIAAN DAN PERLINDUNGAN DATA PRIBADI',
    sectionGroup: 'confidentiality-pdp',
    enabled: true,
    optional: false,
    legalBasisHint: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) & UU Rahasia Dagang',
    paragraphs: [
      {
        id: 'p9-1',
        optional: false,
        enabled: true,
        text: 'KOMITMEN KEPEMILIKAN DAN KERAHASIAAN PENUH DATA MILIK SHANSUS DZAR INDONESIA: Para Pihak dengan ini menegaskan dan berkomitmen penuh bahwa seluruh kerahasiaan data usaha, data keuangan pada Halaman Admin Keuangan, strategi bisnis, struktur harga, data proyek interior dan klien Pihak Pertama, basis data pelanggan dan log pesanan, serta seluruh Informasi Rahasia yang dikelola maupun tersimpan di dalam Website sepenuhnya merupakan hak milik mutlak dan kerahasiaan eksklusif Shansus Dzar Indonesia (Pihak Pertama). AlinLabs Indonesia (Pihak Kedua) berkomitmen penuh menjaga kerahasiaan seluruh data tersebut serta dilarang keras mengakses di luar keperluan dukungan teknis resmi, menyalin untuk kepentingan pihak lain, membocorkan, memperjualbelikan, atau memanfaatkannya kepada pihak ketiga mana pun tanpa persetujuan tertulis terlebih dahulu dari Shansus Dzar Indonesia.',
      },
      {
        id: 'p9-2',
        optional: false,
        enabled: true,
        text: 'KEAMANAN SISTEM & PEMBATASAN AKSES: Pihak Kedua hanya diperkenankan mengakses dan menggunakan kredensial serta data Pihak Pertama sebatas yang diperlukan untuk pelaksanaan pengembangan, pengujian, dan dukungan teknis, dengan menerapkan pengendalian akses berbasis peran, enkripsi jalur komunikasi (TLS/HTTPS), serta tidak menyimpan kredensial sensitif secara tidak aman.',
      },
      {
        id: 'p9-3',
        optional: true,
        enabled: true,
        text: 'PERAN PENGENDALI DAN PROSESOR DATA PRIBADI (UU NO. 27 TAHUN 2022): Sepanjang Website mengumpulkan, menyimpan, atau memproses Data Pribadi (seperti nama, nomor telepon, email, atau data konsultasi pengunjung dan pelanggan), Pihak Pertama berkedudukan sebagai Pengendali Data Pribadi yang menentukan tujuan dan kendali pemrosesan serta wajib memenuhi dasar pemrosesan yang sah dan kebijakan privasi pada Website. Pihak Kedua berkedudukan sebagai Prosesor Data Pribadi sepanjang melakukan pemrosesan teknis atas nama dan berdasarkan instruksi terdokumentasi Pihak Pertama sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.',
      },
      {
        id: 'p9-4',
        optional: false,
        enabled: true,
        text: 'PELAPORAN INSIDEN KEAMANAN & KEGAGALAN PELINDUNGAN DATA: Apabila terjadi dugaan akses tidak sah, kebocoran data, atau insiden keamanan siber yang memengaruhi data dalam lingkup sistem yang dikelola atau diakses Pihak Kedua, Pihak Kedua wajib segera mengambil langkah mitigasi darurat dan menyampaikan pemberitahuan tertulis kepada Pihak Pertama dalam waktu yang memungkinkan Pihak Pertama memenuhi kewajiban notifikasi paling lambat 3 x 24 (tiga kali dua puluh empat) jam sebagaimana diatur dalam Pasal 46 Undang-Undang Nomor 27 Tahun 2022.',
      },
      {
        id: 'p9-5',
        optional: false,
        enabled: true,
        text: 'PENGEMBALIAN & PENGHAPUSAN DATA PASCA PERJANJIAN: Setelah proyek diserahterimakan atau Perjanjian berakhir, Pihak Kedua wajib mengembalikan atau menghapus secara aman seluruh salinan data produksi, cadangan sementara di lingkungan staging, serta kredensial akses milik Pihak Pertama atas permintaan tertulis Pihak Pertama (dan Pihak Pertama wajib segera mengganti kata sandi administratif utama). Kewajiban menjaga kerahasiaan tetap mengikat Para Pihak selama 3 (tiga) tahun setelah berakhirnya Perjanjian ini.',
      },
    ],
  },
];
