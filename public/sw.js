// 食刻管理 Service Worker
// 每次部署新版時更新此版本號，瀏覽器會自動偵測並觸發更新
const CACHE_VERSION = 'foodtime-v2.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// App Shell — 離線時至少能顯示基本介面
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: 預快取 App Shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: 清理舊版本快取 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: 依請求類型決定快取策略 ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 GET 請求
  if (request.method !== 'GET') return;

  // 跳過 Firebase / Google API 的即時資料請求（Firestore 自有離線快取）
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com/google.firestore')
  ) {
    return;
  }

  // 圖片：CacheFirst（先快取，沒有才網路）
  if (
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('img.icons8.com') ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // JS/CSS/字型等靜態資源：StaleWhileRevalidate（先顯示快取，背景更新）
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // HTML 導覽請求：NetworkFirst（先試網路，失敗回 App Shell）
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // 其他：NetworkFirst
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
