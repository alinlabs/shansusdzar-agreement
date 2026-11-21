import { PDFDocument, PDFString, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ContractDocument } from '../types/contract';
import { buildLegalDocumentModel, type DataTableSummaryLine, type DocumentBlock } from './documentModel';
import { tokenizeLineIntoStyledWords, type StyledWord } from '../utils/englishTerms';
import { loadAlinLabsPdfAssets, type AlinLabsPdfAssets } from './pdfAssetLoader';
import { formatIndonesianDate } from '../utils/date';

// A4 Portrait Dimensions in PDF Points (1 mm = 2.83464567 pt, 1 cm = 28.3464567 pt)
export const A4_WIDTH_PT = 595.28; // 210 mm
export const A4_HEIGHT_PT = 841.89; // 297 mm
export const MARGIN_LR_PT = 70.87; // 25 mm (default Quotation left/right margin)
export const MARGIN_TOP_PT = 68.03; // 24 mm
export const MARGIN_BOTTOM_PT = 65.2; // 23 mm
export const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_LR_PT * 2; // 453.54 pt

// Margin khusus dokumen Kontrak: 4-4-3-3 cm (Atas 4 cm, Kiri 4 cm, Bawah 3 cm, Kanan 3 cm)
export const CONTRACT_MARGIN_TOP_PT = 113.39; // 4 cm
export const CONTRACT_MARGIN_LEFT_PT = 113.39; // 4 cm
export const CONTRACT_MARGIN_BOTTOM_PT = 85.04; // 3 cm
export const CONTRACT_MARGIN_RIGHT_PT = 85.04; // 3 cm
export const CONTRACT_CONTENT_WIDTH_PT =
  A4_WIDTH_PT - CONTRACT_MARGIN_LEFT_PT - CONTRACT_MARGIN_RIGHT_PT; // 396.85 pt (14 cm)

const BODY_FONT_SIZE = 11;
const BODY_LINE_HEIGHT = 13.8; // Compact legal 11pt leading (~1.25x)
const TABLE_FONT_SIZE = 9; // <= 10pt table body text
const TABLE_LINE_HEIGHT = 11.4;

export const COLOR_BLACK = rgb(0, 0, 0);
export const COLOR_BORDER = rgb(0.68, 0.68, 0.68);
export const COLOR_HEADER_BG = rgb(0.95, 0.95, 0.95);

/**
 * Sanitizes strings for PDF WinAnsi encoding so pasted special Unicode symbols
 * never throw during font width calculation or drawing.
 */
export function sanitizeWinAnsi(input: string): string {
  return (input || '')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/\u00A0/g, ' ')
    // Strip characters outside Latin-1 / WinAnsi safe range (preserving \u2022 bullet)
    .replace(/[^\x20-\x7E\xA0-\xFF\u2022]/g, '');
}

const charWidthCache = new WeakMap<PDFFont, Map<string, number>>();

/**
 * Measures the exact unkerned advance width that pdf-lib's `page.drawText` (Tj operator)
 * produces when rendered by PDF viewers, avoiding phantom AFM kerning subtraction.
 */
export function measurePdfDrawnWidth(font: PDFFont, text: string, fontSize: number): number {
  if (!text) return 0;
  let cache = charWidthCache.get(font);
  if (!cache) {
    cache = new Map<string, number>();
    charWidthCache.set(font, cache);
  }
  let totalPerEm = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let w = cache.get(ch);
    if (w === undefined) {
      w = font.widthOfTextAtSize(ch, 1000);
      cache.set(ch, w);
    }
    totalPerEm += w;
  }
  return (totalPerEm * fontSize) / 1000;
}

function pickSpanFont(
  regularFont: PDFFont,
  italicFont: PDFFont,
  boldFont: PDFFont,
  boldItalicFont: PDFFont,
  italic: boolean,
  bold: boolean
): PDFFont {
  if (bold) {
    return italic ? boldItalicFont : boldFont;
  }
  return italic ? italicFont : regularFont;
}

export function measureStyledWord(
  word: StyledWord,
  regularFont: PDFFont,
  italicFont: PDFFont,
  fontSize: number,
  boldFont: PDFFont = regularFont,
  boldItalicFont: PDFFont = italicFont
): number {
  let width = 0;
  for (const span of word) {
    const f = pickSpanFont(
      regularFont,
      italicFont,
      boldFont,
      boldItalicFont,
      span.italic,
      Boolean(span.bold)
    );
    width += measurePdfDrawnWidth(f, span.text, fontSize);
  }
  return width;
}

