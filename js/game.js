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
 */
(function (root) {
  'use strict';

  var CGP = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.CGP;
  var Store = CGP.Store;
  var dateKey = CGP.dateKey;

  var DAILY_DICE_LIMIT = 3;

  var SHOP = [
    { id: 'd6', name: '6 面骰', icon: '🎲', price: 5, desc: '擲出 1～6 步' },
    { id: 'd12', name: '12 面骰', icon: '🎯', price: 10, desc: '擲出 1～12 步' },
    { id: 'skates', name: '溜冰鞋', icon: '🛼', price: 4, desc: '直接前進 3 格（不算擲骰次數）' }
  ];

  var CHARACTERS = [
    { id: 'robot', name: '機器貓' },
    { id: 'deer', name: '小鹿' },
    { id: 'boxcat', name: '小箱獸' }
  ];

  /**
   * 金島測試版：30 格（0 = 起點）。
   * gx, gy 為等角格座標，路徑蜿蜒繞過礦洞、工廠、齒輪與金屬橋。
   * 未來擴充 100 格只要加長 tiles。
   */
  var CELLS = [
    [8, 8], [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8],
    [1, 7], [1, 6], [2, 5],
    [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
    [8, 4], [8, 3], [7, 2],
    [6, 2], [5, 2], [4, 2], [3, 2], [2, 2],
    [1, 1],
    [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]
  ];
  var TYPES = { 3: 'chance', 5: 'chest', 7: 'minigame', 9: 'chance', 12: 'chest', 15: 'chance', 17: 'minigame',
    19: 'chest', 22: 'chance', 24: 'minigame', 26: 'chest', 28: 'chance' };
  var GOLD = {
    id: 'gold', name: '金島',
    tiles: CELLS.map(function (c, i) {
      return { n: i, gx: c[0], gy: c[1], type: i === 0 ? 'start' : i === CELLS.length - 1 ? 'end' : (TYPES[i] || 'normal') };
    })
  };
  var BOARDS = { gold: GOLD };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function rint(rand, min, max) { return min + Math.floor(rand() * (max - min + 1)); }

  // ---------- 狀態 ----------
  Store.prototype.getPlayer = function (childId) {
    var adv = this.data.adventure;
    if (!adv.players[childId]) adv.players[childId] = { island: 'gold', pos: 0, character: '', bag: { d6: 0, d12: 0, skates: 0 } };
    return adv.players[childId];
  };
  Store.prototype.getBoard = function (childId) {
    return BOARDS[this.getPlayer(childId).island] || GOLD;
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
    this.getPlayer(childId).character = charId;
    this.save();
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
    for (var i = 0; i < steps && p.pos < end; i++) { p.pos++; path.push(p.pos); }
    return path;
  };

  /** 停格事件；depth 防止機會卡連鎖無限前進 */
  Store.prototype._resolveTile = function (childId, depth) {
    var p = this.getPlayer(childId);
    var tile = this.getBoard(childId).tiles[p.pos];
    var rand = this.random;
    var ev = { tile: tile.n, type: tile.type, title: '', text: '', stars: 0, items: {}, extraPath: [] };
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
    } else if (tile.type === 'minigame') {
      ev.title = '🎮 小遊戲格'; ev.text = '小遊戲即將開放，敬請期待！';
    } else if (tile.type === 'end') {
      ev.title = '🏁 抵達金島終點！'; ev.text = '你走完金島測試版 30 格了！下一座島即將開放。';
    }
    return ev;
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
    if (p.pos >= end) throw new Error('已經在終點了');
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
    if (p.pos >= end) throw new Error('已經在終點了');
    if (p.bag.skates <= 0) throw new Error('背包裡沒有溜冰鞋');
    var from = p.pos;
    p.bag.skates--;
    var path = this._advance(childId, 3);
    var event = this._resolveTile(childId, 0);
    this.save();
    return { die: 'skates', value: 3, from: from, path: path, event: event };
  };

  var api = { SHOP: SHOP, CHARACTERS: CHARACTERS, BOARDS: BOARDS, DAILY_DICE_LIMIT: DAILY_DICE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGame = api;
})(typeof self !== 'undefined' ? self : this);
