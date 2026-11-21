import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  calculateRemainingPayment,
  calculateTaxSummary,
  formatIDR,
  summarizeCostBreakdown,
  summarizeTermins,
  terbilangIDR,
} from './currency';
import {
  deriveClientInitials,
  formatContractNumber,
  formatIndonesianDate,
  toRomanMonth,
} from './date';
import { createInitialContractDocument } from '../data/contractTemplate';
import { DOCUMENT_TOC_ITEMS } from '../data/contract/index';
import { computeDocumentHash } from './documentHash';
import { boldColonLeadIn, buildLegalDocumentModel } from '../services/documentModel';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  CONTRACT_CONTENT_WIDTH_PT,
  CONTRACT_MARGIN_BOTTOM_PT,
  CONTRACT_MARGIN_LEFT_PT,
  CONTRACT_MARGIN_RIGHT_PT,
  CONTRACT_MARGIN_TOP_PT,
  generateContractPdfBytes,
  sanitizeWinAnsi,
  wrapStyledTextWords,
} from '../services/pdfEngine';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import {
  PDF_ASSET_PATHS,
  clearPdfAssetCache,
  registerPdfPngAssetCache,
} from '../services/pdfAssetLoader';
import { splitEnglishSegments, tokenizeLineIntoStyledWords } from './englishTerms';
import {
  addDaysIso,
  buildDefaultInvoiceFromContract,
  computeInvoiceSummary,
  formatInvoiceNumber,
} from './invoiceLogic';
import { createInitialInvoiceDocument } from '../data/invoiceTemplate';
import { generateInvoicePdfBytes, INVOICE_TOC_ITEMS } from '../services/invoicePdfEngine';
import { buildPrintableHtmlDocument, createPdfBlob, openPdfBlobInNewTab } from './pdfPrint';
import { applyLocalFirstPartySignature } from '../services/documentService';

test('DP and remaining payment calculations are exact', () => {
  assert.equal(calculateRemainingPayment(45_000_000, 15_000_000), 30_000_000);
  assert.equal(calculateRemainingPayment(45_000_000, 50_000_000), 0);
  assert.equal(calculateRemainingPayment(0, 0), 0);

  const taxSummary = calculateTaxSummary({
    totalValue: 111_000_000,
    downPaymentPaid: 33_300_000,
    downPaymentDate: '2026-11-01',
    downPaymentInvoiceNumber: 'INV-001',
    downPaymentReference: 'TRF-123',
    downPaymentMethod: 'Transfer Bank',
    taxMode: 'INCLUDE_PPN',
    ppnPercentage: 11,
    taxNote: '',
    additionalCostsNote: '',
    termins: [],
  });
  assert.equal(taxSummary.baseValue, 100_000_000);
  assert.equal(taxSummary.ppnAmount, 11_000_000);
  assert.equal(taxSummary.remainingPayment, 77_700_000);
});

test('Termin summary validates percentage and amount consistency', () => {
  const consistent = summarizeTermins(
    [
      {
        id: 't1',
        description: 'DP',
        percentage: 40,
        amount: 20_000_000,
        trigger: 'Prior DP',
        dueDate: '',
        isPriorDp: true,
        status: 'PAID',
      },
      {
        id: 't2',
        description: 'Pelunasan',
        percentage: 60,
        amount: 30_000_000,
        trigger: 'BAST',
        dueDate: '',
        isPriorDp: false,
        status: 'PENDING',
      },
    ],
    50_000_000
  );
  assert.equal(consistent.isPercentageValid, true);
  assert.equal(consistent.isAmountConsistent, true);

  const inconsistent = summarizeTermins(
    [
      {
        id: 't1',
        description: 'DP',
        percentage: 30,
        amount: 15_000_000,
        trigger: 'Prior DP',
        dueDate: '',
        isPriorDp: true,
        status: 'PAID',
      },
    ],
    50_000_000
  );
  assert.equal(inconsistent.isPercentageValid, false);
  assert.equal(inconsistent.isAmountConsistent, false);
});

test('Indonesian currency, terbilang, date, and contract numbering format correctly', () => {
  assert.match(formatIDR(25000000), /25\.000\.000/);
  assert.equal(terbilangIDR(45000000), 'Empat Puluh Lima Juta Rupiah');
  assert.equal(toRomanMonth(10), 'XI');
  assert.equal(formatIndonesianDate('2026-11-19'), '19 November 2026');
  const defaultClientCode = deriveClientInitials('Shansus Dzar Indonesia');
  assert.equal(defaultClientCode, 'SDI');
  assert.equal(
    formatContractNumber(
      {
        prefix: 'ALINLABS/AGR',
        clientCode: defaultClientCode,
        sequenceNumber: 48,
        useRomanMonth: true,
        year: 2026,
        autoFormat: true,
      },
      '2026-11-19'
    ),
    'ALINLABS/SDI/AGR/3-048/XI/2026'
  );
  assert.equal(deriveClientInitials('Karya Maju Jaya'), 'KMJ');
});

test('Modular TypeScript contract initializes in FINAL_LOCKED state with formal legal identities', () => {
  const doc = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  assert.equal(doc.status, 'FINAL_LOCKED');
  assert.equal(doc.firstParty.legalName, 'Shansus Dzar Indonesia');
  assert.equal(doc.firstParty.directorName, 'H. M. Hilman Aziz Napis, S.E');
  assert.equal(doc.firstParty.directorTitle, 'Pemilik Usaha Shansus Dzar Indonesia');
  assert.equal(doc.firstParty.phone, '085314205258');
  assert.equal(doc.firstParty.email, 'shansusdzardigital.id@gmail.com');
  assert.ok(doc.firstParty.address.includes('Kab. Purwakarta, Jawa Barat 41162'));
  assert.equal(doc.secondParty.legalName, 'AlinLabs Indonesia');
  assert.equal(doc.secondParty.commercialName, 'AlinLabs Indonesia');
  assert.equal(doc.secondParty.directorName, 'Alvareza Hilka Pratama, S.M.');
  assert.equal(doc.secondParty.directorTitle, 'Pemilik Usaha AlinLabs Indonesia');
  assert.equal(doc.secondParty.phone, '085797184059');
  assert.equal(doc.secondParty.email, 'office.alincorporation@gmail.com');
  assert.ok(doc.secondParty.address.includes('Kab. Purwakarta, Jawa Barat 41117'));
  assert.ok(doc.clauses.length === 16);
  assert.ok((doc.financial.costBreakdown?.length ?? 0) >= 4);
});

test('Cost breakdown summary totals itemized component fees accurately', () => {
  const summary = summarizeCostBreakdown([
    { id: 'c1', itemName: 'UI/UX', description: 'Desain', amount: 10_000_000 },
    { id: 'c2', itemName: 'Dev', description: 'Frontend/Backend', amount: 25_000_000 },
  ]);
  assert.equal(summary.totalAmount, 35_000_000);
  assert.equal(summary.hasItemizedAmounts, true);

  const zeroSummary = summarizeCostBreakdown([
    { id: 'c1', itemName: 'UI/UX', description: 'Desain', amount: 0 },
  ]);
  assert.equal(zeroSummary.totalAmount, 0);
  assert.equal(zeroSummary.hasItemizedAmounts, false);
});

test('Document hash detects substantive contract edits', async () => {
  const doc = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const h1 = await computeDocumentHash(doc);
  const edited = {
    ...doc,
    financial: { ...doc.financial, totalValue: 45_000_000 },
  };
  const h2 = await computeDocumentHash(edited);
  assert.notEqual(h1, h2);
  assert.equal(h1.length, 64);
});

test('DocumentModel and Vector PDF Engine generate multi-page A4 PDF with 16 articles, appendices, and TOC anchors', async () => {
  const doc = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  doc.agreement.signingCity = 'Jakarta';
  doc.financial.totalValue = 50_000_000;
  doc.financial.downPaymentPaid = 15_000_000;
  doc.financial.downPaymentDate = '2026-11-10';
  doc.financial.downPaymentReference = 'TRF-BCA-9981';

  const model = buildLegalDocumentModel(doc);
  const articleHeadings = model.blocks.filter((b) => b.type === 'article-heading');
  assert.equal(articleHeadings.length, 16);
  assert.ok(!JSON.stringify(model.blocks).includes('NEEDS REVIEW'));

  const sectionLabels = model.blocks.filter((b) => b.type === 'section-label');
  const firstPartyLabel = sectionLabels.find((b) => b.text.includes('1. PIHAK PERTAMA'));
  const secondPartyLabel = sectionLabels.find((b) => b.text.includes('2. PIHAK KEDUA'));
  const lampiran1Label = sectionLabels.find((b) => b.text.includes('LAMPIRAN I'));
  const lampiran2Label = sectionLabels.find((b) => b.text.includes('LAMPIRAN II'));
  assert.equal(firstPartyLabel?.align ?? 'left', 'left');
  assert.equal(secondPartyLabel?.align ?? 'left', 'left');
  assert.equal(lampiran1Label?.align, 'center');
  assert.equal(lampiran2Label?.align, 'center');

  const sanitized = sanitizeWinAnsi('Test >= 10 -- "Alin Labs"');
  assert.equal(sanitized, 'Test >= 10 -- "Alin Labs"');

  const { pdfBytes, pageCount, anchorPages } = await generateContractPdfBytes(doc);
  assert.ok(pdfBytes.length > 5000);
  assert.ok(pageCount >= 6);

  // Verify every TOC anchor resolves to a valid page within [1, pageCount]
  for (const item of DOCUMENT_TOC_ITEMS) {
    const p = anchorPages[item.id];
    assert.ok(typeof p === 'number' && p >= 1 && p <= pageCount, `Missing anchor page for ${item.id}`);
  }
  assert.ok(anchorPages['lampiran'] >= anchorPages['pasal-16']);
  assert.ok(anchorPages['signing'] >= anchorPages['pasal-16']);

  const firstPartyTable = model.blocks.find((b) => b.type === 'key-value-table');
  const keyValueTables = model.blocks.filter((b) => b.type === 'key-value-table');
  assert.ok(firstPartyTable && keyValueTables.length >= 2);
  for (const tbl of keyValueTables.slice(0, 2)) {
    assert.ok(!tbl.rows.some((r) => r.label.includes('NIB') || r.label.includes('NPWP')));
  }

  const costTable = model.blocks.find(
    (b) => b.type === 'data-table' && b.title === 'Rincian Biaya Pekerjaan'
  );
  assert.ok(costTable && costTable.type === 'data-table' && costTable.rows.length >= 5);
  assert.ok(!JSON.stringify(model.blocks).includes('financialTerms.ts'));

  // Inspect generated PDF dimensions via pdf-lib
  const parsed = await PDFDocument.load(pdfBytes);
  assert.equal(parsed.getPageCount(), pageCount);
  const firstPage = parsed.getPage(0);
  const { width, height } = firstPage.getSize();
  assert.ok(Math.abs(width - A4_WIDTH_PT) < 0.5);
  assert.ok(Math.abs(height - A4_HEIGHT_PT) < 0.5);

  // Verify contract typography: 11pt clause/body description text, distinct article headings, <=10pt table cells
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadedContract = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const p2 = await loadedContract.getPage(2);
  const p2Items = (await p2.getTextContent()).items.filter(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && 'transform' in it && it.str.trim().length > 0
  );
  const openingClause = p2Items.find((it) => it.str.includes('disepakati'));
  const tableCellP2 = p2Items.find((it) => it.str.includes('Badan Usaha'));
  assert.ok(openingClause && tableCellP2);
  assert.equal(Number(openingClause.transform[0].toFixed(1)), 11, 'Contract description text should be 11pt');
  assert.ok(tableCellP2.transform[0] <= 10, `Key-value table text should be <= 10pt (got ${tableCellP2.transform[0]})`);

  const pasal1Page = await loadedContract.getPage(anchorPages['pasal-1']);
  const p1Items = (await pasal1Page.getTextContent()).items.filter(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && 'transform' in it && it.str.trim().length > 0
  );
  const pasal1Heading = p1Items.find((it) => it.str.trim() === 'PASAL 1' || it.str.trim() === 'PASAL');
  const pasal1Title = p1Items.find((it) => it.str.includes('DEFINISI'));
  const pasal1Body = p1Items.find((it) => it.str.includes('Website') || it.str.includes('Perjanjian'));
  assert.ok(pasal1Heading && pasal1Title && pasal1Body);
  assert.equal(Number(pasal1Heading.transform[0].toFixed(1)), 11, 'PASAL heading should be 11pt');
  assert.equal(Number(pasal1Title.transform[0].toFixed(1)), 11, 'PASAL title should be 11pt');

  const p5Page = await loadedContract.getPage(anchorPages['pasal-5']);
  const p5Items = (await p5Page.getTextContent()).items.filter(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && 'transform' in it && it.str.trim().length > 0
  );
  const dataCell = p5Items.find((it) => it.str.includes('Beranda'));
  if (dataCell) {
    assert.ok(dataCell.transform[0] <= 10, `Data table text should be <= 10pt (got ${dataCell.transform[0]})`);
  }
  await loadedContract.cleanup();
});

