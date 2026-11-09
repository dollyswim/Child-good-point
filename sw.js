/* 親子集點 Service Worker：離線可用。資料存在 localStorage，不受快取影響。 */
var CACHE = 'cgp-shell-v130';
var SHELL = [
  'images/nav/nav_wood_bar.webp', 'images/nav/nav_home2.webp', 'images/nav/nav_child2.webp', 'images/nav/nav_challenge2.webp', 'images/nav/nav_rewards2.webp', 'images/nav/nav_records2.webp',
  'fonts/jf-openhuninn-2.0.woff2',
  'images/badges/badge_advStart.webp', 'images/badges/badge_catch10.webp', 'images/badges/badge_catch5.webp', 'images/badges/badge_chest1.webp', 'images/badges/badge_chests10.webp', 'images/badges/badge_earn1000.webp', 'images/badges/badge_earn10000.webp', 'images/badges/badge_earn2000.webp', 'images/badges/badge_earn3000.webp', 'images/badges/badge_earn4000.webp', 'images/badges/badge_earn5000.webp', 'images/badges/badge_earn6000.webp', 'images/badges/badge_earn7000.webp', 'images/badges/badge_earn8000.webp', 'images/badges/badge_earn9000.webp', 'images/badges/badge_goldClear1.webp', 'images/badges/badge_goldHero.webp', 'images/badges/badge_locked.webp', 'images/badges/badge_mystery1.webp', 'images/badges/badge_pine10.webp', 'images/badges/badge_reachR2.webp', 'images/badges/badge_reachR3.webp', 'images/badges/badge_reachR4.webp', 'images/badges/badge_special1.webp', 'images/badges/badge_special5.webp', 'images/badges/badge_squirrel5.webp', 'images/badges/badge_streak7.webp', 'images/badges/badge_woodHero.webp',
  './', 'index.html', 'css/style.css', 'js/store.js', 'js/rules-csv.js', 'js/report.js', 'js/board-gold.js', 'js/board-gold-02.js', 'js/board-gold-03.js', 'js/board-gold-04.js', 'js/game.js', 'js/art.js', 'js/app.js',
  'manifest.webmanifest', 'images/gold-island.webp', 'images/gold/region01.webp', 'images/gold/region02.webp', 'images/gold/region03.webp', 'images/gold/region04.webp', 'images/gold/tower_off.webp', 'images/gold/tower_on.webp', 'images/gold/technician.webp', 'images/gold/stone.webp', 'images/gold/ore.webp', 'images/gold/minecart.webp', 'images/gold/rail_before.webp', 'images/gold/rail_after.webp', 'images/wood/leaf_bg.webp', 'images/wood/leaf_pile.webp', 'images/wood/leaf_pinecone.webp', 'images/wood/leaf_squirrel.webp', 'images/wood/leaf_empty.webp', 'images/wood/elf.webp', 'images/wood/party/meadow.webp', 'images/wood/party/flower.webp', 'images/wood/party/berries.webp', 'images/wood/party/card.webp', 'images/wood/party/petal.webp', 'images/wood/party/leaf.webp', 'images/wood/party/bunny.webp', 'images/wood/party/hedgehog.webp', 'images/wood/party/owl.webp', 'images/wood/party/party_empty.webp', 'images/wood/party/party_done.webp', 'images/wood/party/vase.webp', 'images/wood/party/juice.webp', 'images/wood/party/basket.webp', 'images/wood/party/balloons.webp', 'images/mascot.webp', 'images/float-castle.webp', 'images/chest.webp',
  'images/characters/roundear.webp', 'images/characters/longear.webp', 'images/characters/horn.webp', 'images/characters/wing.webp',
  'images/characters/drop.webp', 'images/characters/sprout.webp', 'images/characters/flame.webp', 'images/characters/stone.webp', 'images/items/dice_6.webp', 'images/items/dice_12.webp', 'images/items/roller_skate.webp', 'images/islands/wood.webp', 'images/islands/water.webp', 'images/islands/fire.webp', 'images/islands/earth.webp', 'images/items/star.webp', 'images/tiles/start.webp', 'images/tiles/chest.webp', 'images/tiles/chance.webp', 'images/tiles/minigame.webp', 'images/tiles/finish.webp', 'images/tiles/door.webp', 'images/tiles/shop.webp', 'images/tiles/fate.webp', 'images/minigame/bg.webp', 'images/minigame/star.webp', 'images/items/shield.webp', 'images/items/magic_dice.webp', 'images/items/lucky_medal.webp', 'images/items/flying_wings.webp', 'images/items/magic_door.webp', 'images/items/mystery_chest.webp', 'images/items/airplane.webp', 'images/items/golden_key.webp', 'images/items/treasure_magnet.webp', 'images/items/reroll_ticket.webp', 'images/items/bonus_play.webp', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

// 圖片與字型放在不跟版本走的快取：升版時只下載還沒有的圖，不再整包重抓（約 4MB）
var IMG_CACHE = 'cgp-img-v1';
function isImage(url) { return /\.(webp|png|jpe?g|svg|gif|woff2)$/i.test(new URL(url, self.location.href).pathname); }

self.addEventListener('install', function (e) {
  var core = SHELL.filter(function (u) { return !isImage(u); });
  var imgs = SHELL.filter(isImage);
  e.waitUntil(Promise.all([
    // 程式、樣式、頁面：每次升版都重新抓（很小）；cache: 'reload' 略過瀏覽器暫存，避免把舊版程式存進新快取
    caches.open(CACHE).then(function (c) { return c.addAll(core.map(function (u) { return new Request(u, { cache: 'reload' }); })); }),
    // 圖片：圖片快取或舊版快取裡已有就沿用，沒有才下載
    caches.open(IMG_CACHE).then(function (ic) {
      return Promise.all(imgs.map(function (u) {
        return ic.match(u, { ignoreSearch: true }).then(function (hit) {
          if (hit) return null;
          return caches.match(u, { ignoreSearch: true }).then(function (old) {
            return old ? ic.put(u, old) : ic.add(u);
          });
        });
      }));
    })
  ]).then(function () { return self.skipWaiting(); }));
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
