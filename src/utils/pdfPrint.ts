export interface PdfBlobPrintOptions {
  title?: string;
  scale?: number;
}

export interface PrintableHtmlBuildResult {
  html: string;
  htmlBlob: Blob;
}

const BLOB_REVOKE_DELAY_MS = 5 * 60 * 1000;
const activeBlobUrls = new Set<string>();
let unloadListenerRegistered = false;

function registerUnloadCleanup(): void {
  if (unloadListenerRegistered || typeof window === 'undefined') return;
  unloadListenerRegistered = true;
  window.addEventListener('beforeunload', () => {
    for (const url of activeBlobUrls) {
      URL.revokeObjectURL(url);
    }
    activeBlobUrls.clear();
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createPdfBlob(pdfBytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export function buildPrintableHtmlDocument(
  pageImageUrls: string[],
  title = 'Cetak Dokumen PDF'
): PrintableHtmlBuildResult {
  const safeTitle = escapeHtml(title);
  const pagesMarkup = pageImageUrls
    .map(
      (url, index) =>
        `<section class="print-page" aria-label="Halaman ${index + 1}"><img src="${escapeHtml(url)}" alt="Halaman ${index + 1}" /></section>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-sheet-list {
        margin: 0;
        padding: 0;
      }
      .print-page {
        width: 210mm;
        height: 296.5mm;
        margin: 0 auto;
        padding: 0;
        overflow: hidden;
        background: #ffffff;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .print-page img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <main class="print-sheet-list">
${pagesMarkup}
    </main>
  </body>
</html>`;

  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return { html, htmlBlob };
}

export function openPdfBlobInNewTab(pdfBytes: Uint8Array): string {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Dokumen browser tidak tersedia untuk membuka pratinjau PDF.');
  }

  registerUnloadCleanup();

  const pdfBlob = createPdfBlob(pdfBytes);
  const blobUrl = URL.createObjectURL(pdfBlob);
  activeBlobUrls.add(blobUrl);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    if (activeBlobUrls.has(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
      activeBlobUrls.delete(blobUrl);
    }
  }, BLOB_REVOKE_DELAY_MS);

  return blobUrl;
}

export async function printPdfFromBytes(
  pdfBytes: Uint8Array,
  _options: PdfBlobPrintOptions = {}
): Promise<void> {
  openPdfBlobInNewTab(pdfBytes);
}