test('English/foreign terms are tokenized as italic while Indonesian text and entity names remain upright', () => {
  const segs = splitEnglishSegments(
    'AlinLabs Indonesia mengembangkan Website, User Acceptance Testing (UAT), dan source code.'
  );
  const italicTexts = segs.filter((s) => s.italic).map((s) => s.text);
  const uprightTexts = segs.filter((s) => !s.italic).map((s) => s.text).join('');

  assert.deepEqual(italicTexts, ['Website', 'User Acceptance Testing', 'source code']);
  assert.ok(uprightTexts.includes('AlinLabs Indonesia'));
  assert.ok(uprightTexts.includes('mengembangkan'));

  const words = tokenizeLineIntoStyledWords('Pembayaran (Down Payment) melalui invoice.');
  assert.equal(words.length, 5);
  // "(Down" has upright "(" followed by italic "Down"
  assert.deepEqual(words[1], [
    { text: '(', italic: false },
    { text: 'Down', italic: true },
  ]);
  // "Payment)" has italic "Payment" followed by upright ")"
  assert.deepEqual(words[2], [
    { text: 'Payment', italic: true },
    { text: ')', italic: false },
  ]);
  // "invoice." has italic "invoice" followed by upright "."
  assert.deepEqual(words[4], [
    { text: 'invoice', italic: true },
    { text: '.', italic: false },
  ]);

  const extra = splitEnglishSegments('Layanan Interior/Building, Severity P1, dan lisensi font/plugin.');
  assert.deepEqual(
    extra.filter((s) => s.italic).map((s) => s.text),
    ['Building', 'Severity', 'font', 'plugin']
  );

  const upperHeading = splitEnglishSegments('JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE');
  assert.deepEqual(upperHeading, [
    { text: 'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE', italic: false },
  ]);

  const coverBoxWords = tokenizeLineIntoStyledWords(
    'Pembuatan dan Pengembangan Website Resmi Shansus Dzar Indonesia',
    false,
    false
  );
  assert.ok(coverBoxWords.every((word) => word.every((span) => !span.italic)));
});

test('Contract itemized cost breakdown, Admin Keuangan (Rp 400k), 1-year domain lifecycle, data ownership commitment, and selective PPN 11% match Rp 1.855.000', async () => {
  const contract = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const dppSummary = summarizeCostBreakdown(contract.financial.costBreakdown);
  assert.equal(dppSummary.totalAmount, 1_800_000);
  assert.equal(dppSummary.taxableAmount, 500_000);
  assert.equal(contract.financial.taxMode, 'INCLUDE_PPN');
  assert.equal(contract.financial.ppnPercentage, 11);
  assert.equal(contract.financial.taxableBaseValue, 500_000);
  assert.equal(contract.financial.totalValue, 1_855_000);

  const taxSummary = calculateTaxSummary(contract.financial);
  assert.equal(taxSummary.baseValue, 1_800_000);
  assert.equal(taxSummary.ppnAmount, 55_000);
  assert.equal(taxSummary.grandTotal, 1_855_000);

  const terminCheck = summarizeTermins(contract.financial.termins, contract.financial.totalValue);
  assert.equal(terminCheck.isPercentageValid, true);
  assert.equal(terminCheck.isAmountConsistent, true);
  assert.equal(contract.financial.termins.length, 2);
  assert.equal(contract.financial.termins[0].amount, 700_000);
  assert.equal(contract.financial.termins[1].amount, 1_155_000);

  // Schedule: maks 3 hari pengerjaan + maks 5 hari user test/revisi + 3 hari perbaikan & deploy = 11 hari
  assert.equal(contract.project.estimatedDurationDays, 11);
  assert.equal(contract.project.clientFeedbackMaxDays, 5);
  assert.deepEqual(
    contract.project.milestones.map((m) => m.durationDays),
    [3, 5, 3]
  );

  // Real technical architecture, 1-pintu Alinlabs infrastructure, 1-year domain lifecycle, data ownership commitment, & Admin Keuangan
  assert.equal(contract.legalSettings.sourceCodeHandover, false);
  const builtModel = buildLegalDocumentModel(contract);
  const modelText = JSON.stringify(builtModel.blocks);
  assert.ok(modelText.includes('garansi selamanya'));
  assert.ok(modelText.includes('Rp 50.000'));
  assert.ok(modelText.includes('Rp 150.000'));
  assert.ok(modelText.includes('Rp 100.000'));
  assert.ok(modelText.includes('dilarang keras untuk mengedit, mengubah, memodifikasi'));
  assert.ok(modelText.includes('pemblokiran sementara situs'));
  assert.ok(modelText.includes('maksimal 7 (tujuh) hari kalender'));
  assert.ok(modelText.includes('AlinLabs Indonesia'));
  assert.ok(!modelText.includes('PT Shansus Dzar Indonesia'));
  assert.ok(!modelText.includes('PT SHANSUS DZAR INDONESIA'));
  assert.ok(!modelText.includes('ARTIFICIAL INTELLIGENCE LABORATORIUM INDONESIA'));
  assert.ok(modelText.includes('shansusdzar.com'));
  assert.ok(modelText.includes('Alinlabs Server'));
  assert.ok(modelText.includes('https://shansusdzar.vercel.app'));
  assert.ok(modelText.includes('Drizzle ORM'));
  assert.ok(modelText.includes('Google Analytics 4'));
  assert.ok(modelText.includes('/llms.txt'));
  assert.ok(modelText.includes('React 19 (19.0.1)'));
  assert.ok(!modelText.includes('(^'));
  assert.ok(modelText.includes('Halaman Admin Keuangan'));
  assert.ok(modelText.includes('Halaman Pengaturan'));
  assert.ok(modelText.includes('Halaman Hak Akses'));
  assert.ok(modelText.includes('SeaBank'));
  assert.ok(modelText.includes('901387277710'));
  assert.ok(modelText.includes('Mela Melati Aprilia'));
  assert.ok(modelText.includes('Finance AlinLabs Indonesia'));
  assert.ok(modelText.includes('masa aktif 1 (satu) tahun'));
  assert.ok(modelText.includes('reaktivasi'));
  assert.ok(modelText.includes('kurs mata uang'));
  assert.ok(modelText.includes('hak milik mutlak'));
  assert.ok(modelText.includes('Shansus Dzar Indonesia'));
  assert.ok(modelText.includes('backup server'));
  assert.ok(modelText.includes('Rp 150.000 - Rp 250.000') || modelText.includes('Rp 250.000'));
  assert.ok(modelText.includes('project backup & refresh'));
  assert.ok(modelText.includes('KECURANGAN PIHAK PERTAMA'));
  assert.ok(modelText.includes('denda kontraktual'));
  assert.ok(modelText.includes('Pasal 1365 KUHPerdata'));
  assert.ok(modelText.includes('Pasal 378 KUHP'));

  const scopeKvTable = builtModel.blocks.find(
    (b) =>
      b.type === 'key-value-table' &&
      b.rows.some((r) => r.label === 'Arsitektur Teknis & Tech Stack')
  );
  assert.ok(scopeKvTable && scopeKvTable.type === 'key-value-table');
  assert.ok(scopeKvTable.rows.some((r) => r.label === 'Keamanan Aplikasi & Server'));
  assert.ok(scopeKvTable.rows.some((r) => r.label === 'SEO, GEO (llms.txt) & Performa'));

  const costTable = builtModel.blocks.find(
    (b) => b.type === 'data-table' && b.title === 'Rincian Biaya Pekerjaan'
  );
  assert.ok(costTable && costTable.type === 'data-table');
  assert.equal(costTable.columns.length, 5);
  assert.equal(costTable.columns[3].header, 'Harga Normal');
  assert.equal(costTable.columns[4].header, 'Harga Promo');
  assert.equal(costTable.rows.length, 13, 'Summary rows must be rendered outside the bordered cost table');
  assert.ok(!JSON.stringify(costTable.rows).includes('~~'));
  assert.equal(costTable.rows[0][3], formatIDR(119_000));
  assert.equal(costTable.rows[0][4], `**${formatIDR(100_000)}**\n(Hemat 16%)`);
  assert.equal(costTable.rows[6][1], 'Halaman Admin : Keuangan');
  assert.equal(costTable.rows[6][3], formatIDR(549_000));
  assert.equal(costTable.rows[6][4], `**${formatIDR(400_000)}**\n(Hemat 27%)`);
  assert.equal(costTable.rows[7][1], 'Halaman : Pengaturan');
  assert.equal(costTable.rows[7][3], formatIDR(99_000));
  assert.equal(costTable.rows[7][4], `**${formatIDR(0)}**\n(Hemat 100%)`);
  assert.equal(costTable.rows[8][1], 'Halaman Admin : Hak Akses');
  assert.equal(costTable.rows[8][3], formatIDR(149_000));
  assert.equal(costTable.rows[8][4], `**${formatIDR(0)}**\n(Hemat 100%)`);
  assert.equal(costTable.rows[11][3], formatIDR(285_000));
  assert.equal(costTable.rows[11][4], `**${formatIDR(250_000)}**\n(Hemat 12%)`);
  assert.equal(costTable.rows[12][1], 'Setup Search Console, GA4 & GEO');
  assert.equal(costTable.rows[12][3], formatIDR(99_000));
  assert.equal(costTable.rows[12][4], `**${formatIDR(0)}**\n(Hemat 100%)`);

  assert.ok(costTable.summaryLines && costTable.summaryLines.length === 4);
  assert.deepEqual(
    costTable.summaryLines.map((l) => [l.label, l.value, Boolean(l.isTotal)]),
    [
      ['Total Biaya', formatIDR(2_501_000), false],
      ['Potongan', `- ${formatIDR(701_000)}`, false],
      ['PPN', formatIDR(55_000), false],
      ['Nilai Total', formatIDR(1_855_000), true],
    ]
  );

  const strikeWords = tokenizeLineIntoStyledWords('~~Rp 50.000~~ Rp 0');
  assert.equal(strikeWords.length, 4);
  assert.equal(strikeWords[0][0]?.strike, true);
  assert.equal(strikeWords[1][0]?.strike, true);
  assert.equal(strikeWords[2][0]?.strike, undefined);

  const testPdf = await PDFDocument.create();
  const rFont = await testPdf.embedFont(StandardFonts.TimesRoman);
  const iFont = await testPdf.embedFont(StandardFonts.TimesRomanItalic);
  const wrapped = wrapStyledTextWords('~~Rp 119.000~~\nRp 100.000', rFont, iFont, 9, 96);
  assert.equal(wrapped.lines.length, 2);
  assert.equal(wrapped.lines[0][0][0]?.strike, true);
  assert.equal(wrapped.lines[1][0][0]?.strike, undefined);
});

