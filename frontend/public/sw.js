/* Zykor Service Worker — Web Push */
/* eslint-disable no-undef */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe o push do servidor e mostra a notificação (funciona com o app fechado)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Zykor', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Zykor';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logos/logo_zykor.png',
    badge: data.badge || '/favicons/zykor/favicon.ico',
    tag: data.tag || 'zykor',
    renotify: !!data.tag,
    requireInteraction: !!data.requireInteraction,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique abre/foca a janela na URL da notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
