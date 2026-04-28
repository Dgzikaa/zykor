// ============================================================================
// Service Worker auto-destruct (2026-04-28)
//
// Por que: o SW antigo cacheava paginas dinamicas (estrategico/desempenho etc)
// com estrategia "cache-first" sem TTL. Resultado: usuarios viam dados de dias
// atras mesmo apos F5/Ctrl+R. Projeto nao usa PWA real (offline, push), entao
// optamos por matar os SWs e voltar ao cache padrao do navegador.
//
// Este SW:
// 1. No install: ativa imediatamente (skipWaiting)
// 2. No activate: limpa todos os caches, toma controle dos clientes,
//    desregistra a si mesmo, e recarrega todas as abas abertas
// 3. NAO intercepta nenhum fetch (sem listener 'fetch' = network default)
//
// Apos rodar uma vez por cliente, o SW some completamente. Pode deletar este
// arquivo no proximo deploy quando confirmar que ninguem mais tem SW antigo.
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
