import type { ContractDocument } from '../types/contract';
import {
  calculateTaxSummary,
  formatIDR,
  summarizeCostBreakdown,
  summarizeTermins,
  terbilangIDR,
} from '../utils/currency';
import { formatDateTimeID, formatIndonesianDate, getIndonesianDayName } from '../utils/date';
import { DOCUMENT_HEADER_META } from '../data/contract/agreementMeta';
import { HANDOVER_CHECKLIST_ITEMS, WARRANTY_SLA_MATRIX } from '../data/contract/appendices';

export interface TableColumn {
  header: string;
  widthRatio: number; // sum = 1
  align?: 'left' | 'right' | 'center';
}

export interface KeyValueRow {
  label: string;
  value: string;
}

export interface DataTableSummaryLine {
  label: string;
  value: string;
  isTotal?: boolean;
  boldValue?: boolean;
}

export type DocumentBlock =
  | {
      type: 'header-title';
      title: string;
      subtitle: string;
      contractNumber: string;
      anchorId?: string;
    }
  | {
      type: 'paragraph';
      text: string;
      align?: 'justify' | 'left' | 'center';
      bold?: boolean;
      italic?: boolean;
      spaceAfter?: number;
    }
  | {
      type: 'section-label';
      text: string;
      align?: 'left' | 'center';
      anchorId?: string;
    }
  | {
      type: 'key-value-table';
      title?: string;
      rows: KeyValueRow[];
      valueAlign?: 'left' | 'justify';
    }
  | {
      type: 'data-table';
      title?: string;
      columns: TableColumn[];
      rows: string[][];
      summaryLines?: DataTableSummaryLine[];
    }
  | {
      type: 'article-heading';
      articleNumber: number;
      title: string;
      anchorId?: string;
    }
  | {
      type: 'numbered-paragraph';
      indexLabel: string;
      text: string;
    }
  | {
      type: 'signature-block';
      anchorId?: string;
      city: string;
      dateText: string;
      firstPartyCompany: string;
      firstPartySignerName: string;
      firstPartySignerTitle: string;
      firstPartySignedAt: string;
      firstPartySignatureUrl: string;
      firstPartyCertStatus: string;
      firstPartyHash: string;
      secondPartyCompany: string;
      secondPartyCommercial: string;
      secondPartySignerName: string;
      secondPartySignerTitle: string;
      secondPartySignedAt: string;
      secondPartySignatureUrl: string;
      secondPartyCertStatus: string;
      secondPartyHash: string;
      psreModeLabel: string;
    };

export interface LegalDocumentModel {
  contractNumber: string;
  version: number;
  statusLabel: string;
  headerTitle: string;
  documentHashShort: string;
  blocks: DocumentBlock[];
}

