/*
 * 親子集點 — CSV 規則表轉換
 *
 * 讓家長用 Excel / Google 試算表維護規則，存成 CSV 後直接在手機匯入。
 * 純邏輯，不碰 DOM，瀏覽器與 Node 共用。
 *
 * 支援欄位（欄位順序不拘，以標題名稱辨認；多餘欄位忽略）：
 *   規則ID     選填。有填時用來對應既有規則，改名稱或分數也能正確更新
 *   規則類型   加分 / 扣分
 *   適用對象   兩位孩子 / 全部 / 競賽冠軍者 / 孩子名稱（多位以、分隔）
 *   任務或行為 規則名稱（必填）
 *   點數變動   數字、空白（0 點）或「自填」
 *   計算頻率   每次、每餐、每天、每天（上學日）、平日、週末、每週、每週3次、每週一三五、達成一次…
 *   額外獎勵   「N個能量星星」會記為額外星星；「另扣錢」會加註在名稱後
 *
 * 頻率對應：
 *   上學日 / 平日          → 任務・平日
 *   週末                   → 任務・週末
 *   每天 / 每日（含「每次／每天」）→ 任務・每日（一天一次）
 *   每週 / 每週N次         → 任務・每週 N 次
 *   每週一三五（指定星期） → 任務・指定星期
 *   達成一次 / 單次 / 一次 → 任務・單次
 *   其他（每次、每餐、每頁…）→ 加分按鈕（可重複點）
 *   扣分一律為扣分按鈕；適用對象為「競賽冠軍者」一律為加分按鈕
 */
(function (root) {
  'use strict';

  var ALL_WORDS = ['兩位孩子', '全部', '全部孩子', '所有孩子', '所有', '競賽冠軍者', '每位孩子', ''];
  var WEEKDAY_CHARS = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };

  /** RFC 4180 CSV 解析（支援引號、引號內換行、BOM、CRLF） */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var rows = [], row = [], field = '', i = 0, inQuotes = false;
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function toHalfWidth(s) {
    return String(s).replace(/[！-～]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    }).replace(/　/g, ' ');
  }

  var CN_NUM = { '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7 };

  /** 依頻率文字判斷：回傳 null 代表加分按鈕，否則回傳任務頻率 */
  function parseFrequency(text) {
    var t = toHalfWidth(text).replace(/\s/g, '');
    if (!t) return null;
    if (/上學日|平日|週一至週五|周一至周五/.test(t)) return { type: 'weekdays' };
    if (/週末|周末|假日/.test(t)) return { type: 'weekends' };
    if (/達成一次|單次|只限一次|一次性/.test(t) || t === '一次') return { type: 'once' };
    var wn = t.match(/^每[週周]([0-9一二兩三四五六七])次/);
    if (wn) return { type: 'weeklyN', n: Number(wn[1]) || CN_NUM[wn[1]] };
    if (/^每[週周]$/.test(t)) return { type: 'weeklyN', n: 1 };
    var wd = t.match(/^每[週周]([一二三四五六日天、,]+)$/);
    if (wd) {
      var days = wd[1].split('').map(function (c) { return WEEKDAY_CHARS[c]; })
        .filter(function (d) { return d != null; });
      if (days.length) return { type: 'days', days: Array.from(new Set(days)) };
    }
    if (/每天|每日/.test(t)) return { type: 'daily' };
    return null;
  }

  /**
   * 將 CSV 文字轉成可匯入的規則資料
   * @returns {{ data: {children, items, rewards}, warnings: string[] }}
   */
  function csvToRules(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV 沒有資料');
    var header = rows[0].map(function (h) { return toHalfWidth(h).trim(); });
    function col(names) {
      for (var k = 0; k < names.length; k++) {
        var idx = header.indexOf(names[k]);
        if (idx >= 0) return idx;
      }
      return -1;
    }
    var C = {
      id: col(['規則ID', '規則編號', 'ID', '編號']),
      kind: col(['規則類型', '類型']),
      who: col(['適用對象', '對象', '適用孩子']),
      name: col(['任務或行為', '規則名稱', '名稱', '項目']),
      points: col(['點數變動', '點數', '分數']),
      freq: col(['計算頻率', '頻率']),
      extra: col(['額外獎勵', '備註'])
    };
    if (C.name < 0) throw new Error('找不到「任務或行為」欄位，請確認第一列是欄位名稱');
    if (C.kind < 0) throw new Error('找不到「規則類型」欄位（加分／扣分）');

    var warnings = [];
    var children = [];
    var childByName = {};
    var items = [];
    var seenIds = {};

    function childId(name) {
      if (!childByName[name]) {
        childByName[name] = 'csv-child-' + (children.length + 1);
        children.push({ id: childByName[name], name: name });
      }
      return childByName[name];
    }
    function cell(r, idx) { return idx >= 0 && r[idx] != null ? String(r[idx]).trim() : ''; }

    rows.slice(1).forEach(function (r, n) {
      var line = n + 2; // 試算表上的列號
      var name = cell(r, C.name);
      if (!name) return;
      var kindText = cell(r, C.kind);
      var isPenalty = /扣/.test(kindText);
      if (!isPenalty && !/加/.test(kindText)) {
        warnings.push('第 ' + line + ' 列「' + name + '」：規則類型「' + kindText + '」不是加分或扣分，已略過');
        return;
      }

      var who = cell(r, C.who);
      var childIds = 'all';
      if (ALL_WORDS.indexOf(who) < 0) {
        childIds = who.split(/[、,，/／\s]+/).map(function (s) { return s.trim(); })
          .filter(Boolean).map(childId);
      }

      var extra = cell(r, C.extra);
      if (/另扣錢/.test(extra)) name += '（另扣錢）';
      var stars = 0;
      var sm = toHalfWidth(extra).match(/(\d+)\s*(個|顆)?\s*(能量)?星星/);
      if (sm) stars = Number(sm[1]);

      var ptsText = toHalfWidth(cell(r, C.points)).replace(/\s/g, '');
      var custom = /自填|自訂|不固定/.test(ptsText);
      var points = 0;
      if (!custom && ptsText !== '') {
        points = Number(ptsText.replace(/點$/, ''));
        if (!Number.isFinite(points)) {
          warnings.push('第 ' + line + ' 列「' + name + '」：點數「' + ptsText + '」看不懂，已略過');
          return;
        }
      }
      if (!custom && points === 0 && !stars) {
        warnings.push('第 ' + line + ' 列「' + name + '」：沒有點數也沒有星星');
      }

      var freq = isPenalty || /冠軍/.test(who) ? null : parseFrequency(cell(r, C.freq));
      var item = {
        kind: isPenalty ? 'penalty' : (freq ? 'task' : 'bonus'),
        name: name,
        points: isPenalty ? -Math.abs(points) : Math.abs(points),
        childIds: childIds,
        custom: custom,
        stars: stars
      };
      if (freq) item.frequency = freq;
      var sid = cell(r, C.id);
      if (sid) {
        if (seenIds[sid]) warnings.push('第 ' + line + ' 列：規則ID「' + sid + '」重複');
        seenIds[sid] = true;
        item.sourceId = sid;
      }
      item.id = sid || ('csv-row-' + line);
      items.push(item);
    });

    if (!items.length) throw new Error('CSV 裡沒有可匯入的規則');
    return { data: { children: children, items: items, rewards: [] }, warnings: warnings };
  }

  var api = { parseCSV: parseCSV, csvToRules: csvToRules, parseFrequency: parseFrequency };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPCsv = api;
})(typeof self !== 'undefined' ? self : this);
