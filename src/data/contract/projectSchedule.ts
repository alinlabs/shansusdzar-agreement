import type { ProjectInfo } from '../../types/contract';

/**
 * Struktur pelaksanaan proyek, tahapan milestone, dan ketergantungan jadwal.
 */
export const PROJECT_SCHEDULE_DATA: ProjectInfo = {
  projectName: 'Pembuatan dan Pengembangan Website Resmi Shansus Dzar Indonesia',
  websiteType: 'Website Korporasi, Katalog Layanan & Portofolio Proyek Interior Design & Building',
  websitePurpose:
    'Membangun representasi digital resmi Shansus Dzar Indonesia untuk menampilkan portofolio desain interior dan konstruksi bangunan, profil perusahaan, kapabilitas layanan, serta kanal akuisisi konsultasi proyek secara profesional.',
  startDate: '',
  targetEndDate: '',
  estimatedDurationDays: 11,
  clientFeedbackMaxDays: 5,
  milestones: [
    {
      id: 'ms-1',
      phase: 'Tahap I — Pengerjaan & Pengembangan Website (Maks. 3 Hari)',
      deliverable:
        'Pengerjaan maksimal 3 (tiga) hari kalender terhitung sejak tanggal terbit kontrak, meliputi pembangunan halaman inti website, Halaman Admin Keuangan, Halaman Pengaturan, Halaman Hak Akses Super Admin / Owner (React 19 + Vite 8 + TypeScript + Tailwind CSS v4), Domain shansusdzar.com, Hosting Alinlabs Server, Database SQL (Drizzle ORM) & Cloud 10GB Alinlabs Cloud, serta Setup Search Console, GA4 & GEO /llms.txt.',
      durationDays: 3,
      targetDate: '',
    },
    {
      id: 'ms-2',
      phase: 'Tahap II — User Test & Masa Percobaan Revisi (Maks. 5 Hari)',
      deliverable:
        'Penyerahan hasil Website melalui URL staging https://shansusdzar.vercel.app kepada Pihak Pertama untuk uji coba pengguna (user test) selama maksimal 5 (lima) hari kalender masa percobaan guna memeriksa fungsi dan menyampaikan daftar revisi.',
      durationDays: 5,
      targetDate: '',
    },
    {
      id: 'ms-3',
      phase: 'Tahap III — Perbaikan Revisi, Pelunasan Sebelum Deploy & Publish (3 Hari)',
      deliverable:
        'Pengerjaan perbaikan atas seluruh catatan revisi dari masa percobaan (tester) serta setelah pelunasan sisa nilai kontrak termasuk PPN sebesar Rp 1.155.000 dilakukan sebelum deploy, dilanjutkan peluncuran (deploy) dan publikasi lengkap Website ke domain https://shansusdzar.com pada Alinlabs Server dalam waktu 3 (tiga) hari kalender hingga siap diakses publik.',
      durationDays: 3,
      targetDate: '',
    },
  ],
};
