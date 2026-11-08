/* 親子集點 Service Worker：離線可用。資料存在 localStorage，不受快取影響。 */
var CACHE = 'cgp-shell-v103';
var SHELL = [
  './', 'index.html', 'css/style.css', 'js/store.js', 'js/rules-csv.js', 'js/report.js', 'js/board-gold.js', 'js/board-gold-02.js', 'js/board-gold-03.js', 'js/board-gold-04.js', 'js/game.js', 'js/art.js', 'js/app.js',
  'manifest.webmanifest', 'images/gold-island.webp', 'images/gold/region01.webp', 'images/gold/region02.webp', 'images/gold/region03.webp', 'images/gold/region04.webp', 'images/gold/tower_off.webp', 'images/gold/tower_on.webp', 'images/gold/technician.webp', 'images/gold/stone.webp', 'images/gold/ore.webp', 'images/gold/minecart.webp', 'images/gold/rail_before.webp', 'images/gold/rail_after.webp', 'images/wood/leaf_bg.webp', 'images/wood/leaf_pile.webp', 'images/wood/leaf_pinecone.webp', 'images/wood/leaf_squirrel.webp', 'images/wood/leaf_empty.webp', 'images/mascot.webp', 'images/float-castle.webp', 'images/chest.webp',
  'images/characters/roundear.webp', 'images/characters/longear.webp', 'images/characters/horn.webp', 'images/characters/wing.webp',
  'images/characters/drop.webp', 'images/characters/sprout.webp', 'images/characters/flame.webp', 'images/characters/stone.webp', 'images/items/dice_6.webp', 'images/items/dice_12.webp', 'images/items/roller_skate.webp', 'images/islands/wood.webp', 'images/islands/water.webp', 'images/islands/fire.webp', 'images/islands/earth.webp', 'images/items/star.webp', 'images/tiles/start.webp', 'images/tiles/chest.webp', 'images/tiles/chance.webp', 'images/tiles/minigame.webp', 'images/tiles/finish.webp', 'images/tiles/door.webp', 'images/tiles/shop.webp', 'images/tiles/fate.webp', 'images/minigame/bg.webp', 'images/minigame/star.webp', 'images/items/shield.webp', 'images/items/magic_dice.webp', 'images/items/lucky_medal.webp', 'images/items/flying_wings.webp', 'images/items/magic_door.webp', 'images/items/mystery_chest.webp', 'images/items/airplane.webp', 'images/items/golden_key.webp', 'images/items/treasure_magnet.webp', 'images/items/reroll_ticket.webp', 'images/items/bonus_play.webp', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
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