test('Quotation logic builds from contract, computes selective PPN 11% + termin percentages/deductions, and formats numbering', () => {
  assert.equal(
    formatInvoiceNumber(127, '2026-11-19', 'Shansus Dzar Indonesia'),
    'ALINLABS/SDI/QUO/3-127/XI/2026'
  );
  assert.equal(addDaysIso('2026-11-19', 7), '2026-11-26');

  const contract = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const invoice = buildDefaultInvoiceFromContract(contract);
  assert.equal(invoice.issuer.directorName, 'Alvareza Hilka Pratama, S.M.');
  assert.equal(invoice.recipient.directorName, 'H. M. Hilman Aziz Napis, S.E');
  assert.equal(invoice.percentage, 37.74);
  assert.equal(invoice.ppnPercentage, 11);

  // Default quotation uses itemized breakdown (1.800.000) + selective infra PPN 11% on 500.000 (55.000) = 1.855.000
  // Termin I (DP) = exact Rp 700.000
  const defaultSummary = computeInvoiceSummary(invoice);
  assert.equal(defaultSummary.dppSubtotal, 1_800_000);
  assert.equal(defaultSummary.taxableSubtotal, 500_000);
  assert.equal(defaultSummary.ppnAmount, 55_000);
  assert.equal(defaultSummary.contractSubtotal, 1_855_000);
  assert.equal(defaultSummary.grossBillAmount, 700_000);
  assert.equal(defaultSummary.netPayableAmount, 700_000);

  // Pembayaran II (Pelunasan sisa setelah tester sebelum deploy, termasuk PPN 11%) = exact Rp 1.155.000
  const t2Inv = buildDefaultInvoiceFromContract(contract, {
    billingConfig: {
      sequenceNumber: 2,
      terminMode: 'TERMIN_2_PELUNASAN',
      paymentTermsDays: 7,
      issueDateOverride: '2026-11-22',
      dueDateOverride: '',
      cityOverride: 'Purwakarta',
      statusOverride: 'AUTO',
      customTotalOverride: 0,
      priorPaymentDeducted: 0,
    },
  });
  assert.equal(computeInvoiceSummary(t2Inv).netPayableAmount, 1_155_000);

  // Override total value explicitly (falls back cleanly to percentage calculation)
  invoice.customTotalOverride = 45_000_000;
  invoice.percentage = 50;
  const dpSummary = computeInvoiceSummary(invoice);
  assert.equal(dpSummary.hasNumericAmount, true);
  assert.equal(dpSummary.contractSubtotal, 45_000_000);
  assert.equal(dpSummary.grossBillAmount, 22_500_000);
  assert.equal(dpSummary.netPayableAmount, 22_500_000);

  // Termin II 25% with prior deduction
  invoice.percentage = 25;
  invoice.priorPaymentDeducted = 1_250_000;
  const t2Summary = computeInvoiceSummary(invoice);
  assert.equal(t2Summary.grossBillAmount, 11_250_000);
  assert.equal(t2Summary.netPayableAmount, 10_000_000);
});

