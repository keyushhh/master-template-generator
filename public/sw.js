/**
 * Offline, and installable.
 *
 * The app is already entirely client-side: decks live in localStorage, video in
 * IndexedDB, and nothing it does needs a server once the files have arrived.
 * The one thing standing between that and working on a plane was the files
 * themselves, which is this.
 *
 * Two strategies, on purpose:
 *
 *  - Navigations go to the network first and fall back to the cached shell.
 *    A cache-first navigation is how an app gets stuck on a build from last
 *    month, and a deck tool that will not update is worse than one that needs
 *    a connection to update.
 *  - Everything else (the hashed JS and CSS bundles, fonts, the icons) is
 *    cache-first. Vite fingerprints those filenames, so a cached one can never
 *    be the wrong version of itself.
 *
 * CACHE is bumped by hand when this file changes; the activate handler then
 * deletes every older cache, so an old build's assets do not accumulate.
 */

const CACHE = 'wozku-v2';

/** The shell, so a first offline open has something to render. */
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

/** Cross-origin hosts worth keeping: the brand faces the UI is set in. */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one 404 does not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Opaque cross-origin font responses are cacheable and worth caching:
          // without them the UI falls back to a system face offline.
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
    })
  );
});
