// Minimal service worker — required for installability.
// Network-first so deploys show immediately; cache is only an offline fallback.
const CACHE = 'badminton-admin-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // never cache API calls or the version check — always hit the network so we
  // don't serve stale session/court data; the app handles offline itself.
  if (req.url.includes('/api/') || req.url.includes('/version.json')) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
  )
})
