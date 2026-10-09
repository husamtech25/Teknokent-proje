// ============================================================
// 🚀 EcoAcoustic-AI — Service Worker
// Offline cache + Push notification
// ============================================================

const CACHE_NAME = 'ecoacoustic-v4.0';
const RUNTIME_CACHE = 'ecoacoustic-runtime-v4.0';

// Önceden cache'lenecek dosyalar
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap'
];

// ---------- KURULUM ----------
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Kurulum');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache açıldı');
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.warn('⚠️ Bazı dosyalar cache\'lenemedi:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ---------- AKTİVASYON ----------
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Aktif');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('🗑️ Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ---------- FETCH (Cache stratejisi) ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sadece GET isteklerini cache'le
  if (request.method !== 'GET') return;

  // Chrome extension'ları atla
  if (url.protocol === 'chrome-extension:') return;

  // Harita tile'ları için network-first
  if (url.hostname.includes('tile') || url.hostname.includes('arcgisonline')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Diğer istekler için cache-first
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((response) => {
          // Başarılı yanıtı cache'e ekle
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Offline fallback
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ---------- PUSH NOTIFICATION ----------
self.addEventListener('push', (event) => {
  console.log('🔔 Push bildirim geldi');
  
  let data = {
    title: '🚨 EcoAcoustic Alarm',
    body: 'Yeni tehdit tespit edildi',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'ecoacoustic-alert',
    requireInteraction: true,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    tag: data.tag || 'ecoacoustic-alert',
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: '🎯 Aç' },
      { action: 'close', title: 'Kapat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ---------- BİLDİRİM TIKLAMA ----------
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Bildirime tıklandı:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Açık pencere var mı?
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Yoksa yeni pencere aç
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ---------- MESAJLAŞMA ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});

console.log('🚀 Service Worker yüklendi');