test('Quotation Vector PDF Engine produces valid A4 PDF with all anchor sections', async () => {
  const contract = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const invoice = buildDefaultInvoiceFromContract(contract);
  invoice.bankInfo = {
    bankName: 'Bank BCA',
    accountNumber: '1234567890',
    accountHolder: 'Alvareza Hilka Pratama, S.M.',
  };

  const { pdfBytes, pageCount, anchorPages } = await generateInvoicePdfBytes(invoice);
  assert.ok(pdfBytes.length > 3000);
  assert.ok(pageCount >= 1);

  for (const item of INVOICE_TOC_ITEMS) {
    const p = anchorPages[item.id];
    assert.ok(typeof p === 'number' && p >= 1 && p <= pageCount, `Missing quotation anchor for ${item.id}`);
  }
  assert.ok(anchorPages['inv-addons'] > anchorPages['inv-auth']);

  const parsed = await PDFDocument.load(pdfBytes);
  assert.equal(parsed.getPageCount(), pageCount);
  assert.match(parsed.getTitle() ?? '', /Penawaran Resmi \(Quotation\)/);
  const { width, height } = parsed.getPage(0).getSize();
  assert.ok(Math.abs(width - A4_WIDTH_PT) < 0.5);
  assert.ok(Math.abs(height - A4_HEIGHT_PT) < 0.5);

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadedInv = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const invP1 = await loadedInv.getPage(1);
  const invTc = await invP1.getTextContent();
  const invItems = invTc.items.filter(
    (it): it is { str: string; transform: number[]; fontName: string } & typeof it =>
      'str' in it && 'transform' in it && 'fontName' in it
  );
  const qTitle1 = invItems.find((it) => it.str.trim() === 'SURAT PENAWARAN');
  const qTitle2 = invItems.find((it) => it.str.trim() === 'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE');
  const qNomor = invItems.find((it) => it.str.includes('Nomor:'));
  assert.ok(qTitle1 && qTitle2 && qNomor, 'Quotation should render both 14pt headings and Nomor line');
  assert.equal(Math.round(qTitle1.transform[0]), 14);
  assert.equal(Math.round(qTitle2.transform[0]), 14);
  assert.equal(Math.round(qNomor.transform[0]), 8);
  assert.notEqual(qNomor.fontName, qTitle1.fontName, 'Quotation Nomor line should not be bold');

  // Verify no 'MASA BERLAKU' kicker above Rincian Penawaran and no 'KETENTUAN PEMBAYARAN 2 TAHAP' kicker
  const allPagesText: Array<{ page: number; items: Array<{ str: string; transform: number[]; width?: number }> }> = [];
  for (let p = 1; p <= loadedInv.numPages; p++) {
    const pg = await loadedInv.getPage(p);
    const tc = await pg.getTextContent();
    allPagesText.push({
      page: p,
      items: tc.items.filter(
        (it): it is { str: string; transform: number[]; width?: number } & typeof it =>
          'str' in it && 'transform' in it
      ),
    });
  }
  const p1AllText = allPagesText[0].items.map((i) => i.str).join(' ');
  assert.equal(p1AllText.toUpperCase().includes('MASA BERLAKU'), false, 'Should not render Masa Berlaku above Rincian Penawaran');
  const allInvJoined = allPagesText.map((pg) => pg.items.map((i) => i.str).join(' ')).join(' ');
  assert.equal(allInvJoined.toUpperCase().includes('KETENTUAN PEMBAYARAN 2 TAHAP'), false, 'Should not render Ketentuan Pembayaran 2 Tahap kicker');
  assert.equal(allInvJoined.toUpperCase().includes('OTORISASI DOKUMEN'), false, 'Should not render Otorisasi Dokumen kicker');
  assert.equal(allInvJoined.includes('Pengesahan Penerbit Penawaran'), false, 'Should not render Pengesahan Penerbit Penawaran heading');
  assert.ok(allInvJoined.includes('Metode & Tahap Pembayaran'), 'Should render Metode & Tahap Pembayaran heading');
  assert.equal(anchorPages['inv-auth'], anchorPages['inv-payment'], 'Signing cards should fit below Metode & Tahap Pembayaran on the same page');

  // Verify Rincian Penawaran and Metode & Tahap Pembayaran headings are centered and Harga Penawaran aligns with column 2
  const rincianHeading = allPagesText[0].items.find((i) =>
    i.str.includes('Rincian Penawaran Pekerjaan & Investasi')
  );
  assert.ok(rincianHeading, 'Page 1 should render Rincian Penawaran Pekerjaan & Investasi');
  const rincianCenter = rincianHeading.transform[4] + (rincianHeading.width ?? 227) / 2;
  assert.ok(
    Math.abs(rincianCenter - A4_WIDTH_PT / 2) < 6,
    `Rincian Penawaran should be centered (center=${rincianCenter})`
  );

  const metodeHeading = allPagesText
    .flatMap((pg) => pg.items)
    .find((i) => i.str.includes('Metode & Tahap Pembayaran'));
  assert.ok(metodeHeading, 'Should render Metode & Tahap Pembayaran heading');
  const metodeCenter = metodeHeading.transform[4] + (metodeHeading.width ?? 160) / 2;
  assert.ok(
    Math.abs(metodeCenter - A4_WIDTH_PT / 2) < 6,
    `Metode & Tahap Pembayaran should be centered (center=${metodeCenter})`
  );

  const col2Header = allPagesText[0].items.find((i) => i.str.includes('KOMPONEN PEKERJAAN'));
  const hargaPenawaranLabel = allPagesText
    .flatMap((pg) => pg.items)
    .find((i) => i.str.trim() === 'Harga Penawaran');
  assert.ok(col2Header && hargaPenawaranLabel);
  assert.ok(
    Math.abs(col2Header.transform[4] - hargaPenawaranLabel.transform[4]) < 2,
    `Summary label should align with column 2 (col2=${col2Header.transform[4]}, label=${hargaPenawaranLabel.transform[4]})`
  );

  // Verify bold Harga Promo + (Hemat XX%) savings text below and diagonal red strikethrough on Harga Normal
  assert.ok(p1AllText.includes('(Hemat 16%)'), 'Row 1 promo should show (Hemat 16%)');
  assert.ok(p1AllText.includes('(Hemat 27%)'), 'Admin Keuangan promo should show (Hemat 27%)');
  assert.ok(p1AllText.includes('(Hemat 100%)'), 'Promo Gratis should show (Hemat 100%)');

  const normalPriceItem = invItems.find((i) => i.str.trim() === 'Rp 119.000');
  const promoPriceItem = invItems.find((i) => i.str.trim() === '100.000');
  const savingsItem = invItems.find((i) => i.str.trim() === '(Hemat 16%)');
  assert.ok(normalPriceItem && promoPriceItem && savingsItem);
  assert.notEqual(
    promoPriceItem.fontName,
    normalPriceItem.fontName,
    'Harga Promo should be rendered in bold font'
  );
  assert.equal(savingsItem.fontName, normalPriceItem.fontName, 'Savings label should use regular font');
  assert.ok(promoPriceItem.transform[5] > savingsItem.transform[5], '(Hemat XX%) should appear below promo price');

  const p1Ops = await invP1.getOperatorList();
  let hasDiagonalRedStrike = false;
  for (let i = 0; i < p1Ops.fnArray.length; i++) {
    if (p1Ops.fnArray[i] === pdfjsLib.OPS.constructPath && Array.isArray(p1Ops.argsArray[i])) {
      const bbox = p1Ops.argsArray[i][2] as Record<number, number> | undefined;
      if (!bbox) continue;
      const dx = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
      const dy = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
      // Tilted ~7.5 deg over ~45pt price -> dx ~ 42-50, dy ~ 3-8
      if (dx > 35 && dx < 60 && dy > 2.5 && dy < 10) {
        hasDiagonalRedStrike = true;
        break;
      }
    }
  }
  assert.equal(hasDiagonalRedStrike, true, 'Page 1 should render diagonal strikethrough over Harga Normal');

  // Verify justify alignment on Page 1 Rincian & Keterangan, Page 2 Catatan Pajak & Pembayaran, and Page 3 Rincian & Ketentuan
  const lineRightEdge = (
    items: Array<{ str: string; transform: number[]; width?: number }>,
    yTarget: number,
    minX: number,
    maxX: number
  ) =>
    items
      .filter(
        (i) =>
          i.str.trim().length > 0 &&
          Math.abs(i.transform[5] - yTarget) < 1.2 &&
          i.transform[4] >= minX &&
          i.transform[4] <= maxX
      )
      .reduce((mx, i) => Math.max(mx, i.transform[4] + (i.width ?? 0)), 0);

  const deskripsiSpan = allPagesText[0].items.find((i) => i.str.includes('Deskripsi'));
  const misiSpan = allPagesText[0].items.find((i) => i.str.includes('Misi,'));
  assert.ok(deskripsiSpan && misiSpan, 'Row 2 Rincian & Keterangan should render Deskripsi...Misi,');
  const p1Row2Right = lineRightEdge(allPagesText[0].items, deskripsiSpan.transform[5], 200, 380);
  assert.ok(p1Row2Right > 371, `P1 Rincian & Keterangan row 2 line 1 should justify to ~372.2 (got ${p1Row2Right})`);

  const p2Items = allPagesText[anchorPages['inv-payment'] - 1].items;
  const ppnLineAnchor = p2Items.find((i) => i.str.includes('PPN 11%') && i.str.includes('komponen'));
  assert.ok(ppnLineAnchor, 'Should render Catatan Pajak & Pembayaran body');
  const p2CalloutRight = lineRightEdge(p2Items, ppnLineAnchor.transform[5], 50, 545);
  assert.ok(p2CalloutRight > 538, `Catatan Pajak & Pembayaran line 1 should justify to ~539.3 (got ${p2CalloutRight})`);

  const p3Items = allPagesText[anchorPages['inv-addons'] - 1].items;
  const addonRow1Anchor = p3Items.find((i) => i.str.trim() === 'otomatisasi');
  assert.ok(addonRow1Anchor, 'Appendix Rincian & Ketentuan should render wrapped line ending with otomatisasi');
  const p3AddonRight = lineRightEdge(p3Items, addonRow1Anchor.transform[5], 195, 370);
  assert.ok(p3AddonRight > 361, `Appendix Rincian & Ketentuan line 1 should justify to ~362.1 (got ${p3AddonRight})`);

  // Verify footer: left www.alinlabs.biz.id and right office.alincorporation@gmail.com on every page
  for (const pgData of allPagesText) {
    const footerItems = pgData.items.filter((i) => i.transform[5] < 40);
    const footerLeft = footerItems.find((i) => i.str.trim() === 'www.alinlabs.biz.id');
    const footerRight = footerItems.find((i) => i.str.trim() === 'office.alincorporation@gmail.com');
    assert.ok(footerLeft, `Page ${pgData.page} footer should render www.alinlabs.biz.id`);
    assert.ok(footerRight, `Page ${pgData.page} footer should render office.alincorporation@gmail.com`);
    assert.ok(footerLeft.transform[4] < 60, `Page ${pgData.page} footer website should be on left`);
    assert.ok(footerRight.transform[4] > 380, `Page ${pgData.page} footer email should be aligned on right`);
  }

  // Verify Total Penawaran label and value match 9pt size of summary rows (only bold differs)
  const allInvWithFonts = [];
  for (let p = 1; p <= loadedInv.numPages; p++) {
    const pg = await loadedInv.getPage(p);
    const tc = await pg.getTextContent();
    allInvWithFonts.push(
      ...tc.items.filter(
        (it): it is { str: string; transform: number[]; fontName: string } & typeof it =>
          'str' in it && 'transform' in it && 'fontName' in it
      )
    );
  }
  const totalPenawaranLabel = allInvWithFonts.find((i) => i.str.trim() === 'Total Penawaran');
  const totalPenawaranVal = allInvWithFonts.find((i) => i.str.trim() === 'Rp 1.855.000' && i.transform[4] > 420);
  const ppnLabel = allInvWithFonts.find((i) => i.str.trim() === 'PPN');
  assert.ok(totalPenawaranLabel && totalPenawaranVal && ppnLabel);
  assert.equal(Number(totalPenawaranLabel.transform[0].toFixed(1)), 9);
  assert.equal(Number(totalPenawaranVal.transform[0].toFixed(1)), 9);
  assert.notEqual(totalPenawaranLabel.fontName, ppnLabel.fontName, 'Total Penawaran should be bold');

  await loadedInv.cleanup();
});

test('Modular TypeScript quotation template builds directly from config and payment info modules', () => {
  const contract = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const defaultInv = createInitialInvoiceDocument(contract);
  assert.equal(defaultInv.terminMode, 'TERMIN_1_DP');
  assert.equal(defaultInv.percentage, 37.74);
  assert.equal(defaultInv.invoiceNumber, 'ALINLABS/SDI/QUO/3-127/XI/2026');
  assert.equal(defaultInv.bankInfo.bankName, 'SeaBank');
  assert.equal(defaultInv.bankInfo.accountNumber, '901387277710');
  assert.equal(defaultInv.bankInfo.accountHolder, 'Mela Melati Aprilia');
  assert.equal(defaultInv.bankInfo.accountRole, 'Finance AlinLabs Indonesia');
  assert.equal(defaultInv.terminSchedule?.length, 2);
  assert.deepEqual(
    defaultInv.terminSchedule?.map((t) => t.amount),
    [700_000, 1_155_000]
  );
  assert.equal(defaultInv.additionalOffers?.length, 8);
  const mktAddon = defaultInv.additionalOffers?.find((a) => a.id === 'addon-marketing-automation');
  const aiAddon = defaultInv.additionalOffers?.find((a) => a.id === 'addon-alinlabs-ai-chat');
  const chatAddon = defaultInv.additionalOffers?.find((a) => a.id === 'addon-chat-client-direct');
  const contentPlanAddon = defaultInv.additionalOffers?.find((a) => a.id === 'addon-social-content-plan');
  const dbAddon = defaultInv.additionalOffers?.find((a) => a.id === 'addon-db-maintenance-1y');
  const ext25 = defaultInv.additionalOffers?.find((a) => a.id === 'addon-extract-25gb');
  const ext50 = defaultInv.additionalOffers?.find((a) => a.id === 'addon-extract-50gb');
  const ext100 = defaultInv.additionalOffers?.find((a) => a.id === 'addon-extract-100gb');
  assert.equal(mktAddon?.totalPrice, 449_000);
  assert.equal(aiAddon?.totalPrice, 599_000);
  assert.equal(aiAddon?.durationMonths, 12);
  assert.equal(chatAddon?.totalPrice, 449_000);
  assert.equal(contentPlanAddon?.normalPriceLabel, 'Rp 549.000');
  assert.equal(contentPlanAddon?.offerPriceLabel, 'Rp 399.000\n(Hemat 27%)');
  assert.equal(contentPlanAddon?.totalPrice, 399_000);
  assert.equal(dbAddon?.monthlyPrice, 149_000);
  assert.equal(dbAddon?.durationMonths, 12);
  assert.equal(dbAddon?.totalPrice, 1_788_000);
  assert.equal(ext25?.capacityGb, 25);
  assert.equal(ext25?.totalPrice, 250_000);
  assert.equal(ext50?.capacityGb, 50);
  assert.equal(ext50?.totalPrice, 450_000);
  assert.equal(ext100?.capacityGb, 100);
  assert.equal(ext100?.totalPrice, 800_000);
  assert.ok((ext50!.totalPrice! / 50) < (ext25!.totalPrice! / 25));
  assert.ok((ext100!.totalPrice! / 100) < (ext50!.totalPrice! / 50));

  const customInv = buildDefaultInvoiceFromContract(contract, {
    billingConfig: {
      sequenceNumber: 3,
      terminMode: 'TERMIN_2_PELUNASAN',
      paymentTermsDays: 14,
      issueDateOverride: '2026-11-20',
      dueDateOverride: '',
      cityOverride: 'Bandung',
      statusOverride: 'PAID',
      customTotalOverride: 0,
      priorPaymentDeducted: 700_000,
    },
    bankInfo: {
      bankName: 'Bank Mandiri',
      accountNumber: '1320012345678',
      accountHolder: 'Alin Labs Indonesia',
    },
    paymentNotes: 'Catatan khusus termin II.',
  });

  assert.equal(customInv.invoiceNumber, 'ALINLABS/SDI/QUO/3-003/XI/2026');
  assert.equal(customInv.terminMode, 'TERMIN_2_PELUNASAN');
  assert.equal(customInv.percentage, 62.26);
  assert.equal(customInv.issueDate, '2026-11-20');
  assert.equal(customInv.dueDate, '2026-12-04');
  assert.equal(customInv.city, 'Bandung');
  assert.equal(customInv.status, 'PAID');
  assert.equal(customInv.priorPaymentDeducted, 700_000);
  assert.equal(customInv.bankInfo.bankName, 'Bank Mandiri');
  assert.equal(customInv.notes, 'Catatan khusus termin II.');
});

