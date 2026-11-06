/*
 * 親子集點 — 記分總覽統計
 * 純邏輯，不碰 DOM，瀏覽器與 Node 共用。需要 store.js 的 Store 實例與日期工具。
 */
(function (root) {
  'use strict';

  var CGP = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.CGP;
  var dateKey = CGP.dateKey, parseDateKey = CGP.parseDateKey;
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  function addDays(key, n) {
    var d = parseDateKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function md(key) {
    var d = parseDateKey(key);
    return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WEEKDAYS[d.getDay()] + '）';
  }
  function eachDay(start, end, fn) {
    for (var k = start; k <= end; k = addDays(k, 1)) fn(k);
  }

  /**
   * 期間範圍
   * @param {'day'|'week'|'month'} period
   * @param {string} anchor 期間內任一天
   */
  function periodRange(period, anchor) {
    var d = parseDateKey(anchor);
    var start, end, label, prev, next;
    if (period === 'day') {
      start = end = anchor;
      label = d.getFullYear() + '/' + md(anchor);
      prev = addDays(anchor, -1); next = addDays(anchor, 1);
    } else if (period === 'month') {
      start = dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
      end = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      label = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
      prev = dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));
      next = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else {
      start = CGP.weekStartKey(d);
      end = addDays(start, 6);
      label = md(start) + '～' + md(end);
      prev = addDays(start, -7); next = addDays(start, 7);
    }
    return { start: start, end: end, label: label, prev: prev, next: next };
  }

  /** 期間合計（bonus 含每日任務；task 為其中每日任務的部分） */
  function summarize(store, childId, start, end) {
    var s = { bonus: 0, penalty: 0, task: 0, net: 0, reward: 0, stars: 0, count: 0, days: 0 };
    var days = {};
    store.getRecordsBetween(childId, start, end).forEach(function (r) {
      s.count++;
      s.stars += r.stars || 0;
      if (r.type === 'reward') { s.reward += -r.points; return; }
      if (r.type === 'task') { s.task += r.points; s.bonus += r.points; } // 每日任務也算加分
      else s[r.type] += r.points;
      s.net += r.points;
      days[r.date] = true;
    });
    s.days = Object.keys(days).length;
    return s;
  }

  /** 規則排行：依次數多到少 */
  function ranking(store, childId, start, end, kind, limit) {
    var map = {};
    store.getRecordsBetween(childId, start, end).forEach(function (r) {
      if (r.type !== kind && !(kind === 'bonus' && r.type === 'task')) return;
      var key = r.name;
      if (!map[key]) map[key] = { name: r.name, count: 0, points: 0 };
      map[key].count++;
      map[key].points += r.points;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count || Math.abs(b.points) - Math.abs(a.points); })
      .slice(0, limit || 5);
  }

  /**
   * 任務完成率（只計算到今天；任務或孩子建立前的日子不算）
   * @returns {Array<{task, done, target, rate, label}>}
   */
  function taskCompletion(store, childId, start, end) {
    var today = store.today();
    var child = store.getChild(childId);
    if (!child) return [];
    var last = end < today ? end : today;
    var childStart = dateKey(new Date(child.createdAt));
    return store.getItemsFor(childId, 'task').map(function (task) {
      var from = [start, childStart, dateKey(new Date(task.createdAt))].sort().pop();
      var recs = store.getRecordsBetween(childId, start, end).filter(function (r) {
        return r.type === 'task' && r.refId === task.id;
      });
      var doneDays = {};
      recs.forEach(function (r) { doneDays[r.date] = true; });
      var done = Object.keys(doneDays).length;
      var f = task.frequency;
      var target = 0;
      if (from <= last) {
        if (f.type === 'weeklyN') {
          var weeks = {};
          eachDay(from, last, function (k) { weeks[CGP.weekStartKey(parseDateKey(k))] = true; });
          target = Object.keys(weeks).length * f.n;
        } else if (f.type === 'once') {
          target = 1;
          var everDone = store.getRecords(childId).some(function (r) { return r.type === 'task' && r.refId === task.id; });
          return { task: task, done: everDone ? 1 : 0, target: 1, rate: everDone ? 1 : 0, label: everDone ? '已完成' : '未完成' };
        } else {
          eachDay(from, last, function (k) { if (store.isScheduledOn(task, parseDateKey(k))) target++; });
        }
      }
      var shown = Math.min(done, target || done);
      return {
        task: task, done: done, target: target,
        rate: target ? Math.min(1, done / target) : null,
        label: target ? shown + '/' + target + (f.type === 'weeklyN' ? ' 次' : ' 天') : (done ? done + ' 次' : '—')
      };
    }).filter(function (x) { return x.target || x.done; });
  }

  var api = {
    periodRange: periodRange, summarize: summarize, ranking: ranking,
    taskCompletion: taskCompletion, addDays: addDays
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPReport = api;
})(typeof self !== 'undefined' ? self : this);
