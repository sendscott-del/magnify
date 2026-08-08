// Magnify service worker.
// Receives a Web Push with `{ count: N }` and updates the home-screen icon
// badge via the Web App Badging API. Where badging is unsupported (Android
// Chrome — no setAppBadge), we show a real notification instead; otherwise
// the user would see NOTHING when a push arrives. Platforms with badging
// (iOS PWA, desktop) keep the silent badge-only UX.

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
    const canBadge = self.navigator && 'setAppBadge' in self.navigator;
    try {
      if (count > 0 && canBadge) {
        await self.navigator.setAppBadge(count);
      } else if (canBadge && 'clearAppBadge' in self.navigator) {
        await self.navigator.clearAppBadge();
      }
    } catch (err) {
      // Badging failed — fall through; the notification path below still runs
      // on platforms without badging.
    }
    if (!canBadge && count > 0) {
      // Android Chrome has no Badging API — show a real notification so the
      // push isn't invisible. tag replaces the previous one (no stacking).
      try {
        await self.registration.showNotification('Magnify', {
          body: count === 1
            ? '1 calling needs your action'
            : count + ' callings need your action',
          tag: 'magnify-action-count',
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: { url: '/' },
        });
      } catch (err) { /* notification blocked — nothing more we can do */ }
    } else if (!canBadge && count === 0) {
      // Count went to zero — retract the standing notification if present.
      try {
        const existing = await self.registration.getNotifications({ tag: 'magnify-action-count' });
        for (const n of existing) n.close();
      } catch (err) { /* ignore */ }
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
