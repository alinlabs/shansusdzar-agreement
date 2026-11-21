import { PDFDocument, PDFString, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import type { InvoiceDocument } from '../types/invoice';
import { formatIDR } from '../utils/currency';
import { formatDateTimeID, formatIndonesianDate } from '../utils/date';
import { tokenizeLineIntoStyledWords } from '../utils/englishTerms';
import { computeInvoiceSummary } from '../utils/invoiceLogic';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  drawAlinLabsStampAndSignature,
  drawStyledLine,
  measurePdfDrawnWidth,
  sanitizeWinAnsi,
  SIGNATURE_AREA_HEIGHT_PT,
  wrapStyledTextWords,
  type PdfGenerationOutput,
  type StrikeStyle,
} from './pdfEngine';
import { loadAlinLabsPdfAssets } from './pdfAssetLoader';

export const INVOICE_TOC_ITEMS = [
  { id: 'inv-header', label: 'Identitas & Informasi Penawaran' },
  { id: 'inv-items', label: 'Rincian Penawaran Pekerjaan' },
  { id: 'inv-payment', label: 'Metode & Tahap Pembayaran' },
  { id: 'inv-auth', label: 'Pengesahan Penerbit Penawaran' },
  { id: 'inv-addons', label: 'Lampiran Penawaran Eksklusif' },
];

// Modern A4 Editorial Margins (lebih lega & kontemporer dibandingkan margin legal 4-4-3-3 cm)
const MODERN_MARGIN_LR = 46;
const MODERN_MARGIN_TOP = 44;
const MODERN_MARGIN_BOTTOM = 54;
const MODERN_CONTENT_WIDTH = A4_WIDTH_PT - MODERN_MARGIN_LR * 2; // 503.28 pt

// Corporate Modern Color Palette
const COLOR_INK = rgb(0.07, 0.1, 0.17); // #121A2B Deep Slate
const COLOR_BODY = rgb(0.18, 0.22, 0.3); // #2E384D Soft Charcoal
const COLOR_MUTED = rgb(0.42, 0.48, 0.57); // #6B7A91 Muted Slate
const COLOR_ACCENT = rgb(0.11, 0.31, 0.72); // #1C4FB8 Royal Corporate Blue
const COLOR_ACCENT_SOFT = rgb(0.94, 0.96, 1.0); // #F0F5FF Soft Ice Blue
const COLOR_ACCENT_BORDER = rgb(0.76, 0.84, 0.96); // #C2D6F5 Soft Blue Rule
const COLOR_SURFACE = rgb(0.97, 0.98, 0.99); // #F8FAFC Off-white Card
const COLOR_HAIRLINE = rgb(0.87, 0.9, 0.94); // #DEE6F0 Crisp Hairline
const COLOR_STRIKE_RED = rgb(0.84, 0.13, 0.15); // #D62126 Red Diagonal Strikethrough
const COLOR_WHITE = rgb(1, 1, 1);

