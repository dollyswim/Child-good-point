/* 親子集點 Service Worker：離線可用。資料存在 localStorage，不受快取影響。 */
var CACHE = 'cgp-shell-v149';
// 2026-11-09：其他島（木島以後）的大廳插圖、木島劇情圖不預先下載，第一次用到才下載並存進圖片快取（金島小遊戲用的落葉找松果圖保留）
var SHELL = [
  'images/challenge_scroll.webp', 'images/challenge_medal.webp', 'images/challenge_done.webp',
  'images/plaque/home2.webp', 'images/plaque/child.webp', 'images/plaque/challenge.webp', 'images/plaque/shop.webp', 'images/plaque/report.webp', 'images/plaque/lobby.webp',
  'images/adv_map.webp',
  'images/nav/nav_wood_bar.webp', 'images/nav/nav_home2.webp', 'images/nav/nav_child2.webp', 'images/nav/nav_challenge2.webp', 'images/nav/nav_rewards2.webp', 'images/nav/nav_records2.webp',
  'fonts/jf-openhuninn-app.woff2', 'fonts/jf-openhuninn-2.0.woff2',
  'images/badges/badge_advStart.webp', 'images/badges/badge_catch10.webp', 'images/badges/badge_catch5.webp', 'images/badges/badge_chest1.webp', 'images/badges/badge_chests10.webp', 'images/badges/badge_earn1000.webp', 'images/badges/badge_earn10000.webp', 'images/badges/badge_earn2000.webp', 'images/badges/badge_earn3000.webp', 'images/badges/badge_earn4000.webp', 'images/badges/badge_earn5000.webp', 'images/badges/badge_earn6000.webp', 'images/badges/badge_earn7000.webp', 'images/badges/badge_earn8000.webp', 'images/badges/badge_earn9000.webp', 'images/badges/badge_goldClear1.webp', 'images/badges/badge_goldHero.webp', 'images/badges/badge_locked.webp', 'images/badges/badge_mystery1.webp', 'images/badges/badge_pine10.webp', 'images/badges/badge_reachR2.webp', 'images/badges/badge_reachR3.webp', 'images/badges/badge_reachR4.webp', 'images/badges/badge_special1.webp', 'images/badges/badge_special5.webp', 'images/badges/badge_squirrel5.webp', 'images/badges/badge_streak7.webp', 'images/badges/badge_woodClear1.webp', 'images/badges/badge_woodHero.webp',
  './', 'index.html', 'css/style.css', 'js/store.js', 'js/rules-csv.js', 'js/report.js', 'js/board-gold.js', 'js/board-gold-02.js', 'js/board-gold-03.js', 'js/board-gold-04.js', 'js/board-wood.js', 'js/game.js', 'js/art.js', 'js/app.js',
  'manifest.webmanifest', 'images/gold-island.webp', 'images/gold/region01.webp', 'images/gold/region02.webp', 'images/gold/region03.webp', 'images/gold/region04.webp', 'images/gold/tower_off.webp', 'images/gold/tower_on.webp', 'images/gold/technician.webp', 'images/gold/stone.webp', 'images/gold/ore.webp', 'images/gold/minecart.webp', 'images/gold/rail_before.webp', 'images/gold/rail_after.webp', 'images/wood/leaf_bg.webp', 'images/wood/leaf_pile.webp', 'images/wood/leaf_pinecone.webp', 'images/wood/leaf_squirrel.webp', 'images/wood/leaf_empty.webp', 'images/mascot.webp', 'images/float-castle.webp', 'images/chest.webp',
  'images/characters/roundear.webp', 'images/characters/longear.webp', 'images/characters/horn.webp', 'images/characters/wing.webp',
  'images/characters/drop.webp', 'images/characters/sprout.webp', 'images/characters/flame.webp', 'images/characters/stone.webp', 'images/items/dice_6.webp', 'images/items/dice_12.webp', 'images/items/roller_skate.webp', 'images/items/star.webp', 'images/tiles/start.webp', 'images/tiles/chest.webp', 'images/tiles/chance.webp', 'images/tiles/minigame.webp', 'images/tiles/finish.webp', 'images/tiles/door.webp', 'images/tiles/shop.webp', 'images/tiles/fate.webp', 'images/minigame/bg.webp', 'images/minigame/star.webp', 'images/items/shield.webp', 'images/items/magic_dice.webp', 'images/items/lucky_medal.webp', 'images/items/flying_wings.webp', 'images/items/magic_door.webp', 'images/items/mystery_chest.webp', 'images/items/airplane.webp', 'images/items/golden_key.webp', 'images/items/treasure_magnet.webp', 'images/items/reroll_ticket.webp', 'images/items/bonus_play.webp', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

// 圖片與字型放在不跟版本走的快取：升版時只下載還沒有的圖，不再整包重抓（約 4MB）
var IMG_CACHE = 'cgp-img-v1';
function isImage(url) { return /\.(webp|png|jpe?g|svg|gif|woff2)$/i.test(new URL(url, self.location.href).pathname); }

self.addEventListener('install', function (e) {
  var core = SHELL.filter(function (u) { return !isImage(u); });
  // 程式、樣式、頁面：每次升版都重新抓（很小）；cache: 'reload' 略過瀏覽器暫存，避免把舊版程式存進新快取
  // 圖片與字型不在安裝時下載（2026-11-10：第一次開啟加速），改由頁面載完後送 'precache' 訊息在背景下載
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(core.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
    .then(function () { return self.skipWaiting(); }));
});

/** 背景下載離線用的圖片與字型：已經有的跳過，一次一個，不搶網路 */
function precacheImages() {
  // 先下載畫面常用的小圖（角色、功能列、標題、道具…），金島大地圖與完整字型最後
  function rank(u) { return /fonts\/jf-openhuninn-2\.0/.test(u) ? 3 : /gold\/region|gold-island|minigame\/bg/.test(u) ? 2 : /characters|nav\/|plaque|items|badges|tiles|mascot|float-castle|jf-openhuninn-app/.test(u) ? 0 : 1; }
  var imgs = SHELL.filter(isImage).sort(function (a, b) { return rank(a) - rank(b); });
  return caches.open(IMG_CACHE).then(function (ic) {
    return imgs.reduce(function (p, u) {
      return p.then(function () {
        return ic.match(u, { ignoreSearch: true }).then(function (hit) { return hit ? null : ic.add(u).catch(function () { /* 下次再試 */ }); });
      });
    }, Promise.resolve());
  });
}
self.addEventListener('message', function (e) {
  if (e.data === 'precache') e.waitUntil(precacheImages());
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== IMG_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  if (isImage(e.request.url)) {
    // 圖片：先用快取（馬上顯示），背景再向伺服器確認有沒有換新圖（沒變只回 304），下次開就是新圖。
    // 不在 SHELL 的圖（例如之後的木島地圖）第一次用到才下載，之後離線也能用。
    e.respondWith(caches.open(IMG_CACHE).then(function (ic) {
      return ic.match(e.request, { ignoreSearch: true }).then(function (hit) {
        var update = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
          if (res.ok) ic.put(e.request, res.clone());
          return res;
        });
        if (hit) { e.waitUntil(update.catch(function () { /* 離線 */ })); return hit; }
        return update;
      });
    }));
    return;
  }
  // 頁面、程式、樣式：網路優先（確保更新即時生效），離線或伺服器錯誤時改用快取
  e.respondWith(
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
