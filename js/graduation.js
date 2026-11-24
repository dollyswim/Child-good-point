/*
 * 親子集點 — 好習慣升級（程式內部名稱 graduation，2026-11-24 家長）
 *
 * 孩子穩定做到某個項目一段時間後，家長可以讓它「升級」：不再加分，改頒徽章、送神祕寶箱、換更難的新挑戰。
 * - 每個孩子、每個項目各自計算（共同任務也分開）
 * - 預設：連續 4 週、每一週完成率都 ≥ 85%（只算已經過完的整週）
 *   每天／平日／週末／指定星期：做到的天數 ÷ 排定的天數；每週 N 次：達到 N 次＝100%，否則 0%
 *   沒有頻率的加分項目：每週至少 grad.n 次（預設 3）；扣分項目、單次任務不升級
 * - 家長決定，不自動升級：升級（家長密碼）／先問問孩子（14 天後再提醒）／再等等（7 天後再提醒）
 * - 升級後：從加分按鈕移走，改成「今天我也有做到 ✓」（只留紀錄，不加點數、不影響淨得分和星星）
 * - 回到練習：恢復加分、進度重算；徽章不收回、神祕寶箱不重複發
 * 純邏輯，不碰 DOM。擴充 Store.prototype，瀏覽器與 Node 共用。
 */
