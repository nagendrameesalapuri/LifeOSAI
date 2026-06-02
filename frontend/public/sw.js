const CACHE = 'lifeos-v1';
const STATIC_CACHE = 'lifeos-static-v1';

// App shell — always cache these
const SHELL = [
  '/',
  '/dashboard',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and backend API calls
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.port === '3001') return; // backend API — always network

  // Next.js internals (_next/webpack-hmr etc) — network only
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // Static assets: Next.js chunks, fonts, icons — Cache First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ico)$/)
  ) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Auth API routes — network only
  if (url.pathname.startsWith('/api/auth/')) return;

  // Next.js API routes — network first, short timeout
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(request, 4000));
    return;
  }

  // HTML navigation — network first, fallback to cache or offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(navigationHandler(request));
    return;
  }

  // Everything else — stale while revalidate
  e.respondWith(staleWhileRevalidate(request));
});

// ─── Strategies ────────────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, timeout = 5000) {
  const cache = await caches.open(CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((r) => {
    if (r.ok) cache.put(request, r.clone());
    return r;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to dashboard (cached during install)
    return caches.match('/dashboard') || caches.match('/');
  }
}
