export const PDF_ASSET_PATHS = {
  logo: '/logo-alinlabs.webp',
  shansusLogo: '/shansudar-logo.webp',
  stempel: '/stempel-alinlabs.webp',
  signatureAlvareza: '/tanda-tangan-alvareza.webp',
  seabankLogo: '/seabank-logo.webp',
} as const;

export interface AlinLabsPdfAssets {
  logoPng: Uint8Array | null;
  shansusLogoPng: Uint8Array | null;
  stempelPng: Uint8Array | null;
  signatureAlvarezaPng: Uint8Array | null;
  seabankLogoPng?: Uint8Array | null;
}

const pngAssetCache = new Map<string, Promise<Uint8Array | null>>();

export function registerPdfPngAssetCache(path: string, bytes: Uint8Array): void {
  pngAssetCache.set(path, Promise.resolve(bytes));
}

export function clearPdfAssetCache(): void {
  pngAssetCache.clear();
}

async function decodeAndConvertWebpBlobToPng(
  blob: Blob,
  maxDimension: number
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;

  let source: CanvasImageSource;
  let srcWidth = 0;
  let srcHeight = 0;
  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob);
      source = bitmap;
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
    } else {
      objectUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Gagal memuat gambar WebP'));
        el.src = objectUrl!;
      });
      source = img;
      srcWidth = img.naturalWidth || img.width;
      srcHeight = img.naturalHeight || img.height;
    }

    if (srcWidth <= 0 || srcHeight <= 0) return null;

    const maxSide = Math.max(srcWidth, srcHeight);
    const scale = maxDimension > 0 && maxSide > maxDimension ? maxDimension / maxSide : 1;
    const targetW = Math.max(1, Math.round(srcWidth * scale));
    const targetH = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetW, targetH);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!pngBlob) return null;

    const buf = await pngBlob.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function loadPublicWebpAsPngBytes(
  path: string,
  maxDimension = 640
): Promise<Uint8Array | null> {
  const existing = pngAssetCache.get(path);
  if (existing) {
    return existing;
  }

  const pending = (async (): Promise<Uint8Array | null> => {
    if (typeof document === 'undefined' || typeof fetch !== 'function') {
      return null;
    }
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await decodeAndConvertWebpBlobToPng(blob, maxDimension);
    } catch {
      return null;
    }
  })();

  pngAssetCache.set(path, pending);
  return pending;
}

export async function loadAlinLabsPdfAssets(): Promise<AlinLabsPdfAssets> {
  const [logoPng, shansusLogoPng, stempelPng, signatureAlvarezaPng, seabankLogoPng] =
    await Promise.all([
      loadPublicWebpAsPngBytes(PDF_ASSET_PATHS.logo, 256),
      loadPublicWebpAsPngBytes(PDF_ASSET_PATHS.shansusLogo, 256),
      loadPublicWebpAsPngBytes(PDF_ASSET_PATHS.stempel, 520),
      loadPublicWebpAsPngBytes(PDF_ASSET_PATHS.signatureAlvareza, 646),
      loadPublicWebpAsPngBytes(PDF_ASSET_PATHS.seabankLogo, 360),
    ]);
  return { logoPng, shansusLogoPng, stempelPng, signatureAlvarezaPng, seabankLogoPng };
}
