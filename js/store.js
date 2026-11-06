/*
 * 親子集點 — 資料層（Phase 1：生活積分核心）
 *
 * 純邏輯，不碰 DOM，可在瀏覽器與 Node（測試）共用。
 *
 * 資料格式（schemaVersion 1）：
 * {
 *   schemaVersion: 1,
 *   children: [{ id, name, avatar, color, startPoints, createdAt }],
 *   items:    [{ id, kind: 'bonus'|'penalty'|'task', name, points, childIds: 'all'|[id],
 *                frequency: { type, days?, n? }, createdAt }],
 *   rewards:  [{ id, name, cost, createdAt }],
 *   records:  [{ id, childId, type: 'bonus'|'penalty'|'task'|'reward', refId, name,
 *                points, date: 'YYYY-MM-DD', ts }]
 * }
 *
 * 規則：
 * - 扣分以負數保存；加分、任務以正數保存；兌換獎勵以負數保存。
 * - 總點數 = 起始點數 + 所有紀錄點數總和（不另存，避免不同步）。
 * - 今日淨得分 = 今日加分 + 今日扣分 + 今日任務（不含兌換獎勵、不含起始點數）。
 * - 任務完成狀態由紀錄推導，每個孩子各自獨立。
 */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STORAGE_KEY = 'cgp-data';

  var FREQUENCY_TYPES = ['daily', 'weekdays', 'weekends', 'days', 'weeklyN', 'once'];
  var ITEM_KINDS = ['bonus', 'penalty', 'task'];
  var SCORE_TYPES = ['bonus', 'penalty', 'task']; // 計入今日淨得分的紀錄類型

  // ---------- 工具 ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseDateKey(k) {
    var p = String(k).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  /** 週一為一週的開始 */
  function weekStartKey(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var offset = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - offset);
    return dateKey(x);
  }
  function toInt(v, fallback) {
    var n = Math.round(Number(v));
    return Number.isFinite(n) ? n : (fallback || 0);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- 預設資料 ----------
  function emptyData() {
    return { schemaVersion: SCHEMA_VERSION, children: [], items: [], rewards: [], records: [] };
  }

  function defaultData() {
    var d = emptyData();
    var t = Date.now();
    var mk = function (kind, name, points, freq) {
      return { id: uid(), kind: kind, name: name, points: points, childIds: 'all',
        frequency: freq || { type: 'daily' }, createdAt: t };
    };
    d.items.push(
      mk('task', '刷牙', 5),
      mk('task', '完成功課', 10, { type: 'weekdays' }),
      mk('bonus', '整理書包', 5),
      mk('bonus', '主動幫忙', 5),
      mk('bonus', '自己收玩具', 3),
      mk('penalty', '違反約定', -5),
      mk('penalty', '發脾氣', -3)
    );
    d.rewards.push(
      { id: uid(), name: '看卡通 30 分鐘', cost: 30, createdAt: t },
      { id: uid(), name: '小點心', cost: 50, createdAt: t }
    );
    return d;
  }

  // ---------- 正規化與遷移 ----------
  function normalizeFrequency(f) {
    f = f && typeof f === 'object' ? f : { type: 'daily' };
    var type = FREQUENCY_TYPES.indexOf(f.type) >= 0 ? f.type : 'daily';
    var out = { type: type };
    if (type === 'days') {
      out.days = Array.isArray(f.days)
        ? f.days.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
        : [];
      out.days = Array.from(new Set(out.days)).sort();
      if (!out.days.length) out.days = [1, 2, 3, 4, 5];
    }
    if (type === 'weeklyN') out.n = Math.max(1, Math.min(7, toInt(f.n, 1)));
    return out;
  }

  function normalizeItemPoints(kind, points) {
    var p = Math.abs(toInt(points, 0));
    return kind === 'penalty' ? -p : p;
  }

  /**
   * 將任何來源（舊版本、匯入檔）轉成目前版本格式。
   * 未來修改資料模型時，在此依 schemaVersion 依序加入遷移步驟。
   */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('資料格式不正確');
    }
    var d = clone(raw);
    var v = toInt(d.schemaVersion, 1) || 1;
    if (v > SCHEMA_VERSION) {
      throw new Error('此資料來自較新版本的 App（版本 ' + v + '），請先更新 App');
    }
    // --- 遷移步驟範例：if (v < 2) { ...; v = 2; } ---
    d.schemaVersion = SCHEMA_VERSION;

    var children = Array.isArray(d.children) ? d.children : [];
    d.children = children.filter(function (c) { return c && c.id; }).map(function (c) {
      return {
        id: String(c.id),
        name: String(c.name || '未命名'),
        avatar: String(c.avatar || '🙂'),
        color: String(c.color || '#ffd166'),
        startPoints: toInt(c.startPoints, 0),
        createdAt: toInt(c.createdAt, Date.now())
      };
    });
    var childIdSet = new Set(d.children.map(function (c) { return c.id; }));

    var items = Array.isArray(d.items) ? d.items : [];
    d.items = items.filter(function (i) { return i && i.id && ITEM_KINDS.indexOf(i.kind) >= 0; })
      .map(function (i) {
        var childIds = i.childIds === 'all' ? 'all'
          : (Array.isArray(i.childIds) ? i.childIds.map(String).filter(function (id) { return childIdSet.has(id); }) : 'all');
        return {
          id: String(i.id),
          kind: i.kind,
          name: String(i.name || '未命名'),
          points: normalizeItemPoints(i.kind, i.points),
          childIds: childIds,
          frequency: normalizeFrequency(i.frequency),
          createdAt: toInt(i.createdAt, Date.now())
        };
      });

    var rewards = Array.isArray(d.rewards) ? d.rewards : [];
    d.rewards = rewards.filter(function (r) { return r && r.id; }).map(function (r) {
      return {
        id: String(r.id),
        name: String(r.name || '未命名'),
        cost: Math.abs(toInt(r.cost, 0)),
        createdAt: toInt(r.createdAt, Date.now())
      };
    });

    var records = Array.isArray(d.records) ? d.records : [];
    d.records = records.filter(function (r) {
      return r && r.id && childIdSet.has(String(r.childId)) && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
    }).map(function (r) {
      return {
        id: String(r.id),
        childId: String(r.childId),
        type: SCORE_TYPES.concat('reward').indexOf(r.type) >= 0 ? r.type : 'bonus',
        refId: r.refId == null ? null : String(r.refId),
        name: String(r.name || ''),
        points: toInt(r.points, 0),
        date: r.date,
        ts: toInt(r.ts, Date.now())
      };
    }).sort(function (a, b) { return a.ts - b.ts; });

    return d;
  }

  // ---------- 儲存介面 ----------
  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  // ---------- Store ----------
  /**
   * @param {object} opts
   * @param {Storage} [opts.storage] 預設 localStorage
   * @param {() => Date} [opts.now] 測試用時間注入
   * @param {boolean} [opts.seed] 無資料時是否放入範例項目（預設 true）
   */
  function Store(opts) {
    opts = opts || {};
    this.storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
    this.now = opts.now || function () { return new Date(); };
    this.seed = opts.seed !== false;
    this.listeners = [];
    this.load();
  }

  Store.prototype.load = function () {
    var text = null;
    try { text = this.storage.getItem(STORAGE_KEY); } catch (e) { text = null; }
    if (text) {
      try {
        this.data = migrate(JSON.parse(text));
        return;
      } catch (e) {
        // 資料損毀：保留原始內容於備份鍵，避免直接覆蓋
        try { this.storage.setItem(STORAGE_KEY + '-corrupt-' + Date.now(), text); } catch (e2) { /* ignore */ }
      }
    }
    this.data = this.seed ? defaultData() : emptyData();
    this.save();
  };

  Store.prototype.save = function () {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    var self = this;
    this.listeners.forEach(function (fn) { fn(self); });
  };

  Store.prototype.subscribe = function (fn) { this.listeners.push(fn); };

  Store.prototype.today = function () { return dateKey(this.now()); };

  // ----- 孩子 -----
  Store.prototype.getChildren = function () { return this.data.children.slice(); };
  Store.prototype.getChild = function (id) {
    return this.data.children.find(function (c) { return c.id === id; }) || null;
  };

  Store.prototype.addChild = function (input) {
    var name = String(input.name || '').trim();
    if (!name) throw new Error('請輸入孩子名稱');
    var c = {
      id: uid(),
      name: name,
      avatar: input.avatar || '🙂',
      color: input.color || '#ffd166',
      startPoints: toInt(input.startPoints, 0),
      createdAt: this.now().getTime()
    };
    this.data.children.push(c);
    this.save();
    return c;
  };

  Store.prototype.updateChild = function (id, patch) {
    var c = this.getChild(id);
    if (!c) throw new Error('找不到孩子');
    if (patch.name != null) {
      var name = String(patch.name).trim();
      if (!name) throw new Error('請輸入孩子名稱');
      c.name = name;
    }
    if (patch.avatar != null) c.avatar = patch.avatar;
    if (patch.color != null) c.color = patch.color;
    if (patch.startPoints != null) c.startPoints = toInt(patch.startPoints, 0);
    this.save();
    return c;
  };

  Store.prototype.deleteChild = function (id) {
    this.data.children = this.data.children.filter(function (c) { return c.id !== id; });
    this.data.records = this.data.records.filter(function (r) { return r.childId !== id; });
    this.data.items.forEach(function (i) {
      if (Array.isArray(i.childIds)) i.childIds = i.childIds.filter(function (cid) { return cid !== id; });
    });
    this.save();
  };

  // ----- 規則項目（加分 / 扣分 / 任務） -----
  Store.prototype.getItem = function (id) {
    return this.data.items.find(function (i) { return i.id === id; }) || null;
  };

  Store.prototype.getItems = function (kind) {
    return this.data.items.filter(function (i) { return !kind || i.kind === kind; });
  };

  Store.prototype.addItem = function (input) {
    if (ITEM_KINDS.indexOf(input.kind) < 0) throw new Error('項目類型不正確');
    var name = String(input.name || '').trim();
    if (!name) throw new Error('請輸入名稱');
    var item = {
      id: uid(),
      kind: input.kind,
      name: name,
      points: normalizeItemPoints(input.kind, input.points),
      childIds: this._normalizeChildIds(input.childIds),
      frequency: normalizeFrequency(input.frequency),
      createdAt: this.now().getTime()
    };
    this.data.items.push(item);
    this.save();
    return item;
  };

  Store.prototype.updateItem = function (id, patch) {
    var item = this.getItem(id);
    if (!item) throw new Error('找不到項目');
    if (patch.name != null) {
      var name = String(patch.name).trim();
      if (!name) throw new Error('請輸入名稱');
      item.name = name;
    }
    if (patch.points != null) item.points = normalizeItemPoints(item.kind, patch.points);
    if (patch.childIds != null) item.childIds = this._normalizeChildIds(patch.childIds);
    if (patch.frequency != null) item.frequency = normalizeFrequency(patch.frequency);
    this.save();
    return item;
  };

  Store.prototype.deleteItem = function (id) {
    // 歷史紀錄保留名稱快照，不受刪除影響
    this.data.items = this.data.items.filter(function (i) { return i.id !== id; });
    this.save();
  };

  Store.prototype._normalizeChildIds = function (childIds) {
    if (childIds === 'all' || childIds == null) return 'all';
    var valid = new Set(this.data.children.map(function (c) { return c.id; }));
    var ids = Array.from(new Set((childIds || []).map(String))).filter(function (id) { return valid.has(id); });
    if (!ids.length) throw new Error('請至少選擇一位孩子');
    return ids;
  };

  Store.prototype.appliesTo = function (item, childId) {
    return item.childIds === 'all' || item.childIds.indexOf(childId) >= 0;
  };

  Store.prototype.getItemsFor = function (childId, kind) {
    var self = this;
    return this.data.items.filter(function (i) { return i.kind === kind && self.appliesTo(i, childId); });
  };

  // ----- 獎勵 -----
  Store.prototype.getRewards = function () { return this.data.rewards.slice(); };
  Store.prototype.getReward = function (id) {
    return this.data.rewards.find(function (r) { return r.id === id; }) || null;
  };
  Store.prototype.addReward = function (input) {
    var name = String(input.name || '').trim();
    if (!name) throw new Error('請輸入獎勵名稱');
    var r = { id: uid(), name: name, cost: Math.abs(toInt(input.cost, 0)), createdAt: this.now().getTime() };
    this.data.rewards.push(r);
    this.save();
    return r;
  };
  Store.prototype.updateReward = function (id, patch) {
    var r = this.getReward(id);
    if (!r) throw new Error('找不到獎勵');
    if (patch.name != null) {
      var name = String(patch.name).trim();
      if (!name) throw new Error('請輸入獎勵名稱');
      r.name = name;
    }
    if (patch.cost != null) r.cost = Math.abs(toInt(patch.cost, 0));
    this.save();
    return r;
  };
  Store.prototype.deleteReward = function (id) {
    this.data.rewards = this.data.rewards.filter(function (r) { return r.id !== id; });
    this.save();
  };

  // ----- 紀錄 -----
  Store.prototype._addRecord = function (childId, type, refId, name, points) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var now = this.now();
    var last = this.data.records.length ? this.data.records[this.data.records.length - 1].ts : 0;
    var rec = {
      id: uid(),
      childId: childId,
      type: type,
      refId: refId,
      name: name,
      points: toInt(points, 0),
      date: dateKey(now),
      ts: Math.max(now.getTime(), last + 1) // 保證順序嚴格遞增
    };
    this.data.records.push(rec);
    this.save();
    return rec;
  };

  /** 點一下記錄加分或扣分項目 */
  Store.prototype.recordItem = function (childId, itemId) {
    var item = this.getItem(itemId);
    if (!item || item.kind === 'task') throw new Error('找不到項目');
    if (!this.appliesTo(item, childId)) throw new Error('此項目不適用這位孩子');
    return this._addRecord(childId, item.kind, item.id, item.name, item.points);
  };

  /** 判斷任務在某日是否排程（不含每週 N 次 / 單次的完成次數判斷） */
  Store.prototype.isScheduledOn = function (task, date) {
    var dow = date.getDay();
    var f = task.frequency;
    switch (f.type) {
      case 'daily': return true;
      case 'weekdays': return dow >= 1 && dow <= 5;
      case 'weekends': return dow === 0 || dow === 6;
      case 'days': return f.days.indexOf(dow) >= 0;
      case 'weeklyN': return true;
      case 'once': return true;
      default: return true;
    }
  };

  Store.prototype._taskRecords = function (childId, taskId) {
    return this.data.records.filter(function (r) {
      return r.type === 'task' && r.childId === childId && r.refId === taskId;
    });
  };

  /**
   * 取得任務對某孩子今天的狀態
   * @returns {{visible, doneToday, canComplete, weekCount, totalCount, label}}
   */
  Store.prototype.getTaskStatus = function (childId, task, date) {
    date = date || this.now();
    var today = dateKey(date);
    var recs = this._taskRecords(childId, task.id);
    var doneToday = recs.some(function (r) { return r.date === today; });
    var ws = weekStartKey(date);
    var weekCount = recs.filter(function (r) { return r.date >= ws && r.date <= today; }).length;
    var totalCount = recs.length;
    var s = { visible: false, doneToday: doneToday, canComplete: false, weekCount: weekCount, totalCount: totalCount, label: '' };
    var f = task.frequency;
    if (f.type === 'weeklyN') {
      s.visible = true;
      s.canComplete = !doneToday && weekCount < f.n;
      s.label = '本週 ' + weekCount + '/' + f.n;
    } else if (f.type === 'once') {
      s.visible = totalCount === 0 || doneToday;
      s.canComplete = totalCount === 0;
      s.label = '單次';
    } else {
      s.visible = this.isScheduledOn(task, date);
      s.canComplete = s.visible && !doneToday;
    }
    return s;
  };

  /** 今日任務清單（只含適用此孩子、今天需要顯示的任務） */
  Store.prototype.getTodayTasks = function (childId) {
    var self = this;
    var date = this.now();
    return this.getItemsFor(childId, 'task').map(function (task) {
      return { task: task, status: self.getTaskStatus(childId, task, date) };
    }).filter(function (x) { return x.status.visible; });
  };

  Store.prototype.completeTask = function (childId, taskId) {
    var task = this.getItem(taskId);
    if (!task || task.kind !== 'task') throw new Error('找不到任務');
    if (!this.appliesTo(task, childId)) throw new Error('此任務不適用這位孩子');
    var s = this.getTaskStatus(childId, task);
    if (!s.canComplete) throw new Error(s.doneToday ? '今天已完成' : '目前無法完成此任務');
    return this._addRecord(childId, 'task', task.id, task.name, task.points);
  };

  /** 取消今天的任務完成（點已完成的任務時使用） */
  Store.prototype.uncompleteTask = function (childId, taskId) {
    var today = this.today();
    var idx = -1;
    for (var i = this.data.records.length - 1; i >= 0; i--) {
      var r = this.data.records[i];
      if (r.type === 'task' && r.childId === childId && r.refId === taskId && r.date === today) { idx = i; break; }
    }
    if (idx < 0) return null;
    var removed = this.data.records.splice(idx, 1)[0];
    this.save();
    return removed;
  };

  Store.prototype.redeemReward = function (childId, rewardId) {
    var reward = this.getReward(rewardId);
    if (!reward) throw new Error('找不到獎勵');
    if (this.getTotal(childId) < reward.cost) throw new Error('點數不足');
    return this._addRecord(childId, 'reward', reward.id, reward.name, -reward.cost);
  };

  Store.prototype.getLastRecord = function (childId) {
    for (var i = this.data.records.length - 1; i >= 0; i--) {
      if (this.data.records[i].childId === childId) return this.data.records[i];
    }
    return null;
  };

  /** 撤銷此孩子的上一筆紀錄 */
  Store.prototype.undoLast = function (childId) {
    var last = this.getLastRecord(childId);
    if (!last) return null;
    this.data.records = this.data.records.filter(function (r) { return r.id !== last.id; });
    this.save();
    return last;
  };

  Store.prototype.getRecords = function (childId, limit) {
    var recs = this.data.records.filter(function (r) { return r.childId === childId; }).reverse();
    return limit ? recs.slice(0, limit) : recs;
  };

  Store.prototype.getTotal = function (childId) {
    var c = this.getChild(childId);
    if (!c) return 0;
    return this.data.records.reduce(function (sum, r) {
      return r.childId === childId ? sum + r.points : sum;
    }, c.startPoints);
  };

  Store.prototype.getNetForDate = function (childId, key) {
    return this.data.records.reduce(function (sum, r) {
      return (r.childId === childId && r.date === key && SCORE_TYPES.indexOf(r.type) >= 0) ? sum + r.points : sum;
    }, 0);
  };

  Store.prototype.getTodayNet = function (childId) {
    return this.getNetForDate(childId, this.today());
  };

  // ----- 備份與還原 -----
  Store.prototype.exportJSON = function () {
    var out = clone(this.data);
    out.exportedAt = this.now().toISOString();
    out.app = 'child-good-point';
    return JSON.stringify(out, null, 2);
  };

  Store.prototype.importJSON = function (text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('檔案不是有效的 JSON'); }
    if (!parsed || !Array.isArray(parsed.children)) throw new Error('這不是親子集點的備份檔');
    var data = migrate(parsed);
    delete data.exportedAt;
    delete data.app;
    this.data = data;
    this.save();
    return data;
  };

  /** 外部（其他分頁）修改後重新讀取 */
  Store.prototype.reload = function () {
    this.load();
    var self = this;
    this.listeners.forEach(function (fn) { fn(self); });
  };

  var api = {
    Store: Store,
    migrate: migrate,
    dateKey: dateKey,
    parseDateKey: parseDateKey,
    weekStartKey: weekStartKey,
    memoryStorage: memoryStorage,
    defaultData: defaultData,
    SCHEMA_VERSION: SCHEMA_VERSION,
    STORAGE_KEY: STORAGE_KEY
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGP = api;
})(typeof self !== 'undefined' ? self : this);
