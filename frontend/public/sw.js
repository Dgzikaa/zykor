// ============================================================================
// Service Worker auto-destruct (2026-04-28)
// Ver sw-zykor.js para contexto completo. Mesmo comportamento.
// ============================================================================

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) { /* swallow */ }

      try {
        await self.clients.claim();
      } catch (_) { /* swallow */ }

      try {
        await self.registration.unregister();
      } catch (_) { /* swallow */ }

      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch (_) { /* swallow */ }
    })()
  );
});