function cleanVal(val: string | undefined | null, fallback = '-'): string {
  const trimmed = (val || '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

const NON_LABEL_COLON_ENDINGS =
  /(berupa|apabila|terdiri atas|berlandaskan pada|dengan acuan|sebagai berikut|meliputi|antara lain|yakni|yaitu|dengan rumus|dibawah ini|di bawah ini)$/i;

/**
 * Marks heading/label prefixes before a colon (`:`) as bold (`**...**`)
 * and places the following body text on the line directly below without the colon,
 * without altering introductory sentences ending with `berupa:`, `terdiri atas:`, etc.
 */
export function boldColonLeadIn(text: string): string {
  if (!text || text.includes('**')) return text;

  const match = text.match(/^([^:\n]+):(\s+[\s\S]+)$/);
  if (!match) return text;

  const prefix = match[1].trim();
  const suffix = match[2].trimStart();
  if (!prefix) return text;
  if (/^https?$/i.test(prefix) || /^\d{1,2}$/.test(prefix)) return text;

  const isAllUpperHeading = !/[a-z]/.test(prefix);
  const isShortLabelPrefix =
    prefix.length <= 80 &&
    !prefix.includes('. ') &&
    !NON_LABEL_COLON_ENDINGS.test(prefix);

  if (!isAllUpperHeading && !isShortLabelPrefix) {
    return text;
  }

  return `**${prefix}**\n${suffix}`;
}

function resolvePlaceholders(rawText: string, doc: ContractDocument): string {
  const { legalSettings, scope, project } = doc;
  const sourceCodeText = legalSettings.sourceCodeHandover
    ? 'penyerahan repositori kode sumber (source code) khusus proyek'
    : 'aktivasi hak guna operasional sistem sesuai lisensi Pasal 8 (tanpa pengalihan kepemilikan atau hak modifikasi atas source code)';

  const ipConditionText =
    legalSettings.ipTransferCondition === 'FULL_PAYMENT'
      ? 'hak ekonomi beralih penuh setelah seluruh kewajiban pembayaran Nilai Kontrak dilunasi oleh Pihak Pertama'
      : 'hak ekonomi atas bagian pekerjaan beralih secara proporsional sesuai termin pembayaran yang telah dilunasi';

  const portfolioText = legalSettings.allowPortfolioShowcase
    ? 'Pihak Kedua berhak mencantumkan nama proyek, cuplikan tampilan visual non-rahasia, dan keterangan umum kerja sama sebagai referensi portofolio resmi AlinLabs Indonesia dengan tetap menjaga kerahasiaan data bisnis Pihak Pertama.'
    : 'Pihak Kedua tidak diperkenankan mempublikasikan proyek ini sebagai portofolio tanpa persetujuan tertulis terlebih dahulu dari Pihak Pertama.';

  const maintenanceFeeText =
    legalSettings.maintenanceMonthlyFee > 0
      ? `${formatIDR(legalSettings.maintenanceMonthlyFee)} per bulan (${legalSettings.maintenanceScope || 'sesuai paket pemeliharaan disepakati'})`
      : 'sesuai penawaran paket pemeliharaan terpisah yang disepakati Para Pihak';

  const jurisdictionCity = (legalSettings.disputeJurisdiction || doc.agreement.signingCity || 'Jakarta Selatan').trim();
  const disputeForumText =
    legalSettings.disputeForum === 'BANI'
      ? `Badan Arbitrase Nasional Indonesia (BANI) di ${jurisdictionCity} sesuai peraturan prosedur arbitrase BANI yang putusannya bersifat final dan mengikat`
      : `Kepaniteraan Pengadilan Negeri ${jurisdictionCity}`;

  const stampDutyText =
    legalSettings.stampDutyBearer === 'FIRST_PARTY'
      ? 'Pihak Pertama'
      : legalSettings.stampDutyBearer === 'SECOND_PARTY'
        ? 'Pihak Kedua'
        : 'masing-masing Pihak atas salinan dokumen yang dipegangnya atau secara bersama sesuai kesepakatan';

  const domicileText = `Kepaniteraan Pengadilan Negeri ${jurisdictionCity}`;

  const replacements: Record<string, string> = {
    '{{NAMA_PROYEK}}': project.projectName || 'Website Shansus Dzar Indonesia',
    '{{REVISI_TERMASUK}}': String(Math.max(1, scope.includedRevisions || 2)),
    '{{FEEDBACK_KLIEN_HARI}}': String(Math.max(1, project.clientFeedbackMaxDays || 5)),
    '{{SOURCE_CODE_KLAUSUL}}': sourceCodeText,
    '{{HKI_KONDISI_PENGALIHAN}}': ipConditionText,
    '{{PORTOFOLIO_KLAUSUL}}': portfolioText,
    '{{GARANSI_HARI}}':
      legalSettings.warrantyDays > 0
        ? String(legalSettings.warrantyDays)
        : 'Selamanya (atas error code/source)',
    '{{RESPON_BUG_JAM}}': String(Math.max(1, legalSettings.bugFixResponseHours || 24)),
    '{{BIAYA_MAINTENANCE}}': maintenanceFeeText,
    '{{FORCE_MAJEURE_HARI}}': String(Math.max(1, legalSettings.forceMajeureNoticeDays || 7)),
    '{{TERMINASI_HARI}}': String(Math.max(1, legalSettings.terminationNoticeDays || 14)),
    '{{FORUM_SENGKETA}}': disputeForumText,
    '{{BEA_METERAI}}': stampDutyText,
    '{{JUMLAH_RANGKAP}}': String(Math.max(2, doc.agreement.counterpartsCount || 2)),
    '{{DOMISILI_HUKUM}}': domicileText,
  };

  let output = rawText;
  for (const [token, val] of Object.entries(replacements)) {
    output = output.split(token).join(val);
  }
  return output;
}

export function buildLegalDocumentModel(doc: ContractDocument): LegalDocumentModel {
  const blocks: DocumentBlock[] = [];

  const contractNumber = cleanVal(doc.agreement.contractNumber, 'ALINLABS/SDI/AGR/3-048/XI/2026');
  const city = cleanVal(doc.agreement.signingCity, 'Purwakarta');
  const dateFormatted = doc.agreement.agreementDate
    ? formatIndonesianDate(doc.agreement.agreementDate)
    : '........................................';
  const dayName = doc.agreement.agreementDate ? getIndonesianDayName(doc.agreement.agreementDate) : '';

  const statusLabels: Record<ContractDocument['status'], string> = {
    DRAFT: 'DRAF RESMI',
    IN_REVIEW: 'PEMERIKSAAN HUKUM',
    FINAL_LOCKED: 'SIAP DITANDATANGANI',
    SIGNED: 'TELAH DITANDATANGANI',
  };

  blocks.push({
    type: 'header-title',
    anchorId: 'opening',
    title: DOCUMENT_HEADER_META.title,
    subtitle: DOCUMENT_HEADER_META.subtitle,
    contractNumber: `Nomor: ${contractNumber}`,
  });

  const openingDayPart = dayName ? `hari ini, ${dayName}, tanggal ${dateFormatted}` : `tanggal ${dateFormatted}`;
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    text: `Pada ${openingDayPart}, bertempat di ${city}, telah dibuat dan disepakati Surat Perjanjian Kerja Sama Jasa Pembuatan dan Pengembangan Website ("Perjanjian") oleh dan antara Para Pihak yang bertanda tangan di bawah ini:`,
  });

  // Identitas Pihak Pertama
  blocks.push({
    type: 'section-label',
    text: '1. PIHAK PERTAMA (KLIEN / PEMBELI)',
  });
  blocks.push({
    type: 'key-value-table',
    rows: [
      { label: 'Nama Perusahaan / Badan Usaha', value: cleanVal(doc.firstParty.legalName) },
      { label: 'Bentuk Badan Usaha', value: cleanVal(doc.firstParty.entityType) },
      { label: 'Bidang Usaha', value: cleanVal(doc.firstParty.businessField) },
      { label: 'Alamat Perusahaan', value: cleanVal(doc.firstParty.address) },
      { label: 'Diwakili Oleh', value: `${cleanVal(doc.firstParty.directorName)} (${cleanVal(doc.firstParty.directorTitle)})` },
      { label: 'Dasar Kewenangan', value: cleanVal(doc.firstParty.authorityBasis) },
      { label: 'Kontak Resmi', value: `Telp: ${cleanVal(doc.firstParty.phone)} | Email: ${cleanVal(doc.firstParty.email)}` },
    ],
  });
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    italic: true,
    text: 'Untuk selanjutnya dalam Perjanjian ini disebut sebagai "PIHAK PERTAMA".',
  });

  // Identitas Pihak Kedua
  blocks.push({
    type: 'section-label',
    text: '2. PIHAK KEDUA (PENYEDIA JASA / PENGEMBANG)',
  });
  const secondPartyRows: KeyValueRow[] = [
    { label: 'Nama Badan Usaha', value: cleanVal(doc.secondParty.legalName, 'AlinLabs Indonesia') },
  ];
  if (
    doc.secondParty.commercialName &&
    doc.secondParty.commercialName.trim() !== doc.secondParty.legalName.trim()
  ) {
    secondPartyRows.push({
      label: 'Nama Komersial',
      value: cleanVal(doc.secondParty.commercialName, 'AlinLabs Indonesia'),
    });
  }
  secondPartyRows.push(
    { label: 'Bentuk Badan Usaha', value: cleanVal(doc.secondParty.entityType) },
    { label: 'Bidang Usaha', value: cleanVal(doc.secondParty.businessField) },
    { label: 'Alamat Perusahaan', value: cleanVal(doc.secondParty.address) },
    { label: 'Diwakili Oleh', value: `${cleanVal(doc.secondParty.directorName)} (${cleanVal(doc.secondParty.directorTitle)})` },
    { label: 'Dasar Kewenangan', value: cleanVal(doc.secondParty.authorityBasis) },
    { label: 'Kontak Resmi', value: `Telp: ${cleanVal(doc.secondParty.phone)} | Email: ${cleanVal(doc.secondParty.email)}` }
  );

  blocks.push({
    type: 'key-value-table',
    rows: secondPartyRows,
  });
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    italic: true,
    text: 'Untuk selanjutnya dalam Perjanjian ini disebut sebagai "PIHAK KEDUA".',
  });

  // Konsiderans
  blocks.push({
    type: 'section-label',
    anchorId: 'recitals',
    text: 'KONSIDERANS (PERTIMBANGAN & LANDASAN HUKUM)',
  });
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    text: 'Pihak Pertama dan Pihak Kedua secara bersama-sama disebut sebagai "Para Pihak", dan masing-masing disebut sebagai "Pihak". Para Pihak terlebih dahulu menerangkan hal-hal sebagai berikut:',
  });
  blocks.push({
    type: 'numbered-paragraph',
    indexLabel: 'a.',
    text: boldColonLeadIn(
      `Bahwa Pihak Pertama adalah perusahaan yang bergerak di bidang ${doc.firstParty.businessField} yang membutuhkan jasa profesional pembuatan dan pengembangan Website untuk proyek "${doc.project.projectName}".`
    ),
  });
  blocks.push({
    type: 'numbered-paragraph',
    indexLabel: 'b.',
    text: boldColonLeadIn(
      `Bahwa Pihak Kedua adalah perusahaan teknologi digital yang bergerak di bidang ${doc.secondParty.businessField} yang memiliki keahlian, tim rekayasa, dan pengalaman profesional untuk melaksanakan pekerjaan tersebut.`
    ),
  });
  blocks.push({
    type: 'numbered-paragraph',
    indexLabel: 'c.',
    text: boldColonLeadIn(
      doc.financial.downPaymentPaid > 0
        ? `Bahwa sebelum ditandatanganinya Perjanjian ini, Pihak Pertama telah menyetorkan pembayaran Uang Muka (Down Payment) sebesar ${formatIDR(doc.financial.downPaymentPaid)} kepada Pihak Kedua, yang diakui secara sah sebagai bagian dari Nilai Kontrak dalam Perjanjian ini.`
        : 'Bahwa apabila sebelum penandatanganan Perjanjian ini Pihak Pertama telah melakukan pembayaran Uang Muka (Down Payment), maka pembayaran tersebut diakui dan diperhitungkan secara sah sebagai bagian dari Total Nilai Kontrak sebagaimana diatur dalam Pasal 5.'
    ),
  });
  blocks.push({
    type: 'numbered-paragraph',
    indexLabel: 'd.',
    text: boldColonLeadIn(
      `Bahwa Perjanjian ini disusun dengan berlandaskan pada: ${DOCUMENT_HEADER_META.legalBasisSummary.join('; ')}.`
    ),
  });
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    text: 'Berdasarkan pertimbangan di atas, Para Pihak dengan ini sepakat mengikatkan diri dalam Perjanjian Kerja Sama dengan syarat dan ketentuan sebagai berikut:',
  });

  // Render Pasal 1 .. Pasal 16
  let articleCounter = 1;
  for (const clause of doc.clauses) {
    if (!clause.enabled) continue;
    const currentArticleNo = articleCounter++;

    blocks.push({
      type: 'article-heading',
      anchorId: clause.id,
      articleNumber: currentArticleNo,
      title: clause.title,
    });

    const activeParagraphs = clause.paragraphs.filter((p) => p.enabled);
    activeParagraphs.forEach((para, idx) => {
      if (para.id === 'p9-3' && !doc.legalSettings.includePdpRoleClause) {
        return;
      }
      blocks.push({
        type: 'numbered-paragraph',
        indexLabel: `(${idx + 1})`,
        text: boldColonLeadIn(resolvePlaceholders(para.text, doc)),
      });
    });

    // Inject structured technical scope table inside Pasal 2
    if (clause.id === 'pasal-2') {
      const scopeRows: KeyValueRow[] = [
        { label: 'Nama Proyek', value: cleanVal(doc.project.projectName) },
        { label: 'Jenis Website', value: cleanVal(doc.project.websiteType) },
        { label: 'Tujuan Website', value: cleanVal(doc.project.websitePurpose) },
        {
          label: 'Daftar Halaman',
          value: doc.scope.pagesList
            .map((p) => (p.trim().startsWith('\u2022') ? p : `\u2022 ${p}`))
            .join('\n'),
        },
        {
          label: 'Fitur Utama Website',
          value: doc.scope.featuresList
            .map((f) => (f.trim().startsWith('\u2022') ? f : `\u2022 ${f}`))
            .join('\n'),
        },
        { label: 'Desain UI/UX', value: cleanVal(doc.scope.uiUxDesign) },
        { label: 'Responsivitas', value: cleanVal(doc.scope.responsiveness) },
        { label: 'CMS / Dashboard Admin', value: cleanVal(doc.scope.cmsAdmin) },
        { label: 'Integrasi API Internal', value: cleanVal(doc.scope.apiIntegrations) },
        { label: 'Integrasi Pihak Ketiga', value: cleanVal(doc.scope.thirdPartyIntegrations) },
        {
          label: 'Fitur Artificial Intelligence (AI)',
          value: doc.scope.includeAiFeatures
            ? cleanVal(doc.scope.aiFeaturesDetail)
            : cleanVal(doc.scope.aiFeaturesDetail, 'Tidak termasuk dalam lingkup inti; diatur melalui Change Request jika diperlukan.'),
        },
        { label: 'Deployment & Infrastruktur 1 Pintu', value: cleanVal(doc.scope.deploymentServer) },
        ...(doc.scope.techStackDetail
          ? [{ label: 'Arsitektur Teknis & Tech Stack', value: cleanVal(doc.scope.techStackDetail) }]
          : []),
        ...(doc.scope.securityArchitecture
          ? [{ label: 'Keamanan Aplikasi & Server', value: cleanVal(doc.scope.securityArchitecture) }]
          : []),
        ...(doc.scope.seoGeoPerformance
          ? [{ label: 'SEO, GEO (llms.txt) & Performa', value: cleanVal(doc.scope.seoGeoPerformance) }]
          : []),
        { label: 'Dokumentasi Teknis', value: cleanVal(doc.scope.technicalDocumentation) },
        { label: 'Kebijakan Luar Lingkup', value: cleanVal(doc.scope.outOfScopePolicy) },
      ];

      blocks.push({
        type: 'key-value-table',
        title: 'Rincian Ruang Lingkup Teknis Pekerjaan',
        rows: scopeRows,
        valueAlign: 'justify',
      });
    }

    // Inject itemized cost breakdown, financial summary & DP recognition tables inside Pasal 5
    if (clause.id === 'pasal-5') {
      const taxSummary = calculateTaxSummary(doc.financial);
      const terminSummary = summarizeTermins(doc.financial.termins, doc.financial.totalValue);
      const costSummary = summarizeCostBreakdown(doc.financial.costBreakdown);
      const effectiveTotalValue =
        doc.financial.totalValue > 0 ? doc.financial.totalValue : costSummary.totalAmount;
      const hasNumericContractValue = effectiveTotalValue > 0;

      if (doc.financial.costBreakdown && doc.financial.costBreakdown.length > 0) {
        const costRows = doc.financial.costBreakdown.map((item, index) => {
          const isDiscounted = Boolean(item.originalAmount && item.originalAmount > item.amount);
          const normalDisplay =
            item.originalAmount && item.originalAmount > 0
              ? formatIDR(item.originalAmount)
              : item.amount > 0
                ? formatIDR(item.amount)
                : '-';

          let promoRaw = 'Rp ......................';
          if (item.amount > 0) {
            promoRaw = formatIDR(item.amount);
          } else if (item.note?.toLowerCase().includes('terpisah')) {
            promoRaw = 'Terpisah';
          } else if (
            item.note?.toLowerCase().includes('gratis') ||
            (item.originalAmount && item.originalAmount > 0)
          ) {
            promoRaw = formatIDR(0);
          }

          const savingsPct =
            isDiscounted && item.originalAmount && item.originalAmount > 0
              ? Math.round(((item.originalAmount - item.amount) / item.originalAmount) * 100)
              : 0;
          const promoDisplay =
            isDiscounted && savingsPct > 0
              ? `**${promoRaw}**\n(Hemat ${savingsPct}%)`
              : `**${promoRaw}**`;

          return [
            String(index + 1),
            item.itemName || '-',
            `${item.description || '-'}${item.note ? ` [${item.note}]` : ''}`,
            normalDisplay,
            promoDisplay,
          ];
        });

        const normalSubtotal = doc.financial.costBreakdown.reduce((sum, item) => {
          const normalVal =
            item.originalAmount && item.originalAmount > 0
              ? item.originalAmount
              : item.amount > 0
                ? item.amount
                : 0;
          return sum + normalVal;
        }, 0);
        const grossTotalBiaya =
          normalSubtotal > costSummary.totalAmount ? normalSubtotal : costSummary.totalAmount;
        const potonganBiaya = Math.max(0, grossTotalBiaya - costSummary.totalAmount);
        const costSummaryLines: DataTableSummaryLine[] = [];

        if (doc.financial.taxMode === 'INCLUDE_PPN' && costSummary.totalAmount > 0) {
          const ppnRate = doc.financial.ppnPercentage || 11;
          const taxableBase =
            typeof doc.financial.taxableBaseValue === 'number' && doc.financial.taxableBaseValue >= 0
              ? doc.financial.taxableBaseValue
              : costSummary.taxableAmount > 0
                ? costSummary.taxableAmount
                : costSummary.totalAmount;
          const ppnCalc = Math.round((taxableBase * ppnRate) / 100);
          const computedTotal = costSummary.totalAmount + ppnCalc;
          const finalTotal = doc.financial.totalValue > 0 ? doc.financial.totalValue : computedTotal;
          const ppnDisplay = Math.max(0, finalTotal - costSummary.totalAmount);

          costSummaryLines.push(
            {
              label: 'Total Biaya',
              value: formatIDR(grossTotalBiaya),
              boldValue: true,
            },
            {
              label: 'Potongan',
              value: potonganBiaya > 0 ? `- ${formatIDR(potonganBiaya)}` : formatIDR(0),
            },
            {
              label: 'PPN',
              value: formatIDR(ppnDisplay),
            },
            {
              label: 'Nilai Total',
              value: formatIDR(finalTotal),
              isTotal: true,
              boldValue: true,
            }
          );
        } else {
          costSummaryLines.push(
            {
              label: 'Total Biaya',
              value: hasNumericContractValue ? formatIDR(grossTotalBiaya) : 'Rp ......................',
              boldValue: true,
            },
            {
              label: 'Potongan',
              value: hasNumericContractValue
                ? potonganBiaya > 0
                  ? `- ${formatIDR(potonganBiaya)}`
                  : formatIDR(0)
                : '-',
            },
            {
              label: 'Nilai Total',
              value: hasNumericContractValue ? formatIDR(effectiveTotalValue) : 'Rp ......................',
              isTotal: true,
              boldValue: true,
            }
          );
        }

        blocks.push({
          type: 'data-table',
          title: 'Rincian Biaya Pekerjaan',
          columns: [
            { header: 'No', widthRatio: 0.06, align: 'center' },
            { header: 'Komponen Pekerjaan', widthRatio: 0.24, align: 'left' },
            { header: 'Rincian & Keterangan', widthRatio: 0.36, align: 'left' },
            { header: 'Harga Normal', widthRatio: 0.17, align: 'right' },
            { header: 'Harga Promo', widthRatio: 0.17, align: 'right' },
          ],
          rows: costRows,
          summaryLines: costSummaryLines,
        });
      }

      const taxLabel =
        doc.financial.taxMode === 'INCLUDE_PPN'
          ? doc.financial.taxableBaseValue && doc.financial.taxableBaseValue < costSummary.totalAmount
            ? `Termasuk PPN ${doc.financial.ppnPercentage}% khusus Domain, Hosting & Database/Cloud (${formatIDR(taxSummary.ppnAmount)})`
            : `Termasuk PPN ${doc.financial.ppnPercentage}% (${formatIDR(taxSummary.ppnAmount)})`
          : doc.financial.taxMode === 'NON_PKP'
            ? 'Non-PKP / Tidak dipungut PPN'
            : doc.financial.taxNote;

      const finRows: KeyValueRow[] = [
        {
          label: 'Total Nilai Kontrak',
          value: hasNumericContractValue
            ? `${formatIDR(effectiveTotalValue)} (${terbilangIDR(effectiveTotalValue)})`
            : 'Rp .............................. (Terbilang: ........................................)',
        },
        {
          label: 'DP Telah Dibayarkan Sebelum Perjanjian',
          value:
            doc.financial.downPaymentPaid > 0
              ? `${formatIDR(doc.financial.downPaymentPaid)} (${terbilangIDR(doc.financial.downPaymentPaid)})`
              : 'Rp .............................. (sesuai bukti transfer Uang Muka yang diterima Pihak Kedua sebelum penandatanganan)',
        },
      ];

      if (doc.financial.downPaymentPaid > 0 || doc.financial.downPaymentDate || doc.financial.downPaymentReference) {
        finRows.push(
          {
            label: 'Tanggal Pembayaran DP',
            value: doc.financial.downPaymentDate
              ? formatIndonesianDate(doc.financial.downPaymentDate)
              : '-',
          },
          {
            label: 'Nomor Penawaran / Bukti Transaksi DP',
            value: `${cleanVal(doc.financial.downPaymentInvoiceNumber)} / ${cleanVal(doc.financial.downPaymentReference)} (${doc.financial.downPaymentMethod})`,
          }
        );
      }

      finRows.push(
        {
          label: 'Sisa Pembayaran (Total - DP Diterima)',
          value: hasNumericContractValue
            ? `${formatIDR(taxSummary.remainingPayment)} (${terbilangIDR(taxSummary.remainingPayment)})`
            : 'Rp .............................. (Total Nilai Kontrak dikurangi Total Pembayaran DP Diterima)',
        },
        {
          label: 'Metode & Rekening Pembayaran Resmi',
          value: cleanVal(
            doc.financial.downPaymentMethod,
            'Transfer Bank SeaBank — No. Rekening 901387277710 a.n. Mela Melati Aprilia (Finance AlinLabs Indonesia)'
          ),
        },
        { label: 'Ketentuan Pajak', value: taxLabel },
        { label: 'Biaya Tambahan / Pihak Ketiga', value: cleanVal(doc.financial.additionalCostsNote) }
      );

      blocks.push({
        type: 'key-value-table',
        title: 'Ringkasan Nilai Kontrak & Pengakuan Pembayaran Sebelumnya',
        rows: finRows,
      });

      if (doc.financial.termins.length > 0) {
        blocks.push({
          type: 'data-table',
          title: `Jadwal Termin Pembayaran (Total Skema: ${terminSummary.totalPercentage}%)`,
          columns: [
            { header: 'No', widthRatio: 0.06, align: 'center' },
            { header: 'Deskripsi Termin', widthRatio: 0.30, align: 'left' },
            { header: 'Persen', widthRatio: 0.09, align: 'right' },
            { header: 'Nominal (IDR)', widthRatio: 0.19, align: 'right' },
            { header: 'Trigger & Jatuh Tempo', widthRatio: 0.22, align: 'left' },
            { header: 'Status', widthRatio: 0.14, align: 'center' },
          ],
          rows: doc.financial.termins.map((t, index) => [
            String(index + 1),
            t.description || '-',
            `${t.percentage}%`,
            hasNumericContractValue ? formatIDR(t.amount) : `${t.percentage}% Nilai`,
            `${t.trigger || '-'}${t.dueDate ? ` (JT: ${formatIndonesianDate(t.dueDate)})` : ''}`,
            t.status === 'PAID' ? 'TERBAYAR' : 'MENUNGGU',
          ]),
        });
      }
    }

    // Inject Project Timeline & Milestone table inside Pasal 6
    if (clause.id === 'pasal-6') {
      const startText = doc.project.startDate
        ? formatIndonesianDate(doc.project.startDate)
        : 'Terhitung sejak tanggal terbit kontrak';
      const endText = doc.project.targetEndDate
        ? formatIndonesianDate(doc.project.targetEndDate)
        : `${doc.project.estimatedDurationDays || 11} hari kalender (maks. 3 hari pengerjaan, maks. 5 hari user test/revisi, 3 hari perbaikan & deploy/publish)`;

      blocks.push({
        type: 'key-value-table',
        title: 'Jadwal Induk Pelaksanaan Proyek',
        rows: [
          { label: 'Tanggal Mulai Proyek', value: startText },
          { label: 'Target Penyelesaian Proyek', value: endText },
          {
            label: 'Estimasi Durasi Kerja',
            value: `${doc.project.estimatedDurationDays || 11} hari kalender`,
          },
          {
            label: 'Batas Waktu User Test & Revisi Klien',
            value: `Maksimal ${doc.project.clientFeedbackMaxDays || 5} hari kalender masa percobaan`,
          },
        ],
      });

      if (doc.project.milestones.length > 0) {
        blocks.push({
          type: 'data-table',
          title: 'Tahapan dan Milestone Pelaksanaan',
          columns: [
            { header: 'Tahap', widthRatio: 0.28, align: 'left' },
            { header: 'Keluaran (Deliverable)', widthRatio: 0.46, align: 'left' },
            { header: 'Durasi', widthRatio: 0.12, align: 'right' },
            { header: 'Target', widthRatio: 0.14, align: 'center' },
          ],
          rows: doc.project.milestones.map((m) => [
            m.phase || '-',
            m.deliverable || '-',
            m.durationDays > 0 ? `${m.durationDays} hari` : '-',
            m.targetDate ? formatIndonesianDate(m.targetDate) : 'Sesuai Tahap',
          ]),
        });
      }
    }
  }

  // Lampiran I & II (SLA Garansi & Standar Serah Terima BAST)
  blocks.push({
    type: 'section-label',
    anchorId: 'lampiran',
    align: 'center',
    text: 'LAMPIRAN I — MATRIKS SLA PENANGANAN BUG MASA GARANSI',
  });
  blocks.push({
    type: 'data-table',
    columns: [
      { header: 'Tingkat Keparahan', widthRatio: 0.23, align: 'left' },
      { header: 'Definisi Gangguan', widthRatio: 0.41, align: 'left' },
      { header: 'Respon Awal', widthRatio: 0.18, align: 'left' },
      { header: 'Target Perbaikan', widthRatio: 0.18, align: 'left' },
    ],
    rows: WARRANTY_SLA_MATRIX.map((row) => [
      row.severity,
      row.definition,
      row.responseSla,
      row.targetResolution,
    ]),
  });

  blocks.push({
    type: 'section-label',
    align: 'center',
    text: 'LAMPIRAN II — DAFTAR PERIKSA SERAH TERIMA TEKNIS (BAST)',
  });
  blocks.push({
    type: 'data-table',
    columns: [
      { header: 'No', widthRatio: 0.07, align: 'center' },
      { header: 'Komponen Deliverables', widthRatio: 0.31, align: 'left' },
      { header: 'Kriteria Verifikasi Serah Terima', widthRatio: 0.62, align: 'left' },
    ],
    rows: HANDOVER_CHECKLIST_ITEMS,
  });

  // Closing & Signature Block
  blocks.push({
    type: 'paragraph',
    align: 'justify',
    text: 'Demikian Surat Perjanjian Kerja Sama beserta seluruh Lampirannya ini dibuat dan disepakati oleh Para Pihak dalam keadaan sadar, cakap hukum, dan tanpa adanya paksaan dari pihak mana pun, untuk dilaksanakan dengan penuh itikad baik.',
    spaceAfter: 10,
  });

  const signer1Name = cleanVal(doc.signatures.firstParty.signerName || doc.firstParty.directorName);
  const signer1Title = cleanVal(doc.signatures.firstParty.signerTitle || doc.firstParty.directorTitle);
  const signer2Name = cleanVal(doc.signatures.secondParty.signerName || doc.secondParty.directorName);
  const signer2Title = cleanVal(doc.signatures.secondParty.signerTitle || doc.secondParty.directorTitle);

  const hasCertifiedParty =
    doc.signatures.firstParty.certifiedStatus === 'CERTIFIED_PSRE' ||
    doc.signatures.secondParty.certifiedStatus === 'CERTIFIED_PSRE';
  const psreModeLabel =
    doc.signatures.psre.mode === 'PSRE_CERTIFIED' || hasCertifiedParty
      ? `Tanda Tangan Elektronik Tersertifikasi (${doc.signatures.psre.providerDisplayName || 'PSrE Komdigi'})`
      : 'Tanda Tangan Elektronik Sederhana (Belum Tersertifikasi PSrE)';

  blocks.push({
    type: 'signature-block',
    anchorId: 'signing',
    city,
    dateText: dateFormatted,
    firstPartyCompany: doc.firstParty.legalName,
    firstPartySignerName: signer1Name,
    firstPartySignerTitle: signer1Title,
    firstPartySignedAt: doc.signatures.firstParty.signed
      ? formatDateTimeID(doc.signatures.firstParty.signedAt)
      : 'Menunggu penandatanganan',
    firstPartySignatureUrl: doc.signatures.firstParty.signed
      ? doc.signatures.firstParty.signatureImageDataUrl
      : '',
    firstPartyCertStatus:
      doc.signatures.firstParty.certifiedStatus === 'CERTIFIED_PSRE'
        ? 'Tersertifikasi PSrE'
        : doc.signatures.firstParty.signed
          ? 'TTE Sederhana (Belum Tersertifikasi PSrE)'
          : 'Belum ditandatangani',
    firstPartyHash: doc.signatures.firstParty.documentHashAtSigning
      ? doc.signatures.firstParty.documentHashAtSigning.slice(0, 16)
      : '',
    secondPartyCompany: doc.secondParty.legalName || 'AlinLabs Indonesia',
    secondPartyCommercial: doc.secondParty.commercialName || 'AlinLabs Indonesia',
    secondPartySignerName: signer2Name,
    secondPartySignerTitle: signer2Title,
    secondPartySignedAt: doc.signatures.secondParty.signed
      ? formatDateTimeID(doc.signatures.secondParty.signedAt)
      : dateFormatted,
    secondPartySignatureUrl: doc.signatures.secondParty.signed
      ? doc.signatures.secondParty.signatureImageDataUrl
      : '',
    secondPartyCertStatus:
      doc.signatures.secondParty.certifiedStatus === 'CERTIFIED_PSRE'
        ? 'Tersertifikasi PSrE'
        : doc.signatures.secondParty.signed
          ? 'TTE Sederhana (Belum Tersertifikasi PSrE)'
          : 'Tertanda Resmi AlinLabs Indonesia (Cap & TTD)',
    secondPartyHash: doc.signatures.secondParty.documentHashAtSigning
      ? doc.signatures.secondParty.documentHashAtSigning.slice(0, 16)
      : '',
    psreModeLabel,
  });

  return {
    contractNumber,
    version: doc.version,
    statusLabel: statusLabels[doc.status],
    headerTitle: 'SURAT PERJANJIAN KERJA SAMA — SHANSUS DZAR INDONESIA × ALINLABS INDONESIA',
    documentHashShort: doc.lockedHash ? doc.lockedHash.slice(0, 12) : 'FINAL',
    blocks,
  };
}
