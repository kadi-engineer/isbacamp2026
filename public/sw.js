// Minimal service worker for the ISBA Summer Camp app.
//
// Its main job is to make the app installable: Android Chrome only offers its
// native "Install app" prompt for sites that ship a web manifest AND register a
// service worker with a fetch handler. (iPhone "Add to Home Screen" works
// without this, straight from Safari's Share menu.)
//
// The fetch strategy is intentionally conservative — network-first, and the API
// is never touched — so dynamic content (announcements, schedule, rooms,
// carpool, reactions) always comes straight from the server and stays live. The
// cache only provides a fallback copy of static assets when the device is
// offline.

const CACHE = 'isba-camp-shell-v1'

self.addEventListener('install', () => {
  // Activate the new worker immediately rather than waiting for old tabs.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Drop any caches from previous versions, then take control of open pages.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only same-origin GETs are eligible for caching. Anything else — POSTs,
  // cross-origin font/weather requests — passes through untouched.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache the API: announcements and other data must always be fresh.
  if (url.pathname.startsWith('/api/')) return

  // Network-first: serve the live response, quietly refreshing the cached copy,
  // and fall back to the cache only when the network is unavailable.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})

// ── Push notifications ────────────────────────────────────────────────────────
// When an admin posts an announcement, the server sends a push message to every
// opted-in device. The browser wakes this worker to display it — even when the
// app is closed. (iPhones only deliver these once the app has been added to the
// home screen.)

const NOTIF_ICON = '/.netlify/images?url=/logo-emblem.png&w=192&fm=png'

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'ISBA Summer Camp 2026'
  const options = {
    body: data.body || 'New announcement',
    icon: NOTIF_ICON,
    badge: NOTIF_ICON,
    // One tag per announcement keeps a repeat delivery from stacking up.
    tag: data.tag || 'announcement',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  // Focus an already-open tab if there is one; otherwise open the app fresh.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow(target)
      }),
  )
})
