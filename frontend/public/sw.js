// Service Worker com estratÃ©gia NETWORK FIRST
// VersÃ£o atualizada automaticamente a cada deploy
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = 'zykor-cache-' + CACHE_VERSION;

// Arquivos que podem ser cacheados para offline
const OFFLINE_CACHE = [
  '/offline.html'
];

// Install - prÃ©-cachear apenas recursos essenciais offline
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);
  // ForÃ§a o novo SW a tomar controle imediatamente
  self.skipWaiting();
});

// Activate - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zykor-cache-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // ForÃ§a todos os clients a usar o novo SW
      return self.clients.claim();
    })
  );
});

// Fetch - NETWORK FIRST para tudo (exceto assets estÃ¡ticos)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorar requests que nÃ£o sÃ£o HTTP/HTTPS
  if (!url.protocol.startsWith('http')) return;
  
  // Ignorar APIs externas
  if (!url.origin.includes('zykor.com.br') && !url.origin.includes('localhost')) return;
  
  // Para APIs, sempre network only (sem cache)
  if (url.pathname.startsWith('/api/')) {
    return; // Deixa o browser lidar normalmente
  }
  
  // Para assets estÃ¡ticos (_next/static), podemos cachear
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
  
  // Para todo o resto (HTML, JS dinÃ¢mico), NETWORK FIRST
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se conseguiu da rede, retorna (nÃ£o cacheia HTML/JS dinÃ¢mico)
        return response;
      })
      .catch(() => {
        // Se offline, tenta o cache
        return caches.match(event.request);
      })
  );
});

// Listener para mensagens do app (forÃ§ar update)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
