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
  var SHOP = [
    { id: 'd6', name: '6 面骰', icon: '🎲', img: 'images/items/dice_6.webp', price: 5, desc: '擲出 1～6 步' },
    { id: 'd12', name: '12 面骰', icon: '🎲', img: 'images/items/dice_12.webp', price: 10, desc: '擲出 1～12 步' },
    { id: 'skates', name: '溜冰鞋', icon: '🛼', img: 'images/items/roller_skate.webp', price: 4, desc: '直接前進 3 格（不算擲骰次數）' }
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
    { id: 'gold-01', name: '黃金沙灘與初級礦場', from: 1, to: 30, available: true,
      background: { webp: 'images/gold/region01.webp', jpg: 'images/gold/region01.jpg' }, size: REGION01.referenceSize },
    { id: 'gold-02', name: '第二區', from: 31, to: 55, available: false },
    { id: 'gold-03', name: '第三區', from: 56, to: 80, available: false },
    { id: 'gold-04', name: '第四區', from: 81, to: 100, available: false }
  ];
  function buildGold() {
    var src = REGION01.tiles;
    var t1 = src[0], t2 = src[1];
    var tiles = [{ n: 0, id: 'gold-01-start', regionId: 'gold-01', x: t1.x - (t2.x - t1.x), y: t1.y - (t2.y - t1.y), type: 'start' }];
    src.forEach(function (t) {
      tiles.push({ n: t.order, id: t.id, regionId: 'gold-01', x: t.x, y: t.y,
        type: t.eventType === 'region_boundary' ? 'boundary' : (TYPES[t.order] || 'normal') });
    });
    return { id: 'gold', name: '金島', totalTiles: 100, regions: REGIONS, tiles: tiles };
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
      adv.players[childId] = { island: 'gold', pos: 0, tileId: 'gold-01-start', character: child ? child.avatar : '', bag: { d6: 0, d12: 0, skates: 0 } };
    }
    var p = adv.players[childId];
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
  Store.prototype.getRollsToday = function (childId) {
    var today = this.today();
    return this.data.adventure.rolls.filter(function (r) { return r.childId === childId && r.date === today; }).length;
  };
  /** 今天是否可以玩（已解鎖並結算） */
  Store.prototype.canPlayToday = function (childId) {
    return !!this.getSettlement(childId);
  };

  Store.prototype.setCharacter = function (childId, charId) {
    if (!CHARACTERS.some(function (c) { return c.id === charId; })) throw new Error('沒有這個角色');
    // 頭像與冒險夥伴是同一個：一起更新
    this.updateChild(childId, { avatar: charId });
  };

  Store.prototype._requirePlay = function (childId) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
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

  // ---------- 移動與事件 ----------
  /** 從目前位置前進 steps 格（不超過終點），回傳經過的格子編號 */
  Store.prototype._advance = function (childId, steps) {
    var p = this.getPlayer(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    var path = [];
    // 抵達目前開放區域的最後一格（第 30 格木門）即停止，多餘步數捨棄
    for (var i = 0; i < steps && p.pos < end; i++) { p.pos++; path.push(p.pos); }
    p.tileId = this.getBoard(childId).tiles[p.pos].id;
    return path;
  };

  /** 停格事件；depth 防止機會卡連鎖無限前進 */
  Store.prototype._resolveTile = function (childId, depth) {
    var p = this.getPlayer(childId);
    var tile = this.getBoard(childId).tiles[p.pos];
    var rand = this.random;
    var ev = { tile: tile.n, type: tile.type, title: '', text: '', stars: 0, items: {}, extraPath: [], backPath: [] };
    if (tile.type === 'chest') {
      ev.title = '🎁 寶箱！';
      var roll = rand();
      if (roll < 0.55) {
        ev.stars = rint(rand, 1, 3);
        this._ledger(childId, ev.stars, '寶箱');
        ev.text = '得到 ⭐' + ev.stars + ' 能量星星';
      } else if (roll < 0.8) {
        p.bag.skates++; ev.items.skates = 1; ev.text = '得到一雙 🛼 溜冰鞋';
      } else {
        p.bag.d6++; ev.items.d6 = 1; ev.text = '得到一顆 🎲 6 面骰';
      }
    } else if (tile.type === 'chance') {
      ev.title = '❓ 機會';
      var c = rint(rand, 0, 2);
      if (c === 0 && depth < 1) {
        ev.text = '礦車載你額外前進 2 格！';
        ev.extraPath = this._advance(childId, 2);
        if (ev.extraPath.length) {
          var next = this._resolveTile(childId, depth + 1);
          if (next.type !== 'normal' && next.type !== 'start') ev.then = next;
        }
      } else if (c === 1 || (c === 0 && depth >= 1)) {
        ev.stars = 2; this._ledger(childId, 2, '機會：發現礦石'); ev.text = '發現發光礦石，得到 ⭐2';
      } else {
        p.bag.d6++; ev.items.d6 = 1; ev.text = '撿到一顆 🎲 6 面骰';
      }
    } else if (tile.type === 'fate') {
      ev.title = '🔮 命運卡';
      var card = pickWeighted(rand, FATE_CARDS);
      ev.card = card.id;
      if (card.id === 'back') {
        var n = rint(rand, 1, 2);
        // 後退：不退到起點之前；落點不觸發事件
        for (var b = 0; b < n && p.pos > 0; b++) { p.pos--; ev.backPath.push(p.pos); }
        p.tileId = this.getBoard(childId).tiles[p.pos].id;
        ev.text = '一陣大風吹來，往回退了 ' + ev.backPath.length + ' 格！';
      } else if (card.id === 'roadblock') {
        ev.text = '路障：' + ROADBLOCKS[Math.floor(rand() * ROADBLOCKS.length)] + '（這次沒有影響，下次繼續前進）';
      } else {
        var sp = this.addSpecialTask(childId, card.id);
        ev.special = { id: sp.task.id, kind: card.id, name: sp.task.name, duplicate: sp.duplicate };
        ev.text = sp.duplicate
          ? '特殊任務「' + sp.task.name + '」還在進行中喔！先把它完成吧。'
          : '得到特殊任務：「' + sp.task.name + '」\n明天起出現在任務頁，3 天內完成可得 +' + sp.task.points + ' 點！';
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
      } else {
        // 今天已玩過：每天最多 1 次（第 3 步會改為產生神秘寶箱）
        ev.minigameOverflow = true;
        ev.text = '今天已經玩過小遊戲了（每天 1 次），明天再來挑戰！';
      }
    } else if (tile.type === 'boundary') {
      ev.title = '🚪 抵達礦場木門！'; ev.text = '你走完金島第一區「黃金沙灘與初級礦場」了！門後的第二區即將開放。';
    } else if (tile.type === 'end') {
      ev.title = '🏁 抵達金島終點！'; ev.text = '你走完金島測試版 30 格了！下一座島即將開放。';
    }
    return ev;
  };

  // ---------- 小遊戲「抓住星星」 ----------
  /** 今天的小遊戲紀錄（pending＝已停在小遊戲格但還沒玩完；done＝已領取） */
  Store.prototype.getMinigameToday = function (childId) {
    var today = this.today();
    return this.data.adventure.minigames.find(function (m) { return m.childId === childId && m.date === today; }) || null;
  };
  /** 今天還有沒玩完的小遊戲（重新整理後可繼續） */
  Store.prototype.getPendingMinigame = function (childId) {
    var m = this.getMinigameToday(childId);
    return m && m.status === 'pending' ? m : null;
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

  /**
   * 擲骰：每天最多 3 次（6 面、12 面都算）
   * @returns {{ die, value, from, path, event, rollsLeft }}
   */
  Store.prototype.rollDice = function (childId, die) {
    this._requirePlay(childId);
    if (die !== 'd6' && die !== 'd12') throw new Error('沒有這種骰子');
    var p = this.getPlayer(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    if (p.pos >= end) throw new Error('已經抵達第一區的木門，第二區即將開放');
    if (this.getRollsToday(childId) >= DAILY_DICE_LIMIT) throw new Error('今天已經擲了 ' + DAILY_DICE_LIMIT + ' 次骰子，明天再來！');
    if (p.bag[die] <= 0) throw new Error('背包裡沒有' + (die === 'd6' ? ' 6 面骰' : ' 12 面骰'));
    var value = rint(this.random, 1, die === 'd6' ? 6 : 12);
    var from = p.pos;
    p.bag[die]--;
    var path = this._advance(childId, value);
    var event = this._resolveTile(childId, 0);
    this.data.adventure.rolls.push({ id: uid(), childId: childId, date: this.today(), die: die, value: value, from: from, to: p.pos, ts: this.now().getTime() });
    this.save();
    return { die: die, value: value, from: from, path: path, event: event, rollsLeft: DAILY_DICE_LIMIT - this.getRollsToday(childId) };
  };

  /** 溜冰鞋：前進 3 格，不算擲骰次數 */
  Store.prototype.useSkates = function (childId) {
    this._requirePlay(childId);
    var p = this.getPlayer(childId);
    var end = this.getBoard(childId).tiles.length - 1;
    if (p.pos >= end) throw new Error('已經抵達第一區的木門，第二區即將開放');
    if (p.bag.skates <= 0) throw new Error('背包裡沒有溜冰鞋');
    var from = p.pos;
    p.bag.skates--;
    var path = this._advance(childId, 3);
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'skates', value: 3, from: from, path: path, event: event };
  };

  var api = { MINIGAME_MAX_STARS: MINIGAME_MAX_STARS, MINIGAME_SECONDS: MINIGAME_SECONDS, DAILY_MINIGAME_LIMIT: DAILY_MINIGAME_LIMIT, REGIONS: REGIONS, SHOP: SHOP, FATE_CARDS: FATE_CARDS, CHARACTERS: CHARACTERS, DEFAULT_CHARACTER: DEFAULT_CHARACTER, BOARDS: BOARDS, DAILY_DICE_LIMIT: DAILY_DICE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGame = api;
})(typeof self !== 'undefined' ? self : this);