test('Colon lead-in labels in contract points and ayat become bold headings with body text on the next line without colon', async () => {
  assert.equal(
    boldColonLeadIn('KEWAJIBAN KERAHASIAAN: Masing-masing Pihak wajib menjaga data.'),
    '**KEWAJIBAN KERAHASIAAN**\nMasing-masing Pihak wajib menjaga data.'
  );
  assert.equal(
    boldColonLeadIn('PERHITUNGAN SISA PEMBAYARAN: Dihitung dengan rumus: A - B.'),
    '**PERHITUNGAN SISA PEMBAYARAN**\nDihitung dengan rumus: A - B.'
  );
  assert.equal(
    boldColonLeadIn('Ketentuan Tambahan: Berlaku sejak ditandatangani.'),
    '**Ketentuan Tambahan**\nBerlaku sejak ditandatangani.'
  );
  assert.equal(
    boldColonLeadIn('Perjanjian ini berakhir apabila: (a) seluruh kewajiban telah selesai.'),
    'Perjanjian ini berakhir apabila: (a) seluruh kewajiban telah selesai.'
  );
  assert.equal(
    boldColonLeadIn('Jangka waktu pelaksanaan proyek terdiri atas: (a) Tahap 1; (b) Tahap 2.'),
    'Jangka waktu pelaksanaan proyek terdiri atas: (a) Tahap 1; (b) Tahap 2.'
  );

  const contract = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const model = buildLegalDocumentModel(contract);
  const numbered = model.blocks.filter((b) => b.type === 'numbered-paragraph');
  const p52 = numbered.find((b) => b.text.includes('PENGAKUAN PEMBAYARAN SEBELUMNYA'));
  const p53 = numbered.find((b) => b.text.includes('PERHITUNGAN SISA PEMBAYARAN'));
  const p81 = numbered.find((b) => b.text.includes('KEPEMILIKAN EKSKLUSIF'));
  const p141 = numbered.find((b) => b.text.includes('Perjanjian ini berakhir apabila:'));
  assert.ok(
    p52?.text.startsWith('**PENGAKUAN PEMBAYARAN SEBELUMNYA (UANG MUKA / DOWN PAYMENT)**\n')
  );
  assert.ok(p53?.text.startsWith('**PERHITUNGAN SISA PEMBAYARAN**\nSisa kewajiban'));
  assert.ok(
    p81?.text.startsWith('**KEPEMILIKAN EKSKLUSIF SOURCE CODE OLEH ALINLABS INDONESIA**\n')
  );
  assert.ok(p141 && !p141.text.includes('**'));

  const boldWords = tokenizeLineIntoStyledWords(
    '**KEPEMILIKAN SOURCE CODE** Berlaku penuh.'
  );
  assert.deepEqual(boldWords[0], [{ text: 'KEPEMILIKAN', italic: false, bold: true }]);
  assert.deepEqual(boldWords[1], [{ text: 'SOURCE', italic: true, bold: true }]);
  assert.deepEqual(boldWords[2], [{ text: 'CODE', italic: true, bold: true }]);
  assert.deepEqual(boldWords[3], [{ text: 'Berlaku', italic: false }]);

  const testPdf = await PDFDocument.create();
  const rFont = await testPdf.embedFont(StandardFonts.TimesRoman);
  const iFont = await testPdf.embedFont(StandardFonts.TimesRomanItalic);
  const bFont = await testPdf.embedFont(StandardFonts.TimesRomanBold);
  const biFont = await testPdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const wrapped = wrapStyledTextWords(
    '**PERHITUNGAN SISA PEMBAYARAN**\nSisa kewajiban pembayaran.',
    rFont,
    iFont,
    11,
    300,
    false,
    bFont,
    biFont
  );
  assert.equal(wrapped.lines.length, 2);
  assert.equal(wrapped.isParagraphEnd[0], true);
  assert.equal(wrapped.lines[0][0][0]?.bold, true);
  assert.equal(wrapped.lines[1][0][0]?.bold, undefined);
});

test('Both default Contract and Quotation documents are issued in Purwakarta on 22 November 2026', () => {
  const defaultContract = createInitialContractDocument();
  assert.equal(defaultContract.agreement.signingCity, 'Purwakarta');
  assert.equal(defaultContract.agreement.agreementDate, '2026-11-22');

  const model = buildLegalDocumentModel(defaultContract);
  const openingPara = model.blocks.find(
    (b) => b.type === 'paragraph' && b.text.includes('Surat Perjanjian Kerja Sama')
  );
  assert.ok(
    openingPara &&
      openingPara.type === 'paragraph' &&
      openingPara.text.includes('Minggu, tanggal 22 November 2026, bertempat di Purwakarta')
  );

  const signingBlock = model.blocks.find((b) => b.type === 'signature-block');
  assert.ok(signingBlock && signingBlock.type === 'signature-block');
  assert.equal(signingBlock.city, 'Purwakarta');
  assert.equal(signingBlock.dateText, '22 November 2026');

  const defaultQuotation = createInitialInvoiceDocument(defaultContract);
  assert.equal(defaultQuotation.city, 'Purwakarta');
  assert.equal(defaultQuotation.issueDate, '2026-11-22');
  assert.equal(defaultQuotation.dueDate, '2026-11-29');
  assert.equal(defaultQuotation.invoiceNumber, 'ALINLABS/SDI/QUO/3-127/XI/2026');
  assert.equal(defaultContract.agreement.contractNumber, 'ALINLABS/SDI/AGR/3-048/XI/2026');
});

test('Pasal 2 scope cells use justify alignment and render bullet headings with indented description lines below without colons', async () => {
  assert.equal(sanitizeWinAnsi('\u2022 **Beranda**'), '\u2022 **Beranda**');

  const contract = createInitialContractDocument();
  const model = buildLegalDocumentModel(contract);
  const scopeTable = model.blocks.find(
    (b) =>
      b.type === 'key-value-table' &&
      b.rows.some((r) => r.label === 'Daftar Halaman')
  );
  assert.ok(scopeTable && scopeTable.type === 'key-value-table');
  assert.equal(scopeTable.valueAlign, 'justify');

  const pagesRow = scopeTable.rows.find((r) => r.label === 'Daftar Halaman');
  const featuresRow = scopeTable.rows.find((r) => r.label === 'Fitur Utama Website');
  const techRow = scopeTable.rows.find((r) => r.label === 'Arsitektur Teknis & Tech Stack');
  assert.ok(pagesRow && pagesRow.value.includes('\n\u2022 **Tentang**\n  '));
  assert.ok(featuresRow && featuresRow.value.includes('\n\u2022 **Katalog & Pemesanan WhatsApp**\n  '));
  assert.ok(techRow && techRow.value.includes('\n\u2022 **UI, State & Dokumen PDF**\n  '));

  const pdfDoc = await PDFDocument.create();
  const rFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const iFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const bFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const biFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const wrapped = wrapStyledTextWords(
    '\u2022 **Beranda**\n  Deskripsi panjang sekali agar otomatis turun ke baris berikutnya di dalam sel tabel.',
    rFont,
    iFont,
    9.5,
    180,
    false,
    bFont,
    biFont
  );
  assert.ok(wrapped.lines.length >= 3);
  assert.equal(wrapped.lineIndentPts[0], 0);
  assert.equal(wrapped.isParagraphEnd[0], true);
  assert.ok(wrapped.lineIndentPts[1] > 4);
  assert.equal(wrapped.isParagraphEnd[1], false);
  assert.ok(wrapped.lineIndentPts[2] > 4);
  assert.equal(wrapped.lines[0][1]?.[0]?.bold, true);
});

function countPageImages(parsedDoc: PDFDocument, zeroBasedPageIndex: number): number {
  const page = parsedDoc.getPage(zeroBasedPageIndex);
  const resources = page.node.Resources();
  const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (!xObjects) return 0;
  return xObjects.entries().length;
}

