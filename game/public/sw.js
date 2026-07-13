self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || '',
    icon: '/icons/icon.svg',
    badge: '/icons/badge.svg',
    data: { date: data.date || null, eventId: data.eventId || null },
  };
  if (data.type === 'invited') {
    options.actions = [
      { action: 'read', title: 'Lu' },
      { action: 'open', title: 'Ouvrir' },
      { action: 'edit', title: 'Éditer' },
    ];
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Kalndar', options));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action; // '' si on a cliqué le corps de la notif (pas un bouton)
  event.notification.close();
  if (action === 'read') return; // ferme juste la notif, n'ouvre rien

  const { date, eventId } = event.notification.data || {};
  const edit = action === 'edit';
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (edit && eventId) {
    params.set('event', eventId);
    params.set('edit', '1');
  }
  const url = params.toString() ? `/?${params.toString()}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-action', date, eventId, edit });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