export function wrapStyledTextWords(
  text: string,
  regularFont: PDFFont,
  italicFont: PDFFont,
  fontSize: number,
  maxWidth: number,
  forceItalic = false,
  boldFont: PDFFont = regularFont,
  boldItalicFont: PDFFont = italicFont,
  italicizeEnglish = true
): { lines: StyledWord[][]; isParagraphEnd: boolean[]; lineIndentPts: number[] } {
  const paragraphs = (text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((p) => sanitizeWinAnsi(p));
  const allLines: StyledWord[][] = [];
  const isParagraphEnd: boolean[] = [];
  const lineIndentPts: number[] = [];
  const spaceWidth = measurePdfDrawnWidth(regularFont, ' ', fontSize);

  let lastBulletIndent = 0;

  for (const para of paragraphs) {
    const hasSubIndent = /^\s{2,}/.test(para);
    const trimmedPara = para.trim();
    const bulletMatch = /^(\u2022|-)\s+/.exec(trimmedPara);
    const fallbackBulletIndent = measurePdfDrawnWidth(regularFont, '\u2022 ', fontSize);
    if (bulletMatch) {
      lastBulletIndent = measurePdfDrawnWidth(regularFont, `${bulletMatch[1]} `, fontSize);
    } else if (!hasSubIndent) {
      lastBulletIndent = 0;
    }

    const firstLineIndent = bulletMatch ? 0 : hasSubIndent ? lastBulletIndent || fallbackBulletIndent : 0;
    const continuationIndent = bulletMatch ? lastBulletIndent : firstLineIndent;
    const words = tokenizeLineIntoStyledWords(trimmedPara, forceItalic, italicizeEnglish);
    if (words.length === 0) {
      allLines.push([]);
      isParagraphEnd.push(true);
      lineIndentPts.push(0);
      continue;
    }

    let currentLine: StyledWord[] = [];
    let currentLineWidth = 0;
    let isFirstLineOfPara = true;

    for (const word of words) {
      const lineIndent = isFirstLineOfPara ? firstLineIndent : continuationIndent;
      const lineMaxWidth = Math.max(24, maxWidth - lineIndent);
      const wordWidth = measureStyledWord(
        word,
        regularFont,
        italicFont,
        fontSize,
        boldFont,
        boldItalicFont
      );
      const nextWidth =
        currentLine.length === 0 ? wordWidth : currentLineWidth + spaceWidth + wordWidth;

      if (nextWidth <= lineMaxWidth || currentLine.length === 0) {
        if (currentLine.length === 0 && wordWidth > lineMaxWidth) {
          allLines.push([word]);
          isParagraphEnd.push(false);
          lineIndentPts.push(lineIndent);
          isFirstLineOfPara = false;
        } else {
          currentLine.push(word);
          currentLineWidth = nextWidth;
        }
      } else {
        allLines.push(currentLine);
        isParagraphEnd.push(false);
        lineIndentPts.push(lineIndent);
        isFirstLineOfPara = false;
        currentLine = [word];
        currentLineWidth = wordWidth;
      }
    }
    if (currentLine.length > 0) {
      const lineIndent = isFirstLineOfPara ? firstLineIndent : continuationIndent;
      allLines.push(currentLine);
      isParagraphEnd.push(true);
      lineIndentPts.push(lineIndent);
    }
  }

  return { lines: allLines, isParagraphEnd, lineIndentPts };
}

export interface StrikeStyle {
  color?: ReturnType<typeof rgb>;
  angleDeg?: number;
  thickness?: number;
}

export function drawStyledLine(
  page: PDFPage,
  words: StyledWord[],
  x: number,
  y: number,
  maxWidth: number,
  regularFont: PDFFont,
  italicFont: PDFFont,
  fontSize: number,
  align: 'left' | 'center' | 'right' | 'justify',
  isParagraphEnd: boolean,
  color = COLOR_BLACK,
  boldFont: PDFFont = regularFont,
  boldItalicFont: PDFFont = italicFont,
  strikeStyle?: StrikeStyle,
  maxJustifyRatio = 4.5
) {
  if (words.length === 0) return;

  const drawStrikeForSpan = (startX: number, spanW: number) => {
    const strikeColor = strikeStyle?.color ?? color;
    const strikeThickness = strikeStyle?.thickness ?? 0.65;
    const angleDeg = strikeStyle?.angleDeg ?? 0;
    if (angleDeg !== 0) {
      const yMid = y + fontSize * 0.34;
      const rad = (angleDeg * Math.PI) / 180;
      const halfRise = Math.min(
        fontSize * 0.42,
        Math.max(1.6, ((spanW + 2) * Math.tan(Math.abs(rad))) / 2)
      );
      const sign = angleDeg >= 0 ? 1 : -1;
      page.drawLine({
        start: { x: startX - 1, y: yMid - halfRise * sign },
        end: { x: startX + spanW + 1, y: yMid + halfRise * sign },
        thickness: strikeThickness,
        color: strikeColor,
      });
    } else {
      page.drawLine({
        start: { x: startX, y: y + fontSize * 0.32 },
        end: { x: startX + spanW, y: y + fontSize * 0.32 },
        thickness: strikeThickness,
        color: strikeColor,
      });
    }
  };

  const normalSpace = measurePdfDrawnWidth(regularFont, ' ', fontSize);
  const wordsWidth = words.reduce(
    (sum, w) => sum + measureStyledWord(w, regularFont, italicFont, fontSize, boldFont, boldItalicFont),
    0
  );
  const naturalLineWidth = wordsWidth + Math.max(0, words.length - 1) * normalSpace;

  let cursorX = x;
  let gapPerSpace = normalSpace;

  if (align === 'center') {
    cursorX = x + (maxWidth - naturalLineWidth) / 2;
  } else if (align === 'right') {
    cursorX = x + maxWidth - naturalLineWidth;
  } else if (align === 'justify' && !isParagraphEnd && words.length > 1) {
    const candidateGap = (maxWidth - wordsWidth) / (words.length - 1);
    if (candidateGap <= normalSpace * maxJustifyRatio && candidateGap >= normalSpace * 0.5) {
      gapPerSpace = candidateGap;
    }
  }

  if (gapPerSpace === normalSpace) {
    // Coalesce contiguous spans with the same font and strike state (including spaces)
    // so PDF viewers use native inter-word spacing cleanly across upright, bold, and italic runs.
    const runs: { text: string; italic: boolean; bold: boolean; strike: boolean }[] = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (const span of word) {
        const isBold = Boolean(span.bold);
        const isStrike = Boolean(span.strike);
        const prev = runs[runs.length - 1];
        if (prev && prev.italic === span.italic && prev.bold === isBold && prev.strike === isStrike) {
          prev.text += span.text;
        } else {
          runs.push({ text: span.text, italic: span.italic, bold: isBold, strike: isStrike });
        }
      }
      if (i < words.length - 1) {
        const prev = runs[runs.length - 1];
        const nextWordFirstStrike = Boolean(words[i + 1][0]?.strike);
        const spaceStrike = Boolean(prev?.strike) && nextWordFirstStrike;
        if (prev && !prev.italic && !prev.bold && prev.strike === spaceStrike) {
          prev.text += ' ';
        } else {
          runs.push({ text: ' ', italic: false, bold: false, strike: spaceStrike });
        }
      }
    }

    for (const run of runs) {
      const f = pickSpanFont(regularFont, italicFont, boldFont, boldItalicFont, run.italic, run.bold);
      const runWidth = measurePdfDrawnWidth(f, run.text, fontSize);
      page.drawText(run.text, { x: cursorX, y, size: fontSize, font: f, color });
      if (run.strike && run.text.trim().length > 0) {
        drawStrikeForSpan(cursorX, runWidth);
      }
      cursorX += runWidth;
    }
    return;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (const span of word) {
      const f = pickSpanFont(
        regularFont,
        italicFont,
        boldFont,
        boldItalicFont,
        span.italic,
        Boolean(span.bold)
      );
      const spanWidth = measurePdfDrawnWidth(f, span.text, fontSize);
      page.drawText(span.text, { x: cursorX, y, size: fontSize, font: f, color });
      if (span.strike && span.text.trim().length > 0) {
        drawStrikeForSpan(cursorX, spanWidth);
      }
      cursorX += spanWidth;
    }
    if (i < words.length - 1) {
      cursorX += gapPerSpace;
    }
  }
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) return null;
  const base64 = dataUrl.split(',')[1];
  if (!base64) return null;
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export interface PdfGenerationOutput {
  pdfBytes: Uint8Array;
  pageCount: number;
  anchorPages: Record<string, number>;
}

// Dimensi aset tanda-tangan-alvareza.webp = 646 x 386 px (rasio ~1.6736 : 1)
// Area & ukuran output TTD kedua pihak dibuat seragam dan berada normal di atas garis tanda tangan
export const SIGNATURE_AREA_HEIGHT_PT = 82;
export const SIGNATURE_MAX_WIDTH_PT = 134;
export const SIGNATURE_MAX_HEIGHT_PT = 80;

export async function drawAlinLabsStampAndSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  assets: AlinLabsPdfAssets,
  options: {
    boxX: number;
    boxBottomY: number;
    boxWidth: number;
    boxHeight: number;
    customSignatureDataUrl?: string;
  }
): Promise<void> {
  const { boxX, boxBottomY, boxWidth, boxHeight, customSignatureDataUrl } = options;

  // Layer 1 (di atas garis tanda tangan): Tanda tangan Alvareza (ukuran 134x80 pt normal di atas garis)
  const customBytes = customSignatureDataUrl
    ? dataUrlToUint8Array(customSignatureDataUrl)
    : null;
  const sigBytes = customBytes ?? assets.signatureAlvarezaPng;

  if (sigBytes) {
    try {
      const sigImg = await pdfDoc.embedPng(sigBytes);
      const maxSigW = Math.min(SIGNATURE_MAX_WIDTH_PT, boxWidth - 24);
      const maxSigH = Math.min(SIGNATURE_MAX_HEIGHT_PT, boxHeight - 2);
      const dims = sigImg.scaleToFit(maxSigW, maxSigH);
      page.drawImage(sigImg, {
        x: boxX + (boxWidth - dims.width) / 2,
        y: boxBottomY + 3,
        width: dims.width,
        height: dims.height,
      });
    } catch {
      // Ignore invalid signature PNG gracefully
    }
  }

  // Layer 2 (paling atas): Stempel resmi ALINLABS INDONESIA menindihi TTD dengan opacity tipis & sedikit miring di atas garis
  if (assets.stempelPng) {
    try {
      const stempelImg = await pdfDoc.embedPng(assets.stempelPng);
      const sDims = stempelImg.scaleToFit(74, 74);
      page.drawImage(stempelImg, {
        x: boxX + 8,
        y: boxBottomY + 3,
        width: sDims.width,
        height: sDims.height,
        opacity: 0.52,
        rotate: degrees(-8),
      });
    } catch {
      // Ignore invalid stempel PNG gracefully
    }
  }
}

