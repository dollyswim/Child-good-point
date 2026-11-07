/*
 * 親子集點 — 資料層（Phase 1：生活積分核心）
 *
 * 純邏輯，不碰 DOM，可在瀏覽器與 Node（測試）共用。
 *
 * 資料格式（schemaVersion 1）：
 * {
 *   schemaVersion: 1,
 *   children: [{ id, name, avatar, color, startPoints, createdAt }],   // avatar = 冒險夥伴代號（舊版為表情符號，載入時自動轉換）
 *   items:    [{ id, kind: 'bonus'|'penalty'|'task', name, points, childIds: 'all'|[id],
 *                frequency: { type, days?, n? }, custom, stars, createdAt }],
 *   rewards:  [{ id, name, cost, createdAt }],
 *   records:  [{ id, childId, type: 'bonus'|'penalty'|'task'|'reward', refId, name,
 *                points, stars, date: 'YYYY-MM-DD', ts }]
 * }
 *
 * 選填欄位（舊資料沒有時自動補預設值，向後相容）：
 * - item.custom：true 表示點數由家長每次自填（item.points 為預設建議值）
 * - item.stars：額外能量星星數（Phase 1 只記錄，Phase 2 才發放）
 * - item.sourceId：外部規則表的規則ID（例如 CSV 的 R001），用於匯入時對應更新
 * - record.stars：記錄當下的額外星星快照
 * - record.backfill：true 表示事後補登
 * - child.title：頭銜（例如「小小店長」）；child.badge：代表圖示；child.weeklyGoal：每週目標點數（0 = 不設定）
 * - data.challenges：本週挑戰 [{ id, name, childIds, metric: 'item'|'net', itemId, target, rewardPoints, rewardStars, createdAt }]
 *   領取紀錄為 type 'bonus'、refId = 挑戰 id，同一週只能領一次
 * - data.adventure.settlements：能量星星每日結算 [{ id, childId, date, net, baseStars, bonusStars, stars, paidRecordIds, ts }]
 *   （Phase 2）能量星星與生活點數完全分開保存
 * - data.adventure.ledger：星星帳（Phase 3 購買扣星、寶箱與機會格加星）；星星餘額 = 結算總和 + 星星帳
 * - data.adventure.rolls：擲骰紀錄；data.adventure.players[childId]：{ island, tileId, pos, character, bag: { d6, d12, skates } }
 *   tileId 為穩定格子 ID（例如 gold-01-007）；pos 為該格的順序，由 tileId 推導
 * - 等級：依累積「賺到的加分」（加分、每日任務、挑戰獎勵的正數點數）計算，扣分與兌換不會降級
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
  /** Phase 4 命運卡特殊任務：明天起出現在任務頁、3 天內有效、完成 +20 點（生活點數） */
  var SPECIAL_TASKS = {
    chore: { name: '完成指定家務', icon: '🧹' },
    praise: { name: '和所有家人說一句讚美的話和感謝的話', icon: '💬' },
    helper: { name: '幫忙大師：幫家人做 3 件事', icon: '🤝' }
  };
  var SPECIAL_TASK_POINTS = 20;
  /** 冒險背包的道具代號（穩定、唯一；不以中文名稱判斷） */
  var BAG_KEYS = ['d6', 'd12', 'skates', 'shield', 'magicDice', 'luckyMedal', 'wings', 'door', 'airplane', 'goldenKey', 'magnet', 'rerollTicket', 'bonusPlay',
    'chest', 'giftMysteryChest', 'mysteryChest']; // 寶箱庫存：一般寶箱、神諭祝福的神秘寶箱（免鑰匙）、地圖撿到的神秘寶箱（要鑰匙）
  function emptyBag() { var b = {}; BAG_KEYS.forEach(function (k) { b[k] = 0; }); return b; }
  var SPECIAL_TASK_DAYS = 3;
  /** 8 種冒險夥伴代號：孩子的頭像與冒險棋子共用（child.avatar） */
  var CHARACTER_IDS = ['roundear', 'longear', 'horn', 'wing', 'drop', 'sprout', 'flame', 'stone'];
  function isCharacter(id) { return CHARACTER_IDS.indexOf(id) >= 0; }

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
    return { schemaVersion: SCHEMA_VERSION, children: [], items: [], rewards: [], records: [], challenges: [], specialTasks: [], parentPin: null,
      milestones: {}, adventure: { settlements: [], ledger: [], rolls: [], minigames: [], bonusQuota: [], mapChests: [], blessings: [], itemLog: [], players: {} } };
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
    var help = d.items.find(function (i) { return i.name === '主動幫忙'; });
    d.challenges.push(
      { id: uid(), name: '本週主動幫忙 3 次', childIds: 'all', metric: 'item', itemId: help.id, target: 3, rewardPoints: 20, rewardStars: 0, createdAt: t },
      { id: uid(), name: '本週淨得分 100 點', childIds: 'all', metric: 'net', itemId: null, target: 100, rewardPoints: 30, rewardStars: 0, createdAt: t }
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
        title: String(c.title || ''),
        badge: String(c.badge || ''),
        weeklyGoal: Math.max(0, toInt(c.weeklyGoal, 0)),
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
          custom: !!i.custom,
          stars: Math.max(0, toInt(i.stars, 0)),
          sourceId: i.sourceId ? String(i.sourceId) : null,
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
        stars: Math.max(0, toInt(r.stars, 0)),
        backfill: !!r.backfill,
        ts: toInt(r.ts, Date.now())
      };
    }).sort(function (a, b) { return a.ts - b.ts; });

    // Phase 4：命運卡抽到的特殊任務（完成與否由紀錄 refId = 'special:<id>' 判斷，不另存）
    d.specialTasks = (Array.isArray(d.specialTasks) ? d.specialTasks : []).filter(function (x) {
      return x && x.id && childIdSet.has(String(x.childId)) && SPECIAL_TASKS[x.kind] &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(x.endDate);
    }).map(function (x) {
      return { id: String(x.id), childId: String(x.childId), kind: x.kind, name: String(x.name || SPECIAL_TASKS[x.kind].name),
        points: Math.max(0, toInt(x.points, SPECIAL_TASK_POINTS)), createdDate: String(x.createdDate || x.startDate),
        startDate: x.startDate, endDate: x.endDate, cancelled: !!x.cancelled, ts: toInt(x.ts, Date.now()) };
    });

    // 累計得分里程碑：base＝開始計算時的累計得分；keys／chests＝已發的黃金鑰匙／神秘寶箱數
    d.milestones = (function () {
      var src = d.milestones && typeof d.milestones === 'object' ? d.milestones : {}, out = {};
      Object.keys(src).forEach(function (cid) {
        if (!childIdSet.has(cid) || !src[cid]) return;
        out[cid] = { base: toInt(src[cid].base, 0), keys: Math.max(0, toInt(src[cid].keys, 0)), chests: Math.max(0, toInt(src[cid].chests, 0)) };
      });
      return out;
    })();
    // 家長密碼（只存雜湊與鹽，不存原文）
    d.parentPin = d.parentPin && typeof d.parentPin === 'object' && /^[0-9a-f]{8}$/.test(d.parentPin.hash) && d.parentPin.salt
      ? { salt: String(d.parentPin.salt), hash: d.parentPin.hash } : null;

    var adv = d.adventure && typeof d.adventure === 'object' ? d.adventure : {};
    var seenSettle = {};
    d.adventure = {
      settlements: (Array.isArray(adv.settlements) ? adv.settlements : []).filter(function (x) {
        if (!x || !x.id || !childIdSet.has(String(x.childId)) || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return false;
        var key = x.childId + '|' + x.date;   // 同一孩子同一天只保留一筆，防止重複發放
        if (seenSettle[key]) return false;
        seenSettle[key] = true;
        return true;
      }).map(function (x) {
        return {
          id: String(x.id), childId: String(x.childId), date: x.date,
          net: toInt(x.net, 0),
          baseStars: Math.max(0, toInt(x.baseStars, 0)),
          bonusStars: Math.max(0, toInt(x.bonusStars, 0)),
          stars: Math.max(0, toInt(x.stars, 0)),
          paidRecordIds: Array.isArray(x.paidRecordIds) ? x.paidRecordIds.map(String) : [],
          ts: toInt(x.ts, Date.now())
        };
      }),
      // Phase 3：星星帳（購買為負、寶箱／機會為正）
      ledger: (Array.isArray(adv.ledger) ? adv.ledger : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId));
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), date: String(x.date || ''), delta: toInt(x.delta, 0),
          reason: String(x.reason || ''), ts: toInt(x.ts, Date.now()) };
      }),
      // Phase 3：擲骰紀錄（每日上限依此計算）
      rolls: (Array.isArray(adv.rolls) ? adv.rolls : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId)) && /^\d{4}-\d{2}-\d{2}$/.test(x.date);
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), date: x.date, die: x.die === 'd12' ? 'd12' : 'd6',
          kind: x.kind === 'bonus' || x.kind === 'magic' ? x.kind : 'base',   // base＝每日 3 次；bonus＝再來 3 次；magic＝神奇骰子
          value: toInt(x.value, 0), from: toInt(x.from, 0), to: toInt(x.to, 0), ts: toInt(x.ts, Date.now()) };
      }),
      // Phase 4：小遊戲「抓住星星」（每孩子每天 1 筆；pending＝停在小遊戲格還沒玩完）
      minigames: (function () {
        var seen = {};
        return (Array.isArray(adv.minigames) ? adv.minigames : []).filter(function (x) {
          if (!x || !x.id || !childIdSet.has(String(x.childId)) || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return false;
          if (x.bonus) return true;                          // 再來 3 次的額外場次不受每天 1 筆限制
          var key = x.childId + '|' + x.date;
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        }).map(function (x) {
          return { id: String(x.id), childId: String(x.childId), date: x.date, tile: toInt(x.tile, 0), bonus: !!x.bonus,
            status: x.status === 'done' ? 'done' : 'pending', caught: Math.max(0, toInt(x.caught, 0)), stars: Math.max(0, toInt(x.stars, 0)),
            ts: toInt(x.ts, Date.now()), doneTs: x.doneTs ? toInt(x.doneTs, 0) : undefined };
        });
      })(),
      // 地圖上的神秘寶箱：tileId 為空＝還沒出現（下次冒險時出現在角色前方 2～8 格）
      mapChests: (Array.isArray(adv.mapChests) ? adv.mapChests : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId));
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), island: String(x.island || 'gold'), source: String(x.source || 'overflow'),
          createdDate: String(x.createdDate || ''), tileId: x.tileId ? String(x.tileId) : '', n: x.tileId ? toInt(x.n, 0) : 0,
          hinted: !!x.hinted, ts: toInt(x.ts, Date.now()) };
      }),
      // 再來 3 次：今天的額外擲骰／小遊戲次數（只在當天有效）
      bonusQuota: (Array.isArray(adv.bonusQuota) ? adv.bonusQuota : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId)) && /^\d{4}-\d{2}-\d{2}$/.test(x.date);
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), date: x.date, rolls: Math.max(0, toInt(x.rolls, 0)), games: Math.max(0, toInt(x.games, 0)), ts: toInt(x.ts, Date.now()) };
      }),
      // 神諭祝福（媽媽加碼）發送紀錄：時間、對象、獎勵、數量、鼓勵文字；seen＝孩子已看過領取畫面
      blessings: (Array.isArray(adv.blessings) ? adv.blessings : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId)) && x.kind;
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), kind: String(x.kind), qty: Math.max(1, toInt(x.qty, 1)),
          message: String(x.message || '').slice(0, 100), date: String(x.date || ''), ts: toInt(x.ts, Date.now()), seen: !!x.seen };
      }),
      // 道具與寶箱紀錄：取得、開箱、使用（時間、孩子、道具、來源、結果）
      itemLog: (Array.isArray(adv.itemLog) ? adv.itemLog : []).filter(function (x) {
        return x && x.id && childIdSet.has(String(x.childId));
      }).map(function (x) {
        return { id: String(x.id), childId: String(x.childId), action: String(x.action || ''), item: String(x.item || ''),
          qty: toInt(x.qty, 1), source: String(x.source || ''), result: String(x.result || ''), date: String(x.date || ''), ts: toInt(x.ts, Date.now()) };
      }),
      // Phase 3：每個孩子的棋子位置、角色、背包
      players: (function () {
        var src = adv.players && typeof adv.players === 'object' ? adv.players : {};
        var out = {};
        Object.keys(src).forEach(function (cid) {
          if (!childIdSet.has(cid)) return;
          var p = src[cid] || {};
          var bag = p.bag && typeof p.bag === 'object' ? p.bag : {};
          out[cid] = {
            island: String(p.island || 'gold'),
            pos: Math.max(0, toInt(p.pos, 0)),
            tileId: p.tileId ? String(p.tileId) : '',  // 穩定格子 ID；舊存檔沒有時由 game.js 依 pos 對應
            character: String(p.character || ''),
            medalArmed: !!p.medalArmed,   // 好運金牌已啟用（下一次寶箱／機會效果 2 次）
            looted: Array.isArray(p.looted) ? p.looted.map(String) : [],   // 被寶物磁鐵吸走的一般寶箱格（這一輪停上去不再給獎勵）
            pendingRoll: p.pendingRoll && p.pendingRoll.rollId ? {   // 已擲出還沒前進（命運重骰券可用）
              rollId: String(p.pendingRoll.rollId), die: ['d6', 'd12', 'magic'].indexOf(p.pendingRoll.die) >= 0 ? p.pendingRoll.die : 'd6',
              kind: String(p.pendingRoll.kind || 'base'), sides: toInt(p.pendingRoll.sides, 6) === 12 ? 12 : 6,
              value: Math.max(1, toInt(p.pendingRoll.value, 1)), from: Math.max(0, toInt(p.pendingRoll.from, 0)), rerolled: !!p.pendingRoll.rerolled } : null,
            bag: BAG_KEYS.reduce(function (o, k) { o[k] = Math.max(0, toInt(bag[k], 0)); return o; }, {})
          };
        });
        return out;
      })()
    };

    // 頭像統一為 8 種冒險夥伴：舊版表情符號頭像 → 已選的冒險夥伴，否則依順序分配；並同步到冒險棋子
    d.children.forEach(function (c, idx) {
      var p = d.adventure.players[c.id];
      if (!isCharacter(c.avatar)) c.avatar = p && isCharacter(p.character) ? p.character : CHARACTER_IDS[idx % CHARACTER_IDS.length];
      if (p) p.character = c.avatar;
    });

    var itemIdSet = new Set(d.items.map(function (i) { return i.id; }));
    var challenges = Array.isArray(d.challenges) ? d.challenges : [];
    d.challenges = challenges.filter(function (c) { return c && c.id; }).map(function (c) {
      var metric = c.metric === 'net' ? 'net' : 'item';
      return {
        id: String(c.id),
        name: String(c.name || '未命名挑戰'),
        childIds: c.childIds === 'all' || !Array.isArray(c.childIds) ? 'all'
          : c.childIds.map(String).filter(function (id) { return childIdSet.has(id); }),
        metric: metric,
        itemId: metric === 'item' && c.itemId && itemIdSet.has(String(c.itemId)) ? String(c.itemId) : null,
        target: Math.max(1, toInt(c.target, 1)),
        rewardPoints: Math.max(0, toInt(c.rewardPoints, 0)),
        rewardStars: Math.max(0, toInt(c.rewardStars, 0)),
        createdAt: toInt(c.createdAt, Date.now())
      };
    });

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
    this.random = opts.random || Math.random; // 遊戲隨機數（測試時可注入）
    this.seed = opts.seed !== false;
    this.listeners = [];
    this.load();
    if (this._initMilestones && this._initMilestones()) this.save();   // 舊存檔：里程碑從功能上線當下開始算（不補發）
    this.dailySnapshot();
  }

  // ----- 自動備份（每天第一次開啟時存一份完整資料，保留最近 7 天；還原或載入備份檔前另存「還原前」） -----
  var SNAP_KEY = STORAGE_KEY + '-snapshots', SNAP_DAYS = 7;
  Store.prototype._readSnaps = function () {
    try { var a = JSON.parse(this.storage.getItem(SNAP_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  };
  Store.prototype._writeSnaps = function (list) {
    // 空間不足時，從最舊的每日備份開始刪，直到存得進去
    for (;;) {
      try { this.storage.setItem(SNAP_KEY, JSON.stringify(list)); return true; } catch (e) {
        var i = list.findIndex(function (x) { return x.kind === 'daily'; });
        if (i < 0 || list.filter(function (x) { return x.kind === 'daily'; }).length <= 1) return false;
        list.splice(i, 1);
      }
    }
  };
  Store.prototype._snap = function (kind) {
    var d = this.data, now = this.now();
    return { id: uid(), kind: kind, date: dateKey(now), ts: now.getTime(),
      summary: { children: d.children.length, records: d.records.length }, data: JSON.stringify(d) };
  };
  /** 今天還沒有自動備份就存一份（＝今天開始時的狀態） */
  Store.prototype.dailySnapshot = function () {
    var today = this.today(), list = this._readSnaps();
    if (list.some(function (x) { return x.kind === 'daily' && x.date === today; })) return false;
    list.push(this._snap('daily'));
    var daily = list.filter(function (x) { return x.kind === 'daily'; }).sort(function (a, b) { return a.ts - b.ts; });
    var drop = daily.slice(0, Math.max(0, daily.length - SNAP_DAYS)).map(function (x) { return x.id; });
    return this._writeSnaps(list.filter(function (x) { return drop.indexOf(x.id) < 0; }));
  };
  /** 備份清單（新的在前，不含資料本體） */
  Store.prototype.getSnapshots = function () {
    return this._readSnaps().map(function (x) { return { id: x.id, kind: x.kind, date: x.date, ts: x.ts, summary: x.summary }; })
      .sort(function (a, b) { return b.ts - a.ts; });
  };
  /** 覆蓋資料前先存「還原前」的狀態（只保留最新一份），按錯可以還原回來 */
  Store.prototype._snapBefore = function () {
    var list = this._readSnaps().filter(function (x) { return x.kind !== 'before'; });
    list.push(this._snap('before'));
    this._writeSnaps(list);
  };
  /** 還原到某一份自動備份（需家長解鎖）；整個 App 回到那時的狀態 */
  Store.prototype.restoreSnapshot = function (id) {
    this._requireParent();
    var snap = this._readSnaps().find(function (x) { return x.id === id; });
    if (!snap) throw new Error('找不到這份備份');
    var data;
    try { data = migrate(JSON.parse(snap.data)); } catch (e) { throw new Error('這份備份已損毀，無法還原'); }
    this._snapBefore();
    this.data = data;
    if (this._initMilestones) this._initMilestones();
    this.save();
    return snap;
  };

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
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.storageError = null;
    } catch (e) {
      // 儲存空間已滿或被封鎖：資料仍保留在記憶體中，介面可提示使用者匯出備份
      this.storageError = e;
    }
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
      avatar: isCharacter(input.avatar) ? input.avatar : this._nextCharacter(),
      color: input.color || '#ffd166',
      startPoints: toInt(input.startPoints, 0),
      title: String(input.title || '').trim(),
      badge: String(input.badge || ''),
      weeklyGoal: Math.max(0, toInt(input.weeklyGoal, 0)),
      createdAt: this.now().getTime()
    };
    this.data.children.push(c);
    if (this._initMilestones) this._initMilestones();   // 新孩子：里程碑從起始點數開始算
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
    if (patch.avatar != null) {
      if (!isCharacter(patch.avatar)) throw new Error('請選擇一個冒險夥伴當頭像');
      c.avatar = patch.avatar;
      var pl = this.data.adventure.players[id];
      if (pl) pl.character = c.avatar;
    }
    if (patch.color != null) c.color = patch.color;
    if (patch.startPoints != null) c.startPoints = toInt(patch.startPoints, 0);
    if (patch.title != null) c.title = String(patch.title).trim();
    if (patch.badge != null) c.badge = String(patch.badge);
    if (patch.weeklyGoal != null) c.weeklyGoal = Math.max(0, toInt(patch.weeklyGoal, 0));
    this.save();
    return c;
  };

  /** 新孩子的預設頭像：還沒被用過的第一隻夥伴 */
  Store.prototype._nextCharacter = function () {
    var used = this.data.children.map(function (c) { return c.avatar; });
    return CHARACTER_IDS.find(function (id) { return used.indexOf(id) < 0; }) || CHARACTER_IDS[this.data.children.length % CHARACTER_IDS.length];
  };

  Store.prototype.deleteChild = function (id) {
    this.data.children = this.data.children.filter(function (c) { return c.id !== id; });
    this.data.records = this.data.records.filter(function (r) { return r.childId !== id; });
    this.data.specialTasks = this.data.specialTasks.filter(function (t) { return t.childId !== id; });
    var adv = this.data.adventure;
    adv.settlements = adv.settlements.filter(function (x) { return x.childId !== id; });
    adv.ledger = adv.ledger.filter(function (x) { return x.childId !== id; });
    adv.rolls = adv.rolls.filter(function (x) { return x.childId !== id; });
    adv.minigames = adv.minigames.filter(function (x) { return x.childId !== id; });
    adv.bonusQuota = adv.bonusQuota.filter(function (x) { return x.childId !== id; });
    adv.mapChests = adv.mapChests.filter(function (x) { return x.childId !== id; });
    delete this.data.milestones[id];
    adv.blessings = adv.blessings.filter(function (x) { return x.childId !== id; });
    adv.itemLog = adv.itemLog.filter(function (x) { return x.childId !== id; });
    delete adv.players[id];
    this.data.items.concat(this.data.challenges).forEach(function (i) {
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
      custom: !!input.custom,
      stars: Math.max(0, toInt(input.stars, 0)),
      sourceId: input.sourceId ? String(input.sourceId) : null,
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
    if (patch.kind != null && patch.kind !== item.kind) {
      // 加分與每日任務可互相切換（兩者都是加分）；扣分不可改成加分，以免正負號混淆
      var pair = ['bonus', 'task'];
      if (pair.indexOf(patch.kind) < 0 || pair.indexOf(item.kind) < 0) throw new Error('扣分項目不能改成加分');
      item.kind = patch.kind;
      if (item.kind === 'task') item.custom = false;
    }
    if (patch.points != null) item.points = normalizeItemPoints(item.kind, patch.points);
    if (patch.childIds != null) item.childIds = this._normalizeChildIds(patch.childIds);
    if (patch.frequency != null) item.frequency = normalizeFrequency(patch.frequency);
    if (patch.custom != null) item.custom = !!patch.custom;
    if (patch.stars != null) item.stars = Math.max(0, toInt(patch.stars, 0));
    this.save();
    return item;
  };

  Store.prototype.deleteItem = function (id) {
    // 歷史紀錄保留名稱快照，不受刪除影響
    this.data.items = this.data.items.filter(function (i) { return i.id !== id; });
    this.data.challenges.forEach(function (c) { if (c.itemId === id) c.itemId = null; });
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

  // ----- 家長密碼（保護整個設定與神諭祝福） -----
  function pinHash(pin, salt) {
    var h = 0x811c9dc5, s = salt + ':' + pin;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  Store.prototype.hasParentPin = function () { return !!this.data.parentPin; };
  /** 設定或更換家長密碼（4 位數字）。已有密碼時需先解鎖（或通過忘記密碼驗證） */
  Store.prototype.setParentPin = function (pin) {
    if (!/^\d{4}$/.test(String(pin))) throw new Error('請輸入 4 位數字');
    if (this.data.parentPin && !this._parentUnlocked) throw new Error('需要先輸入家長密碼');
    var salt = Math.random().toString(36).slice(2, 10);
    this.data.parentPin = { salt: salt, hash: pinHash(String(pin), salt) };
    this._parentUnlocked = true;
    this.save();
  };
  Store.prototype.checkParentPin = function (pin) {
    var p = this.data.parentPin;
    return !!p && pinHash(String(pin), p.salt) === p.hash;
  };
  /** 輸入正確密碼後解鎖（只存在記憶體；離開設定或重新整理就上鎖） */
  Store.prototype.unlockParent = function (pin) {
    this._parentUnlocked = this.checkParentPin(pin);
    return this._parentUnlocked;
  };
  Store.prototype.lockParent = function () { this._parentUnlocked = false; };
  Store.prototype.isParentUnlocked = function () { return !!this._parentUnlocked; };
  /** 忘記密碼：通過家長驗證題後允許重設 */
  Store.prototype.allowPinReset = function () { this._parentUnlocked = true; };
  Store.prototype._requireParent = function () {
    if (!this._parentUnlocked) throw new Error('需要家長密碼才能執行');
  };

  // ----- 特殊任務（Phase 4 命運卡） -----
  function addDaysKey(key, n) { var d = parseDateKey(key); d.setDate(d.getDate() + n); return dateKey(d); }
  /** 狀態：upcoming（明天才開始）、active、done、expired、cancelled */
  Store.prototype._specialStatus = function (t, today) {
    var done = this.data.records.some(function (r) { return r.refId === 'special:' + t.id; });
    if (done) return 'done';
    if (t.cancelled) return 'cancelled';
    if (today < t.startDate) return 'upcoming';
    if (today > t.endDate) return 'expired';
    return 'active';
  };
  /** @returns 此孩子的特殊任務（含 status），依開始日排序 */
  Store.prototype.getSpecialTasks = function (childId) {
    var self = this, today = this.today();
    return this.data.specialTasks.filter(function (t) { return t.childId === childId; })
      .map(function (t) { return Object.assign({}, t, { status: self._specialStatus(t, today), icon: SPECIAL_TASKS[t.kind].icon }); })
      .sort(function (a, b) { return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.ts - b.ts; });
  };
  /**
   * 命運卡抽到特殊任務：明天起 3 天內有效。同一種還沒完成（未過期、未取消）時不重複新增。
   * @returns {{ task, duplicate }}
   */
  Store.prototype.addSpecialTask = function (childId, kind) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    if (!SPECIAL_TASKS[kind]) throw new Error('沒有這種特殊任務');
    var self = this, today = this.today();
    var open = this.data.specialTasks.find(function (t) {
      if (t.childId !== childId || t.kind !== kind) return false;
      var s = self._specialStatus(t, today);
      return s === 'upcoming' || s === 'active';
    });
    if (open) return { task: open, duplicate: true };
    var start = addDaysKey(today, 1);
    var task = { id: uid(), childId: childId, kind: kind, name: SPECIAL_TASKS[kind].name, points: SPECIAL_TASK_POINTS,
      createdDate: today, startDate: start, endDate: addDaysKey(start, SPECIAL_TASK_DAYS - 1), cancelled: false, ts: this.now().getTime() };
    this.data.specialTasks.push(task);
    this.save();
    return { task: task, duplicate: false };
  };
  /** 家長按完成：記一筆加分 +20（撤銷這筆紀錄即恢復為未完成） */
  Store.prototype.completeSpecialTask = function (id) {
    var t = this.data.specialTasks.find(function (x) { return x.id === id; });
    if (!t) throw new Error('找不到這個特殊任務');
    var s = this._specialStatus(t, this.today());
    if (s === 'done') throw new Error('這個特殊任務已經完成了');
    if (s === 'upcoming') throw new Error('這個特殊任務明天才開始');
    if (s !== 'active') throw new Error('這個特殊任務已經' + (s === 'cancelled' ? '取消' : '過期'));
    return this._addRecord(t.childId, 'bonus', 'special:' + t.id, '特殊任務：' + t.name, t.points, 0);
  };
  Store.prototype.cancelSpecialTask = function (id) {
    var t = this.data.specialTasks.find(function (x) { return x.id === id; });
    if (!t) throw new Error('找不到這個特殊任務');
    t.cancelled = true;
    this.save();
    return t;
  };

  // ----- 紀錄 -----
  Store.prototype._addRecord = function (childId, type, refId, name, points, stars) {
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
      stars: Math.max(0, toInt(stars, 0)),
      date: dateKey(now),
      ts: Math.max(now.getTime(), last + 1) // 保證順序嚴格遞增
    };
    this.data.records.push(rec);
    if (this._checkMilestones) rec.milestone = this._checkMilestones(childId);   // 累計得分里程碑（黃金鑰匙、神秘寶箱）
    this.save();
    return rec;
  };

  /**
   * 點一下記錄加分或扣分項目
   * @param {number} [customPoints] 自填點數（item.custom 時必填，輸入正數即可，扣分自動轉負數）
   */
  Store.prototype.recordItem = function (childId, itemId, customPoints) {
    var item = this.getItem(itemId);
    if (!item || item.kind === 'task') throw new Error('找不到項目');
    if (!this.appliesTo(item, childId)) throw new Error('此項目不適用這位孩子');
    var points = item.points;
    if (item.custom) {
      var n = Number(customPoints);
      if (customPoints === '' || customPoints == null || !Number.isFinite(n)) throw new Error('請輸入點數');
      points = normalizeItemPoints(item.kind, n);
    }
    return this._addRecord(childId, item.kind, item.id, item.name, points, item.stars);
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
    return this._addRecord(childId, 'task', task.id, task.name, task.points, task.stars);
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
  /** 寶物商店購買紀錄（refId = 'treasure:<道具代號>'）被撤銷或刪除時，一併收回 1 件道具；已用掉則不能撤銷 */
  Store.prototype._takeBackTreasure = function (rec) {
    if (!rec || rec.type !== 'reward' || !/^treasure:/.test(rec.refId || '')) return;
    var key = rec.refId.slice(9);
    var p = this.data.adventure.players[rec.childId];
    if (!p || !p.bag || !(p.bag[key] > 0)) throw new Error('「' + rec.name.replace(/^寶物：/, '') + '」已經用掉了，不能撤銷這筆兌換');
    p.bag[key]--;
  };
  Store.prototype.undoLast = function (childId) {
    var last = this.getLastRecord(childId);
    if (!last) return null;
    this._takeBackTreasure(last);
    this.data.records = this.data.records.filter(function (r) { return r.id !== last.id; });
    this.save();
    return last;
  };

  Store.prototype.getRecord = function (id) {
    return this.data.records.find(function (r) { return r.id === id; }) || null;
  };

  /** 依時間排序紀錄（修改日期或補登後呼叫，讓「上一筆」維持時間順序） */
  Store.prototype._sortRecords = function () {
    this.data.records.sort(function (a, b) { return a.ts - b.ts; });
  };

  /** 指定日期的時間戳：沿用原本的時分；同一毫秒則往後錯開，保證順序唯一 */
  Store.prototype._tsOn = function (key, timeFrom) {
    var d = parseDateKey(key);
    var t = new Date(timeFrom);
    d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds());
    var ts = d.getTime();
    var used = new Set(this.data.records.map(function (r) { return r.ts; }));
    while (used.has(ts)) ts++;
    return ts;
  };

  Store.prototype._checkDate = function (key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key)) || dateKey(parseDateKey(key)) !== key) throw new Error('日期格式不正確');
    if (key > this.today()) throw new Error('不能記錄未來的日期');
  };

  /** 同一孩子同一天同一任務只能完成一次 */
  Store.prototype._checkTaskDup = function (childId, taskId, key, exceptId) {
    var dup = this.data.records.some(function (r) {
      return r.id !== exceptId && r.type === 'task' && r.refId === taskId && r.childId === childId && r.date === key;
    });
    if (dup) throw new Error('這一天已經完成過此任務');
  };

  /** 依紀錄類型把輸入的點數轉成正確正負號（扣分、兌換為負數） */
  function signedFor(type, points) {
    var p = Math.abs(toInt(points, 0));
    return (type === 'penalty' || type === 'reward') ? -p : p;
  }

  /**
   * 修改任一筆紀錄
   * @param {object} patch { childId?, date?, points?（輸入正數即可，扣分與兌換自動轉負數） }
   */
  Store.prototype.updateRecord = function (id, patch) {
    var r = this.getRecord(id);
    if (!r) throw new Error('找不到這筆紀錄');
    var childId = patch.childId != null ? String(patch.childId) : r.childId;
    var date = patch.date != null ? String(patch.date) : r.date;
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    if (childId !== r.childId && /^treasure:/.test(r.refId || '')) throw new Error('寶物兌換紀錄不能改成其他孩子（道具在原本孩子的背包裡）');
    this._checkDate(date);
    if (r.type === 'task') this._checkTaskDup(childId, r.refId, date, r.id);
    if (patch.points != null) {
      if (patch.points === '' || !Number.isFinite(Number(patch.points))) throw new Error('請輸入點數');
      r.points = signedFor(r.type, patch.points);
    }
    r.childId = childId;
    if (date !== r.date) {
      r.date = date;
      r.ts = this._tsOn(date, r.ts);
      this._sortRecords();
    }
    this.save();
    return r;
  };

  Store.prototype.deleteRecord = function (id) {
    var r = this.getRecord(id);
    if (!r) return null;
    this._takeBackTreasure(r);
    this.data.records = this.data.records.filter(function (x) { return x.id !== id; });
    this.save();
    return r;
  };

  /**
   * 補登過去日期的紀錄（加分、扣分或任務）
   * @param {number} [points] 不填則用規則點數；輸入正數即可
   */
  Store.prototype.addRecordOn = function (childId, itemId, key, points) {
    var item = this.getItem(itemId);
    if (!item) throw new Error('找不到規則');
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    this._checkDate(key);
    if (item.kind === 'task') this._checkTaskDup(childId, item.id, key);
    var p = (points === '' || points == null) ? item.points : signedFor(item.kind, points);
    if (item.custom && (points === '' || points == null)) throw new Error('請輸入點數');
    var now = this.now();
    var rec = {
      id: uid(), childId: childId, type: item.kind, refId: item.id, name: item.name,
      points: toInt(p, 0), stars: item.stars || 0, date: key, backfill: true,
      ts: key === dateKey(now) ? Math.max(now.getTime(), this._lastTs() + 1) : this._tsOn(key, new Date(2000, 0, 1, 20, 0, 0).getTime())
    };
    this.data.records.push(rec);
    this._sortRecords();
    if (this._checkMilestones) rec.milestone = this._checkMilestones(childId);
    this.save();
    return rec;
  };

  Store.prototype._lastTs = function () {
    return this.data.records.length ? this.data.records[this.data.records.length - 1].ts : 0;
  };

  /** 期間內的紀錄（含頭尾日期），childId 省略時為全部孩子；新到舊排序 */
  Store.prototype.getRecordsBetween = function (childId, startKey, endKey) {
    return this.data.records.filter(function (r) {
      return (!childId || r.childId === childId) && r.date >= startKey && r.date <= endKey;
    }).slice().reverse();
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
    this._snapBefore();   // 覆蓋前先自動備份目前狀態
    this.data = data;
    if (this._initMilestones) this._initMilestones();
    this.save();
    return data;
  };

  // ----- 冒險解鎖與能量星星（Phase 2） -----
  /** 能量星星 = ceil(今日淨得分 / 5)；淨得分 ≤ 0 時為 0 */
  function starsForNet(net) { return net > 0 ? Math.ceil(net / 5) : 0; }

  Store.prototype.getSettlement = function (childId, key) {
    key = key || this.today();
    return this.data.adventure.settlements.find(function (x) { return x.childId === childId && x.date === key; }) || null;
  };

  /** 尚未發放的額外星星紀錄（規則、挑戰上的 ⭐）；結算後才記的會留到下次結算 */
  Store.prototype._unpaidStarRecords = function (childId) {
    var paid = new Set();
    this.data.adventure.settlements.forEach(function (x) {
      if (x.childId === childId) x.paidRecordIds.forEach(function (id) { paid.add(id); });
    });
    return this.data.records.filter(function (r) { return r.childId === childId && r.stars > 0 && !paid.has(r.id); });
  };

  /** 星星餘額（Phase 3 起扣除商店花費） */
  Store.prototype.getStarBalance = function (childId) {
    var adv = this.data.adventure;
    var fromSettle = adv.settlements.reduce(function (sum, x) { return x.childId === childId ? sum + x.stars : sum; }, 0);
    var fromLedger = adv.ledger.reduce(function (sum, x) { return x.childId === childId ? sum + x.delta : sum; }, 0);
    return fromSettle + fromLedger;
  };

  /**
   * 今日冒險狀態
   * @returns {{ unlocked, settled, settlement, net, previewBase, previewBonus, previewStars, balance }}
   */
  Store.prototype.getAdventureStatus = function (childId) {
    var net = this.getTodayNet(childId);
    var settlement = this.getSettlement(childId);
    var bonus = this._unpaidStarRecords(childId).reduce(function (sum, r) { return sum + r.stars; }, 0);
    return {
      unlocked: !!settlement || net > 0,     // 今天結算過就維持解鎖
      settled: !!settlement,
      settlement: settlement,
      net: net,
      previewBase: starsForNet(net),
      previewBonus: bonus,
      previewStars: starsForNet(net) + bonus,
      balance: this.getStarBalance(childId)
    };
  };

  /**
   * 進入今日冒險：依當下的今日淨得分結算能量星星。
   * 同一孩子同一天只結算一次，重複呼叫回傳同一筆結算，不會重複發放。
   */
  Store.prototype.settleToday = function (childId) {
    if (!this.getChild(childId)) throw new Error('找不到孩子');
    var existing = this.getSettlement(childId);
    if (existing) return existing;
    var net = this.getTodayNet(childId);
    if (net <= 0) throw new Error('今日冒險尚未解鎖：今日淨得分要大於 0');
    var unpaid = this._unpaidStarRecords(childId);
    var base = starsForNet(net);
    var bonus = unpaid.reduce(function (sum, r) { return sum + r.stars; }, 0);
    var x = {
      id: uid(), childId: childId, date: this.today(), net: net,
      baseStars: base, bonusStars: bonus, stars: base + bonus,
      paidRecordIds: unpaid.map(function (r) { return r.id; }),
      ts: this.now().getTime()
    };
    this.data.adventure.settlements.push(x);
    this.save();
    return x;
  };

  // ----- 等級 -----
  /** 升到 Lv.n 需要的累積加分：每 1000 點 1 級，Lv.1 從 0 開始，Lv.2 = 2000、Lv.3 = 3000…Lv.10 = 10000 */
  /** 每 1000 分升 1 級：Lv.1＝0～999、Lv.2＝1000～1999… */
  function levelThreshold(n) { return n <= 1 ? 0 : 1000 * (n - 1); }

  /** 等級用的總分＝起始點數＋累計得分（加分、每日任務累加，扣分抵銷；兌換獎勵不影響），最少 0 */
  Store.prototype.getEarned = function (childId) {
    var child = this.getChild(childId);
    var total = this.data.records.reduce(function (sum, r) {
      return (r.childId === childId && SCORE_TYPES.indexOf(r.type) >= 0) ? sum + r.points : sum;
    }, child ? child.startPoints || 0 : 0);
    return Math.max(0, total);
  };

  /** @returns {{level, earned, current, next, progress}} progress 為 0～1 */
  Store.prototype.getLevel = function (childId) {
    var earned = this.getEarned(childId);
    var level = 1;
    while (earned >= levelThreshold(level + 1)) level++;
    var cur = levelThreshold(level), next = levelThreshold(level + 1);
    return { level: level, earned: earned, current: cur, next: next, progress: (earned - cur) / (next - cur) };
  };

  // ----- 每週目標 -----
  Store.prototype.getWeekNet = function (childId, date) {
    date = date || this.now();
    var ws = weekStartKey(date), today = dateKey(date);
    return this.data.records.reduce(function (sum, r) {
      return (r.childId === childId && r.date >= ws && r.date <= today && SCORE_TYPES.indexOf(r.type) >= 0) ? sum + r.points : sum;
    }, 0);
  };

  // ----- 本週挑戰 -----
  Store.prototype.getChallenges = function () { return this.data.challenges.slice(); };
  Store.prototype.getChallenge = function (id) {
    return this.data.challenges.find(function (c) { return c.id === id; }) || null;
  };
  Store.prototype.getChallengesFor = function (childId) {
    return this.data.challenges.filter(function (c) {
      return c.childIds === 'all' || c.childIds.indexOf(childId) >= 0;
    });
  };

  Store.prototype._normChallenge = function (input, base) {
    var c = base || {};
    if (input.name != null) {
      var name = String(input.name).trim();
      if (!name) throw new Error('請輸入挑戰名稱');
      c.name = name;
    }
    if (input.childIds != null) c.childIds = this._normalizeChildIds(input.childIds);
    if (input.metric != null) c.metric = input.metric === 'net' ? 'net' : 'item';
    if (input.itemId !== undefined) c.itemId = input.itemId ? String(input.itemId) : null;
    if (input.target != null) c.target = Math.max(1, toInt(input.target, 1));
    if (input.rewardPoints != null) c.rewardPoints = Math.max(0, toInt(input.rewardPoints, 0));
    if (input.rewardStars != null) c.rewardStars = Math.max(0, toInt(input.rewardStars, 0));
    if (c.metric === 'item') {
      if (!c.itemId || !this.getItem(c.itemId)) throw new Error('請選擇要達成的規則');
      if (this.getItem(c.itemId).kind === 'penalty') throw new Error('挑戰請選擇加分項目');
    } else c.itemId = null;
    return c;
  };

  Store.prototype.addChallenge = function (input) {
    var c = this._normChallenge(Object.assign({ childIds: 'all', metric: 'item', target: 1, rewardPoints: 0, rewardStars: 0 }, input),
      { id: uid(), createdAt: this.now().getTime() });
    if (!c.name) throw new Error('請輸入挑戰名稱');
    this.data.challenges.push(c);
    this.save();
    return c;
  };
  Store.prototype.updateChallenge = function (id, patch) {
    var c = this.getChallenge(id);
    if (!c) throw new Error('找不到挑戰');
    var copy = this._normChallenge(patch, clone(c));
    Object.assign(c, copy);
    this.save();
    return c;
  };
  Store.prototype.deleteChallenge = function (id) {
    this.data.challenges = this.data.challenges.filter(function (c) { return c.id !== id; });
    this.save();
  };

  /** 本週進度：{ progress, target, done, claimed, claimRecord } */
  Store.prototype.getChallengeStatus = function (childId, ch, date) {
    date = date || this.now();
    var ws = weekStartKey(date), today = dateKey(date);
    var inWeek = function (r) { return r.childId === childId && r.date >= ws && r.date <= today; };
    var progress;
    if (ch.metric === 'net') {
      // 淨得分不含本挑戰自己的獎勵
      progress = this.data.records.reduce(function (sum, r) {
        return inWeek(r) && SCORE_TYPES.indexOf(r.type) >= 0 && r.refId !== ch.id ? sum + r.points : sum;
      }, 0);
    } else {
      var days = {}, count = 0;
      this.data.records.forEach(function (r) {
        if (inWeek(r) && r.refId === ch.itemId) { count++; days[r.date] = true; }
      });
      var item = this.getItem(ch.itemId);
      // 每日任務一天最多一次，以天數計；一般加分以次數計
      progress = item && item.kind === 'task' ? Object.keys(days).length : count;
    }
    var claimRecord = this.data.records.find(function (r) { return inWeek(r) && r.refId === ch.id; }) || null;
    return { progress: progress, target: ch.target, done: progress >= ch.target, claimed: !!claimRecord, claimRecord: claimRecord };
  };

  Store.prototype.claimChallenge = function (childId, chId) {
    var ch = this.getChallenge(chId);
    if (!ch) throw new Error('找不到挑戰');
    var st = this.getChallengeStatus(childId, ch);
    if (st.claimed) throw new Error('本週已經領取過了');
    if (!st.done) throw new Error('還沒達成挑戰');
    return this._addRecord(childId, 'bonus', ch.id, '🏆 ' + ch.name, ch.rewardPoints, ch.rewardStars);
  };

  /**
   * 匯入規則（新增＋更新）：保留現有孩子、紀錄與兌換歷史。
   * - 檔案中的孩子依「名稱」對應到現有孩子；找不到同名孩子時新增
   * - 規則對應方式：先比對規則ID（sourceId），沒有時比對「種類＋名稱＋適用孩子有交集」
   * - 對應到的規則會更新分數、頻率、適用孩子等；沒對應到的新增
   * - 只靠名稱對應、且原規則適用範圍較大時，原規則保留給其他孩子，不會被縮小範圍
   * - 檔案中沒有的規則不會刪除；檔案中的紀錄不匯入
   * - 獎勵依名稱對應，名稱相同時更新所需點數
   * @param {string|object} input JSON 文字，或已解析的 { children, items, rewards }（例如 CSV 轉換結果）
   */
  Store.prototype.mergeRules = function (input) {
    var parsed = input;
    if (typeof input === 'string') {
      try { parsed = JSON.parse(input); } catch (e) { throw new Error('檔案不是有效的 JSON'); }
    }
    if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.items) && !Array.isArray(parsed.rewards))) {
      throw new Error('檔案裡沒有規則（items）或獎勵（rewards）');
    }
    var src = migrate(Object.assign({ children: [] }, parsed));
    var next = clone(this.data);
    var t = this.now().getTime();
    var result = {
      childrenAdded: [], itemsAdded: 0, itemsUpdated: 0, itemsUnchanged: 0, itemsSkipped: 0,
      rewardsAdded: 0, rewardsUpdated: 0, rewardsUnchanged: 0
    };

    var idMap = {};
    src.children.forEach(function (c) {
      var found = next.children.find(function (x) { return x.name === c.name; });
      if (!found) {
        found = { id: uid(), name: c.name, avatar: c.avatar, color: c.color, startPoints: c.startPoints, title: c.title, badge: c.badge, weeklyGoal: c.weeklyGoal, createdAt: t };
        next.children.push(found);
        result.childrenAdded.push(c.name);
      }
      idMap[c.id] = found.id;
    });

    function scopeKey(ids) { return ids === 'all' ? 'all' : ids.slice().sort().join(','); }
    function overlaps(a, b) {
      if (a === 'all' || b === 'all') return true;
      return a.some(function (id) { return b.indexOf(id) >= 0; });
    }
    var FIELDS = ['kind', 'name', 'points', 'childIds', 'frequency', 'custom', 'stars', 'sourceId'];
    var claimed = {};

    src.items.forEach(function (i) {
      var childIds = i.childIds === 'all' ? 'all'
        : Array.from(new Set(i.childIds.map(function (id) { return idMap[id]; }).filter(Boolean)));
      if (childIds !== 'all' && !childIds.length) { result.itemsSkipped++; return; }
      var free = next.items.filter(function (x) { return !claimed[x.id]; });
      var match = i.sourceId && free.find(function (x) { return x.sourceId === i.sourceId; });
      var byName = false;
      if (!match) {
        byName = true;
        var cands = free.filter(function (x) {
          return x.kind === i.kind && x.name === i.name && overlaps(x.childIds, childIds) &&
            !(x.sourceId && i.sourceId && x.sourceId !== i.sourceId);
        });
        match = cands.find(function (x) { return scopeKey(x.childIds) === scopeKey(childIds); }) || cands[0];
      }
      var incoming = {
        kind: i.kind, name: i.name, points: i.points, childIds: childIds, frequency: i.frequency,
        custom: i.custom, stars: i.stars, sourceId: i.sourceId || (match && match.sourceId) || null
      };
      // 名稱對應到的規則適用範圍比檔案大：拆開，原規則留給其他孩子，檔案的規則另外新增
      if (match && byName) {
        var expand = function (ids) { return ids === 'all' ? next.children.map(function (c) { return c.id; }) : ids; };
        var incomingIds = expand(childIds);
        var remainder = expand(match.childIds).filter(function (id) { return incomingIds.indexOf(id) < 0; });
        if (remainder.length) {
          match.childIds = remainder;
          match = null;
        }
      }
      if (match) {
        claimed[match.id] = true;
        var changed = FIELDS.some(function (f) { return JSON.stringify(match[f]) !== JSON.stringify(incoming[f]); });
        if (changed) { FIELDS.forEach(function (f) { match[f] = clone(incoming[f]); }); result.itemsUpdated++; }
        else result.itemsUnchanged++;
        return;
      }
      var item = clone(incoming);
      item.id = uid();
      item.createdAt = t;
      next.items.push(item);
      claimed[item.id] = true;
      result.itemsAdded++;
    });

    src.rewards.forEach(function (r) {
      var found = next.rewards.find(function (x) { return x.name === r.name; });
      if (!found) {
        next.rewards.push({ id: uid(), name: r.name, cost: r.cost, createdAt: t });
        result.rewardsAdded++;
      } else if (found.cost !== r.cost) {
        found.cost = r.cost;
        result.rewardsUpdated++;
      } else result.rewardsUnchanged++;
    });

    this.data = next;
    this.save();
    return result;
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
    levelThreshold: levelThreshold,
    SPECIAL_TASKS: SPECIAL_TASKS,
    BAG_KEYS: BAG_KEYS,
    emptyBag: emptyBag,
    SPECIAL_TASK_POINTS: SPECIAL_TASK_POINTS,
    CHARACTER_IDS: CHARACTER_IDS,
    starsForNet: starsForNet,
    STORAGE_KEY: STORAGE_KEY
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGP = api;
})(typeof self !== 'undefined' ? self : this);
