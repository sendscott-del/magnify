// Magnify service worker.
// Sole job today: receive a Web Push with `{ count: N }` and update the
// home-screen app-icon badge via the Web App Badging API. We deliberately
// do not show a notification — the badge is the whole UX.

self.addEventListener('install', (event) => {
  // Take control on first install so the very next page load is governed
  // by this SW (otherwise the user has to reload before pushes start
  // routing through here).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let count = 0;
  try {
    if (event.data) {
      const payload = event.data.json();
      if (typeof payload.count === 'number') count = payload.count;
    }
  } catch (e) {
    // Non-JSON payload — leave count at 0 so we clear the badge.
  }

  event.waitUntil((async () => {
    try {
      if (count > 0 && self.navigator && 'setAppBadge' in self.navigator) {
        await self.navigator.setAppBadge(count);
      } else if (self.navigator && 'clearAppBadge' in self.navigator) {
        await self.navigator.clearAppBadge();
      }
    } catch (err) {
      // Some browsers require a notification alongside a push or they'll
      // surface a generic "site updated in the background" message. We
      // accept that tradeoff; the badge alone is the user-facing signal.
    }
  })());
});

// If a (rare) notification ever fires, focus the app instead of opening
// a new tab. Defensive — we don't show notifications today.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('/');
  })());
});
