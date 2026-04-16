const CACHE = 'sfvoice-v1';
const SHELL = [
  '/salesforce-voice-notes/',
  '/salesforce-voice-notes/index.html',
  '/salesforce-voice-notes/manifest.json',
  '/salesforce-voice-notes/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for shell
  if (e.request.url.includes('anthropic.com') || e.request.url.includes('zapier.com')) {
    return; // let network handle it
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
