/* 親子集點 — 介面層（Phase 1） */
(function () {
  'use strict';

  var CGP = window.CGP;
  /** 每次發布更新時修改，方便在「設定 → 備份」確認手機上是不是新版 */
  var APP_VERSION = '2026.11.07-2';
  var store;
  try {
    store = new CGP.Store();
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<p class="fatal">無法讀取本機儲存空間：' + String(e.message) + '</p>';
    return;
  }

  var AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐯', '🐨', '🦁', '🐸', '🐵', '🐧', '🦄', '🐲', '🐳', '⭐'];
  var BADGES = ['🏪', '🚜', '🎨', '⚽', '🎹', '🚀', '🦖', '🌸', '📚', '🧪', '🍳', '🏰'];
  var COLORS = ['#ffd166', '#ffadad', '#9bd5ff', '#b8f2a8', '#d7b8ff', '#ffc58f'];
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var FREQ_LABELS = {
    daily: '每日', weekdays: '平日（一～五）', weekends: '週末（六、日）',
    days: '指定星期', weeklyN: '每週 N 次', once: '單次'
  };
  // 「任務」在介面上就是「每日任務」的加分項目（資料內部仍以 kind: 'task' 保存，舊資料不需轉換）
  var KIND_LABELS = { bonus: '加分項目', penalty: '扣分項目', task: '加分項目' };
  var SETTINGS_TABS = [
    ['children', '孩子'], ['bonus', '加分'],
    ['penalty', '扣分'], ['challenge', '挑戰'], ['reward', '獎勵'], ['backup', '備份']
  ];

  var app = document.getElementById('app');
  var modal = document.getElementById('modal');
  var modalForm = document.getElementById('modal-form');
  var toastEl = document.getElementById('toast');
  var confirmEl = document.getElementById('confirm');

  var ui = {
    showAllRecords: false,
    pulse: false,
    scoreKind: 'bonus',   // 孩子頁目前顯示加分或扣分
    scorePoints: null,    // 分數篩選（null = 全部）
    query: '',            // 孩子頁搜尋文字
    settingsQuery: '',    // 設定頁搜尋文字
    report: { childId: 'all', period: 'week', anchor: store.today() },
    current: loadCurrent(),  // 底部導覽列「任務／挑戰／兌換」目前選定的孩子
    lastDate: store.today()
  };
  function loadCurrent() { try { return localStorage.getItem('cgp-ui-current'); } catch (e) { return null; } }
  function setCurrent(id) {
    ui.current = id;
    try { localStorage.setItem('cgp-ui-current', id); } catch (e) { /* 僅為方便功能 */ }
  }
  /** 目前選定的孩子；沒有或已刪除時用第一位 */
  function currentChild() {
    return store.getChild(ui.current) || store.getChildren()[0] || null;
  }

  // ---------- 工具 ----------
  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function signed(n) { return n > 0 ? '+' + n : String(n); }
  function signClass(n) { return n > 0 ? 'pos' : (n < 0 ? 'neg' : 'zero'); }
  function timeOf(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dateLabel(key) {
    var today = store.today();
    var d = CGP.parseDateKey(key);
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (key === today) return '今天';
    if (key === CGP.dateKey(y)) return '昨天';
    return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WEEKDAYS[d.getDay()] + '）';
  }
  /**
   * 路由格式：#home、#child-<id>（任務）、#challenge-<id>、#shop-<id>（兌換）、#report（紀錄）、#rules、#rules-<分頁>
   * （只用英數與連字號，在各種嵌入環境都能正常運作；仍相容舊版 #/child/<id> 格式）
   */
  function route() {
    var hs = location.hash.replace(/^#/, '');
    if (hs.charAt(0) === '/') {
      var parts = hs.split('/').filter(Boolean);
      return { name: parts[0] || 'home', arg: parts[1] || null };
    }
    if (hs === 'report') return { name: 'report', arg: null };
    var m = hs.match(/^(child|rules|challenge|shop|adventure|map)(?:-(.+))?$/);
    if (!m) return { name: 'home', arg: null };
    return { name: m[1] === 'rules' ? 'settings' : m[1], arg: m[2] || null };
  }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  var toastTimer;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (kind || '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, Math.max(1800, msg.length * 120));
  }
  /** App 內建確認對話框（取代瀏覽器原生 confirm，手機上較易閱讀，也能在嵌入環境運作） */
  function askConfirm(message, okLabel, danger) {
    return new Promise(function (resolve) {
      confirmEl.innerHTML = '<div class="confirm-box"><p class="confirm-msg">' + h(message).replace(/\n/g, '<br>') + '</p>' +
        '<div class="modal-actions"><button type="button" class="btn" data-no>取消</button>' +
        '<button type="button" class="btn ' + (danger ? 'danger-solid' : 'primary') + '" data-yes>' + h(okLabel || '確定') + '</button></div></div>';
      var settled = false;
      function done(v) {
        if (settled) return;
        settled = true;
        if (confirmEl.open) confirmEl.close();
        resolve(v);
      }
      confirmEl.querySelector('[data-yes]').onclick = function () { done(true); };
      confirmEl.querySelector('[data-no]').onclick = function () { done(false); };
      confirmEl.oncancel = function (e) { e.preventDefault(); done(false); };
      if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
      else confirmEl.setAttribute('open', '');
    });
  }
  /** 只有「知道了」按鈕的訊息框 */
  function showInfo(title, message) {
    confirmEl.innerHTML = '<div class="confirm-box"><h2>' + h(title) + '</h2><p class="confirm-msg info-msg">' + h(message).replace(/\n/g, '<br>') + '</p>' +
      '<div class="modal-actions"><button type="button" class="btn primary" data-yes>知道了</button></div></div>';
    confirmEl.querySelector('[data-yes]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
  }

  /** 確認後執行，錯誤以提示顯示 */
  function confirmThen(message, okLabel, danger, fn) {
    askConfirm(message, okLabel, danger).then(function (ok) {
      if (!ok) return;
      try { fn(); } catch (err) { toast(err.message, 'neg'); }
      render();
    });
  }

  /** 記錄後提示文字，例如「主動幫忙 +5 ⭐5」「好好表達心情 ⭐10」 */
  function recText(rec) {
    var p = (rec.points || !rec.stars) ? ' ' + signed(rec.points) : '';
    return rec.name + p + (rec.stars ? ' ⭐' + rec.stars : '');
  }

  function avatar(child, size) {
    return '<span class="avatar ' + (size || '') + '" style="--c:' + h(child.color) + '">' + h(child.avatar) + '</span>';
  }
  /** 千分位，例如 3,409 */
  function num(n) { return Number(n).toLocaleString('en-US'); }
  /** 頭銜＋等級膠囊，例如「🏪 小小店長 Lv.5」 */
  function titlePill(child) {
    var lv = store.getLevel(child.id);
    return '<span class="title-pill">' + (child.badge ? '<i>' + h(child.badge) + '</i>' : '') +
      (child.title ? h(child.title) + ' ' : '') + '<b>Lv.' + lv.level + '</b></span>';
  }
  function freqText(f) {
    if (f.type === 'days') return '每週' + f.days.map(function (d) { return WEEKDAYS[d]; }).join('、');
    if (f.type === 'weeklyN') return '每週 ' + f.n + ' 次';
    return FREQ_LABELS[f.type];
  }
  function childIdsText(ids) {
    if (ids === 'all') return '全部孩子';
    if (!ids.length) return '⚠️ 未指定孩子';
    return ids.map(function (id) { var c = store.getChild(id); return c ? c.name : ''; }).filter(Boolean).join('、');
  }

  /** 搜尋：每個關鍵字都要出現在名稱中（不分大小寫） */
  function matchQuery(name, q) {
    var terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    var n = String(name).toLowerCase();
    return terms.every(function (t) { return n.indexOf(t) >= 0; });
  }
  /** 分組用的分數鍵：自填點數的項目自成一組 */
  function ptsKey(i) { return i.custom ? 'custom' : i.points; }
  function ptsKeyLabel(key) { return key === 'custom' ? '自填' : signed(key); }
  function ptsKeyClass(key, kind) { return key === 'custom' ? (kind === 'penalty' ? 'neg' : 'pos') : signClass(key); }
  /** 按鈕上的點數文字，例如「+5」「自填」「+5 ⭐5」「⭐10」 */
  function ptsLabel(i) {
    var p = i.custom ? '自填' : ((i.points === 0 && i.stars) ? '' : signed(i.points));
    return [p, i.stars ? '⭐' + i.stars : ''].filter(Boolean).join(' ');
  }
  /** 分數排序：加分由小到大（+3、+5、+10），扣分由輕到重（-3、-5、-10），自填排最後 */
  function byPoints(a, b) {
    var sa = a.kind === 'penalty' ? 1 : 0, sb = b.kind === 'penalty' ? 1 : 0;
    if (sa !== sb) return sa - sb;
    var ca = a.custom ? 1 : 0, cb = b.custom ? 1 : 0;
    if (ca !== cb) return ca - cb;
    var d = ca ? 0 : Math.abs(a.points) - Math.abs(b.points);
    return d || String(a.name).localeCompare(String(b.name), 'zh-Hant');
  }
  /** 依分數分組 */
  function groupByPoints(items) {
    var groups = [];
    items.slice().sort(byPoints).forEach(function (i) {
      var g = groups[groups.length - 1];
      var key = ptsKey(i);
      if (!g || g.key !== key || g.kind !== i.kind) { g = { key: key, kind: i.kind, items: [] }; groups.push(g); }
      g.items.push(i);
    });
    return groups;
  }

  // ---------- 畫面 ----------
  function render() {
    var r = route();
    var html;
    if (r.name === 'child' || r.name === 'challenge' || r.name === 'shop' || r.name === 'adventure' || r.name === 'map') {
      var child = store.getChild(r.arg);
      if (!child) { location.replace('#home'); return; }
      setCurrent(child.id);
      html = r.name === 'child' ? renderChild(child) : r.name === 'challenge' ? renderChallenge(child)
        : r.name === 'shop' ? renderShop(child) : r.name === 'map' ? renderMap(child) : renderAdventure(child);
    } else if (r.name === 'settings') {
      html = renderSettings(r.arg || 'children');
    } else if (r.name === 'report') {
      html = renderReport();
    } else {
      html = renderHome();
    }
    if (r.name !== 'settings') html += bottomNav(r.name === 'adventure' || r.name === 'map' ? 'child' : r.name);
    app.innerHTML = html;
    app.dataset.view = r.name;
    if (ui.pulse) {
      var el = app.querySelector('.total-value');
      if (el) el.classList.add('pulse');
      ui.pulse = false;
    }
  }

  /** 插圖集中在 js/art.js（原創向量圖） */
  var ART = window.CGPArt;
  var MASCOT = ART.MASCOT;

  function sky(inner, small) {
    return '<header class="sky ' + (small ? 'sky-sm' : '') + '"><span class="cloud c1"></span><span class="cloud c2"></span>' + inner + '</header>';
  }
  function gear() { return '<a class="gear" href="#rules" aria-label="設定">⚙️</a>'; }
  function plaque(title, sub) {
    return '<div class="plaque"><h1>' + h(title) + '</h1>' + (sub ? '<div class="ribbon">' + sub.split('・').map(function (t, i, arr) {
      // 只在「・」後面換行，避免把詞拆開
      return '<span class="nb">' + h(t) + (i < arr.length - 1 ? '・' : '') + '</span>';
    }).join('') + '</div>' : '') + '</div>';
  }

  /** 子頁面頂部：標題木牌＋孩子切換 */
  function pageHeader(title, child, tab) {
    var kids = store.getChildren();
    var sw = kids.length > 1 ? '<nav class="kid-switch" aria-label="切換孩子">' + kids.map(function (c) {
      return '<a class="kid ' + (c.id === child.id ? 'active' : '') + '" href="#' + tab + '-' + h(c.id) + '" style="--c:' + h(c.color) + '">' +
        avatar(c, 'xs') + h(c.name) + '</a>';
    }).join('') + '</nav>' : '';
    return sky('<a class="icon-btn back" href="#home" aria-label="回首頁">‹</a>' + plaque(title) + gear() + sw, true);
  }

  var NAV = [['home', '🏠', '首頁'], ['child', '📋', '任務'], ['challenge', '🏆', '挑戰'], ['shop', '🎁', '兌換'], ['report', '📊', '紀錄']];
  function bottomNav(active) {
    var c = currentChild();
    return '<nav class="bottom-nav" aria-label="主要分頁">' + NAV.map(function (n) {
      var href = n[0] === 'home' ? '#home' : n[0] === 'report' ? '#report' : (c ? '#' + n[0] + '-' + c.id : '#home');
      return '<a class="nav-item ' + (active === n[0] ? 'active' : '') + '" href="' + href + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-icon">' + n[1] + '</span><span>' + n[2] + '</span></a>';
    }).join('') + '</nav>';
  }

  function progressBar(value, max, cls) {
    var pct = max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
    return '<span class="bar ' + (cls || '') + '"><i style="width:' + pct + '%"></i></span>';
  }

  function renderHome() {
    var children = store.getChildren();
    var range = window.CGPReport.periodRange('week', store.today());
    var cards = children.map(function (c) {
      var net = store.getTodayNet(c.id);
      return '<button class="child-card" data-action="open-child" data-id="' + h(c.id) + '" style="--c:' + h(c.color) + '">' +
        avatar(c, 'lg') +
        '<span class="child-card-body"><span class="child-name">' + h(c.name) + '</span>' + titlePill(c) + '</span>' +
        '<span class="points-box"><span class="child-total"><i class="coin" aria-hidden="true">點</i><b>' + num(store.getTotal(c.id)) + '</b> 點</span>' +
        '<span class="child-today ' + signClass(net) + '">' + (net > 0 ? '⬆ ' : '') + '今日 ' + signed(net) + '</span></span>' +
        (c.badge ? '<span class="card-deco" aria-hidden="true">' + h(c.badge) + '</span>' : '') +
        '</button>';
    }).join('');

    var left = children.reduce(function (n, c) {
      return n + store.getTodayTasks(c.id).filter(function (t) { return t.status.canComplete; }).length;
    }, 0);
    var tiles = children.length ? '<div class="tiles">' +
      '<button class="tile t-task" data-action="pick-child" data-kind="child"><span class="tile-icon">📋</span>今日任務' + (left ? '<span class="badge-num">' + left + '</span>' : '') + '</button>' +
      '<button class="tile t-challenge" data-action="pick-child" data-kind="challenge"><span class="tile-icon">🏆</span>本週挑戰</button>' +
      '<button class="tile t-shop" data-action="pick-child" data-kind="shop"><span class="tile-icon">🎁</span>獎勵兌換</button>' +
      '<a class="tile t-report" href="#report"><span class="tile-icon">📊</span>記分總覽</a></div>' : '';

    var goals = children.filter(function (c) { return c.weeklyGoal > 0; });
    var week = children.length ? '<section class="week-card"><div class="week-head"><h2>📅 本週進度 <small>（' + h(range.label.replace(/（.）/g, '')) + '）</small></h2></div>' +
      (goals.length ? goals.map(function (c) {
        var wn = store.getWeekNet(c.id);
        var leftPts = Math.max(0, c.weeklyGoal - wn);
        return '<div class="goal-row">' + avatar(c, 'sm') + '<b class="goal-name">' + h(c.name) + '</b>' +
          '<span class="goal-bar">' + progressBar(wn, c.weeklyGoal) + '<span class="goal-text">' + num(Math.max(0, wn)) + ' / ' + num(c.weeklyGoal) + ' 點</span></span>' +
          '<span class="goal-left">' + (leftPts ? '還差 ' + num(leftPts) : '🎉 達成') + '</span></div>';
      }).join('') : '<p class="muted small">到 ⚙️ 設定 → 孩子，設定「每週目標點數」就會在這裡顯示進度。</p>') +
      '</section>' : '';

    return sky('<div class="hero">' + MASCOT + plaque('親子集點冒險', '完成任務・累積點數・解鎖獎勵') +
        '<span class="island" aria-hidden="true">' + ART.FLOAT_CASTLE + '</span></div>' + gear()) +
      '<main class="page home">' +
      (children.length
        ? '<div class="child-list">' + cards + '</div>'
        : '<div class="empty card"><p class="big-emoji">👋</p><p><b>還沒有孩子資料</b></p><p class="muted">先新增孩子，就可以開始記錄生活積分。</p></div>') +
      tiles + week +
      '<button class="btn add-child" data-action="add-child">＋ 新增孩子</button>' +
      '</main>';
  }

  /** 孩子頁上方的點數與等級卡 */
  function summaryCard(child) {
    var total = store.getTotal(child.id);
    var net = store.getTodayNet(child.id);
    var lv = store.getLevel(child.id);
    return '<section class="summary" style="--c:' + h(child.color) + '">' +
      '<div class="summary-top">' + avatar(child, 'md') +
      '<div class="summary-main"><div class="label">目前總點數</div><div class="total-value" data-testid="total">' + num(total) + '</div></div>' +
      '<div class="today"><div class="label">今日淨得分</div><div class="today-value ' + signClass(net) + '" data-testid="today">' + signed(net) + '</div></div></div>' +
      '<div class="level-row">' + titlePill(child) + progressBar(lv.earned - lv.current, lv.next - lv.current, 'lv') +
      '<small>再 ' + num(lv.next - lv.earned) + ' 點升 Lv.' + (lv.level + 1) + '</small></div>' +
      '</section>';
  }

  function renderChild(child) {
    var id = child.id;
    var tasks = store.getTodayTasks(id);
    var last = store.getLastRecord(id);
    var records = store.getRecords(id, ui.showAllRecords ? 0 : 8);
    var allCount = store.getRecords(id).length;
    var doneCount = tasks.filter(function (t) { return t.status.doneToday; }).length;

    var taskHtml = tasks.length ? tasks.map(taskButton).join('') : '<p class="muted small">今天沒有每日任務。可在設定的加分項目勾選「📋 每日任務」。</p>';

    var recHtml = records.length ? '<ul class="records">' + groupByDate(records).map(function (g) {
      return '<li class="rec-date">' + h(dateLabel(g.date)) + '</li>' + g.items.map(function (x) { return recordRow(x); }).join('');
    }).join('') + '</ul>' : '<p class="muted small">還沒有紀錄</p>';

    return pageHeader('今日任務', child, 'child') +
      '<main class="page has-undo">' +
      adventureBanner(child) +
      summaryCard(child) +
      '<section class="panel"><h2>📌 常用・今日任務' + (tasks.length ? ' <small>' + doneCount + '/' + tasks.length + '</small>' : '') + '</h2><div class="tasks">' + taskHtml + '</div></section>' +
      '<section class="panel scorer"><h2>✏️ 加分・扣分</h2>' +
      '<input type="search" id="score-search" class="search" data-search="score" placeholder="🔍 搜尋規定，例如：功課" ' +
      'autocomplete="off" enterkeyhint="search" value="' + h(ui.query) + '">' +
      '<div id="score-list">' + renderScoreList(id) + '</div></section>' +
      '<section class="panel"><h2>🕘 最近紀錄</h2>' + recHtml +
      (allCount > 8 ? '<button class="btn link" data-action="toggle-history">' +
        (ui.showAllRecords ? '只顯示最近幾筆' : '顯示全部 ' + allCount + ' 筆') + '</button>' : '') +
      '</section></main>' +
      '<div class="undo-bar"><button class="btn undo" data-action="undo"' + (last ? '' : ' disabled') + '>' +
      '↶ 撤銷上一筆' + (last ? '<small>' + h(last.name) + ' ' + signed(last.points) + '</small>' : '') +
      '</button></div>';
  }

  // ---------- 冒險（Phase 2） ----------
  /** 孩子任務頁最上方的冒險入口 */
  function adventureBanner(child) {
    var st = store.getAdventureStatus(child.id);
    if (st.settled) {
      var x = st.settlement;
      return '<section class="adv-banner is-settled" data-testid="adventure">' +
        '<span class="adv-icon">🗺️</span><div class="adv-text"><b>今日冒險已出發</b>' +
        '<small>今天得到 ⭐' + x.stars + ' 能量星星' + (x.bonusStars ? '（含額外 ⭐' + x.bonusStars + '）' : '') + '</small></div>' +
        '<a class="btn primary" href="#adventure-' + h(child.id) + '">進入冒險大廳</a></section>';
    }
    if (!st.unlocked) {
      return '<section class="adv-banner is-locked" data-testid="adventure">' +
        '<span class="adv-icon">🔒</span><div class="adv-text"><b>今日冒險尚未解鎖</b>' +
        '<small>今日淨得分 ' + signed(st.net) + '，大於 0 就能出發' + (st.previewBonus ? '・待發額外 ⭐' + st.previewBonus : '') + '</small></div>' +
        '<button class="btn" disabled>進入今日冒險</button></section>';
    }
    return '<section class="adv-banner is-ready" data-testid="adventure">' +
      '<span class="adv-icon">🔓</span><div class="adv-text"><b>今日冒險已解鎖！</b>' +
      '<small>現在出發可得 ⭐' + st.previewStars + (st.previewBonus ? '（今日 ⭐' + st.previewBase + '＋額外 ⭐' + st.previewBonus + '）' : '') + '</small></div>' +
      '<button class="btn primary" data-action="enter-adventure">進入今日冒險</button></section>';
  }

  var CHEST = ART.CHEST;

  var ISLANDS = [['金島', '#ffd23f'], ['木島', '#5cbf4a'], ['水島', '#3fb6e8'], ['火島', '#ff6a3d'], ['土島', '#b07a4a']];
  var DICE_COST = 5; // Phase 3 規格：6 面骰 5 星

  function renderAdventure(child) {
    var st = store.getAdventureStatus(child.id);
    var x = st.settlement;
    var kids = store.getChildren();

    // 1. Hero header
    var hero = '<header class="sky adv-hero"><span class="cloud c1"></span><span class="cloud c2"></span>' +
      '<a class="round-btn back" href="#child-' + h(child.id) + '" aria-label="回到今日任務">‹</a>' +
      '<div class="adv-hero-main">' + MASCOT + plaque('冒險大廳', '完成任務・累積星星・解鎖新冒險') + '</div>' +
      '<span class="float-island" aria-hidden="true">' + ART.FLOAT_CASTLE + '</span>' + gear() + '</header>';

    // 2. 角色切換 tab
    var tabs = '<nav class="hero-tabs" aria-label="切換孩子">' + kids.map(function (c) {
      var on = c.id === child.id;
      return '<a class="hero-tab ' + (on ? 'active' : '') + '" href="#adventure-' + h(c.id) + '" style="--c:' + h(c.color) + '"' + (on ? ' aria-current="true"' : '') + '>' +
        avatar(c, 'md') + '<span class="hero-tab-text"><b>' + (on ? '👑 ' : '') + h(c.name) + '</b>' +
        '<small>' + h((c.title ? c.title + ' ' : '') + 'Lv.' + store.getLevel(c.id).level) + '</small></span></a>';
    }).join('') + '</nav>';

    // 3. 夥伴＋能量星星主卡
    var bal = st.balance;
    var toNext = DICE_COST - (bal % DICE_COST);
    var hint = bal >= DICE_COST
      ? '可以換 ' + Math.floor(bal / DICE_COST) + ' 顆 6 面骰 🎲'
      : '再 <b>' + toNext + '</b> 顆星可以換一顆 6 面骰 🎲';
    var starCard = '<section class="star-card" style="--c:' + h(child.color) + '">' +
      '<button class="partner" data-action="pick-character" aria-label="選擇冒險夥伴"><span class="partner-ring">' + characterArt(child) + '</span>' +
      '<span class="partner-tag">' + h(characterName(child)) + ' ✎</span></button>' +
      '<div class="star-main"><span class="star-label">' + h(child.name) + '的能量星星</span>' +
      '<b class="star-value" data-testid="stars"><span class="big-star">⭐</span> ' + num(bal) + '</b>' +
      '<span class="star-hint">' + hint + '</span>' + progressBar(bal % DICE_COST, DICE_COST, 'star') + '</div>' +
      '<span class="chest-deco" aria-hidden="true"><small>快去收集吧！</small>' + CHEST + '</span></section>';

    // 4. 精簡結算摘要＋可展開紀錄
    var summary;
    if (x) {
      summary = '<div class="adv-status ok"><span class="sum-state"><i>✅</i>今日已結算</span>' +
        '<span class="sum-cell"><small>淨得分</small><b class="pos">' + signed(x.net) + '</b></span>' +
        '<span class="sum-cell"><small>獲得星星</small><b class="gold">⭐' + x.stars + '</b>' + (x.bonusStars ? '<small>含額外 ' + x.bonusStars + '</small>' : '') + '</span></div>';
    } else if (st.unlocked) {
      summary = '<div class="adv-status ready"><span class="sum-state"><i>🔓</i>今日冒險已解鎖</span>' +
        '<span class="sum-cell"><small>淨得分</small><b class="pos">' + signed(st.net) + '</b></span>' +
        '<span class="sum-cell"><small>可得星星</small><b class="gold">⭐' + st.previewStars + '</b></span>' +
        '<button class="btn primary sum-cta" data-action="enter-adventure">結算並出發</button></div>';
    } else {
      summary = '<div class="adv-status locked"><span class="sum-state"><i>🔒</i>今日冒險尚未解鎖</span>' +
        '<span class="sum-cell"><small>淨得分</small><b>' + signed(st.net) + '</b></span>' +
        '<span class="sum-note">大於 0 就能出發</span></div>';
    }
    var history = store.data.adventure.settlements.filter(function (s) { return s.childId === child.id; })
      .slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; }).slice(0, 14);
    var log = '<details class="settle-log" id="settle-log"' + (ui.logOpen ? ' open' : '') + '><summary>📜 查看結算紀錄 <span>' + history.length + ' 筆</span></summary>' +
      (history.length ? '<ul class="records">' + history.map(function (s) {
        return '<li class="rec"><span class="rec-time">' + h(dateLabel(s.date)) + '</span>' +
          '<span class="rec-name">淨得分 ' + signed(s.net) + (s.bonusStars ? ' <small class="tag tag-star">額外 ⭐' + s.bonusStars + '</small>' : '') + '</span>' +
          '<span class="pts star">⭐' + s.stars + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">還沒有結算紀錄</p>') + '</details>';

    // 5. 地圖關卡卡
    var map = '<section class="map-card">' +
      '<div class="map-art"><picture><source srcset="images/gold-island.webp" type="image/webp">' +
      '<img src="images/gold-island.jpg" alt="金島：齒輪、礦坑、礦車、金屬橋與發光礦石" width="1200" height="675" loading="lazy" decoding="async"></picture></div>' +
      '<div class="map-info">' +
      '<p>擲骰子、走格子、開寶箱！目前在第 ' + store.getPlayer(child.id).pos + ' / 30 格</p>' +
      (x ? '<span class="lock-pill open">🔓 今天可以玩</span>' : '<span class="lock-pill">🔒 先進入今日冒險</span>') +
      (x ? '<a class="btn primary map-cta" href="#map-' + h(child.id) + '">開始冒險 ›</a>'
        : '<button class="btn primary map-cta" disabled>開始冒險 ›</button>') + '</div>' +
      '<span class="compass" aria-hidden="true">🧭</span></section>' +
      '<div class="island-dots" aria-label="五座島">' + ISLANDS.map(function (is, i) {
        return '<span class="dot ' + (i === 0 ? 'active' : '') + '" style="--d:' + is[1] + '" title="' + is[0] + '"></span>';
      }).join('') + '</div>';

    // 6. 快速入口
    var quick = '<nav class="quick-row" aria-label="快速入口">' +
      '<a class="tile t-task" href="#child-' + h(child.id) + '"><span class="tile-icon">📋</span>今日任務</a>' +
      '<a class="tile t-challenge" href="#challenge-' + h(child.id) + '"><span class="tile-icon">🏆</span>挑戰</a>' +
      '<a class="tile t-shop" href="#shop-' + h(child.id) + '"><span class="tile-icon">🎁</span>兌換</a>' +
      '<button class="tile t-report" data-action="open-log"><span class="tile-icon">📜</span>結算紀錄</button></nav>';

    return hero + '<main class="page adventure">' + tabs + starCard + summary + log + map + quick + '</main>';
  }

  // ---------- 金島棋盤（Phase 3） ----------
  var GAME = window.CGPGame;
  function characterId(child) {
    var id = store.getPlayer(child.id).character;
    return GAME.CHARACTERS.some(function (c) { return c.id === id; }) ? id : GAME.DEFAULT_CHARACTER;
  }
  function charImg(id, cls) {
    var c = GAME.CHARACTERS.find(function (x) { return x.id === id; });
    return '<img class="' + (cls || 'char-img') + '" src="images/characters/' + id + '.webp" alt="' + h(c.name) + '" width="300" height="310" decoding="async">';
  }
  function characterArt(child) { return charImg(characterId(child)); }
  function characterName(child) {
    var id = characterId(child);
    return GAME.CHARACTERS.find(function (c) { return c.id === id; }).name;
  }

  /** 等角投影：格座標 → 螢幕座標 */
  var TW = 22, TH = 12.5, DEPTH = 7;
  function iso(gx, gy) { return { x: (gx - gy) * TW, y: (gx + gy) * TH }; }

  var TILE_STYLE = {
    start: { top: '#8be07a', side: '#4f9e44', icon: '🚩' },
    normal: { top: '#fff4d6', side: '#d8b77c', icon: '' },
    chest: { top: '#ffd75e', side: '#c99a12', icon: '🎁' },
    chance: { top: '#cdbbff', side: '#8b74f0', icon: '❓' },
    minigame: { top: '#a9dcff', side: '#4aa3f0', icon: '🎮' },
    end: { top: '#ff8a7a', side: '#c4372d', icon: '🏁' }
  };

  function boardSvg(board) {
    var tiles = board.tiles;
    var pts = tiles.map(function (t) { return iso(t.gx, t.gy); });
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    function P(gx, gy) { return iso(gx, gy); }
    // 地圖範圍：涵蓋整座島（含側面厚度）與上方的城堡、煙
    var corners = [P(-0.9, -1.2), P(9.9, -1.2), P(9.9, 9.9), P(-0.9, 9.9)];
    var cx = corners.map(function (p) { return p.x; }), cy = corners.map(function (p) { return p.y; });
    var minX = Math.min(Math.min.apply(null, cx), Math.min.apply(null, xs)) - 12, maxX = Math.max(Math.max.apply(null, cx), Math.max.apply(null, xs)) + 12;
    var minY = Math.min(Math.min.apply(null, cy), Math.min.apply(null, ys)) - 40, maxY = Math.max.apply(null, cy) + 26;
    var vb = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    // 島嶼地面：等角菱形
    var c1 = P(-0.9, -1.2), c2 = P(9.9, -1.2), c3 = P(9.9, 9.9), c4 = P(-0.9, 9.9);
    var g1 = P(-0.5, -0.8), g2 = P(9.5, -0.8), g3 = P(9.5, 9.5), g4 = P(-0.5, 9.5);
    function poly(a) { return a.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '); }
    var ground =
      '<polygon points="' + poly([c1, c2, c3, c4]) + '" fill="#8be6f5" opacity=".6" transform="translate(0 6) scale(1.04)" transform-origin="' + P(4.5, 4.4).x + ' ' + P(4.5, 4.4).y + '"/>' +
      '<polygon points="' + poly([c4, c3, { x: c3.x, y: c3.y + 14 }, { x: c4.x, y: c4.y + 14 }]) + '" fill="url(#bd-earth)"/>' +
      '<polygon points="' + poly([c2, c3, { x: c3.x, y: c3.y + 14 }, { x: c2.x, y: c2.y + 14 }]) + '" fill="#6e4a2e"/>' +
      '<polygon points="' + poly([c1, c2, c3, c4]) + '" fill="url(#bd-sand)" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>' +
      '<polygon points="' + poly([g1, g2, g3, g4]) + '" fill="url(#bd-grass)"/>';
    // 路徑連線
    var line = '<polyline points="' + poly(pts) + '" fill="none" stroke="#c99a5a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>';
    // 裝飾（依深度與格子一起排序）
    var D = ART.DECO, items = [];
    // 裝飾畫在格子下面，路徑永遠清楚可見；裝飾之間依深度排序
    function deco(gx, gy, svg) { var p = P(gx, gy); items.push({ d: -100 + gx + gy, svg: svg(p.x, p.y) }); }
    deco(4.2, 6.7, function (x, y) { return D.mine(x, y, 1); });
    deco(6.2, 6.8, function (x, y) { return D.cart(x, y, 0.9); });
    deco(5.4, 6.4, function (x, y) { return D.crystals(x, y, 0.9); });
    deco(3.4, 3.6, function (x, y) { return D.gear(x, y, 0.9); });
    deco(5.8, 3.4, function (x, y) { return D.factory(x, y, 0.9); });
    deco(4.6, 1.0, function (x, y) { return D.bridge(x, y, 0.8); });
    deco(0.1, 9.2, function (x, y) { return D.palm(x, y, 0.8); });
    deco(9.3, 6.4, function (x, y) { return D.palm(x, y, 0.75); });
    deco(0.0, 3.4, function (x, y) { return D.palm(x, y, 0.7); });
    deco(7.6, 7.0, function (x, y) { return D.crystals(x, y, 0.6); });
    deco(9.0, -0.6, function (x, y) { return D.castle(x, y, 0.62); });
    tiles.forEach(function (t, i) {
      var p = pts[i], st = TILE_STYLE[t.type];
      var top = poly([{ x: p.x, y: p.y - TH }, { x: p.x + TW, y: p.y }, { x: p.x, y: p.y + TH }, { x: p.x - TW, y: p.y }]);
      var left = poly([{ x: p.x - TW, y: p.y }, { x: p.x, y: p.y + TH }, { x: p.x, y: p.y + TH + DEPTH }, { x: p.x - TW, y: p.y + DEPTH }]);
      var right = poly([{ x: p.x + TW, y: p.y }, { x: p.x, y: p.y + TH }, { x: p.x, y: p.y + TH + DEPTH }, { x: p.x + TW, y: p.y + DEPTH }]);
      items.push({ d: t.gx + t.gy, svg: '<g class="tile-g" data-n="' + t.n + '">' +
        '<polygon points="' + left + '" fill="' + st.side + '"/><polygon points="' + right + '" fill="' + st.side + '" opacity=".8"/>' +
        '<polygon points="' + top + '" fill="' + st.top + '" stroke="#fff" stroke-width="1.5"/>' +
        (st.icon ? '<text x="' + p.x + '" y="' + (p.y - 2) + '" font-size="13" text-anchor="middle">' + st.icon + '</text>' : '') +
        '<text x="' + p.x + '" y="' + (p.y + (st.icon ? 8 : 4)) + '" font-size="' + (st.icon ? 7 : 9) + '" font-weight="900" text-anchor="middle" fill="#7d4519">' + (t.n === 0 ? '起點' : t.n) + '</text></g>' });
    });
    items.sort(function (a, b) { return a.d - b.d; });
    var svg = '<svg class="board-svg" viewBox="' + vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h + '" aria-label="金島地圖，共 ' + (tiles.length - 1) + ' 格">' +
      '<defs>' + ART.BOARD_DEFS + '</defs>' +
      '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h + '" fill="url(#bd-sea)"/>' +
      '<g stroke="#d4f3ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7">' +
      '<path d="M' + (vb.x + 16) + ' ' + (vb.y + vb.h - 18) + ' q8 -4 16 0 t16 0"/><path d="M' + (vb.x + vb.w - 60) + ' ' + (vb.y + 40) + ' q8 -4 16 0 t16 0"/></g>' +
      ground + line + items.map(function (it) { return it.svg; }).join('') + '</svg>';
    return { svg: svg, vb: vb, pts: pts };
  }

  /** 棋子在容器裡的百分比座標（站在格子頂面中心） */
  function pawnStyle(geo, n) {
    var p = geo.pts[n];
    return 'left:' + ((p.x - geo.vb.x) / geo.vb.w * 100).toFixed(2) + '%;top:' + ((p.y + 2 - geo.vb.y) / geo.vb.h * 100).toFixed(2) + '%';
  }

  function renderMap(child) {
    var player = store.getPlayer(child.id);
    var board = store.getBoard(child.id);
    var geo = boardSvg(board);
    var bag = player.bag;
    var canPlay = store.canPlayToday(child.id);
    var used = store.getRollsToday(child.id);
    var limit = GAME.DAILY_DICE_LIMIT;
    var end = board.tiles.length - 1;
    var atEnd = player.pos >= end;
    var noRolls = used >= limit;
    function act(kind, icon, label, count, disabled) {
      return '<button class="dice-btn ' + kind + '" data-action="' + (kind === 'skates' ? 'use-skates' : 'roll') + '" data-kind="' + kind + '"' +
        (disabled ? ' disabled' : '') + '><span class="dice-icon">' + icon + '</span><b>' + label + '</b><small>背包 ×' + count + '</small></button>';
    }
    var reason = !canPlay ? '🔒 今日冒險還沒出發，先回任務頁按「進入今日冒險」'
      : atEnd ? '🏁 已經抵達金島終點！下一座島即將開放'
        : noRolls ? '今天的 3 次骰子用完了，明天再來！（溜冰鞋還可以用）'
          : (!bag.d6 && !bag.d12 && !bag.skates ? '背包是空的，到 🛒 商店用能量星星購買骰子' : '選一個道具出發吧！');
    return pageHeader('金島', child, 'map') +
      '<main class="page map-page">' +
      '<section class="hud">' +
      '<span class="hud-cell"><small>能量星星</small><b class="gold" data-testid="stars">⭐ ' + num(store.getStarBalance(child.id)) + '</b></span>' +
      '<span class="hud-cell"><small>今日骰子</small><b data-testid="rolls">' + used + ' / ' + limit + '</b></span>' +
      '<span class="hud-cell"><small>位置</small><b data-testid="pos">' + player.pos + ' / ' + end + '</b></span>' +
      '<button class="btn small hud-shop" data-action="open-shop"' + (canPlay ? '' : ' disabled') + '>🛒 商店</button></section>' +
      '<section class="board-wrap">' + geo.svg +
      '<div class="pawn" id="pawn" data-pos="' + player.pos + '" style="' + pawnStyle(geo, player.pos) + '"><div class="pawn-inner">' + characterArt(child) + '</div></div>' +
      '<div class="dice-overlay" id="dice-overlay" hidden><div class="die-face" id="die-face">?</div></div>' +
      '</section>' +
      '<p class="map-hint">' + reason + '</p>' +
      '<section class="dice-bar">' +
      act('d6', '🎲', '6 面骰', bag.d6, !canPlay || atEnd || noRolls || !bag.d6) +
      act('d12', '🎯', '12 面骰', bag.d12, !canPlay || atEnd || noRolls || !bag.d12) +
      act('skates', '🛼', '溜冰鞋 +3', bag.skates, !canPlay || atEnd || !bag.skates) +
      '</section>' +
      '<div class="legend"><span>🎁 寶箱</span><span>❓ 機會</span><span>🎮 小遊戲（即將開放）</span><span>🏁 終點</span></div>' +
      '<a class="btn block" href="#adventure-' + h(child.id) + '">‹ 回冒險大廳</a>' +
      '</main>';
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** 棋子一格一格跳過去 */
  async function hopAlong(child, path) {
    var pawn = document.getElementById('pawn');
    if (!pawn) return;
    var geo = boardSvg(store.getBoard(child.id));
    for (var i = 0; i < path.length; i++) {
      pawn.setAttribute('style', pawnStyle(geo, path[i]));
      pawn.dataset.pos = path[i];
      pawn.classList.remove('hop'); void pawn.offsetWidth; pawn.classList.add('hop');
      await sleep(reduceMotion ? 60 : 330);
    }
    pawn.classList.remove('hop');
  }

  async function showDie(value, sides) {
    var ov = document.getElementById('dice-overlay'), face = document.getElementById('die-face');
    if (!ov) return;
    ov.hidden = false;
    face.classList.add('spin');
    var spins = reduceMotion ? 1 : 8;
    for (var i = 0; i < spins; i++) { face.textContent = 1 + Math.floor(Math.random() * sides); await sleep(70); }
    face.textContent = value;
    face.classList.remove('spin');
    await sleep(reduceMotion ? 150 : 550);
    ov.hidden = true;
  }

  function eventText(ev) {
    if (!ev || ev.type === 'normal' || ev.type === 'start') return '';
    var t = ev.title + '\n' + ev.text;
    if (ev.then) t += '\n\n' + eventText(ev.then);
    return t;
  }

  ui.busy = false;
  async function playMove(childId, kind) {
    if (ui.busy) return;
    var child = store.getChild(childId);
    var res;
    try { res = kind === 'skates' ? store.useSkates(childId) : store.rollDice(childId, kind); }
    catch (err) { toast(err.message, 'neg'); render(); return; }
    ui.busy = true;
    app.querySelectorAll('.dice-btn, .hud-shop').forEach(function (b) { b.disabled = true; });
    try {
      if (kind !== 'skates') await showDie(res.value, kind === 'd6' ? 6 : 12);
      else toast('🛼 溜冰鞋前進 3 格！', 'pos');
      await hopAlong(child, res.path);
      if (res.event && res.event.extraPath && res.event.extraPath.length) {
        toast('🚃 ' + res.event.text, 'pos');
        await sleep(400);
        await hopAlong(child, res.event.extraPath);
      }
    } finally { ui.busy = false; }
    render();
    var msg = eventText(res.event);
    var head = kind === 'skates' ? '🛼 前進 3 格' : '🎲 擲出 ' + res.value;
    if (msg) showInfo(head + '・停在第 ' + store.getPlayer(childId).pos + ' 格', msg);
    else toast(head + '，停在第 ' + store.getPlayer(childId).pos + ' 格');
  }

  /** 星星商店（對話框） */
  function openShop(childId) {
    function draw() {
      var bal = store.getStarBalance(childId);
      var bag = store.getPlayer(childId).bag;
      confirmEl.innerHTML = '<div class="confirm-box shop-box"><h2>🛒 星星商店</h2>' +
        '<p class="shop-bal">目前有 <b>⭐ ' + num(bal) + '</b></p>' +
        GAME.SHOP.map(function (it) {
          var ok = bal >= it.price;
          return '<div class="shop-row"><span class="shop-row-icon">' + it.icon + '</span>' +
            '<span class="shop-row-main"><b>' + h(it.name) + '</b><small>' + h(it.desc) + '・背包 ×' + bag[it.id] + '</small></span>' +
            '<button class="btn ' + (ok ? 'primary' : '') + ' small" data-buy="' + it.id + '"' + (ok ? '' : ' disabled') + '>⭐' + it.price + '</button></div>';
        }).join('') +
        '<p class="muted small">買來的道具放進背包，沒用完隔天仍然保留。每天最多擲 3 次骰子。</p>' +
        '<div class="modal-actions"><button type="button" class="btn" data-no>完成</button></div></div>';
      confirmEl.querySelectorAll('[data-buy]').forEach(function (b) {
        b.onclick = function () {
          try { var it = store.buyItem(childId, b.getAttribute('data-buy')); toast('買到 ' + it.icon + ' ' + it.name + '！', 'pos'); }
          catch (err) { toast(err.message, 'neg'); }
          draw();
        };
      });
      confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); render(); };
    }
    draw();
    confirmEl.oncancel = function () { render(); };
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
  }

  /** 選擇冒險夥伴（測試角色 3 種） */
  function openCharacterPicker(childId) {
    var child = store.getChild(childId);
    var cur = characterId(child);
    confirmEl.innerHTML = '<div class="confirm-box"><h2>選擇 ' + h(child.name) + ' 的冒險夥伴</h2><div class="char-pick">' +
      GAME.CHARACTERS.map(function (c) {
        return '<button class="char-opt ' + (c.id === cur ? 'active' : '') + '" data-char="' + c.id + '" data-name="' + h(c.name) + '">' + charImg(c.id) +
          '<b>' + h(c.icon + ' ' + c.name) + '</b><small>' + h(c.trait) + '</small></button>';
      }).join('') + '</div><p class="muted small">每個孩子各自選擇，隨時可以更換。</p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-no>取消</button></div></div>';
    confirmEl.querySelectorAll('[data-char]').forEach(function (b) {
      b.onclick = function () { store.setCharacter(childId, b.getAttribute('data-char')); confirmEl.close(); toast('已選擇 ' + b.getAttribute('data-name'), 'pos'); render(); };
    });
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
  }

  function enterAdventure(childId) {
    var st = store.getAdventureStatus(childId);
    if (st.settled) { go('#adventure-' + childId); return; }
    askConfirm('現在出發會用今日淨得分 ' + signed(st.net) + ' 結算，得到 ⭐' + st.previewStars + ' 能量星星。\n' +
      '結算後，今天再加的分不會再增加星星（一天只結算一次）。\n確定要出發嗎？', '出發！', false).then(function (ok) {
      if (!ok) return;
      try {
        var x = store.settleToday(childId);
        toast('🎉 得到 ⭐' + x.stars + ' 能量星星！', 'pos');
        go('#adventure-' + childId);
      } catch (err) { toast(err.message, 'neg'); render(); }
    });
  }

  function renderChallenge(child) {
    var range = window.CGPReport.periodRange('week', store.today());
    var list = store.getChallengesFor(child.id);
    var wn = store.getWeekNet(child.id);
    var goal = child.weeklyGoal > 0
      ? '<section class="panel goal-panel"><h2>🎯 本週目標</h2><div class="goal-big"><b>' + num(Math.max(0, wn)) + '</b> / ' + num(child.weeklyGoal) + ' 點</div>' +
        progressBar(wn, child.weeklyGoal, 'big') +
        '<p class="muted small">' + (wn >= child.weeklyGoal ? '🎉 本週目標達成！' : '還差 ' + num(child.weeklyGoal - wn) + ' 點') + '</p></section>'
      : '';
    var cards = list.length ? list.map(function (ch) {
      var st = store.getChallengeStatus(child.id, ch);
      var item = ch.itemId ? store.getItem(ch.itemId) : null;
      var unit = ch.metric === 'net' ? ' 點' : (item && item.kind === 'task' ? ' 天' : ' 次');
      var reward = (ch.rewardPoints ? '+' + ch.rewardPoints + ' 點' : '') + (ch.rewardStars ? ' ⭐' + ch.rewardStars : '');
      var btn = st.claimed ? '<span class="claimed">✓ 已領取</span>'
        : st.done ? '<button class="btn primary claim" data-action="claim" data-id="' + h(ch.id) + '">🎁 領取 ' + h(reward) + '</button>'
          : '<span class="muted small">還差 ' + (st.target - Math.max(0, st.progress)) + unit + '</span>';
      return '<div class="challenge ' + (st.claimed ? 'is-claimed' : st.done ? 'is-done' : '') + '">' +
        '<div class="ch-head"><span class="ch-icon">' + (st.claimed ? '🏅' : st.done ? '🎉' : '🏆') + '</span>' +
        '<div class="ch-main"><b>' + h(ch.name) + '</b><small class="muted">' +
        (ch.metric === 'net' ? '本週淨得分' : '「' + h(item ? item.name : '（規則已刪除）') + '」') + '・獎勵 ' + h(reward || '無') + '</small></div></div>' +
        '<div class="ch-progress">' + progressBar(st.progress, st.target) + '<span class="ch-val">' + Math.max(0, Math.min(st.progress, st.target)) + '/' + st.target + unit + '</span></div>' +
        '<div class="ch-foot">' + btn + '</div></div>';
    }).join('') : '<div class="empty card"><p class="big-emoji">🏆</p><p>還沒有本週挑戰</p><a class="btn primary" href="#rules-challenge">到設定新增挑戰</a></div>';
    return pageHeader('本週挑戰', child, 'challenge') +
      '<main class="page">' + summaryCard(child) + goal +
      '<section class="panel"><h2>🏆 本週挑戰 <small>' + h(range.label) + '</small></h2><div class="challenges">' + cards + '</div>' +
      '<p class="muted small">每週一重新開始。達成後按「領取」，獎勵會記成一筆加分。</p></section></main>';
  }

  function renderShop(child) {
    var total = store.getTotal(child.id);
    var rewards = store.getRewards().slice().sort(function (a, b) { return a.cost - b.cost; });
    var cards = rewards.length ? '<div class="shop-grid">' + rewards.map(function (r) {
      var ok = total >= r.cost;
      return '<div class="shop-item ' + (ok ? 'can' : '') + '"><span class="shop-icon">🎁</span><b class="shop-name">' + h(r.name) + '</b>' +
        '<span class="shop-cost"><i class="coin" aria-hidden="true">點</i>' + num(r.cost) + ' 點</span>' +
        (ok ? '<button class="btn primary small" data-action="redeem" data-id="' + h(r.id) + '">兌換</button>'
          : progressBar(total, r.cost) + '<small class="muted">還差 ' + num(r.cost - total) + ' 點</small>') + '</div>';
    }).join('') + '</div>' : '<div class="empty card"><p class="big-emoji">🎁</p><p>還沒有獎勵</p><a class="btn primary" href="#rules-reward">到設定新增獎勵</a></div>';
    var history = store.getRecords(child.id).filter(function (r) { return r.type === 'reward'; }).slice(0, 20);
    var histHtml = history.length ? '<ul class="records">' + history.map(function (r) {
      return '<li class="rec" data-action="edit-record" data-id="' + h(r.id) + '" role="button" tabindex="0"><span class="rec-time">' + h(dateLabel(r.date)) + '</span>' +
        '<span class="rec-name">🎁 ' + h(r.name) + '</span><span class="pts neg">' + signed(r.points) + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted small">還沒有兌換紀錄</p>';
    return pageHeader('獎勵兌換', child, 'shop') +
      '<main class="page">' +
      '<section class="wallet" style="--c:' + h(child.color) + '">' + avatar(child, 'md') +
      '<div><div class="label">' + h(child.name) + ' 可以用的點數</div><div class="wallet-value" data-testid="total"><i class="coin" aria-hidden="true">點</i>' + num(total) + '</div></div></section>' +
      '<section class="panel"><h2>🎁 可兌換的獎勵</h2>' + cards +
      '<p class="muted small">兌換會扣除總點數，不影響今日淨得分與等級。</p></section>' +
      '<section class="panel"><h2>🧾 兌換紀錄</h2>' + histHtml + '</section></main>';
  }

  /** 每日任務按鈕（一天一次打勾，再點一次取消） */
  function taskButton(t) {
    var s = t.status;
    var cls = s.doneToday ? 'done' : (s.canComplete ? '' : 'locked');
    return '<button class="task ' + cls + '" data-action="task" data-id="' + h(t.task.id) + '"' +
      (!s.doneToday && !s.canComplete ? ' disabled' : '') + '>' +
      '<span class="check" aria-hidden="true">' + (s.doneToday ? '✓' : '') + '</span>' +
      '<span class="task-name">' + h(t.task.name) +
      (s.label ? '<small>' + h(s.label) + '</small>' : '') + '</span>' +
      '<span class="pts pos">' + h(ptsLabel(t.task)) + '</span></button>';
  }

  /** 孩子頁的加減分清單（搜尋與篩選時只重畫這一塊，輸入框不會失去焦點） */
  function renderScoreList(childId) {
    var bonus = store.getItemsFor(childId, 'bonus');
    var penalty = store.getItemsFor(childId, 'penalty');
    if (!bonus.length && !penalty.length && !store.getItemsFor(childId, 'task').length) return '<p class="muted small">尚未設定加分或扣分項目，可到設定頁新增</p>';

    function btns(items) {
      return '<div class="grid">' + items.map(function (i) {
        return '<button class="score-btn ' + i.kind + '" data-action="record" data-id="' + h(i.id) + '">' +
          '<span class="score-name">' + h(i.name) + '</span>' +
          '<span class="score-pts">' + h(ptsLabel(i)) + '</span></button>';
      }).join('') + '</div>';
    }
    function grouped(items) {
      var groups = groupByPoints(items);
      if (groups.length === 1) return btns(groups[0].items);
      return groups.map(function (g) {
        return '<div class="pts-group"><div class="pts-head ' + ptsKeyClass(g.key, g.kind) + '">' + ptsKeyLabel(g.key) +
          '<span>' + g.items.length + ' 項</span></div>' + btns(g.items) + '</div>';
      }).join('');
    }

    // 搜尋模式：同時搜尋加分與扣分
    if (ui.query.trim()) {
      var found = bonus.concat(penalty).filter(function (i) { return matchQuery(i.name, ui.query); });
      var foundTasks = store.getTodayTasks(childId).filter(function (t) { return matchQuery(t.task.name, ui.query); });
      if (!found.length && !foundTasks.length) return '<p class="muted small search-empty">找不到「' + h(ui.query.trim()) + '」相關的規定</p>';
      return '<p class="muted small">搜尋結果 ' + (found.length + foundTasks.length) + ' 項</p>' +
        (foundTasks.length ? '<div class="pts-group"><div class="pts-head pos">📋 每日任務</div><div class="tasks">' + foundTasks.map(taskButton).join('') + '</div></div>' : '') +
        (found.length ? grouped(found) : '');
    }

    var kind = ui.scoreKind === 'penalty' ? 'penalty' : 'bonus';
    var items = kind === 'bonus' ? bonus : penalty;
    var values = groupByPoints(items).map(function (g) { return g.key; });
    if (values.indexOf(ui.scorePoints) < 0) ui.scorePoints = null;
    var shown = ui.scorePoints == null ? items : items.filter(function (i) { return ptsKey(i) === ui.scorePoints; });

    var seg = '<div class="seg" role="tablist">' +
      '<button class="seg-btn bonus ' + (kind === 'bonus' ? 'active' : '') + '" data-action="score-kind" data-kind="bonus" role="tab" aria-selected="' + (kind === 'bonus') + '">👍 加分 <small>' + bonus.length + '</small></button>' +
      '<button class="seg-btn penalty ' + (kind === 'penalty' ? 'active' : '') + '" data-action="score-kind" data-kind="penalty" role="tab" aria-selected="' + (kind === 'penalty') + '">⚠️ 扣分 <small>' + penalty.length + '</small></button>' +
      '</div>';
    var chips = values.length > 1 ? '<div class="pts-chips">' +
      '<button class="pts-chip ' + (ui.scorePoints == null ? 'active' : '') + '" data-action="score-points" data-points="">全部</button>' +
      values.map(function (v) {
        return '<button class="pts-chip ' + kind + ' ' + (ui.scorePoints === v ? 'active' : '') + '" data-action="score-points" data-points="' + v + '">' + ptsKeyLabel(v) + '</button>';
      }).join('') + '</div>' : '';

    var list = items.length ? grouped(shown)
      : '<p class="muted small">尚未設定' + (kind === 'bonus' ? '加分' : '扣分') + '項目，可到設定頁新增</p>';
    return seg + chips + list;
  }

  function updateScoreList() {
    var el = document.getElementById('score-list');
    var childId = route().arg;
    if (el && childId) el.innerHTML = renderScoreList(childId);
  }

  function groupByDate(records) {
    var groups = [];
    records.forEach(function (r) {
      var g = groups[groups.length - 1];
      if (!g || g.date !== r.date) { g = { date: r.date, items: [] }; groups.push(g); }
      g.items.push(r);
    });
    return groups;
  }

  /** 紀錄列（點一下可修改）；showChild 時在前面顯示孩子頭像 */
  function recordRow(r, showChild) {
    var tag = { bonus: '加分', penalty: '扣分', task: '每日任務', reward: '兌換' }[r.type];
    var child = showChild ? store.getChild(r.childId) : null;
    return '<li class="rec" data-action="edit-record" data-id="' + h(r.id) + '" role="button" tabindex="0">' +
      (child ? avatar(child, 'xs') : '') +
      '<span class="rec-time">' + (r.backfill ? '補登' : timeOf(r.ts)) + '</span>' +
      '<span class="rec-name">' + (r.type === 'reward' ? '🎁 ' : '') + h(r.name) +
      ' <small class="tag tag-' + r.type + '">' + tag + '</small>' +
      (r.stars ? ' <small class="tag tag-star">⭐' + r.stars + '</small>' : '') + '</span>' +
      '<span class="pts ' + signClass(r.points) + '">' + signed(r.points) + '</span></li>';
  }

  // ---------- 記分總覽 ----------
  function renderReport() {
    var R = window.CGPReport;
    var rp = ui.report;
    var children = store.getChildren();
    if (rp.childId !== 'all' && !store.getChild(rp.childId)) rp.childId = 'all';
    var range = R.periodRange(rp.period, rp.anchor);
    var today = store.today();
    var isCurrent = range.start <= today && today <= range.end;
    var picked = rp.childId === 'all' ? children : [store.getChild(rp.childId)];
    var cid = rp.childId === 'all' ? null : rp.childId;

    var chips = '<div class="pts-chips">' +
      '<button class="pts-chip ' + (rp.childId === 'all' ? 'active' : '') + '" data-action="report-child" data-id="all">全部</button>' +
      children.map(function (c) {
        return '<button class="pts-chip ' + (rp.childId === c.id ? 'active' : '') + '" data-action="report-child" data-id="' + h(c.id) + '">' + h(c.avatar + ' ' + c.name) + '</button>';
      }).join('') + '</div>';
    var seg = '<div class="seg seg3">' + [['day', '日'], ['week', '週'], ['month', '月']].map(function (x) {
      return '<button class="seg-btn ' + (rp.period === x[0] ? 'active' : '') + '" data-action="report-period" data-kind="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var nav = '<div class="period-nav">' +
      '<button class="icon-btn" data-action="report-nav" data-kind="' + range.prev + '" aria-label="上一期">‹</button>' +
      '<div class="period-label"><b>' + h(range.label) + '</b>' +
      (isCurrent ? '' : '<button class="btn link small" data-action="report-nav" data-kind="' + today + '">回到' + ({ day: '今天', week: '本週', month: '本月' }[rp.period]) + '</button>') + '</div>' +
      '<button class="icon-btn" data-action="report-nav" data-kind="' + range.next + '" aria-label="下一期"' + (range.next > today ? ' disabled' : '') + '>›</button></div>';

    // 統計卡
    var cards = picked.map(function (c) {
      var s = R.summarize(store, c.id, range.start, range.end);
      function cell(label, v, cls) { return '<div class="stat"><span>' + label + '</span><b class="' + cls + '">' + v + '</b></div>'; }
      return '<div class="stat-card"><div class="stat-head">' + avatar(c, 'sm') + '<b>' + h(c.name) + '</b>' +
        '<span class="muted small">目前 ' + num(store.getTotal(c.id)) + ' 點</span></div>' +
        '<div class="stat-grid">' +
        cell('淨得分', signed(s.net), signClass(s.net) + ' big') +
        cell('加分', signed(s.bonus), 'pos') +
        cell('扣分', String(s.penalty), s.penalty ? 'neg' : 'zero') +
        cell('兌換', s.reward ? '-' + s.reward : '0', s.reward ? 'neg' : 'zero') +
        cell('⭐ 星星', String(s.stars), 'zero') +
        cell('記分天數', s.days + ' 天', 'zero') +
        '</div></div>';
    }).join('');

    // 規則排行
    function rankList(kind) {
      var rows = R.ranking(store, cid, range.start, range.end, kind, 5);
      if (!rows.length) return '<p class="muted small">沒有紀錄</p>';
      return '<ol class="rank">' + rows.map(function (x) {
        return '<li><span class="rank-name">' + h(x.name) + '</span><span class="muted small">' + x.count + ' 次</span>' +
          '<b class="' + signClass(x.points) + '">' + signed(x.points) + '</b></li>';
      }).join('') + '</ol>';
    }
    var rank = '<div class="rank-wrap"><div><h3 class="pos">👍 加分最多</h3>' + rankList('bonus') + '</div>' +
      '<div><h3 class="neg">⚠️ 扣分最多</h3>' + rankList('penalty') + '</div></div>';

    // 任務完成率
    var comp = picked.map(function (c) {
      var rows = R.taskCompletion(store, c.id, range.start, range.end);
      return '<div class="comp-child">' + (picked.length > 1 ? '<div class="stat-head">' + avatar(c, 'xs') + '<b>' + h(c.name) + '</b></div>' : '') +
        (rows.length ? '<ul class="comp">' + rows.map(function (x) {
          var pct = x.rate == null ? 0 : Math.round(x.rate * 100);
          return '<li><span class="comp-name">' + h(x.task.name) + '</span><span class="comp-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="comp-val">' + h(x.label) + '</span></li>';
        }).join('') + '</ul>' : '<p class="muted small">這段期間沒有每日任務</p>') + '</div>';
    }).join('');

    // 每日明細
    var recs = store.getRecordsBetween(cid, range.start, range.end);
    var detail = recs.length ? '<ul class="records">' + groupByDate(recs).map(function (g) {
      var net = g.items.reduce(function (sum, r) { return r.type === 'reward' ? sum : sum + r.points; }, 0);
      return '<li class="rec-date"><span>' + h(dateLabel(g.date)) + '</span>' +
        (cid ? '<span class="' + signClass(net) + '">當日 ' + signed(net) + '</span>' : '') + '</li>' +
        g.items.map(function (r) { return recordRow(r, !cid); }).join('');
    }).join('') + '</ul>' : '<p class="muted small">這段期間沒有紀錄</p>';

    return sky('<a class="icon-btn back" href="#home" aria-label="回首頁">‹</a>' + plaque('記分總覽') + gear(), true) +
      '<main class="page report">' +
      '<div class="report-controls">' + chips + seg + nav + '</div>' +
      '<section><h2>📈 統計</h2><div class="stat-cards">' + cards + '</div></section>' +
      '<section><h2>🏆 規則排行</h2>' + rank + '</section>' +
      '<section><h2>✅ 每日任務完成率</h2>' + comp + '</section>' +
      '<section><div class="section-head"><h2>🗓️ 每日明細</h2>' +
      '<button class="btn small primary" data-action="backfill">＋ 補登</button></div>' +
      '<p class="muted small">點任何一筆可以修改點數、日期、孩子或刪除。</p>' + detail + '</section>' +
      '</main>';
  }

  function renderSettings(tab) {
    var tabs = SETTINGS_TABS.map(function (t) {
      return '<a class="tab ' + (t[0] === tab ? 'active' : '') + '" href="#rules-' + t[0] + '">' + t[1] + '</a>';
    }).join('');
    var body;
    if (tab === 'children') body = settingsChildren();
    else if (tab === 'reward') body = settingsRewards();
    else if (tab === 'challenge') body = settingsChallenges();
    else if (tab === 'backup') body = settingsBackup();
    else if (tab === 'task') { tab = 'bonus'; body = settingsItems('bonus'); } // 舊網址相容
    else if (KIND_LABELS[tab]) body = settingsItems(tab);
    else body = settingsChildren();

    return '<header class="topbar">' +
      '<a class="icon-btn" href="#home" aria-label="回首頁">‹</a>' +
      '<h1>計分規則設定</h1><span class="icon-btn"></span></header>' +
      '<nav class="tabs">' + tabs + '</nav>' +
      '<main class="page">' + body + '</main>';
  }

  function settingsChildren() {
    var list = store.getChildren().map(function (c) {
      return '<li class="row">' + avatar(c, 'sm') +
        '<span class="row-main"><b>' + h(c.name) + ' ' + (c.badge ? h(c.badge) : '') + '</b><small>' + h((c.title ? c.title + ' ' : '') + 'Lv.' + store.getLevel(c.id).level) +
        '・目前 ' + num(store.getTotal(c.id)) + ' 點' + (c.weeklyGoal ? '・每週目標 ' + num(c.weeklyGoal) : '') + '・起始 ' + c.startPoints + '</small></span>' +
        '<button class="btn small" data-action="edit-child" data-id="' + h(c.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-child" data-id="' + h(c.id) + '">刪除</button></li>';
    }).join('');
    return '<ul class="rows">' + (list || '<li class="muted">還沒有孩子</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-child">＋ 新增孩子</button>';
  }

  function settingsItems(kind) {
    var hint = kind === 'bonus'
      ? '勾選「📋 每日任務」的加分項目會放在孩子頁最上方的常用區，一天打勾一次（可設每日、平日、週末、指定星期、每週 N 次或單次）。每個孩子的完成狀態各自獨立。'
      : (kind === 'penalty' ? '扣分項目輸入正數即可，系統會自動以負數記錄。' : '');
    var count = itemsForTab(kind).length;
    return (hint ? '<p class="muted small">' + hint + '</p>' : '') +
      (count > 5 ? '<input type="search" id="settings-search" class="search" data-search="settings" placeholder="🔍 搜尋' + KIND_LABELS[kind] + '" ' +
        'autocomplete="off" value="' + h(ui.settingsQuery) + '">' : '') +
      '<div id="settings-list">' + settingsItemList(kind) + '</div>' +
      '<button class="btn primary block" data-action="add-item" data-kind="' + kind + '">＋ 新增' + KIND_LABELS[kind] + '</button>';
  }

  /** 設定頁「加分」分頁同時列出一般加分與每日任務 */
  function itemsForTab(kind) {
    return kind === 'bonus' ? store.getItems('task').concat(store.getItems('bonus')) : store.getItems(kind);
  }

  function settingsItemList(kind) {
    var all = itemsForTab(kind);
    if (!all.length) return '<ul class="rows"><li class="muted">尚未建立</li></ul>';
    var items = all.filter(function (i) { return matchQuery(i.name, ui.settingsQuery); });
    if (!items.length) return '<ul class="rows"><li class="muted">找不到「' + h(ui.settingsQuery.trim()) + '」</li></ul>';
    items.sort(function (a, b) {
      var ta = a.kind === 'task' ? 0 : 1, tb = b.kind === 'task' ? 0 : 1;
      return ta - tb || (ta ? byPoints(a, b) : 0);
    });
    var lastPts = null;
    var list = items.map(function (i) {
      var isTask = i.kind === 'task';
      var meta = childIdsText(i.childIds) + (isTask ? '・📋 ' + freqText(i.frequency) : '');
      var head = '';
      var key = isTask ? 'task' : ptsKey(i);
      if (key !== lastPts) {
        lastPts = key;
        head = '<li class="rows-head ' + (isTask ? 'pos' : ptsKeyClass(key, i.kind)) + '">' + (isTask ? '📋 每日任務' : ptsKeyLabel(key)) + '</li>';
      }
      key = ptsKey(i);
      return head + '<li class="row"><span class="row-main"><b>' + h(i.name) +
        ' <span class="pts ' + ptsKeyClass(key, i.kind) + '">' + h(ptsLabel(i)) + '</span></b>' +
        '<small>' + h(meta) + '</small></span>' +
        '<button class="btn small" data-action="edit-item" data-id="' + h(i.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-item" data-id="' + h(i.id) + '">刪除</button></li>';
    }).join('');
    return '<ul class="rows">' + list + '</ul>';
  }

  function settingsChallenges() {
    var list = store.getChallenges().map(function (ch) {
      var item = ch.itemId ? store.getItem(ch.itemId) : null;
      var what = ch.metric === 'net' ? '本週淨得分達 ' + ch.target + ' 點' : '「' + (item ? item.name : '規則已刪除') + '」' + ch.target + (item && item.kind === 'task' ? ' 天' : ' 次');
      var reward = (ch.rewardPoints ? '+' + ch.rewardPoints + ' 點' : '') + (ch.rewardStars ? ' ⭐' + ch.rewardStars : '');
      return '<li class="row"><span class="row-main"><b>🏆 ' + h(ch.name) + '</b><small>' + h(what + '・獎勵 ' + (reward || '無') + '・' + childIdsText(ch.childIds)) + '</small></span>' +
        '<button class="btn small" data-action="edit-challenge" data-id="' + h(ch.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-challenge" data-id="' + h(ch.id) + '">刪除</button></li>';
    }).join('');
    return '<p class="muted small">每週一重新計算。孩子達成後，在「挑戰」分頁按「領取」，獎勵會記成一筆加分。</p>' +
      '<ul class="rows">' + (list || '<li class="muted">尚未建立</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-challenge">＋ 新增挑戰</button>';
  }

  function openChallengeForm(ch) {
    var c = ch || { name: '', childIds: 'all', metric: 'item', itemId: null, target: 3, rewardPoints: 20, rewardStars: 0 };
    var opts = [['task', '📋 每日任務（以天數計）'], ['bonus', '加分（以次數計）']].map(function (k) {
      var items = store.getItems(k[0]).slice().sort(byPoints);
      if (!items.length) return '';
      return '<optgroup label="' + k[1] + '">' + items.map(function (i) {
        return '<option value="' + h(i.id) + '"' + (i.id === c.itemId ? ' selected' : '') + '>' + h(i.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    var fields =
      '<label class="field">挑戰名稱<input type="text" name="name" maxlength="30" required placeholder="例如：本週主動幫忙 3 次" value="' + h(c.name) + '"></label>' +
      '<label class="field">挑戰類型<select name="metric">' +
      '<option value="item"' + (c.metric === 'item' ? ' selected' : '') + '>某條規則本週達成 N 次／天</option>' +
      '<option value="net"' + (c.metric === 'net' ? ' selected' : '') + '>本週淨得分達到 N 點</option></select></label>' +
      '<label class="field" data-show-when="metric=item">要達成的規則<select name="itemId">' + opts + '</select></label>' +
      '<label class="field">目標 N<input type="number" name="target" min="1" step="1" inputmode="numeric" required value="' + c.target + '"></label>' +
      '<label class="field">獎勵點數<input type="number" name="rewardPoints" min="0" step="1" inputmode="numeric" value="' + c.rewardPoints + '"></label>' +
      '<label class="field">獎勵能量星星<input type="number" name="rewardStars" min="0" step="1" inputmode="numeric" value="' + c.rewardStars + '">' +
      '<small class="muted">Phase 1 只記錄，冒險功能推出後才會發放。</small></label>' +
      childPicker(c.childIds);
    openModal(ch ? '編輯挑戰' : '新增挑戰', fields, function (fd) {
      var data = {
        name: fd.get('name'), metric: fd.get('metric'), itemId: fd.get('itemId') || null,
        target: fd.get('target'), rewardPoints: fd.get('rewardPoints'), rewardStars: fd.get('rewardStars'),
        childIds: fd.get('scope') === 'all' ? 'all' : fd.getAll('childIds')
      };
      if (ch) store.updateChallenge(ch.id, data);
      else store.addChallenge(data);
      toast('已儲存');
    });
    syncConditional();
  }

  /** 首頁大按鈕：先選孩子再進入 */
  function pickChild(tab) {
    var kids = store.getChildren();
    if (kids.length === 1) { go('#' + tab + '-' + kids[0].id); return; }
    var title = { child: '今日任務', challenge: '本週挑戰', shop: '獎勵兌換' }[tab];
    confirmEl.innerHTML = '<div class="confirm-box"><h2>' + h(title) + '：要看誰的？</h2><div class="pick-kids">' +
      kids.map(function (c) {
        return '<a class="pick-kid" href="#' + tab + '-' + h(c.id) + '" style="--c:' + h(c.color) + '">' + avatar(c, 'lg') + '<b>' + h(c.name) + '</b></a>';
      }).join('') + '</div><div class="modal-actions"><button type="button" class="btn" data-no>取消</button></div></div>';
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.querySelectorAll('.pick-kid').forEach(function (a) { a.onclick = function () { confirmEl.close(); }; });
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
  }

  function settingsRewards() {
    var list = store.getRewards().map(function (r) {
      return '<li class="row"><span class="row-main"><b>🎁 ' + h(r.name) + '</b><small>需要 ' + r.cost + ' 點</small></span>' +
        '<button class="btn small" data-action="edit-reward" data-id="' + h(r.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-reward" data-id="' + h(r.id) + '">刪除</button></li>';
    }).join('');
    return '<ul class="rows">' + (list || '<li class="muted">尚未建立</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-reward">＋ 新增獎勵</button>';
  }

  function settingsBackup() {
    var d = store.data;
    return '<div class="card">' +
      '<h2>📤 匯出備份</h2><p class="muted small">下載包含所有孩子、規則、獎勵與紀錄的 JSON 檔。</p>' +
      '<button class="btn primary block" data-action="export">匯出 JSON</button></div>' +
      '<div class="card"><h2>📋 匯入規則表（CSV／JSON）</h2>' +
      '<p class="muted small">用 Excel 或 Google 試算表整理規則，存成 CSV 後在這裡匯入。' +
      '<b>點數紀錄全部保留</b>；已有的規則會依「規則ID」更新分數、頻率、適用孩子，新的規則會新增。' +
      '孩子依名稱對應。檔案裡沒有的規則不會被刪除。</p>' +
      '<label class="btn primary block file-btn">選擇 CSV 或 JSON 檔<input type="file" accept=".csv,text/csv,application/json,.json,text/plain" data-action="import-rules" hidden></label></div>' +
      '<div class="card"><h2>📥 完整還原</h2>' +
      '<p class="muted small">用備份檔<b>取代</b>目前所有資料（含紀錄），建議先匯出備份。</p>' +
      '<label class="btn block file-btn">選擇備份 JSON 檔<input type="file" accept="application/json,.json" data-action="import" hidden></label></div>' +
      '<p class="muted small center">App 版本：' + APP_VERSION + '</p>' +
      '<p class="muted small center">目前資料：' + d.children.length + ' 位孩子・' + d.items.length + ' 個規則・' +
      d.rewards.length + ' 個獎勵・' + d.records.length + ' 筆紀錄</p>';
  }

  // ---------- 表單 ----------
  function openModal(title, fieldsHtml, onSubmit, submitLabel) {
    modalForm.innerHTML = '<h2>' + h(title) + '</h2>' + fieldsHtml +
      '<p class="form-error" hidden></p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-close>取消</button>' +
      '<button type="submit" class="btn primary">' + h(submitLabel || '儲存') + '</button></div>';
    modalForm.onsubmit = function (e) {
      e.preventDefault();
      try {
        onSubmit(new FormData(modalForm));
        modal.close();
        render();
      } catch (err) {
        var p = modalForm.querySelector('.form-error');
        p.textContent = err.message;
        p.hidden = false;
      }
    };
    modalForm.querySelector('[data-close]').onclick = function () { modal.close(); };
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    var first = modalForm.querySelector('input[type=text]');
    if (first && !('ontouchstart' in window)) first.focus();
  }

  function openChildForm(child) {
    var c = child || { name: '', avatar: AVATARS[store.getChildren().length % AVATARS.length], color: COLORS[store.getChildren().length % COLORS.length], startPoints: 0, title: '', badge: '', weeklyGoal: 0 };
    var fields =
      '<label class="field">名稱<input type="text" name="name" maxlength="20" required value="' + h(c.name) + '"></label>' +
      '<fieldset class="field"><legend>頭像</legend><div class="pick">' + AVATARS.map(function (a) {
        return '<label class="pick-item"><input type="radio" name="avatar" value="' + a + '"' + (a === c.avatar ? ' checked' : '') + '><span>' + a + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<fieldset class="field"><legend>代表色</legend><div class="pick">' + COLORS.map(function (col) {
        return '<label class="pick-item color"><input type="radio" name="color" value="' + col + '"' + (col === c.color ? ' checked' : '') + '><span style="background:' + col + '"></span></label>';
      }).join('') + '</div></fieldset>' +
      '<label class="field">頭銜<input type="text" name="title" maxlength="12" placeholder="例如：小小店長、小小工程師" value="' + h(c.title || '') + '">' +
      '<small class="muted">會和等級一起顯示，例如「小小店長 Lv.5」。等級依累積加分自動升級。</small></label>' +
      '<fieldset class="field"><legend>代表圖示</legend><div class="pick">' +
      '<label class="pick-item"><input type="radio" name="badge" value=""' + (!c.badge ? ' checked' : '') + '><span class="none">無</span></label>' +
      BADGES.map(function (b) {
        return '<label class="pick-item"><input type="radio" name="badge" value="' + b + '"' + (b === c.badge ? ' checked' : '') + '><span>' + b + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<label class="field">每週目標點數<input type="number" name="weeklyGoal" min="0" step="10" inputmode="numeric" value="' + (c.weeklyGoal || 0) + '">' +
      '<small class="muted">以本週（週一～週日）淨得分計算，0 表示不設定。</small></label>' +
      '<label class="field">起始點數<input type="number" name="startPoints" inputmode="numeric" step="1" value="' + c.startPoints + '">' +
      '<small class="muted">起始點數會加入總點數，但不算今日得分與等級。</small></label>';
    openModal(child ? '編輯孩子' : '新增孩子', fields, function (fd) {
      var data = { name: fd.get('name'), avatar: fd.get('avatar'), color: fd.get('color'), startPoints: fd.get('startPoints'),
        title: fd.get('title'), badge: fd.get('badge') || '', weeklyGoal: fd.get('weeklyGoal') };
      if (child) store.updateChild(child.id, data);
      else store.addChild(data);
      toast(child ? '已更新' : '已新增 ' + String(data.name).trim());
    });
  }

  function childPicker(ids) {
    var children = store.getChildren();
    var all = ids === 'all';
    return '<fieldset class="field"><legend>適用孩子</legend>' +
      '<label class="radio"><input type="radio" name="scope" value="all"' + (all ? ' checked' : '') + '> 全部孩子（含之後新增）</label>' +
      '<label class="radio"><input type="radio" name="scope" value="some"' + (all ? '' : ' checked') + '> 指定孩子</label>' +
      '<div class="pick-children" data-show-when="scope=some">' +
      (children.length ? children.map(function (c) {
        var on = !all && ids.indexOf(c.id) >= 0;
        return '<label class="chip"><input type="checkbox" name="childIds" value="' + h(c.id) + '"' + (on ? ' checked' : '') + '> ' + h(c.avatar + ' ' + c.name) + '</label>';
      }).join('') : '<span class="muted small">尚未新增孩子</span>') +
      '</div></fieldset>';
  }

  function freqPicker(f) {
    f = f || { type: 'daily' };
    var days = f.days || [1, 2, 3, 4, 5];
    return '<label class="field">頻率<select name="freqType">' +
      Object.keys(FREQ_LABELS).map(function (k) {
        return '<option value="' + k + '"' + (k === f.type ? ' selected' : '') + '>' + FREQ_LABELS[k] + '</option>';
      }).join('') + '</select></label>' +
      '<fieldset class="field" data-show-when="freqType=days"><legend>指定星期</legend><div class="pick">' +
      [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        return '<label class="chip"><input type="checkbox" name="days" value="' + d + '"' + (days.indexOf(d) >= 0 ? ' checked' : '') + '> ' + WEEKDAYS[d] + '</label>';
      }).join('') + '</div></fieldset>' +
      '<label class="field" data-show-when="freqType=weeklyN">每週次數<input type="number" name="n" min="1" max="7" inputmode="numeric" value="' + (f.n || 3) + '">' +
      '<small class="muted">每天最多完成一次，本週達到次數後就不再出現可勾選。</small></label>';
  }

  function syncConditional() {
    modalForm.querySelectorAll('[data-show-when]').forEach(function (el) {
      var p = el.getAttribute('data-show-when').split('=');
      var ctl = modalForm.elements[p[0]];
      var val = !ctl ? '' : (ctl.type === 'checkbox' ? (ctl.checked ? ctl.value : '') : (ctl.value !== undefined ? ctl.value : ''));
      el.hidden = val !== p[1];
    });
  }
  modalForm.addEventListener('change', syncConditional);

  /** 新增或編輯加分／扣分項目；加分可勾選「每日任務」（內部 kind 為 task） */
  function openItemForm(kind, item) {
    var base = kind === 'penalty' ? 'penalty' : 'bonus';
    var isTask = kind === 'task';
    var it = item || { name: '', points: base === 'penalty' ? -5 : 5, childIds: 'all', frequency: { type: 'daily' }, custom: false, stars: 0 };
    var fields =
      '<label class="field">名稱<input type="text" name="name" maxlength="40" required value="' + h(it.name) + '"></label>' +
      '<label class="field">' + (base === 'penalty' ? '扣除點數' : '點數') +
      '<input type="number" name="points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(it.points) + '"></label>' +
      (base === 'bonus' ? '<label class="radio daily-toggle"><input type="checkbox" name="daily" id="item-daily" value="1"' + (isTask ? ' checked' : '') + '> 📋 每日任務（放在常用區，一天打勾一次）</label>' +
        '<div class="field-group" data-show-when="daily=1">' + freqPicker(it.frequency) + '</div>' : '') +
      '<label class="radio" data-show-when="daily="><input type="checkbox" name="custom" value="1"' + (it.custom ? ' checked' : '') + '> 每次由家長自填點數（上方數字為預設值）</label>' +
      '<label class="field">額外能量星星<input type="number" name="stars" min="0" step="1" inputmode="numeric" value="' + (it.stars || 0) + '">' +
      '<small class="muted">Phase 1 只記錄，冒險功能（Phase 2）推出後才會發放。</small></label>' +
      childPicker(it.childIds);
    openModal((item ? '編輯' : '新增') + KIND_LABELS[base], fields, function (fd) {
      var scope = fd.get('scope');
      var daily = base === 'bonus' && fd.get('daily') === '1';
      var newKind = daily ? 'task' : base;
      var data = {
        kind: newKind,
        name: fd.get('name'),
        points: fd.get('points'),
        custom: !daily && fd.get('custom') === '1',
        stars: fd.get('stars'),
        childIds: scope === 'all' ? 'all' : fd.getAll('childIds')
      };
      if (daily) {
        data.frequency = {
          type: fd.get('freqType'),
          days: fd.getAll('days').map(Number),
          n: fd.get('n')
        };
        if (data.frequency.type === 'days' && !data.frequency.days.length) throw new Error('請至少選擇一個星期');
      }
      if (item) store.updateItem(item.id, data);
      else store.addItem(data);
      toast('已儲存');
    });
    syncConditional();
  }

  /** 自填點數：輸入後記錄 */
  function openCustomPoints(childId, item) {
    var fields = '<p class="muted small">' + h(store.getChild(childId).name) + '・' + (item.kind === 'penalty' ? '扣分' : '加分') + '</p>' +
      '<label class="field">' + (item.kind === 'penalty' ? '要扣幾點？' : '要加幾點？') +
      '<input type="number" name="points" id="custom-points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(item.points) + '"></label>';
    openModal(item.name, fields, function (fd) {
      var rec = store.recordItem(childId, item.id, fd.get('points'));
      ui.query = '';
      ui.pulse = true;
      toast(recText(rec), rec.points < 0 ? 'neg' : 'pos');
    }, '記錄');
    var input = document.getElementById('custom-points');
    input.focus();
    input.select();
  }

  /** 修改或刪除一筆紀錄 */
  function openRecordForm(rec) {
    var typeLabel = { bonus: '加分', penalty: '扣分', task: '加分・每日任務', reward: '兌換獎勵' }[rec.type];
    var neg = rec.type === 'penalty' || rec.type === 'reward';
    var fields =
      '<p class="muted small">' + typeLabel + (rec.backfill ? '・補登' : '・記錄於 ' + timeOf(rec.ts)) + (rec.stars ? '・⭐' + rec.stars : '') + '</p>' +
      '<label class="field">孩子<select name="childId" id="rec-child">' + store.getChildren().map(function (c) {
        return '<option value="' + h(c.id) + '"' + (c.id === rec.childId ? ' selected' : '') + '>' + h(c.avatar + ' ' + c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">日期<input type="date" name="date" id="rec-date" max="' + store.today() + '" required value="' + rec.date + '"></label>' +
      '<label class="field">' + (neg ? (rec.type === 'reward' ? '扣除點數' : '扣除點數') : '點數') +
      '<input type="number" name="points" id="rec-points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(rec.points) + '"></label>' +
      '<button type="button" class="btn danger block" id="rec-delete">🗑 刪除這筆紀錄</button>';
    openModal(rec.name, fields, function (fd) {
      store.updateRecord(rec.id, { childId: fd.get('childId'), date: fd.get('date'), points: fd.get('points') });
      toast('已更正：' + rec.name, 'pos');
    });
    document.getElementById('rec-delete').onclick = function () {
      modal.close();
      confirmThen('確定刪除「' + rec.name + ' ' + signed(rec.points) + '」這筆紀錄？\n總點數會一起更新。', '刪除', true, function () {
        store.deleteRecord(rec.id);
        toast('已刪除紀錄');
      });
    };
  }

  /** 補登過去日期 */
  function openBackfill() {
    var children = store.getChildren();
    var rp = ui.report;
    var childId = rp.childId !== 'all' ? rp.childId : children[0].id;
    var today = store.today();
    var defDate = rp.period === 'day' ? rp.anchor : window.CGPReport.addDays(today, -1);
    if (defDate > today) defDate = today;
    function ruleOptions(cid) {
      return [['task', '📋 每日任務（加分）'], ['bonus', '加分'], ['penalty', '扣分']].map(function (k) {
        var items = store.getItemsFor(cid, k[0]).slice().sort(byPoints);
        if (!items.length) return '';
        return '<optgroup label="' + k[1] + '">' + items.map(function (i) {
          return '<option value="' + h(i.id) + '">' + h(i.name + '（' + (i.custom ? '自填' : signed(i.points)) + '）') + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
    }
    var fields =
      '<label class="field">孩子<select name="childId" id="bf-child">' + children.map(function (c) {
        return '<option value="' + h(c.id) + '"' + (c.id === childId ? ' selected' : '') + '>' + h(c.avatar + ' ' + c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">日期<input type="date" name="date" id="bf-date" max="' + today + '" required value="' + defDate + '"></label>' +
      '<label class="field">規則<select name="itemId" id="bf-item">' + ruleOptions(childId) + '</select></label>' +
      '<label class="field">點數<input type="number" name="points" id="bf-points" min="0" step="1" inputmode="numeric"></label>';
    openModal('補登紀錄', fields, function (fd) {
      if (!fd.get('itemId')) throw new Error('請選擇規則');
      var rec = store.addRecordOn(fd.get('childId'), fd.get('itemId'), fd.get('date'), fd.get('points'));
      toast('已補登 ' + dateLabel(rec.date) + '：' + recText(rec), 'pos');
    }, '補登');
    var childSel = document.getElementById('bf-child');
    var itemSel = document.getElementById('bf-item');
    var pts = document.getElementById('bf-points');
    function syncPoints() {
      var it = store.getItem(itemSel.value);
      pts.value = it && !it.custom ? Math.abs(it.points) : '';
      pts.placeholder = it && it.custom ? '自填點數' : '';
    }
    childSel.onchange = function () { itemSel.innerHTML = ruleOptions(childSel.value); syncPoints(); };
    itemSel.onchange = syncPoints;
    syncPoints();
  }

  function openRewardForm(reward) {
    var r = reward || { name: '', cost: 30 };
    var fields =
      '<label class="field">獎勵名稱<input type="text" name="name" maxlength="30" required value="' + h(r.name) + '"></label>' +
      '<label class="field">所需生活點數<input type="number" name="cost" min="0" step="1" inputmode="numeric" required value="' + r.cost + '"></label>';
    openModal(reward ? '編輯獎勵' : '新增獎勵', fields, function (fd) {
      var data = { name: fd.get('name'), cost: fd.get('cost') };
      if (reward) store.updateReward(reward.id, data);
      else store.addReward(data);
      toast('已儲存');
    });
  }

  // ---------- 匯出匯入 ----------
  function exportData() {
    var blob = new Blob([store.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'child-points-backup-' + store.today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已匯出備份');
  }

  /** 讀取文字檔：先試 UTF-8，失敗時改用 Big5（Excel 中文版預設存檔編碼） */
  function readTextFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var buf = reader.result;
      var text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) {
        try { text = new TextDecoder('big5').decode(buf); }
        catch (e2) { text = new TextDecoder('utf-8').decode(buf); }
      }
      cb(text);
    };
    reader.readAsArrayBuffer(file);
  }

  /** 匯入規則（JSON 或 CSV）：新增＋更新，保留紀錄 */
  function importRules(file) {
    readTextFile(file, function (text) {
      var warnings = [];
      try {
        var isCsv = /\.csv$/i.test(file.name) || !/^\s*[\[{]/.test(text.replace(/^\uFEFF/, ''));
        var input = text;
        if (isCsv) {
          var conv = window.CGPCsv.csvToRules(text);
          input = conv.data;
          warnings = conv.warnings;
        }
        var r = store.mergeRules(input);
        var lines = [];
        lines.push('新增 ' + r.itemsAdded + ' 條、更新 ' + r.itemsUpdated + ' 條、沒變 ' + r.itemsUnchanged + ' 條規則');
        if (r.itemsSkipped) lines.push('略過 ' + r.itemsSkipped + ' 條（找不到適用的孩子）');
        if (r.rewardsAdded || r.rewardsUpdated) lines.push('獎勵：新增 ' + r.rewardsAdded + ' 個、更新 ' + r.rewardsUpdated + ' 個');
        if (r.childrenAdded.length) lines.push('新增孩子：' + r.childrenAdded.join('、') + '（名稱和 App 裡不同時會新增，請確認）');
        lines.push('點數紀錄全部保留。');
        if (warnings.length) lines.push('', '⚠️ 請檢查：', warnings.join('\n'));
        render();
        showInfo('匯入完成', lines.join('\n'));
      } catch (e) {
        showInfo('匯入失敗', e.message + (warnings.length ? '\n\n' + warnings.join('\n') : ''));
      }
    });
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      askConfirm('確定要用「' + file.name + '」取代目前所有資料嗎？', '匯入並取代', true).then(function (ok) {
        if (!ok) return;
        try {
          store.importJSON(String(reader.result));
          toast('匯入完成', 'pos');
          render();
        } catch (e) {
          toast('匯入失敗：' + e.message, 'neg');
        }
      });
    };
    reader.readAsText(file);
  }

  // ---------- 事件 ----------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    var childId = route().arg;
    try {
      switch (action) {
        case 'open-child':
          ui.showAllRecords = false; ui.query = ''; ui.scorePoints = null;
          go('#child-' + id);
          break;
        case 'score-kind':
          ui.scoreKind = el.getAttribute('data-kind'); ui.scorePoints = null;
          updateScoreList();
          break;
        case 'score-points': {
          var pv = el.getAttribute('data-points');
          ui.scorePoints = pv === '' ? null : (pv === 'custom' ? 'custom' : Number(pv));
          updateScoreList();
          break;
        }
        case 'add-child': openChildForm(); break;
        case 'record': {
          var recItem = store.getItem(id);
          if (recItem && recItem.custom) { openCustomPoints(childId, recItem); break; }
          var rec = store.recordItem(childId, id);
          ui.query = ''; // 記錄後清除搜尋，方便下一筆
          ui.pulse = true;
          toast(recText(rec), rec.points < 0 ? 'neg' : 'pos');
          render();
          break;
        }
        case 'task': {
          var task = store.getItem(id);
          var st = store.getTaskStatus(childId, task);
          if (st.doneToday) {
            store.uncompleteTask(childId, id);
            toast('已取消「' + task.name + '」');
          } else {
            var tr = store.completeTask(childId, id);
            toast('完成 ' + recText(tr), 'pos');
          }
          ui.pulse = true;
          render();
          break;
        }
        case 'undo': {
          var undone = store.undoLast(childId);
          if (undone) toast('已撤銷：' + undone.name + ' ' + signed(undone.points));
          ui.pulse = true;
          render();
          break;
        }
        case 'redeem': {
          var reward = store.getReward(id);
          var child = store.getChild(childId);
          confirmThen('讓 ' + child.name + ' 用 ' + reward.cost + ' 點兌換「' + reward.name + '」？', '兌換', false, function () {
            store.redeemReward(childId, id);
            toast('已兌換 ' + reward.name, 'pos');
            ui.pulse = true;
          });
          break;
        }
        case 'toggle-history': ui.showAllRecords = !ui.showAllRecords; render(); break;
        case 'edit-child': openChildForm(store.getChild(id)); break;
        case 'delete-child': {
          var c = store.getChild(id);
          confirmThen('確定刪除「' + c.name + '」？\n此孩子的所有紀錄也會一起刪除，且無法復原。', '刪除', true, function () {
            store.deleteChild(id);
            toast('已刪除');
          });
          break;
        }
        case 'add-item': openItemForm(el.getAttribute('data-kind')); break;
        case 'edit-item': { var it = store.getItem(id); openItemForm(it.kind, it); break; }
        case 'delete-item': {
          var item = store.getItem(id);
          confirmThen('確定刪除「' + item.name + '」？\n過去的紀錄會保留。', '刪除', true, function () { store.deleteItem(id); });
          break;
        }
        case 'add-reward': openRewardForm(); break;
        case 'edit-reward': openRewardForm(store.getReward(id)); break;
        case 'delete-reward': {
          var rw = store.getReward(id);
          confirmThen('確定刪除獎勵「' + rw.name + '」？\n過去的兌換紀錄會保留。', '刪除', true, function () { store.deleteReward(id); });
          break;
        }
        case 'export': exportData(); break;
        case 'pick-child': pickChild(el.getAttribute('data-kind')); break;
        case 'enter-adventure': enterAdventure(childId); break;
        case 'roll': playMove(childId, el.getAttribute('data-kind')); break;
        case 'use-skates': playMove(childId, 'skates'); break;
        case 'open-shop': openShop(childId); break;
        case 'pick-character': openCharacterPicker(childId); break;
        case 'open-log': {
          ui.logOpen = true;
          var lg = document.getElementById('settle-log');
          if (lg) { lg.open = true; lg.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
          break;
        }
        case 'claim': {
          var cr = store.claimChallenge(childId, id);
          toast('🎉 挑戰達成！' + recText(cr), 'pos');
          render();
          break;
        }
        case 'add-challenge': openChallengeForm(); break;
        case 'edit-challenge': openChallengeForm(store.getChallenge(id)); break;
        case 'delete-challenge': {
          var dc = store.getChallenge(id);
          confirmThen('確定刪除挑戰「' + dc.name + '」？\n已領取的獎勵紀錄會保留。', '刪除', true, function () { store.deleteChallenge(id); });
          break;
        }
        case 'edit-record': { var er = store.getRecord(id); if (er) openRecordForm(er); break; }
        case 'backfill': openBackfill(); break;
        case 'report-child': ui.report.childId = id; render(); break;
        case 'report-period': ui.report.period = el.getAttribute('data-kind'); render(); break;
        case 'report-nav': ui.report.anchor = el.getAttribute('data-kind'); render(); break;
      }
    } catch (err) {
      toast(err.message, 'neg');
      render();
    }
  });

  // 記住冒險大廳「結算紀錄」展開狀態（toggle 事件不冒泡，用捕獲）
  app.addEventListener('toggle', function (e) {
    if (e.target.id === 'settle-log') ui.logOpen = e.target.open;
  }, true);

  app.addEventListener('input', function (e) {
    var kind = e.target.getAttribute && e.target.getAttribute('data-search');
    if (kind === 'score') { ui.query = e.target.value; updateScoreList(); }
    else if (kind === 'settings') {
      ui.settingsQuery = e.target.value;
      var el = document.getElementById('settings-list');
      var tab = route().arg;
      if (el && KIND_LABELS[tab]) el.innerHTML = settingsItemList(tab);
    }
  });

  app.addEventListener('change', function (e) {
    if (e.target.matches('[data-action="import"]') && e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    } else if (e.target.matches('[data-action="import-rules"]') && e.target.files[0]) {
      importRules(e.target.files[0]);
      e.target.value = '';
    }
  });

  window.addEventListener('hashchange', function () {
    if (modal.open) modal.close();
    ui.settingsQuery = '';
    render();
    window.scrollTo(0, 0);
  });

  // 其他分頁修改資料時同步
  window.addEventListener('storage', function (e) {
    if (e.key === CGP.STORAGE_KEY) { store.reload(); render(); }
  });

  // 跨日自動更新「今日」
  function checkDay() {
    var t = store.today();
    if (t !== ui.lastDate) { ui.lastDate = t; render(); }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 30000);

  // 離線功能：每次打開都檢查新版；新版接手後自動重新載入一次
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      }).catch(function () { /* 離線功能非必要 */ });
    });
  }

  // 測試與除錯用
  window.__cgpStore = store;

  render();
})();