test('Contract PDF uses 4-4-3-3 cm margins with 1-page Cover + Page 2 Kop Surat, and Quotation keeps logo on page 1', async () => {
  assert.equal(CONTRACT_MARGIN_TOP_PT, 113.39);
  assert.equal(CONTRACT_MARGIN_LEFT_PT, 113.39);
  assert.equal(CONTRACT_MARGIN_BOTTOM_PT, 85.04);
  assert.equal(CONTRACT_MARGIN_RIGHT_PT, 85.04);
  assert.ok(Math.abs(CONTRACT_CONTENT_WIDTH_PT - 396.85) < 0.01);

  const toPngBytes = (filePath: string, scale?: number): Uint8Array => {
    const args = ['-v', 'error', '-i', filePath];
    if (scale) {
      args.push('-vf', `scale=${scale}:-1`);
    }
    args.push('-f', 'image2pipe', '-vcodec', 'png', '-');
    return new Uint8Array(execFileSync('ffmpeg', args));
  };

  registerPdfPngAssetCache(PDF_ASSET_PATHS.logo, toPngBytes('public/logo-alinlabs.webp'));
  registerPdfPngAssetCache(PDF_ASSET_PATHS.shansusLogo, toPngBytes('public/shansudar-logo.webp'));
  registerPdfPngAssetCache(PDF_ASSET_PATHS.stempel, toPngBytes('public/stempel-alinlabs.webp', 520));
  registerPdfPngAssetCache(
    PDF_ASSET_PATHS.signatureAlvareza,
    toPngBytes('public/tanda-tangan-alvareza.webp')
  );
  registerPdfPngAssetCache(PDF_ASSET_PATHS.seabankLogo, toPngBytes('public/seabank-logo.webp'));

  try {
    const contract = createInitialContractDocument('2026-11-22T10:00:00.000Z');
    const contractOut = await generateContractPdfBytes(contract);
    const parsedContract = await PDFDocument.load(contractOut.pdfBytes);
    // Page 1 = Cover (2 logos: Shansus Dzar + AlinLabs), Page 2 = Kop Surat body start (1 logo), Page 3 = body continuation (0 logos)
    assert.equal(countPageImages(parsedContract, 0), 2);
    assert.equal(countPageImages(parsedContract, 1), 1);
    assert.equal(countPageImages(parsedContract, 2), 0);
    assert.equal(contractOut.anchorPages['opening'], 2);
    const contractSigPageIdx = (contractOut.anchorPages['signing'] ?? contractOut.pageCount) - 1;
    assert.equal(countPageImages(parsedContract, contractSigPageIdx), 2);

    const invoice = createInitialInvoiceDocument(contract);
    const invoiceOut = await generateInvoicePdfBytes(invoice);
    const parsedInvoice = await PDFDocument.load(invoiceOut.pdfBytes);
    assert.equal(countPageImages(parsedInvoice, 0), 1);
    const invoiceAuthPageIdx = (invoiceOut.anchorPages['inv-auth'] ?? invoiceOut.pageCount) - 1;
    assert.equal(invoiceAuthPageIdx, 1, 'Quotation signing cards should sit on Page 2 below payment section');
    assert.equal(countPageImages(parsedInvoice, 1), 3, 'Page 2 should contain SeaBank logo plus stempel and signature');
  } finally {
    clearPdfAssetCache();
  }
});

test('Cover has no page border, Page 2 letterhead sits in header zone, and oversized table rows split across page breaks', async () => {
  const contract = createInitialContractDocument('2026-11-22T10:00:00.000Z');
  // Create a very long feature list & long data-table row to guarantee row splitting across pages
  contract.scope.featuresList = Array.from(
    { length: 45 },
    (_, idx) => `Fitur Unggulan Nomor ${idx + 1}: Deskripsi teknis terperinci modul integrasi sistem bisnis.`
  );
  contract.project.milestones[0].deliverable = Array.from(
    { length: 45 },
    (_, idx) => `Deliverable Tahap ${idx + 1}: Penyusunan arsitektur, pengujian fungsional, dan dokumentasi.`
  ).join('\n');

  const out = await generateContractPdfBytes(contract);
  const parsed = await PDFDocument.load(out.pdfBytes);
  assert.ok(out.pageCount >= 8);

  // Inspect content streams via zlib/raw text or pdfjs to verify:
  // 1) Cover page (index 0) does NOT draw the outer frame rectangle at frameW (396.85) x frameH (643.46)
  // 2) Page 2 (index 1) has letterhead text near y=788 (not pushed down by 4cm top margin)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loaded = await pdfjsLib.getDocument({ data: out.pdfBytes.slice() }).promise;

  const page2 = await loaded.getPage(2);
  const p2Text = await page2.getTextContent();
  const alinHeaderItem = p2Text.items.find(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && it.str.includes('ALINLABS INDONESIA')
  );
  assert.ok(alinHeaderItem, 'Page 2 should contain ALINLABS INDONESIA letterhead');
  // y-coordinate in transform[5] should be around 788 (> 770), not ~718 (4cm down)
  assert.ok(
    alinHeaderItem.transform[5] > 770,
    `Expected Page 2 letterhead y > 770, got ${alinHeaderItem.transform[5]}`
  );

  // 3) Verify a single long key-value row ("Fitur Utama Website") splits across consecutive pages
  let firstHalfPage = -1;
  let secondHalfPage = -1;
  for (let p = 1; p <= loaded.numPages; p++) {
    const pg = await loaded.getPage(p);
    const tc = await pg.getTextContent();
    const joined = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ');
    if (joined.includes('Fitur Unggulan Nomor 1:')) {
      firstHalfPage = p;
    }
    if (joined.includes('Fitur Unggulan Nomor 45:')) {
      secondHalfPage = p;
    }
  }
  assert.ok(firstHalfPage >= 2, 'First part of split key-value row should render');
  assert.ok(
    secondHalfPage > firstHalfPage,
    `Expected long key-value row to split across pages (first=${firstHalfPage}, last=${secondHalfPage})`
  );

  // 4) Verify a single long data-table row (Deliverable Tahap 1 .. 45) also splits across pages
  let firstDelivPage = -1;
  let lastDelivPage = -1;
  for (let p = 1; p <= loaded.numPages; p++) {
    const pg = await loaded.getPage(p);
    const tc = await pg.getTextContent();
    const joined = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ');
    if (joined.includes('Deliverable Tahap 1:')) {
      firstDelivPage = p;
    }
    if (joined.includes('Deliverable Tahap 45:')) {
      lastDelivPage = p;
    }
  }
  assert.ok(firstDelivPage >= 2, 'First part of split data-table row should render');
  assert.ok(
    lastDelivPage > firstDelivPage,
    `Expected long data-table row to split across pages (first=${firstDelivPage}, last=${lastDelivPage})`
  );

  // 5) Cover page has no outer 396.85 x 643.46 border rectangle in page 1 operators
  // and places Shansus Dzar Indonesia (left) and AlinLabs Indonesia (right) side by side
  const page1 = await loaded.getPage(1);
  const p1Text = await page1.getTextContent();
  const leftPartyItem = p1Text.items.find(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && it.str.trim() === 'Shansus Dzar Indonesia'
  );
  const rightPartyItem = p1Text.items.find(
    (it): it is { str: string; transform: number[] } & typeof it =>
      'str' in it && it.str.trim() === 'AlinLabs Indonesia'
  );
  assert.ok(leftPartyItem && rightPartyItem, 'Cover page should render both side-by-side party names');
  assert.ok(
    Math.abs(leftPartyItem.transform[5] - rightPartyItem.transform[5]) < 2,
    'Cover parties should sit on the same horizontal row'
  );
  assert.ok(
    leftPartyItem.transform[4] < rightPartyItem.transform[4] - 120,
    `Expected Shansus Dzar Indonesia left of AlinLabs Indonesia (leftX=${leftPartyItem.transform[4]}, rightX=${rightPartyItem.transform[4]})`
  );

  // Check Cover & Page 2 title font sizes (14pt) and non-bold 12pt Nomor line
  const p1Items = p1Text.items.filter(
    (it): it is { str: string; transform: number[]; fontName: string } & typeof it =>
      'str' in it && 'transform' in it && 'fontName' in it
  );
  const covTitle1 = p1Items.find((it) => it.str.trim() === 'SURAT PERJANJIAN KERJA SAMA');
  const covTitle2 = p1Items.find((it) => it.str.trim() === 'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE');
  const covNomor = p1Items.find((it) => it.str.startsWith('Nomor:'));
  assert.ok(covTitle1 && covTitle2 && covNomor, 'Cover should render 14pt titles and Nomor line');
  assert.equal(Math.round(covTitle1.transform[0]), 14);
  assert.equal(Math.round(covTitle2.transform[0]), 14);
  assert.equal(Math.round(covNomor.transform[0]), 12);
  assert.notEqual(covNomor.fontName, covTitle1.fontName, 'Cover Nomor line should not be bold');

  const covBrand = p1Items.find((it) => it.str.trim() === 'ALINLABS INDONESIA');
  const covCity = p1Items.find((it) => it.str.trim() === 'PURWAKARTA');
  const covYear = p1Items.find((it) => it.str.trim() === '2026');
  const covAddress = p1Items.find((it) => it.str.includes('Jln. Rawa Sari'));
  const covFooter = p1Items.find((it) => it.str.includes('www.alinlabs.biz.id'));
  assert.equal(covBrand, undefined, 'Cover should not render single ALINLABS INDONESIA header at top');
  assert.ok(covCity && covYear && covAddress && covFooter, 'Cover should render 4-line footer');
  assert.ok(covCity.transform[5] > covYear.transform[5], 'City should sit above year');
  assert.ok(covYear.transform[5] > covAddress.transform[5], 'Year should sit above address');
  assert.ok(covAddress.transform[5] > covFooter.transform[5], 'Address should sit above contact line');
  assert.ok(!covFooter.str.includes('|') && !covFooter.str.includes(' - '), 'Contact line should not use dash or pipe separators');
  assert.ok(covTitle1.transform[5] > 740, `Cover title should sit at the very top (y=${covTitle1.transform[5]})`);
  assert.ok(covFooter.transform[5] < 85, `Cover footer should use normal bottom margin (y=${covFooter.transform[5]})`);

  const p2Items = p2Text.items.filter(
    (it): it is { str: string; transform: number[]; fontName: string } & typeof it =>
      'str' in it && 'transform' in it && 'fontName' in it
  );
  const p2Title1 = p2Items.find((it) => it.str.trim() === 'SURAT PERJANJIAN KERJA SAMA');
  const p2Title2 = p2Items.find((it) => it.str.trim() === 'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE');
  const p2Nomor = p2Items.find((it) => it.str.includes('Nomor:'));
  assert.ok(p2Title1 && p2Title2 && p2Nomor, 'Page 2 should render 14pt titles and Nomor line');
  assert.equal(Math.round(p2Title1.transform[0]), 14);
  assert.equal(Math.round(p2Title2.transform[0]), 14);
  assert.equal(Math.round(p2Nomor.transform[0]), 12);
  assert.notEqual(p2Nomor.fontName, p2Title1.fontName, 'Page 2 Nomor line should not be bold');

  const ops = await page1.getOperatorList();
  const reArgs: number[][] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.rectangle && Array.isArray(ops.argsArray[i])) {
      reArgs.push(ops.argsArray[i] as number[]);
    }
  }
  const hasCoverOuterBorder = reArgs.some(
    (r) => Math.abs(r[2] - CONTRACT_CONTENT_WIDTH_PT) < 2 && Math.abs(r[3] - 643) < 5
  );
  assert.equal(hasCoverOuterBorder, false, 'Cover page should not draw outer border frame');

  const coverAllText = p1Items.map((it) => it.str).join(' ');
  assert.equal(
    coverAllText.includes('PROYEK PENGEMBANGAN'),
    false,
    'Cover page should not render PROYEK PENGEMBANGAN card title'
  );
  assert.equal(
    coverAllText.includes('Website Resmi'),
    false,
    'Cover page should not render project title text below Nomor'
  );

  const covAntara = p1Items.find((it) => it.str.trim() === 'ANTARA');
  assert.ok(covAntara, 'Cover page should render ANTARA');
  assert.ok(
    covNomor.transform[5] > covAntara.transform[5],
    `ANTARA should sit below Nomor and dual logos (nomorY=${covNomor.transform[5]}, antaraY=${covAntara.transform[5]})`
  );

  // Verify cover does not draw horizontal lines below Nomor or above PURWAKARTA
  const coverHorizontalLines: { width: number; y: number }[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.constructPath && Array.isArray(ops.argsArray[i])) {
      const bbox = ops.argsArray[i][2] as Record<number, number> | undefined;
      if (!bbox) continue;
      const w = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
      const h = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
      if (w > 20 && h < 1) {
        coverHorizontalLines.push({ width: w, y: bbox[1] ?? 0 });
      }
    }
  }
  assert.equal(
    coverHorizontalLines.some((l) => l.y < covNomor.transform[5] && l.y > covAntara.transform[5]),
    false,
    'Cover should not draw horizontal line below Nomor'
  );
  assert.equal(
    coverHorizontalLines.some((l) => l.y > covCity.transform[5] && l.y < covCity.transform[5] + 40),
    false,
    'Cover should not draw horizontal line above PURWAKARTA'
  );
  assert.equal(
    reArgs.some((r) => r[2] > 200 && r[3] > 20 && r[3] < 120),
    false,
    'Cover should not draw project card rectangle'
  );

  await loaded.cleanup();
  assert.equal(parsed.getPageCount(), out.pageCount);
});

