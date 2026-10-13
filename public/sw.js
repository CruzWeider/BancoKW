const CACHE_NAME = 'banco-kw-pwa-v1';

const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/cities/lisboa.jpg',
  '/cities/ottawa.jpg',
  '/cities/cairo.jpg',
  '/cities/cia-ferroviaria.jpg',
  '/cities/santiago.jpg',
  '/cities/dublin.jpg',
  '/cities/bangcoc.jpg',
  '/cities/tripoli.jpg',
  '/cities/brasilia.jpg',
  '/cities/oslo.jpg',
  '/cities/cia-aviacao.jpg',
  '/cities/kuala-lumpur.jpg',
  '/cities/londres.jpg',
  '/cities/estocolmo.jpg',
  '/cities/amsterda.jpg',
  '/cities/atenas.jpg',
  '/cities/buenos-aires.jpg',
  '/cities/havana.jpg',
  '/cities/cia-navegacao.jpg',
  '/cities/hanoi.jpg',
  '/cities/caracas.jpg',
  '/cities/madri.jpg',
  '/cities/roma.jpg',
  '/cities/moscou.jpg',
  '/cities/cia-onibus.jpg',
  '/cities/paris.jpg',
  '/cities/nova-delhi.jpg',
  '/cities/berlim.jpg',
  '/cities/varsovia.jpg',
  '/cities/washington.jpg',
  '/cities/viena.jpg',
  '/cities/pequim.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Ignora caso algum arquivo ainda esteja sendo carregado
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca faz cache das rotas de API em tempo real (/api/*) nem de arquivos de desenvolvimento do Vite
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Estratégia Cache-First para fotos das cidades, companhias e ícones do PWA
  if (
    url.pathname.startsWith('/cities/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Estratégia Network-First com fallback para cache na navegação principal
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
