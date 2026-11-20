self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let data = { title: 'Oriental Riders', body: '¡Nuevo envío listo para recoger!' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      vibrate: Array.of(600, 200, 600, 200, 800),
      tag: 'envio-push-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list.at(0).focus();
      return self.clients.openWindow('/');
    })
  );
});