(function (root) {
  'use strict';

  var CGP = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.CGP;
  if (typeof module !== 'undefined' && module.exports) require('./game.js');   // 需要背包（getPlayer）
  var Store = CGP.Store, dateKey = CGP.dateKey, parseDateKey = CGP.parseDateKey, weekStartKey = CGP.weekStartKey;
  var addDaysKey = CGP.addDaysKey, normalizeGrad = CGP.normalizeGrad;

  var SNOOZE_ASK = 14, SNOOZE_WAIT = 7;
  /** 好習慣稱號（2026-11-24 家長：1／3／6／10／15；圖示為家長 Gemini 圖，去背、256×256） */
  var HABIT_TITLES = [
    { n: 1, name: '銀刃衛士', icon: '🗡️', img: 'images/habit/title_silver.webp' },
    { n: 3, name: '幻影遊俠', icon: '🏹', img: 'images/habit/title_phantom.webp' },
    { n: 6, name: '破曉劍聖', icon: '⚔️', img: 'images/habit/title_dawn.webp' },
    { n: 10, name: '聖龍騎兵', icon: '🐉', img: 'images/habit/title_dragon.webp' },
    { n: 15, name: '星辰統帥', icon: '🌟', img: 'images/habit/title_star.webp' }
  ];
  /** 換新挑戰的內建建議（每日任務） */
  var CHALLENGE_IDEAS = ['自己準備明天的衣服', '睡前自己收拾房間', '主動做一件家事', '自己整理書桌', '閱讀 20 分鐘', '自己洗好餐具', '幫忙摺衣服', '早上自己起床'];

  function gradOf(item) { return item.grad || normalizeGrad(item.kind, null); }
  /** 升級規則；不能升級回傳 null。{ weeks, rate, mode: 'days'|'count', days, n } */
  function gradRule(item) {
    if (!item || item.kind === 'penalty') return null;
    var g = gradOf(item);
    if (!g || g.off) return null;
    var out = { weeks: g.weeks, rate: g.rate };
    if (item.kind === 'bonus') { out.mode = 'count'; out.n = g.n; return out; }
    var f = item.frequency || { type: 'daily' };
    switch (f.type) {
      case 'once': return null;
      case 'weeklyN': out.mode = 'count'; out.n = f.n || 1; return out;
      case 'weekdays': out.mode = 'days'; out.days = [1, 2, 3, 4, 5]; return out;
      case 'weekends': out.mode = 'days'; out.days = [0, 6]; return out;
      case 'days': out.mode = 'days'; out.days = (f.days && f.days.length) ? f.days.slice() : [1, 2, 3, 4, 5]; return out;
      default: out.mode = 'days'; out.days = [0, 1, 2, 3, 4, 5, 6]; return out;
    }
  }

  Store.prototype._gradState = function (childId, itemId, create) {
    var all = this.data.graduation || (this.data.graduation = {});
    var mine = all[childId];
    if (!mine) { if (!create) return null; mine = all[childId] = {}; }
    var g = mine[itemId];
    if (!g && create) g = mine[itemId] = { status: 'practice', since: '', snoozeUntil: '', graduatedAt: '', note: '', name: '', ceremonySeen: true, badgeDate: '', chestGiven: false, chestAt: '', doneDates: [], arch: {}, history: [], extra: {} };
    return g || null;
  };
  Store.prototype.gradRule = function (itemId) { return gradRule(this.getItem(itemId)); };
  Store.prototype.isGraduated = function (childId, itemId) {
    var g = this._gradState(childId, itemId);
    return !!(g && g.status === 'graduated');
  };

  /** 某一週（週一 key）的完成率 0～1 */
  Store.prototype.gradWeekRate = function (childId, item, ws) {
    var rule = gradRule(item);
    if (!rule) return 0;
    var g = this._gradState(childId, item.id);
    if (g && g.arch && g.arch[ws] != null) return g.arch[ws];   // 已封存的週：用封存前算好的值
    var we = addDaysKey(ws, 7);
    var recs = this.data.records.filter(function (r) {
      return r.childId === childId && r.refId === item.id && (r.type === 'task' || r.type === 'bonus') && r.date >= ws && r.date < we;
    });
    if (rule.mode === 'count') return recs.length >= rule.n ? 1 : 0;
    var hit = {};
    recs.forEach(function (r) { if (rule.days.indexOf(parseDateKey(r.date).getDay()) >= 0) hit[r.date] = true; });
    return Object.keys(hit).length / rule.days.length;
  };

  /** 從哪一天開始算（新項目：建立那天；回到練習：那天） */
  Store.prototype._gradSince = function (childId, item) {
    var g = this._gradState(childId, item.id);
    return (g && g.since) || dateKey(new Date(item.createdAt || 0));
  };

  /**
   * 升級進度
   * @returns {{ eligible, status, streak, need, left, ready, avg, thisWeek: { done, target, mode }, rule }}
   */
  Store.prototype.getGradProgress = function (childId, itemId) {
    var item = this.getItem(itemId), rule = gradRule(item), g = this._gradState(childId, itemId);
    var status = g ? g.status : 'practice';
    if (!item || !this.appliesTo(item, childId)) return { eligible: false, status: status };
    if (!rule) return { eligible: false, status: status };
    var today = this.today(), thisWs = weekStartKey(this.now()), since = this._gradSince(childId, item);
    var streak = 0, sum = 0, w = addDaysKey(thisWs, -7);
    while (streak < rule.weeks && w >= since) {   // 只算整週都在開始日之後的週
      var r = this.gradWeekRate(childId, item, w);
      if (r + 1e-9 < rule.rate / 100) break;
      streak++; sum += r; w = addDaysKey(w, -7);
    }
    // 本週進行中（只給孩子看「這週加油中」）
    var we = addDaysKey(thisWs, 7), self = this;
    var weekRecs = this.data.records.filter(function (r) { return r.childId === childId && r.refId === itemId && (r.type === 'task' || r.type === 'bonus') && r.date >= thisWs && r.date < we; });
    var tw = rule.mode === 'count' ? { mode: 'count', done: weekRecs.length, target: rule.n }
      : { mode: 'days', done: Object.keys(weekRecs.reduce(function (m, r) { if (rule.days.indexOf(parseDateKey(r.date).getDay()) >= 0) m[r.date] = 1; return m; }, {})).length, target: rule.days.length };
    var ready = status === 'practice' && streak >= rule.weeks;
    void self; void today;
    return { eligible: true, status: status, streak: streak, need: rule.weeks, left: Math.max(0, rule.weeks - streak), ready: ready,
      avg: streak ? Math.round(sum / streak * 100) : 0, thisWeek: tw, rule: rule };
  };

  /** 家長端提醒：達到條件、還在練習、不在「稍後再提醒」期間 */
  Store.prototype.getGradReminders = function () {
    var self = this, today = this.today(), out = [];
    this.data.children.forEach(function (c) {
      self.data.items.forEach(function (item) {
        if (item.kind === 'penalty' || !self.appliesTo(item, c.id)) return;
        var p = self.getGradProgress(c.id, item.id);
        if (!p.eligible || !p.ready) return;
        var g = self._gradState(c.id, item.id);
        if (g && g.snoozeUntil && today < g.snoozeUntil) return;
        out.push({ childId: c.id, itemId: item.id, name: item.name, weeks: p.streak, avg: p.avg, points: item.points });
      });
    });
    return out;
  };

  /** 先問問孩子（14 天）／再等等（7 天）：暫時不升級 */
  Store.prototype.snoozeGrad = function (childId, itemId, kind) {
    var days = kind === 'ask' ? SNOOZE_ASK : SNOOZE_WAIT;
    var g = this._gradState(childId, itemId, true);
    g.snoozeUntil = addDaysKey(this.today(), days);
    g.history.push({ at: this.today(), action: kind === 'ask' ? 'ask' : 'wait' });
    this.save();
    return g.snoozeUntil;
  };

  /**
   * 升級（家長密碼）。opts.note：家長的話；opts.force：沒達到條件也升級（測試／家長手動）
   * 第一次升級這個項目：記下徽章日期、送 1 個神祕寶箱（不用鑰匙）；回到練習後再升級不重複送
   */
  Store.prototype.graduate = function (childId, itemId, opts) {
    if (this._requireParent) this._requireParent();
    opts = opts || {};
    var item = this.getItem(itemId);
    if (!item || !this.appliesTo(item, childId)) throw new Error('找不到項目');
    if (!gradRule(item) && !opts.force) throw new Error('這個項目不會升級');
    if (this.isGraduated(childId, itemId)) throw new Error('已經升級了');
    var p = this.getGradProgress(childId, itemId);
    if (!opts.force && !p.ready) throw new Error('還沒達到升級條件');
    var g = this._gradState(childId, itemId, true), today = this.today();
    g.status = 'graduated'; g.graduatedAt = today; g.note = String(opts.note || '').trim().slice(0, 60);
    g.name = item.name; g.ceremonySeen = false; g.snoozeUntil = '';
    g.extra = g.extra || {};   // 預留：夥伴小屋裝飾（這次不做）
    var firstBadge = !g.badgeDate;
    if (firstBadge) g.badgeDate = today;
    var chest = false;
    if (!g.chestGiven) {
      g.chestGiven = true; g.chestAt = today; chest = true;
      this.getPlayer(childId).bag.giftMysteryChest++;
      if (this._logItem) this._logItem(childId, 'grant', 'mysteryChest', 1, '好習慣升級', item.name);
    }
    g.history.push({ at: today, action: 'graduate' });
    this.save();
    return { state: g, chest: chest, firstBadge: firstBadge };
  };

  /** 回到練習（家長密碼）：恢復加分、進度從今天重新計算；徽章、寶箱紀錄保留 */
  Store.prototype.ungraduate = function (childId, itemId) {
    if (this._requireParent) this._requireParent();
    var g = this._gradState(childId, itemId);
    if (!g || g.status !== 'graduated') throw new Error('這個項目沒有升級');
    g.status = 'practice'; g.since = this.today(); g.snoozeUntil = ''; g.ceremonySeen = true; g.arch = {};
    g.history.push({ at: this.today(), action: 'practice' });
    this.save();
    return g;
  };

  /** 今天我也有做到 ✓（只留紀錄，不加點數、不影響淨得分和星星）；再按一次取消 */
  Store.prototype.toggleHabitDone = function (childId, itemId) {
    if (!this.isGraduated(childId, itemId)) throw new Error('這個項目還沒升級');
    var g = this._gradState(childId, itemId), today = this.today(), i = g.doneDates.indexOf(today);
    if (i >= 0) g.doneDates.splice(i, 1); else g.doneDates.push(today);
    if (g.doneDates.length > 400) g.doneDates = g.doneDates.slice(-400);
    this.save();
    return i < 0;
  };
  Store.prototype.habitDoneToday = function (childId, itemId) {
    var g = this._gradState(childId, itemId);
    return !!(g && g.doneDates.indexOf(this.today()) >= 0);
  };

  /** 已升級的好習慣（項目還在、仍適用這個孩子） */
  Store.prototype.getGraduatedItems = function (childId) {
    var self = this, mine = (this.data.graduation || {})[childId] || {};
    return Object.keys(mine).filter(function (id) {
      var item = self.getItem(id);
      return mine[id].status === 'graduated' && item && self.appliesTo(item, childId);
    }).map(function (id) {
      var g = mine[id], item = self.getItem(id);
      return { item: item, state: g, doneToday: g.doneDates.indexOf(self.today()) >= 0, count: g.doneDates.length };
    }).sort(function (a, b) { return a.state.graduatedAt < b.state.graduatedAt ? -1 : 1; });
  };
  /** 好習慣徽章（升級過就有，回到練習也保留） */
  Store.prototype.getHabitBadges = function (childId) {
    var self = this, mine = (this.data.graduation || {})[childId] || {};
    return Object.keys(mine).filter(function (id) { return mine[id].badgeDate; }).map(function (id) {
      var g = mine[id], item = self.getItem(id), name = (item ? item.name : g.name) || g.name;
      return { id: 'habit:' + id, itemId: id, cat: 'habit', icon: '🏅', name: name + '高手', desc: '「' + name + '」好習慣升級', date: g.badgeDate, done: true };
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };
  /** 好習慣稱號：依「已升級的好習慣」數量 */
  Store.prototype.getHabitTitle = function (childId) {
    var n = this.getGraduatedItems(childId).length, cur = null, next = null;
    HABIT_TITLES.forEach(function (t) { if (n >= t.n) cur = t; else if (!next) next = t; });
    return { count: n, title: cur, next: next };
  };

  /** 還沒播放的升級典禮 */
  Store.prototype.getPendingCeremonies = function (childId) {
    var self = this, mine = (this.data.graduation || {})[childId] || {};
    return Object.keys(mine).filter(function (id) { return mine[id].status === 'graduated' && !mine[id].ceremonySeen && self.getItem(id); })
      .map(function (id) { return { item: self.getItem(id), state: mine[id] }; });
  };
  Store.prototype.markCeremonySeen = function (childId, itemId) {
    var g = this._gradState(childId, itemId);
    if (g) { g.ceremonySeen = true; this.save(); }
  };

  /** 換新挑戰建議：點數＝升級項目點數＋20%（至少 +1）；排除已經有的名稱 */
  Store.prototype.suggestChallenges = function (childId, itemId) {
    var item = this.getItem(itemId);
    if (!item) return [];
    var pts = Math.abs(item.points || 0), up = pts + Math.max(1, Math.round(pts * 0.2));
    var have = {};
    this.data.items.forEach(function (i) { have[i.name] = true; });
    return CHALLENGE_IDEAS.filter(function (n) { return !have[n]; }).slice(0, 4).map(function (n) { return { name: n, points: up, kind: 'task', frequency: { type: 'daily' } }; });
  };
  /** 選了新挑戰（家長密碼）：建一個只給這個孩子的每日任務 */
  Store.prototype.addChallengeItem = function (childId, idea) {
    if (this._requireParent) this._requireParent();
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    return this.addItem({ kind: 'task', name: idea.name, points: idea.points, childIds: [childId], frequency: idea.frequency || { type: 'daily' } });
  };

  // ---------- 接到既有流程 ----------
  // 已升級的項目：不能再加分（孩子頁改成「今天我也有做到」）；家長補登不受影響
  var _recordItem = Store.prototype.recordItem;
  Store.prototype.recordItem = function (childId, itemId) {
    if (this.isGraduated(childId, itemId)) throw new Error('這個好習慣已經升級了');
    return _recordItem.apply(this, arguments);
  };
  var _completeTask = Store.prototype.completeTask;
  Store.prototype.completeTask = function (childId, taskId) {
    if (this.isGraduated(childId, taskId)) throw new Error('這個好習慣已經升級了');
    return _completeTask.apply(this, arguments);
  };
  var _getTodayTasks = Store.prototype.getTodayTasks;
  Store.prototype.getTodayTasks = function (childId) {
    var self = this;
    return _getTodayTasks.apply(this, arguments).filter(function (t) { return !self.isGraduated(childId, t.task.id); });
  };
  // 封存舊紀錄前：先把會被封存的週的完成率記下來，升級進度不中斷
  var _archive = Store.prototype.archiveRecords;
  Store.prototype.archiveRecords = function (cutoff) {
    var self = this;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(cutoff))) {
      var lastWs = weekStartKey(parseDateKey(cutoff));
      this.data.children.forEach(function (c) {
        self.data.items.forEach(function (item) {
          if (!gradRule(item) || !self.appliesTo(item, c.id)) return;
          var snap = {}, since = self._gradSince(c.id, item), w = lastWs;
          for (var k = 0; k < 12 && w >= since; k++, w = addDaysKey(w, -7)) snap[w] = self.gradWeekRate(c.id, item, w);
          if (!Object.keys(snap).length) return;
          var g = self._gradState(c.id, item.id, true);
          g.arch = Object.assign({}, g.arch, snap);
          var keys = Object.keys(g.arch).sort();
          if (keys.length > 16) keys.slice(0, keys.length - 16).forEach(function (x) { delete g.arch[x]; });
        });
      });
    }
    return _archive.apply(this, arguments);
  };

  var api = { HABIT_TITLES: HABIT_TITLES, CHALLENGE_IDEAS: CHALLENGE_IDEAS, gradRule: gradRule, SNOOZE_ASK: SNOOZE_ASK, SNOOZE_WAIT: SNOOZE_WAIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPGrad = api;
})(typeof self !== 'undefined' ? self : this);
