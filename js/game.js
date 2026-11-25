/*
 * 親子集點 — 冒險遊戲邏輯（Phase 3：最小可玩金島）
 *
 * 純邏輯，不碰 DOM。擴充 Store.prototype，瀏覽器與 Node 共用。
 *
 * 規則：
 * - 當天必須已解鎖並結算（進入今日冒險）才能使用地圖與商店
 * - 商店：6 面骰 5 星、12 面骰 10 星、溜冰鞋 4 星（前進 3 格）
 * - 每天最多擲 3 次骰子（6 面、12 面都算一次；溜冰鞋不算）
 * - 背包道具沒用完隔天仍保留
 * - 金島測試版 30 格；走到第 30 格停在終點（多餘步數不走、骰子不浪費：在終點就不能再擲）
 * - 地圖資料結構可擴充為 100 格（tiles 陣列長度即格數）
 * - 角色：8 種冒險夥伴，每個孩子各自選擇；與孩子頭像為同一個（child.avatar）
 */
(function (root) {
  'use strict';

  var CGP = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.CGP;
  var Store = CGP.Store;
  var dateKey = CGP.dateKey;

  var DAILY_DICE_LIMIT = 3;
  /** Phase 4「抓住星星」：每天 1 次、約 10 秒；星星出現數不限，每抓 1 顆得 1 顆能量星星，獎勵最多 15 顆 */
  var DAILY_MINIGAME_LIMIT = 1;
  var MINIGAME_MAX_STARS = 8;   // 2026-11-25 家長：小遊戲獎勵上限 15 → 8（成就標準不變）
  /** 2026-11-08 家長調整：抓到的星星每 3 顆換 1 顆能量星星（無條件進位），最多 MINIGAME_MAX_STARS 顆 */
  var MINIGAME_RATE = 3;
  function minigameStars(caught) { var c = Math.max(0, Math.floor(Number(caught) || 0)); return Math.min(MINIGAME_MAX_STARS, Math.ceil(c / MINIGAME_RATE)); }
  var MINIGAME_SECONDS = 10;
  /**
   * 木島小遊戲「落葉找松果」（2026-11-08 家長決定）：25 堆落葉（5×5），先亮出松果位置讓孩子記住，蓋回去後翻找。
   * 計分版（木島小遊戲格）：3 回合越來越難，每回合翻錯 3 次就進下一回合；每顆松果換 1 顆能量星星（2026-11-19 家長改：三種小遊戲上限都 15；原本每 2 顆換 1 顆）（無條件進位；2026-11-08 家長曾改 1 換 1，後來改回 2 換 1），最多 15 顆松果 → 8 顆。
   * 劇情版（木島第 8 格）：1 回合、松果 5 顆、看 3 秒，翻錯沒關係、找齊就完成。
   */
  // 干擾物（2026-11-08 家長決定）：每回合 2 隻吃松果的松鼠，先看時和松果一起亮出來（同樣淡色底）；翻到松鼠算翻錯 1 次（劇情版不會失敗）
  var LEAF_GAME = { piles: 25, misses: 3, rate: 2, decoys: 2,   // rate：2026-11-25 家長改成 2 顆松果換 1 顆（無條件進位，最多 8，和其他小遊戲一致）
    rounds: [{ pine: 4, show: 3000 }, { pine: 5, show: 2500 }, { pine: 6, show: 2000 }],
    story: { pine: 5, show: 3000 } };
  var LEAF_MAX_FOUND = LEAF_GAME.rounds.reduce(function (n, r) { return n + r.pine; }, 0);
  function leafStars(found) { var c = Math.max(0, Math.min(LEAF_MAX_FOUND, Math.floor(Number(found) || 0))); return Math.min(MINIGAME_MAX_STARS, Math.ceil(c / LEAF_GAME.rate)); }
  /** 這座島的小遊戲（木島＝落葉找松果，其他島＝抓住星星） */
  /**
   * 這座島的小遊戲：木島＝落葉找松果；金島在木島上線前（2026-11-08 家長決定）各 1/2 機率抓住星星或落葉找松果，木島上線後回到抓住星星
   * rand：決定金島這一場玩哪一種（只有真的要開新的一場時才傳，避免多用掉亂數）
   */
  var GOLD_LEAF_CHANCE = 0.5;
  /**
   * 水島小遊戲「珊瑚灣撈魚趣」（2026-11-19 家長定稿）：參數全部集中在這裡。
   * 日常：水島小遊戲格一律撈魚，每天次數照既有小遊戲規則；能量星星每 3 條換 1 顆（無條件進位，2026-11-19 家長試玩撈到 54 條後調整）、最多 15 顆、至少 1 顆。
   * 劇情：第 34 格餵小白鯨前要撈滿 storyGoal 條（可分好幾局累積、存檔），不算每日次數、不給能量星星。
   */
  var FISH_GAME = { seconds: 45, nets: 5, durability: 100, grace: 0.5, drainPerSec: 20, puffer: 35, storyGoal: 10, rate: 3, maxStars: 8, maxCaught: 99,
    fish: 10, puffers: 1, jellies: 1, warnAt: 35 };   // fish：2026-11-19 家長改 2 倍；warnAt：耐久低於這個值網子變紅、抖動、顯示「快破了！」   // 畫面上同時游動的數量：可撈的魚、河豚、水母
  function fishStars(caught) { var c = Math.max(0, Math.floor(Number(caught) || 0)); return Math.max(1, Math.min(FISH_GAME.maxStars, Math.ceil(c / FISH_GAME.rate))); }
  function minigameOf(island, rand) {
    if (island === 'water') return 'fish';
    if (island === 'fire') return 'lava';   // 2026-11-22 火島《熔岩跳跳路》（火島開放後小遊戲格自動使用；docs/fire/LAVA_GAME_PLAN.md）
    if (island === 'wood') return 'leaf';
    if (island === 'gold' && !BOARDS.wood && rand) {
      if (typeof window !== 'undefined' && window.__cgpGoldGame) return window.__cgpGoldGame;   // 自動測試用：固定金島玩哪一種（不用亂數）
      return rand() < GOLD_LEAF_CHANCE ? 'leaf' : 'stars';
    }
    return 'stars';
  }

  /** 道具圖示：家長提供的白底插圖（images/items/，256×256 WebP，原圖 1024×1024 PNG），介面以白色圖示框＋contain 顯示 */
  /**
   * 冒險寶物商店（生活點數兌換）：每個孩子每週最多 3 件、同款最多持有 2 件（只限寶物商店購買）
   * 效果於後續階段接入；購買後放進背包。
   */
  var TREASURE_WEEKLY_LIMIT = 3, TREASURE_HOLD_LIMIT = 2;
  var TREASURES = [
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 10, desc: '向前移動 3 格（和飛行翼合計每天最多 5 次）' },
    { id: 'shield', name: '防護罩', icon: '🛡️', img: 'images/items/shield.webp', price: 10, desc: '自動擋住一次命運卡的「往回退」或「路障」（擋住路障還能前進 1 格）' },
    // 2026-11-25 家長：神奇骰子從寶物商店拿掉，改在星星商店賣（⭐50，每週 2 顆）；神祕寶箱照樣會開出
    { id: 'luckyMedal', name: '好運金牌', icon: '🥇', img: 'images/items/lucky_medal.webp', price: 100, desc: '下一次停在寶箱：升級成神祕寶箱（不用鑰匙，直接打開）；停在機會格：效果發生 2 次' },
    { id: 'wings', name: '飛行翼', icon: '🪽', img: 'images/items/flying_wings.webp', price: 100, desc: '向前飛行 20 格（和溜冰鞋合計每天最多 5 次）' },
    { id: 'starCall', name: '星星呼喚', icon: '🌠', img: 'images/minigame/star.webp', price: 50, desc: '馬上玩一局「抓住星星」（不占每天 1 次，每天最多用 1 個）' },   // 2026-11-08 新增
    { id: 'pineHide', name: '松果躲躲', icon: '🌰', img: 'images/wood/leaf_pinecone.webp', price: 50, desc: '馬上玩一局「落葉找松果」（不占每天 1 次，每天最多用 1 個）' },   // 2026-11-08 新增（比照星星呼喚，和星星呼喚各自計算）
    { id: 'door', name: '傳送門', icon: '🚪', img: 'images/items/magic_door.webp', price: 200, desc: '傳送到本島指定的格子（水島不能用）' },
    { id: 'submarine', name: '潛水艇', icon: '🚤', img: 'images/items/submarine.webp', price: 200, hold: 3, desc: '只能在水島用：從第 25 格以後直接開到水中的指定格子', island: 'water' }   // 2026-11-16 新增（2026-11-17 正式圖 E-30 驗收通過）
  ];
  /** 寶物價格（生活點數）依家庭點數尺度換算（2026-11-24） */
  Store.prototype.treasurePrice = function (itemId) { var t = TREASURES.find(function (x) { return x.id === itemId; }); return t ? this.scalePoints(t.price) : 0; };
  function treasureHold(id) { var t = TREASURES.find(function (x) { return x.id === id; }); return (t && t.hold) || TREASURE_HOLD_LIMIT; }

  var SHOP = [
    { id: 'd6', name: '6 面骰', icon: '🎲', img: 'images/items/dice_6.webp', price: 5, desc: '擲出 1～6 步' },
    { id: 'd12', name: '12 面骰', icon: '🎲', img: 'images/items/dice_12.webp', price: 10, desc: '擲出 1～12 步' },
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 4, desc: '直接前進 3 格（不算擲骰次數；和飛行翼合計每天最多 5 次）' },
    { id: 'goldenKey', name: '黃金鑰匙', icon: '🔑', img: 'images/items/golden_key.webp', price: 10, desc: '打開地圖上撿到的神祕寶箱' },
    { id: 'magnet', name: '寶物磁鐵', icon: '🧲', img: 'images/items/treasure_magnet.webp', price: 10, desc: '吸取前後 5 格內的寶箱' },
    { id: 'rerollTicket', name: '命運重骰券', icon: '🎲', img: 'images/items/reroll_ticket.webp', price: 15, desc: '擲骰後可以重擲一次（不占每日次數；同一次只能用 1 張）' },   // 2026-11-24 家長：星星的新用途
    { id: 'magicDice', name: '神奇骰子', icon: '🎲', img: 'images/items/magic_dice.webp', price: 50, weekly: 2, desc: '額外擲一次 12 面骰（不占每日 3 次，每天最多用 1 顆）' },   // 2026-11-25 家長：每週最多買 2 顆
    { id: 'wings', name: '飛行翼', icon: '🪽', img: 'images/items/flying_wings.webp', price: 150, weekly: 1, desc: '向前飛行 20 格（和溜冰鞋合計每天最多 5 次）' },   // 2026-11-25 家長：每週最多買 1 個
    { id: 'magicShoes', name: '魔法鞋', icon: '👟', img: 'images/items/magic_shoes.webp', price: 40, weekly: 2, desc: '自己選前進 1～6 步（不占擲骰和溜冰鞋次數，每天最多用 1 個）' }   // 2026-11-25 家長：docs/MAGIC_SHOES_PLAN.md
  ];
  /** 星星商店本週還能買幾個（沒有每週上限回傳 null） */
  Store.prototype.shopWeeklyLeft = function (childId, itemId) {
    var item = SHOP.find(function (x) { return x.id === itemId; });
    if (!item || !item.weekly) return null;
    var ws = CGP.weekStartKey(this.now()), reason = '購買' + item.name;
    var n = this.data.adventure.ledger.filter(function (l) { return l.childId === childId && l.reason === reason && l.date >= ws; }).length;
    return Math.max(0, item.weekly - n);
  };

  /** 8 種原創冒險夥伴（家長提供的原創設計），圖檔在 images/characters/v2/<id>.webp（2026-11-24 換新版黏土風） */
  var CHARACTERS = [
    { id: 'roundear', name: '圓耳獸', trait: '陽光・活力', icon: '🐾' },
    { id: 'longear', name: '長耳獸', trait: '溫柔・親切', icon: '🌿' },
    { id: 'horn', name: '小角龍獸', trait: '勇敢・探索', icon: '🪨' },
    { id: 'wing', name: '小翼獸', trait: '自由・飛翔', icon: '🪽' },
    { id: 'drop', name: '水滴獸', trait: '聰明・靈活', icon: '💧' },
    { id: 'sprout', name: '葉芽獸', trait: '成長・療癒', icon: '🌱' },
    { id: 'flame', name: '火苗獸', trait: '熱情・衝勁', icon: '🔥' },
    { id: 'stone', name: '石球獸', trait: '穩重・守護', icon: '⛰️' }
  ];
  var DEFAULT_CHARACTER = 'roundear';

  /**
   * 金島：分為四區（1～30、31～55、56～80、81～100 格）。
   * 目前只開放第一區「黃金沙灘與初級礦場」；座標來自 js/board-gold.js（由 data/gold_region01_tiles.json 產生）。
   * tiles[0] 為起點（第 1 格前方的沙灘，依第 1、2 格方向往回延伸一步），tiles[n] = 第 n 格。
   * 存檔使用穩定格子 ID（例如 gold-01-007），未來不重編。
   */
  var REGION01 = (typeof module !== 'undefined' && module.exports) ? require('./board-gold.js') : root.CGP_GOLD_REGION01;
  var REGION02 = (typeof module !== 'undefined' && module.exports) ? require('./board-gold-02.js') : root.CGP_GOLD_REGION02;
  var REGION03 = (typeof module !== 'undefined' && module.exports) ? require('./board-gold-03.js') : root.CGP_GOLD_REGION03;
  var REGION04 = (typeof module !== 'undefined' && module.exports) ? require('./board-gold-04.js') : root.CGP_GOLD_REGION04;
  var WOOD_DATA = (typeof module !== 'undefined' && module.exports) ? require('./board-wood.js') : root.CGP_WOOD_BOARD;
  var WATER_DATA = (typeof module !== 'undefined' && module.exports) ? require('./board-water.js') : root.CGP_WATER_BOARD;
  /**
   * 金島長地圖（總覽座標 1080×5400，左上為原點，由下往上走）：四張 1080×1350 背景由上到下為
   * 第四區（y 0）、第三區（1350）、第二區（2700）、第一區（4050）。格子的 gx、gy 為總覽座標；x、y 為所在背景圖內 0～1。
   */
  var WORLD = { width: 1080, height: 5400 };
  /**
   * 已開放到第幾區（1～4）。背景與最終座標到貨並核對後往上加：
   * 2026-11-07 第二區水晶礦谷（Codex 核定版 v3）；2026-11-07 第三區齒輪工坊（檢視版 v1）；2026-11-07 第四區金冠城堡（四區整合交件 v1）＝全島 100 格開放
   */
  var OPEN_REGIONS = 4;
  // 事件依既有遊戲規格（JSON 的 eventType 僅為占位；第 30 格為區域邊界）
  var TYPES = { 3: 'chance', 5: 'chest', 7: 'minigame', 9: 'chance', 11: 'fate', 12: 'chest', 14: 'fate', 15: 'chance', 17: 'minigame',
    19: 'chest', 21: 'fate', 22: 'chance', 24: 'minigame', 26: 'chest', 27: 'fate', 28: 'chance' };

  /**
   * Phase 4 命運卡（家長決定：特殊任務多一點）
   * 特殊任務 3 種各 22%、後退 1～2 格 19%、路障 15%（2026-11-08 家長調整：原本各 25%／10%／15%，讓防護罩更有用）
   */
  var FATE_CARDS = [
    { id: 'chore', weight: 22 }, { id: 'praise', weight: 22 }, { id: 'helper', weight: 22 },
    { id: 'back', weight: 19 }, { id: 'roadblock', weight: 15 }
  ];
  var ROADBLOCKS = [
    '一隻小螃蟹橫著走過來擋路，停下來跟牠打個招呼吧！',
    '礦車軌道上有一顆大石頭，大家一起等工人搬開。',
    '一陣海風吹來，帽子差點飛走，先停下來整理一下。',
    '路邊的小花開得好漂亮，停下來欣賞一下再出發。'
  ];
  /**
   * 各島的卡片文字（2026-11-08 家長決定：木島的機會卡／命運卡效果與機率完全不變，只換成森林主題的文字）
   * 沒列到的島沿用金島文字；cart＝機會卡「前進 2 格」、ore＝機會卡 ⭐2、back＝命運卡後退、roadblocks＝命運卡路障
   */
  var CARD_TEXT = {
    gold: { cart: '礦車載你額外前進 2 格！', ore: '發現發光礦石，得到 ⭐2', oreLedger: '機會：發現礦石',
      d6: '撿到一顆 🎲 6 面骰', chest: '找到一個小寶箱，得到 ⭐', skates: '撿到一雙 🛼 溜冰鞋',
      backShield: '一陣大風吹來，🛡️ 防護罩擋住了！沒有後退。', back: '一陣大風吹來，往回退了 {n} 格！', roadblocks: ROADBLOCKS },
    wood: { cart: '抓住藤蔓盪過去，額外前進 2 格！', ore: '發現一朵發光蘑菇，得到 ⭐2', oreLedger: '機會：發光蘑菇',
      d6: '在樹洞裡撿到一顆 🎲 6 面骰', chest: '在樹根下找到一個小寶箱，得到 ⭐', skates: '在落葉堆裡撿到一雙 🛼 溜冰鞋',
      backShield: '腳下的青苔好滑，🛡️ 防護罩擋住了！沒有滑回去。', back: '踩到滑滑的青苔，往回滑了 {n} 格！',
      roadblocks: [
        '一隻小刺蝟縮成一顆球擋在路中間，等牠慢慢走開吧！',
        '一棵倒下的大樹橫在小路上，大家一起從旁邊繞過去。',
        '松鼠們在路上排隊搬松果，先讓牠們過去。',
        '一群螢火蟲在前面跳舞，停下來欣賞一下再出發。'
      ] }
  };
  // 2026-11-18 家長：水島的命運卡後退改成鯊魚靠近（其他文字暫時沿用金島）
  CARD_TEXT.water = { cart: '一群海豚游過來，載你額外前進 2 格！', ore: '發現一顆發光的珍珠貝，得到 ⭐2', oreLedger: '機會：發光珍珠貝',
    d6: '在海草叢裡撿到一顆 🎲 6 面骰', chest: '在沙子底下找到一個小寶箱，得到 ⭐', skates: '在沉船碎片裡撿到一雙 🛼 溜冰鞋（上岸才能用）',
    backShield: '前面有鯊魚靠近，🛡️ 防護罩擋住了！不用後退。', back: '前面有鯊魚靠近，快後退 {n} 格！',
    roadblocks: [   // 2026-11-19 家長確認水島版文字（效果與機率不變）
      '一群小丑魚排隊游過去，先讓牠們過去吧！',
      '一隻大海龜慢慢游過路中間，等牠游走再出發。',
      '一團海草纏住了腳，先解開再繼續。',
      '一群水母在前面飄來飄去，停下來等牠們飄走。'
    ] };
  function cardText(island) { return CARD_TEXT[island] || CARD_TEXT.gold; }
  function pickWeighted(rand, list) {
    var total = list.reduce(function (s, x) { return s + x.weight; }, 0);
    var r = rand() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i].weight; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  var REGIONS = [
    { id: 'gold-01', name: '黃金沙灘與初級礦場', from: 1, to: 30, stripY: 4050,
      background: { webp: 'images/gold/region01.webp', jpg: 'images/gold/region01.webp' }, size: REGION01.referenceSize },
    { id: 'gold-02', name: '水晶礦谷', from: 31, to: 55, stripY: 2700, data: REGION02,
      background: { webp: 'images/gold/region02.webp', jpg: 'images/gold/region02.webp' }, size: { width: 1080, height: 1350 } },
    { id: 'gold-03', name: '齒輪工坊', from: 56, to: 80, stripY: 1350, data: REGION03,
      background: { webp: 'images/gold/region03.webp', jpg: 'images/gold/region03.webp' }, size: { width: 1080, height: 1350 } },
    { id: 'gold-04', name: '金冠城堡', from: 81, to: 100, stripY: 0, data: REGION04,
      background: { webp: 'images/gold/region04.webp', jpg: 'images/gold/region04.webp' }, size: { width: 1080, height: 1350 } }
  ];
  REGIONS.forEach(function (r, i) { r.available = i < OPEN_REGIONS; });
  /**
   * 建立金島格子：開放到第 open 區。只有最後開放區域的最後一格是邊界（第 100 格為全島終點 end），
   * 前面各區的邊界格改為一般格（可通過）。
   * @param {number} [open] 開放區數（預設 OPEN_REGIONS；測試可傳入模擬）
   */
  function buildGold(open) {
    if (open === undefined) open = OPEN_REGIONS;
    if (open === true) open = 2;                       // 相容舊測試 buildGold(true)＝開放到第二區
    var src = REGION01.tiles;
    var t1 = src[0], t2 = src[1];
    var r1 = REGIONS[0];
    var g = function (t) { t.gx = t.x * WORLD.width; t.gy = r1.stripY + t.y * r1.size.height; return t; };
    var tiles = [g({ n: 0, id: 'gold-01-start', regionId: 'gold-01', x: t1.x - (t2.x - t1.x), y: t1.y - (t2.y - t1.y), type: 'start' })];
    src.forEach(function (t) {
      tiles.push(g({ n: t.order, id: t.id, regionId: 'gold-01', x: t.x, y: t.y,
        type: t.eventType === 'region_boundary' ? 'boundary' : (TYPES[t.order] || 'normal') }));
    });
    for (var i = 1; i < open && i < REGIONS.length; i++) {
      var r = REGIONS[i];
      if (!r.data) break;
      r.data.tiles.forEach(function (t) {
        tiles.push({ n: t.order, id: t.id, regionId: r.id, gx: t.gx, gy: t.gy,
          x: t.gx / WORLD.width, y: (t.gy - r.stripY) / r.size.height, type: t.type });
      });
    }
    // 只有最後一格保留邊界；前面區域的邊界改為一般格
    tiles.forEach(function (t, k) { if (t.type === 'boundary' && k !== tiles.length - 1) t.type = 'normal'; });
    return { id: 'gold', name: '金島', goalName: '金冠城堡', totalTiles: 100, world: WORLD, regions: REGIONS, tiles: tiles };
  }
  var GOLD = buildGold();
  var BOARDS = { gold: GOLD };
  /**
   * 五座島環狀順序（規格書 Phase 6）：金 → 木 → 水 → 火 → 土 → 金。
   * 島嶼地圖資料到貨後用 registerBoard() 加入 BOARDS 就會開放；還沒開放的島會被跳過。
   */
  var ISLAND_ORDER = ['gold', 'wood', 'water', 'fire', 'earth'];
  /**
   * 木島（2026-11-12 接入，Codex 第 2 版地圖）。格子類型沿用金島同格號（家長決定）；第 0 格起點、第 100 格全島終點（精靈巨樹樹洞）。
   * WOOD_OPEN＝false：資料與畫面都準備好，但孩子還不能前往（等滑梯正式圖與家長說開放）。開放時改成 true 即可。
   */
  var WOOD_OPEN = true;   // 2026-11-13 家長決定開放木島
  var woodOn = (WOOD_OPEN || !!root.__cgpWoodOpen) && !root.__cgpWoodClosed;   // __cgpWoodClosed：自動測試模擬「只有金島」的舊流程
  var WOOD_REGIONS = [['wood-01', '森林入口', 1, 30, 4050], ['wood-02', '藤蔓吊橋', 31, 55, 2700], ['wood-03', '樹屋村', 56, 80, 1350], ['wood-04', '精靈巨樹', 81, 100, 0]].map(function (r, i) {
    var img = 'images/wood/region0' + (i + 1) + '.webp';
    return { id: r[0], name: r[1], from: r[2], to: r[3], stripY: r[4], available: true, background: { webp: img, jpg: img }, size: { width: 1080, height: 1350 } };
  });
  function buildWood() {
    var tiles = WOOD_DATA.tiles.map(function (t) {
      var r = WOOD_REGIONS.filter(function (x) { return x.id === t.regionId; })[0];
      return { n: t.n, id: t.id, regionId: t.regionId, gx: t.gx, gy: t.gy, x: t.gx / WORLD.width, y: (t.gy - r.stripY) / r.size.height,
        type: t.n === 0 ? 'start' : GOLD.tiles[t.n].type };
    });
    return { id: 'wood', name: '木島', goalName: '精靈巨樹', totalTiles: 100, world: WORLD, regions: WOOD_REGIONS, tiles: tiles,
      guideSpots: WOOD_DATA.guideSpots, partyLawn: WOOD_DATA.partyLawn };
  }
  if (woodOn) BOARDS.wood = buildWood();
  /**
   * 水島（2026-11-17 接入，Codex 正式圖；計畫見 docs/water/WATER_ISLAND_PLAN.md）：4 張獨立場景（各 1080×1350，不接成長圖），
   * 格子的 gx、gy 是所在場景內的座標，regionId＝場景代號；畫面一次只顯示一個場景（board.scenes＝true）。
   * WATER_OPEN＝true：2026-11-19 家長決定正式開放（之前是 false，只能用試玩模式或 window.__cgpWaterOpen 預覽）。
   * 自動測試的舊流程用 window.__cgpWaterClosed = true 關掉水島。
   */
  var WATER_OPEN = true;
  // 2026-11-18 家長試玩模式：設定裡打開後只在「這台裝置」開放水島（存在 localStorage 的 cgp-water-trial），孩子其他裝置不受影響
  var waterTrial = false;
  // 正式開放後，舊的試玩設定不再作用（不會再顯示「試玩模式」橫幅）
  try { waterTrial = !WATER_OPEN && !!(root.localStorage && root.localStorage.getItem('cgp-water-trial') === '1'); } catch (e) { waterTrial = false; }
  var flagRoot = typeof globalThis !== 'undefined' ? globalThis : root;   // Node 測試裡 root 是 module.exports，開關要從 globalThis 讀（瀏覽器兩者相同）
  var waterOn = (WATER_OPEN || !!flagRoot.__cgpWaterOpen || waterTrial) && !flagRoot.__cgpWaterClosed;
  var WATER_SCENES = [['water-01', '珊瑚淺灘', 0, 24, 'images/water/scene01_v2.webp'], ['water-02', '深海世界', 25, 58, 'images/water/scene02_v2.webp'],
    ['water-03', '水下洞穴', 59, 82, 'images/water/scene03.webp'], ['water-04', '沉船', 83, 100, 'images/water/scene04.webp']].map(function (r) {
    return { id: r[0], name: r[1], from: r[2], to: r[3], stripY: 0, available: true, background: { webp: r[4], jpg: r[4] }, size: { width: 1080, height: 1350 } };
  });
  // 水島格子類型（計畫第 3 節；劇情格底層為一般格）
  var WATER_TYPES = (function () {
    var o = { 100: 'end' }, add = function (type, list) { list.forEach(function (n) { o[n] = type; }); };
    add('chest', [6, 14, 23, 28, 38, 52, 64, 74, 88, 96]);
    add('chance', [3, 11, 19, 26, 36, 44, 54, 60, 72, 80, 84, 94]);
    add('fate', [12, 20, 32, 46, 66, 76, 90]);
    add('minigame', [7, 15, 33, 40, 51, 68, 79, 93]);   // 2026-11-22 家長：多 2 格（第 79、93 格，後段原本沒有小遊戲）
    return o;
  })();
  function buildWater() {
    var tiles = WATER_DATA.tiles.map(function (t) {
      return { n: t.n, id: t.id, regionId: t.regionId, gx: t.gx, gy: t.gy, x: t.gx / 1080, y: t.gy / 1350, type: t.n === 0 ? 'start' : (WATER_TYPES[t.n] || 'normal') };
    });
    return { id: 'water', name: '水島', goalName: '萊莫的沉船', totalTiles: 100, world: { width: 1080, height: 1350 }, scenes: true,
      regions: WATER_SCENES, tiles: tiles, npcSpots: WATER_DATA.npcSpots };
  }
  if (waterOn) BOARDS.water = buildWater();
  if (!waterOn) TREASURES = TREASURES.filter(function (t) { return t.island !== 'water'; });   // 水島還沒開放：商店先不賣潛水艇
  function registerBoard(id, board) { board.id = id; BOARDS[id] = board; return board; }
  /** 下一座已開放的島（沒有其他已開放的島時回傳 null＝留在原島繞下一輪） */
  function nextIsland(id) {
    var i = ISLAND_ORDER.indexOf(id);
    for (var k = 1; k < ISLAND_ORDER.length; k++) {
      var n = ISLAND_ORDER[(i + k) % ISLAND_ORDER.length];
      if (n !== id && BOARDS[n]) return n;
    }
    return null;
  }
  /** 金島的最遠格子（金島區域成就用；人在其他島時讀金島的保存進度） */
  function goldMax(p) { return p.island === 'gold' ? p.maxReached : (((p.islands || {}).gold || {}).maxReached || 0); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function rint(rand, min, max) { return min + Math.floor(rand() * (max - min + 1)); }

  // ---------- 狀態 ----------
  Store.prototype.getPlayer = function (childId) {
    var adv = this.data.adventure;
    if (!adv.players[childId]) {
      var child = this.getChild(childId);
      adv.players[childId] = { island: 'gold', pos: 0, tileId: 'gold-01-start', character: child ? child.avatar : '', bag: CGP.emptyBag() };
    }
    var p = adv.players[childId];
    CGP.BAG_KEYS.forEach(function (k) { if (!(p.bag[k] >= 0)) p.bag[k] = 0; });   // 新道具代號補 0
    if (!Array.isArray(p.looted)) p.looted = [];
    if (!p.stats) p.stats = { chests: 0, mystery: 0 };
    if (!(p.goldClears >= 0)) p.goldClears = 0;
    if (!(p.maxReached >= p.pos)) p.maxReached = p.pos || 0;
    if (!p.islands || typeof p.islands !== 'object') p.islands = {};           // 其他島的保存進度 { 島: { laps, maxReached } }
    if (!p.islandClears || typeof p.islandClears !== 'object') p.islandClears = {};   // 金島以外的通關次數（金島沿用 goldClears）
    if (!p.story || typeof p.story !== 'object') p.story = {};   // 劇情完成日期 { ore, rail, tower, pinecone, flowers, invite, party }
    if (!p.gearHouse || typeof p.gearHouse !== 'object') p.gearHouse = { plays: 0 };   // 齒輪小屋：plays＝玩過幾局、giftDone＝拿過神祕寶箱的日期、chestDate＝最近一次拿一般寶箱的日期
    if (!p.water || typeof p.water !== 'object') p.water = {};   // 水島故事進度：seen（沿路對話）、bucket（魚桶）、bottle（牛奶瓶）、welcomed、bossStage、folkMet（看過結尾昏倒的火島居民；重置任務會清掉）
    // 位置以穩定格子 ID 為準；舊存檔只有整數格號時對應到同號的格子（第 n 格 → gold-01-00n）
    var board = BOARDS[p.island] || GOLD;
    var idx = p.tileId ? board.tiles.findIndex(function (t) { return t.id === p.tileId; }) : -1;
    if (idx >= 0) p.pos = idx;
    else {
      p.pos = Math.max(0, Math.min(p.pos || 0, board.tiles.length - 1));
      p.tileId = board.tiles[p.pos].id;
    }
    return p;
  };
  /** 目前所在格子（含起點） */
  Store.prototype.getPlayerTile = function (childId) {
    var p = this.getPlayer(childId);
    return this.getBoard(childId).tiles[p.pos];
  };
  Store.prototype.getBoard = function (childId) {
    var p = this.data.adventure.players[childId]; // 不經 getPlayer，避免移動途中重新對應位置
    return (p && BOARDS[p.island]) || GOLD;
  };
  /** 直接移到指定格子（測試與修正用） */
  Store.prototype.setPlayerTile = function (childId, n) {
    var p = this.getPlayer(childId);
    var tiles = this.getBoard(childId).tiles;
    p.pos = Math.max(0, Math.min(n, tiles.length - 1));
    p.tileId = tiles[p.pos].id;
  };
  /** 今天是否可以玩（已解鎖並結算） */
  Store.prototype.canPlayToday = function (childId) {
    if (this.isTester && this.isTester(childId)) return !this.isAdventureEnded(childId);   // 測試孩子不用先結算
    return !!this.getSettlement(childId) && !this.isAdventureEnded(childId);
  };
  /** 今天的冒險是否已按「結束今日冒險」 */
  Store.prototype.isAdventureEnded = function (childId) {
    var today = this.today();
    return this.data.adventure.dayEnds.some(function (x) { return x.childId === childId && x.date === today; });
  };

  Store.prototype.setCharacter = function (childId, charId) {
    if (!CHARACTERS.some(function (c) { return c.id === charId; })) throw new Error('沒有這個角色');
    // 頭像與冒險夥伴是同一個：一起更新
    this.updateChild(childId, { avatar: charId });
  };

  Store.prototype._requirePlay = function (childId) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    if (this.isAdventureEnded(childId)) throw new Error('今天的冒險已經結束了，明天再來！');
    if (!this.canPlayToday(childId)) throw new Error('今日冒險尚未出發：先在任務頁按「進入今日冒險」');
  };

  Store.prototype._ledger = function (childId, delta, reason) {
    this.data.adventure.ledger.push({ id: uid(), childId: childId, date: this.today(), delta: delta, reason: reason, ts: this.now().getTime() });
  };

  // ---------- 商店 ----------
  Store.prototype.buyItem = function (childId, itemId) {
    this._requirePlay(childId);
    var item = SHOP.find(function (x) { return x.id === itemId; });
    if (!item) throw new Error('沒有這個商品');
    if (item.weekly && this.shopWeeklyLeft(childId, item.id) <= 0) throw new Error(item.name + '每週最多買 ' + item.weekly + ' 個，下週再來！');
    if (this.getStarBalance(childId) < item.price) throw new Error('能量星星不夠');
    this._ledger(childId, -item.price, '購買' + item.name);
    var p = this.getPlayer(childId);
    p.bag[item.id]++;
    var bonus = 0;
    if (item.id === 'd6' && !p.starterBuy && !(typeof globalThis !== 'undefined' && globalThis.__cgpNoStarter)) {   // 2026-11-19 家長：新手任務「去商店買 1 顆 6 面骰」→ 再送 1 顆（每個孩子只送一次）
      p.starterBuy = true; p.bag.d6++; bonus = 1;
      this._logItem(childId, 'grant', 'd6', 1, '新手獎勵', '第一次在商店買 6 面骰');
    }
    this.save();
    return bonus ? Object.assign({}, item, { starterBonus: bonus }) : item;
  };

  // ---------- 寶箱內容（地圖寶箱格與背包寶箱共用同一套） ----------
  /** 一般寶箱（2026-11-24 家長：寶箱變大）：55% 得 3～8 星；其餘溜冰鞋、6 面骰、12 面骰各 15% */
  Store.prototype._rollRegularChest = function (childId, reason) {
    var rand = this.random, p = this.getPlayer(childId), out = { stars: 0, items: {}, text: '' };
    p.stats.chests++;
    var roll = rand();
    if (roll < 0.55) {
      out.stars = rint(rand, 3, 8);
      this._ledger(childId, out.stars, reason);
      out.text = '得到 ⭐' + out.stars + ' 能量星星';
    } else if (roll < 0.7) {
      p.bag.skates++; out.items.skates = 1; out.text = '得到一雙 🛼 溜冰鞋';
    } else if (roll < 0.85) {
      p.bag.d6++; out.items.d6 = 1; out.text = '得到一顆 🎲 6 面骰';
    } else {
      p.bag.d12++; out.items.d12 = 1; out.text = '得到一顆 🎲 12 面骰';
    }
    Object.keys(out.items).forEach(function (k) { this._logItem(childId, 'grant', k, out.items[k], reason, out.text); }, this);
    return out;
  };
  /** 神祕寶箱獎勵池：7 種特殊道具（呼叫專機為稀有獎勵） */
  var MYSTERY_POOL = [
    { id: 'skates', name: '溜冰鞋', icon: '🛼', weight: 18 }, { id: 'magicDice', name: '神奇骰子', icon: '🎲', weight: 18 },
    { id: 'luckyMedal', name: '好運金牌', icon: '🥇', weight: 18 }, { id: 'shield', name: '防護罩', icon: '🛡️', weight: 18 },
    { id: 'wings', name: '飛行翼', icon: '🪽', weight: 12 }, { id: 'door', name: '傳送門', icon: '🚪', weight: 12 },
    { id: 'airplane', name: '呼叫專機', icon: '✈️', weight: 4 }
  ];
  var AIRPLANE_READY = false;
  Store.prototype._rollMysteryChest = function (childId) {
    this.getPlayer(childId).stats.mystery++;
    // 呼叫專機「飛到其他島」的功能還沒做（AIRPLANE_READY），做好之前不開出（2026-11-09 家長決定：用不到的不給）；其餘 6 種依原本權重比例分配
    var item = pickWeighted(this.random, AIRPLANE_READY ? MYSTERY_POOL : MYSTERY_POOL.filter(function (x) { return x.id !== 'airplane'; }));
    this.getPlayer(childId).bag[item.id]++;
    var items = {}; items[item.id] = 1;
    return { stars: 0, items: items, item: item.id, text: '得到 ' + item.icon + ' ' + item.name + '！' };
  };
  Store.prototype._logItem = function (childId, action, item, qty, source, result) {
    this.data.adventure.itemLog.push({ id: uid(), childId: childId, action: action, item: item, qty: qty || 1, source: source || '',
      result: result || '', date: this.today(), ts: this.now().getTime() });
  };
  /**
   * 開背包裡的寶箱：kind = 'chest'（一般寶箱）或 'giftMysteryChest'（神諭祝福的神祕寶箱，免鑰匙）
   * 不需要當天出發冒險；內容沿用既有獎勵池。
   */
  Store.prototype.openChest = function (childId, kind) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    if (kind !== 'chest' && kind !== 'giftMysteryChest' && kind !== 'mysteryChest') throw new Error('沒有這種寶箱');
    var p = this.getPlayer(childId);
    if (!(p.bag[kind] > 0)) throw new Error('背包裡沒有這種寶箱');
    if (kind === 'mysteryChest') {
      if (!(p.bag.goldenKey > 0)) throw new Error('需要 1 把 🔑 黃金鑰匙才能打開（星星商店有賣）');
      p.bag.goldenKey--;
      this._logItem(childId, 'use', 'goldenKey', 1, '背包', '打開神祕寶箱');
    }
    p.bag[kind]--;
    var res = kind === 'chest' ? this._rollRegularChest(childId, '一般寶箱') : this._rollMysteryChest(childId);
    res.kind = kind;
    this._logItem(childId, 'open', kind, 1, '背包', res.text);
    this.save();
    return res;
  };

  // ---------- 地圖上的神祕寶箱 ----------
  // 2026-11-09 家長調整：次數用完轉換的神祕寶箱「總共只留 2 個」（還沒撿走的，含等待出現與已在地圖上），撿走一個才能再轉
  var OVERFLOW_CHEST_DAILY = 2, MILESTONE_KEY = 500, MILESTONE_CHEST = 1000, MAGNET_RANGE = 5;
  /** 新增一個還沒出現的神祕寶箱；source：overflow（次數用完轉換，還沒撿走的最多 2 個）、milestone、island */
  Store.prototype._addMapChest = function (childId, source) {
    var today = this.today();
    if (source === 'overflow' && this.data.adventure.mapChests.filter(function (x) {
      return x.childId === childId && x.source === 'overflow';
    }).length >= OVERFLOW_CHEST_DAILY) return null;
    var c = { id: uid(), childId: childId, island: this.getPlayer(childId).island, source: source, createdDate: today, tileId: '', n: 0, hinted: false, ts: this.now().getTime() };
    this.data.adventure.mapChests.push(c);
    this._logItem(childId, 'grant', 'mapChest', 1, source === 'overflow' ? '次數用完轉換' : source === 'milestone' ? '點數里程碑' : '新島嶼', '下次冒險時出現在地圖上');
    return c;
  };
  /**
   * 讓等待中的神祕寶箱出現在這座島上、角色還沒走到的格子：前方第 2 格到終點前一格之間隨機一格（2026-11-09 家長調整，原本前方 2～8 格），
   * 兩個寶箱不放同一格。
   * 次數用完轉換的寶箱要等到之後的日子才出現；里程碑的下次進入地圖就出現。
   * @returns 這次新出現的寶箱數
   */
  var WATER_NO_CHEST = [8, 16, 34, 48, 49, 56, 100];   // 水島：關卡格與鯊魚過關後的第 49 格不放神祕寶箱
  Store.prototype.placeMapChests = function (childId) {
    var p = this.getPlayer(childId), today = this.today(), self = this;
    var tiles = this.getBoard(childId).tiles, last = tiles.length - 2;
    var placed = 0;
    this.data.adventure.mapChests.forEach(function (c) {
      if (c.childId !== childId || c.tileId || c.island !== p.island) return;
      if (c.source === 'overflow' && !(today > c.createdDate)) return;
      if (p.pos + 2 > last) return;                          // 前方沒有位置：等下一區開放
      var used = self.data.adventure.mapChests.filter(function (x) { return x.childId === childId && x.tileId && x.island === p.island; }).map(function (x) { return x.n; });
      var free = [];
      for (var t = p.pos + 2; t <= last; t++) if (used.indexOf(t) < 0 && !(p.island === 'water' && WATER_NO_CHEST.indexOf(t) >= 0)) free.push(t);
      if (!free.length) return;
      var n = free[rint(self.random, 0, free.length - 1)];
      c.n = n; c.tileId = tiles[n].id; c.hinted = false;
      placed++;
    });
    if (placed) this.save();
    return placed;
  };
  /** 地圖上已出現、還沒撿的神祕寶箱 */
  Store.prototype.getMapChests = function (childId) {
    var p = this.getPlayer(childId);
    return this.data.adventure.mapChests.filter(function (c) { return c.childId === childId && c.tileId && c.island === p.island; });
  };
  /** 進入地圖時的提示「附近似乎藏著神祕寶物……」只顯示一次 */
  Store.prototype.takeChestHint = function (childId) {
    var list = this.getMapChests(childId).filter(function (c) { return !c.hinted; });
    list.forEach(function (c) { c.hinted = true; });
    if (list.length) this.save();
    return list.length;
  };
  /** 經過或停在有神祕寶箱的格子：撿起來放進背包（未開啟，要鑰匙） */
  Store.prototype._collectAt = function (childId, positions) {
    var p = this.getPlayer(childId), got = 0, self = this;
    this.data.adventure.mapChests = this.data.adventure.mapChests.filter(function (c) {
      if (c.childId === childId && c.tileId && c.island === p.island && positions.indexOf(c.n) >= 0) {
        p.bag.mysteryChest++; got++;
        self._logItem(childId, 'grant', 'mysteryChest', 1, '地圖第 ' + c.n + ' 格', '撿到神祕寶箱');
        return false;
      }
      return true;
    });
    return got;
  };

  // ---------- 寶物磁鐵 ----------
  /** 前後 5 格內可以吸的寶物：地圖上的神祕寶箱、還沒被吸走的一般寶箱格 */
  Store.prototype.getMagnetTargets = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles, out = [];
    this.getMapChests(childId).forEach(function (c) {
      if (Math.abs(c.n - p.pos) <= MAGNET_RANGE) out.push({ type: 'mystery', id: c.id, n: c.n, name: '神祕寶箱' });
    });
    tiles.forEach(function (t) {
      if (t.type === 'chest' && t.n !== p.pos && Math.abs(t.n - p.pos) <= MAGNET_RANGE && p.looted.indexOf(t.id) < 0) out.push({ type: 'tile', id: t.id, n: t.n, name: '一般寶箱' });
    });
    return out.sort(function (a, b) { return a.n - b.n; });
  };
  /** 使用寶物磁鐵吸取一個目標（{ type, id }） */
  Store.prototype.useMagnet = function (childId, type, id) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (!(p.bag.magnet > 0)) throw new Error('背包裡沒有寶物磁鐵');
    var target = this.getMagnetTargets(childId).find(function (t) { return t.type === type && t.id === id; });
    if (!target) throw new Error('這個寶物不在磁鐵範圍內（前後 ' + MAGNET_RANGE + ' 格）');
    p.bag.magnet--;
    var res = { type: type, n: target.n, stars: 0, items: {}, text: '' };
    if (type === 'mystery') {
      this.data.adventure.mapChests = this.data.adventure.mapChests.filter(function (c) { return c.id !== id; });
      p.bag.mysteryChest++;
      res.items.mysteryChest = 1;
      res.text = '吸到第 ' + target.n + ' 格的 🎁 神祕寶箱！（用黃金鑰匙打開）';
    } else {
      var cr = this._rollRegularChest(childId, '寶物磁鐵');
      p.looted.push(id);
      res.stars = cr.stars; res.items = cr.items;
      res.text = '吸到第 ' + target.n + ' 格的寶箱：' + cr.text;
    }
    this._logItem(childId, 'use', 'magnet', 1, '背包', res.text);
    this.save();
    return res;
  };

  // ---------- 累計得分里程碑：每 +500 黃金鑰匙、每 +1000 神祕寶箱（不補發、不重複） ----------
  /** 還沒有里程碑紀錄的孩子，從目前的累計得分開始算 */
  Store.prototype._initMilestones = function () {
    var self = this, ms = this.data.milestones, changed = false;
    this.data.children.forEach(function (c) {
      if (!ms[c.id]) { ms[c.id] = { base: self.getEarned(c.id), keys: 0, chests: 0 }; changed = true; }
    });
    return changed;
  };
  /** 加紀錄後呼叫：跨過新的門檻就發獎（同一門檻只發一次） @returns {{ keys, chests }} 這次新發的數量 */
  Store.prototype._checkMilestones = function (childId) {
    var ms = this.data.milestones[childId];
    if (!ms) { this._initMilestones(); return { keys: 0, chests: 0 }; }
    var gain = this.getEarned(childId) - ms.base, out = { keys: 0, chests: 0 };
    var p = this.getPlayer(childId);
    var mKey = this.scalePoints(MILESTONE_KEY), mChest = this.scalePoints(MILESTONE_CHEST);   // 2026-11-24：門檻跟著家庭點數尺度
    while (ms.keys < Math.floor(gain / mKey)) {
      ms.keys++; out.keys++; p.bag.goldenKey++;
      this._logItem(childId, 'grant', 'goldenKey', 1, '點數里程碑', '累計得分 +' + (ms.keys * mKey));
    }
    while (ms.chests < Math.floor(gain / mChest)) {
      ms.chests++; out.chests++;
      this._addMapChest(childId, 'milestone');
    }
    return out;
  };

  // ---------- 神諭祝福（媽媽加碼） ----------
  var BLESSINGS = [
    { id: 'chest', name: '一般寶箱', icon: '📦', img: 'images/tiles/chest.webp', desc: '加入寶箱庫存，打開可得星星或道具' },
    { id: 'mysteryChest', name: '神祕寶箱', icon: '🎁', img: 'images/items/mystery_chest.webp', desc: '加入寶箱庫存，不用鑰匙，打開可得特殊道具' },
    { id: 'rerollTicket', name: '命運重骰券', icon: '🎲', img: 'images/items/reroll_ticket.webp', desc: '對剛擲出的結果重新擲一次（不占每日次數）' },
    { id: 'bonusPlay', name: '再來 3 次', icon: '🎮', img: 'images/items/bonus_play.webp', desc: '啟用當天額外 +3 次擲骰、+3 次小遊戲' },
    { id: 'luckyStar', name: '幸運星', icon: '🌟', img: 'images/minigame/star.webp', desc: '立即獲得 10 顆能量星星' }
  ];
  var BLESSING_MAX_QTY = 5, LUCKY_STAR = 10;
  /**
   * 家長發送神諭祝福：只有輸入家長密碼解鎖後才能寫入；不消耗點數與星星；不算寶物商店每週件數
   * @returns 發送紀錄
   */
  Store.prototype.sendBlessing = function (childId, kind, qty, message) {
    this._requireParent();
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var b = BLESSINGS.find(function (x) { return x.id === kind; });
    if (!b) throw new Error('沒有這種祝福');
    var n = qty == null || qty === '' ? 1 : Math.floor(Number(qty));   // 預設 1 份
    if (!(n >= 1 && n <= BLESSING_MAX_QTY)) throw new Error('數量請選 1～' + BLESSING_MAX_QTY);
    var p = this.getPlayer(childId);
    if (kind === 'luckyStar') this._ledger(childId, LUCKY_STAR * n, '神諭祝福：幸運星');
    else p.bag[kind === 'mysteryChest' ? 'giftMysteryChest' : kind] += n;
    var rec = { id: uid(), childId: childId, kind: kind, qty: n, message: String(message || '').trim().slice(0, 100),
      date: this.today(), ts: this.now().getTime(), seen: false };
    this.data.adventure.blessings.push(rec);
    this._logItem(childId, 'grant', kind, n, '神諭祝福', kind === 'luckyStar' ? '+' + (LUCKY_STAR * n) + ' 能量星星' : '');
    this.save();
    return rec;
  };
  /**
   * 家長收回當天送出的神諭祝福：只收回孩子還沒用掉的部分（背包裡還在的道具、還在的星星；星星不會變負數），孩子那邊不另外提示
   * @returns {{taken:number, used:number, stars:boolean}} taken＝收回幾份（幸運星為星星數），used＝已用掉幾份
   */
  Store.prototype.revokeBlessing = function (id) {
    this._requireParent();
    var rec = this.data.adventure.blessings.find(function (x) { return x.id === id; });
    if (!rec) throw new Error('找不到這筆神諭祝福');
    if (rec.revoked) throw new Error('這筆已經收回了');
    if (rec.date !== this.today()) throw new Error('只能收回今天送出的神諭祝福');
    var childId = rec.childId, p = this.getPlayer(childId), total, taken;
    if (rec.kind === 'luckyStar') {
      total = LUCKY_STAR * rec.qty;
      taken = Math.min(total, Math.max(0, this.getStarBalance(childId)));
      if (taken) this._ledger(childId, -taken, '收回神諭祝福：幸運星');
    } else {
      var key = rec.kind === 'mysteryChest' ? 'giftMysteryChest' : rec.kind;
      total = rec.qty;
      taken = Math.min(total, Math.max(0, p.bag[key] || 0));
      p.bag[key] -= taken;
    }
    rec.revoked = { ts: this.now().getTime(), taken: taken, total: total };
    rec.seen = true;   // 還沒打開的領取畫面不再出現
    // 道具紀錄：把當初那筆「取得」改成實際留下的份數（全部收回就刪掉），每日摘要才不會多算
    var log = this.data.adventure.itemLog, keep = rec.kind === 'luckyStar' ? (taken === total ? 0 : rec.qty) : rec.qty - taken;
    var gi = -1, best = Infinity;
    log.forEach(function (x, i) {
      var d = Math.abs(x.ts - rec.ts);
      if (x.childId === childId && x.action === 'grant' && x.item === rec.kind && x.source === '神諭祝福' && d < 2000 && d < best) { gi = i; best = d; }
    });
    if (gi >= 0) { if (keep > 0) log[gi].qty = keep; else log.splice(gi, 1); }
    this.save();
    return { taken: taken, used: total - taken, stars: rec.kind === 'luckyStar' };
  };
  Store.prototype.getBlessings = function (childId) {
    // 新的在前；同一時間時依發送順序（後送的在前）
    return this.data.adventure.blessings.filter(function (x) { return !childId || x.childId === childId; })
      .slice().reverse().sort(function (a, b) { return b.ts - a.ts; });
  };
  Store.prototype.getUnseenBlessings = function (childId) {
    return this.data.adventure.blessings.filter(function (x) { return x.childId === childId && !x.seen; });
  };
  Store.prototype.markBlessingsSeen = function (childId) {
    this.data.adventure.blessings.forEach(function (x) { if (x.childId === childId) x.seen = true; });
    this.save();
  };

  // ---------- 冒險寶物商店（生活點數） ----------
  /** 本週（週一開始）已在寶物商店買了幾件 */
  Store.prototype.getTreasureBoughtThisWeek = function (childId) {
    var ws = CGP.weekStartKey(this.now()), today = this.today();
    return this.data.records.filter(function (r) {
      return r.childId === childId && r.type === 'reward' && /^treasure:/.test(r.refId || '') && r.date >= ws && r.date <= today;
    }).length;
  };
  /** @returns {{ ok, reason }} 是否可以兌換（停用時附原因） */
  Store.prototype.canBuyTreasure = function (childId, itemId) {
    var item = TREASURES.find(function (x) { return x.id === itemId; });
    if (!item) return { ok: false, reason: '沒有這個寶物' };
    if (this.getTreasureBoughtThisWeek(childId) >= TREASURE_WEEKLY_LIMIT) return { ok: false, reason: '本週已兌換 ' + TREASURE_WEEKLY_LIMIT + ' 件' };
    if ((this.getPlayer(childId).bag[itemId] || 0) >= treasureHold(itemId)) return { ok: false, reason: '已持有 ' + treasureHold(itemId) + ' 件' };
    var lack = this.treasurePrice(itemId) - this.getTotal(childId);
    if (lack > 0) return { ok: false, reason: '還差 ' + lack + ' 點' };
    return { ok: true, reason: '' };
  };
  /** 用生活點數兌換寶物：記一筆兌換紀錄（扣點）＋背包 +1，同一次存檔完成 */
  Store.prototype.buyTreasure = function (childId, itemId) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var item = TREASURES.find(function (x) { return x.id === itemId; });
    if (!item) throw new Error('沒有這個寶物');
    var chk = this.canBuyTreasure(childId, itemId);
    if (!chk.ok) throw new Error(chk.reason.indexOf('還差') === 0 ? '點數不足（' + chk.reason + '）' : chk.reason);
    this.getPlayer(childId).bag[itemId]++;
    return this._addRecord(childId, 'reward', 'treasure:' + itemId, '寶物：' + item.name, -this.treasurePrice(itemId)); // _addRecord 會一併存檔
  };

  // ---------- 移動與事件 ----------
  /** 從目前位置前進 steps 格（不超過終點），回傳經過的格子編號 */
  Store.prototype._advance = function (childId, steps) {
    var p = this.getPlayer(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    var path = [], gate = this.waterGate(childId);
    // 抵達目前開放區域的最後一格（第 30 格木門）即停止，多餘步數捨棄
    // 水島：走到還沒完成的必要關卡也停下，剩下的步數作廢（2026-11-16 家長決定）
    for (var i = 0; i < steps && p.pos < end && p.pos !== gate; i++) { p.pos++; path.push(p.pos); }
    p.tileId = this.getBoard(childId).tiles[p.pos].id;
    if (p.pos > p.maxReached) p.maxReached = p.pos;
    this._found = (this._found || 0) + this._collectAt(childId, path);   // 經過或停在神祕寶箱的格子就撿起來
    return path;
  };

  /** 停格事件；depth 防止機會卡連鎖無限前進 */
  Store.prototype._resolveTile = function (childId, depth) {
    var p = this.getPlayer(childId);
    var tile = this.getBoard(childId).tiles[p.pos];
    var rand = this.random;
    var ev = { tile: tile.n, type: tile.type, title: '', text: '', stars: 0, items: {}, extraPath: [], backPath: [] };
    var T = cardText(p.island);   // 卡片文字依所在島嶼換主題（效果相同）
    // 好運金牌（2026-11-24 家長改版）：下一次停在寶箱 → 升級成神祕寶箱（免鑰匙、直接打開）；停在機會格 → 效果發生 2 次
    var looted = tile.type === 'chest' && p.looted.indexOf(tile.id) >= 0;
    var medal = !!(p.medalArmed && ((tile.type === 'chest' && !looted) || tile.type === 'chance'));
    if (medal) { p.medalArmed = false; ev.medal = true; }
    if (looted) {
      ev.title = '🎁 寶箱'; ev.text = '這個寶箱已經被寶物磁鐵吸走了，裡面空空的。';
    } else if (tile.type === 'chest') {
      ev.title = (medal ? '🥇 好運金牌！' : '') + '🎁 寶箱！';
      var cr = medal ? this._rollMysteryChest(childId) : this._rollRegularChest(childId, '寶箱');
      if (medal) { cr.text = '寶箱升級成 🎁 神祕寶箱！' + cr.text; ev.mysteryUpgrade = true; this._logItem(childId, 'open', 'mysteryChest', 1, '好運金牌', cr.text); }
      ev.stars += cr.stars || 0;
      Object.keys(cr.items).forEach(function (k) { ev.items[k] = (ev.items[k] || 0) + cr.items[k]; });
      ev.text = cr.text;
    } else if (tile.type === 'chance') {
      ev.title = (medal ? '🥇 好運金牌！' : '') + '❓ 機會';
      var lines = [], cart = false;
      for (var k = 0; k < (medal ? 2 : 1); k++) {
        // 機會卡（全部正向）：0 礦車前進 2 格、1 發光礦石 +2 星、2 撿到 6 面骰、3 小寶箱 +1～3 星、4 撿到溜冰鞋
        var c = rint(rand, 0, 4);
        if (c === 0 && depth < 1) {
          lines.push(T.cart);
          ev.extraPath = ev.extraPath.concat(this._advance(childId, 2));
          cart = true;
        } else if (c === 1 || (c === 0 && depth >= 1)) {
          ev.stars += 2; this._ledger(childId, 2, T.oreLedger); lines.push(T.ore);
        } else if (c === 2) {
          p.bag.d6++; ev.items.d6 = (ev.items.d6 || 0) + 1; lines.push(T.d6);
          this._logItem(childId, 'grant', 'd6', 1, '機會卡', '撿到 6 面骰');
        } else if (c === 3) {
          var sm = rint(rand, 1, 3);
          ev.stars += sm; this._ledger(childId, sm, '機會：小寶箱'); lines.push(T.chest + sm);
        } else {
          p.bag.skates++; ev.items.skates = (ev.items.skates || 0) + 1; lines.push(T.skates);
          this._logItem(childId, 'grant', 'skates', 1, '機會卡', '撿到溜冰鞋');
        }
      }
      ev.text = lines.join('\n');
      if (cart && ev.extraPath.length) {
        ev.cart = true;   // 介面：先問「上車！」再前進
        var next = this._resolveTile(childId, depth + 1);
        if (next.type !== 'normal' && next.type !== 'start') ev.then = next;
      }
    } else if (tile.type === 'fate') {
      ev.title = '🔮 命運卡';
      var card = pickWeighted(rand, FATE_CARDS);
      ev.card = card.id;
      if (card.id === 'back' && p.bag.shield > 0) {
        // 防護罩自動抵擋後退
        p.bag.shield--;
        ev.shielded = true;
        ev.text = T.backShield;
        this._logItem(childId, 'use', 'shield', 1, '背包', '擋住命運卡後退');
      } else if (card.id === 'back') {
        var n = rint(rand, 1, 2);
        // 後退：不退到起點之前；落點不觸發事件
        for (var b = 0; b < n && p.pos > 0; b++) { p.pos--; ev.backPath.push(p.pos); }
        p.tileId = this.getBoard(childId).tiles[p.pos].id;
        this._found = (this._found || 0) + this._collectAt(childId, ev.backPath);
        ev.text = T.back.replace('{n}', ev.backPath.length);
      } else if (card.id === 'roadblock' && p.bag.shield > 0 && p.pos < this.getBoard(childId).tiles.length - 1 && p.pos !== this.waterGate(childId)) {
        // 防護罩推開路障：前進 1 格（落點不觸發事件，和往回退一樣）
        var rb = T.roadblocks[Math.floor(rand() * T.roadblocks.length)];
        p.bag.shield--;
        ev.shielded = true;
        p.pos++; p.tileId = this.getBoard(childId).tiles[p.pos].id;
        if (p.pos > p.maxReached) p.maxReached = p.pos;
        ev.extraPath.push(p.pos);
        this._found = (this._found || 0) + this._collectAt(childId, ev.extraPath);
        ev.text = '🛡️ 防護罩推開了路障，往前走 1 格！\n（路障：' + rb + '）';
        this._logItem(childId, 'use', 'shield', 1, '背包', '推開路障前進 1 格');
      } else if (card.id === 'roadblock') {
        ev.text = '路障：' + T.roadblocks[Math.floor(rand() * T.roadblocks.length)] + '（這次沒有影響，下次繼續前進）';
      } else {
        var sp = this.addSpecialTask(childId, card.id);
        ev.special = { id: sp.task.id, kind: card.id, name: sp.task.name, duplicate: sp.duplicate };
        ev.text = sp.duplicate
          ? '特殊任務「' + sp.task.name + '」還在進行中喔！先把它完成吧。'
          : '得到特殊任務：「' + sp.task.name + '」\n已加到任務頁，3 天內完成可得 +' + sp.task.points + ' 點！';
      }
    } else if (tile.type === 'minigame') {
      var island = this.getPlayer(childId).island, self = this;
      function pickGame() { return minigameOf(island, self.random); }   // 開新的一場時才決定玩哪一種（stars／leaf／fish）
      var leaf = false, game = 'stars';
      ev.title = '🎮 小遊戲';
      var todays = this.getMinigamesToday(childId), lim = this.getLimits(childId).minigame;   // 2026-11-09：每日小遊戲次數依家長設定
      var mg = todays.filter(function (m) { return m.status === 'pending'; })[0] || (todays.length >= lim ? todays[0] || { status: 'done' } : null);
      if (!mg) {
        game = pickGame(); leaf = game === 'leaf';
        mg = { id: uid(), childId: childId, date: this.today(), tile: tile.n, status: 'pending', caught: 0, stars: 0, ts: this.now().getTime() };
        if (game !== 'stars') mg.game = game;
        this.data.adventure.minigames.push(mg);
        ev.minigame = { id: mg.id };
        ev.text = game === 'lava' ? '看準落石的空隙，跳過熔岩跳跳路！' : game === 'fish' ? '按住拖曳泡泡網，放開就能撈魚！' + FISH_GAME.seconds + ' 秒、' + FISH_GAME.nets + ' 個網子。' : leaf ? '記住松果藏在哪幾堆落葉下，再把它們翻出來！共 3 回合。' : '點星星收集能量星星！第 1 顆在正中央，點到後開始 ' + MINIGAME_SECONDS + ' 秒計時。';
      } else if (mg.status === 'pending') {
        leaf = mg.game === 'leaf'; game = mg.game || 'stars';
        ev.minigame = { id: mg.id };
        ev.text = '今天的小遊戲還沒玩完，現在開始吧！';
      } else if (this._useBonus(childId, 'games')) {
        // 再來 3 次：額外的小遊戲（不轉神祕寶箱）
        game = pickGame(); leaf = game === 'leaf';
        mg = { id: uid(), childId: childId, date: this.today(), tile: tile.n, status: 'pending', bonus: true, caught: 0, stars: 0, ts: this.now().getTime() };
        if (game !== 'stars') mg.game = game;
        this.data.adventure.minigames.push(mg);
        ev.minigame = { id: mg.id, bonus: true };
        ev.text = '🎮 再來 3 次：額外的小遊戲！' + (game === 'fish' ? '按住拖曳泡泡網，放開就能撈魚。' : leaf ? '記住松果的位置再翻出來。' : '點星星收集能量星星。');
      } else {
        // 今天的小遊戲次數用完 → 這次機會轉成神祕寶箱（下次冒險時出現在前方還沒走到的格子；還沒撿走的最多 2 個）
        ev.minigameOverflow = true;
        if (this._addMapChest(childId, 'overflow')) {
          ev.overflowChest = true;
          ev.text = '今天的小遊戲已經玩完了（每天 ' + lim + ' 次）。\n這次的機會變成了一個 🎁 神祕寶箱，下次冒險時會藏在你前方還沒走到的地方！';
        } else ev.text = '今天的小遊戲已經玩完了（每天 ' + lim + ' 次），明天再來挑戰！\n（還有 2 個 🎁 神祕寶箱等你去撿，撿到後才會再變出新的）';
      }
      if (ev.minigame) ev.title = game === 'fish' ? '🎮 小遊戲：珊瑚灣撈魚趣' : leaf ? '🎮 小遊戲：落葉找松果' : '🎮 小遊戲：抓住星星';
    } else if (tile.type === 'boundary') {
      var ri = REGIONS.findIndex(function (r) { return r.id === tile.regionId; });
      var lastR = REGIONS[ri], nextR = REGIONS[ri + 1];
      ev.title = '🚪 抵達' + lastR.name + '的終點！';
      ev.text = '你走完金島第 1～' + lastR.to + ' 格了！' + (nextR ? '前方的「' + nextR.name + '」即將開放。' : '') + '\n下次出發會從起點開始新的一輪，寶箱也會重新放滿！';
    } else if (tile.type === 'end') {
      if (p.island === 'water' && !p.story.blanket) {   // 水島：第 100 格先幫萊莫找到寶貝，才算通關（finishWaterBoss）
        ev.waterBoss = true; ev.title = '🚪 萊莫的家'; ev.text = '門裡好像有人在翻箱倒櫃……「我的寶貝跑去哪裡了？」';
      } else this._clearIsland(childId, ev);
    }
    return ev;
  };

  /**
   * 島嶼通關：第一次＝神祕寶箱（免鑰匙；水島 3 個＝萊莫贈送，其他島 1 個）（金島另得「金島通關」成就）；之後＝ +10 能量星星；
   * 下一次移動前往下一座已開放的島（沒有就從起點開始新的一輪）
   */
  Store.prototype._clearIsland = function (childId, ev) {
    var p = this.getPlayer(childId), bd = this.getBoard(childId), isGold = p.island === 'gold';
    var count = isGold ? ++p.goldClears : (p.islandClears[p.island] = (p.islandClears[p.island] || 0) + 1);
    var first = count === 1, nx = nextIsland(p.island), gift = p.island === 'water' ? 3 : 1;
    ev.title = '🏁 恭喜通關' + bd.name + '！';
    ev.clear = { count: count, first: first, island: p.island, name: bd.name, goal: bd.goalName || '', next: nx ? BOARDS[nx].name : '' };
    if (first) {
      p.bag.giftMysteryChest += gift; ev.items.giftMysteryChest = gift;
      this._logItem(childId, 'grant', 'giftMysteryChest', gift, bd.name + '通關', '第一次通關');
      ev.text = '你走完' + bd.name + ' ' + (bd.tiles.length - 1) + ' 格' + (bd.goalName ? '，抵達' + bd.goalName : '') + '了！\n通關獎勵：🎁 神祕寶箱 ×' + gift + '（不用鑰匙）' + (isGold ? '＋ 🏅 成就「金島通關」' : '');
    } else {
      ev.stars = GOLD_CLEAR_STARS; this._ledger(childId, GOLD_CLEAR_STARS, bd.name + '通關（第 ' + count + ' 次）');
      ev.text = '第 ' + count + ' 次通關' + bd.name + '！通關獎勵：⭐' + GOLD_CLEAR_STARS + ' 能量星星';
    }
    ev.text += nx ? '\n下次出發會前往「' + BOARDS[nx].name + '」！' : '\n下次出發會從起點開始新的一輪。';
    return ev;
  };

  // ---------- 結束今日冒險與今日小結 ----------
  /** 每天第一次移動前記下起點（今日小結用） */
  Store.prototype._markDayStart = function (childId) {
    var p = this.getPlayer(childId), today = this.today();
    if (!p.dayStart || p.dayStart.date !== today) p.dayStart = { date: today, pos: p.pos };
  };
  /** 今日小結：走了幾格、擲骰次數、能量星星、道具、小遊戲、特殊任務、神祕寶箱提示 */
  Store.prototype.getDaySummary = function (childId, date) {
    date = date || this.today();
    var adv = this.data.adventure, p = this.getPlayer(childId);
    var mine = function (x) { return x.childId === childId && x.date === date; };
    var settle = adv.settlements.filter(mine).reduce(function (s, x) { return s + x.stars; }, 0);
    var led = adv.ledger.filter(mine);
    var gained = led.filter(function (x) { return x.delta > 0; }).reduce(function (s, x) { return s + x.delta; }, 0);
    var spent = led.filter(function (x) { return x.delta < 0; }).reduce(function (s, x) { return s - x.delta; }, 0);
    function group(action) {
      var o = {};
      adv.itemLog.filter(function (x) { return mine(x) && x.action === action && x.item !== 'mapChest'; }).forEach(function (x) { o[x.item] = (o[x.item] || 0) + (x.qty || 1); });
      return o;
    }
    var games = adv.minigames.filter(function (m) { return mine(m) && m.status === 'done'; });
    var start = p.dayStart && p.dayStart.date === date ? p.dayStart.pos : p.pos;
    var waiting = adv.mapChests.filter(function (c) { return c.childId === childId; });
    return {
      date: date, startPos: start, endPos: p.pos, moved: p.pos - start,
      rolls: adv.rolls.filter(mine).length,
      stars: { settle: settle, gained: gained, spent: spent },
      itemsGained: group('grant'), itemsUsed: group('use'),
      minigames: games.map(function (m) { return { caught: m.caught, stars: m.stars }; }),
      specialTasks: this.data.specialTasks.filter(function (t) { return t.childId === childId && t.createdDate === date; }).map(function (t) { return t.name; }),
      chests: { onMap: waiting.filter(function (c) { return c.tileId; }).length, coming: waiting.filter(function (c) { return !c.tileId; }).length },
      ended: adv.dayEnds.some(mine)
    };
  };
  /**
   * 結束今日冒險：當天鎖住（不能再擲骰、玩小遊戲、用道具、星星商店購買）；
   * 沒用完的擲骰次數與「再來 3 次」作廢，背包道具保留。
   */
  Store.prototype.endAdventure = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成這一次擲骰再結束');
    var today = this.today();
    this.data.adventure.dayEnds.push({ id: uid(), childId: childId, date: today, ts: this.now().getTime() });
    this.data.adventure.bonusQuota.forEach(function (q) { if (q.childId === childId && q.date === today) { q.rolls = 0; q.games = 0; } });
    this.data.adventure.minigames.forEach(function (m) { if (m.childId === childId && m.date === today && m.status === 'pending') m.status = 'expired'; });
    this.save();
    return this.getDaySummary(childId);
  };

  /** 家長解除今天的結束（需家長密碼解鎖） */
  Store.prototype.reopenAdventure = function (childId) {
    this._requireParent();
    var today = this.today(), before = this.data.adventure.dayEnds.length;
    this.data.adventure.dayEnds = this.data.adventure.dayEnds.filter(function (x) { return !(x.childId === childId && x.date === today); });
    if (this.data.adventure.dayEnds.length === before) throw new Error('今天的冒險沒有結束');
    this.save();
  };

  // ---------- 成就 ----------
  var GOLD_CLEAR_STARS = 10;
  /** 連續出發冒險的最長天數 */
  function longestStreak(dates) {
    var ds = dates.slice().sort(), best = 0, run = 0, prev = null;
    ds.forEach(function (k) {
      var d = CGP.parseDateKey(k);
      if (prev && Math.round((d - prev) / 86400000) === 1) run++; else if (!prev || +d !== +prev) run = 1;
      prev = d; if (run > best) best = run;
    });
    return best;
  }
  /** 成就清單：cat＝adventure（冒險）／collect（收集）／life（生活）；check 回傳是否達成 */
  // 成就清單（2026-11-07 家長定稿：docs/art/achievement_badges.csv）；冒險＝綠框、收集＝紫框、生活＝金框
  var ACHIEVEMENTS = [
    { id: 'advStart', cat: 'adventure', icon: '🧭', name: '冒險開始', desc: '第一次進入今日冒險', check: function (s, c) {
      return s.data.adventure.settlements.some(function (x) { return x.childId === c; }) || !!((s.data.carry || {})[c] || {}).settled; } },   // 含封存結轉
    { id: 'goldClear1', cat: 'adventure', icon: '🏅', name: '金島通關', desc: '走完金島 100 格，抵達金冠城堡', check: function (s, c) { return s.getPlayer(c).goldClears >= 1; } },
    { id: 'reachR2', cat: 'adventure', icon: '💎', name: '抵達水晶礦谷', desc: '走到第 31 格以後', check: function (s, c) { return goldMax(s.getPlayer(c)) >= 31; } },
    { id: 'reachR3', cat: 'adventure', icon: '⚙️', name: '抵達齒輪工坊', desc: '走到第 56 格以後', check: function (s, c) { return goldMax(s.getPlayer(c)) >= 56; } },
    { id: 'goldHero', cat: 'adventure', icon: '🦸', name: '金島小英雄', desc: '完成金島的 4 個任務：撿回礦石、接通礦車軌道、陪小齒吃飯、點亮能源塔', check: function (s, c) {
      var p = s.getPlayer(c);   // 2026-11-19 家長：加上齒輪小屋（陪小齒吃飯）共 4 個；已經拿到的成就照樣保留
      return !!(p.story.ore && p.story.rail && p.story.meal && (p.story.tower || goldMax(p) >= 80)); } },   // 更新前就點亮能源塔的也算
    { id: 'reachR4', cat: 'adventure', icon: '👑', name: '抵達金冠城堡', desc: '走到第 81 格以後', check: function (s, c) { return goldMax(s.getPlayer(c)) >= 81; } },
    { id: 'woodClear1', cat: 'adventure', icon: '🌳', name: '木島通關', desc: '走完木島 100 格，滑進精靈巨樹的神祕樹洞', check: function (s, c) { return (s.getPlayer(c).islandClears.wood || 0) >= 1; } },   // 2026-11-12 新增
    { id: 'woodHero', cat: 'adventure', icon: '🧚', name: '木島小英雄', desc: '幫森林小精靈準備森林派對：撿回松果、採花摘莓果、做邀請卡、布置派對', check: function (s, c) {
      var p = s.getPlayer(c);
      return storiesOf('wood').every(function (k) { return !!p.story[k]; }); } },
    { id: 'chest1', cat: 'collect', icon: '🧰', name: '第一個寶箱', desc: '開過第一個一般寶箱', check: function (s, c) { return s.getPlayer(c).stats.chests >= 1; } },
    { id: 'chests10', cat: 'collect', icon: '📦', name: '寶箱獵人', desc: '開過 10 個一般寶箱', check: function (s, c) { return s.getPlayer(c).stats.chests >= 10; } },
    { id: 'mystery1', cat: 'collect', icon: '🎁', name: '一個大秘寶', desc: '打開第一個神祕寶箱', check: function (s, c) { return s.getPlayer(c).stats.mystery >= 1; } },
    { id: 'catch5', cat: 'collect', icon: '⭐', name: '星星捕手', desc: '「抓住星星」單局抓到 5 顆以上', check: function (s, c) { return bestCatch(s, c) >= 5; } },
    { id: 'catch10', cat: 'collect', icon: '🌟', name: '星海傳說', desc: '「抓住星星」單局抓到 20 顆以上', check: function (s, c) { return bestCatch(s, c) >= 20; } },   // 2026-11-08 由 10 顆改為 20 顆（代號沿用 catch10，保留既有紀錄）
    // 2026-11-08 家長新增：落葉找松果（小遊戲與松果躲躲，第 8 格劇情不算），徽章用遊戲裡的松果圖、松鼠圖
    { id: 'pine10', cat: 'collect', icon: '🌰', name: '松果躲貓貓', desc: '「落葉找松果」單局找到 10 顆以上松果', check: function (s, c) { return bestLeaf(s, c, 'caught') >= 10; } },
    { id: 'squirrel5', cat: 'collect', icon: '🐿️', name: '怎麼都是松鼠', desc: '「落葉找松果」單局翻到 5 隻松鼠', check: function (s, c) { return bestLeaf(s, c, 'squirrels') >= 5; } }
  ].concat([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000].map(function (n) {
    // 2026-11-24：門檻跟著家庭點數尺度（代號維持 earn1000 等，避免舊存檔對不上）；名稱與徽章數字由 earnLabel 換算
    return { id: 'earn' + n, earn: n, cat: 'life', icon: '🥇', name: '獲得 ' + n + ' 分', desc: '起始點數＋累計得分達到 ' + n, revocable: true, check: function (s, c) {
      var mine = (s.data.achievements[c] || {})['earn' + n];
      return (mine && mine.keep) || s.getEarned(c) >= s.scalePoints(n); } };
  })).concat([
    { id: 'special1', cat: 'life', icon: '🔮', name: '第一個特殊任務', desc: '完成 1 個特殊任務', revocable: true, check: function (s, c) { return specialDone(s, c) >= 1; } },
    { id: 'special5', cat: 'life', icon: '💠', name: '特殊任務達人', desc: '完成 5 個特殊任務', revocable: true, check: function (s, c) { return specialDone(s, c) >= 5; } },
    { id: 'streak7', cat: 'life', icon: '📅', name: '連續 7 天冒險', desc: '連續 7 天出發冒險', check: function (s, c) {
      return longestStreak(s.data.adventure.settlements.filter(function (x) { return x.childId === c; }).map(function (x) { return x.date; })) >= 7; } }
  ]);
  // 水島開放後才出現的成就（2026-11-17）
  if (waterOn) ACHIEVEMENTS.splice(ACHIEVEMENTS.findIndex(function (a) { return a.id === 'woodClear1'; }) + 1, 0,
  { id: 'waterClear1', cat: 'adventure', icon: '🌊', name: '水島通關', desc: '幫萊莫找回小被被，完成水島冒險', check: function (s, c) { return (s.getPlayer(c).islandClears.water || 0) >= 1; } },
  { id: 'waterHero', cat: 'adventure', icon: '🐳', name: '水島小英雄', desc: '完成水島的 6 個任務：拼藏寶圖、喝潛水藥水、餵小白鯨、通過鯊魚惡霸、幫燈籠魚找東西、找回萊莫的小被被', check: function (s, c) {   // 2026-11-19 家長
    var p = s.getPlayer(c);
    return storiesOf('water').every(function (k) { return !!p.story[k]; }); } });
  // 2026-11-19 家長：珊瑚灣撈魚趣兩個成就（單局撈到幾條；只算日常小遊戲，劇情撈魚不算）
  if (waterOn) ACHIEVEMENTS.splice(ACHIEVEMENTS.findIndex(function (a) { return a.id === 'squirrel5'; }) + 1, 0,
    { id: 'fish20', cat: 'collect', icon: '🐟', name: '晚上就吃魚', desc: '「珊瑚灣撈魚趣」單局撈到 20 條以上', check: function (s, c) { return bestFish(s, c) >= 20; } },
    { id: 'fish90', cat: 'collect', icon: '🐠', name: '都能開水族館了', desc: '「珊瑚灣撈魚趣」單局撈到 90 條以上', check: function (s, c) { return bestFish(s, c) >= 90; } });
  // 2026-11-24 家長：熔岩跳跳路三關各一個徽章（第一次正常過關；救援不算）。火島開放後才放進成就清單
  var LAVA_ACH = [
    { id: 'lavaEasy', cat: 'collect', icon: '🪨', name: '落石閃避高手', desc: '「熔岩跳跳路」第一次正常通過簡易版', check: function (s, c) { return !!(s.getPlayer(c).lavaBest || {}).easy; } },
    { id: 'lavaHard', cat: 'collect', icon: '🌋', name: '熔岩小勇士', desc: '「熔岩跳跳路」第一次正常通過困難版', check: function (s, c) { return !!(s.getPlayer(c).lavaBest || {}).hard; } },
    { id: 'lavaKing', cat: 'collect', icon: '👑', name: '熔岩王者', desc: '「熔岩跳跳路」第一次正常通過熔岩王者路', check: function (s, c) { return !!(s.getPlayer(c).lavaBest || {}).king; } }
  ];
  if (BOARDS.fire || flagRoot.__cgpFireOpen) ACHIEVEMENTS.push.apply(ACHIEVEMENTS, LAVA_ACH);
  /** 「抓住星星」單局最多抓到幾顆 */
  /** 落葉找松果單局最佳成績：key＝caught（找到的松果）或 squirrels（翻到的松鼠）；含封存結轉 */
  function bestLeaf(s, c, key) {
    var carry = ((s.data.carry || {})[c] || {})[key === 'caught' ? 'bestLeaf' : 'bestSquirrel'] || 0;
    return s.data.adventure.minigames.reduce(function (m, g) { return g.childId === c && g.status === 'done' && g.game === 'leaf' && (g[key] || 0) > m ? g[key] : m; }, carry);
  }
  /** 撈魚單局最多撈到幾條（含封存結轉） */
  function bestFish(s, c) {
    return s.data.adventure.minigames.reduce(function (m, g) { return g.childId === c && g.status === 'done' && g.game === 'fish' && g.caught > m ? g.caught : m; }, ((s.data.carry || {})[c] || {}).bestFish || 0);
  }
  function bestCatch(s, c) {   // 只算「抓住星星」（2026-11-19 修正：撈魚不算）
    return s.data.adventure.minigames.reduce(function (m, g) { return g.childId === c && g.status === 'done' && (!g.game || g.game === 'stars') && g.caught > m ? g.caught : m; }, ((s.data.carry || {})[c] || {}).bestCatch || 0);   // 含封存結轉
  }
  /** 完成的特殊任務數 */
  function specialDone(s, c) {
    var carry = (s.data.carry || {})[c];
    return s.data.records.filter(function (r) { return r.childId === c && /^special:/.test(r.refId || ''); }).length + (carry ? carry.special : 0);   // 含封存結轉
  }
  /** 檢查並記錄新達成的成就（已達成的不會消失）@returns 這次新達成的成就 */
  /**
   * 收回條件已不成立的成就（只限 revocable：依生活紀錄計算的分數與特殊任務成就；冒險、收集類拿到就不會消失）
   * 撤銷、刪除、修改紀錄後呼叫 @returns 這次收回的成就
   */
  Store.prototype.revokeAchievements = function (childId) {
    var self = this, mine = this.data.achievements[childId];
    if (!mine || !this.getChild(childId)) return [];
    var lost = ACHIEVEMENTS.filter(function (a) { return a.revocable && mine[a.id] && !a.check(self, childId); });
    lost.forEach(function (a) { delete mine[a.id]; });
    if (lost.length) this.save();
    return lost.map(function (a) { return self._achView(a); });
  };
  /** 預覽：如果刪掉這筆紀錄（或改成 patch 的點數／孩子），會收回哪些成就（不改資料） */
  Store.prototype.achievementLossIfChanged = function (recordId, patch) {
    var rec = this.data.records.find(function (r) { return r.id === recordId; });
    if (!rec) return [];
    var self = this, mine = this.data.achievements[rec.childId] || {}, orig = this.data.records;
    this.data.records = orig.filter(function (r) { return r.id !== recordId; });
    if (patch) {
      var copy = Object.assign({}, rec);
      if (patch.childId != null) copy.childId = String(patch.childId);
      if (patch.points != null && patch.points !== '') copy.points = (rec.points < 0 ? -1 : 1) * Math.abs(Number(patch.points) || 0);
      this.data.records = this.data.records.concat([copy]);
    }
    try {
      return ACHIEVEMENTS.filter(function (a) { return a.revocable && mine[a.id] && !a.check(self, rec.childId); }).map(function (a) { return self._achView(a); });
    } finally { this.data.records = orig; }
  };
  Store.prototype.checkAchievements = function (childId) {
    if (!this.getChild(childId)) return [];
    this.revokeAchievements(childId);   // 先收回條件不成立的（例如家長在別處修改了紀錄）
    var self = this, mine = this.data.achievements[childId] || (this.data.achievements[childId] = {});
    var fresh = ACHIEVEMENTS.filter(function (a) { return !mine[a.id] && a.check(self, childId); });
    fresh.forEach(function (a) { mine[a.id] = { date: self.today(), ts: self.now().getTime() }; });
    if (fresh.length) this.save();
    return fresh.map(function (a) { return self._achView(a); });
  };
  /** 成就列表（含是否達成、達成日期） */
  /** 分數成就換算後的顯示（2026-11-24 家庭點數尺度）@returns {{ n, name, desc }} */
  Store.prototype.earnLabel = function (a) { var n = this.scalePoints(a.earn); return { n: n, name: '獲得 ' + n + ' 分', desc: '起始點數＋累計得分達到 ' + n }; };
  /**
   * 改了家庭點數尺度：當下已達成的分數成就一併標記、不跳劇場；已拿到的分數成就標記 keep，不因門檻變高而收回
   */
  /** 給畫面用的成就（分數成就換成依尺度換算後的名稱與數字） */
  Store.prototype._achView = function (a) {
    if (!a.earn) return a;
    var lb = this.earnLabel(a), o = {};
    Object.keys(a).forEach(function (k) { o[k] = a[k]; });
    o.name = lb.name; o.desc = lb.desc; o.earnN = lb.n;
    return o;
  };
  Store.prototype._onScaleChange = function () {
    var self = this;
    this.data.children.forEach(function (c) {
      var mine = self.data.achievements[c.id] || (self.data.achievements[c.id] = {});
      ACHIEVEMENTS.forEach(function (a) { if (a.earn && mine[a.id]) mine[a.id].keep = true; });
      ACHIEVEMENTS.forEach(function (a) { if (a.earn && !mine[a.id] && a.check(self, c.id)) mine[a.id] = { date: self.today(), ts: self.now().getTime(), keep: true }; });
    });
  };
  Store.prototype.getAchievements = function (childId) {
    var mine = this.data.achievements[childId] || {}, self = this;
    return ACHIEVEMENTS.map(function (a) { var lb = a.earn ? self.earnLabel(a) : null; return { id: a.id, earn: a.earn ? lb.n : undefined, cat: a.cat, icon: a.icon, name: lb ? lb.name : a.name, desc: lb ? lb.desc : a.desc, done: !!mine[a.id], date: mine[a.id] ? mine[a.id].date : '', ts: mine[a.id] ? mine[a.id].ts || 0 : 0 }; });
  };

  // ---------- 小遊戲「抓住星星」 ----------
  /** 今天的小遊戲紀錄（pending＝已停在小遊戲格但還沒玩完；done＝已領取） */
  Store.prototype.getMinigameToday = function (childId) {
    return this.getMinigamesToday(childId)[0] || null;
  };
  /** 今天停在小遊戲格的基本場次（不含再來 3 次、星星呼喚等額外場次；重置過的不算） */
  Store.prototype.getMinigamesToday = function (childId) {
    var today = this.today();
    return this.data.adventure.minigames.filter(function (m) { return m.childId === childId && m.date === today && !m.bonus && !m.limitReset; });
  };
  /**
   * 家長重置今天的次數上限（需家長密碼）：骰子 3 次、小遊戲 1 次、前進道具 5 次、傳送門 1 次、神奇骰子 1 顆、星星呼喚 1 個都重新計算。
   * 只影響今天；已用掉的道具不退回；舊紀錄保留（只是不再計入今天的上限）
   */
  Store.prototype.resetDailyLimits = function (childId) {
    if (this._requireParent) this._requireParent();
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var today = this.today(), adv = this.data.adventure;
    function mine(x) { return x.childId === childId && x.date === today; }
    // 今天已計入上限的紀錄標記為「已重置」，之後計算次數時跳過（紀錄本身保留）
    adv.rolls.forEach(function (r) { if (mine(r)) r.limitReset = true; });
    adv.itemLog.forEach(function (x) { if (mine(x) && x.action === 'use') x.limitReset = true; });
    adv.minigames.forEach(function (m) { if (mine(m) && !m.bonus && m.status !== 'pending') m.limitReset = true; });
    adv.limitResets.push({ id: uid(), childId: childId, date: today, ts: this.now().getTime() });   // 重置紀錄
    this.save();
  };
  /** 今天還有沒玩完的小遊戲（重新整理後可繼續） */
  Store.prototype.getPendingMinigame = function (childId) {
    var today = this.today();
    return this.data.adventure.minigames.find(function (m) { return m.childId === childId && m.date === today && m.status === 'pending'; }) || null;
  };
  /**
   * 小遊戲結束：每抓 1 顆得 1 顆能量星星（最多 15 顆），只能領取一次；caught 記實際抓到數
   * @returns 更新後的紀錄 { caught, stars }
   */
  Store.prototype.finishMinigame = function (childId, caught, squirrels) {   // squirrels：落葉找松果這局翻到幾隻松鼠（成就「怎麼都是松鼠」）
    this._requirePlay(childId);
    var m = this.getPendingMinigame(childId);
    if (!m) throw new Error('今天沒有可以玩的小遊戲');
    var leaf = m.game === 'leaf', fish = m.game === 'fish';
    var got = Math.max(0, Math.floor(Number(caught) || 0));
    if (leaf) got = Math.min(LEAF_MAX_FOUND, got);
    if (fish) got = Math.min(FISH_GAME.maxCaught, got);
    var n = fish ? fishStars(got) : leaf ? leafStars(got) : minigameStars(got);
    m.status = 'done'; m.caught = got; m.stars = n; m.doneTs = this.now().getTime();
    if (leaf) m.squirrels = Math.max(0, Math.min(LEAF_GAME.decoys * LEAF_GAME.rounds.length, Math.floor(Number(squirrels) || 0)));
    if (n > 0) this._ledger(childId, n, fish ? '小遊戲：珊瑚灣撈魚趣' : leaf ? '小遊戲：落葉找松果' : '小遊戲：抓住星星');
    this.save();
    return m;
  };

  // ---------- 火島《熔岩跳跳路》（2026-11-22 家長草稿；兩關合計一次小遊戲，整場結束才一次給星） ----------
  // 2026-11-24 家長：加第 3 關「熔岩王者路」，星星重分 8／12／15（上限不變）；救援保留前一關（簡易版救援 4）
  var LAVA_STARS = { easyRescue: 3, easyClear: 5, hardRescue: 5, hardClear: 7, kingRescue: 7, kingClear: 8 };   // 2026-11-25 家長：原 4／8／8／12／12／15
  var LAVA_STAGES = ['easy', 'hard', 'king'];
  /**
   * 一關結束先記下成績（不給星）：stage＝easy／hard，result＝clear（3 次內過關）或 rescue（洛洛救援）。
   * 中途關掉 App 回來時用（家長決定保留成績）；下一關要先正常過前一關。
   */
  Store.prototype.saveLavaStage = function (childId, stage, result) {
    this._requirePlay(childId);
    var m = this.getPendingMinigame(childId);
    if (!m || m.game !== 'lava') throw new Error('今天沒有可以玩的熔岩跳跳路');
    if (result !== 'clear' && result !== 'rescue') throw new Error('結果不正確');
    var k = LAVA_STAGES.indexOf(stage);
    if (k < 0 || k > 1) throw new Error('沒有這一關');
    var lv = m.lava || {};
    if (k === 1 && lv.easy !== 'clear') throw new Error('簡易版還沒過關');
    m.lava = k === 0 ? { easy: result } : { easy: 'clear', hard: result };
    this.save();
    return m;
  };
  Store.prototype.saveLavaEasy = function (childId, result) { return this.saveLavaStage(childId, 'easy', result); };   // 相容舊呼叫
  /** 洛洛示範看過了沒（2026-11-23：每個孩子第一次自動播放） */
  Store.prototype.lavaDemoSeen = function (childId) { return !!this.getPlayer(childId).lavaDemo; };
  Store.prototype.markLavaDemo = function (childId) { var p = this.getPlayer(childId); if (!p.lavaDemo) { p.lavaDemo = this.today(); this.save(); } };
  /**
   * 熔岩跳跳路結算（只結算一次）：outcome＝easyRescue／easyClear（過關後選擇結束）／hardRescue／hardClear（過關後選擇結束）／kingRescue／kingClear。
   * 困難版要先正常過簡易版、王者路要先正常過困難版；前一關是救援的，一律算成前一關救援。
   * 正常過關的關卡記進 p.lavaBest（成就用，不會被每日紀錄封存影響）。
   */
  Store.prototype.finishLava = function (childId, outcome) {
    this._requirePlay(childId);
    var m = this.getPendingMinigame(childId);
    if (!m || m.game !== 'lava') throw new Error('今天沒有可以玩的熔岩跳跳路');
    if (!LAVA_STARS[outcome]) throw new Error('沒有這種結果');
    var lv = m.lava || {};
    if (/^hard/.test(outcome) && lv.easy !== 'clear') throw new Error('簡易版還沒過關');
    if (/^king/.test(outcome) && lv.hard !== 'clear') throw new Error('困難版還沒過關');
    if (lv.easy === 'rescue') outcome = 'easyRescue';
    else if (lv.hard === 'rescue' && !/^easy/.test(outcome)) outcome = 'hardRescue';
    var n = LAVA_STARS[outcome], stage = outcome.replace(/(Rescue|Clear)$/, ''), res = /Clear$/.test(outcome) ? 'clear' : 'rescue';
    var out = { outcome: outcome };
    LAVA_STAGES.forEach(function (st, i) { var si = LAVA_STAGES.indexOf(stage); if (i < si) out[st] = 'clear'; else if (i === si) out[st] = res; });
    m.status = 'done'; m.caught = 0; m.stars = n; m.doneTs = this.now().getTime(); m.lava = out;
    var p = this.getPlayer(childId), today = this.today();
    if (!p.lavaBest || typeof p.lavaBest !== 'object') p.lavaBest = {};
    LAVA_STAGES.forEach(function (st) { if (out[st] === 'clear' && !p.lavaBest[st]) p.lavaBest[st] = today; });
    this._ledger(childId, n, '小遊戲：熔岩跳跳路');
    this.save();
    return m;
  };

  // ---------- 擲骰（分兩步：擲出點數 → 前進；中間可用命運重骰券） ----------
  /** 今天已用的「基本」擲骰次數（神奇骰子、再來 3 次的額外次數不算） */
  Store.prototype.getRollsToday = function (childId) {
    var today = this.today();
    return this.data.adventure.rolls.filter(function (r) { return r.childId === childId && r.date === today && (!r.kind || r.kind === 'base') && !r.limitReset; }).length;
  };
  /** 再來 3 次：今天剩下的額外擲骰／小遊戲次數 */
  Store.prototype.getBonusQuota = function (childId) {
    var today = this.today();
    return this.data.adventure.bonusQuota.reduce(function (o, q) {
      if (q.childId === childId && q.date === today) { o.rolls += q.rolls; o.games += q.games; }
      return o;
    }, { rolls: 0, games: 0 });
  };
  Store.prototype._useBonus = function (childId, field) {
    var today = this.today();
    var q = this.data.adventure.bonusQuota.find(function (x) { return x.childId === childId && x.date === today && x[field] > 0; });
    if (!q) return false;
    q[field]--;
    return true;
  };
  /** 今天還能擲幾次（基本 3 次剩餘＋額外次數；不含神奇骰子） */
  Store.prototype.getRollsLeft = function (childId) {
    return Math.max(0, this.getLimits(childId).dice - this.getRollsToday(childId)) + this.getBonusQuota(childId).rolls;
  };
  /** 今天的神奇骰子是否已經用到上限（預設每天 1 顆，家長可調） */
  Store.prototype.magicUsedToday = function (childId) {
    var today = this.today();
    return this.data.adventure.rolls.filter(function (r) { return r.childId === childId && r.date === today && r.kind === 'magic' && !r.limitReset; }).length >= this.getLimits(childId).magic;
  };
  /**
   * 第一步：擲出點數（計入次數、消耗骰子），還沒前進。
   * die：'d6'、'd12'、'magic'（神奇骰子：12 面、不占每日 3 次、每天最多 1 顆）
   */
  Store.prototype.prepareRoll = function (childId, die) {
    this._requirePlay(childId);
    if (die !== 'd6' && die !== 'd12' && die !== 'magic') throw new Error('沒有這種骰子');
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    this._requireNoWaterTask(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    var needLap = p.pos >= end;   // 第二區開放前：在木門時這次從起點開始下一輪（檢查都通過才執行）
    var kind = 'base';
    if (die === 'magic') {
      if (!(p.bag.magicDice > 0)) throw new Error('背包裡沒有神奇骰子');
      if (this.magicUsedToday(childId)) throw new Error('神奇骰子每天最多用 ' + this.getLimits(childId).magic + ' 顆，明天再來！');
      kind = 'magic';
    } else {
      var diceLim = this.getLimits(childId).dice;
      if (this.getRollsToday(childId) >= diceLim) {
        if (this.getBonusQuota(childId).rolls > 0) kind = 'bonus';
        else throw new Error(diceLim ? '今天已經擲了 ' + diceLim + ' 次骰子，明天再來！' : '家長設定今天不能擲骰子');
      }
      if (p.bag[die] <= 0) throw new Error('背包裡沒有' + (die === 'd6' ? ' 6 面骰' : ' 12 面骰'));
    }
    this._markDayStart(childId);
    var travel = needLap ? this._startNext(childId) : null;
    var sides = die === 'd6' ? 6 : 12;
    var value = rint(this.random, 1, sides);
    if (kind === 'bonus') this._useBonus(childId, 'rolls');
    if (die === 'magic') { p.bag.magicDice--; this._logItem(childId, 'use', 'magicDice', 1, '背包', '擲出 ' + value); } else p.bag[die]--;
    var roll = { id: uid(), childId: childId, date: this.today(), die: die === 'magic' ? 'd12' : die, kind: kind, value: value, from: p.pos, to: p.pos, ts: this.now().getTime() };
    this.data.adventure.rolls.push(roll);
    p.pendingRoll = { rollId: roll.id, die: die, kind: kind, sides: sides, value: value, from: p.pos, rerolled: false, lap: needLap, travel: travel };
    this.save();
    return Object.assign({}, p.pendingRoll);
  };
  /** 命運重骰券：對剛擲出、還沒前進的結果重擲一次（用原本的骰子），新結果取代舊結果；同一次只能用 1 張 */
  Store.prototype.rerollPending = function (childId) {
    var p = this.getPlayer(childId), pr = p.pendingRoll;
    if (!pr) throw new Error('沒有可以重擲的結果');
    if (pr.rerolled) throw new Error('同一次擲骰只能用 1 張命運重骰券');
    if (!(p.bag.rerollTicket > 0)) throw new Error('背包裡沒有命運重骰券');
    var old = pr.value;
    pr.value = rint(this.random, 1, pr.sides);
    pr.rerolled = true;
    p.bag.rerollTicket--;
    var roll = this.data.adventure.rolls.find(function (r) { return r.id === pr.rollId; });
    if (roll) roll.value = pr.value;
    this._logItem(childId, 'use', 'rerollTicket', 1, '背包', old + ' → ' + pr.value);
    this.save();
    return Object.assign({ old: old }, pr);
  };
  /** 第二步：依點數前進並觸發停格事件 */
  Store.prototype.commitRoll = function (childId) {
    var p = this.getPlayer(childId), pr = p.pendingRoll;
    if (!pr) throw new Error('沒有待前進的擲骰');
    this._found = 0;
    var path = this._advance(childId, pr.value);
    var event = this._resolveTile(childId, 0);
    var roll = this.data.adventure.rolls.find(function (r) { return r.id === pr.rollId; });
    if (roll) roll.to = p.pos;
    p.pendingRoll = null;
    this.save();
    return { die: pr.die === 'magic' ? 'magic' : pr.die, kind: pr.kind, value: pr.value, from: pr.from, path: path, event: event, rollsLeft: this.getRollsLeft(childId), found: this._found, lap: !!pr.lap, travel: pr.travel || null };
  };
  /**
   * 擲骰並直接前進（沒有重骰券時使用）：每天基本 3 次，用完後可用「再來 3 次」的額外次數
   * @returns {{ die, value, from, path, event, rollsLeft }}
   */
  Store.prototype.rollDice = function (childId, die) {
    this.prepareRoll(childId, die);
    return this.commitRoll(childId);
  };

  /**
   * 暫時規則（第二區開放前）：在第 30 格木門時，下一次移動從起點開始新的一輪。
   * 一般寶箱格重新放滿（磁鐵吸過的也恢復），神祕寶箱與背包不變。
   */
  Store.prototype._newLap = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles;
    p.pos = 0; p.tileId = tiles[0].id; p.looted = [];
    p.laps = (p.laps || 0) + 1;
    this._offerStoryReset(childId);
  };
  /**
   * 在最後一格時的下一次移動：停在全島終點且有下一座已開放的島 → 前往該島起點；否則從起點開始新的一輪。
   * @returns {{ island: string, name: string }|null} 換島時回傳目的地
   */
  Store.prototype._startNext = function (childId) {
    var p = this.getPlayer(childId), board = this.getBoard(childId);
    var to = board.tiles[p.pos].type === 'end' ? nextIsland(p.island) : null;
    if (!to) { this._newLap(childId); return null; }
    p.islands[p.island] = { laps: p.laps || 0, maxReached: p.maxReached || 0 };   // 保存原島進度（回來時從起點出發）
    var keep = p.islands[to] || {}, nb = BOARDS[to];
    p.island = to; p.pos = 0; p.tileId = nb.tiles[0].id; p.looted = [];
    p.laps = keep.laps || 0; p.maxReached = keep.maxReached || 0;
    this._logItem(childId, 'travel', to, 1, board.name, '前往' + nb.name);
    this._offerStoryReset(childId);
    return { island: to, name: nb.name };
  };
  /**
   * 金島 → 木島的專機（2026-11-14 家長設計）：通關金島、停在第 100 格時，地圖出現「搭專機前往木島」按鈕。
   * 不算擲骰或道具次數、不用任何道具。其他島之間的移動維持原本做法（下一次移動時出發）。
   * @returns {{ island, name }|null} 現在可以搭專機時回傳目的地
   */
  Store.prototype.flightReady = function (childId) {
    var p = this.getPlayer(childId), board = this.getBoard(childId);
    if (p.island !== 'gold' || p.pendingRoll || board.tiles[p.pos].type !== 'end') return null;
    var to = nextIsland(p.island);
    return to ? { island: to, name: BOARDS[to].name } : null;
  };
  /** 搭專機：直接到下一座島的起點（第 0 格），原島進度照舊保存 */
  Store.prototype.takeFlight = function (childId) {
    this._requirePlay(childId);
    if (!this.flightReady(childId)) throw new Error('現在沒有專機可以搭');
    var from = this.getBoard(childId).name;
    var dest = this._startNext(childId);
    this.save();
    return { from: from, island: dest.island, name: dest.name };
  };
  /** 移動類道具：溜冰鞋 3 格、飛行翼 20 格（不算擲骰次數；到目前開放的最後一格就停） */
  var MOVE_ITEMS = { skates: { steps: 3, name: '溜冰鞋' }, wings: { steps: 20, name: '飛行翼' } };
  /** 每日使用上限（2026-11-07 家長決定）：前進類（溜冰鞋＋飛行翼）合計 5 次、傳送門 1 次 */
  var MOVE_DAILY_LIMIT = 5, DOOR_DAILY_LIMIT = 1;
  /** 今天用了幾次指定道具（依道具紀錄計算） */
  Store.prototype._usesToday = function (childId, items) {
    var today = this.today();
    return this.data.adventure.itemLog.filter(function (x) {
      return x.childId === childId && x.action === 'use' && x.date === today && items.indexOf(x.item) >= 0 && !x.limitReset;
    }).length;
  };
  /** 今天前進類道具與傳送門還能用幾次 */
  Store.prototype.getItemLimitsToday = function (childId) {
    var L = this.getLimits(childId);
    return { move: Math.max(0, L.move - this._usesToday(childId, ['skates', 'wings'])),
      door: Math.max(0, L.door - this._usesToday(childId, ['door'])),
      beluga: Math.max(0, L.beluga - this._usesToday(childId, ['beluga'])),   // 水島：小白鯨載著前進
      sub: Math.max(0, L.sub - this._usesToday(childId, ['submarine'])) };
  };
  Store.prototype._useMoveItem = function (childId, item) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    var end = this.getBoard(childId).tiles.length - 1;
    var needLap = p.pos >= end;
    if (p.island === 'water') throw new Error('在水裡不能用' + MOVE_ITEMS[item].name + '喔！');
    if (!(p.bag[item] > 0)) throw new Error('背包裡沒有' + MOVE_ITEMS[item].name);
    if (!this.getItemLimitsToday(childId).move) throw new Error('今天的前進道具（溜冰鞋、飛行翼）已經用了 ' + this.getLimits(childId).move + ' 次，明天再用！');
    this._markDayStart(childId);
    var travel = needLap ? this._startNext(childId) : null;
    var from = p.pos;
    p.bag[item]--;
    this._found = 0;
    var path = this._advance(childId, MOVE_ITEMS[item].steps);
    this._logItem(childId, 'use', item, 1, '背包', '第 ' + from + ' → ' + p.pos + ' 格');   // 溜冰鞋也記錄，用來計算每日上限
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: item, value: MOVE_ITEMS[item].steps, from: from, path: path, event: event, found: this._found, lap: needLap, travel: travel };
  };
  /**
   * 魔法鞋（2026-11-25 家長）：自選前進 1～6 步；不占擲骰、溜冰鞋／飛行翼次數；每天最多用 limits.shoes 個
   * 最遠：終點、或前方第一個還沒完成的劇情任務格（同傳送門）；水島不能用（同溜冰鞋）
   * @returns {{ max, reason, previews: [{ steps, n, type }] }}
   */
  Store.prototype.magicShoesOptions = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles, end = tiles.length - 1, lim = this.doorLimit(childId);
    var max = Math.min(6, end - p.pos), reason = max < 6 ? '最遠到終點' : '';
    if (lim && lim.tile - p.pos < max) { max = lim.tile - p.pos; reason = '第 ' + lim.tile + ' 格的任務「' + lim.name + '」還沒完成'; }
    var gate = this.waterGate ? this.waterGate(childId) : -1;
    if (gate >= 0 && gate > p.pos && gate - p.pos < max) { max = gate - p.pos; reason = '前面的關卡還沒完成'; }
    var previews = [];
    for (var k = 1; k <= 6; k++) { var n = p.pos + k; previews.push({ steps: k, n: n, type: k <= max && tiles[n] ? tiles[n].type : null }); }
    return { max: Math.max(0, max), reason: reason, previews: previews };
  };
  Store.prototype.useMagicShoes = function (childId, steps) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    if (p.island === 'water') throw new Error('在水裡不能用魔法鞋喔！');
    if (!(p.bag.magicShoes > 0)) throw new Error('背包裡沒有魔法鞋');
    if (this._usesToday(childId, ['magicShoes']) >= this.getLimits(childId).shoes) throw new Error('魔法鞋每天只能用 ' + this.getLimits(childId).shoes + ' 個，明天再用！');
    steps = Math.floor(Number(steps));
    var opt = this.magicShoesOptions(childId);
    if (!(steps >= 1 && steps <= 6)) throw new Error('請選 1～6 步');
    if (steps > opt.max) throw new Error(opt.max ? '這次最多只能走 ' + opt.max + ' 步（' + opt.reason + '）' : '已經走不動了（' + opt.reason + '）');
    this._markDayStart(childId);
    var from = p.pos;
    p.bag.magicShoes--;
    this._found = 0;
    var path = this._advance(childId, steps);
    this._logItem(childId, 'use', 'magicShoes', 1, '背包', '第 ' + from + ' → ' + p.pos + ' 格（自選 ' + steps + ' 步）');
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'magicShoes', value: steps, from: from, path: path, event: event, found: this._found, lap: false, travel: null };
  };
  /** 溜冰鞋：前進 3 格，不算擲骰次數 */
  Store.prototype.useSkates = function (childId) { return this._useMoveItem(childId, 'skates'); };
  /** 飛行翼：前進 20 格（第一區到第 30 格就停） */
  Store.prototype.useWings = function (childId) { return this._useMoveItem(childId, 'wings'); };
  /** 傳送門：傳送到本島已開放的指定格子（不含起點、目前位置與最後一格），落點觸發事件 */
  /**
   * 傳送門不能跳過還沒完成的任務格（2026-11-12 家長決定）：
   * @returns 前方第一個還沒完成的劇情任務 { tile, name }（傳送門最遠只能到這一格；剛好傳到這格會觸發任務），沒有就回傳 null
   */
  Store.prototype.doorLimit = function (childId) {
    var p = this.getPlayer(childId), end = this.getBoard(childId).tiles.length - 1, best = null;
    storiesOf(p.island).forEach(function (id) {
      var st = STORIES[id];
      if (!p.story[id] && st.tile > p.pos && st.tile < end && (!best || st.tile < best.tile)) best = { id: id, tile: st.tile, name: st.name };
    });
    return best;
  };
  Store.prototype.useDoor = function (childId, n) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    if (p.island === 'water') throw new Error('在水裡不能用傳送門喔！');
    var tiles = this.getBoard(childId).tiles, end = tiles.length - 1;
    n = Math.floor(Number(n));
    if (!(n >= 1 && n < end)) throw new Error('傳送門不能傳送到這一格');
    if (n === p.pos) throw new Error('你已經在這一格了');
    if (!(p.bag.door > 0)) throw new Error('背包裡沒有傳送門');
    if (!this.getItemLimitsToday(childId).door) throw new Error('傳送門每天只能用 ' + this.getLimits(childId).door + ' 次，明天再用！');
    var lim = this.doorLimit(childId);
    if (lim && n > lim.tile) throw new Error('第 ' + lim.tile + ' 格的任務「' + lim.name + '」還沒完成，傳送門最遠只能到第 ' + lim.tile + ' 格');
    this._markDayStart(childId);
    var from = p.pos;
    p.bag.door--;
    p.pos = n; p.tileId = tiles[n].id;
    if (n > p.maxReached) p.maxReached = n;
    this._logItem(childId, 'use', 'door', 1, '背包', '第 ' + from + ' → ' + n + ' 格');
    this._found = this._collectAt(childId, [n]);
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'door', value: 0, from: from, path: [n], event: event, found: this._found };
  };
  /** 星星呼喚：馬上玩一局「抓住星星」（額外一局，不占每天 1 次；每天最多用 1 個）@returns 小遊戲紀錄 */
  Store.prototype.useStarCall = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (!(p.bag.starCall > 0)) throw new Error('背包裡沒有星星呼喚');
    if (this.getPendingMinigame(childId)) throw new Error('先把還沒玩完的小遊戲玩完');
    if (this._usesToday(childId, ['starCall']) >= this.getLimits(childId).starCall) throw new Error('星星呼喚每天只能用 ' + this.getLimits(childId).starCall + ' 個，明天再用！');
    p.bag.starCall--;
    var mg = { id: uid(), childId: childId, date: this.today(), tile: p.pos, status: 'pending', bonus: true, starCall: true, caught: 0, stars: 0, ts: this.now().getTime() };
    this.data.adventure.minigames.push(mg);
    this._logItem(childId, 'use', 'starCall', 1, '背包', '額外一局抓住星星');
    this.save();
    return mg;
  };
  /** 松果躲躲：馬上玩一局「落葉找松果」（額外一局，不占每天 1 次；每天最多用 1 個，和星星呼喚各自計算）@returns 小遊戲紀錄 */
  Store.prototype.usePineHide = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (!(p.bag.pineHide > 0)) throw new Error('背包裡沒有松果躲躲');
    if (this.getPendingMinigame(childId)) throw new Error('先把還沒玩完的小遊戲玩完');
    if (this._usesToday(childId, ['pineHide']) >= this.getLimits(childId).pineHide) throw new Error('松果躲躲每天只能用 ' + this.getLimits(childId).pineHide + ' 個，明天再用！');
    p.bag.pineHide--;
    var mg = { id: uid(), childId: childId, date: this.today(), tile: p.pos, status: 'pending', bonus: true, starCall: true, game: 'leaf', caught: 0, stars: 0, ts: this.now().getTime() };
    this.data.adventure.minigames.push(mg);
    this._logItem(childId, 'use', 'pineHide', 1, '背包', '額外一局落葉找松果');
    this.save();
    return mg;
  };
  /**
   * 金島劇情（2026-11-08 家長決定，技師當導遊）：ore＝第 5 格礦工求助（撿回 5 顆礦石）、rail＝第 30 格礦車轉轍（拉下拉桿）、
   * tower＝第 80 格能源主塔（連點充電）。每個第一次完成給 ⭐STORY_STARS；三個都完成解鎖成就「金島小英雄」
   */
  var STORY_STARS = 3;
  // 木島劇情「森林派對」（2026-11-09 家長決定，森林小精靈當導遊，每區 1 個）：pinecone＝第 8 格落葉找松果、flowers＝第 40 格採花摘莓果、
  // invite＝第 65 格做邀請卡送給森林動物、party＝第 92 格布置派對；四個都完成解鎖成就「木島小英雄」
  // 格號先沿用 WOOD_ISLAND_PLAN 的一般格，木島草圖到貨後可再調；完成紀錄存在 players[id].story（代號各島不重複）
  var STORIES = {
    ore: { island: 'gold', tile: 5, name: '礦工求助' }, rail: { island: 'gold', tile: 30, name: '礦車轉轍' },
    meal: { island: 'gold', tile: 53, name: '齒輪小屋' },   // 2026-11-19 家長企劃：陪小齒吃飯（第二區左上的齒輪小屋；計畫 docs/gold/GEAR_HOUSE_PLAN.md）
    tower: { island: 'gold', tile: 80, name: '能源主塔' },
    // 2026-11-09 家長決定：木島劇情改成「森林派對」（木島尚未上線，沒有既有存檔，代號直接換新）
    pinecone: { island: 'wood', tile: 8, name: '撿回松果' }, flowers: { island: 'wood', tile: 40, name: '採花摘莓果' },
    invite: { island: 'wood', tile: 65, name: '派對邀請卡' }, party: { island: 'wood', tile: 92, name: '森林派對' },
    // 2026-11-16 水島「深海失落的寶藏」：6 個必要關卡（走到就停、剩下步數作廢，完成前不能往前）
    memo: { island: 'water', tile: 8, name: '神祕藏寶圖', gate: true }, potion: { island: 'water', tile: 16, name: '漁夫的潛水藥水', gate: true },
    feed: { island: 'water', tile: 34, name: '餵小白鯨', gate: true }, shark: { island: 'water', tile: 48, name: '大鯊魚攔路', gate: true },
    lantern: { island: 'water', tile: 56, name: '燈籠魚找東西', gate: true }, blanket: { island: 'water', tile: 100, name: '萊莫的小被被', gate: true }
  };
  /** 某座島的劇情代號（依 STORIES 的順序） */
  function storiesOf(island) { return Object.keys(STORIES).filter(function (k) { return STORIES[k].island === island; }); }
  /** @returns {boolean} 這次是第一次完成（有給獎勵） */
  Store.prototype.completeStory = function (childId, id) {
    if (!STORIES[id]) throw new Error('沒有這個劇情');
    var p = this.getPlayer(childId);
    if (p.story[id]) return false;
    p.story[id] = this.today();
    this._ledger(childId, STORY_STARS, '劇情：' + STORIES[id].name);
    this.save();
    return true;
  };
  /**
   * 任務重置（2026-11-16 家長決定）：重新回到一座島的起點時，如果這座島有做過的任務，先記下「要問孩子」；
   * 畫面詢問「這次要不要把任務重新來一次」。選要：這座島的任務全部重置，再完成一樣給 ⭐STORY_STARS；選不要：維持已完成。
   */
  Store.prototype._offerStoryReset = function (childId) {
    var p = this.getPlayer(childId);
    p.storyAsk = storiesOf(p.island).some(function (id) { return p.story[id]; }) ? p.island : null;
  };
  /** @returns {{ island, name, count }|null} 現在要問孩子的島（count＝做過的任務數） */
  Store.prototype.storyResetOffer = function (childId) {
    var p = this.getPlayer(childId);
    if (!p.storyAsk || p.storyAsk !== p.island) return null;
    var n = storiesOf(p.island).filter(function (id) { return p.story[id]; }).length;
    return n ? { island: p.island, name: this.getBoard(childId).name, count: n } : null;
  };
  /** 孩子的回答：yes＝重置這座島的任務（金島的能源塔也回到沒電）；不管選哪個，這一趟都不再問 */
  Store.prototype.answerStoryReset = function (childId, yes) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId), offer = this.storyResetOffer(childId);
    p.storyAsk = null;
    if (offer && yes) {
      storiesOf(p.island).forEach(function (id) { delete p.story[id]; });
      if (p.island === 'gold') { p.maxReached = p.pos || 0; p.towerIntro = false; }   // 能源塔看「走到過第幾格」，一起歸零才會再沒電
      if (p.island === 'water') p.water = { welcomed: !!p.water.welcomed, rulesSeen: !!p.water.rulesSeen };   // 魚桶、牛奶瓶、沿路對話都重來
      this._logItem(childId, 'story-reset', p.island, 1, offer.name, '任務重新開始');
    }
    this.save();
    return !!(offer && yes);
  };
  // ---------- 金島第 53 格：齒輪小屋「吃飯好行為大挑戰」（2026-11-19 家長企劃；計畫 docs/gold/GEAR_HOUSE_PLAN.md） ----------
  /**
   * 六項吃飯好行為（沿用家庭規則，不另外發明）。畫面文字都在這裡，調整情境只改這張表。
   * cue＝問題行為（小齒的台詞／旁白）、hint＝選錯時的溫和引導、after＝12 秒沒提醒的後果（每題只播一次）、fixed＝改正後小齒說的話
   * ico＝後果疊在畫面上的小圖示（圖到之前也用來暫代問題行為）
   */
  var MEAL_RULES = [   // 2026-11-19 家長：每題只違反一條（其他都做得好），孩子才不會覺得好幾個答案都對
    { id: 'time', label: '30分鐘吃完', icon: '🕒', pose: '🐢', cue: '小齒坐得好好的，也用湯匙看著飯吃，可是一口要吃好久好久……時鐘的長針快走到 30 分了，碗裡還有一大半。', hint: '小齒吃飯的速度怎麼樣？看看時鐘。',
      after: '天色變黃昏了，湯也涼掉了，飯還沒吃完……', ico: '🌇', fixed: '我要專心吃，30 分鐘內吃完！' },
    { id: 'eyes', label: '眼睛看', icon: '👀', pose: '🐦', cue: '小齒一邊用湯匙吃飯，一邊轉頭看窗外的小鳥……', hint: '小齒的眼睛在看哪裡呢？',
      after: '沒看著碗，湯匙舀歪了，飯掉到桌上！', ico: '🍚', fixed: '眼睛看著飯，就不會舀歪了！' },
    { id: 'mouth', label: '嘴巴吃', icon: '👄', pose: '💬', cue: '小齒拿著湯匙、看著飯，可是嘴巴一直講話：「你知道嗎？今天我看到……還有……」', hint: '小齒的嘴巴在做什麼？',
      after: '一邊講話一邊吃，飯粒從嘴巴掉出來，掉到衣服上了！', ico: '😮', fixed: '嘴巴先吃飯，吞下去再說話！' },
    { id: 'tool', label: '用餐具', icon: '🥄', pose: '✋', cue: '小齒坐得好好的、看著飯，可是把湯匙放下，直接用手抓飯……', hint: '小齒用什麼拿飯呢？',
      after: '雙手和桌子都沾滿黏黏的飯粒了！', ico: '🫳', fixed: '用湯匙吃，手和桌子都乾乾淨淨！' },
    { id: 'sit', label: '屁股坐', icon: '🪑', pose: '🚶', cue: '小齒：「我站著吃也可以吧！」他拿著飯站起來，在餐桌旁邊走來走去邊吃……', hint: '小齒現在坐在椅子上嗎？',
      after: '小齒邊走邊吃，被食物嗆到了！', ico: '😣', fixed: '原來邊走邊吃會有危險！我要坐好再吃！', safety: true },
    { id: 'feet', label: '腳放地上', icon: '🦶', pose: '🦵', cue: '小齒用湯匙好好吃飯，可是把雙腳縮到椅子上，椅子搖來搖去……', hint: '小齒的腳放在哪裡呢？',
      after: '椅子晃了一下，碰倒桌上的水杯了！', ico: '🥤', fixed: '腳放地上坐得穩，椅子就不會晃了！' }
  ];
  // 2026-11-20 家長：每局 5 題；「30分鐘吃完」只會在第 5 題（約一半機率）；「屁股坐」每局剛好 1 次（位置隨機）；其他 4 種隨機、可重複但不連續
  var MEAL_GAME = { rounds: 5, waitSec: 12, timeChance: 0.5 };   // 12 秒沒提醒播後果（不顯示倒數）
  /**
   * 抽一局的題目（5 題）。
   * @returns {string[]} 規則代號
   */
  function pickMealRounds(rand) {
    rand = rand || Math.random;
    var n = MEAL_GAME.rounds, out = new Array(n), last = n - 1;
    var free = ['eyes', 'mouth', 'tool', 'feet'];
    if (rand() < MEAL_GAME.timeChance) out[last] = 'time';
    var sitAt = Math.floor(rand() * (out[last] ? last : n));   // 第 5 題已經是「30分鐘吃完」時，屁股坐放在第 1～4 題
    out[sitAt] = 'sit';
    for (var i = 0; i < n; i++) {
      if (out[i]) continue;
      var pool = free.filter(function (id) { return id !== out[i - 1] && id !== out[i + 1]; });   // 不跟前後一題一樣
      out[i] = pool[Math.floor(rand() * pool.length)];
    }
    return out;
  }
  /**
   * 開始一局齒輪小屋（只記「玩過幾局」；獎勵在 finishMealGame）。
   * @returns {string[]} 這局的 5 個規則代號
   */
  Store.prototype.startMealGame = function (childId) {
    var g = this.getPlayer(childId).gearHouse;
    var ids = pickMealRounds(this.random);
    g.plays = (g.plays || 0) + 1;
    this.save();
    return ids;
  };
  /**
   * 完成一局齒輪小屋的獎勵（2026-11-20 家長決定）：
   * - 任務還沒完成：完成任務 ⭐STORY_STARS（重置任務後再完成也一樣給）
   * - 神祕寶箱（免鑰匙）：每個孩子只給一次（第一次完成；舊存檔在更新前就完成的，下一次完成時補給）
   * - 之後再完成（重玩、重置後再完成）：一般寶箱，每天最多 1 個
   * @returns {{ stars: number, gift: boolean, chest: boolean }}
   */
  Store.prototype.finishMealGame = function (childId) {
    var p = this.getPlayer(childId), g = p.gearHouse, today = this.today(), out = { stars: 0, gift: false, chest: false };
    if (!p.story.meal && this.completeStory(childId, 'meal')) out.stars = STORY_STARS;
    if (!g.giftDone) {
      g.giftDone = today; p.bag.giftMysteryChest++; out.gift = true;
      this._logItem(childId, 'grant', 'giftMysteryChest', 1, '齒輪小屋', '第一次陪小齒吃飯');
    } else if (g.chestDate !== today) {
      g.chestDate = today; p.bag.chest++; out.chest = true;
      this._logItem(childId, 'grant', 'chest', 1, '齒輪小屋', '再陪小齒吃飯');
    }
    this.save();
    return out;
  };
  // ---------- 水島（2026-11-16 家長決定的規則；計畫 docs/water/WATER_ISLAND_PLAN.md） ----------
  /** 前方（不含目前這格）第一個還沒完成的水島關卡格號；不是水島或都完成了回傳 -1 */
  Store.prototype.waterGate = function (childId) {
    var p = this.getPlayer(childId);
    if (p.island !== 'water') return -1;
    var best = -1;
    storiesOf('water').forEach(function (id) {
      var t = STORIES[id].tile;
      if (!p.story[id] && t > p.pos && (best < 0 || t < best)) best = t;
    });
    return best;
  };
  /** 停在還沒完成的水島關卡上：回傳劇情代號（要先完成才能前進），否則 null */
  Store.prototype.waterTaskHere = function (childId) {
    var p = this.getPlayer(childId);
    if (p.island !== 'water') return null;
    var id = storiesOf('water').filter(function (k) { return STORIES[k].tile === p.pos && !p.story[k]; })[0];
    return id || null;
  };
  Store.prototype._requireNoWaterTask = function (childId) {
    var id = this.waterTaskHere(childId);
    if (id) throw new Error('先完成「' + STORIES[id].name + '」才能繼續前進喔！');
  };
  /** 水島故事進度（沿路對話、魚桶、牛奶瓶、萊莫進行到第幾階段） */
  Store.prototype.waterState = function (childId) { return this.getPlayer(childId).water; };
  Store.prototype.setWaterFlag = function (childId, key, val) {
    if (['bucket', 'bottle', 'welcomed', 'bossStage', 'rulesSeen', 'folkMet'].indexOf(key) < 0) throw new Error('沒有這個水島紀錄');
    this.getPlayer(childId).water[key] = val;
    this.save();
  };
  /** 沿路短對話（A 類）看過了：同一輪不再播（重置任務後會再播） */
  Store.prototype.markWaterNote = function (childId, id) {
    var w = this.getPlayer(childId).water;
    if (!w.seen || typeof w.seen !== 'object') w.seen = {};
    if (w.seen[id]) return false;
    w.seen[id] = true;
    this.save();
    return true;
  };
  var SHARK_PASS = 11, SHARK_SHIELD_STARS = 10;
  /** 鯊魚把關後：完成關卡、移到第 49 格（不走點數步數） */
  Store.prototype._passShark = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles;
    var first = this.completeStory(childId, 'shark');
    p.pos = STORIES.shark.tile + 1; p.tileId = tiles[p.pos].id;
    if (p.pos > p.maxReached) p.maxReached = p.pos;
    this._found = this._collectAt(childId, [p.pos]);
    return first;
  };
  /** 鯊魚：免費的關卡專用 12 面骰（不進背包、不算每日次數，可以無限重擲），11 或 12 過關，只移到第 49 格 */
  Store.prototype.sharkTry = function (childId) {
    this._requirePlay(childId);
    if (this.waterTaskHere(childId) !== 'shark') throw new Error('現在不在鯊魚關卡');
    var value = rint(this.random, 1, 12), pass = value >= SHARK_PASS, first = false;
    this._logItem(childId, 'shark', 'd12', 1, '鯊魚關卡', '擲出 ' + value);
    if (pass) first = this._passShark(childId);
    this.save();
    return { value: value, pass: pass, first: first, pos: this.getPlayer(childId).pos, found: pass ? this._found : 0 };
  };
  /** 鯊魚：自願用 1 個防護罩過關，移到第 49 格並補 10 顆能量星星 */
  Store.prototype.sharkShield = function (childId) {
    this._requirePlay(childId);
    if (this.waterTaskHere(childId) !== 'shark') throw new Error('現在不在鯊魚關卡');
    var p = this.getPlayer(childId);
    if (!(p.bag.shield > 0)) throw new Error('背包裡沒有防護罩');
    p.bag.shield--;
    this._logItem(childId, 'use', 'shield', 1, '背包', '鯊魚關卡');
    this._ledger(childId, SHARK_SHIELD_STARS, '鯊魚關卡：用防護罩過關補償');
    var first = this._passShark(childId);
    this.save();
    return { pass: true, shield: true, stars: SHARK_SHIELD_STARS, first: first, pos: p.pos, found: this._found };
  };
  /** 撈魚把魚桶裝滿（2026-11-19：漁夫給魚桶時就開始撈，第 34 格沒撈滿再接著撈）：累積最多 storyGoal、存檔；不給能量星星、不算每日小遊戲 */
  Store.prototype.addFeedFish = function (childId, n) {
    this._requirePlay(childId);
    var p0 = this.getPlayer(childId);
    if (p0.island !== 'water' || p0.story.feed) throw new Error('現在不需要撈魚餵小白鯨');
    var w = p0.water;
    w.fishCaught = Math.min(FISH_GAME.storyGoal, (w.fishCaught || 0) + Math.max(0, Math.floor(Number(n) || 0)));
    if (w.fishCaught >= FISH_GAME.storyGoal) w.bucket = true;   // 魚桶裝滿了
    this.save();
    return w.fishCaught;
  };
  /** 鯊魚關卡：沒有防護罩時，花 ⭐5 直接過關（2026-11-18 家長；不像防護罩有 ⭐10 回補） */
  var SHARK_PAY_STARS = 5;
  Store.prototype.sharkPay = function (childId) {
    this._requirePlay(childId);
    if (this.waterTaskHere(childId) !== 'shark') throw new Error('現在不在鯊魚關卡');
    if (this.getStarBalance(childId) < SHARK_PAY_STARS) throw new Error('能量星星不夠 ' + SHARK_PAY_STARS + ' 顆');
    this._ledger(childId, -SHARK_PAY_STARS, '鯊魚關卡：花星星過關');
    var first = this._passShark(childId);
    this.save();
    return { pass: true, paid: true, stars: SHARK_PAY_STARS, first: first, pos: this.getPlayer(childId).pos, found: this._found };
  };
  /** 第 100 格：幫萊莫找到小被被 → 完成關卡（⭐3）並通關（第一次 3 個神祕寶箱，之後 10 星） */
  Store.prototype.finishWaterBoss = function (childId) {
    this._requirePlay(childId);
    if (this.waterTaskHere(childId) !== 'blanket') throw new Error('現在不在萊莫的家');
    var p = this.getPlayer(childId);
    this.completeStory(childId, 'blanket');
    p.water.bossStage = 0;
    var ev = { tile: p.pos, type: 'end', title: '', text: '', stars: 0, items: {}, extraPath: [], backPath: [] };
    this._clearIsland(childId, ev);
    this.save();
    return ev;
  };
  /** 小白鯨今天還能載幾次（水島、已經餵過小白鯨才有） */
  Store.prototype.belugaRidesLeft = function (childId) {
    var p = this.getPlayer(childId);
    if (p.island !== 'water' || !p.story.feed) return 0;
    return this.getItemLimitsToday(childId).beluga;
  };
  /** 小白鯨載著前進：1～6 步由小白鯨決定（和 6 面骰相同機率），不用骰子、不算擲骰次數，每天另外計算 */
  Store.prototype.belugaRide = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    if (p.island !== 'water' || !p.story.feed) throw new Error('要先和小白鯨當朋友喔！');
    this._requireNoWaterTask(childId);
    if (!this.belugaRidesLeft(childId)) throw new Error('小白鯨今天游累了，明天再載你！');
    var end = this.getBoard(childId).tiles.length - 1, needLap = p.pos >= end;
    this._markDayStart(childId);
    var travel = needLap ? this._startNext(childId) : null;
    var from = p.pos, value = rint(this.random, 1, 6);
    this._found = 0;
    var path = this._advance(childId, value);
    this._logItem(childId, 'use', 'beluga', 1, '小白鯨', '第 ' + from + ' → ' + p.pos + ' 格');
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'beluga', value: value, from: from, path: path, event: event, found: this._found, lap: needLap, travel: travel, ridesLeft: this.belugaRidesLeft(childId) };
  };
  /** 潛水艇（寶物）：只能在水島、已經下潛（第 25 格以後）時用，開到第 25～99 格；不能跳過還沒完成的關卡；每天次數依家長設定 */
  var SUB_FROM = 25;
  Store.prototype.useSubmarine = function (childId, n) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    if (p.island !== 'water') throw new Error('潛水艇只能在水島使用');
    this._requireNoWaterTask(childId);
    var tiles = this.getBoard(childId).tiles, end = tiles.length - 1;
    if (p.pos < SUB_FROM) throw new Error('要先潛到海裡（第 ' + SUB_FROM + ' 格以後）才能開潛水艇');
    n = Math.floor(Number(n));
    if (!(n >= SUB_FROM && n < end)) throw new Error('潛水艇只能開到第 ' + SUB_FROM + '～' + (end - 1) + ' 格');
    if (n === p.pos) throw new Error('你已經在這一格了');
    if (!(p.bag.submarine > 0)) throw new Error('背包裡沒有潛水艇');
    if (!this.getItemLimitsToday(childId).sub) throw new Error('潛水艇每天只能用 ' + this.getLimits(childId).sub + ' 次，明天再用！');
    var gate = this.waterGate(childId);
    if (gate > 0 && n > gate) throw new Error('第 ' + gate + ' 格的關卡還沒完成，潛水艇最遠只能到第 ' + gate + ' 格');
    this._markDayStart(childId);
    var from = p.pos;
    p.bag.submarine--;
    p.pos = n; p.tileId = tiles[n].id;
    if (n > p.maxReached) p.maxReached = n;
    this._logItem(childId, 'use', 'submarine', 1, '背包', '第 ' + from + ' → ' + n + ' 格');
    this._found = this._collectAt(childId, [n]);
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'submarine', value: 0, from: from, path: [n], event: event, found: this._found };
  };
  /** 能源主塔：技師已經主動求助過（只出現一次） */
  Store.prototype.markTowerIntro = function (childId) {
    var p = this.getPlayer(childId);
    if (p.towerIntro) return;
    p.towerIntro = true;
    this.save();
  };
  /** 好運金牌：啟用後，下一次停在寶箱格或機會格時效果發生 2 次 */
  Store.prototype.activateMedal = function (childId) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var p = this.getPlayer(childId);
    if (p.medalArmed) throw new Error('好運金牌已經啟用了');
    if (!(p.bag.luckyMedal > 0)) throw new Error('背包裡沒有好運金牌');
    p.bag.luckyMedal--;
    p.medalArmed = true;
    this._logItem(childId, 'use', 'luckyMedal', 1, '背包', '已啟用');
    this.save();
  };
  /** 再來 3 次：今天額外 +3 次擲骰、+3 次小遊戲（今天沒用完就失效，不跨日、不轉神祕寶箱） */
  Store.prototype.activateBonusPlay = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (!(p.bag.bonusPlay > 0)) throw new Error('背包裡沒有「再來 3 次」');
    p.bag.bonusPlay--;
    this.data.adventure.bonusQuota.push({ id: uid(), childId: childId, date: this.today(), rolls: 3, games: 3, ts: this.now().getTime() });
    this._logItem(childId, 'use', 'bonusPlay', 1, '背包', '今天 +3 擲骰、+3 小遊戲');
    this.save();
    return this.getBonusQuota(childId);
  };

  var api = { CARD_TEXT: CARD_TEXT, LEAF_GAME: LEAF_GAME, LEAF_MAX_FOUND: LEAF_MAX_FOUND, leafStars: leafStars, minigameOf: minigameOf, STORIES: STORIES, storiesOf: storiesOf, LAVA_STARS: LAVA_STARS, LAVA_ACH: LAVA_ACH, MEAL_RULES: MEAL_RULES, MEAL_GAME: MEAL_GAME, pickMealRounds: pickMealRounds, STORY_STARS: STORY_STARS, ISLAND_ORDER: ISLAND_ORDER, registerBoard: registerBoard, buildWood: buildWood, WOOD_OPEN: WOOD_OPEN, buildWater: buildWater, WATER_OPEN: WATER_OPEN, WATER_TRIAL: waterTrial, waterOn: waterOn, WATER_TYPES: WATER_TYPES, SHARK_PASS: SHARK_PASS, SHARK_SHIELD_STARS: SHARK_SHIELD_STARS, SHARK_PAY_STARS: SHARK_PAY_STARS, FISH_GAME: FISH_GAME, fishStars: fishStars, nextIsland: nextIsland, ACHIEVEMENTS: ACHIEVEMENTS, GOLD_CLEAR_STARS: GOLD_CLEAR_STARS, buildGold: buildGold, WORLD: WORLD, OPEN_REGIONS: OPEN_REGIONS, REGION02_TILES: REGION02.tiles, REGION03_TILES: REGION03.tiles, REGION04_TILES: REGION04.tiles, MAGNET_RANGE: MAGNET_RANGE, MOVE_DAILY_LIMIT: MOVE_DAILY_LIMIT, DOOR_DAILY_LIMIT: DOOR_DAILY_LIMIT, OVERFLOW_CHEST_DAILY: OVERFLOW_CHEST_DAILY, MILESTONE_KEY: MILESTONE_KEY, MILESTONE_CHEST: MILESTONE_CHEST, BLESSINGS: BLESSINGS, BLESSING_MAX_QTY: BLESSING_MAX_QTY, LUCKY_STAR: LUCKY_STAR, MYSTERY_POOL: MYSTERY_POOL, TREASURES: TREASURES, TREASURE_WEEKLY_LIMIT: TREASURE_WEEKLY_LIMIT, TREASURE_HOLD_LIMIT: TREASURE_HOLD_LIMIT, MINIGAME_MAX_STARS: MINIGAME_MAX_STARS, MINIGAME_RATE: MINIGAME_RATE, minigameStars: minigameStars, MINIGAME_SECONDS: MINIGAME_SECONDS, DAILY_MINIGAME_LIMIT: DAILY_MINIGAME_LIMIT, REGIONS: REGIONS, SHOP: SHOP, FATE_CARDS: FATE_CARDS, CHARACTERS: CHARACTERS, DEFAULT_CHARACTER: DEFAULT_CHARACTER, BOARDS: BOARDS, DAILY_DICE_LIMIT: DAILY_DICE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGame = api;
})(typeof self !== 'undefined' ? self : this);
