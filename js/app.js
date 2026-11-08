/* 親子集點 — 介面層（Phase 1） */
(function () {
  'use strict';

  var CGP = window.CGP;
  /** 每次發布更新時修改，方便在「設定 → 備份」確認手機上是不是新版 */
  var APP_VERSION = '2026.11.08-62';
  var store;
  try {
    store = new CGP.Store();
    store.snapReady.then(function () { if (route().name === 'settings') render(); });   // 自動備份清單載入後更新設定頁
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<p class="fatal">無法讀取本機儲存空間：' + String(e.message) + '</p>';
    return;
  }

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
    ['penalty', '扣分'], ['challenge', '挑戰'], ['reward', '獎勵'], ['blessing', '神諭祝福'], ['backup', '備份']
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
    if (hs === 'minigame-test') return { name: 'minigame-test', arg: null }; // 家長試玩小遊戲（不給星星、不算次數）
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
    toastEl.className = 'toast ' + (kind || '') + (msg.indexOf('\n') >= 0 || msg.length > 28 ? ' multi' : '');   // 多行提示用圓角方框，不擠成一團
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
    var m = rec.milestone || {};
    return rec.name + p + (rec.stars ? ' ⭐' + rec.stars : '') +
      (m.keys ? '・🎉 累計得分里程碑：得到 🔑 黃金鑰匙' + (m.keys > 1 ? ' ×' + m.keys : '') : '') +
      (m.chests ? '・🎁 地圖上會出現神秘寶箱' : '');
  }

  function avatar(child, size) {
    // 頭像 = 孩子選的冒險夥伴
    return '<span class="avatar ' + (size || '') + '" style="--c:' + h(child.color) + '">' +
      '<img src="images/characters/' + h(charIdOf(child)) + '.webp" data-char="' + h(charIdOf(child)) + '" alt="" width="300" height="310" decoding="async"></span>';
  }
  function charIdOf(child) {
    return CGP.CHARACTER_IDS.indexOf(child.avatar) >= 0 ? child.avatar : CGP.CHARACTER_IDS[0];
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
    var html, homeFresh = null;
    if (r.name === 'child' || r.name === 'challenge' || r.name === 'shop' || r.name === 'adventure' || r.name === 'map') {
      var child = store.getChild(r.arg);
      if (!child) { location.replace('#home'); return; }
      setCurrent(child.id);
      if (r.name === 'map' && store.canPlayToday(child.id)) store.placeMapChests(child.id);   // 下次冒險時神秘寶箱出現在前方
      var freshAch = document.getElementById('clear-screen') ? [] : store.checkAchievements(child.id);   // 先檢查成就，畫面才會顯示最新狀態
      html = r.name === 'child' ? renderChild(child) : r.name === 'challenge' ? renderChallenge(child)
        : r.name === 'shop' ? renderShop(child) : r.name === 'map' ? renderMap(child) : renderAdventure(child);
    } else if (r.name === 'settings') {
      html = store.isParentUnlocked() && ui.pinMode !== 'reset' ? renderSettings(r.arg || 'children') : renderPinGate();
    } else if (r.name === 'report') {
      html = renderReport();
    } else {
      var homeFresh = store.getChildren().map(function (c) { return { child: c, list: store.checkAchievements(c.id) }; });   // 首頁成就欄顯示最新狀態
      html = renderHome();
    }
    if (r.name !== 'map') ui.doorPick = null;
    if (r.name !== 'settings') {
      if (store.isParentUnlocked()) store.lockParent();   // 離開設定就上鎖
      ui.pinMode = null;
      html += bottomNav(r.name === 'adventure' || r.name === 'map' ? 'child' : r.name);
    }
    app.innerHTML = html;
    app.dataset.view = r.name;
    alignHeroLinks();
    var notes = [];   // 同時有多則提示時合併顯示，避免互相蓋掉
    if (r.name === 'map') {
      setupMap(store.getChild(r.arg));
      pawnIdle();
      if (store.takeChestHint(r.arg)) notes.push('✨ 附近似乎藏著神秘寶物……');
    }
    if (r.name === 'minigame-test') openMinigame(null, null, { practice: true });
    if (r.name === 'adventure') showBlessings(r.arg);
    if (notes.length) toast(notes.join('\n'), 'pos');
    // 新解鎖的成就：星光成就劇場（已先寫入存檔，動畫中斷不影響）
    if (freshAch && freshAch.length) showAchTheater(child, freshAch);
    if (homeFresh) homeFresh.forEach(function (x) { if (x.list.length) showAchTheater(x.child, x.list); });
    if (r.name === 'settings') {
      var pi = app.querySelector('#pin-1'); if (pi) pi.focus();
      var at = app.querySelector('.tabs .tab.active'); if (at && at.parentNode.scrollTo) at.parentNode.scrollTo({ left: at.offsetLeft - 40 });   // 分頁多：目前分頁捲進畫面
    }
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
  /** 漂浮城堡＝設定按鈕（取代齒輪） */
  function gear(cls) {
    return '<a class="hero-link castle-link ' + (cls || 'gear') + '" href="#rules" aria-label="設定">' + ART.FLOAT_CASTLE + '<span class="hero-label">設定</span></a>';
  }
  /** 機器貓按鈕：在首頁時到冒險大廳，其他頁回首頁 */
  function mascotLink(onHome) {
    var c = currentChild() || store.getChildren()[0];
    var href = onHome ? (c ? '#adventure-' + c.id : '#home') : '#home';
    var label = onHome ? (c ? '冒險大廳' : '首頁') : '首頁';
    return '<a class="hero-link mascot-link" href="' + href + '" aria-label="' + (onHome ? label : '回首頁') + '">' + MASCOT + '<span class="hero-label">' + label + '</span></a>';
  }
  /** 右上角城堡（設定）和左上角機器貓對稱：同樣高度、同樣上緣、離右邊的距離＝機器貓離左邊的距離 */
  function alignHeroLinks() {
    var m = app.querySelector('.mascot-link img'), c = app.querySelector('.sky .castle-link');
    if (!m || !c) return;
    var sky = c.offsetParent || c.parentNode, sr = sky.getBoundingClientRect(), mr = m.getBoundingClientRect();
    if (!mr.height) return;
    var ci = c.querySelector('img, svg'), ratio = ci && ci.getAttribute('width') ? ci.getAttribute('width') / ci.getAttribute('height') : 242 / 256;
    var w = mr.height * ratio;
    c.style.width = w.toFixed(2) + 'px';
    c.style.top = (mr.top - sr.top).toFixed(2) + 'px';
    c.style.right = (mr.left - sr.left).toFixed(2) + 'px';
    var ml = app.querySelector('.mascot-link .hero-label'), cl = c.querySelector('.hero-label');
    if (ml && cl) { var cs = getComputedStyle(ml); cl.style.marginTop = cs.marginTop; cl.style.fontSize = cs.fontSize; }
    // 小孩頁面的「新增孩子」按鈕：和城堡中心對齊（在城堡正下方）
    var ak = app.querySelector('.add-kid');
    if (ak) {
      ak.style.marginRight = '';
      var ar = ak.getBoundingClientRect(), cr = c.getBoundingClientRect();
      var d = (ar.left + ar.right) / 2 - (cr.left + cr.right) / 2;
      if (Math.abs(d) > 0.5) ak.style.marginRight = d.toFixed(2) + 'px';
    }
    // 標題牌不可蓋到城堡：不夠寬時加大右側留白
    var hero = app.querySelector('.hero'), pl = hero && hero.querySelector('.plaque');
    if (hero && pl) {
      hero.style.paddingRight = '';
      var over = pl.getBoundingClientRect().right - (sr.right - (mr.left - sr.left) - w) + 4;
      if (over > 0) hero.style.paddingRight = (parseFloat(getComputedStyle(hero).paddingRight) + over) + 'px';
    }
  }
  function plaque(title, sub) {
    return '<div class="plaque"><h1>' + h(title) + '</h1>' + (sub ? '<div class="ribbon">' + sub.split('・').map(function (t, i, arr) {
      // 只在「・」後面換行，避免把詞拆開
      return '<span class="nb">' + h(t) + (i < arr.length - 1 ? '・' : '') + '</span>';
    }).join('') + '</div>' : '') + '</div>';
  }

  /** 子頁面頂部：標題木牌＋孩子切換 */
  function pageHeader(title, child, tab) {
    var kids = store.getChildren();
    var sw = kids.length > 1 ? '<nav class="kid-switch' + (kids.length >= 4 ? ' many' : '') + '" aria-label="切換孩子">' + kids.map(function (c) {
      return '<a class="kid ' + (c.id === child.id ? 'active' : '') + '" href="#' + tab + '-' + h(c.id) + '" style="--c:' + h(c.color) + '">' +
        avatar(c, 'xs') + '<span class="kid-name">' + h(c.name) + '</span></a>';
    }).join('') + '</nav>' : '';
    // 小孩頁面：設定城堡下方放小的「新增孩子」按鈕（圖示＋文字），和切換孩子同一列靠右
    var add = tab === 'child' ? '<button type="button" class="add-kid" data-action="add-child" aria-label="新增孩子">' +
      '<span class="add-kid-icon" aria-hidden="true">🧒<i>＋</i></span><span>新增孩子</span></button>' : '';
    var row = sw || add ? '<div class="kid-row">' + (sw || '<span class="kid-row-fill"></span>') + add + '</div>' : '';
    return sky(mascotLink(false) + plaque(title) + gear() + row, true);   // 機器貓取代「‹」：回首頁
  }

  var NAV = [['home', '🏠', '首頁'], ['child', '📋', '小孩'], ['challenge', '🏆', '挑戰'], ['shop', '🎁', '兌換'], ['report', '📊', '紀錄']];
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
      '<button class="tile t-task" data-action="pick-child" data-kind="child"><span class="tile-icon">📋</span>小孩' + (left ? '<span class="badge-num">' + left + '</span>' : '') + '</button>' +
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
      }).join('') : '<p class="muted small">到設定 → 孩子，設定「每週目標點數」就會在這裡顯示進度。</p>') +
      specialReminder(children) +
      '</section>' : '';

    return sky('<div class="hero">' + mascotLink(true) + plaque('親子集點冒險', '完成任務・累積點數・解鎖獎勵') + '</div>' + gear('island')) +
      '<main class="page home">' +
      (children.length
        ? '<div class="child-list">' + cards + '</div>'
        : '<div class="empty card"><p class="big-emoji">👋</p><p><b>還沒有孩子資料</b></p><p class="muted">先新增孩子，就可以開始記錄生活積分。</p></div>') +
      storageWarning() + tiles + homeAchievements(children) + week + backupReminder() +
      (children.length ? '' : '<button class="btn add-child" data-action="add-child">＋ 新增孩子</button>') +   // 有孩子後改在小孩頁面右上角新增
      '</main>';
  }

  /** 首頁：手機儲存空間不足（存不進去）或接近上限時警告 */
  function storageWarning() {
    if (store.storageError) {
      return '<section class="storage-warn error" data-testid="storage-warn"><b>⚠️ 資料存不進手機了！</b>' +
        '<small>手機瀏覽器的儲存空間已滿，最近的紀錄可能沒有存到。請立刻匯出備份，並聯絡協助整理資料。</small>' +
        '<button class="btn primary small" data-action="export">立即匯出備份</button></section>';
    }
    if (store.storageNearFull) {
      return '<section class="storage-warn" data-testid="storage-warn"><b>💾 資料量快到手機上限了（約 ' + Math.round(store.storageUsed / 52429) + '%）</b>' +
        '<small>請先匯出備份；之後可以考慮清理很久以前的紀錄。</small>' +
        '<button class="btn small" data-action="export">匯出備份</button></section>';
    }
    return '';
  }

  /** 首頁：超過 7 天沒匯出備份時提醒（匯出不改資料，不需家長密碼） */
  function backupReminder() {
    var b = store.getBackupStatus();
    if (!b.due) return '';
    return '<section class="backup-remind" data-testid="backup-remind"><span class="br-icon">💾</span>' +
      '<span class="br-main"><b>' + (b.never ? '還沒有備份過資料' : '已經 ' + b.days + ' 天沒有備份了') + '</b>' +
      '<small>資料只存在這支手機，換手機或清除瀏覽器資料會不見。匯出 JSON 後存到雲端硬碟或電腦。</small></span>' +
      '<span class="br-acts"><button class="btn primary small" data-action="export">立即匯出</button>' +
      '<button class="btn link small" data-action="snooze-backup">明天再提醒</button></span></section>';
  }

  /** 首頁：還沒完成的特殊任務提醒（點一下到該孩子的任務頁） */
  function specialReminder(children) {
    var rows = children.map(function (c) {
      var list = store.getSpecialTasks(c.id).filter(function (t) { return t.status === 'active'; });
      if (!list.length) return '';
      var last = list.map(function (t) { return t.endDate; }).sort()[0];
      return '<button class="special-remind" data-action="open-child" data-id="' + h(c.id) + '">' + avatar(c, 'sm') +
        '<span><b>' + h(c.name) + '：🔮 特殊任務 ' + list.length + ' 項</b><small>' + list.map(function (t) { return t.icon + ' ' + h(t.name); }).join('、') +
        '<br>最早 ' + shortDate(last) + ' 到期，完成各 +' + list[0].points + ' 點</small></span><i>›</i></button>';
    }).join('');
    return rows ? '<div class="special-reminders" data-testid="special-remind">' + rows + '</div>' : '';
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

    return pageHeader('小孩', child, 'child') +
      '<main class="page has-undo">' +
      adventureBanner(child) +
      summaryCard(child) +
      specialPanel(child) +
      '<section class="panel"><h2>📌 常用・今日任務' + (tasks.length ? ' <small>' + doneCount + '/' + tasks.length + '</small>' : '') + '</h2><div class="tasks">' + taskHtml + '</div></section>' +
      '<section class="panel scorer"><h2>✏️ 加分・扣分</h2>' +
      '<input type="search" id="score-search" class="search" data-search="score" placeholder="🔍 搜尋規定，例如：功課" ' +
      'autocomplete="off" enterkeyhint="search" value="' + h(ui.query) + '">' +
      '<div id="score-list">' + renderScoreList(id) + '</div></section>' +
      achievementDetails(child) +
      '<section class="panel"><h2>🕘 最近紀錄</h2>' + recHtml +
      (allCount > 8 ? '<button class="btn link" data-action="toggle-history">' +
        (ui.showAllRecords ? '只顯示最近幾筆' : '顯示全部 ' + allCount + ' 筆') + '</button>' : '') +
      '</section></main>' +
      '<div class="undo-bar"><button class="btn undo" data-action="undo"' + (last ? '' : ' disabled') + '>' +
      '<span class="undo-label">↶ 撤銷上一筆</span>' + (last ? '<small>' + h(last.name) + ' ' + signed(last.points) + '</small>' : '') +
      '</button></div>';
  }

  /** Phase 4 命運卡得到的特殊任務：可勾選完成（+20 點），再點一次取消勾選；今天完成的仍顯示打勾 */
  function specialPanel(child) {
    var today = store.today();
    var list = store.getSpecialTasks(child.id).filter(function (t) {
      if (t.status === 'active') return true;
      if (t.status !== 'done') return false;
      var r = store.getSpecialDoneRecord(t.id);
      return r && r.date === today;
    });
    if (!list.length) return '';
    return '<section class="panel special-panel" data-testid="special"><h2>🔮 特殊任務 <small>命運卡・完成 +20 點</small></h2><div class="special-list">' +
      list.map(function (t) {
        var done = t.status === 'done';
        return '<div class="special-row ' + t.status + '" data-special="' + h(t.id) + '">' +
          '<button class="special-check' + (done ? ' on' : '') + '" data-action="special-toggle" data-id="' + h(t.id) + '" aria-pressed="' + done + '" aria-label="' + (done ? '取消完成' : '完成') + '：' + h(t.name) + '">' +
          '<span class="check-box">' + (done ? '✓' : '') + '</span><span class="special-icon">' + t.icon + '</span>' +
          '<span class="special-main"><b>' + h(t.name) + '</b><small>' + (done ? '✅ 今天完成了' : '⏳ 到 ' + shortDate(t.endDate) + ' 前完成') + '</small></span>' +
          '<span class="special-pts">+' + t.points + '</span></button>' +
          (done ? '' : '<button class="special-cancel" data-action="special-cancel" data-id="' + h(t.id) + '" aria-label="取消這個特殊任務" title="取消這個特殊任務">✕</button>') + '</div>';
      }).join('') + '</div></section>';
  }
  /** 2026-11-08 → 11/8 */
  function shortDate(key) { var p = key.split('-'); return Number(p[1]) + '/' + Number(p[2]); }

  // ---------- 冒險（Phase 2） ----------
  /** 孩子任務頁最上方的冒險入口 */
  function adventureBanner(child) {
    var st = store.getAdventureStatus(child.id);
    if (st.settled) {
      var x = st.settlement;
      var endedToday = store.isAdventureEnded(child.id);
      return '<section class="adv-banner is-settled" data-testid="adventure">' +
        '<span class="adv-icon">' + (endedToday ? '🏁' : '🗺️') + '</span><div class="adv-text"><b>' + (endedToday ? '今日冒險已結束' : '今日冒險已出發') + '</b>' +
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

  /** 五座島：冒險大廳的地圖關卡卡依孩子所在島嶼（players[id].island）顯示對應插圖 */
  var ISLANDS = [
    { id: 'gold', name: '金島', color: '#ffd23f', webp: 'images/gold-island.webp', jpg: 'images/gold-island.jpg', alt: '金島：齒輪、礦坑、礦車、金屬橋與發光礦石' },
    { id: 'wood', name: '木島', color: '#5cbf4a', webp: 'images/islands/wood.webp', jpg: 'images/islands/wood.jpg', alt: '木島：巨樹、樹屋、藤蔓、森林動物與精靈' },
    { id: 'water', name: '水島', color: '#3fb6e8', webp: 'images/islands/water.webp', jpg: 'images/islands/water.jpg', alt: '水島：海洋、瀑布、珊瑚、小船與泡泡' },
    { id: 'fire', name: '火島', color: '#ff6a3d', webp: 'images/islands/fire.webp', jpg: 'images/islands/fire.jpg', alt: '火島：火山、熔岩、火焰精靈與礦坑' },
    { id: 'earth', name: '土島', color: '#b07a4a', webp: 'images/islands/earth.webp', jpg: 'images/islands/earth.jpg', alt: '土島：岩石、洞穴、化石、遺跡與礦石' }
  ];
  function islandOf(childId) {
    var id = store.getPlayer(childId).island;
    return ISLANDS.filter(function (is) { return is.id === id; })[0] || ISLANDS[0];
  }
  var DICE_COST = 5; // Phase 3 規格：6 面骰 5 星

  function renderAdventure(child) {
    var st = store.getAdventureStatus(child.id);
    var x = st.settlement;
    var kids = store.getChildren();

    // 1. Hero header
    var hero = '<header class="sky adv-hero"><span class="cloud c1"></span><span class="cloud c2"></span>' +
      '<div class="adv-hero-main">' + mascotLink(false) + plaque('冒險大廳', '完成任務・累積星星・解鎖新冒險') + '</div>' +
      gear('float-island') + '</header>';

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
      '<button class="partner" data-action="pick-character" aria-label="更換頭像"><span class="partner-ring">' + characterArt(child) + '</span>' +
      '<span class="partner-tag">' + h(child.name) + ' ✎</span></button>' +
      '<div class="star-main"><span class="star-label">' + h(child.name) + '的能量星星</span>' +
      '<b class="star-value" data-testid="stars"><span class="big-star">' + STAR_IMG + '</span> ' + num(bal) + '</b>' +
      '<span class="star-hint">' + hint + '</span>' + progressBar(bal % DICE_COST, DICE_COST, 'star') + '</div>' +
      '<span class="chest-deco" aria-hidden="true"><small>快去收集吧！</small>' + CHEST + '</span></section>';

    // 4. 精簡結算摘要＋可展開紀錄
    var summary;
    if (x) {
      summary = '<div class="adv-status ok"><span class="sum-state"><i>✅</i>今日已結算</span>' +
        '<span class="sum-cell"><small>淨得分</small><b class="pos">' + signed(x.net) + '</b></span>' +
        '<span class="sum-cell"><small>獲得星星</small><b class="gold">' + STAR_IMG + x.stars + '</b>' + (x.bonusStars ? '<small>含額外 ' + x.bonusStars + '</small>' : '') + '</span></div>';
    } else if (st.unlocked) {
      summary = '<div class="adv-status ready"><span class="sum-state"><i>🔓</i>今日冒險已解鎖</span>' +
        '<span class="sum-cell"><small>淨得分</small><b class="pos">' + signed(st.net) + '</b></span>' +
        '<span class="sum-cell"><small>可得星星</small><b class="gold">' + STAR_IMG + st.previewStars + '</b></span>' +
        '<button class="btn primary sum-cta" data-action="enter-adventure">結算並出發</button></div>';
    } else {
      summary = '<div class="adv-status locked"><span class="sum-state"><i>🔒</i>今日冒險尚未解鎖</span>' +
        '<span class="sum-cell"><small>淨得分</small><b>' + signed(st.net) + '</b></span>' +
        '<span class="sum-note">大於 0 就能出發</span></div>';
    }
    var history = store.data.adventure.settlements.filter(function (s) { return s.childId === child.id; })
      .slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; }).slice(0, 14);
    // 結算紀錄放在摘要卡裡，點了才展開
    var log = '<details class="settle-log" id="settle-log"' + (ui.logOpen ? ' open' : '') + '><summary>📜 查看結算紀錄 <span>' + history.length + ' 筆</span></summary>' +
      (history.length ? '<ul class="records">' + history.map(function (s) {
        return '<li class="rec"><span class="rec-time">' + h(dateLabel(s.date)) + '</span>' +
          '<span class="rec-name">淨得分 ' + signed(s.net) + (s.bonusStars ? ' <small class="tag tag-star">額外 ⭐' + s.bonusStars + '</small>' : '') + '</span>' +
          '<span class="pts star">⭐' + s.stars + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted small">還沒有結算紀錄</p>') + '</details>';

    // 5. 地圖關卡卡
    var isl = islandOf(child.id);
    var map = '<section class="map-card" data-island="' + isl.id + '">' +
      '<div class="map-art"><picture><source srcset="' + isl.webp + '" type="image/webp">' +
      '<img src="' + isl.jpg + '" alt="' + h(isl.alt) + '" width="1200" height="675" loading="lazy" decoding="async"></picture></div>' +
      '<div class="map-info">' +
      '<p>擲骰子、走格子、開寶箱！目前在第 ' + store.getPlayer(child.id).pos + ' / ' + (store.getBoard(child.id).tiles.length - 1) + ' 格</p>' +
      (store.isAdventureEnded(child.id)
        ? '<span class="lock-pill">🏁 今天的冒險已結束</span><button class="btn primary map-cta" data-action="show-summary">📋 查看今日小結</button>' +
          '<a class="btn small map-view-link" href="#map-' + h(child.id) + '">看地圖</a>'
        : (x ? '<span class="lock-pill open">🔓 今天可以玩</span>' : '<span class="lock-pill">🔒 先進入今日冒險</span>') +
          (x ? '<a class="btn primary map-cta" href="#map-' + h(child.id) + '">開始冒險 ›</a>'
            : '<button class="btn primary map-cta" disabled>開始冒險 ›</button>')) + '</div>' +
      '<span class="compass" aria-hidden="true">🧭</span></section>' +
      '<div class="island-dots" aria-label="五座島">' + ISLANDS.map(function (is) {
        return '<span class="dot ' + (is.id === isl.id ? 'active' : '') + '" data-island="' + is.id + '" style="--d:' + is.color + '" title="' + is.name + '"></span>';
      }).join('') + '</div>';

    summary = summary.replace(/<\/div>$/, log + '</div>');
    return hero + '<main class="page adventure">' + tabs + starCard + summary + map + '</main>';
  }

  // ---------- 金島棋盤（Phase 3） ----------
  var GAME = window.CGPGame;
  function characterId(child) { return charIdOf(child); }
  function charImg(id, cls) {
    var c = GAME.CHARACTERS.find(function (x) { return x.id === id; });
    return '<img class="' + (cls || 'char-img') + '" src="images/characters/' + id + '.webp" alt="' + h(c.name) + '" width="300" height="310" decoding="async">';
  }
  function characterArt(child) { return charImg(characterId(child)); }
  /** 地圖左下角商店按鈕圖（透明去背＋白色描邊的貼紙圖，直接浮在地圖上） */
  var SHOP_ART = '<span class="map-shop-art" aria-hidden="true"><img src="images/tiles/shop.webp" alt="" width="384" height="384" decoding="async" draggable="false"></span>';
  /** 能量星星圖示（白底圖，以 mix-blend-mode: multiply 疊在淺色底上；alt 保留 ⭐ 供讀屏） */
  var STAR_IMG = '<img class="star-ico" src="images/items/star.webp" alt="⭐" width="256" height="256" decoding="async" draggable="false">';
  /** 地圖格子事件圖示（白底圖放在白色圓角圖示框，contain 不裁切） */
  var TILE_ART = { start: 'images/tiles/start.webp', chest: 'images/tiles/chest.webp', chance: 'images/tiles/chance.webp',
    minigame: 'images/tiles/minigame.webp', fate: 'images/tiles/fate.webp', boundary: 'images/tiles/door.webp', end: 'images/tiles/finish.webp' }; // 區域終點：礦場木門；全島終點（第 100 格）：終點旗
  /** 圖未到前的暫代表情符號（新格子類型先放這裡，圖到貨後改放進 TILE_ART） */
  var TILE_EMOJI = {};
  function tileArt(type, cls) {
    if (TILE_ART[type]) return '<span class="tile-art ' + (cls || '') + '"><img src="' + TILE_ART[type] + '" alt="" aria-hidden="true" width="192" height="192" decoding="async" draggable="false"></span>';
    return TILE_EMOJI[type] ? '<span class="tile-emoji ' + (cls || '') + '" aria-hidden="true">' + TILE_EMOJI[type] + '</span>' : '';
  }
  /** 道具圖示（白底圖放在白色圖示框中，contain 不裁切）；名稱與價格由介面另外顯示 */
  function itemArt(id, cls) {
    var it = GAME.SHOP.filter(function (x) { return x.id === id; })[0];
    if (!it || !it.img) return '<span class="' + cls + '">' + (it ? it.icon : '') + '</span>';
    return '<span class="item-art ' + cls + '"><img src="' + it.img + '" alt="" aria-hidden="true" width="256" height="256" decoding="async" draggable="false"></span>';
  }

  // ---------- 金島第一區地圖（背景＋格子＋事件圖示＋角色，同一個座標容器） ----------
  var TILE_LABEL = { chest: '寶箱', chance: '機會', fate: '命運', minigame: '小遊戲：抓住星星', boundary: '區域終點：礦場木門', end: '全島終點：金冠城堡' };

  /** 目前區域（第一區）的參考尺寸與背景 */
  function regionOf(board, tile) {
    return board.regions.find(function (r) { return r.id === tile.regionId; }) || board.regions[0];
  }
  /** 格子 → 長地圖總覽像素（1080×5400，原點左上） */
  function worldXY(region, tile) { return { x: tile.gx, y: tile.gy }; }
  var REGION_NO = ['第一區', '第二區', '第三區', '第四區'];
  /** 長地圖背景：已開放的區域放背景圖，其餘用雲霧遮住、顯示「即將開放」 */
  function mapStrips(board) {
    return board.regions.map(function (r, i) {
      var top = 'top:' + r.stripY + 'px';
      if (r.available && r.background) {
        return '<picture class="map-strip" style="' + top + '"><source srcset="' + r.background.webp + '" type="image/webp">' +
          '<img class="map-bg" data-region="' + r.id + '" src="' + r.background.jpg + '" width="1080" height="1350" alt="" draggable="false"' + (i ? ' loading="lazy"' : '') + '></picture>';
      }
      return '<div class="map-fog" data-region="' + r.id + '" style="' + top + '"><span><b>☁️ ' + REGION_NO[i] + '・' + h(r.name) + '</b>第 ' + r.from + '～' + r.to + ' 格・即將開放</span></div>';
    }).join('');
  }

  function renderMap(child) {
    var player = store.getPlayer(child.id);
    var board = store.getBoard(child.id);
    var region = regionOf(board, board.tiles[player.pos]);
    var W = board.world.width, H = board.world.height;   // 長地圖總覽尺寸
    var bag = player.bag;
    var canPlay = store.canPlayToday(child.id);
    var used = store.getRollsToday(child.id);
    var limit = GAME.DAILY_DICE_LIMIT;
    var end = board.tiles.length - 1;
    var atEnd = player.pos >= end;
    var quota = store.getBonusQuota(child.id);
    var noRolls = store.getRollsLeft(child.id) <= 0;
    var pending = player.pendingRoll;
    var picking = ui.doorPick === child.id;
    function act(kind, label, count, disabled, note) {
      return '<button class="dice-btn ' + kind + '" data-action="' + (kind === 'skates' ? 'use-skates' : 'roll') + '" data-kind="' + kind + '"' +
        (disabled ? ' disabled' : '') + '>' + itemArt(kind, 'dice-icon') + '<b>' + label + '</b><small>背包 ×' + count + (note || '') + '</small></button>';
    }
    var lim = store.getItemLimitsToday(child.id);
    var ended = store.isAdventureEnded(child.id);
    var reason = ended ? '🏁 今天的冒險已經結束了，明天見！' : !canPlay ? '🔒 今日冒險還沒出發，先回任務頁按「進入今日冒險」'
      : picking ? '🚪 任意門：點地圖上的格子選擇要去的地方'
      : atEnd ? (board.tiles[player.pos].type === 'end' ? '🏁 已抵達' + (board.goalName || '終點') + '、通關' + board.name + '！' + (GAME.nextIsland(player.island) ? '下次出發前往「' + GAME.BOARDS[GAME.nextIsland(player.island)].name + '」' : '下次出發從起點開始新的一輪') : '🚪 已抵達目前開放區域的終點！下次出發從起點開始新的一輪')
        : noRolls ? '今天的 3 次骰子用完了，明天再來！' + (lim.move && (bag.skates || bag.wings) ? '（前進道具今天還可以用 ' + lim.move + ' 次）' : '')
          : (!bag.d6 && !bag.d12 && !bag.skates ? '背包是空的，點左下角的商店用能量星星購買骰子' : '選一個道具出發吧！');
    var tiles = board.tiles.map(function (t) {   // 長地圖：所有已開放區域的格子都顯示
      var p = worldXY(region, t);
      if (t.type === 'start') {
        return '<div class="mstart' + (t.id === player.tileId ? ' here' : '') + '" data-tile="' + t.id + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px" aria-hidden="true">' +
          tileArt('start', 'start-art') + '<span>起點</span></div>';
      }
      // 疊放順序：越靠畫面下方（越近）的格子在越上層，避免後方石板蓋住前方格子的事件圖示
      // 寶物磁鐵吸走的寶箱：這一輪顯示成普通石板（新的一輪或換島回來會重新放滿）
      var shown = t.type === 'chest' && player.looted.indexOf(t.id) >= 0 ? 'normal' : t.type;
      return '<div class="mtile mt-' + shown + (shown !== t.type ? ' looted' : '') + (t.id === player.tileId ? ' here' : '') + '" data-n="' + t.n + '" data-tile="' + t.id + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px;z-index:' + Math.round(t.gy / 6) + '"' +
        (TILE_LABEL[shown] ? ' title="' + TILE_LABEL[shown] + '"' : '') + '>' + tileArt(shown, 'mtile-icon') + '</div>';
    }).join('');
    var pp = worldXY(region, board.tiles[player.pos]);
    return pageHeader(board.name, child, 'map') +
      '<main class="page map-page">' +
      '<section class="hud">' +
      '<span class="hud-cell"><small>能量星星</small><b class="gold" data-testid="stars">' + STAR_IMG + ' ' + num(store.getStarBalance(child.id)) + '</b></span>' +
      '<span class="hud-cell"><small>今日骰子</small><b data-testid="rolls">' + used + ' / ' + limit + '</b>' + (quota.rolls ? '<small class="hud-bonus">再來 +' + quota.rolls + '</small>' : '') + '</span>' +
      '<span class="hud-cell"><small>位置</small><b data-testid="pos">' + player.pos + ' / ' + end + '</b></span>' +
      '</section>' +
      '<p class="region-name">🏝️ ' + REGION_NO[board.regions.indexOf(region)] + '・' + h(region.name) + '</p>' +
      '<section class="map-view' + (picking ? ' picking' : '') + '" id="map-view" aria-label="' + h(board.name) + '地圖，可拖曳與縮放">' +
      '<div class="map-world" id="map-world" style="width:' + W + 'px;height:' + H + 'px" data-w="' + W + '" data-h="' + H + '">' +
      mapStrips(board) +
      tiles +
      store.getMapChests(child.id).map(function (c) {
        var cp = worldXY(region, board.tiles[c.n]);
        return '<div class="map-chest" data-chest="' + c.n + '" style="left:' + cp.x.toFixed(1) + 'px;top:' + cp.y.toFixed(1) + 'px" title="神秘寶箱"><img src="images/items/mystery_chest.webp" alt="神秘寶箱" width="256" height="256" draggable="false"></div>';
      }).join('') +
      '<div class="pawn" id="pawn" data-char="' + h(characterId(child)) + '" data-pos="' + player.pos + '" data-tile="' + h(player.tileId) + '" style="left:' + pp.x.toFixed(1) + 'px;top:' + pp.y.toFixed(1) + 'px">' +
      '<div class="pawn-inner">' + characterArt(child) + '</div></div>' +
      '</div>' +
      '<div class="map-ctrl"><button type="button" data-map="in" aria-label="放大">＋</button><button type="button" data-map="out" aria-label="縮小">－</button>' +
      '<button type="button" data-map="follow" aria-label="回到角色位置">🎯</button></div>' +
      '<button type="button" class="map-shop" data-action="open-shop"' + (canPlay ? '' : ' disabled') + ' aria-label="星星商店">' + SHOP_ART + '<b>商店</b></button>' +
      '<div class="dice-overlay" id="dice-overlay" hidden><div class="die-face" id="die-face">?</div></div>' +
      '</section>' +
      '<p class="map-hint">' + reason + '</p>' +
      (picking ? '<button type="button" class="btn block" data-action="cancel-door">取消任意門</button>' : '') +
      (canPlay && pending ? '<button type="button" class="btn primary block" data-action="roll" data-kind="' + pending.die + '">🎲 已擲出 ' + pending.value + '，點這裡繼續</button>' : '') +
      (player.medalArmed ? '<p class="medal-on">🥇 好運金牌已啟用：下一次停在寶箱或機會格，效果發生 2 次</p>' : '') +
      (canPlay && store.getPendingMinigame(child.id) ? '<button type="button" class="btn primary block mg-resume" data-action="play-minigame">🎮 今天的小遊戲還沒玩完，點這裡開始</button>' : '') +
      '<section class="dice-bar">' +
      act('d6', '6 面骰', bag.d6, !canPlay || noRolls || !bag.d6 || !!pending || picking) +
      act('d12', '12 面骰', bag.d12, !canPlay || noRolls || !bag.d12 || !!pending || picking) +
      act('skates', '溜冰鞋 +3', bag.skates, !canPlay || !bag.skates || !lim.move || !!pending || picking, lim.move ? '' : '・今天已用完') +
      '</section>' +
      itemBar(child, player, { canPlay: canPlay, atEnd: atEnd, pending: !!pending, picking: picking, quota: quota }) +
      (canPlay ? '<button type="button" class="btn block end-day" data-action="end-day"' + (pending || picking ? ' disabled' : '') + '>🏁 結束今日冒險</button>' : '') +
      (ended ? '<button type="button" class="btn primary block" data-action="show-summary">📋 查看今日小結</button>' : '') +
      '<div class="legend">' + [['chest', '寶箱'], ['chance', '機會'], ['fate', '命運'], ['minigame', '小遊戲'], ['boundary', '區域終點'], ['end', '全島終點']].filter(function (l) {
        return l[0] !== 'boundary' && l[0] !== 'end' || board.tiles.some(function (t) { return t.type === l[0]; });
      }).map(function (l) {
        return '<span>' + tileArt(l[0], 'legend-art') + l[1] + '</span>';
      }).join('') + '</div>' +
      '<a class="btn block" href="#adventure-' + h(child.id) + '">‹ 回冒險大廳</a>' +
      '</main>';
  }

  // ---------- 鏡頭：拖曳、雙指縮放、跟隨角色 ----------
  // ui.cam：{ childId, z（縮放）, cx, cy（畫面中心對應的地圖座標）, manual（使用者拖曳後暫停跟隨） }
  ui.cam = null;
  function camBounds(view, W, H) {
    var vw = view.clientWidth, vh = view.clientHeight;
    var fit = Math.max(Math.min(vw / W, vh / H), vw / W);   // 長地圖：最小縮放＝寬度剛好填滿畫面
    var def = Math.max(fit, Math.min(0.9, vw / W * 1.9)); // 預設：格子約 40px 寬
    return { vw: vw, vh: vh, min: fit, max: 1.6, def: def };
  }
  function applyCam(animate) {
    var view = document.getElementById('map-view'), world = document.getElementById('map-world');
    if (!view || !world || !ui.cam) return;
    var W = +world.dataset.w, H = +world.dataset.h, b = camBounds(view, W, H), c = ui.cam;
    c.z = Math.max(b.min, Math.min(b.max, c.z));
    var sw = W * c.z, sh = H * c.z;
    var tx = b.vw / 2 - c.cx * c.z, ty = b.vh / 2 - c.cy * c.z;
    // 地圖比視窗大時不露出邊外；比視窗小時置中
    tx = sw <= b.vw ? (b.vw - sw) / 2 : Math.min(0, Math.max(b.vw - sw, tx));
    ty = sh <= b.vh ? (b.vh - sh) / 2 : Math.min(0, Math.max(b.vh - sh, ty));
    c.cx = (b.vw / 2 - tx) / c.z; c.cy = (b.vh / 2 - ty) / c.z;
    world.classList.toggle('anim', !!animate);
    world.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + c.z.toFixed(4) + ')';
  }
  function followPawn(animate) {
    var pawn = document.getElementById('pawn');
    if (!pawn || !ui.cam) return;
    ui.cam.cx = parseFloat(pawn.style.left); ui.cam.cy = parseFloat(pawn.style.top) - 30;
    applyCam(animate);
  }
  function setupMap(child) {
    var view = document.getElementById('map-view'), world = document.getElementById('map-world');
    if (!view || !world) return;
    var b = camBounds(view, +world.dataset.w, +world.dataset.h);
    if (!ui.cam || ui.cam.childId !== child.id) ui.cam = { childId: child.id, z: b.def, cx: 0, cy: 0, manual: false };
    if (ui.cam.manual) applyCam(false); else followPawn(false);
    var pts = {}, last = null;
    function zoomAt(f, px, py) {
      var c = ui.cam, rect = view.getBoundingClientRect();
      var ox = px - rect.left - rect.width / 2, oy = py - rect.top - rect.height / 2;
      var wx = c.cx + ox / c.z, wy = c.cy + oy / c.z;      // 手指下的地圖點保持不動
      c.z = Math.max(b.min, Math.min(b.max, c.z * f));
      c.cx = wx - ox / c.z; c.cy = wy - oy / c.z;
      c.manual = true; applyCam(false);
    }
    var tap = null;   // 任意門：手指幾乎沒移動就放開＝點選格子
    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.map-ctrl, .map-shop')) return;
      view.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      tap = Object.keys(pts).length === 1 ? { x: e.clientX, y: e.clientY } : null;
      last = null;
    });
    view.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var prev = pts[e.pointerId]; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 1) {
        ui.cam.cx -= (e.clientX - prev.x) / ui.cam.z; ui.cam.cy -= (e.clientY - prev.y) / ui.cam.z;
        ui.cam.manual = true; applyCam(false);
      } else if (ids.length >= 2) {
        var p1 = pts[ids[0]], p2 = pts[ids[1]];
        var d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (last) zoomAt(d / last, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        last = d;
      }
    });
    function up(e) {
      var wasTap = tap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8;
      delete pts[e.pointerId]; last = null; tap = null;
      if (wasTap && ui.doorPick === child.id) pickDoorAt(child, e.clientX, e.clientY);
    }
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    view.querySelectorAll('[data-map]').forEach(function (btn) {
      btn.onclick = function () {
        var k = btn.getAttribute('data-map');
        if (k === 'follow') { ui.cam.manual = false; followPawn(true); return; }
        var r = view.getBoundingClientRect();
        zoomAt(k === 'in' ? 1.25 : 0.8, r.left + r.width / 2, r.top + r.height / 2);
      };
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** 角色依序一格一格跳過去，鏡頭跟隨 */
  /** 角色所在格：事件圖示縮小移到角落，避免遮住角色 */
  function markHere(tileId) {
    app.querySelectorAll('.map-world .here').forEach(function (el) { el.classList.remove('here'); });
    var el = app.querySelector('.map-world [data-tile="' + tileId + '"]:not(.pawn)');
    if (el) el.classList.add('here');
  }
  // ---------- 角色動畫：待機、跳格、開心、驚訝、開寶箱 ----------
  /**
   * 動作設計移植自 Codex「character-animation-pack-1」（Web Animations API、原圖不重繪）。
   * 依體型調整節奏：tempo＝速度倍率（越大越慢）、lift＝跳高倍率（長耳、小翼輕盈，石球沉穩）。
   * 只負責畫面；計分、道具、獎勵都在資料層先完成，動畫中斷不影響。
   */
  var PAWN_PROFILE = { roundear: [1, 1], longear: [.85, 1.3], horn: [1.08, .9], wing: [1.1, 1.4], drop: [1.2, 1.05], sprout: [1.15, .9], flame: [.85, 1.2], stone: [1.3, .65] };
  function pawnEls() {
    var pawn = document.getElementById('pawn');
    if (!pawn) return null;
    var body = pawn.querySelector('.pawn-inner'), fx = pawn.querySelector('.pawn-fx');
    if (!fx) { fx = document.createElement('div'); fx.className = 'pawn-fx'; fx.setAttribute('aria-hidden', 'true'); pawn.appendChild(fx); }
    var prof = PAWN_PROFILE[pawn.dataset.char] || [1, 1];
    return { pawn: pawn, body: body, fx: fx, tempo: prof[0], lift: prof[1], k: (pawn.offsetWidth || 60) / 120 };   // k：原設計 120px 角色的位移換算
  }
  function pawnClear(e) {
    (e.body.getAnimations ? e.body.getAnimations() : []).forEach(function (a) { a.cancel(); });
    e.fx.textContent = '';
  }
  /** 待機：循環呼吸、輕微擺動 */
  function pawnIdle() {
    var e = pawnEls();
    if (!e || !e.body.animate || reduceMotion) return;
    pawnClear(e);
    e.body.animate([{ transform: 'translateY(0) rotate(-1deg) scale(1)' }, { transform: 'translateY(' + (-3 * e.lift * e.k).toFixed(1) + 'px) rotate(1deg) scale(.985, 1.025)' }, { transform: 'translateY(0) rotate(-1deg) scale(1)' }],
      { duration: 2400 * e.tempo, iterations: Infinity, easing: 'ease-in-out' });
  }
  function pawnBits(e, sym, cls, list, dur) {
    list.forEach(function (o, i) {
      var b = document.createElement('span');
      b.className = 'pawn-bit ' + cls; b.textContent = sym; e.fx.appendChild(b);
      b.animate(o, { duration: dur, delay: i * dur * .08, fill: 'both', easing: 'ease-out' });
    });
  }
  /**
   * 播放動作，回傳 Promise（結束後自動回到待機）。action：jump、happy、surprised、openChest
   * @param {number} [speed] 跳格時的時間倍率（連續移動用較短）
   */
  function pawnPlay(action, speed) {
    var e = pawnEls();
    if (!e || !e.body.animate || reduceMotion) return Promise.resolve();
    pawnClear(e);
    var k = e.k, L = e.lift, frames, dur;
    var px = function (v) { return (v * k).toFixed(1) + 'px'; };
    if (action === 'jump') {
      dur = 560 * e.tempo * (speed || 1);
      frames = [{ transform: 'scale(1)' }, { transform: 'scale(1.13, .86)', offset: .15 }, { transform: 'translateY(' + px(-42 * L) + ') scale(.94, 1.06)', offset: .5 }, { transform: 'scale(1.12, .88)', offset: .86 }, { transform: 'scale(1)' }];
    } else if (action === 'happy') {
      dur = 1000 * e.tempo;
      frames = [{ transform: 'scale(1)' }, { transform: 'translateY(' + px(-17) + ') rotate(-9deg)', offset: .25 }, { transform: 'scale(1.08, .92)', offset: .45 }, { transform: 'translateY(' + px(-22) + ') rotate(9deg)', offset: .7 }, { transform: 'scale(1)' }];
      pawnBits(e, '♥', 'heart', [-33, 25, -10, 39, 8].map(function (x) {
        return [{ transform: 'translate(' + px(x) + ', ' + px(10) + ') scale(.2)', opacity: 0 }, { transform: 'translate(' + px(x - 4) + ', ' + px(-5) + ') scale(.9)', opacity: 1, offset: .25 }, { transform: 'translate(' + px(x + 6) + ', ' + px(-50) + ') scale(1.1)', opacity: 0 }];
      }), dur * .7);
    } else if (action === 'surprised') {
      dur = 850 * e.tempo;
      frames = [{ transform: 'scale(1)' }, { transform: 'translateY(' + px(-15) + ') rotate(-9deg) scale(.91, 1.13)', offset: .22 }, { transform: 'translateY(' + px(-7) + ') rotate(5deg)', offset: .5 }, { transform: 'scale(1)' }];
      pawnBits(e, '!', 'bang', [[{ transform: 'translate(-50%, 0) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, ' + px(-30) + ') scale(1.2)', opacity: 1, offset: .3 }, { transform: 'translate(-50%, ' + px(-38) + ') scale(1)', opacity: 0 }]], dur);
    } else if (action === 'openChest') {
      dur = 1500 * e.tempo;
      frames = [{ transform: 'scale(1)' }, { transform: 'translate(' + px(10) + ', ' + px(5) + ') rotate(13deg) scale(1.02, .94)', offset: .3 }, { transform: 'translate(' + px(10) + ', ' + px(5) + ') rotate(13deg)', offset: .48 }, { transform: 'translateY(' + px(-18) + ') rotate(-5deg)', offset: .72 }, { transform: 'scale(1)' }];
      var c = document.createElement('span');
      c.className = 'pawn-chest'; c.innerHTML = '<img src="images/chest.webp" alt="" draggable="false"><i></i>';   // 金邊紅寶石寶箱（原圖本身是打開的：俯身 → 寶箱彈出 → 金光 → 開心）
      e.fx.appendChild(c);
      c.animate([{ transform: 'translateY(10%) scale(.8)', opacity: 0 }, { transform: 'translateY(5%) scale(.9) rotate(-4deg)', opacity: 0, offset: .32 }, { transform: 'translateY(-7%) scale(1.1) rotate(3deg)', opacity: 1, offset: .57 },
        { transform: 'scale(1)', opacity: 1, offset: .72 }, { transform: 'scale(1)', opacity: 1, offset: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: dur, fill: 'both', easing: 'ease-out' });
      c.querySelector('i').animate([{ opacity: 0 }, { opacity: 1, offset: .35 }, { opacity: 0 }], { duration: dur * .5, delay: dur * .43, fill: 'both' });
      pawnBits(e, '✦', 'spark', [0, 1, 2, 3, 4, 5].map(function (i) {
        var a = i / 6 * Math.PI * 2;
        return [{ transform: 'translate(-50%, -50%) scale(.1)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: 'translate(' + px(Math.cos(a) * 55) + ', ' + px(Math.sin(a) * 38 - 30) + ') scale(.8)', opacity: 0 }];
      }), dur * .5);
    } else return Promise.resolve();
    var anim = e.body.animate(frames, { duration: dur, fill: 'forwards', easing: 'ease-in-out' });
    return anim.finished.then(function () { if (action !== 'jump') pawnIdle(); }, function () { /* 被新的動作取消 */ });
  }
  /** 停下來之後依事件反應：寶箱 → 開寶箱；命運、往回退、撿到神秘寶箱 → 驚訝；機會、終點 → 開心 */
  function pawnReaction(res) {
    var ev = res && res.event, last = ev && ev.then ? ev.then : ev;
    if (!ev) return null;
    if (ev.clear || (last && last.clear)) return 'happy';
    if (ev.type === 'chest' || (last && last.type === 'chest')) return 'openChest';
    if (ev.type === 'fate' || (ev.backPath && ev.backPath.length) || (last && last.backPath && last.backPath.length)) return 'surprised';
    if (res.found) return 'surprised';
    if (ev.type === 'chance') return 'happy';
    return null;
  }

  async function hopAlong(child, path) {
    var pawn = document.getElementById('pawn');
    if (!pawn) return;
    var board = store.getBoard(child.id);
    if (ui.cam) ui.cam.manual = false;
    for (var i = 0; i < path.length; i++) {
      var t = board.tiles[path[i]], p = worldXY(regionOf(board, t), t);
      pawn.style.left = p.x.toFixed(1) + 'px'; pawn.style.top = p.y.toFixed(1) + 'px';
      pawn.dataset.pos = path[i]; pawn.dataset.tile = t.id;
      markHere(t.id);
      if (pawn.animate && !reduceMotion) pawnPlay('jump', .62);   // 跳格：蹲下蓄力、騰空、落地回彈
      else { pawn.classList.remove('hop'); void pawn.offsetWidth; pawn.classList.add('hop'); }
      followPawn(true);
      await sleep(reduceMotion ? 60 : 360);
    }
    pawn.classList.remove('hop');
    pawnIdle();
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

  /** 任意門：找出被點到的格子並確認傳送 */
  function pickDoorAt(child, x, y) {
    var hit = null;
    app.querySelectorAll('.map-world .mtile').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = el;
    });
    if (!hit) return;
    var n = Number(hit.dataset.n), p = store.getPlayer(child.id), end = store.getBoard(child.id).tiles.length - 1;
    if (n === p.pos) { toast('你已經在這一格了'); return; }
    if (n >= end) { toast('任意門不能傳送到終點木門', 'neg'); return; }
    var label = TILE_LABEL[hit.className.match(/mt-(\w+)/)[1]];
    confirmThen('用 🚪 任意門傳送到第 ' + n + ' 格' + (label ? '（' + label + '）' : '') + '？', '傳送', false, function () {
      ui.doorPick = null;
      setTimeout(function () { playMove(child.id, 'door', n); }, 0);
    });
  }

  /** 擲出點數後，持有命運重骰券時詢問要前進還是重擲 */
  function askReroll(pr, tickets) {
    return new Promise(function (resolve) {
      confirmEl.innerHTML = '<div class="confirm-box reroll-box"><h2>🎲 擲出 ' + pr.value + '</h2>' +
        '<p class="confirm-msg">要用 <b>命運重骰券</b> 重擲一次嗎？（剩 ' + tickets + ' 張）<br><small>重擲後以新的點數為準，同一次只能用 1 張。</small></p>' +
        '<div class="modal-actions"><button type="button" class="btn" data-reroll>🎲 重擲</button>' +
        '<button type="button" class="btn primary" data-go>👉 前進 ' + pr.value + ' 格</button></div></div>';
      var done = false;
      function fin(v) { if (done) return; done = true; if (confirmEl.open) confirmEl.close(); resolve(v); }
      confirmEl.querySelector('[data-reroll]').onclick = function () { fin(true); };
      confirmEl.querySelector('[data-go]').onclick = function () { fin(false); };
      confirmEl.oncancel = function (e) { e.preventDefault(); };
      if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
    });
  }

  ui.busy = false;
  /**
   * 移動：kind = 'd6'｜'d12'｜'magic'（擲骰，可能先問命運重骰券）、'skates'、'wings'、'door'（arg＝目的地格號）
   */
  async function playMove(childId, kind, arg) {
    if (ui.busy) return;
    var child = store.getChild(childId);
    var isDie = kind === 'd6' || kind === 'd12' || kind === 'magic';
    var res, pr = null;
    ui.busy = true;
    app.querySelectorAll('.dice-btn, .map-shop, .item-btn').forEach(function (b) { b.disabled = true; });
    try {
      if (isDie) {
        var pend = store.getPlayer(childId).pendingRoll;
        pr = pend ? Object.assign({}, pend) : store.prepareRoll(childId, kind);
        await showDie(pr.value, pr.sides);
        var tickets = store.getPlayer(childId).bag.rerollTicket;
        if (!pr.rerolled && tickets > 0 && await askReroll(pr, tickets)) {
          var rr = store.rerollPending(childId);
          await showDie(rr.value, rr.sides);
          toast('🎲 命運重骰：' + rr.old + ' → ' + rr.value, 'pos');
          pr = rr;
        }
        res = store.commitRoll(childId);
      } else if (kind === 'skates') { res = store.useSkates(childId); toast('🛼 溜冰鞋前進 3 格！', 'pos'); }
      else if (kind === 'wings') { res = store.useWings(childId); toast('🪽 飛行翼起飛！', 'pos'); }
      else if (kind === 'door') { res = store.useDoor(childId, arg); toast('🚪 任意門傳送到第 ' + arg + ' 格！', 'pos'); }
      else throw new Error('不明的移動方式');
    } catch (err) { ui.busy = false; toast(err.message, 'neg'); render(); return; }
    var ev = res.event;
    try {
      if (res.travel) {   // 通關後前往下一座島：換成新島嶼的地圖，從起點出發
        toast('🛶 出發前往' + res.travel.name + '！', 'pos');
        render();
        await sleep(500);
      } else if (res.lap) {   // 從終點回到起點開始新的一輪
        toast('🔄 新的一輪開始！從起點出發', 'pos');
        await hopAlong(child, [0]);
        await sleep(300);
      }
      await hopAlong(child, res.path);
      if (ev && ev.extraPath && ev.extraPath.length) {
        toast('🚃 ' + ev.text.split('\n')[0], 'pos');
        await sleep(400);
        await hopAlong(child, ev.extraPath);
      }
      // 命運卡後退（可能是礦車載到命運格後的連鎖事件）
      var back = ev && ev.backPath && ev.backPath.length ? ev : (ev && ev.then && ev.then.backPath && ev.then.backPath.length ? ev.then : null);
      if (back) {
        toast('🔮 ' + back.text, 'neg');
        await sleep(500);
        await hopAlong(child, back.backPath);
      }
    } finally { ui.busy = false; }
    render();
    var react = pawnReaction(res);
    if (react) { ui.busy = true; document.body.classList.add('pawn-acting'); try { await pawnPlay(react); } finally { ui.busy = false; document.body.classList.remove('pawn-acting'); } }   // 角色先反應，再顯示事件說明（pawn-acting：動作中，骰子暫停）
    var head = kind === 'skates' ? '🛼 前進 3 格' : kind === 'wings' ? '🪽 飛行翼' : kind === 'door' ? '🚪 任意門'
      : (kind === 'magic' || (pr && pr.die === 'magic') ? '✨ 神奇骰子擲出 ' : '🎲 擲出 ') + res.value;
    // 停在小遊戲格（或礦車載到小遊戲格）：直接開始「抓住星星」
    var clearEv = ev && ev.clear ? ev : (ev && ev.then && ev.then.clear ? ev.then : null);
    if (clearEv) { await mapFireworks(); showClear(child, clearEv); return; }
    var mgEv = ev && ev.minigame ? ev : (ev && ev.then && ev.then.minigame ? ev.then : null);
    if (mgEv) { openMinigame(childId, head + '・停在第 ' + store.getPlayer(childId).pos + ' 格'); return; }
    var msg = eventText(res.event);
    if (res.found) msg = '🎁 撿到 ' + res.found + ' 個神秘寶箱！放進冒險背包了，用 🔑 黃金鑰匙打開。' + (msg ? '\n\n' + msg : '');
    if (msg) showInfo(head + '・停在第 ' + store.getPlayer(childId).pos + ' 格', msg);
    else toast(head + '，停在第 ' + store.getPlayer(childId).pos + ' 格');
  }

  /** 冒險大廳：成就（徽章先用表情符號；點一下看說明與達成日期） */
  var ACH_CATS = [['adventure', '🗺️ 冒險'], ['collect', '🎒 收集'], ['life', '🌱 生活']];
  function achievementPanel(child) {
    var list = store.getAchievements(child.id);
    return '<div class="ach-panel">' +
      ACH_CATS.map(function (c) {
        var mine = list.filter(function (a) { return a.cat === c[0] && a.done; });   // 只列已得到的成就
        if (!mine.length) return '';
        return '<div class="ach-cat"><h3>' + c[1] + '</h3><div class="ach-grid">' + mine.map(function (a) {
          return '<button type="button" class="ach ach-' + a.cat + (a.done ? ' done' : '') + (ui.achNew && ui.achNew.indexOf(a.id) >= 0 ? ' is-new' : '') + '" data-action="ach-info" data-id="' + a.id + '" aria-label="' + h(a.name) + (a.done ? '（已解鎖）' : '（未解鎖）') + '">' +
            (a.done ? badgeHtml(a, 'xs') : '<span class="ach-badge">🔒</span>') + '<small>' + h(a.name) + '</small></button>';   // 已解鎖：完整彩色徽章
        }).join('') + '</div></div>';
      }).join('') + '</div>';
  }
  /** 首頁成就欄：每位孩子最近得到的 3 個成就（還沒有成就的孩子不顯示；都沒有就整欄不出現），點一列進到小孩頁面並展開全部成就 */
  function homeAchievements(children) {
    var rows = children.map(function (c) {
      var list = store.getAchievements(c.id), done = list.filter(function (a) { return a.done; });
      if (!done.length) return '';
      var recent = done.slice().sort(function (x, y) { return y.ts - x.ts; }).slice(0, 3);
      return '<button type="button" class="ach-home-row" data-action="open-achievements" data-id="' + h(c.id) + '" aria-label="' + h(c.name) + '的全部成就">' +
        avatar(c, 'sm') + '<span class="ach-home-name"><b>' + h(c.name) + '</b><small>' + done.length + ' / ' + list.length + '</small></span>' +
        '<span class="ach-home-badges">' + recent.map(function (a) {
          return '<span class="ach-mini ach-' + a.cat + '" title="' + h(a.name) + '">' + badgeHtml(a, 'xs') + '<small>' + h(a.name) + '</small></span>';
        }).join('') + '</span><span class="ach-home-go" aria-hidden="true">›</span></button>';
    }).join('');
    return rows ? '<section class="ach-home" data-testid="home-achievements"><h2>🏆 最近得到的成就</h2>' + rows + '</section>' : '';
  }
  /** 小孩頁面：全部成就（點選才展開；從首頁成就欄進來時自動展開）。摺疊時顯示最近得到的一個；展開只列已得到的成就 */
  function achievementDetails(child) {
    var list = store.getAchievements(child.id), done = list.filter(function (a) { return a.done; });
    var open = ui.achOpen === child.id;
    var latest = done.slice().sort(function (x, y) { return y.ts - x.ts; })[0];
    var peek = latest
      ? '<span class="ach-latest">最近：<span class="ach-mini ach-' + latest.cat + '">' + badgeHtml(latest, 'xs') + '<small>' + h(latest.name) + '</small></span></span>'
      : '<span class="ach-latest muted">還沒有成就，繼續加油！</span>';
    return '<details class="panel ach-details" id="ach-details" data-testid="achievements"' + (open ? ' open' : '') + '>' +
      '<summary><span class="ach-sum"><h2>🏆 全部成就 <small>已解鎖 ' + done.length + ' / ' + list.length + '</small></h2>' + peek + '</span></summary>' +
      (done.length ? achievementPanel(child) : '') + '</details>';
  }
  /** 撤銷／刪除會收回成就時先提醒；沒有影響就直接執行 */
  function achNames(list) { return list.map(function (a) { return a.icon + ' ' + a.name; }).join('、'); }
  function confirmAchLoss(loss, message, okLabel, fn) {
    if (!loss.length) { fn(); render(); return; }
    confirmThen(message + '\n\n⚠️ 會一起收回成就：' + achNames(loss) + '\n（之後再次達成可以重新獲得）', okLabel, true, fn);
  }
  /** 執行後提示收回了哪些成就 */
  function revokedNote() {
    var lost = store.lastRevoked || [];
    store.lastRevoked = [];
    return lost.length ? '\n🏆 收回成就：' + achNames(lost) : '';
  }
  /** 新解鎖的成就：提示一次 */
  function announceAchievements(childId, skipIds) {
    var fresh = store.checkAchievements(childId).filter(function (a) { return !skipIds || skipIds.indexOf(a.id) < 0; });
    if (fresh.length) showAchTheater(store.getChild(childId), fresh);
  }

  // ---------- 星光成就劇場：成就解鎖演出 ----------
  /**
   * 正式徽章圖（Codex 交件後放 images/badges/badge_<代號>.webp，並把代號加進這裡）；
   * 沒有圖的成就用程式畫的徽章：類別色外框＋成就圖示（分數金牌另標數字）
   */
  var BADGE_IMG = {};
  /** 主徽章挑選：越高階／越稀有分數越高（只影響演出，不影響成就條件） */
  var ACH_RANK = { goldClear1: 300, streak7: 120, reachR4: 110, catch10: 100, special5: 95, reachR3: 80, chests10: 75, mystery1: 70,
    reachR2: 60, catch5: 45, special1: 40, chest1: 30, advStart: 20 };
  function achRank(a) { var m = /^earn(\d+)$/.exec(a.id); return m ? 50 + Number(m[1]) / 100 : (ACH_RANK[a.id] || 10); }
  /** 徽章 HTML（size：lg 主徽章、sm 小徽章、xs 收藏格） */
  function badgeHtml(a, size) {
    var m = /^earn(\d+)$/.exec(a.id);
    if (BADGE_IMG[a.id]) return '<span class="badge badge-' + size + ' badge-img"><img src="' + BADGE_IMG[a.id] + '" alt="" width="256" height="256" decoding="async" draggable="false"></span>';
    return '<span class="badge badge-' + size + ' badge-' + a.cat + '" aria-hidden="true"><span class="badge-face">' + (m ? '🏅' : a.icon) + '</span>' +   // 分數金牌用不帶數字的獎牌，數字另標
      (m ? '<span class="badge-n">' + Number(m[1]).toLocaleString('en-US') + '</span>' : '') + '</span>';
  }
  /** 音效開關（存在這台裝置的瀏覽器，只影響成就音效） */
  var SOUND_KEY = 'cgp-ach-sound';
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { return true; } }
  function setSound(on) { try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) { /* 無法儲存時本次有效 */ } }
  /** 短促、悅耳的獲獎音效（Web Audio 合成，不需音檔；失敗就安靜略過） */
  var audioCtx = null;
  function playFanfare() {
    if (!soundOn()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t0 = audioCtx.currentTime + 0.02;
      [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.3], [1318.5, 0.42]].forEach(function (n, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = i < 3 ? 'triangle' : 'sine';
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(i < 3 ? 0.16 : 0.12, t0 + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + (i < 3 ? 0.35 : 0.7));
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0 + n[1]); o.stop(t0 + n[1] + 0.8);
      });
    } catch (e) { /* 音效失敗不影響畫面 */ }
  }
  var theaterQueue = [], theaterBusy = false;
  function thStill() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /** 排隊顯示（同一事件一次演出；其他視窗開著時等它關掉再演，避免互相蓋住） */
  function showAchTheater(child, list) {
    if (!child || !list || !list.length) return;
    if (window.__cgpNoTheater) {   // 自動測試用：改成文字提示，和畫面上既有的提示合併
      var t = '🏆 解鎖成就：' + list.map(function (a) { return a.icon + ' ' + a.name; }).join('、');
      toast(toastEl.hidden ? t : toastEl.textContent + '\n' + t, 'pos');
      return;
    }
    theaterQueue.push({ child: child, list: list.slice() });
    pumpTheater();
  }
  function pumpTheater() {
    if (theaterBusy || !theaterQueue.length) return;
    var blocked = (confirmEl && confirmEl.open) || (modal && modal.open) || document.getElementById('clear-screen') || document.getElementById('mg');
    if (blocked) { setTimeout(pumpTheater, 350); return; }
    theaterBusy = true;
    openTheater(theaterQueue.shift());
  }
  function openTheater(job) {
    var child = job.child, list = job.list.slice().sort(function (x, y) { return achRank(y) - achRank(x); });
    var main = list[0], others = list.slice(1), many = list.length > 1;
    var dlg = document.createElement('dialog');
    dlg.className = 'ach-theater' + (thStill() ? ' still' : '');
    dlg.id = 'ach-theater';
    dlg.setAttribute('aria-labelledby', 'ach-theater-title');
    var sparks = new Array(19).join('<i></i>'), hearts = '<b>♥</b><b>♥</b><b>♥</b>';
    dlg.innerHTML = '<div class="th-stage">' +
      '<div class="th-beam" aria-hidden="true"></div>' +
      '<div class="th-burst" aria-hidden="true">' + sparks + hearts + '</div>' +
      '<div class="th-card" tabindex="-1" autofocus>' +
        '<button type="button" class="th-sound" data-th="sound" aria-pressed="' + soundOn() + '" aria-label="成就音效">' + (soundOn() ? '🔊' : '🔇') + '</button>' +
        '<p class="th-kicker" aria-hidden="true">✦ ✧ ✦</p>' +
        '<h2 id="ach-theater-title">' + (many ? '🎉 哇！一次解鎖 ' + list.length + ' 個成就！' : '🎉 成就解鎖！') + '</h2>' +
        '<p class="th-who">' + h(child.name) + '</p>' +
        '<div class="th-left"><div class="th-main">' + badgeHtml(main, 'lg') + '</div>' +
        '<div class="th-actions"><button type="button" class="btn primary block" data-th="collection">🏆 查看我的成就收藏</button>' +
        '<button type="button" class="btn block th-go" data-th="close">繼續冒險</button></div></div>' +
        '<h3 class="th-name" data-th-name>' + h(main.name) + '</h3>' +
        '<p class="th-desc" data-th-desc>' + h(main.desc) + '</p>' +
        (others.length ? '<div class="th-more"><p class="th-more-title">同時解鎖另外 ' + others.length + ' 個成就（點一下看看）</p>' +
          '<div class="th-strip" role="list">' + list.map(function (a, i) {
            return '<button type="button" class="th-mini' + (i === 0 ? ' on' : '') + '" role="listitem" data-th-pick="' + i + '" aria-label="' + h(a.name) + '">' + badgeHtml(a, 'sm') + '<small>' + h(a.name) + '</small></button>';
          }).join('') + '</div></div>' : '') +
      '</div></div>';
    document.body.appendChild(dlg);
    var pushed = false, closed = false;
    function close(viaBack) {
      if (closed) return;
      closed = true;
      dlg.classList.add('leaving');
      setTimeout(function () { try { dlg.close(); } catch (e) { /* 已關閉 */ } dlg.remove(); theaterBusy = false; pumpTheater(); }, thStill() ? 0 : 160);
      window.removeEventListener('popstate', onPop);
      if (pushed && !viaBack) { pushed = false; history.back(); }
    }
    function onPop() { pushed = false; close(true); }   // 手機返回鍵：只關閉劇場，不離開頁面
    try { history.pushState({ achTheater: 1 }, ''); pushed = true; window.addEventListener('popstate', onPop); } catch (e) { /* 不支援時用按鈕關閉 */ }
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(false); });   // Esc
    dlg.addEventListener('click', function (e) {
      var t = e.target.closest('[data-th], [data-th-pick]');
      if (!t) return;
      if (t.dataset.thPick != null) {
        var a = list[Number(t.dataset.thPick)];
        dlg.querySelectorAll('.th-mini').forEach(function (b) { b.classList.toggle('on', b === t); });
        dlg.querySelector('.th-main').innerHTML = badgeHtml(a, 'lg');
        dlg.querySelector('[data-th-name]').textContent = a.name;
        dlg.querySelector('[data-th-desc]').textContent = a.desc;
        return;
      }
      if (t.dataset.th === 'sound') {
        var on = !soundOn(); setSound(on);
        t.textContent = on ? '🔊' : '🔇'; t.setAttribute('aria-pressed', String(on));
        if (on) playFanfare();
        return;
      }
      if (t.dataset.th === 'collection') {
        ui.achOpen = child.id; ui.achScroll = true; ui.achNew = list.map(function (a) { return a.id; });
        close(false);
        setTimeout(function () {
          if (location.hash === '#child-' + child.id) { render(); var ad = document.getElementById('ach-details'); if (ad) ad.scrollIntoView({ block: 'start' }); ui.achScroll = false; }
          else go('#child-' + child.id);
        }, 60);
        return;
      }
      close(false);
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    playFanfare();
  }
  /** 金島通關：城堡門前慶祝空地（第四區 x 390～690、y 450～650）放煙火與彩帶約 2 秒，再顯示全螢幕慶祝 */
  function mapFireworks() {
    var world = document.getElementById('map-world');
    if (!world) return Promise.resolve();
    var el = document.createElement('div');
    el.className = 'map-fireworks'; el.setAttribute('aria-hidden', 'true');
    var bursts = [[440, 470, 0], [640, 480, 0.35], [540, 430, 0.7], [470, 560, 1.05], [610, 580, 1.25]];
    el.innerHTML = bursts.map(function (b, k) {
      return '<span class="fw-burst fw-c' + (k % 4) + '" style="left:' + b[0] + 'px;top:' + b[1] + 'px;animation-delay:' + b[2] + 's">' +
        new Array(13).join('<i></i>') + '</span>';
    }).join('') + '<span class="fw-ribbons">' + new Array(19).join('<i></i>') + '</span>';
    world.appendChild(el);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return sleep(reduce ? 300 : 2200).then(function () { el.remove(); });
  }
  /** 金島通關：全螢幕慶祝畫面（動畫失敗不影響已存檔的獎勵） */
  function showClear(child, ev) {
    var el = document.createElement('div');
    el.className = 'clear-screen'; el.id = 'clear-screen';
    el.innerHTML = '<div class="confetti" aria-hidden="true">' + new Array(25).join('<i></i>') + '</div>' +
      '<div class="clear-card"><div class="clear-crown">👑</div><h2>恭喜通關' + h(ev.clear.name || '金島') + '！</h2>' +
      '<p class="clear-sub">' + h(child.name) + ' 抵達了' + h(ev.clear.goal || '終點') + (ev.clear.count > 1 ? '（第 ' + ev.clear.count + ' 次）' : '') + '</p>' +
      '<span class="clear-pawn">' + characterArt(child) + '</span>' +
      '<ul class="clear-rewards">' + (ev.clear.first
        ? '<li><img src="images/items/mystery_chest.webp" alt="" width="48" height="48"> 神秘寶箱 ×1（不用鑰匙）</li>' + (ev.clear.island === 'gold' || !ev.clear.island ? '<li><span>🏅</span> 成就「金島通關」</li>' : '')
        : '<li>' + STAR_IMG + ' 能量星星 +' + GAME.GOLD_CLEAR_STARS + '</li>') + '</ul>' +
      '<p class="muted small">' + (ev.clear.next ? '下次出發會前往「' + h(ev.clear.next) + '」！' : '下次出發會從起點開始新的一輪') + '</p>' +
      '<button type="button" class="btn primary block" data-clear-ok>太棒了！</button></div>';
    document.body.appendChild(el);
    toastEl.hidden = true;   // 通關畫面已列出成就，不另外跳提示
    el.querySelector('[data-clear-ok]').onclick = function () { el.remove(); render(); announceAchievements(child.id, ['goldClear1']); };   // 通關畫面已列出「金島通關」，劇場不重複演出
  }

  /** 今日小結（結束今日冒險時、或之後在冒險大廳查看） */
  function showSummary(childId, justEnded) {
    var s = store.getDaySummary(childId), child = store.getChild(childId);
    var nameOf = function (k) { return (BAG_INFO[k] && BAG_INFO[k].name) || (k === 'goldenKey' ? '黃金鑰匙' : k); };
    var list = function (o) { return Object.keys(o).map(function (k) { return nameOf(k) + ' ×' + o[k]; }).join('、'); };
    var stars = s.stars.settle + s.stars.gained;
    var rows = [
      ['👣', '今天走了', s.moved > 0 ? s.moved + ' 格（第 ' + s.startPos + ' → ' + s.endPos + ' 格）' : s.moved < 0 ? '往回 ' + (-s.moved) + ' 格' : '還沒移動'],
      ['🎲', '擲骰', s.rolls + ' 次'],
      ['⭐', '得到能量星星', stars + ' 顆' + (s.stars.spent ? '（用掉 ' + s.stars.spent + ' 顆）' : '')]
    ];
    if (s.minigames.length) rows.push(['🎮', '抓住星星', s.minigames.map(function (m) { return '抓到 ' + m.caught + ' 顆'; }).join('、')]);
    var got = list(s.itemsGained), used = list(s.itemsUsed);
    if (got) rows.push(['🎒', '得到的道具', got]);
    if (used) rows.push(['✨', '用掉的道具', used]);
    if (s.specialTasks.length) rows.push(['🔮', '新的特殊任務', s.specialTasks.join('、')]);
    if (s.chests.onMap || s.chests.coming) rows.push(['🎁', '神秘寶箱', s.chests.onMap ? '地圖上還有 ' + s.chests.onMap + ' 個等你去撿' + (s.chests.coming ? '，另外 ' + s.chests.coming + ' 個下次出現' : '') : s.chests.coming + ' 個神秘寶箱下次冒險時會出現在你前方！']);
    confirmEl.innerHTML = '<div class="confirm-box summary-box"><h2>' + (justEnded ? '🏁 今天的冒險結束了！' : '📋 今日小結') + '</h2>' +
      '<p class="muted small">' + h(child.name) + '，今天辛苦了！明天繼續冒險吧～</p>' +
      '<ul class="summary-list">' + rows.map(function (r) { return '<li><span class="sum-ico">' + r[0] + '</span><b>' + r[1] + '</b><span>' + h(r[2]) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="modal-actions"><button type="button" class="btn primary" data-yes>好！</button></div></div>';
    confirmEl.querySelector('[data-yes]').onclick = function () { confirmEl.close(); render(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
  }

  /** 寶物磁鐵：列出前後 5 格內的寶箱讓孩子選 */
  function openMagnet(childId) {
    var targets = store.getMagnetTargets(childId), pos = store.getPlayer(childId).pos;
    if (!targets.length) { toast('前後 ' + GAME.MAGNET_RANGE + ' 格內沒有寶箱', 'neg'); return; }
    confirmEl.innerHTML = '<div class="confirm-box magnet-box"><h2>🧲 寶物磁鐵</h2><p class="muted small">選一個前後 ' + GAME.MAGNET_RANGE + ' 格內的寶箱吸過來：</p>' +
      '<div class="magnet-list">' + targets.map(function (t) {
        var d = t.n - pos;
        return '<button type="button" class="magnet-opt" data-type="' + t.type + '" data-id="' + h(t.id) + '">' +
          '<img src="' + (t.type === 'mystery' ? 'images/items/mystery_chest.webp' : 'images/tiles/chest.webp') + '" alt="" width="48" height="48">' +
          '<span><b>第 ' + t.n + ' 格・' + t.name + '</b><small>' + (d > 0 ? '前方 ' + d + ' 格' : '後方 ' + (-d) + ' 格') + '</small></span></button>';
      }).join('') + '</div><div class="modal-actions"><button type="button" class="btn" data-no>取消</button></div></div>';
    confirmEl.querySelectorAll('.magnet-opt').forEach(function (b) {
      b.onclick = function () {
        confirmEl.close();
        try {
          var r = store.useMagnet(childId, b.getAttribute('data-type'), b.getAttribute('data-id'));
          render();
          showReward('🧲 寶物磁鐵', r.text, r.type === 'mystery' ? 'images/items/mystery_chest.webp' : 'images/tiles/chest.webp', r.type === 'mystery' ? 'mystery' : 'chest');
        } catch (err) { toast(err.message, 'neg'); render(); }
      };
    });
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
  }


  // ---------- 小遊戲「抓住星星」 ----------
  /**
   * 全螢幕小遊戲：第 1 顆星在正中央，點到才開始 10 秒計時。
   * 前 5 秒：每 1 秒出現 1 顆、停留 1.2 秒；後 5 秒加快：每 0.7 秒出現 2 顆、停留 0.8 秒、大小 0.5 倍。
   * 星星出現數不限；每抓 1 顆得 1 顆能量星星，最多 GAME.MINIGAME_MAX_STARS 顆；按「收下」才寫入。
   */
  function openMinigame(childId, subtitle, opts) {
    var practice = !!(opts && opts.practice);   // 試玩模式：不寫入存檔、不給星星、不算每日次數
    if (document.getElementById('mg')) return;
    if (!practice && !store.getPendingMinigame(childId)) return;
    var MAX = GAME.MINIGAME_MAX_STARS, SEC = GAME.MINIGAME_SECONDS;
    // 2026-11-08 家長調整（孩子反映星星消失太快）：每顆多停留 0.5 秒、出現數量 1.5 倍（間隔縮為 2/3）
    var PHASES = [{ until: 5000, gap: 667, life: 1700, count: 1, small: false },   // 前 5 秒
      { until: SEC * 1000, gap: 467, life: 1300, count: 2, small: true }];           // 後 5 秒：加快、一次 2 顆、縮小
    var el = document.createElement('div');
    el.className = 'mg' + (practice ? ' practice' : ''); el.id = 'mg';
    el.innerHTML = '<div class="mg-top"><span class="mg-count"><img class="mg-ico" src="images/minigame/star.webp" alt="⭐" width="256" height="256"> <b id="mg-count">0</b></span>' +
      '<span class="mg-time"><i id="mg-bar"></i></span><b class="mg-sec" id="mg-sec">' + SEC + '</b></div>' +
      '<div class="mg-field" id="mg-field"></div>' +
      '<div class="mg-tip" id="mg-tip"><b>⭐ 抓住星星！</b>' + (subtitle ? '<small>' + h(subtitle) + '</small>' : '') +
      '<span>點正中央的星星開始，' + SEC + ' 秒內盡量多抓！</span>' +
      (practice ? '<small class="mg-practice">🧪 試玩模式：不會得到星星，也不算今天的次數</small>' : '') +
      '<button type="button" class="btn link mg-later" data-mg="later">' + (practice ? '離開試玩' : '稍後再玩') + '</button></div>';
    document.body.appendChild(el);
    document.body.classList.add('mg-open');
    var field = el.querySelector('#mg-field'), countEl = el.querySelector('#mg-count');
    var caught = 0, timers = [], started = false, ended = false, last = null;
    function addStar(x, y, first, life, small) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mg-star' + (first ? ' first' : '') + (small ? ' small' : ''); b.setAttribute('aria-label', '星星');
      b.style.left = x + '%'; b.style.top = y + '%';
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (b.classList.contains('got') || ended) return;
        b.classList.add('got'); caught++; countEl.textContent = caught;
        setTimeout(function () { b.remove(); }, 260);
        if (first) start();
      });
      field.appendChild(b);
      if (!first) timers.push(setTimeout(function () { if (!b.classList.contains('got')) { b.classList.add('miss'); setTimeout(function () { b.remove(); }, 250); } }, life));
    }
    function randomSpot() {
      var x, y, tries = 0;
      do { x = 14 + Math.random() * 72; y = 14 + Math.random() * 58; tries++; }
      while (last && Math.hypot(x - last[0], y - last[1]) < 22 && tries < 20);
      last = [x, y];
      return last;
    }
    function start() {
      started = true;
      el.querySelector('#mg-tip').hidden = true;
      var t0 = performance.now(), bar = el.querySelector('#mg-bar'), sec = el.querySelector('#mg-sec');
      var tick = setInterval(function () {
        var left = Math.max(0, SEC * 1000 - (performance.now() - t0));
        bar.style.width = (left / (SEC * 10)) + '%'; sec.textContent = Math.ceil(left / 1000);
        if (left <= 0) { clearInterval(tick); finish(); }
      }, 100);
      timers.push(tick);
      // 依階段持續出現星星，直到時間結束（數量不限）
      (function spawn() {
        if (ended) return;
        var t = performance.now() - t0;
        var ph = PHASES[0].until > t ? PHASES[0] : PHASES[1];
        if (t >= SEC * 1000 - 300) return;
        for (var k = 0; k < ph.count; k++) { var p = randomSpot(); addStar(p[0], p[1], false, ph.life, ph.small); }
        timers.push(setTimeout(spawn, ph.gap));
      })();
    }
    function finish() {
      ended = true;
      timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      field.innerHTML = '';
      var res = document.createElement('div');
      res.className = 'mg-result';
      var gain = Math.min(MAX, caught);
      res.innerHTML = '<b>' + (caught >= MAX ? '🎉 太厲害了！' : caught >= 6 ? '👏 好厲害！' : '✨ 完成！') + '</b>' +
        '<p>抓到 <strong>' + caught + '</strong> 顆星星</p>' +
        (practice ? '<p class="mg-practice-note">🧪 試玩模式，不會得到星星</p>' +
          '<div class="mg-acts"><button type="button" class="btn" data-mg="exit">離開</button><button type="button" class="btn primary" data-mg="again">再玩一次</button></div>'
          : '<p class="mg-gain">' + STAR_IMG + ' +' + gain + ' 能量星星</p>' + (caught > MAX ? '<p class="mg-cap">（每局最多 ' + MAX + ' 顆能量星星）</p>' : '') +
            '<button type="button" class="btn primary" data-mg="claim">收下</button>');
      el.appendChild(res);
      if (practice) {
        res.querySelector('[data-mg=again]').onclick = function () { cleanup(); openMinigame(null, null, opts); };
        res.querySelector('[data-mg=exit]').onclick = close;
        return;
      }
      res.querySelector('[data-mg=claim]').onclick = function () {
        try {
          var m = store.finishMinigame(childId, caught);
          toast('⭐ 小遊戲得到 ' + m.stars + ' 顆能量星星！', 'pos');
        } catch (err) { toast(err.message, 'neg'); }
        close();
      };
    }
    function cleanup() {
      timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      el.remove(); document.body.classList.remove('mg-open');
    }
    function close() {
      cleanup();
      if (practice) { location.replace('#home'); render(); } else render();
    }
    el.querySelector('[data-mg=later]').onclick = function () {
      if (started) return;
      if (!practice) toast('小遊戲留著，等一下再玩');
      close();
    };
    addStar(50, 44, true, 0, false);
  }

  /** 星星商店（對話框） */
  function openShop(childId) {
    function draw() {
      var bal = store.getStarBalance(childId);
      var bag = store.getPlayer(childId).bag;
      confirmEl.innerHTML = '<div class="confirm-box shop-box"><h2>🛒 星星商店</h2>' +
        '<p class="shop-bal">目前有 <b>' + STAR_IMG + ' ' + num(bal) + '</b></p>' +
        GAME.SHOP.map(function (it) {
          var ok = bal >= it.price;
          return '<div class="shop-row" data-item="' + it.id + '">' + itemArt(it.id, 'shop-row-icon') +
            '<span class="shop-row-main"><b>' + h(it.name) + '</b><small>' + h(it.desc) + '・背包 ×' + bag[it.id] + '</small></span>' +
            '<button class="btn ' + (ok ? 'primary' : '') + ' small" data-buy="' + it.id + '"' + (ok ? '' : ' disabled') + '>⭐' + it.price + '</button></div>';
        }).join('') +
        '<p class="muted small">買來的道具放進背包，沒用完隔天仍然保留。每天最多擲 3 次骰子。</p>' +
        '<div class="modal-actions"><button type="button" class="btn" data-no>完成</button></div></div>';
      confirmEl.querySelectorAll('[data-buy]').forEach(function (b) {
        b.onclick = function () {
          try { var it = store.buyItem(childId, b.getAttribute('data-buy')); toast('買到 ' + it.name + '！', 'pos'); }
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
    confirmEl.innerHTML = '<div class="confirm-box"><h2>更換 ' + h(child.name) + ' 的頭像</h2><div class="char-pick">' +
      GAME.CHARACTERS.map(function (c) {   // 頭像就代表孩子，不另外顯示角色名稱
        return '<button class="char-opt ' + (c.id === cur ? 'active' : '') + '" data-char="' + c.id + '" aria-label="' + h(c.name) + '">' + charImg(c.id) + '</button>';
      }).join('') + '</div><p class="muted small">每個孩子各自選擇，隨時可以更換。</p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-no>取消</button></div></div>';
    confirmEl.querySelectorAll('[data-char]').forEach(function (b) {
      b.onclick = function () { store.setCharacter(childId, b.getAttribute('data-char')); confirmEl.close(); toast('已更換頭像', 'pos'); render(); };
    });
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
  }

  /** 進入今日冒險：一個視窗列出所有孩子，勾選後一起結算出發（已出發打 ✅、未解鎖顯示原因） */
  function enterAdventure(childId) {
    var st = store.getAdventureStatus(childId);
    if (st.settled) { go('#adventure-' + childId); return; }
    var kids = store.getChildren();
    var rows = kids.map(function (c) {
      var s = c.id === childId ? st : store.getAdventureStatus(c.id);
      var state = s.settled ? 'done' : (s.unlocked ? 'ready' : 'locked');
      var note = state === 'done' ? '✅ 今天已出發'
        : state === 'locked' ? '🔒 今日淨得分 ' + signed(s.net) + '，大於 0 才能出發'
          : '今日淨得分 ' + signed(s.net) + ' → 得到 ⭐' + s.previewStars;
      return '<label class="go-row ' + state + '">' +
        '<input type="checkbox" value="' + h(c.id) + '"' + (state === 'ready' ? ' checked' : ' disabled') + (state === 'done' ? ' checked' : '') + '>' +
        avatar(c, 'sm') + '<span class="go-main"><b>' + h(c.name) + '</b><small>' + note + '</small></span></label>';
    }).join('');
    confirmEl.innerHTML = '<div class="confirm-box go-box"><h2>🚀 今日冒險出發</h2>' +
      '<p class="muted small">勾選要一起出發的孩子。出發時用今日淨得分結算能量星星，之後再加的分不會再增加星星（一天只結算一次）。</p>' +
      '<div class="go-list">' + rows + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn" data-no>取消</button>' +
      '<button type="button" class="btn primary" data-yes>一起出發！</button></div></div>';
    var yes = confirmEl.querySelector('[data-yes]');
    function picked() { return [].slice.call(confirmEl.querySelectorAll('.go-row.ready input:checked')).map(function (i) { return i.value; }); }
    function refresh() { var n = picked().length; yes.disabled = !n; yes.textContent = n > 1 ? n + ' 位一起出發！' : '出發！'; }
    confirmEl.querySelectorAll('.go-row.ready input').forEach(function (i) { i.onchange = refresh; });
    refresh();
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    yes.onclick = function () {
      var ids = picked(), got = [];
      ids.forEach(function (id) {
        try { var x = store.settleToday(id); got.push(store.getChild(id).name + ' ⭐' + x.stars); }
        catch (err) { toast(err.message, 'neg'); }
      });
      confirmEl.close();
      if (got.length) toast('🎉 出發！' + got.join('、'), 'pos');
      // 回到按下按鈕的孩子；若沒勾他，改到第一個出發的孩子
      var target = store.getAdventureStatus(childId).settled ? childId : ids[0];
      if (target) go('#adventure-' + target); else render();
    };
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal();
    else confirmEl.setAttribute('open', '');
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
      treasurePanel(child) +
      '<section class="panel"><h2>🎁 可兌換的獎勵</h2>' + cards +
      '<p class="muted small">兌換會扣除總點數，不影響今日淨得分與等級。</p></section>' +
      '<section class="panel"><h2>🧾 兌換紀錄</h2>' + histHtml + '</section></main>';
  }

  // ---------- 家長密碼 ----------
  /** 進設定前的密碼畫面：第一次設定、輸入解鎖、忘記密碼（答對家長驗證題後重設） */
  function renderPinGate() {
    var mode = !store.hasParentPin() || ui.pinMode === 'reset' ? 'set' : ui.pinMode === 'forgot' ? 'forgot' : 'enter';
    var inp = function (id, ph) { return '<input id="' + id + '" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="' + ph + '">'; };
    var body;
    if (mode === 'set') {
      body = '<h2>🔐 設定家長密碼</h2><p class="muted small">請設定 4 位數密碼，之後進入設定、發送神諭祝福都要輸入。孩子不知道密碼就不能修改規則或發獎勵。</p>' +
        inp('pin-1', '輸入 4 位數') + inp('pin-2', '再輸入一次') +
        '<button class="btn primary block" data-action="pin-submit" data-mode="set">設定密碼</button>' +
        (store.hasParentPin() && ui.pinMode === 'reset' && store.isParentUnlocked() ? '<button class="btn link" data-action="pin-cancel">取消</button>' : '');
    } else if (mode === 'forgot') {
      if (!ui.pinQuiz) ui.pinQuiz = [12 + Math.floor(Math.random() * 80), 12 + Math.floor(Math.random() * 80)];
      body = '<h2>🤔 忘記密碼</h2><p class="muted small">請家長回答下面的問題，答對後可以重設密碼。</p>' +
        '<p class="pin-quiz-q">' + ui.pinQuiz[0] + ' × ' + ui.pinQuiz[1] + ' = ？</p>' +
        '<input id="pin-quiz" class="pin-input" type="text" inputmode="numeric" autocomplete="off" placeholder="答案">' +
        '<button class="btn primary block" data-action="pin-quiz">確認</button><button class="btn link" data-action="pin-cancel">返回</button>';
    } else {
      body = '<h2>🔒 家長專區</h2><p class="muted small">請輸入家長密碼</p>' + inp('pin-1', '4 位數密碼') +
        '<button class="btn primary block" data-action="pin-submit" data-mode="enter">進入設定</button>' +
        '<button class="btn link" data-action="pin-forgot">忘記密碼？</button>';
    }
    return '<header class="topbar"><a class="icon-btn" href="#home" aria-label="回首頁">‹</a><h1>設定</h1><span class="icon-btn"></span></header>' +
      '<main class="page"><section class="card pin-card" data-testid="pin">' + body + '</section></main>';
  }
  function submitPin() {
    var a = app.querySelector('#pin-1'), b = app.querySelector('#pin-2');
    var setMode = !!b;
    if (setMode) {
      if (!/^\d{4}$/.test(a.value)) { toast('請輸入 4 位數字', 'neg'); return; }
      if (a.value !== b.value) { toast('兩次輸入的密碼不一樣', 'neg'); return; }
      store.setParentPin(a.value);
      ui.pinMode = null;
      toast('🔐 家長密碼已設定', 'pos');
      render();
      return;
    }
    if (store.unlockParent(a.value)) { render(); }
    else { a.value = ''; toast('密碼不對', 'neg'); a.focus(); }
  }

  // ---------- 神諭祝福（媽媽加碼） ----------
  function blessingArt(b, cls) {
    return '<span class="item-art ' + (cls || '') + '">' + (b.img ? '<img src="' + b.img + '" alt="" aria-hidden="true" decoding="async">' : '<span class="bag-emoji">' + b.icon + '</span>') + '</span>';
  }
  function settingsBlessing() {
    var kids = store.getChildren();
    if (!kids.length) return '<p class="muted">請先新增孩子。</p>';
    var sel = ui.blessChild && store.getChild(ui.blessChild) ? ui.blessChild : kids[0].id;
    var kind = ui.blessKind || 'chest';
    var hist = store.getBlessings().slice(0, 20);
    return '<section class="card bless-form" data-testid="blessing"><h2>🌟 神諭祝福</h2>' +
      '<p class="muted small">家長送給孩子的特別獎勵，不消耗生活點數和能量星星，也不算寶物商店的每週件數。</p>' +
      '<div class="bless-kids">' + kids.map(function (c) {
        return '<label class="bless-kid' + (c.id === sel ? ' on' : '') + '"><input type="radio" name="bless-child" value="' + h(c.id) + '"' + (c.id === sel ? ' checked' : '') + '>' + avatar(c, 'sm') + '<b>' + h(c.name) + '</b></label>';
      }).join('') + '</div>' +
      '<div class="bless-kinds">' + GAME.BLESSINGS.map(function (b) {
        return '<label class="bless-kind' + (b.id === kind ? ' on' : '') + '"><input type="radio" name="bless-kind" value="' + b.id + '"' + (b.id === kind ? ' checked' : '') + '>' +
          blessingArt(b, 'bless-art') + '<span><b>' + b.icon + ' ' + b.name + '</b><small>' + h(b.desc) + '</small></span></label>';
      }).join('') + '</div>' +
      '<label class="field">數量<select id="bless-qty">' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">' + n + ' 份</option>'; }).join('') + '</select></label>' +
      '<label class="field">鼓勵的話（選填）<input id="bless-msg" type="text" maxlength="100" placeholder="例如：今天主動收玩具，好棒！"></label>' +
      '<button class="btn primary block" data-action="blessing-send">送出神諭祝福</button></section>' +
      '<section class="card"><h2>🧾 最近發送紀錄</h2>' + (hist.length ? '<ul class="rows bless-hist">' + hist.map(function (x) {
        var b = GAME.BLESSINGS.find(function (y) { return y.id === x.kind; }) || { icon: '🎁', name: x.kind };
        var c = store.getChild(x.childId);
        var t = new Date(x.ts);
        return '<li class="row"><span class="row-main"><b>' + b.icon + ' ' + h(b.name) + ' ×' + x.qty + ' → ' + h(c ? c.name : '') + '</b>' +
          '<small>' + (t.getMonth() + 1) + '/' + t.getDate() + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') +
          (x.message ? '・「' + h(x.message) + '」' : '') + (x.seen ? '・已領取' : '・尚未打開') + '</small></span></li>';
      }).join('') + '</ul>' : '<p class="muted small">還沒有發送紀錄</p>') + '</section>' +
      '<section class="card"><h2>🔐 家長密碼</h2><button class="btn block" data-action="pin-change">更換家長密碼</button></section>';
  }
  function sendBlessingFromForm() {
    var c = app.querySelector('input[name=bless-child]:checked'), k = app.querySelector('input[name=bless-kind]:checked');
    var qty = Number(app.querySelector('#bless-qty').value), msg = app.querySelector('#bless-msg').value;
    var child = store.getChild(c.value), b = GAME.BLESSINGS.find(function (x) { return x.id === k.value; });
    ui.blessChild = c.value; ui.blessKind = k.value;
    confirmThen('送給 ' + child.name + '：' + b.icon + ' ' + b.name + ' ×' + qty + (msg.trim() ? '\n鼓勵的話：「' + msg.trim() + '」' : '') + '\n確定送出嗎？', '送出', false, function () {
      store.sendBlessing(c.value, k.value, qty, msg);
      toast('🌟 已送出神諭祝福給 ' + child.name, 'pos');
    });
  }
  /** 孩子進冒險大廳時，顯示還沒看過的神諭祝福（獎勵在發送時已加入，這裡只是領取畫面） */
  function showBlessings(childId) {
    var list = store.getUnseenBlessings(childId);
    if (!list.length || (confirmEl.open)) return;
    var stars = 0;
    var rows = list.map(function (x) {
      var b = GAME.BLESSINGS.find(function (y) { return y.id === x.kind; });
      if (x.kind === 'luckyStar') stars += GAME.LUCKY_STAR * x.qty;
      return '<div class="bless-get bk-' + x.kind + '">' + blessingArt(b, 'bless-get-art') +
        '<span><b>' + b.icon + ' ' + b.name + ' ×' + x.qty + '</b>' + (x.kind === 'luckyStar' ? '<small>+' + (GAME.LUCKY_STAR * x.qty) + ' 能量星星</small>' : '<small>' + h(b.desc) + '</small>') +
        (x.message ? '<em>「' + h(x.message) + '」</em>' : '') + '</span></div>';
    }).join('');
    confirmEl.innerHTML = '<div class="confirm-box bless-box"><h2>🌟 神諭祝福</h2><p class="muted small">有一份特別的祝福送給你！</p>' +
      (stars ? '<div class="star-rain" aria-hidden="true">' + new Array(10).join('<i></i>') + '<i></i></div>' : '') +
      '<div class="bless-list">' + rows + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn primary" data-yes>收下</button></div></div>';
    confirmEl.querySelector('[data-yes]').onclick = function () { store.markBlessingsSeen(childId); confirmEl.close(); render(); };
    confirmEl.oncancel = function (e) { e.preventDefault(); };
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
  }
  /** 開箱結果（簡短動畫；動畫失敗不影響已存檔的結果） */
  function showReward(title, text, img, kind) {
    confirmEl.innerHTML = '<div class="confirm-box reward-box rb-' + kind + '"><h2>' + h(title) + '</h2>' +
      '<span class="reward-art"><img src="' + img + '" alt="" aria-hidden="true"></span>' +
      '<p class="confirm-msg">' + h(text) + '</p><div class="modal-actions"><button type="button" class="btn primary" data-yes>太好了！</button></div></div>';
    confirmEl.querySelector('[data-yes]').onclick = function () { confirmEl.close(); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
  }

  /** 地圖上的特殊道具列（只顯示持有的道具） */
  function itemBar(child, player, st) {
    var list = [];
    var bag = player.bag, busy = !st.canPlay || st.pending || st.picking;
    // 寶箱：隨時可以開（不用出發）；地圖撿到的神秘寶箱要黃金鑰匙
    [['chest', '一般寶箱'], ['giftMysteryChest', '神秘寶箱'], ['mysteryChest', '神秘寶箱']].forEach(function (c) {
      if (!bag[c[0]]) return;
      var b = BAG_INFO[c[0]];
      var needKey = c[0] === 'mysteryChest';
      list.push('<button type="button" class="item-btn chest-btn" data-action="open-chest" data-id="' + c[0] + '" data-kind="' + c[0] + '"' + (st.pending || st.picking ? ' disabled' : '') + '>' +
        '<span class="item-art item-btn-art"><img src="' + b.img + '" alt="" aria-hidden="true" width="256" height="256" decoding="async"></span>' +
        '<b>' + c[1] + '</b><small>×' + bag[c[0]] + '・' + (needKey ? (bag.goldenKey ? '用鑰匙開' : '要黃金鑰匙') : '點我開箱') + '</small></button>');
    });
    var magicUsed = store.magicUsedToday(child.id);
    function btn(id, action, label, note, disabled) {
      var b = BAG_INFO[id];
      var art = b.img ? '<img src="' + b.img + '" alt="" aria-hidden="true" width="256" height="256" decoding="async">' : '<span class="bag-emoji">' + b.icon + '</span>';
      list.push('<button type="button" class="item-btn" data-action="' + action + '" data-kind="' + id + '"' + (disabled ? ' disabled' : '') + '>' +
        '<span class="item-art item-btn-art">' + art + '</span><b>' + label + '</b><small>' + note + '</small></button>');
    }
    if (bag.magicDice) btn('magicDice', 'roll', '神奇骰子', magicUsed ? '今天已用・×' + bag.magicDice : '×' + bag.magicDice + '・不占次數', busy || magicUsed);
    var lim = store.getItemLimitsToday(child.id);   // 前進類合計每天 5 次、任意門每天 1 次
    if (bag.wings) btn('wings', 'use-item', '飛行翼 +20', '×' + bag.wings + (lim.move ? '・今天剩 ' + lim.move + ' 次' : '・今天已用完'), busy || !lim.move);
    if (bag.door) btn('door', 'pick-door', '任意門', '×' + bag.door + (lim.door ? '・每天 1 次' : '・今天已用'), busy || !lim.door);
    if (bag.luckyMedal) btn('luckyMedal', 'activate-medal', '好運金牌', player.medalArmed ? '已啟用・×' + bag.luckyMedal : '×' + bag.luckyMedal + '・點我啟用', !!player.medalArmed);
    if (bag.bonusPlay) btn('bonusPlay', 'activate-bonus', '再來 3 次', '×' + bag.bonusPlay + '・點我啟用', busy);
    if (bag.magnet) btn('magnet', 'use-magnet', '寶物磁鐵', '×' + bag.magnet + '・前後 ' + GAME.MAGNET_RANGE + ' 格', busy);
    if (bag.shield) btn('shield', 'item-info', '防護罩', '×' + bag.shield + '・自動抵擋', false);
    if (bag.rerollTicket) btn('rerollTicket', 'item-info', '命運重骰券', '×' + bag.rerollTicket + '・擲骰後可用', false);
    if (bag.airplane) btn('airplane', 'item-info', '呼叫專機', '×' + bag.airplane + '・其他島嶼開放後', false);
    if (bag.goldenKey) btn('goldenKey', 'item-info', '黃金鑰匙', '×' + bag.goldenKey + '・開神秘寶箱', false);
    var games = st.quota.games ? '<p class="medal-on">🎮 再來 3 次：今天還有 ' + st.quota.rolls + ' 次擲骰、' + st.quota.games + ' 次小遊戲</p>' : '';
    return games + (list.length ? '<section class="item-bar" data-testid="item-bar"><h3 class="item-bar-title">🎒 背包道具</h3>' + list.join('') + '</section>' : '');
  }
  var ITEM_INFO = {
    shield: '🛡️ 防護罩：停在命運格抽到「後退」時，會自動擋住，不用手動使用。',
    rerollTicket: '🎲 命運重骰券：擲骰後會先問你要不要重擲；重擲以新的點數為準，同一次只能用 1 張。',
    airplane: '✈️ 呼叫專機：可以直接飛到其他島嶼的入口，其他島嶼開放後才能使用。',
    goldenKey: '🔑 黃金鑰匙：打開地圖上撿到的神秘寶箱。累計得分每 +500 點送 1 把，星星商店也有賣。'
  };

  /** 冒險寶物商店：用生活點數兌換冒險寶物（每週 3 件、同款持有 2 件） */
  function treasurePanel(child) {
    var bag = store.getPlayer(child.id).bag;
    var used = store.getTreasureBoughtThisWeek(child.id);
    return '<section class="panel treasure-panel" data-testid="treasure"><h2>🎒 冒險寶物商店 <small>本週已兌換 ' + used + ' / ' + GAME.TREASURE_WEEKLY_LIMIT + ' 件</small></h2>' +
      '<div class="treasure-grid">' + GAME.TREASURES.map(function (t) {
        var chk = store.canBuyTreasure(child.id, t.id);
        return '<div class="treasure-card' + (chk.ok ? ' can' : '') + '" data-treasure="' + t.id + '">' +
          '<span class="item-art treasure-art"><img src="' + t.img + '" alt="" aria-hidden="true" width="256" height="256" decoding="async" draggable="false"></span>' +
          '<span class="treasure-main"><b>' + h(t.name) + '</b><small>' + h(t.desc) + '</small>' +
          '<span class="treasure-meta"><span class="treasure-price"><i class="coin" aria-hidden="true">點</i>' + t.price + ' 點</span><span class="treasure-own">背包 ×' + (bag[t.id] || 0) + '</span></span></span>' +
          '<button class="btn ' + (chk.ok ? 'primary' : '') + ' small treasure-buy" data-action="buy-treasure" data-id="' + t.id + '"' + (chk.ok ? '' : ' disabled') + '>' +
          (chk.ok ? '兌換' : h(chk.reason)) + '</button></div>';
      }).join('') + '</div>' +
      '<p class="muted small">用生活點數兌換，放進冒險背包；每週最多 ' + GAME.TREASURE_WEEKLY_LIMIT + ' 件，同款最多持有 ' + GAME.TREASURE_HOLD_LIMIT + ' 件。不消耗能量星星。</p></section>';
  }

  /** 冒險大廳的背包：顯示持有的道具（使用方式在地圖上；寶物效果逐步開放） */
  var BAG_INFO = {
    d6: { name: '6 面骰', img: 'images/items/dice_6.webp', note: '地圖上使用' },
    d12: { name: '12 面骰', img: 'images/items/dice_12.webp', note: '地圖上使用' },
    skates: { name: '溜冰鞋', img: 'images/items/roller_skate.webp', note: '地圖上使用' },
    shield: { name: '防護罩', img: 'images/items/shield.webp', note: '自動抵擋' },
    magicDice: { name: '神奇骰子', img: 'images/items/magic_dice.webp', note: '地圖上使用' },
    luckyMedal: { name: '好運金牌', img: 'images/items/lucky_medal.webp', note: '地圖上啟用' },
    wings: { name: '飛行翼', img: 'images/items/flying_wings.webp', note: '地圖上使用' },
    door: { name: '任意門', img: 'images/items/magic_door.webp', note: '地圖上使用' },
    airplane: { name: '呼叫專機', img: 'images/items/airplane.webp', note: '其他島嶼開放後可用' },
    goldenKey: { name: '黃金鑰匙', img: 'images/items/golden_key.webp', note: '開神秘寶箱' },
    magnet: { name: '寶物磁鐵', img: 'images/items/treasure_magnet.webp', note: '地圖上使用' },
    rerollTicket: { name: '命運重骰券', img: 'images/items/reroll_ticket.webp', note: '擲骰後可用' },
    bonusPlay: { name: '再來 3 次', img: 'images/items/bonus_play.webp', note: '地圖上啟用' },
    chest: { name: '一般寶箱', img: 'images/tiles/chest.webp', open: true },
    giftMysteryChest: { name: '神秘寶箱', img: 'images/items/mystery_chest.webp', open: true },
    mysteryChest: { name: '神秘寶箱（要鑰匙）', img: 'images/items/mystery_chest.webp', open: true }
  };


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
      return '<div class="score-list">' + items.map(function (i) {
        return '<button class="score-btn ' + i.kind + '" data-action="record" data-id="' + h(i.id) + '">' +
          '<span class="score-name">' + h(i.name) + '</span>' +
          '<span class="score-pts">' + h(ptsLabel(i)) + '</span></button>';
      }).join('') + '</div>';
    }
    // 單欄條列：維持原本依分數排列的順序，但不再插入「+2　2 項」分類標題（每列右側已有分數）
    function grouped(items) {
      return btns(groupByPoints(items).reduce(function (all, g) { return all.concat(g.items); }, []));
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
      '<button class="seg-btn bonus ' + (kind === 'bonus' ? 'active' : '') + '" data-action="score-kind" data-kind="bonus" role="tab" aria-selected="' + (kind === 'bonus') + '">👍 加分</button>' +
      '<button class="seg-btn penalty ' + (kind === 'penalty' ? 'active' : '') + '" data-action="score-kind" data-kind="penalty" role="tab" aria-selected="' + (kind === 'penalty') + '">⚠️ 扣分</button>' +
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
        return '<button class="pts-chip ' + (rp.childId === c.id ? 'active' : '') + '" data-action="report-child" data-id="' + h(c.id) + '">' + h(c.name) + '</button>';
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

    return sky(mascotLink(false) + plaque('記分總覽') + gear(), true) +
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
    else if (tab === 'blessing') body = settingsBlessing();
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
        (store.getSettlement(c.id) ? '<button class="btn small" data-action="resettle-day" data-id="' + h(c.id) + '">重新結算今天</button>' : '') +
        (store.isAdventureEnded(c.id) ? '<button class="btn small" data-action="reopen-day" data-id="' + h(c.id) + '">解除今天的結束</button>' : '') +
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
    var title = { child: '小孩', challenge: '本週挑戰', shop: '獎勵兌換' }[tab];
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
    var snaps = store.getSnapshots();
    var today = store.today();
    var snapRows = snaps.map(function (x) {
      var t = new Date(x.ts), hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
      var label = x.kind === 'before' ? '↩️ 還原前的狀態（' + shortDate(x.date) + ' ' + hm + '）'
        : '📅 ' + shortDate(x.date) + '（' + '日一二三四五六'.charAt(CGP.parseDateKey(x.date).getDay()) + '）' + (x.date === today ? '今天開始時' : '開始時');
      return '<li class="row snap-row" data-snap="' + h(x.id) + '"><span class="row-main"><b>' + label + '</b>' +
        '<small>' + (x.summary ? x.summary.children + ' 位孩子・' + x.summary.records + ' 筆紀錄' : '') + '</small></span>' +
        '<button class="btn small" data-action="restore-snap" data-id="' + h(x.id) + '">還原</button></li>';
    }).join('');
    return '<div class="card restore-card" data-testid="restore"><h2>♻️ 還原資料</h2>' +
      '<p class="muted small">App 每天第一次打開時會自動備份，保留最近 7 天。還原會讓<b>整個 App 回到那時的狀態</b>（點數紀錄、星星、冒險進度、背包都會回去）；還原前會先自動備份目前狀態，按錯可以再還原回來。</p>' +
      '<ul class="rows">' + (snapRows || '<li class="muted">還沒有自動備份</li>') + '</ul>' +
      '<h3>📥 載入備份檔（覆蓋全部資料）</h3><p class="muted small">選擇先前匯出的 JSON 備份檔，<b>取代</b>目前所有資料。覆蓋前會先自動備份目前狀態。</p>' +
      '<label class="btn block file-btn">選擇備份 JSON 檔<input type="file" accept="application/json,.json" data-action="import" hidden></label></div>' +
      archiveCard() +
      '<div class="card">' +
      '<h2>📤 匯出備份</h2><p class="muted small">下載包含所有孩子、規則、獎勵與紀錄的 JSON 檔。</p>' +
      '<button class="btn primary block" data-action="export">匯出 JSON</button></div>' +
      '<div class="card"><h2>📋 匯入規則表（CSV／JSON）</h2>' +
      '<p class="muted small">用 Excel 或 Google 試算表整理規則，存成 CSV 後在這裡匯入。' +
      '<b>點數紀錄全部保留</b>；已有的規則會依「規則ID」更新分數、頻率、適用孩子，新的規則會新增。' +
      '孩子依名稱對應。檔案裡沒有的規則不會被刪除。</p>' +
      '<label class="btn primary block file-btn">選擇 CSV 或 JSON 檔<input type="file" accept=".csv,text/csv,application/json,.json,text/plain" data-action="import-rules" hidden></label></div>' +
      '<p class="muted small center">App 版本：' + APP_VERSION + '</p>' +
      '<p class="muted small center">目前資料：' + d.children.length + ' 位孩子・' + d.items.length + ' 個規則・' +
      d.rewards.length + ' 個獎勵・' + d.records.length + ' 筆紀錄</p>';
  }

  /** 設定 → 備份：封存舊紀錄（只封存生活紀錄；點數、等級、成就不變） */
  function archiveCard() {
    var max = store.getArchiveMaxCutoff();
    var cut = ui.archiveCut && ui.archiveCut <= max ? ui.archiveCut : store.getArchiveDefaultCutoff();
    var n = store.getArchivePlan(cut).count;
    var carried = Object.keys(store.data.carry || {}).map(function (cid) {
      var c = store.data.carry[cid], ch = store.getChild(cid);
      return ch && (c.count || c.advCount) ? h(ch.name) + '：' + (c.count + c.advCount) + ' 筆（' + shortDate(c.until) + ' 以前）' : '';
    }).filter(Boolean);
    return '<div class="card archive-card" data-testid="archive"><h2>📦 封存舊紀錄</h2>' +
      '<p class="muted small">使用很久以後資料會越來越大。可以把<b>某天以前的生活加扣分紀錄與冒險紀錄</b>（擲骰、道具、星星收支、結算、小遊戲）存成檔案，再從手機移除。' +
      '<b>目前點數、等級、累計得分、能量星星、成就都不會改變</b>；只是紀錄頁和冒險大廳看不到那些舊明細。本週與本月的紀錄不能封存；冒險位置、背包、地圖上的寶箱不受影響。</p>' +
      '<label class="field">封存這一天以前的紀錄<input type="date" id="archive-date" max="' + max + '" value="' + cut + '"></label>' +
      '<p class="small archive-count" data-testid="archive-count">' + (n ? '會封存 <b>' + n + '</b> 筆（' + shortDate(cut) + ' 以前）' : '這一天以前沒有可以封存的紀錄') + '</p>' +
      '<button class="btn block danger" data-action="archive"' + (n ? '' : ' disabled') + '>📦 匯出封存檔並移除舊紀錄</button>' +
      (carried.length ? '<p class="muted small">已封存：' + carried.join('、') + '</p>' : '') + '</div>';
  }
  /** 封存：先下載封存檔（被移除的紀錄），再從手機移除 */
  function doArchive() {
    var cut = (document.getElementById('archive-date') || {}).value || '';
    var plan = store.getArchivePlan(cut);
    if (!plan.count) { toast('這一天以前沒有可以封存的紀錄', 'neg'); return; }
    confirmThen('封存 ' + shortDate(cut) + ' 以前的 ' + plan.count + ' 筆紀錄？（生活 ' + plan.records.length + ' 筆、冒險 ' + (plan.count - plan.records.length) + ' 筆）\n\n會先下載一個封存檔，請存到雲端硬碟或電腦。\n移除後目前點數、等級、能量星星、成就都不變，只是看不到這些舊明細。', '匯出並封存', true, function () {
      var file = { type: 'cgp-archive', version: 2, appVersion: APP_VERSION, createdAt: new Date(store.now()).toISOString(), cutoff: cut,
        children: store.getChildren().map(function (c) { return { id: c.id, name: c.name }; }), records: plan.records, adventure: plan.adventure };
      var blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'child-points-archive-before-' + cut + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      var res = store.archiveRecords(cut);
      ui.archiveCut = null;
      toast('已封存 ' + res.count + ' 筆舊紀錄，點數與成就都沒有變', 'pos');
    });
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
    var c = child || { name: '', avatar: store._nextCharacter(), color: COLORS[store.getChildren().length % COLORS.length], startPoints: 0, title: '', badge: '', weeklyGoal: 0 };
    var fields =
      '<label class="field">名稱<input type="text" name="name" maxlength="20" required value="' + h(c.name) + '"></label>' +
      '<fieldset class="field"><legend>頭像</legend><div class="pick char-radio">' + GAME.CHARACTERS.map(function (ch) {   // 頭像就代表孩子，不另外顯示角色名稱
        return '<label class="pick-item char-item"><input type="radio" name="avatar" value="' + ch.id + '"' + (ch.id === c.avatar ? ' checked' : '') + ' aria-label="' + h(ch.name) + '">' +
          '<span>' + charImg(ch.id) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<fieldset class="field"><legend>代表色</legend><div class="pick">' + COLORS.map(function (col) {
        return '<label class="pick-item color"><input type="radio" name="color" value="' + col + '"' + (col === c.color ? ' checked' : '') + '><span style="background:' + col + '"></span></label>';
      }).join('') + '</div></fieldset>' +
      '<label class="field">頭銜<input type="text" name="title" maxlength="12" placeholder="例如：小小店長、小小工程師" value="' + h(c.title || '') + '">' +
      '<small class="muted">會和等級一起顯示，例如「小小店長 Lv.5」。等級依「起始點數＋累計得分」自動換算，每 1000 分升 1 級（兌換獎勵不影響）。</small></label>' +
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
        return '<label class="chip"><input type="checkbox" name="childIds" value="' + h(c.id) + '"' + (on ? ' checked' : '') + '> ' + h(c.name) + '</label>';
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
        return '<option value="' + h(c.id) + '"' + (c.id === rec.childId ? ' selected' : '') + '>' + h(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">日期<input type="date" name="date" id="rec-date" max="' + store.today() + '" required value="' + rec.date + '"></label>' +
      '<label class="field">' + (neg ? (rec.type === 'reward' ? '扣除點數' : '扣除點數') : '點數') +
      '<input type="number" name="points" id="rec-points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(rec.points) + '"></label>' +
      '<p class="muted small ach-warn" id="rec-ach-warn" hidden></p>' +
      '<button type="button" class="btn danger block" id="rec-delete">🗑 刪除這筆紀錄</button>';
    openModal(rec.name, fields, function (fd) {
      store.updateRecord(rec.id, { childId: fd.get('childId'), date: fd.get('date'), points: fd.get('points') });
      toast('已更正：' + rec.name + revokedNote(), 'pos');
    });
    // 改點數或改孩子會收回成就時，視窗內即時提醒
    function warnLoss() {
      var w = document.getElementById('rec-ach-warn');
      var loss = store.achievementLossIfChanged(rec.id, { childId: document.getElementById('rec-child').value, points: document.getElementById('rec-points').value });
      w.hidden = !loss.length;
      w.textContent = loss.length ? '⚠️ 這樣修改會收回成就：' + achNames(loss) : '';
    }
    document.getElementById('rec-points').addEventListener('input', warnLoss);
    document.getElementById('rec-child').addEventListener('change', warnLoss);
    document.getElementById('rec-delete').onclick = function () {
      modal.close();
      var loss = store.achievementLossIfChanged(rec.id);
      confirmThen('確定刪除「' + rec.name + ' ' + signed(rec.points) + '」這筆紀錄？\n總點數會一起更新。' +
        (loss.length ? '\n\n⚠️ 會一起收回成就：' + achNames(loss) + '\n（之後再次達成可以重新獲得）' : ''), '刪除', true, function () {
        store.deleteRecord(rec.id);
        toast('已刪除紀錄' + revokedNote());
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
        return '<option value="' + h(c.id) + '"' + (c.id === childId ? ' selected' : '') + '>' + h(c.name) + '</option>';
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
    store.markExported();
    toast('已匯出備份，記得存到雲端硬碟或電腦');
    render();
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
      askConfirm('確定要用「' + file.name + '」取代目前所有資料嗎？\n目前的狀態會先自動備份，可以在「還原資料」還原回來。', '載入並覆蓋', true).then(function (ok) {
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
        case 'special-toggle': {
          var stt = store.getSpecialTasks(childId).find(function (t) { return t.id === id; });
          if (stt && stt.status === 'done') {
            var srec = store.getSpecialDoneRecord(id);
            confirmAchLoss(srec ? store.achievementLossIfChanged(srec.id) : [], '取消「' + stt.name + '」的完成？\n會撤銷這筆 +' + (srec ? srec.points : 20) + ' 分。', '取消完成', function () {
              store.uncompleteSpecialTask(id);
              toast('已取消「' + stt.name + '」' + revokedNote());
              ui.pulse = true;
            });
            break;
          } else {
            var sr = store.completeSpecialTask(id);
            toast('完成 ' + recText(sr), 'pos');
          }
          ui.pulse = true;
          render();
          break;
        }
        case 'special-cancel': {
          var stask = store.getSpecialTasks(childId).find(function (t) { return t.id === id; });
          confirmThen('取消特殊任務「' + (stask ? stask.name : '') + '」？取消後不會再出現，也不扣分。', '取消任務', true, function () {
            store.cancelSpecialTask(id);
            toast('已取消特殊任務');
            render();
          });
          break;
        }
        case 'undo': {
          var lastRec = store.getLastRecord(childId);
          if (!lastRec) break;
          confirmAchLoss(store.achievementLossIfChanged(lastRec.id), '撤銷「' + lastRec.name + ' ' + signed(lastRec.points) + '」？', '撤銷', function () {
            var undone = store.undoLast(childId);
            if (undone) toast('已撤銷：' + undone.name + ' ' + signed(undone.points) + revokedNote());
            ui.pulse = true;
          });
          break;
        }
        case 'open-chest': {
          var cres = store.openChest(childId, id);   // 在地圖道具列開箱（先記錄獎勵，再播動畫）
          if (document.getElementById('pawn')) { pawnPlay('openChest').then(function () { showReward(id === 'chest' ? '📦 一般寶箱' : '🎁 神秘寶箱', (id === 'mysteryChest' ? '🔑 用掉 1 把黃金鑰匙・' : '') + cres.text, id === 'chest' ? 'images/tiles/chest.webp' : 'images/items/mystery_chest.webp', id === 'chest' ? 'chest' : 'mystery'); render(); }); break; }
          showReward(id === 'chest' ? '📦 一般寶箱' : '🎁 神秘寶箱', (id === 'mysteryChest' ? '🔑 用掉 1 把黃金鑰匙・' : '') + cres.text, id === 'chest' ? 'images/tiles/chest.webp' : 'images/items/mystery_chest.webp', id === 'chest' ? 'chest' : 'mystery');
          render();
          break;
        }
        case 'archive': doArchive(); break;
        case 'pin-submit': submitPin(); break;
        case 'pin-forgot': ui.pinMode = 'forgot'; ui.pinQuiz = null; render(); break;
        case 'pin-quiz': {
          var ans = app.querySelector('#pin-quiz');
          if (ans && Number(ans.value) === ui.pinQuiz[0] * ui.pinQuiz[1]) { store.allowPinReset(); ui.pinMode = 'reset'; render(); }
          else toast('答案不對，請再試一次', 'neg');
          break;
        }
        case 'pin-cancel': ui.pinMode = null; render(); break;
        case 'pin-change': ui.pinMode = 'reset'; render(); break;
        case 'blessing-send': sendBlessingFromForm(); break;
        case 'restore-snap': {
          var sn = store.getSnapshots().find(function (x) { return x.id === id; });
          var what = sn.kind === 'before' ? '還原前的狀態' : shortDate(sn.date) + ' 開始時的狀態';
          confirmThen('要把整個 App 還原到「' + what + '」嗎？\n之後的點數紀錄、星星、冒險進度、背包都會回到那時。\n目前狀態會先自動備份，可以再還原回來。', '還原', true, function () {
            toast('♻️ 還原中…');
            store.restoreSnapshot(id).then(function () { toast('♻️ 已還原到' + what, 'pos'); render(); })
              .catch(function (err) { toast('還原失敗：' + err.message, 'neg'); render(); });
          });
          break;
        }
        case 'buy-treasure': {
          var tr0 = GAME.TREASURES.find(function (t) { return t.id === id; });
          var kid = store.getChild(childId);
          confirmThen('讓 ' + kid.name + ' 用 ' + tr0.price + ' 點兌換「' + tr0.name + '」？\n寶物會放進冒險背包。', '兌換', false, function () {
            // 防重複：確認視窗的按鈕只會觸發一次；每次兌換前都重新檢查點數、每週件數與持有上限
            store.buyTreasure(childId, id);
            toast('🎒 ' + tr0.name + ' 放進背包了！', 'pos');
            ui.pulse = true;
          });
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
        case 'snooze-backup': store.snoozeBackup(); toast('好的，明天再提醒'); render(); break;
        case 'pick-child': pickChild(el.getAttribute('data-kind')); break;
        case 'enter-adventure': enterAdventure(childId); break;
        case 'roll': { var rk = el.getAttribute('data-kind'); playMove(childId, rk === 'magicDice' ? 'magic' : rk); break; }   // 神奇骰子按鈕代號 magicDice → 擲骰種類 magic
        case 'use-skates': playMove(childId, 'skates'); break;
        case 'use-item': playMove(childId, el.getAttribute('data-kind')); break;
        case 'use-magnet': openMagnet(childId); break;
        case 'end-day': {
          var left = store.getRollsLeft(childId), q = store.getBonusQuota(childId);
          confirmThen('結束今日冒險？\n結束後今天就不能再擲骰、玩小遊戲或使用道具' +
            (left ? '，還沒用的 ' + left + ' 次擲骰會作廢' : '') + (q.games ? '、' + q.games + ' 次額外小遊戲也會作廢' : '') +
            '。\n背包裡的道具會保留到明天。', '結束', false, function () {
            store.endAdventure(childId);
            setTimeout(function () { showSummary(childId, true); }, 0);
          });
          break;
        }
        case 'show-summary': showSummary(childId, false); break;
        case 'open-achievements': ui.achOpen = id; ui.achScroll = true; go('#child-' + id); break;
        case 'ach-info': {
          var ach = store.getAchievements(childId).find(function (a) { return a.id === id; });
          showInfo((ach.done ? ach.icon : '🔒') + ' ' + ach.name, ach.desc + '\n' + (ach.done ? '✅ ' + shortDate(ach.date) + ' 達成' : '還沒達成，繼續加油！'));
          break;
        }
        case 'resettle-day': {
          var rc = store.getChild(id), pv = store.getResettlePreview(id);
          if (!pv) { toast(rc.name + ' 今天還沒結算', 'neg'); break; }
          if (!pv.added) {
            showInfo('🔄 重新結算今天', rc.name + ' 今天已結算 ⭐' + pv.settlement.stars + '（今日淨得分 ' + pv.settlement.net + '）。\n目前今日淨得分 ' + pv.net + '，沒有要補發的星星。\n（分數變少不會扣回星星）');
            break;
          }
          confirmThen('重新結算 ' + rc.name + ' 今天的能量星星？\n已結算：⭐' + pv.settlement.stars + '（今日淨得分 ' + pv.settlement.net + '）\n目前今日淨得分 ' + pv.net + '，補發 ⭐' + pv.added +
            (pv.bonus ? '（含加碼星星 ' + pv.bonus + '）' : '') + '\n只補發差額，不會重複發放。', '補發', false, function () {
            var r = store.resettleToday(id); toast('已補發 ⭐' + r.added + ' 給 ' + rc.name, 'pos');
          });
          break;
        }
        case 'reopen-day': {
          var rk = store.getChild(id);
          confirmThen('解除 ' + rk.name + ' 今天的「結束今日冒險」？\n解除後今天可以繼續擲骰、玩小遊戲（已作廢的「再來 3 次」次數不會恢復）。', '解除', false, function () {
            store.reopenAdventure(id); toast('已解除，' + rk.name + ' 今天可以繼續冒險', 'pos');
          });
          break;
        }
        case 'pick-door': ui.doorPick = childId; render(); break;
        case 'cancel-door': ui.doorPick = null; render(); break;
        case 'activate-medal':
          confirmThen('啟用 🥇 好運金牌？\n下一次停在寶箱或機會格時，效果會發生 2 次。', '啟用', false, function () {
            store.activateMedal(childId); toast('🥇 好運金牌已啟用！', 'pos');
          });
          break;
        case 'activate-bonus':
          confirmThen('啟用 🎮 再來 3 次？\n今天額外 +3 次擲骰、+3 次小遊戲，今天沒用完就失效。', '啟用', false, function () {
            store.activateBonusPlay(childId); toast('🎮 今天多了 3 次擲骰和 3 次小遊戲！', 'pos');
          });
          break;
        case 'item-info': showInfo('道具說明', ITEM_INFO[el.getAttribute('data-kind')] || ''); break;
        case 'open-shop': openShop(childId); break;
        case 'play-minigame': openMinigame(childId); break;
        case 'pick-character': openCharacterPicker(childId); break;
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
    if (e.target.id === 'ach-details') ui.achOpen = e.target.open ? route().arg : null;
  }, true);

  // 密碼輸入框按 Enter（手機鍵盤的「前往」）直接送出
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.matches('.pin-input#pin-1, .pin-input#pin-2')) { e.preventDefault(); submitPin(); }
    else if (e.target.id === 'pin-quiz') { e.preventDefault(); var q = app.querySelector('[data-action=pin-quiz]'); if (q) q.click(); }
  });
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
    if (e.target.id === 'archive-date') {   // 封存日期：更新會封存幾筆
      ui.archiveCut = e.target.value; render();
      return;
    }
    if (e.target.matches('[data-action="import"]') && e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    } else if (e.target.matches('[data-action="import-rules"]') && e.target.files[0]) {
      importRules(e.target.files[0]);
      e.target.value = '';
    }
  });

  window.addEventListener('resize', alignHeroLinks);
  window.addEventListener('hashchange', function () {
    if (modal.open) modal.close();
    ui.settingsQuery = '';
    var wantAch = ui.achScroll; ui.achScroll = false;
    render();
    var ad = wantAch && document.getElementById('ach-details');   // 從首頁成就欄進來：捲到全部成就
    if (ad) ad.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
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
