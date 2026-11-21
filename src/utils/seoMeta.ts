export type DocumentSeoRoute = '/kontrak' | '/penawaran';

export interface RouteSeoMetadata {
  route: DocumentSeoRoute;
  title: string;
  description: string;
  siteName: string;
  imagePath: string;
  imageUrl: string;
  imageAlt: string;
  imageType: string;
  imageWidth: number;
  imageHeight: number;
  canonicalPath: string;
  canonicalUrl: string;
}

const CONTRACT_SEO = {
  route: '/kontrak' as const,
  title: 'Surat Perjanjian Kerja Sama — PT Shansus Dzar Indonesia × AlinLabs Indonesia',
  description:
    'Tinjau dan tandatangani Surat Perjanjian Kerja Sama jasa pembuatan dan pengembangan website PT Shansus Dzar Indonesia × AlinLabs Indonesia.',
  siteName: 'ALINLABS INDONESIA',
  imagePath: '/kontrak-metatag.webp',
  imageAlt: 'Surat Perjanjian Kerja Sama — Shansus Dzar Indonesia & AlinLabs Indonesia',
  imageType: 'image/webp',
  imageWidth: 1448,
  imageHeight: 1086,
  canonicalPath: '/kontrak',
};

const QUOTATION_SEO = {
  route: '/penawaran' as const,
  title: 'Surat Penawaran — PT Shansus Dzar Indonesia × AlinLabs Indonesia',
  description:
    'Tinjau Surat Penawaran Resmi (Quotation) jasa pembuatan dan pengembangan website PT Shansus Dzar Indonesia × AlinLabs Indonesia.',
  siteName: 'ALINLABS INDONESIA',
  imagePath: '/kontrak-penawaran.webp',
  imageAlt: 'Surat Penawaran — Shansus Dzar Indonesia & AlinLabs Indonesia',
  imageType: 'image/webp',
  imageWidth: 1448,
  imageHeight: 1086,
  canonicalPath: '/penawaran',
};

export function resolveSeoRouteFromPath(pathname: string): DocumentSeoRoute {
  const cleaned = (pathname || '/').replace(/\/+$/, '') || '/';
  if (cleaned === '/penawaran' || cleaned === '/invoice') {
    return '/penawaran';
  }
  return '/kontrak';
}

export function resolveRouteSeoMeta(pathname: string, baseOrigin = ''): RouteSeoMetadata {
  const route = resolveSeoRouteFromPath(pathname);
  const base = route === '/penawaran' ? QUOTATION_SEO : CONTRACT_SEO;
  const cleanOrigin = baseOrigin.replace(/\/+$/, '');
  return {
    ...base,
    imageUrl: cleanOrigin ? `${cleanOrigin}${base.imagePath}` : base.imagePath,
    canonicalUrl: cleanOrigin ? `${cleanOrigin}${base.canonicalPath}` : base.canonicalPath,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildSeoMetaHtmlBlock(meta: RouteSeoMetadata): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const siteName = escapeHtml(meta.siteName);
  const imageUrl = escapeHtml(meta.imageUrl);
  const imageAlt = escapeHtml(meta.imageAlt);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: meta.title,
    description: meta.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    inLanguage: 'id-ID',
    url: meta.canonicalUrl,
    image: meta.imageUrl,
    publisher: {
      '@type': 'Organization',
      name: 'AlinLabs Indonesia',
    },
  }).replace(/</g, '\\u003c');

  return `<!-- SEO_META_START -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="id_ID" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="${meta.imageType}" />
    <meta property="og:image:width" content="${meta.imageWidth}" />
    <meta property="og:image:height" content="${meta.imageHeight}" />
    <meta property="og:image:alt" content="${imageAlt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:image:alt" content="${imageAlt}" />
    <script type="application/ld+json">${jsonLd}</script>
    <!-- SEO_META_END -->`;
}

export function injectRouteMetaIntoHtml(html: string, pathname: string, baseOrigin = ''): string {
  const meta = resolveRouteSeoMeta(pathname, baseOrigin);
  const block = buildSeoMetaHtmlBlock(meta);
  const markerRegex = /<!-- SEO_META_START -->[\s\S]*?<!-- SEO_META_END -->/;
  if (markerRegex.test(html)) {
    return html.replace(markerRegex, block);
  }
  return html.replace('</head>', `${block}\n  </head>`);
}
