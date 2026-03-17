/* ── Service Worker — Vault ── */
const CACHE_NAME = 'vault-v11';

/* Fichiers à mettre en cache dès l'installation */
const STATIC_ASSETS = [
  '/SUIVI-FINANCIER/',
  '/SUIVI-FINANCIER/index.html',
  '/SUIVI-FINANCIER/app.css',
  '/SUIVI-FINANCIER/app.js',
  '/SUIVI-FINANCIER/icon-192.png',
  '/SUIVI-FINANCIER/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Outfit:wght@300;500;700&family=DM+Mono:wght@300;400;500&display=swap'
];

/* ── Installation : mise en cache des assets statiques ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activation : suppression des anciens caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch : stratégie selon le type de ressource ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Supabase et APIs externes → toujours réseau (données en temps réel) */
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/realtime/')
  ) {
    return; /* Laisser passer sans interception */
  }

  /* Google Fonts → cache first */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  /* CDN (Chart.js, xlsx) → cache first, réseau en fallback */
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  /* app.css et app.js → network first (pour recevoir les mises à jour)
     puis cache si réseau indisponible */
  if (url.pathname.endsWith('app.css') || url.pathname.endsWith('app.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* index.html et autres pages → network first, cache en fallback */
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* Icônes PNG → network first pour recevoir les mises à jour du logo */
  if (url.pathname.endsWith('.png')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* Tout le reste → cache first */
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

/* ── Message : forcer la mise à jour depuis l'app ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
