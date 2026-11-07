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
  var MINIGAME_SECONDS = 10;

  /** 道具圖示：家長提供的白底插圖（images/items/，256×256 WebP，原圖 1024×1024 PNG），介面以白色圖示框＋contain 顯示 */
  /**
   * 冒險寶物商店（生活點數兌換）：每個孩子每週最多 3 件、同款最多持有 2 件（只限寶物商店購買）
   * 效果於後續階段接入；購買後放進背包。
   */
  var TREASURE_WEEKLY_LIMIT = 3, TREASURE_HOLD_LIMIT = 2;
  var TREASURES = [
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 10, desc: '向前移動 3 格' },
    { id: 'shield', name: '防護罩', icon: '🛡️', img: 'images/items/shield.webp', price: 20, desc: '抵擋一次冒險中的負面效果' },
    { id: 'magicDice', name: '神奇骰子', icon: '🎲', img: 'images/items/magic_dice.webp', price: 10, desc: '額外擲一次 12 面骰（不占每日 3 次，每天最多用 1 顆）' },
    { id: 'luckyMedal', name: '好運金牌', icon: '🥇', img: 'images/items/lucky_medal.webp', price: 100, desc: '下一次停在寶箱或機會格，效果發生 2 次' },
    { id: 'wings', name: '飛行翼', icon: '🪽', img: 'images/items/flying_wings.webp', price: 100, desc: '向前飛行 20 格' },
    { id: 'door', name: '任意門', icon: '🚪', img: 'images/items/magic_door.webp', price: 100, desc: '傳送到本區指定的格子' }
  ];

  var SHOP = [
    { id: 'd6', name: '6 面骰', icon: '🎲', img: 'images/items/dice_6.webp', price: 5, desc: '擲出 1～6 步' },
    { id: 'd12', name: '12 面骰', icon: '🎲', img: 'images/items/dice_12.webp', price: 10, desc: '擲出 1～12 步' },
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 4, desc: '直接前進 3 格（不算擲骰次數）' },
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
  /**
   * 金島長地圖（總覽座標 1080×5400，左上為原點，由下往上走）：四張 1080×1350 背景由上到下為
   * 第四區（y 0）、第三區（1350）、第二區（2700）、第一區（4050）。格子的 gx、gy 為總覽座標；x、y 為所在背景圖內 0～1。
   */
  var WORLD = { width: 1080, height: 5400 };
  /** 第二區開放開關：水晶礦谷背景與最終座標到貨後改為 true */
  var REGION02_OPEN = true;   // 2026-11-07 水晶礦谷背景（Codex 核定版 v3）上線
  // 事件依既有遊戲規格（JSON 的 eventType 僅為占位；第 30 格為區域邊界）
  var TYPES = { 3: 'chance', 5: 'chest', 7: 'minigame', 9: 'chance', 11: 'fate', 12: 'chest', 14: 'fate', 15: 'chance', 17: 'minigame',
    19: 'chest', 21: 'fate', 22: 'chance', 24: 'minigame', 26: 'chest', 27: 'fate', 28: 'chance' };

  /**
   * Phase 4 命運卡（家長決定：特殊任務多一點）
   * 特殊任務 3 種各 25%、後退 1～2 格 10%、路障 15%
   */
  var FATE_CARDS = [
    { id: 'chore', weight: 25 }, { id: 'praise', weight: 25 }, { id: 'helper', weight: 25 },
    { id: 'back', weight: 10 }, { id: 'roadblock', weight: 15 }
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
    { id: 'gold-01', name: '黃金沙灘與初級礦場', from: 1, to: 30, available: true, stripY: 4050,
      background: { webp: 'images/gold/region01.webp', jpg: 'images/gold/region01.jpg' }, size: REGION01.referenceSize },
    { id: 'gold-02', name: '水晶礦谷', from: 31, to: 55, available: REGION02_OPEN, stripY: 2700,
      background: { webp: 'images/gold/region02.webp', jpg: 'images/gold/region02.jpg' }, size: { width: 1080, height: 1350 } },
    { id: 'gold-03', name: '齒輪工坊', from: 56, to: 80, available: false, stripY: 1350 },
    { id: 'gold-04', name: '金冠城堡', from: 81, to: 100, available: false, stripY: 0 }
  ];
  /** @param {boolean} [open2] 是否開放第二區（預設依 REGION02_OPEN；測試可傳 true 模擬開放後） */
  function buildGold(open2) {
    if (open2 === undefined) open2 = REGION02_OPEN;
    var src = REGION01.tiles;
    var t1 = src[0], t2 = src[1];
    var r1 = REGIONS[0];
    var g = function (t) { t.gx = t.x * WORLD.width; t.gy = r1.stripY + t.y * r1.size.height; return t; };
    var tiles = [g({ n: 0, id: 'gold-01-start', regionId: 'gold-01', x: t1.x - (t2.x - t1.x), y: t1.y - (t2.y - t1.y), type: 'start' })];
    src.forEach(function (t) {
      tiles.push(g({ n: t.order, id: t.id, regionId: 'gold-01', x: t.x, y: t.y,
        // 第二區開放後，第 30 格不再是邊界（改為一般格，可通過）
        type: t.eventType === 'region_boundary' ? (open2 ? 'normal' : 'boundary') : (TYPES[t.order] || 'normal') }));
    });
    if (open2) {
      REGION02.tiles.forEach(function (t) {
        tiles.push({ n: t.order, id: t.id, regionId: 'gold-02', gx: t.gx, gy: t.gy,
          x: t.gx / WORLD.width, y: (t.gy - REGIONS[1].stripY) / REGIONS[1].size.height, type: t.type });
      });
    }
    return { id: 'gold', name: '金島', totalTiles: 100, world: WORLD, regions: REGIONS, tiles: tiles };
  }
  var GOLD = buildGold();
  var BOARDS = { gold: GOLD };

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
        var next = this._resolveTile(childId, depth + 1);
        if (next.type !== 'normal' && next.type !== 'start') ev.then = next;
      }
    } else if (tile.type === 'fate') {
      ev.title = '🔮 命運卡';
      var card = pickWeighted(rand, FATE_CARDS);
      ev.card = card.id;
      if (card.id === 'back' && p.bag.shield > 0) {
        // 防護罩自動抵擋後退（路障沒有實際影響，不消耗防護罩）
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
      var opened = REGIONS.filter(function (r) { return r.available; });
      var lastR = opened[opened.length - 1], nextR = REGIONS[opened.length];
      ev.title = '🚪 抵達' + lastR.name + '的終點！';
      ev.text = '你走完金島第 1～' + lastR.to + ' 格了！' + (nextR ? '前方的「' + nextR.name + '」即將開放。' : '') + '\n下次出發會從起點開始新的一輪，寶箱也會重新放滿！';
    } else if (tile.type === 'end') {
      ev.title = '🏁 抵達金島終點！'; ev.text = '你走完金島測試版 30 格了！下一座島即將開放。';
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

  // ---------- 小遊戲「抓住星星」 ----------
  /** 今天的小遊戲紀錄（pending＝已停在小遊戲格但還沒玩完；done＝已領取） */
  Store.prototype.getMinigameToday = function (childId) {
    var today = this.today();
    return this.data.adventure.minigames.find(function (m) { return m.childId === childId && m.date === today && !m.bonus; }) || null;
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
    var n = Math.min(MINIGAME_MAX_STARS, got);
    m.status = 'done'; m.caught = got; m.stars = n; m.doneTs = this.now().getTime();
    if (n > 0) this._ledger(childId, n, '小遊戲：抓住星星');
    this.save();
    return m;
  };

  // ---------- 擲骰（分兩步：擲出點數 → 前進；中間可用命運重骰券） ----------
  /** 今天已用的「基本」擲骰次數（神奇骰子、再來 3 次的額外次數不算） */
  Store.prototype.getRollsToday = function (childId) {
    var today = this.today();
    return this.data.adventure.rolls.filter(function (r) { return r.childId === childId && r.date === today && (!r.kind || r.kind === 'base'); }).length;
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
    return this.data.adventure.rolls.some(function (r) { return r.childId === childId && r.date === today && r.kind === 'magic'; });
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
    if (needLap) this._newLap(childId);
    var sides = die === 'd6' ? 6 : 12;
    var value = rint(this.random, 1, sides);
    if (kind === 'bonus') this._useBonus(childId, 'rolls');
    if (die === 'magic') { p.bag.magicDice--; this._logItem(childId, 'use', 'magicDice', 1, '背包', '擲出 ' + value); } else p.bag[die]--;
    var roll = { id: uid(), childId: childId, date: this.today(), die: die === 'magic' ? 'd12' : die, kind: kind, value: value, from: p.pos, to: p.pos, ts: this.now().getTime() };
    this.data.adventure.rolls.push(roll);
    p.pendingRoll = { rollId: roll.id, die: die, kind: kind, sides: sides, value: value, from: p.pos, rerolled: false, lap: needLap };
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
    return { die: pr.die === 'magic' ? 'magic' : pr.die, kind: pr.kind, value: pr.value, from: pr.from, path: path, event: event, rollsLeft: this.getRollsLeft(childId), found: this._found, lap: !!pr.lap };
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
  /** 移動類道具：溜冰鞋 3 格、飛行翼 20 格（不算擲骰次數；到第 30 格就停） */
  var MOVE_ITEMS = { skates: { steps: 3, name: '溜冰鞋' }, wings: { steps: 20, name: '飛行翼' } };
  Store.prototype._useMoveItem = function (childId, item) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    var end = this.getBoard(childId).tiles.length - 1;
    var needLap = p.pos >= end;
    if (!(p.bag[item] > 0)) throw new Error('背包裡沒有' + MOVE_ITEMS[item].name);
    this._markDayStart(childId);
    if (needLap) this._newLap(childId);
    var from = p.pos;
    p.bag[item]--;
    this._found = 0;
    var path = this._advance(childId, MOVE_ITEMS[item].steps);
    if (item !== 'skates') this._logItem(childId, 'use', item, 1, '背包', '第 ' + from + ' → ' + p.pos + ' 格');
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: item, value: MOVE_ITEMS[item].steps, from: from, path: path, event: event, found: this._found, lap: needLap };
  };
  /** 溜冰鞋：前進 3 格，不算擲骰次數 */
  Store.prototype.useSkates = function (childId) { return this._useMoveItem(childId, 'skates'); };
  /** 飛行翼：前進 20 格（第一區到第 30 格就停） */
  Store.prototype.useWings = function (childId) { return this._useMoveItem(childId, 'wings'); };
  /** 任意門：傳送到本區指定的格子（不含起點、目前位置與第 30 格），落點觸發事件 */
  Store.prototype.useDoor = function (childId, n) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    if (p.pendingRoll) throw new Error('先完成上一次擲骰');
    var tiles = this.getBoard(childId).tiles, end = tiles.length - 1;
    n = Math.floor(Number(n));
    if (!(n >= 1 && n < end)) throw new Error('任意門不能傳送到這一格');
    if (n === p.pos) throw new Error('你已經在這一格了');
    if (!(p.bag.door > 0)) throw new Error('背包裡沒有任意門');
    this._markDayStart(childId);
    var from = p.pos;
    p.bag.door--;
    p.pos = n; p.tileId = tiles[n].id;
    this._logItem(childId, 'use', 'door', 1, '背包', '第 ' + from + ' → ' + n + ' 格');
    this._found = this._collectAt(childId, [n]);
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'door', value: 0, from: from, path: [n], event: event, found: this._found };
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

  var api = { buildGold: buildGold, WORLD: WORLD, REGION02_TILES: REGION02.tiles, MAGNET_RANGE: MAGNET_RANGE, OVERFLOW_CHEST_DAILY: OVERFLOW_CHEST_DAILY, MILESTONE_KEY: MILESTONE_KEY, MILESTONE_CHEST: MILESTONE_CHEST, BLESSINGS: BLESSINGS, BLESSING_MAX_QTY: BLESSING_MAX_QTY, LUCKY_STAR: LUCKY_STAR, MYSTERY_POOL: MYSTERY_POOL, TREASURES: TREASURES, TREASURE_WEEKLY_LIMIT: TREASURE_WEEKLY_LIMIT, TREASURE_HOLD_LIMIT: TREASURE_HOLD_LIMIT, MINIGAME_MAX_STARS: MINIGAME_MAX_STARS, MINIGAME_SECONDS: MINIGAME_SECONDS, DAILY_MINIGAME_LIMIT: DAILY_MINIGAME_LIMIT, REGIONS: REGIONS, SHOP: SHOP, FATE_CARDS: FATE_CARDS, CHARACTERS: CHARACTERS, DEFAULT_CHARACTER: DEFAULT_CHARACTER, BOARDS: BOARDS, DAILY_DICE_LIMIT: DAILY_DICE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGame = api;
})(typeof self !== 'undefined' ? self : this);