test('Blob print utility converts PDF bytes into PDF Blob and multi-page A4 HTML print Blob', async () => {
  const doc = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const { pdfBytes, pageCount } = await generateContractPdfBytes(doc);

  const pdfBlob = createPdfBlob(pdfBytes);
  assert.equal(pdfBlob.type, 'application/pdf');
  assert.equal(pdfBlob.size, pdfBytes.byteLength);

  const fakePageBlobUrls = Array.from({ length: pageCount }, (_, idx) => `blob:https://app.local/page-${idx + 1}`);
  const { html, htmlBlob } = buildPrintableHtmlDocument(
    fakePageBlobUrls,
    'Perjanjian Kerja Sama <ALINLABS>'
  );

  assert.equal(htmlBlob.type, 'text/html;charset=utf-8');
  assert.ok(htmlBlob.size > 200);
  assert.ok(html.includes('size: A4 portrait;'));
  assert.ok(html.includes('Perjanjian Kerja Sama &lt;ALINLABS&gt;'));
  const imgMatches = html.match(/class="print-page"/g) ?? [];
  assert.equal(imgMatches.length, pageCount);

  const clickedLinks: Array<{ href: string; target: string; rel: string; download: string }> = [];
  const originalDocument = globalThis.document;
  const fakeAnchor = {
    href: '',
    target: '',
    rel: '',
    download: '',
    className: '',
    click() {
      clickedLinks.push({
        href: this.href,
        target: this.target,
        rel: this.rel,
        download: this.download,
      });
    },
  };
  (globalThis as Record<string, unknown>).document = {
    body: {
      appendChild() {
        return fakeAnchor;
      },
      removeChild() {
        return fakeAnchor;
      },
    },
    createElement(tag: string) {
      assert.equal(tag, 'a');
      return fakeAnchor;
    },
  };
  try {
    const openedUrl = openPdfBlobInNewTab(pdfBytes);
    assert.ok(openedUrl.startsWith('blob:'));
    assert.equal(clickedLinks.length, 1);
    assert.equal(clickedLinks[0].href, openedUrl);
    assert.equal(clickedLinks[0].target, '_blank');
    assert.equal(clickedLinks[0].rel, 'noopener noreferrer');
    assert.equal(clickedLinks[0].download, '');
    URL.revokeObjectURL(openedUrl);
  } finally {
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  }
});

test('Local first-party signing updates signature and propagates Nama, Jabatan, Email, Telepon across Cover, Identity table, and Signature block', async () => {
  const baseDoc = createInitialContractDocument('2026-11-19T10:00:00.000Z');
  const dummyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  const localSigned = await applyLocalFirstPartySignature(
    baseDoc,
    {
      signerName: 'Budi Santoso, S.E.',
      signerTitle: 'Direktur Operasional Shansus Dzar',
      signerEmail: 'budi@shansusdzar.com',
      signerPhone: '081234567890',
      signatureImageDataUrl: dummyPngDataUrl,
    },
    '2026-11-20T12:00:00.000Z'
  );

  assert.equal(localSigned.firstParty.directorName, 'Budi Santoso, S.E.');
  assert.equal(localSigned.firstParty.directorTitle, 'Direktur Operasional Shansus Dzar');
  assert.equal(localSigned.firstParty.email, 'budi@shansusdzar.com');
  assert.equal(localSigned.firstParty.phone, '081234567890');
  assert.equal(localSigned.signatures.firstParty.signed, true);
  assert.equal(localSigned.signatures.firstParty.signatureImageDataUrl, dummyPngDataUrl);
  assert.equal(localSigned.signatures.firstParty.certifiedStatus, 'CERTIFIED_PSRE');
  assert.equal(localSigned.signatures.firstParty.verificationMethod, 'PSRE_CERTIFIED');
  assert.equal(localSigned.signatures.psre.mode, 'PSRE_CERTIFIED');
  assert.equal(localSigned.signatures.psre.apiKeyConfigured, true);

  const model = buildLegalDocumentModel(localSigned);
  const firstPartyTable = model.blocks.find((b) => b.type === 'key-value-table');
  assert.ok(firstPartyTable && firstPartyTable.type === 'key-value-table');
  assert.ok(
    firstPartyTable.rows.some(
      (r) =>
        r.label === 'Diwakili Oleh' &&
        r.value.includes('Budi Santoso, S.E.') &&
        r.value.includes('Direktur Operasional Shansus Dzar')
    )
  );
  assert.ok(
    firstPartyTable.rows.some(
      (r) =>
        r.label === 'Kontak Resmi' &&
        r.value.includes('081234567890') &&
        r.value.includes('budi@shansusdzar.com')
    )
  );

  const sigBlock = model.blocks.find((b) => b.type === 'signature-block');
  assert.ok(sigBlock && sigBlock.type === 'signature-block');
  assert.equal(sigBlock.firstPartySignerName, 'Budi Santoso, S.E.');
  assert.equal(sigBlock.firstPartySignerTitle, 'Direktur Operasional Shansus Dzar');
  assert.equal(sigBlock.firstPartySignatureUrl, dummyPngDataUrl);
  assert.equal(sigBlock.firstPartyCertStatus, 'Tersertifikasi PSrE');
  assert.ok(sigBlock.psreModeLabel.includes('Tanda Tangan Elektronik Tersertifikasi'));

  const unsignedOut = await generateContractPdfBytes(baseDoc);
  const { pdfBytes, anchorPages } = await generateContractPdfBytes(localSigned);
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const hasSigBox174x82 = (ops: Awaited<ReturnType<typeof unsignedSigPage.getOperatorList>>) =>
    ops.fnArray.some((fn, i) => {
      if (fn !== pdfjsLib.OPS.constructPath || !Array.isArray(ops.argsArray[i])) return false;
      const bbox = ops.argsArray[i][2] as Record<number, number> | undefined;
      if (!bbox) return false;
      const w = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
      const h = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
      return Math.abs(w - 174) < 2 && Math.abs(h - 82) < 2;
    });

  const countHorizontalSigLines174 = (ops: Awaited<ReturnType<typeof unsignedSigPage.getOperatorList>>) =>
    ops.fnArray.filter((fn, i) => {
      if (fn !== pdfjsLib.OPS.constructPath || !Array.isArray(ops.argsArray[i])) return false;
      const bbox = ops.argsArray[i][2] as Record<number, number> | undefined;
      if (!bbox) return false;
      const w = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
      const h = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
      return Math.abs(w - 174) < 2 && h < 1;
    }).length;

  const unsignedLoaded = await pdfjsLib.getDocument({ data: unsignedOut.pdfBytes.slice() }).promise;
  const unsignedSigPage = await unsignedLoaded.getPage(unsignedOut.anchorPages['signing']);
  const unsignedText = (await unsignedSigPage.getTextContent()).items
    .map((it) => ('str' in it ? it.str : ''))
    .join(' ');
  assert.equal(unsignedText.includes('Ruang Tanda Tangan'), true);
  assert.equal(unsignedText.includes('Nama'), true);
  assert.equal(unsignedText.includes('Jabatan'), true);
  assert.equal(unsignedText.includes('Tanggal'), true);
  assert.equal(unsignedText.includes('Status   :'), false);
  assert.equal(unsignedText.includes('Hash Dok :'), false);
  assert.equal(unsignedText.includes('Keterangan Validasi Elektronik'), false);
  const unsignedOps = await unsignedSigPage.getOperatorList();
  assert.equal(hasSigBox174x82(unsignedOps), true, 'Unsigned Pihak Pertama should render signature rectangle box');
  assert.equal(countHorizontalSigLines174(unsignedOps), 1, 'Only AlinLabs should render baseline line when unsigned');
  await unsignedLoaded.cleanup();

  const loaded = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const p1 = await loaded.getPage(1);
  const p1Text = await p1.getTextContent();
  const coverJoined = p1Text.items
    .map((it) => ('str' in it ? it.str : ''))
    .join(' ');
  assert.ok(coverJoined.includes('Budi Santoso, S.E.'));

  const signedSigPage = await loaded.getPage(anchorPages['signing']);
  const signedText = (await signedSigPage.getTextContent()).items
    .map((it) => ('str' in it ? it.str : ''))
    .join(' ');
  assert.equal(signedText.includes('Ruang Tanda Tangan'), false);
  assert.equal(signedText.includes('Nama'), true);
  assert.equal(signedText.includes('Jabatan'), true);
  assert.equal(signedText.includes('Tanggal'), true);
  assert.equal(signedText.includes('Status   :'), false);
  assert.equal(signedText.includes('Hash Dok :'), false);
  assert.equal(signedText.includes('Keterangan Validasi Elektronik'), false);
  const signedOps = await signedSigPage.getOperatorList();
  assert.equal(hasSigBox174x82(signedOps), false, 'Signed Pihak Pertama should replace rectangle box with baseline line');
  assert.equal(countHorizontalSigLines174(signedOps), 2, 'Both Pihak Pertama and AlinLabs should render baseline lines after signing');
  const paintedImages = signedOps.fnArray.filter((fn) => fn === pdfjsLib.OPS.paintImageXObject).length;
  assert.ok(paintedImages >= 1, 'Signed Pihak Pertama page should paint embedded PNG signature');

  // Verify Pasal 5 cost table rendered bold promo + savings %, SEO Rp 99.000->0, and non-table summary alignment
  const p5Start = anchorPages['pasal-5'];
  const p6Start = anchorPages['pasal-6'];
  const p5Items: Array<{ str: string; transform: number[]; fontName: string; page: number }> = [];
  for (let p = p5Start; p <= p6Start; p++) {
    const pg = await loaded.getPage(p);
    const tc = await pg.getTextContent();
    for (const it of tc.items) {
      if ('str' in it && 'transform' in it && 'fontName' in it) {
        p5Items.push({ str: it.str, transform: it.transform, fontName: it.fontName, page: p });
      }
    }
  }
  const p5Joined = p5Items.map((it) => it.str).join(' ');
  assert.ok(p5Joined.includes('(Hemat 16%)'), 'Contract cost table should render (Hemat 16%)');
  assert.ok(p5Joined.includes('(Hemat 100%)'), 'Contract cost table should render (Hemat 100%)');
  assert.ok(p5Joined.includes('Rp 99.000'), 'Contract SEO item should render Rp 99.000 normal price');
  assert.ok(p5Joined.includes('Total Biaya'), 'Contract summary should render Total Biaya');
  assert.ok(p5Joined.includes('Potongan'), 'Contract summary should render Potongan');
  assert.ok(p5Joined.includes('PPN'), 'Contract summary should render PPN');
  assert.ok(p5Joined.includes('Nilai Total'), 'Contract summary should render Nilai Total');
  assert.ok(p5Joined.includes('Rp 2.501.000'), 'Contract Total Biaya should be Rp 2.501.000');
  assert.ok(p5Joined.includes('- Rp 701.000'), 'Contract Potongan should be - Rp 701.000');
  assert.ok(p5Joined.includes('Rp 1.855.000'), 'Contract Nilai Total should be Rp 1.855.000');

  const col2Cell = p5Items.find((it) => it.str.trim().startsWith('Halaman :'));
  const totalBiayaLbl = p5Items.find((it) => it.str.trim() === 'Total Biaya');
  const nilaiTotalLbl = p5Items.find((it) => it.str.trim() === 'Nilai Total');
  const promoBeranda = p5Items.find((it) => it.str.trim() === '100.000');
  const normalBeranda = p5Items.find((it) => it.str.trim() === 'Rp 119.000');
  const hematBeranda = p5Items.find((it) => it.str.trim() === '(Hemat 16%)');
  assert.ok(col2Cell && totalBiayaLbl && nilaiTotalLbl && promoBeranda && normalBeranda && hematBeranda);
  assert.ok(
    Math.abs(col2Cell.transform[4] - totalBiayaLbl.transform[4]) < 1,
    `Total Biaya should align with Column 2 cell text (col2Cell=${col2Cell.transform[4]}, label=${totalBiayaLbl.transform[4]})`
  );
  assert.notEqual(nilaiTotalLbl.fontName, totalBiayaLbl.fontName, 'Nilai Total label should be bold');
  assert.notEqual(promoBeranda.fontName, normalBeranda.fontName, 'Contract Harga Promo should be bold');
  assert.equal(hematBeranda.fontName, normalBeranda.fontName, 'Savings percentage below promo price should be regular');
  assert.ok(promoBeranda.transform[5] > hematBeranda.transform[5], '(Hemat 16%) should sit below Rp 100.000');

  await loaded.cleanup();
});