export async function generateInvoicePdfBytes(invoice: InvoiceDocument): Promise<PdfGenerationOutput> {
  const summary = computeInvoiceSummary(invoice);
  const assets = await loadAlinLabsPdfAssets();
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(`Surat Penawaran Resmi (Quotation) - ${sanitizeWinAnsi(invoice.invoiceNumber)}`);
  pdfDoc.setAuthor('AlinLabs Indonesia — Commercial & Quotation');
  pdfDoc.setSubject(sanitizeWinAnsi(invoice.projectName || 'Penawaran Pengembangan Website'));
  pdfDoc.setCreator('Alin Labs Document Engineering Engine');
  pdfDoc.setProducer('Alin Labs PDF Engine (pdf-lib)');
  pdfDoc.setCreationDate(new Date());

  // Clean Modern Sans-Serif Typography (distinct from formal legal TimesRoman contract)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const pages: PDFPage[] = [];
  const anchorPages: Record<string, number> = {};
  let page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  pages.push(page);
  let cursorY = A4_HEIGHT_PT - MODERN_MARGIN_TOP;

  const recordAnchor = (anchorId?: string) => {
    if (anchorId && anchorPages[anchorId] === undefined) {
      anchorPages[anchorId] = pages.length;
    }
  };

  const drawPageTopAccent = (targetPage: PDFPage) => {
    targetPage.drawRectangle({
      x: 0,
      y: A4_HEIGHT_PT - 4,
      width: A4_WIDTH_PT,
      height: 4,
      color: COLOR_ACCENT,
    });
  };

  drawPageTopAccent(page);

  const newPage = () => {
    page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    pages.push(page);
    drawPageTopAccent(page);
    cursorY = A4_HEIGHT_PT - MODERN_MARGIN_TOP;
  };

  const ensureSpace = (neededPt: number) => {
    if (cursorY - neededPt < MODERN_MARGIN_BOTTOM) {
      newPage();
    }
  };

  const drawStyledSingleLine = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    options: {
      bold?: boolean;
      forceItalic?: boolean;
      align?: 'left' | 'center' | 'right';
      color?: ReturnType<typeof rgb>;
      italicizeEnglish?: boolean;
    } = {}
  ) => {
    const rFont = options.bold ? fontBold : fontRegular;
    const iFont = options.bold ? fontBoldItalic : fontItalic;
    const words = tokenizeLineIntoStyledWords(
      sanitizeWinAnsi(text),
      Boolean(options.forceItalic),
      options.italicizeEnglish ?? true
    );
    drawStyledLine(
      page,
      words,
      x,
      y,
      maxWidth,
      rFont,
      iFont,
      fontSize,
      options.align ?? 'left',
      true,
      options.color ?? COLOR_INK,
      fontBold,
      fontBoldItalic
    );
  };

  const drawSectionHeader = (
    kicker: string,
    title: string,
    options: { align?: 'left' | 'center' } = {}
  ) => {
    const cleanKicker = kicker.trim();
    const align = options.align ?? 'left';
    ensureSpace(cleanKicker ? 44 : 32);
    if (cleanKicker) {
      drawStyledSingleLine(cleanKicker.toUpperCase(), MODERN_MARGIN_LR, cursorY, MODERN_CONTENT_WIDTH, 7.6, {
        bold: true,
        align,
        color: COLOR_ACCENT,
        italicizeEnglish: false,
      });
      cursorY -= 13;
    } else {
      cursorY -= 2;
    }
    drawStyledSingleLine(title, MODERN_MARGIN_LR, cursorY, MODERN_CONTENT_WIDTH, 11.5, {
      bold: true,
      align,
      color: COLOR_INK,
      italicizeEnglish: true,
    });
    cursorY -= 7;
    page.drawLine({
      start: { x: MODERN_MARGIN_LR, y: cursorY },
      end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: cursorY },
      thickness: 0.75,
      color: COLOR_HAIRLINE,
    });
    cursorY -= 12;
  };

  type ModernTableRow = {
    cells: string[];
    boldRow?: boolean;
    highlightRow?: boolean;
    mutedColumns?: number[];
  };

  const drawModernHairlineTable = (
    cols: {
      header: string;
      widthRatio: number;
      align: 'left' | 'center' | 'right';
      cellAlign?: 'left' | 'center' | 'right' | 'justify';
    }[],
    rowsToDraw: ModernTableRow[],
    options: {
      padX?: number;
      padY?: number;
      passBoldFonts?: boolean;
      repeatHeaderOnBreak?: boolean;
      strikeStyle?: StrikeStyle;
      inkColumns?: number[];
      secondaryLineMutedColumns?: number[];
    } = {}
  ) => {
    const widths = cols.map((c) => c.widthRatio * MODERN_CONTENT_WIDTH);
    const padX = options.padX ?? 6;
    const padY = options.padY ?? 4.5;
    const lineH = 11.4;
    const headerH = 21;
    const minSliceHeight = lineH + padY * 2 - 2;

    const drawHeader = () => {
      ensureSpace(headerH + 24);
      const topY = cursorY + 10;
      const bottomY = topY - headerH;
      page.drawRectangle({
        x: MODERN_MARGIN_LR,
        y: bottomY,
        width: MODERN_CONTENT_WIDTH,
        height: headerH,
        color: COLOR_ACCENT,
      });

      let hx = MODERN_MARGIN_LR;
      cols.forEach((col, ci) => {
        const w = widths[ci];
        drawStyledSingleLine(col.header.toUpperCase(), hx + padX, topY - 13.5, w - padX * 2, 7.6, {
          bold: true,
          align: col.align,
          color: COLOR_WHITE,
          italicizeEnglish: false,
        });
        hx += w;
      });
      cursorY -= headerH;
    };

    drawHeader();

    rowsToDraw.forEach((row, rowIdx) => {
      const rFont = row.boldRow || row.highlightRow ? fontBold : fontRegular;
      const iFont = row.boldRow || row.highlightRow ? fontBoldItalic : fontItalic;
      const wrappedResults = row.cells.map((cell, ci) =>
        wrapStyledTextWords(
          cell,
          rFont,
          iFont,
          8.8,
          widths[ci] - padX * 2,
          false,
          options.passBoldFonts ? fontBold : rFont,
          options.passBoldFonts ? fontBoldItalic : iFont
        )
      );
      const wrappedCells = wrappedResults.map((r) => r.lines);
      const maxLines = Math.max(1, ...wrappedCells.map((c) => c.length));

      const fullRowHeight = maxLines * lineH + padY * 2 - 2;
      const maxUsablePageHeight = A4_HEIGHT_PT - MODERN_MARGIN_TOP - MODERN_MARGIN_BOTTOM - headerH - 8;

      let startLine = 0;
      while (startLine < maxLines) {
        let topY = cursorY + 10;
        let availHeight = topY - MODERN_MARGIN_BOTTOM;
        let drewContinuationTopBorder = false;

        const needsAtomicBreak =
          startLine === 0 && fullRowHeight <= maxUsablePageHeight && availHeight < fullRowHeight;

        if (availHeight < minSliceHeight || needsAtomicBreak) {
          newPage();
          if (options.repeatHeaderOnBreak) {
            drawHeader();
          } else {
            drewContinuationTopBorder = true;
          }
          topY = cursorY + 10;
          availHeight = topY - MODERN_MARGIN_BOTTOM;
        }

        const maxFit = Math.max(1, Math.floor((availHeight - (padY * 2 - 2)) / lineH));
        const linesInSlice = Math.min(maxLines - startLine, maxFit);
        const endLine = startLine + linesInSlice;
        const sliceHeight = linesInSlice * lineH + padY * 2 - 2;
        const bottomY = topY - sliceHeight;

        const rowFill = row.highlightRow
          ? COLOR_ACCENT_SOFT
          : row.boldRow
            ? COLOR_SURFACE
            : rowIdx % 2 === 1
              ? rgb(0.988, 0.992, 0.996)
              : undefined;

        if (rowFill) {
          page.drawRectangle({
            x: MODERN_MARGIN_LR,
            y: bottomY,
            width: MODERN_CONTENT_WIDTH,
            height: sliceHeight,
            color: rowFill,
          });
        }

        if (drewContinuationTopBorder && !row.highlightRow) {
          page.drawLine({
            start: { x: MODERN_MARGIN_LR, y: topY },
            end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: topY },
            thickness: 0.45,
            color: COLOR_HAIRLINE,
          });
        }

        if (row.highlightRow) {
          page.drawLine({
            start: { x: MODERN_MARGIN_LR, y: topY },
            end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: topY },
            thickness: 0.9,
            color: COLOR_ACCENT,
          });
          page.drawLine({
            start: { x: MODERN_MARGIN_LR, y: bottomY },
            end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: bottomY },
            thickness: 1.1,
            color: COLOR_ACCENT,
          });
        } else {
          page.drawLine({
            start: { x: MODERN_MARGIN_LR, y: bottomY },
            end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: bottomY },
            thickness: 0.45,
            color: COLOR_HAIRLINE,
          });
        }

        let rx = MODERN_MARGIN_LR;
        wrappedCells.forEach((cellLines, ci) => {
          const w = widths[ci];
          const align = cols[ci].cellAlign ?? cols[ci].align;
          const paraEnds = wrappedResults[ci].isParagraphEnd;
          const isMutedCol = row.mutedColumns?.includes(ci) ?? false;
          const isInkCol = options.inkColumns?.includes(ci) ?? false;
          const isSecondaryLineMuted = options.secondaryLineMutedColumns?.includes(ci) ?? false;
          const baseCellColor = row.highlightRow
            ? ci === cols.length - 1 || ci === 1
              ? COLOR_ACCENT
              : COLOR_INK
            : isMutedCol
              ? COLOR_MUTED
              : isInkCol
                ? COLOR_INK
                : COLOR_BODY;

          for (let li = startLine; li < endLine; li++) {
            const words = cellLines[li];
            if (!words || words.length === 0) continue;
            const localIdx = li - startLine;
            const lineColor = isSecondaryLineMuted && li > 0 ? COLOR_MUTED : baseCellColor;
            drawStyledLine(
              page,
              words,
              rx + padX,
              topY - padY - 8.5 - localIdx * lineH,
              w - padX * 2,
              rFont,
              iFont,
              8.8,
              align,
              paraEnds[li] ?? true,
              lineColor,
              options.passBoldFonts ? fontBold : rFont,
              options.passBoldFonts ? fontBoldItalic : iFont,
              options.strikeStyle,
              align === 'justify' ? 10 : undefined
            );
          }
          rx += w;
        });

        cursorY -= sliceHeight;
        startLine = endLine;
      }
    });
  };

  // ============================================================================
  // 1. MODERN ASYMMETRIC TOP HEADER (Halaman 1 — 1 Logo Image)
  // ============================================================================
  recordAnchor('inv-header');

  const issueFormatted = invoice.issueDate
    ? formatIndonesianDate(invoice.issueDate)
    : '........................................';
  const dueFormatted = invoice.dueDate
    ? formatIndonesianDate(invoice.dueDate)
    : '7 (tujuh) hari kalender sejak tanggal penawaran diterima';

  const headerTopY = cursorY + 8;

  // Left Brand Identity (Logo + Company Meta)
  let brandTextX = MODERN_MARGIN_LR;
  if (assets.logoPng) {
    try {
      const logoImg = await pdfDoc.embedPng(assets.logoPng);
      const dims = logoImg.scaleToFit(42, 42);
      page.drawImage(logoImg, {
        x: MODERN_MARGIN_LR,
        y: headerTopY - dims.height - 2,
        width: dims.width,
        height: dims.height,
      });
      brandTextX = MODERN_MARGIN_LR + dims.width + 11;
    } catch {
      // Skip invalid logo gracefully
    }
  }

  const issuerBrandName = sanitizeWinAnsi(
    (invoice.issuer.commercialName || invoice.issuer.legalName || 'ALINLABS INDONESIA').toUpperCase()
  );
  page.drawText(issuerBrandName, {
    x: brandTextX,
    y: headerTopY - 14,
    size: 14,
    font: fontBold,
    color: COLOR_ACCENT,
  });
  page.drawText('Agency & Digital Solution Ecosystem', {
    x: brandTextX,
    y: headerTopY - 25.5,
    size: 7.8,
    font: fontRegular,
    color: COLOR_MUTED,
  });
  page.drawText(
    sanitizeWinAnsi(`${invoice.issuer.phone}  |  ${invoice.issuer.email}`),
    {
      x: brandTextX,
      y: headerTopY - 36,
      size: 7.8,
      font: fontRegular,
      color: COLOR_MUTED,
    }
  );
  page.drawText('www.alinlabs.biz.id  |  Kab. Purwakarta, Jawa Barat', {
    x: brandTextX,
    y: headerTopY - 46,
    size: 7.8,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  // Right Document Title & Quotation Number (Right-Aligned Executive Header)
  const rightColW = 228;
  const rightColX = A4_WIDTH_PT - MODERN_MARGIN_LR - rightColW;

  drawStyledSingleLine('Proposal & Quotation Komersial', rightColX, headerTopY - 8, rightColW, 7.8, {
    bold: false,
    align: 'right',
    color: COLOR_MUTED,
    italicizeEnglish: false,
  });
  // Exact 14pt bold blue heading preserved cleanly on Page 1
  drawStyledSingleLine('SURAT PENAWARAN', rightColX, headerTopY - 23.5, rightColW, 14, {
    bold: true,
    align: 'right',
    color: COLOR_ACCENT,
    italicizeEnglish: false,
  });
  drawStyledSingleLine(`Nomor: ${invoice.invoiceNumber}`, rightColX, headerTopY - 35.5, rightColW, 7.8, {
    bold: false,
    align: 'right',
    color: COLOR_MUTED,
    italicizeEnglish: false,
  });
  drawStyledSingleLine(
    `Terbit: ${invoice.city || 'Purwakarta'}, ${issueFormatted}`,
    rightColX,
    headerTopY - 45.5,
    rightColW,
    7.8,
    { bold: false, align: 'right', color: COLOR_MUTED, italicizeEnglish: false }
  );

  cursorY = headerTopY - 78;

  // ============================================================================
  // 2. PROJECT HERO BANNER (Clean Modern Accent Bar + Soft Tint)
  // ============================================================================
  const heroHeight = 52;
  const heroBottomY = cursorY - heroHeight + 10;
  page.drawRectangle({
    x: MODERN_MARGIN_LR,
    y: heroBottomY,
    width: MODERN_CONTENT_WIDTH,
    height: heroHeight,
    color: COLOR_ACCENT_SOFT,
    borderColor: COLOR_ACCENT_BORDER,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: MODERN_MARGIN_LR,
    y: heroBottomY,
    width: 3.5,
    height: heroHeight,
    color: COLOR_ACCENT,
  });

  drawStyledSingleLine(
    'PENAWARAN',
    MODERN_MARGIN_LR + 12,
    heroBottomY + heroHeight - 13,
    MODERN_CONTENT_WIDTH - 24,
    7.4,
    { bold: true, color: COLOR_ACCENT, italicizeEnglish: false }
  );
  // Exact 14pt bold service heading preserved cleanly on Page 1
  drawStyledSingleLine(
    'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE',
    MODERN_MARGIN_LR + 12,
    heroBottomY + heroHeight - 29,
    MODERN_CONTENT_WIDTH - 24,
    14,
    { bold: true, color: COLOR_INK, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `Interior Design & Building ${invoice.recipient.legalName || 'Shansus Dzar Indonesia'}`,
    MODERN_MARGIN_LR + 12,
    heroBottomY + 10,
    MODERN_CONTENT_WIDTH - 24,
    8.5,
    { color: COLOR_BODY, italicizeEnglish: false }
  );

  cursorY = heroBottomY - 14;

  // ============================================================================
  // 3. SIDE-BY-SIDE ISSUER & RECIPIENT CARDS + QUOTATION META STRIP
  // ============================================================================
  const cardGap = 12;
  const cardW = (MODERN_CONTENT_WIDTH - cardGap) / 2;
  const cardPad = 10;

  const formatShortRole = (title?: string): string => {
    const clean = (title || '').trim();
    if (!clean) return 'Pemilik Usaha';
    if (/^pemilik usaha\b/i.test(clean)) return 'Pemilik Usaha';
    return clean;
  };

  const drawPartyCard = (
    x: number,
    topY: number,
    height: number,
    kicker: string,
    companyName: string,
    picLine: string,
    combinedContactAddress: string
  ) => {
    const bottomY = topY - height;
    const innerW = cardW - cardPad * 2;
    page.drawRectangle({
      x,
      y: bottomY,
      width: cardW,
      height,
      color: COLOR_WHITE,
      borderColor: COLOR_HAIRLINE,
      borderWidth: 0.7,
    });

    const drawClampedCenteredLine = (
      text: string,
      lineY: number,
      baseSize: number,
      options: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}
    ) => {
      const fontForMeasure = options.bold ? fontBold : fontRegular;
      const cleanText = sanitizeWinAnsi(text);
      const naturalW = measurePdfDrawnWidth(fontForMeasure, cleanText, baseSize);
      const fittedSize = naturalW > innerW ? Math.max(6.2, (baseSize * innerW * 0.98) / naturalW) : baseSize;
      drawStyledSingleLine(text, x + cardPad, lineY, innerW, fittedSize, {
        bold: options.bold,
        align: 'center',
        color: options.color,
        italicizeEnglish: false,
      });
    };

    let y = topY - 14;
    drawClampedCenteredLine(kicker, y, 7.6, {
      bold: true,
      color: COLOR_ACCENT,
    });
    y -= 13;
    drawClampedCenteredLine(companyName, y, 10, {
      bold: true,
      color: COLOR_INK,
    });
    y -= 12;
    drawClampedCenteredLine(picLine, y, 8.2, {
      color: COLOR_BODY,
    });
    y -= 12.5;

    let infoFontSize = 7.7;
    let infoWrapped = wrapStyledTextWords(
      combinedContactAddress,
      fontRegular,
      fontItalic,
      infoFontSize,
      innerW,
      false,
      fontBold,
      fontBoldItalic,
      false
    ).lines;
    if (infoWrapped.length > 3) {
      infoFontSize = 6.9;
      infoWrapped = wrapStyledTextWords(
        combinedContactAddress,
        fontRegular,
        fontItalic,
        infoFontSize,
        innerW,
        false,
        fontBold,
        fontBoldItalic,
        false
      ).lines.slice(0, 3);
    }

    for (const w of infoWrapped) {
      drawStyledLine(
        page,
        w,
        x + cardPad,
        y,
        innerW,
        fontRegular,
        fontItalic,
        infoFontSize,
        'center',
        true,
        COLOR_MUTED
      );
      y -= 10;
    }
  };

  const cardsTopY = cursorY + 6;
  const partyCardHeight = 84;
  const issuerCombinedInfo = [invoice.issuer.phone, invoice.issuer.email, invoice.issuer.address]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');
  const recipientCombinedInfo = [invoice.recipient.phone, invoice.recipient.email, invoice.recipient.address]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');

  drawPartyCard(
    MODERN_MARGIN_LR,
    cardsTopY,
    partyCardHeight,
    'Dari',
    invoice.issuer.legalName || 'AlinLabs Indonesia',
    `${invoice.issuer.directorName} (${formatShortRole(invoice.issuer.directorTitle)})`,
    issuerCombinedInfo
  );
  drawPartyCard(
    MODERN_MARGIN_LR + cardW + cardGap,
    cardsTopY,
    partyCardHeight,
    'Kepada',
    invoice.recipient.legalName,
    `${invoice.recipient.directorName} (${formatShortRole(invoice.recipient.directorTitle)})`,
    recipientCombinedInfo
  );

  cursorY = cardsTopY - partyCardHeight - 16;

  // ============================================================================
  // 4. RINCIAN PENAWARAN PEKERJAAN (Hairline Commercial Table)
  // ============================================================================
  recordAnchor('inv-items');
  drawSectionHeader('', 'Rincian Penawaran Pekerjaan & Investasi', { align: 'center' });

  const itemColumns = [
    { header: 'No', widthRatio: 0.06, align: 'center' as const },
    { header: 'Komponen Pekerjaan', widthRatio: 0.24, align: 'left' as const },
    {
      header: 'Rincian & Keterangan',
      widthRatio: 0.36,
      align: 'left' as const,
      cellAlign: 'justify' as const,
    },
    { header: 'Harga Normal', widthRatio: 0.17, align: 'right' as const },
    { header: 'Harga Promo', widthRatio: 0.17, align: 'right' as const },
  ];

  const summarizeItemText = (desc: string, note?: string): string => {
    const clean = (desc || '-').replace(/\s+/g, ' ').trim();
    const primaryClause = clean.split(/;\s+|(?<=[.!?])\s+/)[0] || clean;
    const withoutParenPpn = primaryClause.replace(/\s*\(kena PPN\s*\d+%\)\.?\s*$/i, '').trim();
    const clipped =
      withoutParenPpn.length > 136
        ? `${withoutParenPpn.slice(0, 132).replace(/\s+\S*$/, '')}...`
        : withoutParenPpn;
    const shortNote = note ? ` [${note}]` : '';
    return `${clipped}${shortNote}`;
  };

  const itemRows: ModernTableRow[] = summary.effectiveCostItems.map((item, idx) => {
    const isDiscounted = Boolean(item.originalAmount && item.originalAmount > item.amount);
    const normalRaw =
      item.originalAmount && item.originalAmount > 0
        ? formatIDR(item.originalAmount)
        : item.amount > 0
          ? formatIDR(item.amount)
          : '-';
    const normalDisplay = isDiscounted ? `~~${normalRaw}~~` : normalRaw;

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

    return {
      cells: [
        String(idx + 1),
        item.itemName || '-',
        summarizeItemText(item.description, item.note),
        normalDisplay,
        promoDisplay,
      ],
    };
  });

  const normalSubtotal = summary.effectiveCostItems.reduce((sum, item) => {
    const normalVal =
      item.originalAmount && item.originalAmount > 0
        ? item.originalAmount
        : item.amount > 0
          ? item.amount
          : 0;
    return sum + normalVal;
  }, 0);

  drawModernHairlineTable(itemColumns, itemRows, {
    padX: 6,
    padY: 4.2,
    passBoldFonts: true,
    repeatHeaderOnBreak: false,
    strikeStyle: { color: COLOR_STRIKE_RED, angleDeg: 7.5, thickness: 0.85 },
    inkColumns: [4],
    secondaryLineMutedColumns: [4],
  });

  // Ringkasan Total non-tabel & tanpa deskripsi (Harga Penawaran, Potongan, PPN, Total Penawaran)
  const hargaPenawaran =
    normalSubtotal > summary.dppSubtotal ? normalSubtotal : summary.dppSubtotal;
  const potonganHarga = Math.max(0, hargaPenawaran - summary.dppSubtotal);
  const summaryLines = [
    {
      label: 'Harga Penawaran',
      value: summary.hasNumericAmount ? formatIDR(hargaPenawaran) : 'Rp ......................',
      isTotal: false,
    },
    {
      label: 'Potongan',
      value: summary.hasNumericAmount
        ? potonganHarga > 0
          ? `- ${formatIDR(potonganHarga)}`
          : formatIDR(0)
        : '-',
      isTotal: false,
    },
    {
      label: 'PPN',
      value: summary.hasNumericAmount ? formatIDR(summary.ppnAmount) : '-',
      isTotal: false,
    },
    {
      label: 'Total Penawaran',
      value: summary.hasNumericAmount ? formatIDR(summary.contractSubtotal) : 'Rp ......................',
      isTotal: true,
    },
  ];

  const summaryCol2StartX = MODERN_MARGIN_LR + itemColumns[0].widthRatio * MODERN_CONTENT_WIDTH;
  const summaryLabelX = summaryCol2StartX + 6;
  const summaryRightEdgeX = MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH - 6;
  const summaryValueW = 160;
  const summaryValueX = summaryRightEdgeX - summaryValueW;
  const summaryLabelW = summaryValueX - summaryLabelX - 10;
  const summaryRowStep = 16;
  const neededSummaryH = summaryLines.length * summaryRowStep + 20;
  ensureSpace(neededSummaryH);

  cursorY -= 6;
  summaryLines.forEach((entry) => {
    if (entry.isTotal) {
      page.drawLine({
        start: { x: summaryCol2StartX, y: cursorY + 11 },
        end: { x: MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH, y: cursorY + 11 },
        thickness: 0.75,
        color: COLOR_INK,
      });
      cursorY -= 4;
    }

    drawStyledSingleLine(
      entry.label,
      summaryLabelX,
      cursorY,
      summaryLabelW,
      9,
      {
        bold: entry.isTotal,
        color: entry.isTotal ? COLOR_INK : COLOR_BODY,
        italicizeEnglish: false,
      }
    );
    drawStyledSingleLine(
      entry.value,
      summaryValueX,
      cursorY,
      summaryValueW,
      9,
      {
        bold: entry.isTotal || entry.label === 'Harga Penawaran',
        align: 'right',
        color:
          entry.label === 'Potongan' && potonganHarga > 0
            ? COLOR_MUTED
            : COLOR_INK,
        italicizeEnglish: false,
      }
    );

    cursorY -= summaryRowStep;
  });

  cursorY -= 10;

  // ============================================================================
  // 5. METODE & TAHAP PEMBAYARAN
  // ============================================================================
  recordAnchor('inv-payment');
  drawSectionHeader('', 'Metode & Tahap Pembayaran', { align: 'center' });

  const isDpActive = invoice.terminMode === 'TERMIN_1_DP';
  const isPelunasanActive = invoice.terminMode === 'TERMIN_2_PELUNASAN';
  const dpAmount = invoice.terminSchedule?.[0]?.amount ?? 700_000;
  const dpPct = invoice.terminSchedule?.[0]?.percentage ?? 37.74;
  const finalAmount =
    invoice.terminSchedule?.[1]?.amount ??
    Math.max(0, (summary.hasNumericAmount ? summary.contractSubtotal : 1_855_000) - dpAmount);
  const finalPct = invoice.terminSchedule?.[1]?.percentage ?? 62.26;

  // Full-width Official Bank Account Card with transparent SeaBank logo (Page 2)
  const payCardH = 66;
  ensureSpace(payCardH + 14);
  const payTopY = cursorY + 4;
  const payBottomY = payTopY - payCardH;

  page.drawRectangle({
    x: MODERN_MARGIN_LR,
    y: payBottomY,
    width: MODERN_CONTENT_WIDTH,
    height: payCardH,
    borderColor: COLOR_HAIRLINE,
    borderWidth: 0.7,
  });

  const bankNameDisplay = invoice.bankInfo.bankName || 'SeaBank';
  const showSeabankLogo = Boolean(assets.seabankLogoPng && /seabank/i.test(bankNameDisplay));
  let bankLogoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (showSeabankLogo && assets.seabankLogoPng) {
    try {
      bankLogoImage = await pdfDoc.embedPng(assets.seabankLogoPng);
    } catch {
      bankLogoImage = null;
    }
  }

  let bankTextX = MODERN_MARGIN_LR + 16;
  if (bankLogoImage) {
    const logoSlotX = MODERN_MARGIN_LR + 16;
    const maxImgW = 104;
    const maxImgH = 34;
    const scale = Math.min(maxImgW / bankLogoImage.width, maxImgH / bankLogoImage.height);
    const drawW = bankLogoImage.width * scale;
    const drawH = bankLogoImage.height * scale;
    page.drawImage(bankLogoImage, {
      x: logoSlotX,
      y: payBottomY + (payCardH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
    bankTextX = logoSlotX + drawW + 20;
  }

  const bankTextMaxW = MODERN_MARGIN_LR + MODERN_CONTENT_WIDTH - bankTextX - 16;
  drawStyledSingleLine(
    'REKENING TRANSFER RESMI PENERBIT',
    bankTextX,
    payTopY - 15,
    bankTextMaxW,
    7.2,
    { bold: true, color: COLOR_MUTED, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    'TRANSFER ANTARBANK / BI-FAST',
    bankTextX,
    payTopY - 15,
    bankTextMaxW,
    6.8,
    { bold: true, align: 'right', color: COLOR_MUTED, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `${bankNameDisplay}  --  ${invoice.bankInfo.accountNumber || '901387277710'}`,
    bankTextX,
    payTopY - 34,
    bankTextMaxW,
    13,
    { bold: true, color: COLOR_INK, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `a.n. ${invoice.bankInfo.accountHolder || invoice.issuer.directorName}  |  ${invoice.bankInfo.accountRole || 'Finance AlinLabs Indonesia'}`,
    bankTextX,
    payBottomY + 13,
    bankTextMaxW,
    8.5,
    { bold: true, color: COLOR_BODY, italicizeEnglish: false }
  );

  cursorY = payBottomY - 12;

  // 3-Column Commercial KPI Cards (directly below full-width Bank Account card)
  const kpiGap = 8;
  const kpiW = (MODERN_CONTENT_WIDTH - kpiGap * 2) / 3;
  const kpiH = 48;
  ensureSpace(kpiH + 8);
  const kpiBottomY = cursorY - kpiH + 4;

  const kpis = [
    {
      label: 'TOTAL NILAI PENAWARAN',
      value: summary.hasNumericAmount ? formatIDR(summary.contractSubtotal) : 'Rp 1.855.000',
      sub: `DPP ${formatIDR(summary.dppSubtotal)} + PPN ${summary.ppnPercentage}% Infra`,
      active: invoice.terminMode === 'FULL_100',
    },
    {
      label: `PEMBAYARAN I  |  DP (${dpPct}%)`,
      value: formatIDR(dpAmount),
      sub: 'Saat persetujuan penawaran / PKS',
      active: isDpActive,
    },
    {
      label: `PEMBAYARAN II  |  PELUNASAN (${finalPct}%)`,
      value: formatIDR(finalAmount),
      sub: 'Setelah tester sebelum deploy lengkap',
      active: isPelunasanActive,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = MODERN_MARGIN_LR + idx * (kpiW + kpiGap);
    page.drawRectangle({
      x: kx,
      y: kpiBottomY,
      width: kpiW,
      height: kpiH,
      color: kpi.active ? COLOR_ACCENT_SOFT : COLOR_SURFACE,
      borderColor: kpi.active ? COLOR_ACCENT : COLOR_HAIRLINE,
      borderWidth: kpi.active ? 0.9 : 0.5,
    });
    drawStyledSingleLine(kpi.label, kx + 9, kpiBottomY + kpiH - 13, kpiW - 18, 6.9, {
      bold: true,
      color: kpi.active ? COLOR_ACCENT : COLOR_MUTED,
      italicizeEnglish: false,
    });
    drawStyledSingleLine(kpi.value, kx + 9, kpiBottomY + kpiH - 29, kpiW - 18, 12.2, {
      bold: true,
      color: kpi.active ? COLOR_ACCENT : COLOR_INK,
      italicizeEnglish: false,
    });
    drawStyledSingleLine(kpi.sub, kx + 9, kpiBottomY + 7.5, kpiW - 18, 7.2, {
      color: COLOR_MUTED,
      italicizeEnglish: false,
    });
  });

  cursorY = kpiBottomY - 14;

  // Modern Callout Blocks for Tax Note & Payment Notes
  const drawCalloutBlock = (heading: string, body: string) => {
    const cleanBody = (body || '').trim();
    if (!cleanBody) return;
    const wrappedResult = wrapStyledTextWords(
      cleanBody,
      fontRegular,
      fontItalic,
      8.7,
      MODERN_CONTENT_WIDTH - 22,
      false,
      fontBold,
      fontBoldItalic
    );
    const wrapped = wrappedResult.lines;
    const isParagraphEnd = wrappedResult.isParagraphEnd;
    const lineH = 12.2;
    const blockH = wrapped.length * lineH + 26;

    ensureSpace(blockH + 6);
    const topY = cursorY + 6;
    const bottomY = topY - blockH;

    page.drawRectangle({
      x: MODERN_MARGIN_LR,
      y: bottomY,
      width: MODERN_CONTENT_WIDTH,
      height: blockH,
      color: COLOR_SURFACE,
      borderColor: COLOR_HAIRLINE,
      borderWidth: 0.5,
    });
    page.drawRectangle({
      x: MODERN_MARGIN_LR,
      y: bottomY,
      width: 2.5,
      height: blockH,
      color: COLOR_ACCENT,
    });

    drawStyledSingleLine(heading.toUpperCase(), MODERN_MARGIN_LR + 12, topY - 12.5, MODERN_CONTENT_WIDTH - 22, 7.6, {
      bold: true,
      color: COLOR_ACCENT,
      italicizeEnglish: false,
    });

    let lineY = topY - 25;
    for (let li = 0; li < wrapped.length; li++) {
      const words = wrapped[li];
      if (words.length > 0) {
        drawStyledLine(
          page,
          words,
          MODERN_MARGIN_LR + 12,
          lineY,
          MODERN_CONTENT_WIDTH - 22,
          fontRegular,
          fontItalic,
          8.7,
          'justify',
          isParagraphEnd[li] ?? true,
          COLOR_BODY,
          fontBold,
          fontBoldItalic
        );
      }
      lineY -= lineH;
    }
    cursorY = bottomY - 10;
  };

  const conciseTaxLine =
    summary.ppnAmount > 0
      ? `PPN ${summary.ppnPercentage}% (${formatIDR(summary.ppnAmount)}) khusus komponen Domain, Hosting & Cloud; komponen jasa halaman tidak dikenakan PPN.`
      : '';
  const combinedNote = [conciseTaxLine, (invoice.notes || '').trim()].filter(Boolean).join(' ');
  drawCalloutBlock('Catatan Pajak & Pembayaran', combinedNote);

  // ============================================================================
  // 7. KARTU RINGKASAN & PENGESAHAN PENERBIT (Di bawah Metode & Tahap Pembayaran)
  // ============================================================================
  const signPanelH = 180;
  ensureSpace(signPanelH);
  recordAnchor('inv-auth');

  // Modern Signing Area (Left = Concise Executive Summary Card, Right = AlinLabs Official Stamp & Signature)
  const authLeftW = 240;
  const authRightW = 225;
  const authBoxX = A4_WIDTH_PT - MODERN_MARGIN_LR - authRightW;
  const signStartY = cursorY - 12;

  // Left subtle executive summary panel
  page.drawRectangle({
    x: MODERN_MARGIN_LR,
    y: signStartY - 132,
    width: authLeftW,
    height: 140,
    color: COLOR_SURFACE,
    borderColor: COLOR_HAIRLINE,
    borderWidth: 0.5,
  });
  drawStyledSingleLine(
    'RINGKASAN PENAWARAN RESMI',
    MODERN_MARGIN_LR + 12,
    signStartY - 8,
    authLeftW - 24,
    7.4,
    { bold: true, color: COLOR_ACCENT, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    invoice.recipient.legalName,
    MODERN_MARGIN_LR + 12,
    signStartY - 24,
    authLeftW - 24,
    10.2,
    { bold: true, color: COLOR_INK, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `No. Penawaran: ${invoice.invoiceNumber}`,
    MODERN_MARGIN_LR + 12,
    signStartY - 40,
    authLeftW - 24,
    8,
    { color: COLOR_BODY, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `Ref. Kontrak: ${invoice.contractNumber}`,
    MODERN_MARGIN_LR + 12,
    signStartY - 52,
    authLeftW - 24,
    8,
    { color: COLOR_MUTED, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `Total Investasi: ${summary.hasNumericAmount ? formatIDR(summary.contractSubtotal) : 'Rp 1.855.000'}`,
    MODERN_MARGIN_LR + 12,
    signStartY - 72,
    authLeftW - 24,
    8.6,
    { bold: true, color: COLOR_INK, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `Tahap 1 (DP): ${formatIDR(dpAmount)}  |  Tahap 2: ${formatIDR(finalAmount)}`,
    MODERN_MARGIN_LR + 12,
    signStartY - 85,
    authLeftW - 24,
    8,
    { color: COLOR_BODY, italicizeEnglish: false }
  );
  drawStyledSingleLine(
    `Berlaku hingga: ${dueFormatted}`,
    MODERN_MARGIN_LR + 12,
    signStartY - 110,
    authLeftW - 24,
    8,
    { color: COLOR_ACCENT, bold: true, italicizeEnglish: false }
  );

  // Right Official AlinLabs Signature & Stamp Block (2 images: Signature + Stamp)
  const placeDateText = sanitizeWinAnsi(`${invoice.city || 'Purwakarta'}, ${issueFormatted}`);
  drawStyledSingleLine(placeDateText, authBoxX, signStartY - 4, authRightW, 9.8, {
    color: COLOR_BODY,
    italicizeEnglish: false,
  });
  drawStyledSingleLine('Hormat Kami,', authBoxX, signStartY - 18, authRightW, 9.8, {
    color: COLOR_BODY,
    italicizeEnglish: false,
  });
  drawStyledSingleLine(
    invoice.issuer.commercialName || 'AlinLabs Indonesia',
    authBoxX,
    signStartY - 32,
    authRightW,
    10,
    { bold: true, color: COLOR_ACCENT, italicizeEnglish: false }
  );

  const sigBoxWidth = 205;
  const sigBoxHeight = SIGNATURE_AREA_HEIGHT_PT;
  const sigBoxBottomY = signStartY - 40 - sigBoxHeight;

  page.drawLine({
    start: { x: authBoxX, y: sigBoxBottomY },
    end: { x: authBoxX + sigBoxWidth, y: sigBoxBottomY },
    thickness: 0.75,
    color: COLOR_INK,
  });

  let infoY = sigBoxBottomY - 14;
  page.drawText(
    sanitizeWinAnsi(`Nama     : ${invoice.issuerSignerName || invoice.issuer.directorName}`),
    { x: authBoxX, y: infoY, size: 9.2, font: fontBold, color: COLOR_INK }
  );
  infoY -= 13;
  page.drawText(
    sanitizeWinAnsi(`Jabatan  : ${invoice.issuerSignerTitle || invoice.issuer.directorTitle}`),
    { x: authBoxX, y: infoY, size: 9, font: fontRegular, color: COLOR_BODY }
  );
  infoY -= 13;
  page.drawText(
    sanitizeWinAnsi(
      `Tanggal  : ${invoice.issuerSigned && invoice.issuerSignedAt ? formatDateTimeID(invoice.issuerSignedAt) : issueFormatted}`
    ),
    { x: authBoxX, y: infoY, size: 8.6, font: fontRegular, color: COLOR_MUTED }
  );

  await drawAlinLabsStampAndSignature(pdfDoc, page, assets, {
    boxX: authBoxX,
    boxBottomY: sigBoxBottomY,
    boxWidth: sigBoxWidth,
    boxHeight: sigBoxHeight,
    customSignatureDataUrl: invoice.issuerSigned ? invoice.issuerSignatureImageDataUrl : '',
  });

  // ============================================================================
  // 8. LAMPIRAN PENAWARAN TAMBAHAN EKSKLUSIF (Halaman Terpisah Terakhir)
  // ============================================================================
  const additionalOffers = invoice.additionalOffers ?? [];
  if (additionalOffers.length > 0) {
    newPage();
    recordAnchor('inv-addons');

    const recipientLabel = (invoice.recipient.legalName || 'SHANSUS DZAR INDONESIA').toUpperCase();
    const bannerH = 54;
    const bannerBottom = cursorY - bannerH + 8;

    page.drawRectangle({
      x: MODERN_MARGIN_LR,
      y: bannerBottom,
      width: MODERN_CONTENT_WIDTH,
      height: bannerH,
      color: COLOR_ACCENT_SOFT,
      borderColor: COLOR_ACCENT_BORDER,
      borderWidth: 0.6,
    });
    page.drawRectangle({
      x: MODERN_MARGIN_LR,
      y: bannerBottom,
      width: 3.5,
      height: bannerH,
      color: COLOR_ACCENT,
    });

    drawStyledSingleLine(
      `LAMPIRAN EKSKLUSIF  |  KHUSUS UNTUK ${recipientLabel}`,
      MODERN_MARGIN_LR + 12,
      bannerBottom + bannerH - 14,
      MODERN_CONTENT_WIDTH - 24,
      7.6,
      { bold: true, color: COLOR_ACCENT, italicizeEnglish: false }
    );
    drawStyledSingleLine(
      'LAMPIRAN PENAWARAN TAMBAHAN EKSKLUSIF',
      MODERN_MARGIN_LR + 12,
      bannerBottom + bannerH - 30,
      MODERN_CONTENT_WIDTH - 24,
      12.5,
      { bold: true, color: COLOR_INK, italicizeEnglish: false }
    );
    drawStyledSingleLine(
      'Layanan Pengembangan & Ekspansi Lanjutan (Opsional / Additional)',
      MODERN_MARGIN_LR + 12,
      bannerBottom + 9,
      MODERN_CONTENT_WIDTH - 24,
      8.5,
      { color: COLOR_BODY, italicizeEnglish: true }
    );

    cursorY = bannerBottom - 14;

    const introText = `Penawaran tarif khusus layanan tambahan opsional di luar kontrak utama (${invoice.contractNumber}), eksklusif bagi ${invoice.recipient.legalName || 'Shansus Dzar Indonesia'}.`;
    const introLines = wrapStyledTextWords(
      introText,
      fontRegular,
      fontItalic,
      8.9,
      MODERN_CONTENT_WIDTH,
      false,
      fontBold,
      fontBoldItalic
    ).lines;
    for (const words of introLines) {
      if (words.length === 0) continue;
      ensureSpace(12.5);
      drawStyledLine(
        page,
        words,
        MODERN_MARGIN_LR,
        cursorY,
        MODERN_CONTENT_WIDTH,
        fontRegular,
        fontItalic,
        8.9,
        'left',
        true,
        COLOR_BODY,
        fontBold,
        fontBoldItalic
      );
      cursorY -= 12.5;
    }
    cursorY -= 8;

    const addonColumns = [
      { header: 'No', widthRatio: 0.06, align: 'center' as const },
      { header: 'Layanan Eksklusif', widthRatio: 0.23, align: 'left' as const },
      {
        header: 'Rincian & Ketentuan',
        widthRatio: 0.35,
        align: 'left' as const,
        cellAlign: 'justify' as const,
      },
      { header: 'Harga Normal', widthRatio: 0.18, align: 'right' as const },
      { header: 'Harga Eksklusif', widthRatio: 0.18, align: 'right' as const },
    ];

    const addonTableRows: ModernTableRow[] = additionalOffers.map((offer, idx) => {
      const hasDiscount =
        offer.normalPriceLabel &&
        offer.offerPriceLabel &&
        offer.normalPriceLabel.trim() !== offer.offerPriceLabel.split('\n')[0].trim();
      return {
        cells: [
          String(idx + 1),
          offer.serviceName || '-',
          offer.description || '-',
          hasDiscount ? `~~${offer.normalPriceLabel}~~` : offer.normalPriceLabel || '-',
          offer.offerPriceLabel || '-',
        ],
        mutedColumns: hasDiscount ? [3] : undefined,
      };
    });

    drawModernHairlineTable(addonColumns, addonTableRows, {
      padX: 6,
      padY: 5.5,
      passBoldFonts: true,
      repeatHeaderOnBreak: false,
    });

    if (invoice.additionalOffersNote) {
      cursorY -= 14;
      drawCalloutBlock('Ketentuan Lampiran Eksklusif', invoice.additionalOffersNote);
    }
  }

  // ============================================================================
  // 9. CLEAN MODERN FOOTER ON ALL PAGES (Website Left + Email Right, Muted Gray)
  // ============================================================================
  const totalPages = pages.length;
  const footerLeftText = 'www.alinlabs.biz.id';
  const footerRightText = 'office.alincorporation@gmail.com';
  pages.forEach((p) => {
    const footerY = 30;

    p.drawLine({
      start: { x: MODERN_MARGIN_LR, y: footerY + 12 },
      end: { x: A4_WIDTH_PT - MODERN_MARGIN_LR, y: footerY + 12 },
      thickness: 0.5,
      color: COLOR_HAIRLINE,
    });

    p.drawText(footerLeftText, {
      x: MODERN_MARGIN_LR,
      y: footerY,
      size: 7.8,
      font: fontRegular,
      color: COLOR_MUTED,
    });

    const leftW = measurePdfDrawnWidth(fontRegular, footerLeftText, 7.8);
    const websiteLinkAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [MODERN_MARGIN_LR, footerY - 2, MODERN_MARGIN_LR + leftW, footerY + 9],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(`https://${footerLeftText}`),
      },
    });
    p.node.addAnnot(pdfDoc.context.register(websiteLinkAnnot));

    const rightW = measurePdfDrawnWidth(fontRegular, footerRightText, 7.8);
    const rightX = A4_WIDTH_PT - MODERN_MARGIN_LR - rightW;
    p.drawText(footerRightText, {
      x: rightX,
      y: footerY,
      size: 7.8,
      font: fontRegular,
      color: COLOR_MUTED,
    });

    const emailLinkAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [rightX, footerY - 2, rightX + rightW, footerY + 9],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(`mailto:${footerRightText}`),
      },
    });
    p.node.addAnnot(pdfDoc.context.register(emailLinkAnnot));
  });

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, pageCount: totalPages, anchorPages };
}
