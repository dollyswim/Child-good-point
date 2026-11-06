/* 親子集點 Service Worker：離線可用。資料存在 localStorage，不受快取影響。 */
var CACHE = 'cgp-shell-v5';
var SHELL = [
  './', 'index.html', 'css/style.css', 'js/store.js', 'js/rules-csv.js', 'js/report.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 網路優先（確保更新即時生效），離線或伺服器錯誤時改用快取
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // cache: 'no-cache'：每次都向伺服器確認是否有新版（沒變時只回 304，很快），避免瀏覽器暫存讓更新延遲
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('bad response');
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