test('Contract data tables never repeat header row across page breaks and keep clear spacing above and below', async () => {
  const doc = createInitialContractDocument('2026-11-22T10:00:00.000Z');
  const { pdfBytes, anchorPages } = await generateContractPdfBytes(doc);
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loaded = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;

  try {
    // 1) Find all pages containing Rincian Biaya Pekerjaan rows ("Beranda" .. "Setup Search Console")
    let costStartPage = -1;
    let costEndPage = -1;
    let headerOccurrences = 0;

    for (let p = anchorPages['pasal-5']; p <= loaded.numPages; p++) {
      const pg = await loaded.getPage(p);
      const tc = await pg.getTextContent();
      const joined = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ');
      if (joined.includes('Rincian Biaya Pekerjaan')) {
        costStartPage = p;
      }
      if (joined.includes('Setup Search Console')) {
        costEndPage = p;
      }
      if (joined.includes('Komponen Pekerjaan') && joined.includes('Harga Normal') && joined.includes('Harga Promo')) {
        headerOccurrences += 1;
        assert.equal(
          p,
          costStartPage,
          `Table header for Rincian Biaya Pekerjaan must only appear on start page ${costStartPage}, not continuation page ${p}`
        );
      }
    }

    assert.ok(costStartPage >= 2, 'Rincian Biaya Pekerjaan start page should exist');
    assert.ok(costEndPage > costStartPage, 'Rincian Biaya Pekerjaan should span across page break');
    assert.equal(headerOccurrences, 1, 'Rincian Biaya Pekerjaan header row must appear exactly once across all pages');

    // 2) Verify clear gap between table title and table top border, and between table bottom border and text below
    const p2 = await loaded.getPage(2);
    const p2Text = (await p2.getTextContent()).items.filter(
      (it): it is { str: string; transform: number[] } & typeof it =>
        'str' in it && 'transform' in it && it.str.trim().length > 0
    );
    const p2Heading = p2Text.find((it) => it.str.includes('1. PIHAK PERTAMA'));
    const p2Closing = p2Text.find((it) => it.str.includes('disebut sebagai'));
    const p2Ops = await p2.getOperatorList();
    const p2Rects: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < p2Ops.fnArray.length; i++) {
      if (p2Ops.fnArray[i] === pdfjsLib.OPS.constructPath && Array.isArray(p2Ops.argsArray[i])) {
        const bbox = p2Ops.argsArray[i][2] as Record<number, number> | undefined;
        if (!bbox) continue;
        const w = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
        const h = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
        // Key-value table cells have w >= 120 and h >= 10, positioned below 1. PIHAK PERTAMA heading
        if (w > 100 && h > 10 && (bbox[3] ?? 999) < (p2Heading?.transform[5] ?? 999)) {
          p2Rects.push({ x: bbox[0] ?? 0, y: bbox[1] ?? 0, w, h });
        }
      }
    }
    assert.ok(p2Heading && p2Closing && p2Rects.length >= 2);
    const p2FirstTableTop = Math.max(
      ...p2Rects.filter((r) => r.y > p2Closing.transform[5]).map((r) => r.y + r.h)
    );
    const p2FirstTableBottom = Math.min(
      ...p2Rects.filter((r) => r.y > p2Closing.transform[5]).map((r) => r.y)
    );
    const topGapFromBaseline = p2Heading.transform[5] - p2FirstTableTop;
    const bottomGapToBaseline = p2FirstTableBottom - p2Closing.transform[5];
    assert.ok(
      topGapFromBaseline >= 9,
      `Expected >= 9pt baseline-to-border gap above Pihak Pertama table, got ${topGapFromBaseline.toFixed(2)}pt`
    );
    assert.ok(
      bottomGapToBaseline >= 18,
      `Expected >= 18pt border-to-baseline gap below Pihak Pertama table, got ${bottomGapToBaseline.toFixed(2)}pt`
    );

    // Also verify title-to-table gap on Rincian Biaya Pekerjaan
    const costPage = await loaded.getPage(costStartPage);
    const costText = (await costPage.getTextContent()).items.filter(
      (it): it is { str: string; transform: number[] } & typeof it =>
        'str' in it && 'transform' in it && it.str.trim().length > 0
    );
    const costTitle = costText.find((it) => it.str.includes('Rincian Biaya Pekerjaan'));
    const costOps = await costPage.getOperatorList();
    const costHeaderRects: { y: number; h: number }[] = [];
    for (let i = 0; i < costOps.fnArray.length; i++) {
      if (costOps.fnArray[i] === pdfjsLib.OPS.constructPath && Array.isArray(costOps.argsArray[i])) {
        const bbox = costOps.argsArray[i][2] as Record<number, number> | undefined;
        if (!bbox) continue;
        const w = Math.abs((bbox[2] ?? 0) - (bbox[0] ?? 0));
        const h = Math.abs((bbox[3] ?? 0) - (bbox[1] ?? 0));
        if (w > 20 && h >= 18 && (bbox[3] ?? 999) < (costTitle?.transform[5] ?? 999)) {
          costHeaderRects.push({ y: bbox[1] ?? 0, h });
        }
      }
    }
    assert.ok(costTitle && costHeaderRects.length > 0);
    assert.equal(
      Number(costTitle.transform[0].toFixed(1)),
      11,
      'Table title (Rincian Biaya Pekerjaan) should be 11pt'
    );
    const costTableTop = Math.max(...costHeaderRects.map((r) => r.y + r.h));
    const costTitleGap = costTitle.transform[5] - costTableTop;
    assert.ok(
      costTitleGap >= 9,
      `Expected >= 9pt baseline-to-border gap below Rincian Biaya Pekerjaan title, got ${costTitleGap.toFixed(2)}pt`
    );

    // 3) Verify Konsiderans and section-label headings are 11pt
    const konsideransPage = await loaded.getPage(anchorPages['recitals']);
    const konsideransItems = (await konsideransPage.getTextContent()).items.filter(
      (it): it is { str: string; transform: number[] } & typeof it =>
        'str' in it && 'transform' in it && it.str.trim().length > 0
    );
    const konsideransHeading = konsideransItems.find((it) => it.str.includes('KONSIDERANS'));
    assert.ok(konsideransHeading, 'Konsiderans heading should render');
    assert.equal(
      Number(konsideransHeading.transform[0].toFixed(1)),
      11,
      'Konsiderans heading should be 11pt'
    );
    assert.equal(
      Number(p2Heading.transform[0].toFixed(1)),
      11,
      'Section label (1. PIHAK PERTAMA) should be 11pt'
    );
  } finally {
    await loaded.cleanup();
  }
});