export async function drawAlinLabsLetterhead(
  pdfDoc: PDFDocument,
  page: PDFPage,
  assets: AlinLabsPdfAssets,
  fonts: {
    fontRegular: PDFFont;
    fontBold: PDFFont;
    fontItalic: PDFFont;
  },
  company: {
    name?: string;
    businessField?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  } = {},
  layout: {
    marginLeft?: number;
    marginRight?: number;
    topBaselineY?: number;
  } = {}
): Promise<number> {
  const { fontRegular, fontBold, fontItalic } = fonts;
  const marginLeft = layout.marginLeft ?? MARGIN_LR_PT;
  const marginRight = layout.marginRight ?? MARGIN_LR_PT;
  const contentWidth = A4_WIDTH_PT - marginLeft - marginRight;
  const line1Y = layout.topBaselineY ?? 788;
  const line2Y = line1Y - 14;
  const line3Y = line2Y - 12;
  const line4Y = line3Y - 12;
  const ruleTopY = line4Y - 9;
  const ruleBottomY = ruleTopY - 3;

  const companyName = sanitizeWinAnsi((company.name || 'ALINLABS INDONESIA').toUpperCase());
  const tagline = sanitizeWinAnsi(
    company.businessField ||
      'Digital Agency, Website Development, Artificial Intelligence & Digital Solutions'
  );
  const address = sanitizeWinAnsi(
    company.address ||
      'Jln. Rawa Sari, Kel. Munjuljaya, Kec. Purwakarta, Kab. Purwakarta, Jawa Barat 41117'
  );
  const phone = sanitizeWinAnsi(company.phone || '085797184059');
  const email = sanitizeWinAnsi(company.email || 'office.alincorporation@gmail.com');
  const website = sanitizeWinAnsi(company.website || 'www.alinlabs.biz.id');
  const contactLine = `Telp: ${phone}  |  Email: ${email}  |  Web: ${website}`;

  let textStartX = marginLeft;
  let textAreaW = contentWidth;
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  let logoDims = { width: 0, height: 0 };

  if (assets.logoPng) {
    try {
      logoImg = await pdfDoc.embedPng(assets.logoPng);
      const logoSize = contentWidth < 420 ? 42 : 46;
      logoDims = logoImg.scaleToFit(logoSize, logoSize);
      textStartX = marginLeft + logoDims.width + 10;
      textAreaW = contentWidth - (logoDims.width + 10);
    } catch {
      logoImg = null;
    }
  }

  const drawCenteredKopLine = (text: string, y: number, baseSize: number, font: PDFFont) => {
    let size = baseSize;
    let w = measurePdfDrawnWidth(font, text, size);
    if (w > textAreaW && w > 0) {
      size = Math.max(7.0, (baseSize * textAreaW) / w);
      w = measurePdfDrawnWidth(font, text, size);
    }
    const drawX = textStartX + Math.max(0, (textAreaW - w) / 2);
    page.drawText(text, { x: drawX, y, size, font, color: COLOR_BLACK });
  };

  drawCenteredKopLine(companyName, line1Y, contentWidth < 420 ? 13.5 : 14.5, fontBold);
  drawCenteredKopLine(tagline, line2Y, contentWidth < 420 ? 8.2 : 8.5, fontItalic);
  drawCenteredKopLine(address, line3Y, contentWidth < 420 ? 8.2 : 8.5, fontRegular);
  drawCenteredKopLine(contactLine, line4Y, contentWidth < 420 ? 8.2 : 8.5, fontRegular);

  if (logoImg) {
    const visualTopY = line1Y + 10.5;
    const visualBottomY = line4Y - 2;
    const logoY = (visualTopY + visualBottomY) / 2 - logoDims.height / 2;
    page.drawImage(logoImg, {
      x: marginLeft,
      y: logoY,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  page.drawLine({
    start: { x: marginLeft, y: ruleTopY },
    end: { x: A4_WIDTH_PT - marginRight, y: ruleTopY },
    thickness: 1.6,
    color: COLOR_BLACK,
  });
  page.drawLine({
    start: { x: marginLeft, y: ruleBottomY },
    end: { x: A4_WIDTH_PT - marginRight, y: ruleBottomY },
    thickness: 0.6,
    color: COLOR_BLACK,
  });

  return ruleBottomY - 20;
}

async function drawContractCoverPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  assets: AlinLabsPdfAssets,
  fonts: {
    fontRegular: PDFFont;
    fontBold: PDFFont;
    fontItalic: PDFFont;
  },
  doc: ContractDocument,
  model: ReturnType<typeof buildLegalDocumentModel>
): Promise<void> {
  const { fontRegular, fontBold, fontItalic } = fonts;
  // Cover tetap memakai margin kiri 4 cm & kanan 3 cm, namun atas & bawah memakai margin normal (24 mm / 23 mm)
  const frameX = CONTRACT_MARGIN_LEFT_PT;
  const frameW = CONTRACT_CONTENT_WIDTH_PT;
  const coverTopY = A4_HEIGHT_PT - MARGIN_TOP_PT;
  const coverBottomY = MARGIN_BOTTOM_PT;
  const centerX = frameX + frameW / 2;

  const drawCenteredText = (text: string, y: number, size: number, font: PDFFont) => {
    const clean = sanitizeWinAnsi(text);
    let drawSize = size;
    let w = measurePdfDrawnWidth(font, clean, drawSize);
    const maxW = frameW - 36;
    if (w > maxW && w > 0) {
      drawSize = Math.max(7.5, (size * maxW) / w);
      w = measurePdfDrawnWidth(font, clean, drawSize);
    }
    page.drawText(clean, {
      x: centerX - w / 2,
      y,
      size: drawSize,
      font,
      color: COLOR_BLACK,
    });
  };

  // Judul utama & Nomor Surat di paling atas cover (mengikuti margin atas normal)
  drawCenteredText('SURAT PERJANJIAN KERJA SAMA', coverTopY - 22, 14, fontBold);
  drawCenteredText('JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE', coverTopY - 45, 14, fontBold);
  drawCenteredText(`Nomor: ${model.contractNumber}`, coverTopY - 70, 12, fontRegular);

  // Dua logo dengan latar belakang lingkaran yang saling tumpang tindih sedikit di tengah cover
  const circleRadius = 56;
  const centerOffset = 46; // Jarak antar pusat 92 pt -> tumpang tindih 20 pt
  const logoBandCenterY = coverTopY - 252;
  const logoBandBottomY = logoBandCenterY - circleRadius;
  const leftCircleX = centerX - centerOffset;
  const rightCircleX = centerX + centerOffset;
  const circleFill = rgb(0.955, 0.96, 0.97);
  const circleBorder = rgb(0.76, 0.78, 0.82);

  let shansusImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  let alinImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;

  if (assets.shansusLogoPng) {
    try {
      shansusImg = await pdfDoc.embedPng(assets.shansusLogoPng);
    } catch {
      shansusImg = null;
    }
  }
  if (assets.logoPng) {
    try {
      alinImg = await pdfDoc.embedPng(assets.logoPng);
    } catch {
      alinImg = null;
    }
  }

  if (shansusImg && alinImg) {
    // Special case cover: logo Shansus Dzar berasio landscape (~1.27:1), sehingga diberi batas lebar lebih besar agar tingginya seimbang & sedikit lebih tinggi
    const shansusDims = shansusImg.scaleToFit(85, 68);
    const alinDims = alinImg.scaleToFit(68, 66);

    // 1. Lingkaran kiri (Shansus Dzar) + logonya
    page.drawCircle({
      x: leftCircleX,
      y: logoBandCenterY,
      size: circleRadius,
      color: circleFill,
      borderColor: circleBorder,
      borderWidth: 1,
    });
    page.drawImage(shansusImg, {
      x: leftCircleX - shansusDims.width / 2,
      y: logoBandCenterY - shansusDims.height / 2,
      width: shansusDims.width,
      height: shansusDims.height,
    });

    // 2. Halo putih tipis untuk memisahkan batas tumpang tindih, lalu lingkaran kanan (AlinLabs) + logonya
    page.drawCircle({
      x: rightCircleX,
      y: logoBandCenterY,
      size: circleRadius + 2.5,
      color: rgb(1, 1, 1),
    });
    page.drawCircle({
      x: rightCircleX,
      y: logoBandCenterY,
      size: circleRadius,
      color: circleFill,
      borderColor: circleBorder,
      borderWidth: 1,
    });
    page.drawImage(alinImg, {
      x: rightCircleX - alinDims.width / 2,
      y: logoBandCenterY - alinDims.height / 2,
      width: alinDims.width,
      height: alinDims.height,
    });
  } else {
    const singleImg = shansusImg ?? alinImg;
    if (singleImg) {
      const dims = singleImg.scaleToFit(68, 66);
      page.drawCircle({
        x: centerX,
        y: logoBandCenterY,
        size: circleRadius,
        color: circleFill,
        borderColor: circleBorder,
        borderWidth: 1,
      });
      page.drawImage(singleImg, {
        x: centerX - dims.width / 2,
        y: logoBandCenterY - dims.height / 2,
        width: dims.width,
        height: dims.height,
      });
    }
  }

  // Identitas Para Pihak berdampingan kanan-kiri di bawah kedua logo
  const partiesStartY = logoBandBottomY - 46;
  drawCenteredText('ANTARA', partiesStartY, 9.2, fontItalic);

  const colGap = 24;
  const colW = (frameW - colGap) / 2;
  const leftColCenterX = frameX + colW / 2;
  const rightColCenterX = frameX + colW + colGap + colW / 2;
  const colTopY = partiesStartY - 30;

  const drawCenteredInCol = (
    text: string,
    colCenterX: number,
    y: number,
    size: number,
    font: PDFFont
  ) => {
    const clean = sanitizeWinAnsi(text);
    let drawSize = size;
    let w = measurePdfDrawnWidth(font, clean, drawSize);
    const maxColW = colW - 8;
    if (w > maxColW && w > 0) {
      drawSize = Math.max(7.2, (size * maxColW) / w);
      w = measurePdfDrawnWidth(font, clean, drawSize);
    }
    page.drawText(clean, {
      x: colCenterX - w / 2,
      y,
      size: drawSize,
      font,
      color: COLOR_BLACK,
    });
  };

  page.drawLine({
    start: { x: centerX, y: colTopY + 8 },
    end: { x: centerX, y: colTopY - 52 },
    thickness: 0.6,
    color: COLOR_BORDER,
  });

  drawCenteredInCol('PIHAK PERTAMA', leftColCenterX, colTopY, 8.5, fontRegular);
  drawCenteredInCol(
    doc.firstParty.legalName || 'Shansus Dzar Indonesia',
    leftColCenterX,
    colTopY - 20,
    11.5,
    fontBold
  );
  drawCenteredInCol(
    `Diwakili oleh ${doc.firstParty.directorName || 'H. M. Hilman Aziz Napis, S.E'}`,
    leftColCenterX,
    colTopY - 38,
    8.6,
    fontRegular
  );

  drawCenteredInCol('PIHAK KEDUA', rightColCenterX, colTopY, 8.5, fontRegular);
  drawCenteredInCol(
    doc.secondParty.legalName || 'AlinLabs Indonesia',
    rightColCenterX,
    colTopY - 20,
    11.5,
    fontBold
  );
  drawCenteredInCol(
    `Diwakili oleh ${doc.secondParty.directorName || 'Alvareza Hilka Pratama, S.M.'}`,
    rightColCenterX,
    colTopY - 38,
    8.6,
    fontRegular
  );

  // Footer cover: Line 1 KOTA, Line 2 TAHUN, Line 3 ALAMAT, Line 4 KONTAK (tanpa garis di atasnya)
  const city = (doc.agreement.signingCity || 'Purwakarta').toUpperCase();
  const formattedAgreementDate = formatIndonesianDate(doc.agreement.agreementDate);
  const dateParts = sanitizeWinAnsi(formattedAgreementDate).trim().split(/\s+/);
  const parsedYear = dateParts.length > 0 && /^\d{4}$/.test(dateParts[dateParts.length - 1])
    ? dateParts[dateParts.length - 1]
    : String(doc.agreement.numberConfig?.year || new Date().getFullYear());
  const companyAddress =
    doc.secondParty.address ||
    'Jln. Rawa Sari, Kel. Munjuljaya, Kec. Purwakarta, Kab. Purwakarta, Jawa Barat 41117';
  const contactLine = [
    `Telp: ${doc.secondParty.phone || '085797184059'}`,
    doc.secondParty.email || 'office.alincorporation@gmail.com',
    'www.alinlabs.biz.id',
  ].join('    ');

  drawCenteredText(city, coverBottomY + 52, 10.5, fontBold);
  drawCenteredText(parsedYear, coverBottomY + 37, 10.5, fontBold);
  drawCenteredText(companyAddress, coverBottomY + 19, 8, fontRegular);
  drawCenteredText(contactLine, coverBottomY + 6, 8, fontRegular);
}

export async function generateContractPdfBytes(doc: ContractDocument): Promise<PdfGenerationOutput> {
  const model = buildLegalDocumentModel(doc);
  const assets = await loadAlinLabsPdfAssets();
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(`Surat Perjanjian Kerja Sama - ${sanitizeWinAnsi(model.contractNumber)}`);
  pdfDoc.setAuthor('AlinLabs Indonesia — Contract Management');
  pdfDoc.setSubject(sanitizeWinAnsi(doc.project.projectName || 'Perjanjian Pengembangan Website'));
  pdfDoc.setCreator('Alin Labs Document Engineering Engine');
  pdfDoc.setProducer('Alin Labs PDF Engine (pdf-lib)');
  pdfDoc.setCreationDate(new Date());

  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const pages: PDFPage[] = [];
  const anchorPages: Record<string, number> = {};

  // Halaman 1 khusus Cover Perjanjian (dengan margin 4-4-3-3 cm)
  let page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  pages.push(page);
  await drawContractCoverPage(
    pdfDoc,
    page,
    assets,
    { fontRegular, fontBold, fontItalic },
    doc,
    model
  );

  // Halaman 2 adalah awal isi perjanjian (memakai area header di atas, halaman 3+ memakai margin atas 4 cm)
  page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  pages.push(page);
  let cursorY = A4_HEIGHT_PT - MARGIN_TOP_PT;

  const recordAnchor = (anchorId?: string) => {
    if (anchorId && anchorPages[anchorId] === undefined) {
      anchorPages[anchorId] = pages.length;
    }
  };

  const newPage = () => {
    page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    pages.push(page);
    cursorY = A4_HEIGHT_PT - CONTRACT_MARGIN_TOP_PT;
  };

  const ensureSpace = (neededPt: number) => {
    if (cursorY - neededPt < CONTRACT_MARGIN_BOTTOM_PT) {
      newPage();
    }
  };

  const drawStyledSingleLine = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    options: { bold?: boolean; forceItalic?: boolean; align?: 'left' | 'center' | 'right' } = {}
  ) => {
    const rFont = options.bold ? fontBold : fontRegular;
    const iFont = options.bold ? fontBoldItalic : fontItalic;
    const words = tokenizeLineIntoStyledWords(sanitizeWinAnsi(text), Boolean(options.forceItalic));
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
      COLOR_BLACK
    );
  };

  const drawCenteredBoldHeading = (
    text: string,
    fontSize: number,
    lineHeight = 14,
    italicizeEnglish = true,
    bold = true
  ) => {
    const rFont = bold ? fontBold : fontRegular;
    const iFont = bold ? fontBoldItalic : fontItalic;
    const { lines } = wrapStyledTextWords(
      text,
      rFont,
      iFont,
      fontSize,
      CONTRACT_CONTENT_WIDTH_PT,
      false,
      rFont,
      iFont,
      italicizeEnglish
    );
    for (const words of lines) {
      if (words.length === 0) continue;
      ensureSpace(lineHeight);
      drawStyledLine(
        page,
        words,
        CONTRACT_MARGIN_LEFT_PT,
        cursorY,
        CONTRACT_CONTENT_WIDTH_PT,
        rFont,
        iFont,
        fontSize,
        'center',
        true,
        COLOR_BLACK
      );
      cursorY -= lineHeight;
    }
  };

  const drawParagraph = (
    text: string,
    options: {
      align?: 'justify' | 'left' | 'center';
      bold?: boolean;
      italic?: boolean;
      fontSize?: number;
      lineHeight?: number;
      indentLeft?: number;
      spaceAfter?: number;
    } = {}
  ) => {
    const fontSize = options.fontSize ?? BODY_FONT_SIZE;
    const lineHeight = options.lineHeight ?? BODY_LINE_HEIGHT;
    const indentLeft = options.indentLeft ?? 0;
    const align = options.align ?? 'justify';
    const rFont = options.bold ? fontBold : fontRegular;
    const iFont = options.bold ? fontBoldItalic : fontItalic;

    const maxWidth = CONTRACT_CONTENT_WIDTH_PT - indentLeft;
    const { lines, isParagraphEnd, lineIndentPts } = wrapStyledTextWords(
      text,
      rFont,
      iFont,
      fontSize,
      maxWidth,
      Boolean(options.italic),
      fontBold,
      fontBoldItalic
    );

    for (let i = 0; i < lines.length; i++) {
      ensureSpace(lineHeight);
      const words = lines[i];
      const extraIndent = lineIndentPts[i] ?? 0;
      if (words.length > 0) {
        drawStyledLine(
          page,
          words,
          CONTRACT_MARGIN_LEFT_PT + indentLeft + extraIndent,
          cursorY,
          maxWidth - extraIndent,
          rFont,
          iFont,
          fontSize,
          align,
          isParagraphEnd[i],
          COLOR_BLACK,
          fontBold,
          fontBoldItalic
        );
      }
      cursorY -= lineHeight;
    }

    cursorY -= options.spaceAfter ?? 4;
  };

  const drawKeyValueTable = (
    title: string | undefined,
    rows: { label: string; value: string }[],
    valueAlign: 'left' | 'justify' = 'left'
  ) => {
    const col1W = 124;
    const col2W = CONTRACT_CONTENT_WIDTH_PT - col1W;
    const padX = 5;
    const padY = 3.5;
    const minSliceHeight = TABLE_LINE_HEIGHT + padY * 2 - 2;
    const topPageCursorY = A4_HEIGHT_PT - CONTRACT_MARGIN_TOP_PT;

    const preparedRows = rows.map((row) => {
      const labelLines = wrapStyledTextWords(
        row.label,
        fontBold,
        fontBoldItalic,
        TABLE_FONT_SIZE,
        col1W - padX * 2
      ).lines;
      const valWrapped = wrapStyledTextWords(
        row.value,
        fontRegular,
        fontItalic,
        TABLE_FONT_SIZE,
        col2W - padX * 2,
        false,
        fontBold,
        fontBoldItalic
      );
      return {
        labelLines,
        valWrapped,
        totalLines: Math.max(1, labelLines.length, valWrapped.lines.length),
      };
    });

    const firstRowMinHeight =
      preparedRows.length > 0
        ? Math.min(preparedRows[0].totalLines, 2) * TABLE_LINE_HEIGHT + padY * 2 - 2
        : 0;

    if (title) {
      const titleLineCount = wrapStyledTextWords(
        title,
        fontBold,
        fontBoldItalic,
        BODY_FONT_SIZE,
        CONTRACT_CONTENT_WIDTH_PT
      ).lines.length;
      const titleBlockHeight = titleLineCount * 14 + 8;
      ensureSpace(4 + titleBlockHeight + firstRowMinHeight);
      if (cursorY < topPageCursorY - 1) {
        cursorY -= 4;
      }
      drawCenteredBoldHeading(title, BODY_FONT_SIZE, 14);
      cursorY -= 8;
    } else if (cursorY < topPageCursorY - 1) {
      ensureSpace(8 + firstRowMinHeight);
      if (cursorY < topPageCursorY - 1) {
        cursorY -= 8;
      }
    }

    for (let r = 0; r < preparedRows.length; r++) {
      const { labelLines, valWrapped, totalLines } = preparedRows[r];
      const valLines = valWrapped.lines;

      let startLine = 0;
      while (startLine < totalLines) {
        let topY = cursorY + 11;
        let availHeight = topY - CONTRACT_MARGIN_BOTTOM_PT;

        if (availHeight < minSliceHeight) {
          newPage();
          topY = cursorY + 11;
          availHeight = topY - CONTRACT_MARGIN_BOTTOM_PT;
        }

        const maxFit = Math.max(
          1,
          Math.floor((availHeight - (padY * 2 - 2)) / TABLE_LINE_HEIGHT)
        );
        const linesInSlice = Math.min(totalLines - startLine, maxFit);
        const endLine = startLine + linesInSlice;
        const sliceHeight = linesInSlice * TABLE_LINE_HEIGHT + padY * 2 - 2;
        const bottomY = topY - sliceHeight;

        page.drawRectangle({
          x: CONTRACT_MARGIN_LEFT_PT,
          y: bottomY,
          width: col1W,
          height: sliceHeight,
          color: COLOR_HEADER_BG,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5,
        });

        page.drawRectangle({
          x: CONTRACT_MARGIN_LEFT_PT + col1W,
          y: bottomY,
          width: col2W,
          height: sliceHeight,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5,
        });

        for (let li = startLine; li < endLine; li++) {
          const localIdx = li - startLine;
          const lineY = topY - padY - 9 - localIdx * TABLE_LINE_HEIGHT;

          const lWords = labelLines[li];
          if (lWords && lWords.length > 0) {
            drawStyledLine(
              page,
              lWords,
              CONTRACT_MARGIN_LEFT_PT + padX,
              lineY,
              col1W - padX * 2,
              fontBold,
              fontBoldItalic,
              TABLE_FONT_SIZE,
              'left',
              true,
              COLOR_BLACK
            );
          }

          const vWords = valLines[li];
          if (vWords && vWords.length > 0) {
            const bulletIndent = valWrapped.lineIndentPts[li] ?? 0;
            const lineAlign = valueAlign === 'justify' ? 'justify' : 'left';
            const isParaEnd =
              valueAlign === 'justify' ? Boolean(valWrapped.isParagraphEnd[li]) : true;
            drawStyledLine(
              page,
              vWords,
              CONTRACT_MARGIN_LEFT_PT + col1W + padX + bulletIndent,
              lineY,
              col2W - padX * 2 - bulletIndent,
              fontRegular,
              fontItalic,
              TABLE_FONT_SIZE,
              lineAlign,
              isParaEnd,
              COLOR_BLACK,
              fontBold,
              fontBoldItalic
            );
          }
        }

        cursorY -= sliceHeight;
        startLine = endLine;
      }
    }

    cursorY -= 10;
  };

  const drawDataTable = (
    title: string | undefined,
    columns: { header: string; widthRatio: number; align?: 'left' | 'right' | 'center' }[],
    rows: string[][],
    summaryLines?: DataTableSummaryLine[]
  ) => {
    const padX = 4.5;
    const padY = 3.5;
    const lineH = 11.4;
    const minSliceHeight = lineH + padY * 2 - 2;
    const colWidths = columns.map((c) => c.widthRatio * CONTRACT_CONTENT_WIDTH_PT);
    const topPageCursorY = A4_HEIGHT_PT - CONTRACT_MARGIN_TOP_PT;

    const wrappedHeaders = columns.map(
      (col, ci) =>
        wrapStyledTextWords(
          col.header,
          fontBold,
          fontBoldItalic,
          8.5,
          colWidths[ci] - padX * 2
        ).lines
    );
    const maxHeaderLines = Math.max(1, ...wrappedHeaders.map((h) => h.length));
    const headerHeight = maxHeaderLines === 1 ? 22 : maxHeaderLines * 11 + 8;

    const preparedRows = rows.map((row) => {
      const wrappedCells = row.map((cell, ci) =>
        wrapStyledTextWords(
          cell,
          fontRegular,
          fontItalic,
          9,
          colWidths[ci] - padX * 2,
          false,
          fontBold,
          fontBoldItalic
        )
      );
      const maxLines = Math.max(1, ...wrappedCells.map((c) => c.lines.length));
      const fullRowHeight = maxLines * lineH + padY * 2 - 2;
      return { wrappedCells, maxLines, fullRowHeight };
    });

    const maxUsablePageHeight =
      A4_HEIGHT_PT - CONTRACT_MARGIN_TOP_PT - CONTRACT_MARGIN_BOTTOM_PT - 8;
    const firstRowMinNeeded =
      preparedRows.length > 0
        ? preparedRows[0].fullRowHeight <= maxUsablePageHeight - headerHeight
          ? preparedRows[0].fullRowHeight
          : minSliceHeight
        : 0;

    const drawHeaderRow = () => {
      const topY = cursorY + 11;
      const bottomY = topY - headerHeight;

      let x = CONTRACT_MARGIN_LEFT_PT;
      columns.forEach((_col, ci) => {
        const w = colWidths[ci];
        page.drawRectangle({
          x,
          y: bottomY,
          width: w,
          height: headerHeight,
          color: COLOR_HEADER_BG,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5,
        });

        const hLines = wrappedHeaders[ci];
        const totalTextH = hLines.length * 11;
        const firstLineY = topY - (headerHeight - totalTextH) / 2 - 8.5;
        hLines.forEach((words, li) => {
          if (words.length === 0) return;
          drawStyledLine(
            page,
            words,
            x + padX,
            firstLineY - li * 11,
            w - padX * 2,
            fontBold,
            fontBoldItalic,
            8.5,
            'center',
            true,
            COLOR_BLACK
          );
        });
        x += w;
      });
      cursorY -= headerHeight;
    };

    if (title) {
      const titleLineCount = wrapStyledTextWords(
        title,
        fontBold,
        fontBoldItalic,
        BODY_FONT_SIZE,
        CONTRACT_CONTENT_WIDTH_PT
      ).lines.length;
      const titleBlockHeight = titleLineCount * 14 + 8;
      ensureSpace(4 + titleBlockHeight + headerHeight + firstRowMinNeeded);
      if (cursorY < topPageCursorY - 1) {
        cursorY -= 4;
      }
      drawCenteredBoldHeading(title, BODY_FONT_SIZE, 14);
      cursorY -= 8;
    } else {
      ensureSpace(8 + headerHeight + firstRowMinNeeded);
      if (cursorY < topPageCursorY - 1) {
        cursorY -= 8;
      }
    }

    // Header tabel hanya digambar satu kali di awal tabel; halaman lanjutan tidak mengulang header tabel
    drawHeaderRow();

    for (const { wrappedCells, maxLines, fullRowHeight } of preparedRows) {
      let startLine = 0;
      while (startLine < maxLines) {
        let topY = cursorY + 11;
        let availHeight = topY - CONTRACT_MARGIN_BOTTOM_PT;
        const needsAtomicBreak =
          startLine === 0 && fullRowHeight <= maxUsablePageHeight && availHeight < fullRowHeight;

        if (availHeight < minSliceHeight || needsAtomicBreak) {
          newPage();
          topY = cursorY + 11;
          availHeight = topY - CONTRACT_MARGIN_BOTTOM_PT;
        }

        const maxFit = Math.max(1, Math.floor((availHeight - (padY * 2 - 2)) / lineH));
        const linesInSlice = Math.min(maxLines - startLine, maxFit);
        const endLine = startLine + linesInSlice;
        const sliceHeight = linesInSlice * lineH + padY * 2 - 2;
        const bottomY = topY - sliceHeight;
        let x = CONTRACT_MARGIN_LEFT_PT;

        wrappedCells.forEach((wrappedCell, ci) => {
          const w = colWidths[ci];
          const align = columns[ci]?.align ?? 'left';
          page.drawRectangle({
            x,
            y: bottomY,
            width: w,
            height: sliceHeight,
            borderColor: COLOR_BORDER,
            borderWidth: 0.5,
          });

          for (let li = startLine; li < endLine; li++) {
            const words = wrappedCell.lines[li];
            if (!words || words.length === 0) continue;
            const localIdx = li - startLine;
            const indent = align === 'left' ? (wrappedCell.lineIndentPts[li] ?? 0) : 0;
            drawStyledLine(
              page,
              words,
              x + padX + indent,
              topY - padY - 8.5 - localIdx * lineH,
              w - padX * 2 - indent,
              fontRegular,
              fontItalic,
              9,
              align,
              true,
              COLOR_BLACK,
              fontBold,
              fontBoldItalic
            );
          }
          x += w;
        });

        cursorY -= sliceHeight;
        startLine = endLine;
      }
    }

    if (summaryLines && summaryLines.length > 0) {
      const summaryCol2StartX = CONTRACT_MARGIN_LEFT_PT + (colWidths[0] ?? 0);
      const summaryLabelX = summaryCol2StartX + padX;
      const summaryRightEdgeX = CONTRACT_MARGIN_LEFT_PT + CONTRACT_CONTENT_WIDTH_PT - padX;
      const summaryValueW = 140;
      const summaryValueX = summaryRightEdgeX - summaryValueW;
      const summaryLabelW = Math.max(40, summaryValueX - summaryLabelX - 10);
      const summaryRowStep = 15;
      const neededSummaryH = summaryLines.length * summaryRowStep + 20;
      ensureSpace(neededSummaryH);

      cursorY -= 7;
      summaryLines.forEach((entry) => {
        if (entry.isTotal) {
          page.drawLine({
            start: { x: summaryCol2StartX, y: cursorY + 10.5 },
            end: { x: CONTRACT_MARGIN_LEFT_PT + CONTRACT_CONTENT_WIDTH_PT, y: cursorY + 10.5 },
            thickness: 0.75,
            color: COLOR_BLACK,
          });
          cursorY -= 3.5;
        }

        drawStyledSingleLine(entry.label, summaryLabelX, cursorY, summaryLabelW, 9, {
          bold: Boolean(entry.isTotal),
          align: 'left',
        });
        drawStyledSingleLine(entry.value, summaryValueX, cursorY, summaryValueW, 9, {
          bold: Boolean(entry.isTotal || entry.boldValue),
          align: 'right',
        });
        cursorY -= summaryRowStep;
      });
    }

    cursorY -= 10;
  };

  const drawSignatureBlock = async (block: Extract<DocumentBlock, { type: 'signature-block' }>) => {
    // Keep entire dual-party signature block together on one page
    const neededHeight = 210;
    ensureSpace(neededHeight);
    recordAnchor(block.anchorId);
    cursorY -= 6;

    const placeDateText = sanitizeWinAnsi(`${block.city}, ${block.dateText}`);
    const pdW = measurePdfDrawnWidth(fontRegular, placeDateText, 11);
    page.drawText(placeDateText, {
      x: CONTRACT_MARGIN_LEFT_PT + (CONTRACT_CONTENT_WIDTH_PT - pdW) / 2,
      y: cursorY,
      size: 11,
      font: fontRegular,
      color: COLOR_BLACK,
    });
    cursorY -= 22;

    const colWidth = 186;
    const gap = CONTRACT_CONTENT_WIDTH_PT - colWidth * 2;
    const leftX = CONTRACT_MARGIN_LEFT_PT;
    const rightX = CONTRACT_MARGIN_LEFT_PT + colWidth + gap;
    const blockStartY = cursorY;

    const leftCompLines = wrapStyledTextWords(
      block.firstPartyCompany,
      fontBold,
      fontBoldItalic,
      10,
      colWidth
    ).lines;
    const rightCompLines = wrapStyledTextWords(
      block.secondPartyCompany,
      fontBold,
      fontBoldItalic,
      10,
      colWidth
    ).lines;
    const leftTotalHdrLines = leftCompLines.length;
    const rightTotalHdrLines = rightCompLines.length + 1; // +1 for commercial name
    const maxHdrLines = Math.max(leftTotalHdrLines, rightTotalHdrLines);
    const alignedBoxTopOffset = 14 + maxHdrLines * 13 + 4;

    const drawPartyColumn = async (
      x: number,
      roleTitle: string,
      compLines: StyledWord[][],
      companyLine2: string | null,
      signerName: string,
      signerTitle: string,
      signedAt: string,
      signatureUrl: string,
      isAlinLabsParty = false
    ): Promise<number> => {
      let y = blockStartY;

      page.drawText(roleTitle, { x, y, size: 10.5, font: fontBold, color: COLOR_BLACK });
      y -= 14;

      for (const words of compLines) {
        drawStyledLine(
          page,
          words,
          x,
          y,
          colWidth,
          fontBold,
          fontBoldItalic,
          10,
          'left',
          true,
          COLOR_BLACK
        );
        y -= 13;
      }

      if (companyLine2) {
        page.drawText(sanitizeWinAnsi(companyLine2), {
          x,
          y,
          size: 9.5,
          font: fontBold,
          color: COLOR_BLACK,
        });
      }

      // Snap both signature areas to identical horizontal baseline & equal dimensions
      y = blockStartY - alignedBoxTopOffset;
      const boxHeight = SIGNATURE_AREA_HEIGHT_PT;
      const boxWidth = colWidth - 12;
      const boxBottomY = y - boxHeight + 6;
      const imgBytes = !isAlinLabsParty ? dataUrlToUint8Array(signatureUrl) : null;
      const hasFirstPartySignature = !isAlinLabsParty && Boolean(imgBytes);

      if (!isAlinLabsParty && !hasFirstPartySignature) {
        page.drawRectangle({
          x,
          y: boxBottomY,
          width: boxWidth,
          height: boxHeight,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5,
        });
        const placeholder = 'Ruang Tanda Tangan';
        const pw = measurePdfDrawnWidth(fontItalic, placeholder, 8.5);
        page.drawText(placeholder, {
          x: x + (boxWidth - pw) / 2,
          y: boxBottomY + boxHeight / 2 - 3,
          size: 8.5,
          font: fontItalic,
          color: COLOR_BLACK,
        });
      } else {
        // Garis penempatan tanda tangan tanpa kotak (sama seperti AlinLabs)
        page.drawLine({
          start: { x, y: boxBottomY },
          end: { x: x + boxWidth, y: boxBottomY },
          thickness: 0.65,
          color: COLOR_BLACK,
        });
      }

      const drawFittedMetaLine = (
        text: string,
        y: number,
        baseSize: number,
        font: PDFFont
      ) => {
        const clean = sanitizeWinAnsi(text);
        let drawSize = baseSize;
        const w = measurePdfDrawnWidth(font, clean, baseSize);
        if (w > colWidth && w > 0) {
          drawSize = Math.max(6.8, (baseSize * colWidth) / w);
        }
        page.drawText(clean, {
          x,
          y,
          size: drawSize,
          font,
          color: COLOR_BLACK,
        });
      };

      let labelY = boxBottomY - 14;
      drawFittedMetaLine(`Nama     : ${signerName}`, labelY, 9.5, fontBold);
      labelY -= 13;
      drawFittedMetaLine(`Jabatan  : ${signerTitle}`, labelY, 9.5, fontRegular);
      labelY -= 13;
      drawFittedMetaLine(`Tanggal  : ${signedAt}`, labelY, 9, fontRegular);

      // Layer tanda tangan di atas garis (ukuran & posisi seragam dengan AlinLabs, tanpa mencoret teks nama di bawah)
      if (isAlinLabsParty) {
        await drawAlinLabsStampAndSignature(pdfDoc, page, assets, {
          boxX: x,
          boxBottomY,
          boxWidth,
          boxHeight,
          customSignatureDataUrl: signatureUrl,
        });
      } else if (imgBytes) {
        try {
          const pngImg = await pdfDoc.embedPng(imgBytes);
          const maxSigW = Math.min(SIGNATURE_MAX_WIDTH_PT, boxWidth - 24);
          const maxSigH = Math.min(SIGNATURE_MAX_HEIGHT_PT, boxHeight - 2);
          const dims = pngImg.scaleToFit(maxSigW, maxSigH);
          page.drawImage(pngImg, {
            x: x + (boxWidth - dims.width) / 2,
            y: boxBottomY + 3,
            width: dims.width,
            height: dims.height,
          });
        } catch {
          // Ignore invalid PNG gracefully
        }
      }

      return labelY;
    };

    const endLeftY = await drawPartyColumn(
      leftX,
      'PIHAK PERTAMA',
      leftCompLines,
      null,
      block.firstPartySignerName,
      block.firstPartySignerTitle,
      block.firstPartySignedAt,
      block.firstPartySignatureUrl,
      false
    );

    const secondPartySubtitle =
      block.secondPartyCommercial &&
      block.secondPartyCommercial.trim() !== block.secondPartyCompany.trim()
        ? `(${block.secondPartyCommercial})`
        : null;

    const endRightY = await drawPartyColumn(
      rightX,
      'PIHAK KEDUA',
      rightCompLines,
      secondPartySubtitle,
      block.secondPartySignerName,
      block.secondPartySignerTitle,
      block.secondPartySignedAt,
      block.secondPartySignatureUrl,
      true
    );

    cursorY = Math.min(endLeftY, endRightY) - 12;
  };

  // Render all blocks sequentially
  for (const block of model.blocks) {
    switch (block.type) {
      case 'header-title': {
        recordAnchor(block.anchorId);
        // Header kop surat hanya muncul di halaman pertama isi kontrak (Page 2 setelah Cover)
        if (pages.length === 2) {
          cursorY = await drawAlinLabsLetterhead(
            pdfDoc,
            page,
            assets,
            { fontRegular, fontBold, fontItalic },
            {
              name: doc.secondParty.legalName || doc.secondParty.commercialName,
              businessField: doc.secondParty.businessField,
              address: doc.secondParty.address,
              phone: doc.secondParty.phone,
              email: doc.secondParty.email,
              website: 'www.alinlabs.biz.id',
            },
            {
              marginLeft: CONTRACT_MARGIN_LEFT_PT,
              marginRight: CONTRACT_MARGIN_RIGHT_PT,
              topBaselineY: 788,
            }
          );
        } else {
          ensureSpace(72);
        }

        // Judul dokumen berada di bawah header (kop surat)
        drawCenteredBoldHeading(block.title, 14, 17, false, true);
        drawCenteredBoldHeading(block.subtitle, 14, 17, false, true);
        drawCenteredBoldHeading(block.contractNumber, 12, 15, false, false);
        cursorY -= 6;
        break;
      }

      case 'section-label': {
        ensureSpace(72);
        recordAnchor(block.anchorId);
        cursorY -= 2;
        if (block.align === 'center') {
          drawCenteredBoldHeading(block.text, BODY_FONT_SIZE, 14);
        } else {
          drawStyledSingleLine(
            block.text,
            CONTRACT_MARGIN_LEFT_PT,
            cursorY,
            CONTRACT_CONTENT_WIDTH_PT,
            BODY_FONT_SIZE,
            {
              bold: true,
              align: 'left',
            }
          );
          cursorY -= 14;
        }
        break;
      }

      case 'paragraph': {
        drawParagraph(block.text, {
          align: block.align,
          bold: block.bold,
          italic: block.italic,
          spaceAfter: block.spaceAfter,
        });
        break;
      }

      case 'article-heading': {
        // Keep-with-next protection: ensure heading + at least 3 body lines fit on page
        ensureSpace(60);
        recordAnchor(block.anchorId);
        cursorY -= 3;
        drawCenteredBoldHeading(`PASAL ${block.articleNumber}`, BODY_FONT_SIZE, 14);
        drawCenteredBoldHeading(block.title, BODY_FONT_SIZE, 13.5);
        cursorY -= 3;
        break;
      }

      case 'numbered-paragraph': {
        const safeLabel = sanitizeWinAnsi(block.indexLabel);
        const indentLeft = 24;
        const maxWidth = CONTRACT_CONTENT_WIDTH_PT - indentLeft;
        const { lines, isParagraphEnd } = wrapStyledTextWords(
          block.text,
          fontRegular,
          fontItalic,
          BODY_FONT_SIZE,
          maxWidth,
          false,
          fontBold,
          fontBoldItalic
        );

        const hasHeadingLineBreak = block.text.includes('\n');
        if (hasHeadingLineBreak && lines.length >= 2) {
          const minKeepLines = Math.min(lines.length, 3);
          ensureSpace(minKeepLines * BODY_LINE_HEIGHT);
        }

        for (let i = 0; i < lines.length; i++) {
          ensureSpace(BODY_LINE_HEIGHT);
          if (i === 0) {
            page.drawText(safeLabel, {
              x: CONTRACT_MARGIN_LEFT_PT,
              y: cursorY,
              size: BODY_FONT_SIZE,
              font: fontRegular,
              color: COLOR_BLACK,
            });
          }
          const words = lines[i];
          if (words.length > 0) {
            drawStyledLine(
              page,
              words,
              CONTRACT_MARGIN_LEFT_PT + indentLeft,
              cursorY,
              maxWidth,
              fontRegular,
              fontItalic,
              BODY_FONT_SIZE,
              'justify',
              isParagraphEnd[i],
              COLOR_BLACK,
              fontBold,
              fontBoldItalic
            );
          }
          cursorY -= BODY_LINE_HEIGHT;
        }
        cursorY -= 3.5;
        break;
      }

      case 'key-value-table': {
        drawKeyValueTable(block.title, block.rows, block.valueAlign ?? 'left');
        break;
      }

      case 'data-table': {
        drawDataTable(block.title, block.columns, block.rows, block.summaryLines);
        break;
      }

      case 'signature-block': {
        await drawSignatureBlock(block);
        break;
      }
    }
  }

  // Apply clean footers on body pages (skip Cover Page 1), respecting 4-4-3-3 cm left/right margins
  const totalPages = pages.length;
  const totalBodyPages = Math.max(1, totalPages - 1);
  const footerLinkText = 'www.alinlabs.biz.id';
  pages.forEach((p, idx) => {
    if (idx === 0) return; // Cover page does not have running footer/page number
    const bodyPageNum = idx;
    const footerY = 46;

    p.drawLine({
      start: { x: CONTRACT_MARGIN_LEFT_PT, y: footerY + 11 },
      end: { x: A4_WIDTH_PT - CONTRACT_MARGIN_RIGHT_PT, y: footerY + 11 },
      thickness: 0.4,
      color: COLOR_BORDER,
    });

    p.drawText(footerLinkText, {
      x: CONTRACT_MARGIN_LEFT_PT,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: COLOR_BLACK,
    });

    const linkWidth = measurePdfDrawnWidth(fontRegular, footerLinkText, 8);
    const linkAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [CONTRACT_MARGIN_LEFT_PT, footerY - 2, CONTRACT_MARGIN_LEFT_PT + linkWidth, footerY + 9],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of('https://www.alinlabs.biz.id'),
      },
    });
    p.node.addAnnot(pdfDoc.context.register(linkAnnot));

    const pageStr = `Hal. ${bodyPageNum} dari ${totalBodyPages}`;
    const psW = measurePdfDrawnWidth(fontRegular, pageStr, 8);
    p.drawText(pageStr, {
      x: A4_WIDTH_PT - CONTRACT_MARGIN_RIGHT_PT - psW,
      y: footerY,
      size: 8,
      font: fontRegular,
      color: COLOR_BLACK,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, pageCount: totalPages, anchorPages };
}
