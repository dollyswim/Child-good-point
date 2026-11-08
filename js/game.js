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
  var MINIGAME_MAX_STARS = 15;
  /** 2026-11-08 家長調整：抓到的星星每 3 顆換 1 顆能量星星（無條件進位），最多 MINIGAME_MAX_STARS 顆 */
  var MINIGAME_RATE = 3;
  function minigameStars(caught) { var c = Math.max(0, Math.floor(Number(caught) || 0)); return Math.min(MINIGAME_MAX_STARS, Math.ceil(c / MINIGAME_RATE)); }
  var MINIGAME_SECONDS = 10;

  /** 道具圖示：家長提供的白底插圖（images/items/，256×256 WebP，原圖 1024×1024 PNG），介面以白色圖示框＋contain 顯示 */
  /**
   * 冒險寶物商店（生活點數兌換）：每個孩子每週最多 3 件、同款最多持有 2 件（只限寶物商店購買）
   * 效果於後續階段接入；購買後放進背包。
   */
  var TREASURE_WEEKLY_LIMIT = 3, TREASURE_HOLD_LIMIT = 2;
  var TREASURES = [
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 10, desc: '向前移動 3 格（和飛行翼合計每天最多 5 次）' },
    { id: 'shield', name: '防護罩', icon: '🛡️', img: 'images/items/shield.webp', price: 10, desc: '自動擋住一次命運卡的「往回退」或「路障」（擋住路障還能前進 1 格）' },
    { id: 'magicDice', name: '神奇骰子', icon: '🎲', img: 'images/items/magic_dice.webp', price: 10, desc: '額外擲一次 12 面骰（不占每日 3 次，每天最多用 1 顆）' },
    { id: 'luckyMedal', name: '好運金牌', icon: '🥇', img: 'images/items/lucky_medal.webp', price: 100, desc: '下一次停在寶箱或機會格，效果發生 2 次' },
    { id: 'wings', name: '飛行翼', icon: '🪽', img: 'images/items/flying_wings.webp', price: 100, desc: '向前飛行 20 格（和溜冰鞋合計每天最多 5 次）' },
    { id: 'starCall', name: '星星呼喚', icon: '🌠', img: 'images/minigame/star.webp', price: 50, desc: '馬上玩一局「抓住星星」（不占每天 1 次，每天最多用 1 個）' },   // 2026-11-08 新增
    { id: 'door', name: '任意門', icon: '🚪', img: 'images/items/magic_door.webp', price: 200, desc: '傳送到本島指定的格子（每天最多 1 次）' }
  ];

  var SHOP = [
    { id: 'd6', name: '6 面骰', icon: '🎲', img: 'images/items/dice_6.webp', price: 5, desc: '擲出 1～6 步' },
    { id: 'd12', name: '12 面骰', icon: '🎲', img: 'images/items/dice_12.webp', price: 10, desc: '擲出 1～12 步' },
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 4, desc: '直接前進 3 格（不算擲骰次數；和飛行翼合計每天最多 5 次）' },
    { id: 'goldenKey', name: '黃金鑰匙', icon: '🔑', img: 'images/items/golden_key.webp', price: 10, desc: '打開地圖上撿到的神秘寶箱' },
    { id: 'magnet', name: '寶物磁鐵', icon: '🧲', img: 'images/items/treasure_magnet.webp', price: 10, desc: '吸取前後 5 格內的寶箱' }
  ];

  /** 8 種原創冒險夥伴（家長提供的原創設計），圖檔在 images/characters/<id>.webp */
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
  function pickWeighted(rand, list) {
    var total = list.reduce(function (s, x) { return s + x.weight; }, 0);
    var r = rand() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i].weight; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  var REGIONS = [
    { id: 'gold-01', name: '黃金沙灘與初級礦場', from: 1, to: 30, stripY: 4050,
      background: { webp: 'images/gold/region01.webp', jpg: 'images/gold/region01.jpg' }, size: REGION01.referenceSize },
    { id: 'gold-02', name: '水晶礦谷', from: 31, to: 55, stripY: 2700, data: REGION02,
      background: { webp: 'images/gold/region02.webp', jpg: 'images/gold/region02.jpg' }, size: { width: 1080, height: 1350 } },
    { id: 'gold-03', name: '齒輪工坊', from: 56, to: 80, stripY: 1350, data: REGION03,
      background: { webp: 'images/gold/region03.webp', jpg: 'images/gold/region03.jpg' }, size: { width: 1080, height: 1350 } },
    { id: 'gold-04', name: '金冠城堡', from: 81, to: 100, stripY: 0, data: REGION04,
      background: { webp: 'images/gold/region04.webp', jpg: 'images/gold/region04.jpg' }, size: { width: 1080, height: 1350 } }
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
    if (this.getStarBalance(childId) < item.price) throw new Error('能量星星不夠');
    this._ledger(childId, -item.price, '購買' + item.name);
    this.getPlayer(childId).bag[item.id]++;
    this.save();
    return item;
  };

  // ---------- 寶箱內容（地圖寶箱格與背包寶箱共用同一套） ----------
  /** 一般寶箱：55% 得 1～3 星、25% 溜冰鞋、20% 6 面骰 */
  Store.prototype._rollRegularChest = function (childId, reason) {
    var rand = this.random, p = this.getPlayer(childId), out = { stars: 0, items: {}, text: '' };
    p.stats.chests++;
    var roll = rand();
    if (roll < 0.55) {
      out.stars = rint(rand, 1, 3);
      this._ledger(childId, out.stars, reason);
      out.text = '得到 ⭐' + out.stars + ' 能量星星';
    } else if (roll < 0.8) {
      p.bag.skates++; out.items.skates = 1; out.text = '得到一雙 🛼 溜冰鞋';
    } else {
      p.bag.d6++; out.items.d6 = 1; out.text = '得到一顆 🎲 6 面骰';
    }
    Object.keys(out.items).forEach(function (k) { this._logItem(childId, 'grant', k, out.items[k], reason, out.text); }, this);
    return out;
  };
  /** 神秘寶箱獎勵池：7 種特殊道具（呼叫專機為稀有獎勵） */
  var MYSTERY_POOL = [
    { id: 'skates', name: '溜冰鞋', icon: '🛼', weight: 18 }, { id: 'magicDice', name: '神奇骰子', icon: '🎲', weight: 18 },
    { id: 'luckyMedal', name: '好運金牌', icon: '🥇', weight: 18 }, { id: 'shield', name: '防護罩', icon: '🛡️', weight: 18 },
    { id: 'wings', name: '飛行翼', icon: '🪽', weight: 12 }, { id: 'door', name: '任意門', icon: '🚪', weight: 12 },
    { id: 'airplane', name: '呼叫專機', icon: '✈️', weight: 4 }
  ];
  Store.prototype._rollMysteryChest = function (childId) {
    this.getPlayer(childId).stats.mystery++;
    var item = pickWeighted(this.random, MYSTERY_POOL);
    this.getPlayer(childId).bag[item.id]++;
    var items = {}; items[item.id] = 1;
    return { stars: 0, items: items, item: item.id, text: '得到 ' + item.icon + ' ' + item.name + '！' };
  };
  Store.prototype._logItem = function (childId, action, item, qty, source, result) {
    this.data.adventure.itemLog.push({ id: uid(), childId: childId, action: action, item: item, qty: qty || 1, source: source || '',
      result: result || '', date: this.today(), ts: this.now().getTime() });
  };
  /**
   * 開背包裡的寶箱：kind = 'chest'（一般寶箱）或 'giftMysteryChest'（神諭祝福的神秘寶箱，免鑰匙）
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
      this._logItem(childId, 'use', 'goldenKey', 1, '背包', '打開神秘寶箱');
    }
    p.bag[kind]--;
    var res = kind === 'chest' ? this._rollRegularChest(childId, '一般寶箱') : this._rollMysteryChest(childId);
    res.kind = kind;
    this._logItem(childId, 'open', kind, 1, '背包', res.text);
    this.save();
    return res;
  };

  // ---------- 地圖上的神秘寶箱 ----------
  var OVERFLOW_CHEST_DAILY = 2, MILESTONE_KEY = 500, MILESTONE_CHEST = 1000, MAGNET_RANGE = 5;
  /** 新增一個還沒出現的神秘寶箱；source：overflow（次數用完轉換，每天最多 2 個）、milestone、island */
  Store.prototype._addMapChest = function (childId, source) {
    var today = this.today();
    if (source === 'overflow' && this.data.adventure.mapChests.filter(function (x) {
      return x.childId === childId && x.source === 'overflow' && x.createdDate === today;
    }).length >= OVERFLOW_CHEST_DAILY) return null;
    var c = { id: uid(), childId: childId, island: this.getPlayer(childId).island, source: source, createdDate: today, tileId: '', n: 0, hinted: false, ts: this.now().getTime() };
    this.data.adventure.mapChests.push(c);
    this._logItem(childId, 'grant', 'mapChest', 1, source === 'overflow' ? '次數用完轉換' : source === 'milestone' ? '點數里程碑' : '新島嶼', '下次冒險時出現在地圖上');
    return c;
  };
  /**
   * 讓等待中的神秘寶箱出現在角色前方 2～8 格（最遠第 29 格）。
   * 次數用完轉換的寶箱要等到之後的日子才出現；里程碑的下次進入地圖就出現。
   * @returns 這次新出現的寶箱數
   */
  Store.prototype.placeMapChests = function (childId) {
    var p = this.getPlayer(childId), today = this.today(), self = this;
    var tiles = this.getBoard(childId).tiles, last = tiles.length - 2;
    var placed = 0;
    this.data.adventure.mapChests.forEach(function (c) {
      if (c.childId !== childId || c.tileId || c.island !== p.island) return;
      if (c.source === 'overflow' && !(today > c.createdDate)) return;
      if (p.pos + 2 > last) return;                          // 前方沒有位置：等下一區開放
      var n = Math.min(last, p.pos + rint(self.random, 2, 8));
      c.n = n; c.tileId = tiles[n].id; c.hinted = false;
      placed++;
    });
    if (placed) this.save();
    return placed;
  };
  /** 地圖上已出現、還沒撿的神秘寶箱 */
  Store.prototype.getMapChests = function (childId) {
    var p = this.getPlayer(childId);
    return this.data.adventure.mapChests.filter(function (c) { return c.childId === childId && c.tileId && c.island === p.island; });
  };
  /** 進入地圖時的提示「附近似乎藏著神秘寶物……」只顯示一次 */
  Store.prototype.takeChestHint = function (childId) {
    var list = this.getMapChests(childId).filter(function (c) { return !c.hinted; });
    list.forEach(function (c) { c.hinted = true; });
    if (list.length) this.save();
    return list.length;
  };
  /** 經過或停在有神秘寶箱的格子：撿起來放進背包（未開啟，要鑰匙） */
  Store.prototype._collectAt = function (childId, positions) {
    var p = this.getPlayer(childId), got = 0, self = this;
    this.data.adventure.mapChests = this.data.adventure.mapChests.filter(function (c) {
      if (c.childId === childId && c.tileId && c.island === p.island && positions.indexOf(c.n) >= 0) {
        p.bag.mysteryChest++; got++;
        self._logItem(childId, 'grant', 'mysteryChest', 1, '地圖第 ' + c.n + ' 格', '撿到神秘寶箱');
        return false;
      }
      return true;
    });
    return got;
  };

  // ---------- 寶物磁鐵 ----------
  /** 前後 5 格內可以吸的寶物：地圖上的神秘寶箱、還沒被吸走的一般寶箱格 */
  Store.prototype.getMagnetTargets = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles, out = [];
    this.getMapChests(childId).forEach(function (c) {
      if (Math.abs(c.n - p.pos) <= MAGNET_RANGE) out.push({ type: 'mystery', id: c.id, n: c.n, name: '神秘寶箱' });
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
      res.text = '吸到第 ' + target.n + ' 格的 🎁 神秘寶箱！（用黃金鑰匙打開）';
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

  // ---------- 累計得分里程碑：每 +500 黃金鑰匙、每 +1000 神秘寶箱（不補發、不重複） ----------
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
    while (ms.keys < Math.floor(gain / MILESTONE_KEY)) {
      ms.keys++; out.keys++; p.bag.goldenKey++;
      this._logItem(childId, 'grant', 'goldenKey', 1, '點數里程碑', '累計得分 +' + (ms.keys * MILESTONE_KEY));
    }
    while (ms.chests < Math.floor(gain / MILESTONE_CHEST)) {
      ms.chests++; out.chests++;
      this._addMapChest(childId, 'milestone');
    }
    return out;
  };

  // ---------- 神諭祝福（媽媽加碼） ----------
  var BLESSINGS = [
    { id: 'chest', name: '一般寶箱', icon: '📦', img: 'images/tiles/chest.webp', desc: '加入寶箱庫存，打開可得星星或道具' },
    { id: 'mysteryChest', name: '神秘寶箱', icon: '🎁', img: 'images/items/mystery_chest.webp', desc: '加入寶箱庫存，不用鑰匙，打開可得特殊道具' },
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
    if ((this.getPlayer(childId).bag[itemId] || 0) >= TREASURE_HOLD_LIMIT) return { ok: false, reason: '已持有 ' + TREASURE_HOLD_LIMIT + ' 件' };
    var lack = item.price - this.getTotal(childId);
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
    return this._addRecord(childId, 'reward', 'treasure:' + itemId, '寶物：' + item.name, -item.price); // _addRecord 會一併存檔
  };

  // ---------- 移動與事件 ----------
  /** 從目前位置前進 steps 格（不超過終點），回傳經過的格子編號 */
  Store.prototype._advance = function (childId, steps) {
    var p = this.getPlayer(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    var path = [];
    // 抵達目前開放區域的最後一格（第 30 格木門）即停止，多餘步數捨棄
    for (var i = 0; i < steps && p.pos < end; i++) { p.pos++; path.push(p.pos); }
    p.tileId = this.getBoard(childId).tiles[p.pos].id;
    if (p.pos > p.maxReached) p.maxReached = p.pos;
    this._found = (this._found || 0) + this._collectAt(childId, path);   // 經過或停在神秘寶箱的格子就撿起來
    return path;
  };

  /** 停格事件；depth 防止機會卡連鎖無限前進 */
  Store.prototype._resolveTile = function (childId, depth) {
    var p = this.getPlayer(childId);
    var tile = this.getBoard(childId).tiles[p.pos];
    var rand = this.random;
    var ev = { tile: tile.n, type: tile.type, title: '', text: '', stars: 0, items: {}, extraPath: [], backPath: [] };
    // 好運金牌：下一次停在寶箱或機會格，效果發生 2 次
    var looted = tile.type === 'chest' && p.looted.indexOf(tile.id) >= 0;
    var medal = !!(p.medalArmed && ((tile.type === 'chest' && !looted) || tile.type === 'chance'));
    if (medal) { p.medalArmed = false; ev.medal = true; }
    if (looted) {
      ev.title = '🎁 寶箱'; ev.text = '這個寶箱已經被寶物磁鐵吸走了，裡面空空的。';
    } else if (tile.type === 'chest') {
      ev.title = (medal ? '🥇 好運金牌！' : '') + '🎁 寶箱！';
      var texts = [];
      for (var ci = 0; ci < (medal ? 2 : 1); ci++) {
        var cr = this._rollRegularChest(childId, '寶箱');
        ev.stars += cr.stars; texts.push(cr.text);
        Object.keys(cr.items).forEach(function (k) { ev.items[k] = (ev.items[k] || 0) + cr.items[k]; });
      }
      ev.text = texts.join('\n');
    } else if (tile.type === 'chance') {
      ev.title = (medal ? '🥇 好運金牌！' : '') + '❓ 機會';
      var lines = [], cart = false;
      for (var k = 0; k < (medal ? 2 : 1); k++) {
        // 機會卡（全部正向）：0 礦車前進 2 格、1 發光礦石 +2 星、2 撿到 6 面骰、3 小寶箱 +1～3 星、4 撿到溜冰鞋
        var c = rint(rand, 0, 4);
        if (c === 0 && depth < 1) {
          lines.push('礦車載你額外前進 2 格！');
          ev.extraPath = ev.extraPath.concat(this._advance(childId, 2));
          cart = true;
        } else if (c === 1 || (c === 0 && depth >= 1)) {
          ev.stars += 2; this._ledger(childId, 2, '機會：發現礦石'); lines.push('發現發光礦石，得到 ⭐2');
        } else if (c === 2) {
          p.bag.d6++; ev.items.d6 = (ev.items.d6 || 0) + 1; lines.push('撿到一顆 🎲 6 面骰');
          this._logItem(childId, 'grant', 'd6', 1, '機會卡', '撿到 6 面骰');
        } else if (c === 3) {
          var sm = rint(rand, 1, 3);
          ev.stars += sm; this._ledger(childId, sm, '機會：小寶箱'); lines.push('找到一個小寶箱，得到 ⭐' + sm);
        } else {
          p.bag.skates++; ev.items.skates = (ev.items.skates || 0) + 1; lines.push('撿到一雙 🛼 溜冰鞋');
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
        ev.text = '一陣大風吹來，🛡️ 防護罩擋住了！沒有後退。';
        this._logItem(childId, 'use', 'shield', 1, '背包', '擋住命運卡後退');
      } else if (card.id === 'back') {
        var n = rint(rand, 1, 2);
        // 後退：不退到起點之前；落點不觸發事件
        for (var b = 0; b < n && p.pos > 0; b++) { p.pos--; ev.backPath.push(p.pos); }
        p.tileId = this.getBoard(childId).tiles[p.pos].id;
        this._found = (this._found || 0) + this._collectAt(childId, ev.backPath);
        ev.text = '一陣大風吹來，往回退了 ' + ev.backPath.length + ' 格！';
      } else if (card.id === 'roadblock' && p.bag.shield > 0 && p.pos < this.getBoard(childId).tiles.length - 1) {
        // 防護罩推開路障：前進 1 格（落點不觸發事件，和往回退一樣）
        var rb = ROADBLOCKS[Math.floor(rand() * ROADBLOCKS.length)];
        p.bag.shield--;
        ev.shielded = true;
        p.pos++; p.tileId = this.getBoard(childId).tiles[p.pos].id;
        if (p.pos > p.maxReached) p.maxReached = p.pos;
        ev.extraPath.push(p.pos);
        this._found = (this._found || 0) + this._collectAt(childId, ev.extraPath);
        ev.text = '🛡️ 防護罩推開了路障，往前走 1 格！\n（路障：' + rb + '）';
        this._logItem(childId, 'use', 'shield', 1, '背包', '推開路障前進 1 格');
      } else if (card.id === 'roadblock') {
        ev.text = '路障：' + ROADBLOCKS[Math.floor(rand() * ROADBLOCKS.length)] + '（這次沒有影響，下次繼續前進）';
      } else {
        var sp = this.addSpecialTask(childId, card.id);
        ev.special = { id: sp.task.id, kind: card.id, name: sp.task.name, duplicate: sp.duplicate };
        ev.text = sp.duplicate
          ? '特殊任務「' + sp.task.name + '」還在進行中喔！先把它完成吧。'
          : '得到特殊任務：「' + sp.task.name + '」\n已加到任務頁，3 天內完成可得 +' + sp.task.points + ' 點！';
      }
    } else if (tile.type === 'minigame') {
      ev.title = '🎮 小遊戲：抓住星星';
      var mg = this.getMinigameToday(childId);
      if (!mg) {
        mg = { id: uid(), childId: childId, date: this.today(), tile: tile.n, status: 'pending', caught: 0, stars: 0, ts: this.now().getTime() };
        this.data.adventure.minigames.push(mg);
        ev.minigame = { id: mg.id };
        ev.text = '點星星收集能量星星！第 1 顆在正中央，點到後開始 ' + MINIGAME_SECONDS + ' 秒計時。';
      } else if (mg.status === 'pending') {
        ev.minigame = { id: mg.id };
        ev.text = '今天的小遊戲還沒玩完，現在開始吧！';
      } else if (this._useBonus(childId, 'games')) {
        // 再來 3 次：額外的小遊戲（不轉神秘寶箱）
        mg = { id: uid(), childId: childId, date: this.today(), tile: tile.n, status: 'pending', bonus: true, caught: 0, stars: 0, ts: this.now().getTime() };
        this.data.adventure.minigames.push(mg);
        ev.minigame = { id: mg.id, bonus: true };
        ev.text = '🎮 再來 3 次：額外的小遊戲！點星星收集能量星星。';
      } else {
        // 今天已玩過：每天最多 1 次 → 這次機會轉成神秘寶箱（下次冒險時出現在前方；每天最多 2 個）
        ev.minigameOverflow = true;
        if (this._addMapChest(childId, 'overflow')) {
          ev.overflowChest = true;
          ev.text = '今天已經玩過小遊戲了（每天 1 次）。\n這次的機會變成了一個 🎁 神秘寶箱，下次冒險時會出現在你前方！';
        } else ev.text = '今天已經玩過小遊戲了（每天 1 次），明天再來挑戰！';
      }
    } else if (tile.type === 'boundary') {
      var ri = REGIONS.findIndex(function (r) { return r.id === tile.regionId; });
      var lastR = REGIONS[ri], nextR = REGIONS[ri + 1];
      ev.title = '🚪 抵達' + lastR.name + '的終點！';
      ev.text = '你走完金島第 1～' + lastR.to + ' 格了！' + (nextR ? '前方的「' + nextR.name + '」即將開放。' : '') + '\n下次出發會從起點開始新的一輪，寶箱也會重新放滿！';
    } else if (tile.type === 'end') {
      // 島嶼通關：第一次＝神秘寶箱 ×1（免鑰匙）（金島另得「金島通關」成就）；之後＝ +10 能量星星；
      // 下一次移動前往下一座已開放的島（沒有就從起點開始新的一輪）
      var bd = this.getBoard(childId), isGold = p.island === 'gold';
      var count = isGold ? ++p.goldClears : (p.islandClears[p.island] = (p.islandClears[p.island] || 0) + 1);
      var first = count === 1, nx = nextIsland(p.island);
      ev.title = '🏁 恭喜通關' + bd.name + '！';
      ev.clear = { count: count, first: first, island: p.island, name: bd.name, goal: bd.goalName || '', next: nx ? BOARDS[nx].name : '' };
      if (first) {
        p.bag.giftMysteryChest++; ev.items.giftMysteryChest = 1;
        this._logItem(childId, 'grant', 'giftMysteryChest', 1, bd.name + '通關', '第一次通關');
        ev.text = '你走完' + bd.name + ' ' + (bd.tiles.length - 1) + ' 格' + (bd.goalName ? '，抵達' + bd.goalName : '') + '了！\n通關獎勵：🎁 神秘寶箱 ×1（不用鑰匙）' + (isGold ? '＋ 🏅 成就「金島通關」' : '');
      } else {
        ev.stars = GOLD_CLEAR_STARS; this._ledger(childId, GOLD_CLEAR_STARS, bd.name + '通關（第 ' + count + ' 次）');
        ev.text = '第 ' + count + ' 次通關' + bd.name + '！通關獎勵：⭐' + GOLD_CLEAR_STARS + ' 能量星星';
      }
      ev.text += nx ? '\n下次出發會前往「' + BOARDS[nx].name + '」！' : '\n下次出發會從起點開始新的一輪。';
    }
    return ev;
  };

  // ---------- 結束今日冒險與今日小結 ----------
  /** 每天第一次移動前記下起點（今日小結用） */
  Store.prototype._markDayStart = function (childId) {
    var p = this.getPlayer(childId), today = this.today();
    if (!p.dayStart || p.dayStart.date !== today) p.dayStart = { date: today, pos: p.pos };
  };
  /** 今日小結：走了幾格、擲骰次數、能量星星、道具、小遊戲、特殊任務、神秘寶箱提示 */
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
    { id: 'reachR4', cat: 'adventure', icon: '👑', name: '抵達金冠城堡', desc: '走到第 81 格以後', check: function (s, c) { return goldMax(s.getPlayer(c)) >= 81; } },
    { id: 'chest1', cat: 'collect', icon: '🧰', name: '第一個寶箱', desc: '開過第一個一般寶箱', check: function (s, c) { return s.getPlayer(c).stats.chests >= 1; } },
    { id: 'chests10', cat: 'collect', icon: '📦', name: '寶箱獵人', desc: '開過 10 個一般寶箱', check: function (s, c) { return s.getPlayer(c).stats.chests >= 10; } },
    { id: 'mystery1', cat: 'collect', icon: '🎁', name: '一個大秘寶', desc: '打開第一個神秘寶箱', check: function (s, c) { return s.getPlayer(c).stats.mystery >= 1; } },
    { id: 'catch5', cat: 'collect', icon: '⭐', name: '星星捕手', desc: '「抓住星星」單局抓到 5 顆以上', check: function (s, c) { return bestCatch(s, c) >= 5; } },
    { id: 'catch10', cat: 'collect', icon: '🌟', name: '星海傳說', desc: '「抓住星星」單局抓到 20 顆以上', check: function (s, c) { return bestCatch(s, c) >= 20; } }   // 2026-11-08 由 10 顆改為 20 顆（代號沿用 catch10，保留既有紀錄）
  ].concat([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000].map(function (n) {
    return { id: 'earn' + n, cat: 'life', icon: '🥇', name: '獲得 ' + n + ' 分', desc: '起始點數＋累計得分達到 ' + n, revocable: true, check: function (s, c) { return s.getEarned(c) >= n; } };
  })).concat([
    { id: 'special1', cat: 'life', icon: '🔮', name: '第一個特殊任務', desc: '完成 1 個特殊任務', revocable: true, check: function (s, c) { return specialDone(s, c) >= 1; } },
    { id: 'special5', cat: 'life', icon: '💠', name: '特殊任務達人', desc: '完成 5 個特殊任務', revocable: true, check: function (s, c) { return specialDone(s, c) >= 5; } },
    { id: 'streak7', cat: 'life', icon: '📅', name: '連續 7 天冒險', desc: '連續 7 天出發冒險', check: function (s, c) {
      return longestStreak(s.data.adventure.settlements.filter(function (x) { return x.childId === c; }).map(function (x) { return x.date; })) >= 7; } }
  ]);
  /** 「抓住星星」單局最多抓到幾顆 */
  function bestCatch(s, c) {
    return s.data.adventure.minigames.reduce(function (m, g) { return g.childId === c && g.status === 'done' && g.caught > m ? g.caught : m; }, ((s.data.carry || {})[c] || {}).bestCatch || 0);   // 含封存結轉
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
    return lost;
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
      return ACHIEVEMENTS.filter(function (a) { return a.revocable && mine[a.id] && !a.check(self, rec.childId); });
    } finally { this.data.records = orig; }
  };
  Store.prototype.checkAchievements = function (childId) {
    if (!this.getChild(childId)) return [];
    this.revokeAchievements(childId);   // 先收回條件不成立的（例如家長在別處修改了紀錄）
    var self = this, mine = this.data.achievements[childId] || (this.data.achievements[childId] = {});
    var fresh = ACHIEVEMENTS.filter(function (a) { return !mine[a.id] && a.check(self, childId); });
    fresh.forEach(function (a) { mine[a.id] = { date: self.today(), ts: self.now().getTime() }; });
    if (fresh.length) this.save();
    return fresh;
  };
  /** 成就列表（含是否達成、達成日期） */
  Store.prototype.getAchievements = function (childId) {
    var mine = this.data.achievements[childId] || {};
    return ACHIEVEMENTS.map(function (a) { return { id: a.id, cat: a.cat, icon: a.icon, name: a.name, desc: a.desc, done: !!mine[a.id], date: mine[a.id] ? mine[a.id].date : '', ts: mine[a.id] ? mine[a.id].ts || 0 : 0 }; });
  };

  // ---------- 小遊戲「抓住星星」 ----------
  /** 今天的小遊戲紀錄（pending＝已停在小遊戲格但還沒玩完；done＝已領取） */
  Store.prototype.getMinigameToday = function (childId) {
    var today = this.today();
    return this.data.adventure.minigames.find(function (m) { return m.childId === childId && m.date === today && !m.bonus && !m.limitReset; }) || null;
  };
  /**
   * 家長重置今天的次數上限（需家長密碼）：骰子 3 次、小遊戲 1 次、前進道具 5 次、任意門 1 次、神奇骰子 1 顆、星星呼喚 1 個都重新計算。
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
  Store.prototype.finishMinigame = function (childId, caught) {
    this._requirePlay(childId);
    var m = this.getPendingMinigame(childId);
    if (!m) throw new Error('今天沒有可以玩的小遊戲');
    var got = Math.max(0, Math.floor(Number(caught) || 0));
    var n = minigameStars(got);
    m.status = 'done'; m.caught = got; m.stars = n; m.doneTs = this.now().getTime();
    if (n > 0) this._ledger(childId, n, '小遊戲：抓住星星');
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
    return Math.max(0, DAILY_DICE_LIMIT - this.getRollsToday(childId)) + this.getBonusQuota(childId).rolls;
  };
  /** 今天是否已用過神奇骰子（每天最多 1 顆） */
  Store.prototype.magicUsedToday = function (childId) {
    var today = this.today();
    return this.data.adventure.rolls.some(function (r) { return r.childId === childId && r.date === today && r.kind === 'magic' && !r.limitReset; });
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
    var end = this.getBoard(childId).tiles.length - 1;
    var needLap = p.pos >= end;   // 第二區開放前：在木門時這次從起點開始下一輪（檢查都通過才執行）
    var kind = 'base';
    if (die === 'magic') {
      if (!(p.bag.magicDice > 0)) throw new Error('背包裡沒有神奇骰子');
      if (this.magicUsedToday(childId)) throw new Error('神奇骰子每天最多用 1 顆，明天再來！');
      kind = 'magic';
    } else {
      if (this.getRollsToday(childId) >= DAILY_DICE_LIMIT) {
        if (this.getBonusQuota(childId).rolls > 0) kind = 'bonus';
        else throw new Error('今天已經擲了 ' + DAILY_DICE_LIMIT + ' 次骰子，明天再來！');
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
   * 一般寶箱格重新放滿（磁鐵吸過的也恢復），神秘寶箱與背包不變。
   */
  Store.prototype._newLap = function (childId) {
    var p = this.getPlayer(childId), tiles = this.getBoard(childId).tiles;
    p.pos = 0; p.tileId = tiles[0].id; p.looted = [];
    p.laps = (p.laps || 0) + 1;
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
    return { island: to, name: nb.name };
  };
  /** 移動類道具：溜冰鞋 3 格、飛行翼 20 格（不算擲骰次數；到目前開放的最後一格就停） */
  var MOVE_ITEMS = { skates: { steps: 3, name: '溜冰鞋' }, wings: { steps: 20, name: '飛行翼' } };
  /** 每日使用上限（2026-11-07 家長決定）：前進類（溜冰鞋＋飛行翼）合計 5 次、任意門 1 次 */
  var MOVE_DAILY_LIMIT = 5, DOOR_DAILY_LIMIT = 1;
  /** 今天用了幾次指定道具（依道具紀錄計算） */
  Store.prototype._usesToday = function (childId, items) {
    var today = this.today();
    return this.data.adventure.itemLog.filter(function (x) {
      return x.childId === childId && x.action === 'use' && x.date === today && items.indexOf(x.item) >= 0 && !x.limitReset;
    }).length;
  };
  /** 今天前進類道具與任意門還能用幾次 */
  Store.prototype.getItemLimitsToday = function (childId) {
    return { move: Math.max(0, MOVE_DAILY_LIMIT - this._usesToday(childId, ['skates', 'wings'])),
      door: Math.max(0, DOOR_DAILY_LIMIT - this._usesToday(childId, ['door'])) };
  };
  Store.prototype._useMoveItem = function (childId, item) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    var end = this.getBoard(childId).tiles.length - 1;
    var needLap = p.pos >= end;
    if (!(p.bag[item] > 0)) throw new Error('背包裡沒有' + MOVE_ITEMS[item].name);
    if (!this.getItemLimitsToday(childId).move) throw new Error('今天的前進道具（溜冰鞋、飛行翼）已經用了 ' + MOVE_DAILY_LIMIT + ' 次，明天再用！');
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
  /** 溜冰鞋：前進 3 格，不算擲骰次數 */
  Store.prototype.useSkates = function (childId) { return this._useMoveItem(childId, 'skates'); };
  /** 飛行翼：前進 20 格（第一區到第 30 格就停） */
  Store.prototype.useWings = function (childId) { return this._useMoveItem(childId, 'wings'); };
  /** 任意門：傳送到本島已開放的指定格子（不含起點、目前位置與最後一格），落點觸發事件 */
  Store.prototype.useDoor = function (childId, n) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    var tiles = this.getBoard(childId).tiles, end = tiles.length - 1;
    n = Math.floor(Number(n));
    if (!(n >= 1 && n < end)) throw new Error('任意門不能傳送到這一格');
    if (n === p.pos) throw new Error('你已經在這一格了');
    if (!(p.bag.door > 0)) throw new Error('背包裡沒有任意門');
    if (!this.getItemLimitsToday(childId).door) throw new Error('任意門每天只能用 ' + DOOR_DAILY_LIMIT + ' 次，明天再用！');
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
    if (this._usesToday(childId, ['starCall'])) throw new Error('星星呼喚每天只能用 1 個，明天再用！');
    p.bag.starCall--;
    var mg = { id: uid(), childId: childId, date: this.today(), tile: p.pos, status: 'pending', bonus: true, starCall: true, caught: 0, stars: 0, ts: this.now().getTime() };
    this.data.adventure.minigames.push(mg);
    this._logItem(childId, 'use', 'starCall', 1, '背包', '額外一局抓住星星');
    this.save();
    return mg;
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
  /** 再來 3 次：今天額外 +3 次擲骰、+3 次小遊戲（今天沒用完就失效，不跨日、不轉神秘寶箱） */
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

  var api = { ISLAND_ORDER: ISLAND_ORDER, registerBoard: registerBoard, nextIsland: nextIsland, ACHIEVEMENTS: ACHIEVEMENTS, GOLD_CLEAR_STARS: GOLD_CLEAR_STARS, buildGold: buildGold, WORLD: WORLD, OPEN_REGIONS: OPEN_REGIONS, REGION02_TILES: REGION02.tiles, REGION03_TILES: REGION03.tiles, REGION04_TILES: REGION04.tiles, MAGNET_RANGE: MAGNET_RANGE, MOVE_DAILY_LIMIT: MOVE_DAILY_LIMIT, DOOR_DAILY_LIMIT: DOOR_DAILY_LIMIT, OVERFLOW_CHEST_DAILY: OVERFLOW_CHEST_DAILY, MILESTONE_KEY: MILESTONE_KEY, MILESTONE_CHEST: MILESTONE_CHEST, BLESSINGS: BLESSINGS, BLESSING_MAX_QTY: BLESSING_MAX_QTY, LUCKY_STAR: LUCKY_STAR, MYSTERY_POOL: MYSTERY_POOL, TREASURES: TREASURES, TREASURE_WEEKLY_LIMIT: TREASURE_WEEKLY_LIMIT, TREASURE_HOLD_LIMIT: TREASURE_HOLD_LIMIT, MINIGAME_MAX_STARS: MINIGAME_MAX_STARS, MINIGAME_RATE: MINIGAME_RATE, minigameStars: minigameStars, MINIGAME_SECONDS: MINIGAME_SECONDS, DAILY_MINIGAME_LIMIT: DAILY_MINIGAME_LIMIT, REGIONS: REGIONS, SHOP: SHOP, FATE_CARDS: FATE_CARDS, CHARACTERS: CHARACTERS, DEFAULT_CHARACTER: DEFAULT_CHARACTER, BOARDS: BOARDS, DAILY_DICE_LIMIT: DAILY_DICE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGame = api;
})(typeof self !== 'undefined' ? self : this);
