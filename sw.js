/* Comptoir SAV NouR’s : fonctionnement hors connexion.
   Changer VERSION à chaque nouvelle version de l’application. */
const VERSION = 'comptoir-sav-2026-10-07';
const FONTS = 'comptoir-sav-polices';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La page : on ouvre tout de suite la copie gardée, et on la met à jour en arrière-plan.
  if (req.mode === 'navigate') {
    const update = fetch(req).then(async res => {
      if (res && res.ok) { const cache = await caches.open(VERSION); await cache.put('./index.html', res.clone()); }
      return res;
    }).catch(() => null);
    event.waitUntil(update);
    event.respondWith(
      caches.match('./index.html').then(hit => hit || update.then(res => res || new Response('Pas de connexion. Ouvrez le jeu une première fois avec Internet.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}})))
    );
    return;
  }

  // Les polices Google : gardées pour le hors connexion.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONTS).then(cache => cache.match(req).then(hit => {
      const update = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || update;
    })));
    return;
  }

  // Les fichiers du jeu (icônes, manifeste) : copie gardée d’abord.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(cache => cache.put(req, copy)); }
      return res;
    })));
  }
});
