import type { ContractClause } from '../../types/contract';

/**
 * PASAL 5 - PASAL 7: Nilai Kontrak & Pengakuan DP, Jangka Waktu Pelaksanaan, serta Serah Terima Hasil Pekerjaan.
 */
export const CLAUSES_COMMERCIAL_AND_DELIVERY: ContractClause[] = [
  {
    id: 'pasal-5',
    articleNumber: 5,
    title: 'NILAI KONTRAK DAN TATA CARA PEMBAYARAN',
    sectionGroup: 'pricing-payment',
    enabled: true,
    optional: false,
    legalBasisHint: 'Ketentuan harga, pengakuan pembayaran uang muka terdahulu, dan kewajiban pajak',
    paragraphs: [
      {
        id: 'p5-1',
        optional: false,
        enabled: true,
        text: 'Total Nilai Kontrak beserta rincian komponen pembentuk biayanya atas pelaksanaan seluruh Jasa Pengembangan dalam ruang lingkup Perjanjian ini adalah sebagaimana tercantum pada tabel Rincian Biaya Pekerjaan dan tabel Ringkasan Nilai Kontrak & Pengakuan Pembayaran Sebelumnya di bawah pasal ini.',
      },
      {
        id: 'p5-2',
        optional: false,
        enabled: true,
        text: 'PENGAKUAN PEMBAYARAN SEBELUMNYA (UANG MUKA / DOWN PAYMENT): Para Pihak dengan ini secara tegas mengakui dan menyatakan bahwa apabila Pihak Pertama telah menyetorkan pembayaran Uang Muka (DP) kepada Pihak Kedua sebelum tanggal penandatanganan Perjanjian ini, maka seluruh jumlah pembayaran DP tersebut diakui sah sebagai bagian dari Total Nilai Kontrak dan bukan merupakan kewajiban pembayaran baru ataupun pembayaran terpisah di luar Perjanjian ini.',
      },
      {
        id: 'p5-3',
        optional: false,
        enabled: true,
        text: 'PERHITUNGAN SISA PEMBAYARAN: Sisa kewajiban pembayaran Pihak Pertama dihitung secara matematis dengan rumus: Sisa Pembayaran = Total Nilai Kontrak dikurangi Total Pembayaran yang Telah Diterima, yang wajib dibayarkan sesuai tahapan termin pada tabel Jadwal Termin Pembayaran.',
      },
      {
        id: 'p5-4',
        optional: false,
        enabled: true,
        text: 'Setiap pembayaran termin diajukan melalui dokumen penawaran resmi (quotation) dari Pihak Kedua dengan skema 2 (dua) tahap pembayaran: (a) Pembayaran I — Uang Muka (Down Payment) sebesar Rp 700.000 (Tujuh Ratus Ribu Rupiah); dan (b) Pembayaran II — Pelunasan sisa nilai kontrak termasuk PPN 11% sebesar Rp 1.155.000 (Satu Juta Seratus Lima Puluh Lima Ribu Rupiah) setelah tahap uji coba (tester / user test) selesai dan wajib dilunasi sebelum Website di-deploy atau dipublikasikan secara lengkap ke internet. Seluruh pembayaran wajib dilunasi oleh Pihak Pertama selambat-lambatnya pada tanggal jatuh tempo, yaitu maksimal 7 (tujuh) hari kalender terhitung sejak tanggal penawaran (quotation) diterbitkan, melalui transfer bank ke rekening resmi Pihak Kedua pada Bank SeaBank Nomor Rekening 901387277710 atas nama Mela Melati Aprilia (Finance AlinLabs Indonesia). Pembayaran dianggap sah setelah dana diterima efektif pada rekening tersebut.',
      },
      {
        id: 'p5-5',
        optional: false,
        enabled: true,
        text: 'KETENTUAN PERPAJAKAN (PPN 11% KHUSUS INFRASTRUKTUR): Pajak Pertambahan Nilai (PPN) sebesar 11% (Rp 55.000) hanya dikenakan atas komponen Domain (shansusdzar.com), Hosting (Alinlabs Server), serta Database & Cloud 10GB (Alinlabs Cloud) dengan total dasar pengenaan Rp 500.000, sedangkan komponen jasa pembuatan halaman website, halaman admin keuangan, halaman pengaturan, dan halaman hak akses tidak dikenakan PPN. Apabila terdapat kewajiban pemotongan pajak penghasilan sesuai peraturan perpajakan Indonesia oleh Pihak Pertama, bukti potong wajib diserahkan kepada Pihak Kedua selambat-lambatnya pada bulan berikutnya.',
      },
      {
        id: 'p5-6',
        optional: false,
        enabled: true,
        text: 'PEMBLOKIRAN SEMENTARA SITUS AKIBAT KETERLAMBATAN PEMBAYARAN: Apabila Pihak Pertama tidak melakukan pembayaran sesuai tanggal jatuh tempo, yaitu melewati batas maksimal 7 (tujuh) hari kalender sejak tanggal penawaran (quotation) diterbitkan, maka AlinLabs Indonesia (Pihak Kedua) berhak melakukan pemblokiran sementara situs atau menonaktifkan akses Website sehingga Website tidak akan bisa terbuka maupun diakses hingga seluruh kewajiban pembayaran yang jatuh tempo dilunasi secara penuh, serta menunda pengerjaan tahap berikutnya tanpa dianggap sebagai wanprestasi dari pihak Pihak Kedua.',
      },
      {
        id: 'p5-7',
        optional: false,
        enabled: true,
        text: 'MASA AKTIF DAN REAKTIVASI DOMAIN TAHUNAN (1 TAHUN): Pendaftaran domain shansusdzar.com dalam Nilai Kontrak berlaku untuk masa aktif 1 (satu) tahun sejak aktivasi awal. Apabila masa aktif 1 (satu) tahun telah berakhir, domain secara otomatis tidak aktif dan Website tidak dapat diakses hingga domain direaktifkan kembali (perpanjangan). Nominal biaya reaktivasi untuk periode tahun berikutnya belum ditetapkan secara pasti saat ini, namun berada pada kisaran harga yang sama atau tidak jauh berbeda dari biaya periode awal dengan menyesuaikan perubahan tarif resmi dari provider domain maupun fluktuasi kurs mata uang yang berlaku saat perpanjangan.',
      },
      {
        id: 'p5-8',
        optional: false,
        enabled: true,
        text: 'PENGELOLAAN BACKUP SERVER & CLOUD DAN LAYANAN OPSIONAL BACKUP & REFRESH: Dalam lingkup Nilai Kontrak ini, pengelolaan backup rutin atas server maupun Alinlabs Cloud tidak termasuk sebagai layanan terkelola otomatis dan sepenuhnya diserahkan kepada tanggung jawab operasional Pihak Pertama. Apabila pengelolaan backup tersebut diserahkan untuk dikerjakan oleh Pihak Kedua guna pengoptimalisasian server kembali serta penyusunan backup yang rapi, maka Pihak Pertama dikenakan biaya tambahan di luar Nilai Kontrak berkisar Rp 150.000 (Seratus Lima Puluh Ribu Rupiah) hingga Rp 250.000 (Dua Ratus Lima Puluh Ribu Rupiah) per project backup & refresh sesuai volume data serta tingkat optimalisasi server yang dibutuhkan.',
      },
    ],
  },
  {
    id: 'pasal-6',
    articleNumber: 6,
    title: 'JANGKA WAKTU DAN PELAKSANAAN PROYEK',
    sectionGroup: 'project-info',
    enabled: true,
    optional: false,
    legalBasisHint: 'Pengaturan jadwal prestasi & perpanjangan waktu akibat ketergantungan klien',
    paragraphs: [
      {
        id: 'p6-1',
        optional: false,
        enabled: true,
        text: 'Jangka waktu pelaksanaan proyek terdiri atas: (a) Pengerjaan Website oleh Pihak Kedua paling lama 3 (tiga) hari kalender sejak tanggal terbit kontrak; (b) Penyerahan kepada Pihak Pertama untuk uji coba (user test) dan masa percobaan pengajuan revisi selama maksimal {{FEEDBACK_KLIEN_HARI}} (lima) hari kalender; dan (c) Penyelesaian perbaikan revisi sekaligus peluncuran (deploy/publish) Website ke internet dalam waktu 3 (tiga) hari kalender, dengan total estimasi siklus pelaksanaan 11 (sebelas) hari kalender sebagaimana dirinci pada tabel Jadwal Induk dan Tahapan Milestone di bawah ini.',
      },
      {
        id: 'p6-2',
        optional: false,
        enabled: true,
        text: 'Para Pihak menyadari bahwa ketepatan penyelesaian setiap tahap bergantung pada ketepatan waktu Pihak Pertama dalam menyediakan aset konten, akses infrastruktur teknis, serta menyampaikan tanggapan atau persetujuan tertulis.',
      },
      {
        id: 'p6-3',
        optional: false,
        enabled: true,
        text: 'Apabila Pihak Pertama terlambat menyerahkan materi konten, kredensial akses, atau daftar revisi hasil masa percobaan melebihi batas {{FEEDBACK_KLIEN_HARI}} (lima) hari kalender masa percobaan user test, maka waktu peluncuran (deploy/publish) secara wajar menyesuaikan jumlah hari keterlambatan tersebut sesuai ketersediaan tim teknis Pihak Kedua.',
      },
      {
        id: 'p6-4',
        optional: false,
        enabled: true,
        text: 'Apabila terdapat permintaan Perubahan Pekerjaan (Change Request) yang disetujui sesuai Pasal 11, maka jadwal pelaksanaan proyek diperbarui sesuai estimasi tambahan waktu yang disepakati pada dokumen Change Request terkait.',
      },
    ],
  },
  {
    id: 'pasal-7',
    articleNumber: 7,
    title: 'PENYERAHAN HASIL PEKERJAAN DAN UJI TERIMA (UAT)',
    sectionGroup: 'scope-of-work',
    enabled: true,
    optional: false,
    legalBasisHint: 'Protokol verifikasi teknis (UAT) dan bukti pemenuhan prestasi (BAST)',
    paragraphs: [
      {
        id: 'p7-1',
        optional: false,
        enabled: true,
        text: 'Setelah pengerjaan awal selesai dalam maksimal 3 (tiga) hari kalender sejak tanggal terbit kontrak, Pihak Kedua menyerahkan akses uji coba pengguna (user test / staging) kepada Pihak Pertama untuk melakukan pemeriksaan kesesuaian Website terhadap spesifikasi Pasal 2.',
      },
      {
        id: 'p7-2',
        optional: false,
        enabled: true,
        text: 'Pihak Pertama berhak melaksanakan masa percobaan (tester / user test) dan mengajukan daftar revisi secara terkonsolidasi selama maksimal {{FEEDBACK_KLIEN_HARI}} (lima) hari kalender sejak akses uji coba diserahkan. Selanjutnya Pihak Kedua menyelesaikan perbaikan revisi dan, setelah Pihak Pertama melunasi seluruh sisa kewajiban pembayaran (Pembayaran II sebesar Rp 1.155.000 termasuk PPN 11%) setelah tester dan sebelum deploy, Pihak Kedua melaksanakan peluncuran (deploy) dan publikasi lengkap Website ke internet dalam jangka waktu 3 (tiga) hari kalender. Apabila dalam masa percobaan 5 hari tersebut tidak ada catatan revisi tertulis dari Pihak Pertama, Website dinyatakan siap untuk di-deploy dan dipublikasikan lengkap setelah pelunasan sisa kewajiban pembayaran tersebut.',
      },
      {
        id: 'p7-3',
        optional: false,
        enabled: true,
        text: 'Setelah temuan revisi masa percobaan (tester) diselesaikan, kewajiban pelunasan sisa nilai kontrak termasuk PPN (Pembayaran II) telah dipenuhi oleh Pihak Pertama sebelum deploy, dan Website diluncurkan serta dipublikasikan lengkap ke domain produksi, Pihak Kedua menyerahkan Deliverables final berupa: (a) Website live pada server produksi; (b) file desain final yang digunakan dalam proyek; (c) struktur basis data dan konten awal; (d) akun administrator utama (super admin / owner beserta akses Halaman Pengaturan dan Halaman Hak Akses); (e) akses pengelolaan domain/hosting (sepanjang berada dalam pengelolaan Pihak Kedua); (f) dokumentasi panduan penggunaan CMS dan konfigurasi teknis; serta (g) {{SOURCE_CODE_KLAUSUL}}.',
      },
      {
        id: 'p7-4',
        optional: false,
        enabled: true,
        text: 'Penyerahan Deliverables final didokumentasikan melalui Berita Acara Serah Terima (BAST) yang ditandatangani oleh perwakilan berwenang Para Pihak, serta menandai berlakunya garansi selamanya atas error code/source code sesuai ketentuan Pasal 10.',
      },
    ],
  },
];
