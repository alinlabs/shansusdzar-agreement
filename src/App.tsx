import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceRoute } from './components/layout/Header';
import { ContractWorkspace } from './pages/ContractWorkspace';
import { InvoiceWorkspace } from './pages/InvoiceWorkspace';
import { resolveRouteSeoMeta } from './utils/seoMeta';

function resolveRouteFromPath(pathname: string): { route: WorkspaceRoute; shouldNormalize: boolean } {
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if (cleaned === '/penawaran' || cleaned === '/invoice') {
    return { route: '/penawaran', shouldNormalize: pathname !== '/penawaran' };
  }
  if (cleaned === '/kontrak') {
    return { route: '/kontrak', shouldNormalize: pathname !== '/kontrak' };
  }
  return { route: '/kontrak', shouldNormalize: true };
}

export default function App() {
  const [route, setRoute] = useState<WorkspaceRoute>(() => {
    if (typeof window === 'undefined') return '/kontrak';
    return resolveRouteFromPath(window.location.pathname).route;
  });

  useEffect(() => {
    const { route: resolved, shouldNormalize } = resolveRouteFromPath(window.location.pathname);
    if (shouldNormalize) {
      const target = `${resolved}${window.location.search}${window.location.hash}`;
      window.history.replaceState(null, '', target);
    }
    setRoute(resolved);

    const handlePopState = () => {
      const next = resolveRouteFromPath(window.location.pathname);
      setRoute(next.route);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const meta = resolveRouteSeoMeta(route, origin);
    document.title = meta.title;

    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', meta.canonicalUrl);
    upsertMeta('property', 'og:image', meta.imageUrl);
    upsertMeta('property', 'og:image:secure_url', meta.imageUrl);
    upsertMeta('property', 'og:image:alt', meta.imageAlt);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', meta.imageUrl);
    upsertMeta('name', 'twitter:image:alt', meta.imageAlt);

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', meta.canonicalUrl);
    }
  }, [route]);

  const navigate = useCallback((target: WorkspaceRoute) => {
    const normalized = target === '/invoice' ? '/penawaran' : target;
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, '', normalized);
    }
    setRoute(normalized);
  }, []);

  if (route === '/penawaran' || route === '/invoice') {
    return <InvoiceWorkspace onNavigate={navigate} />;
  }

  return <ContractWorkspace onNavigate={navigate} />;
}
