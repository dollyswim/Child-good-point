/* 親子集點 — 介面層（Phase 1） */
(function () {
  'use strict';

  var CGP = window.CGP;
  /** 每次發布更新時修改，方便在「設定 → 備份」確認手機上是不是新版 */
  var APP_VERSION = '2026.11.12-140';
  var store;
  try {
    store = new CGP.Store();
    store.snapReady.then(function () { if (route().name === 'settings') render(); });   // 自動備份清單載入後更新設定頁
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<p class="fatal">無法讀取本機儲存空間：' + String(e.message) + '</p>';
    return;
  }

  var BADGES = ['🐱', '🦊', '🐳', '🐰', '🏰', '🦄', '🌌', '🌈', '🚀', '🦋', '🌸', '⚽️', '🦖', '🐠'];   // 2026-11-09 家長指定
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
    ['penalty', '扣分'], ['challenge', '挑戰'], ['reward', '獎勵'], ['limits', '冒險上限'], ['blessing', '神諭祝福'], ['backup', '備份']
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
    if (hs === 'leaf-test') return { name: 'leaf-test', arg: null };         // 家長試玩木島「落葉找松果」
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
      if (store.isParentUnlocked() && /^(bonus|penalty|task)$/.test(r.arg || '') && !store.data.flags.rulesSeen) store.setFlag('rulesSeen', true);
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
      if (!ui.busy) { var mc = store.getChild(r.arg); setTimeout(function () { if (!ui.busy && route().name === 'map') towerIntro(mc); }, 600); }
      if (store.takeChestHint(r.arg)) notes.push('✨ 附近似乎藏著神秘寶物……');
      var wp = store.getPlayer(r.arg); if (wp.island === 'wood' && wp.pos >= 85) preloadImages(WOOD_SLIDES);   // 快到樹洞了：先在背景載入滑梯圖
    }
    if (r.name === 'home' && !store.data.flags.tourSeen && !onboardOff()) setTimeout(openTour, 300);   // 第一次打開：新手導覽
    if (r.name === 'minigame-test') openMinigame(null, null, { practice: true });
    if (r.name === 'leaf-test') openMinigame(null, null, { practice: true, leaf: true });
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
  /** 機器人吉祥物按鈕：在首頁時到冒險大廳，其他頁回首頁 */
  function mascotLink(onHome) {
    var c = currentChild() || store.getChildren()[0];
    var href = onHome ? (c ? '#adventure-' + c.id : '#home') : '#home';
    var label = onHome ? (c ? '冒險大廳' : '首頁') : '首頁';
    return '<a class="hero-link mascot-link" href="' + href + '" aria-label="' + (onHome ? label : '回首頁') + '">' + MASCOT + '<span class="hero-label">' + label + '</span></a>';
  }
  /** 右上角城堡（設定）和左上角機器人吉祥物對稱：同樣高度、同樣上緣、離右邊的距離＝機器人吉祥物離左邊的距離 */
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
  /** 分頁標題木牌圖（2026-11-09 家長提供）：有圖的用圖，沒有的照舊用 CSS 畫的木牌；標題文字留給讀屏與測試 */
  var PLAQUE_IMG = { '親子集點冒險': 'images/plaque/home2.webp', '小孩': 'images/plaque/child.webp', '本週挑戰': 'images/plaque/challenge.webp',
    '獎勵兌換': 'images/plaque/shop.webp', '記分總覽': 'images/plaque/report.webp', '冒險大廳': 'images/plaque/lobby.webp' };
  var PLAQUE_WITH_SUB = { '親子集點冒險': true };   // 2026-11-09：首頁新木牌含星星與「完成任務・累積點數・解鎖獎勵」橫幅
  function plaque(title, sub) {
    var img = PLAQUE_IMG[title];
    if (img && PLAQUE_WITH_SUB[title]) sub = '';   // 圖上已經畫了副標題橫幅，不再疊程式畫的
    return '<div class="plaque' + (img ? ' has-img' : '') + '">' +
      (img ? '<h1 class="plaque-img"><img src="' + img + '" alt="" aria-hidden="true" width="840" height="270" decoding="async" draggable="false"><span class="sr-only">' + h(title) + '</span></h1>'
        : '<h1>' + h(title) + '</h1>') + (sub ? '<div class="ribbon">' + sub.split('・').map(function (t, i, arr) {
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
    return sky(mascotLink(false) + plaque(title) + gear() + row, true);   // 機器人吉祥物取代「‹」：回首頁
  }

  // 2026-11-09：底部導覽列改用家長提供的木製功能列＋五張透明圖示（images/nav/）；文字、通知數字由 HTML 顯示
  var NAV = [['home', 'images/nav/nav_home2.webp', '首頁'], ['child', 'images/nav/nav_child2.webp', '小孩'], ['challenge', 'images/nav/nav_challenge2.webp', '挑戰'],
    ['shop', 'images/nav/nav_rewards2.webp', '兌換'], ['report', 'images/nav/nav_records2.webp', '紀錄']];
  function bottomNav(active) {
    var c = currentChild();
    // 通知數字：和首頁「小孩」磚塊同一份資料（所有孩子今天還能完成的任務數）
    var left = store.getChildren().reduce(function (n, k) { return n + store.getTodayTasks(k.id).filter(function (t) { return t.status.canComplete; }).length; }, 0);
    return '<nav class="bottom-nav" aria-label="主要分頁">' + NAV.map(function (n) {
      var href = n[0] === 'home' ? '#home' : n[0] === 'report' ? '#report' : (c ? '#' + n[0] + '-' + c.id : '#home');
      var num = n[0] === 'child' && left ? '<span class="nav-num" aria-label="' + left + ' 項任務">' + (left > 99 ? '99+' : left) + '</span>' : '';
      return '<a class="nav-item ' + (active === n[0] ? 'active' : '') + '" href="' + href + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-icon"><img src="' + n[1] + '" alt="" aria-hidden="true" width="256" height="256" decoding="async" draggable="false">' + num + '</span>' +
        '<span class="nav-label">' + n[2] + '</span></a>';
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

    // 2026-11-09 家長決定：拿掉首頁的「小孩、本週挑戰、獎勵兌換、記分總覽」四個磚塊（和底部功能列重複）

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
      storageWarning() + onboardSteps(children) + homeAchievements(children) + week + backupReminder() +
      (children.length ? '' : '<button class="btn add-child" data-action="add-child">＋ 新增孩子</button>') +   // 有孩子後改在小孩頁面右上角新增
      '</main>';
  }

  // ---------- 新手上手（2026-11-09 家長要求：分享給朋友時第一次用就上手） ----------
  function onboardOff() { return !!window.__cgpNoOnboard; }   // E2E 其他流程關掉，避免擋住點擊
  /** 首頁「新手任務」：新增孩子 → 記一筆加分 → 進入今日冒險 → 擲一次骰子；全部完成或按「不用提示」就收起 */
  function onboardSteps(children) {
    if (!children.length || store.data.flags.tipsDone || onboardOff()) return '';
    var c = currentChild(), ad = store.data.adventure;
    var steps = [
      { done: true, text: '新增孩子', how: '' },
      { done: !!store.data.flags.rulesSeen, text: '設定加分扣分規則', how: '已先準備好常用規則，照你家的習慣改一改（第一次會請你設家長密碼）', href: '#rules-bonus' },
      { done: store.data.records.some(function (r) { return r.type === 'bonus' || r.type === 'task'; }), text: '記錄第一筆加分',
        how: '到「小孩」頁，點一個加分項目（例如「主動幫忙」）', href: '#child-' + c.id },
      { done: ad.settlements.length > 0, text: '進入今日冒險', how: '今天得分大於 0 後，在「小孩」頁按「進入今日冒險」，點數會換成能量星星', href: '#child-' + c.id },
      { done: children.some(function (k) { return store.getPlayer(k.id).maxReached > 0; }), text: '在金島地圖擲一次骰子', how: '冒險大廳點孩子進入地圖，按骰子前進', href: '#adventure-' + c.id }
    ];
    var left = steps.filter(function (x) { return !x.done; }).length;
    return '<section class="panel onboard" data-testid="onboard"><div class="onboard-head"><h2>🧭 新手任務 <small>' + (steps.length - left) + ' / ' + steps.length + '</small></h2>' +
      '<button type="button" class="btn small" data-action="tips-done">' + (left ? '不用提示' : '收起') + '</button></div>' +
      (left ? '' : '<p class="onboard-all">🎉 全部完成了！之後每天記錄、出發冒險就可以囉。</p>') +
      '<ol class="onboard-list">' + steps.map(function (x) {
        var next = !x.done && x === steps.filter(function (y) { return !y.done; })[0];
        return '<li class="' + (x.done ? 'done' : next ? 'next' : '') + '"><span class="onboard-mark" aria-hidden="true">' + (x.done ? '✓' : '') + '</span>' +
          '<span class="onboard-text"><b>' + x.text + '</b>' + (next && x.how ? '<small>' + x.how + '</small>' : '') + '</span>' +
          (next && x.href ? '<a class="btn small primary" href="' + x.href + '">去做</a>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<button type="button" class="onboard-replay" data-action="tour-replay">📖 再看一次玩法介紹</button></section>';
  }
  /** 新增孩子後：引導家長把預設規則改成自己家的（先列出目前有哪些規則） */
  function rulesGuide() {
    if (confirmEl.open || modal.open) return;
    var items = store.data.items, cnt = function (k) { return items.filter(function (i) { return i.kind === k; }).length; };
    var sample = items.filter(function (i) { return i.kind !== 'penalty'; }).slice(0, 3).map(function (i) { return i.name; }).join('、');
    confirmEl.innerHTML = '<div class="confirm-box rules-guide" data-testid="rules-guide"><h2>📋 下一步：設定加分扣分</h2>' +
      '<p class="confirm-msg">已經先幫你準備了常用規則：<br><b>加分 ' + cnt('bonus') + ' 條、每日任務 ' + cnt('task') + ' 條、扣分 ' + cnt('penalty') + ' 條</b>' + (sample ? '<br><small>例如：' + h(sample) + '</small>' : '') +
      '<br><br>照你家的習慣改一改（名稱、點數都能改），孩子會更有感！<br><small>第一次進設定會請你設 4 位數家長密碼。</small></p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-no>先用預設的</button><button type="button" class="btn primary" data-yes>去設定加扣分</button></div></div>';
    confirmEl.querySelector('[data-no]').onclick = function () { confirmEl.close(); };
    confirmEl.querySelector('[data-yes]').onclick = function () { confirmEl.close(); go('#rules-bonus'); };
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
  }
  /** 手機種類：決定「加到主畫面」的教學步驟；已經從主畫面打開就不顯示 */
  function installGuide() {
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (standalone) return null;
    var ua = navigator.userAgent || '';
    var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) return { title: 'iPhone／iPad：加到主畫面', steps: ['用 Safari 打開這個網址', '點下方的「分享」按鈕（方框加向上箭頭）', '往下找「加入主畫面」，按「新增」'] };
    if (/android/i.test(ua)) return { title: 'Android：加到主畫面', steps: ['用 Chrome 打開這個網址', '點右上角「⋮」選單', '選「安裝應用程式」或「加到主畫面」'] };
    return { title: '電腦：安裝成 App', steps: ['用 Chrome 或 Edge 打開這個網址', '點網址列右邊的「安裝」圖示', '之後就能像 App 一樣打開'] };
  }
  /** 新手導覽：機器人吉祥物用幾張卡片介紹玩法；第一次打開自動出現，首頁新手任務與設定可以再看 */
  function openTour() {
    if (document.getElementById('tour')) return;
    var ig = installGuide();
    var cards = [
      { img: 'images/mascot.webp', title: '歡迎來到親子集點冒險！', lines: ['全家一起把好習慣變成冒險。', '資料只存在這支手機（或電腦）裡，不需要註冊帳號。'] },
      { img: 'images/nav/nav_child2.webp', title: '① 記錄生活點數', lines: ['在「小孩」頁點加分、扣分或每日任務，點數就會累積。', '點數可以到「兌換」換現實獎勵，例如看卡通、小點心。'] },
      { img: 'images/adv_map.webp', title: '② 出發今日冒險', lines: ['今天得分大於 0，就能「進入今日冒險」，點數會換成能量星星。', '在金島地圖擲骰子前進，有寶箱、機會、命運卡和小遊戲。'] },
      { img: 'images/float-castle.webp', title: '③ 家長設定', lines: ['右上角的城堡是「設定」：規則、獎勵、挑戰都可以自己改。', '建議先設家長密碼，並定期到「備份」下載備份檔。'] }
    ];
    if (ig) cards.push({ img: 'images/mascot.webp', emoji: '📲', title: ig.title, lines: ig.steps, ol: true, foot: '加到主畫面後，就能像 App 一樣全螢幕打開，也能離線使用。' });
    var noKids = !store.getChildren().length, i = 0;
    var dlg = document.createElement('dialog');
    dlg.id = 'tour'; dlg.className = 'tour';
    dlg.setAttribute('aria-labelledby', 'tour-title');
    function draw() {
      var c = cards[i], last = i === cards.length - 1;
      dlg.innerHTML = '<div class="tour-box" data-testid="tour">' +
        '<button type="button" class="tour-skip" data-tour="skip">略過</button>' +
        '<span class="tour-art">' + (c.emoji ? '<i aria-hidden="true">' + c.emoji + '</i>' : '<img src="' + c.img + '" alt="" aria-hidden="true" decoding="async">') + '</span>' +
        '<h2 id="tour-title">' + h(c.title) + '</h2>' +
        (c.ol ? '<ol class="tour-steps">' + c.lines.map(function (l) { return '<li>' + h(l) + '</li>'; }).join('') + '</ol>'
          : c.lines.map(function (l) { return '<p>' + h(l) + '</p>'; }).join('')) +
        (c.foot ? '<p class="tour-foot">' + h(c.foot) + '</p>' : '') +
        '<div class="tour-dots" aria-hidden="true">' + cards.map(function (x, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="tour-actions">' + (i ? '<button type="button" class="btn" data-tour="prev">上一步</button>' : '<span></span>') +
        '<button type="button" class="btn primary" data-tour="' + (last ? 'done' : 'next') + '">' + (last ? (noKids ? '開始：新增孩子' : '開始使用') : '下一步') + '</button></div></div>';
    }
    function finish(addKid) {
      store.setFlag('tourSeen', true);
      try { dlg.close(); } catch (e) { /* 已關閉 */ }
      dlg.remove();
      if (addKid) openChildForm();
    }
    dlg.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tour]');
      if (!t) return;
      var a = t.getAttribute('data-tour');
      if (a === 'next') { i++; draw(); } else if (a === 'prev') { i--; draw(); }
      else finish(a === 'done' && noKids);
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); finish(false); });
    draw();
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
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
        '<span class="adv-icon">' + (endedToday ? '🏁' : '<img class="adv-icon-img" src="images/adv_map.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async">') + '</span><div class="adv-text"><b>' + (endedToday ? '今日冒險已結束' : '今日冒險已出發') + '</b>' +
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

  // ---------- 金島第三區：能源主塔與技師（2026-11-08，家長提供圖；通電版由程式從同一張圖產生，保證對齊） ----------
  /** 金島的最遠格子（人在其他島時讀金島保存的進度） */
  function goldMaxOf(p) { return p.island === 'gold' ? (p.maxReached || 0) : (((p.islands || {}).gold || {}).maxReached || 0); }
  var TOWER_LIT_AT = 80;   // 第一次走到第 80 格以後通電（家長決定）
  var TOWER = { gx: 850, gy: 1625, w: 180 }, TECH = { gx: 752, gy: 1632, w: 54 };   // 第三區空地 (850, 190)；gy 為腳底
  function towerDecor(board, player) {
    if (board.id !== 'gold' || !board.regions.some(function (r) { return r.id === 'gold-03' && r.available; })) return '';
    var lit = goldMaxOf(player) >= TOWER_LIT_AT;
    return '<div class="gold-tower' + (lit ? ' lit' : '') + '" id="gold-tower" style="left:' + TOWER.gx + 'px;top:' + TOWER.gy + 'px;width:' + TOWER.w + 'px;z-index:' + Math.round(TOWER.gy / 6) + '" aria-label="' + (lit ? '能源主塔（已通電）' : '能源主塔（還沒通電）') + '" role="img">' +
      '<img class="tower-off" src="images/gold/tower_off.webp" alt="" width="420" height="537" draggable="false">' +
      '<img class="tower-on" src="images/gold/tower_on.webp" alt="" width="420" height="537" draggable="false">' +
      '<span class="tower-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span></div>' +
      '<button type="button" class="gold-tech" data-action="tech-talk" data-tap="tech" style="left:' + TECH.gx + 'px;top:' + TECH.gy + 'px;width:' + TECH.w + 'px;z-index:' + Math.round(TECH.gy / 6) + '" aria-label="技師">' +
      '<img src="images/gold/technician.webp" alt="" width="150" height="231" draggable="false"></button>';
  }
  /** 技師說一句話（地圖上的對話泡泡，約 3 秒消失） */
  function techTalk(child, ms, text, speaker) {
    var view = document.getElementById('map-view'), tech = speaker || document.querySelector('.gold-tech');
    if (!view || !tech) return;
    var lit = goldMaxOf(store.getPlayer(child.id)) >= TOWER_LIT_AT;
    var old = document.getElementById('tech-bubble'); if (old) old.remove();
    var b = document.createElement('div');
    b.className = 'tech-bubble'; b.id = 'tech-bubble'; b.setAttribute('role', 'status');
    // 泡泡放在地圖視窗上（不跟著地圖縮放，字才看得清楚），位置在技師頭上
    var vr = view.getBoundingClientRect(), tr = tech.getBoundingClientRect();
    b.style.left = Math.max(8, Math.min(vr.width - 196, tr.left - vr.left + tr.width / 2 - 40)) + 'px';
    b.textContent = text || (lit ? '謝謝你！能源塔亮起來了，金冠城堡就在前面！' : '能源塔沒電了！幫我走到第 80 格的 ⚡ 開關，把它充飽電！');
    view.appendChild(b);
    // 放在技師腳下（不蓋住技師，也不擋到主塔）；下方放不下才放到頭上
    var below = tr.bottom - vr.top + 12;
    if (below + b.offsetHeight <= vr.height - 8) { b.style.top = below + 'px'; b.classList.add('below'); }
    else b.style.top = Math.max(8, tr.top - vr.top - b.offsetHeight - 10) + 'px';
    setTimeout(function () { b.classList.add('bye'); setTimeout(function () { b.remove(); }, 300); }, ms || 3200);
  }
  var TOWER_SWITCH_ID = 'gold-03-080';   // 第 80 格：能源開關
  var TOWER_INTRO_AT = 56;               // 第一次走進齒輪工坊：技師主動求助
  /** 鏡頭移到主塔（演出用） */
  async function lookAtTower() {
    if (!ui.cam) return;
    ui.cam.cx = TOWER.gx - 40; ui.cam.cy = TOWER.gy - 120; applyCam(true);
    await sleep(reduceMotion ? 50 : 800);
  }
  /**
   * 連點充電：畫面下方電量條＋大按鈕，點滿 10 下就完成（不限時間、不會失敗）
   * 金島能源塔用預設文字；其他劇情（木島精靈巨樹）傳 opts 換文字，onTap(比例) 讓地圖跟著變化
   * @returns Promise（充滿時完成）
   */
  function chargeTower(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var NEED = 10, n = 0;
      var el = document.createElement('div');
      el.className = 'charge-panel'; el.id = 'charge-panel';
      el.innerHTML = '<b>' + h(opts.title || '⚡ 快幫能源塔充電！') + '</b><small>' + h(opts.sub || '連續點下面的按鈕，把電量充滿') + '</small>' +
        '<span class="charge-bar"><i id="charge-fill"></i></span>' +
        '<button type="button" class="btn primary charge-btn" id="charge-btn">' + h(opts.btn || '⚡ 充電！') + '<span id="charge-count">0 / ' + NEED + '</span></button>';
      document.body.appendChild(el);
      var fill = el.querySelector('#charge-fill'), cnt = el.querySelector('#charge-count'), btn = el.querySelector('#charge-btn');
      var tower = opts.title ? null : document.getElementById('gold-tower');
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (n >= NEED) return;
        n++;
        fill.style.width = (n / NEED * 100) + '%'; cnt.textContent = n + ' / ' + NEED;
        btn.classList.remove('zap'); void btn.offsetWidth; btn.classList.add('zap');
        if (tower) { tower.style.setProperty('--charge', (n / NEED).toFixed(2)); tower.classList.add('charging'); }
        if (opts.onTap) opts.onTap(n / NEED);
        if (n >= NEED) {
          btn.disabled = true; btn.textContent = opts.full || '⚡ 充飽了！';
          setTimeout(function () { el.remove(); if (tower) tower.classList.remove('charging'); resolve(); }, reduceMotion ? 100 : 450);
        }
      });
    });
  }
  /** 技師主動求助（第一次走進齒輪工坊、塔還沒通電時，只出現一次） */
  async function towerIntro(child) {
    var p = store.getPlayer(child.id);
    if (ui.towerIntroRunning || p.towerIntro || goldMaxOf(p) < TOWER_INTRO_AT || goldMaxOf(p) >= TOWER_LIT_AT || !document.getElementById('gold-tower')) return;
    ui.towerIntroRunning = true; ui.busy = true; document.body.classList.add('pawn-acting');
    try {
      store.markTowerIntro(child.id);
      await lookAtTower();
      techTalk(child, 4200, '糟糕！能源塔沒電了…幫我走到第 80 格的 ⚡ 開關，把它充飽電！');
      await sleep(reduceMotion ? 1500 : 4200);
      followPawn(true);
      await sleep(reduceMotion ? 50 : 500);
    } finally { ui.towerIntroRunning = false; ui.busy = false; document.body.classList.remove('pawn-acting'); }
  }
  /** 機會卡「前進 2 格」的演出文字：金島礦車、木島藤蔓（其他島還沒有主題時沿用礦車） */
  var CART_UI = {
    gold: { icon: '🚃', img: 'images/gold/minecart.webp', title: '🚃 礦車來了！', text: function (n) { return '礦車可以載你額外前進 ' + n + ' 格！'; }, btn: '🚃 上車！' },
    wood: { icon: '🌿', title: '🌿 藤蔓垂下來了！', text: function (n) { return '抓住藤蔓盪過去，額外前進 ' + n + ' 格！'; }, btn: '🌿 抓住！' }
  };
  function cartUI(island) { return CART_UI[island] || CART_UI.gold; }
  /** 礦車來了：按「上車！」才出發（資料已經前進，這裡是演出與互動）；木島是藤蔓「抓住！」 */
  function cartBoard(text, ui0) {
    var U = ui0 || CART_UI.gold;
    return new Promise(function (resolve) {
      var el = document.createElement('div');
      el.className = 'charge-panel cart-panel'; el.id = 'cart-panel';
      el.innerHTML = (U.img ? '<img class="cart-art" src="' + U.img + '" alt="" aria-hidden="true" width="320" height="320" decoding="async">' : '') + '<b>' + U.title + '</b><small>' + h(text || U.text(2)) + '</small>' +
        '<button type="button" class="btn primary charge-btn" id="cart-btn">' + U.btn + '</button>';
      document.body.appendChild(el);
      el.querySelector('#cart-btn').addEventListener('click', function () { el.remove(); resolve(); });
    });
  }

  // ---------- 島嶼劇情（導遊 NPC＋地圖互動，每座島一份設定） ----------
  // 金島：技師當導遊，第 5 格撿礦石、第 30 格拉轉轍器（第 80 格能源塔另有演出，見上方）
  // 木島：森林小精靈當導遊，每區 1 個任務（2026-11-08 家長決定）；木島地圖還沒到貨，座標寫成「相對任務格子」的位移，
  //       草圖到貨後會自動跟著格子走，必要時再微調 guide／cam／items 的位移即可
  // 互動類型 type：collect＝點地圖上的東西撿起來、press＝按一個按鈕觸發地圖變化、charge＝連點充能、leaf＝全螢幕落葉找松果（記憶遊戲）
  // 座標：rel 為 false 時是長地圖總覽座標 [x, y]；rel 為 true 時是相對任務格子中心的位移 [dx, dy]
  var ISLAND_STORY = {
    gold: {
      rel: false,
      guide: { cls: 'gold-tech', label: '技師', img: 'images/gold/technician.webp', iw: 150, ih: 231, w: TECH.w },
      spots: {
        ore: { type: 'collect', guide: [860, 5062], cam: [720, 5000], top: true,
          items: [[800, 4952], [866, 4918], [600, 5112], [520, 5012], [760, 5160]], itemCls: 'story-ore', itemLabel: '金礦石',
          title: '⛏️ 幫技師撿回金礦石！', sub: '點地圖上發光的礦石',
          hint: '我的金礦石滾得到處都是…走到第 5 格幫我撿回來！', intro: '我的金礦石滾得到處都是！幫我把 5 顆發光的礦石撿回來！', done: '太好了！礦石都找回來了，謝謝你！' },
        // 2026-11-08 家長決定：改成「視窗＋前後兩張圖」——先看礦車卡在坑道裡的圖，拖曳拉桿拉到底後，同一個視窗換成問題解決的圖（地圖上不再放礦車動畫）
        // scene.before／after：Gemini 圖到貨後填入檔名；還沒有圖時用礦車圖暫代（拉之前紅色「！」、解決後「✨」）
        rail: { type: 'scene', guide: [430, 4522], cam: [470, 4420], lever: [360, 4556],
          scene: { before: 'images/gold/rail_before.webp', after: 'images/gold/rail_after.webp', fallback: 'images/gold/minecart.webp', doneTitle: '🎉 軌道接通了！', doneSub: '礦車可以開往水晶礦谷了', ok: '🎉 太好了！' },
          title: '🔧 礦車卡住了！', sub: '抓住紅色把手，把轉轍器往下拉到底',
          hint: '礦場的轉轍器卡住了…走到第 30 格幫我拉下拉桿！', intro: '轉轍器卡住了，礦車過不去！幫我拉下拉桿！', done: '軌道接通了！礦車可以開往水晶礦谷了！' }
      }
    },
    wood: {
      rel: true,
      guide: { cls: 'wood-elf', label: '森林小精靈', img: 'images/wood/elf.webp', iw: 203, ih: 300, w: 58 },   // 2026-11-09 正式圖（家長 Gemini 圖，去白底、保留淡綠光暈）
      spots: {
        pinecone: { type: 'leaf', guide: [90, -20], cam: [40, -60],   // 2026-11-08 家長決定：改成「落葉找松果」記憶遊戲（劇情版：看 3 秒、找齊 5 顆、不會失敗）
          title: '幫小精靈找回松果！', sub: '松果被吹進 25 堆落葉裡了',
          hint: '我的松果被風吹進落葉堆裡了…走到第 8 格幫我找回來！', intro: '一陣風把我的松果吹進落葉堆裡了！看清楚它們藏在哪裡，再幫我翻出來！', done: '松果都找回來了！森林的小動物冬天有糧食了，謝謝你！' },
        // 2026-11-09 家長決定：木島劇情改成「森林派對」——第 40、65、92 格都在跳出的視窗裡進行（不依賴木島地圖位置）
        flowers: { type: 'meadow', guide: [-90, -10], cam: [0, -80],
          title: '採花摘莓果！', sub: '點草地上的花和莓果，放進籃子裡', doneTitle: '🧺 籃子裝滿了！', doneSub: '派對要用的花和莓果都準備好了',
          hint: '派對需要漂亮的花和莓果…走到第 40 格幫我採！', intro: '森林派對要開始準備囉！幫我採 5 朵花和 5 顆莓果！', done: '好漂亮的花和莓果！派對一定很棒，謝謝你！' },
        invite: { type: 'invite', guide: [90, -20], cam: [30, -60],
          title: '做派對邀請卡！', sub: '貼 6～20 張花瓣和樹葉，也可以選顏色在白色地方畫圖', doneTitle: '💌 送給森林朋友！', doneSub: '點兔子、刺蝟和貓頭鷹，把邀請卡送給牠們',
          hint: '要邀請森林朋友來派對…走到第 65 格幫我做邀請卡！', intro: '我們來做派對邀請卡吧！用花瓣和樹葉把卡片布置得漂漂亮亮！', done: '大家都收到邀請卡了！派對見！' },
        party: { type: 'party', guide: [-90, -10], cam: [0, -120],
          title: '布置森林派對！', sub: '選一種裝飾，再點發光的位置放上去（共 10 個）', doneTitle: '🎉 森林派對開始囉！', doneSub: '精靈巨樹：謝謝大家一起來參加派對！',
          hint: '派對場地還空空的…走到第 92 格幫我布置！', intro: '派對場地就在精靈巨樹下！幫我放上花、松果、莓果汁、莓果籃和汽球！', done: '大家玩得好開心！謝謝你幫忙準備森林派對！' }
      }
    }
  };
  /** 劇情座標換算成長地圖座標 */
  function storyXY(board, id, v) {
    var cfg = ISLAND_STORY[board.id], t = board.tiles[GAME.STORIES[id].tile];
    var spot = v === cfg.spots[id].guide && board.guideSpots && board.guideSpots[t.n];   // 正式地圖：導遊站在地圖預留的空地（木島 guideSpots）
    if (spot) return { x: spot[0], y: spot[1] };
    return cfg.rel ? { x: t.gx + v[0], y: t.gy + v[1] } : { x: v[0], y: v[1] };
  }
  /** 現在這座島還沒完成、而且格子已開放的劇情代號 */
  function storyOpen(board, player) {
    var cfg = ISLAND_STORY[board.id];
    if (!cfg || window.__cgpNoStory) return [];   // __cgpNoStory：自動測試用，劇情另有專門測試
    return Object.keys(cfg.spots).filter(function (id) { return !player.story[id] && board.tiles[GAME.STORIES[id].tile]; });
  }
  /** 導遊的樣子（金島技師用圖，木島小精靈先用表情符號） */
  function guideArt(g) {
    return g.img ? '<img src="' + g.img + '" alt="" width="' + g.iw + '" height="' + g.ih + '" draggable="false">' : '<span class="guide-emoji" aria-hidden="true">' + g.emoji + '</span>';
  }
  /** 還沒完成的劇情：導遊站在劇情地點（頭上有「！」），點他會提示要去哪一格 */
  function storyDecor(board, player) {
    var cfg = ISLAND_STORY[board.id];
    return storyOpen(board, player).map(function (id) {
      var sp = cfg.spots[id], g = storyXY(board, id, sp.guide);
      var lever = sp.lever ? storyXY(board, id, sp.lever) : null;
      return '<div class="story-guide ' + cfg.guide.cls + '" data-tap="guide" data-story="' + id + '" style="left:' + g.x.toFixed(1) + 'px;top:' + g.y.toFixed(1) + 'px;width:' + cfg.guide.w + 'px;z-index:' + Math.round(g.y / 6) + '" role="img" aria-label="' + cfg.guide.label + '（需要幫忙）">' +
        guideArt(cfg.guide) + '<span class="story-bang" aria-hidden="true">！</span></div>' +
        (lever ? '<div class="story-lever" id="story-lever" style="left:' + lever.x.toFixed(1) + 'px;top:' + lever.y.toFixed(1) + 'px;z-index:' + Math.round(lever.y / 6) + '" aria-hidden="true"><i></i></div>' : '');
    }).join('');
  }
  /** 地圖上點到可互動的東西（地圖接管觸控，由 setupMap 的放開判斷呼叫） */
  function mapTap(child, el) {
    var kind = el.getAttribute('data-tap');
    if (kind === 'pick') { collectPick(el); return; }
    if (kind === 'guide') {
      var id = el.getAttribute('data-story'), cfg = ISLAND_STORY[GAME.STORIES[id].island];
      techTalk(child, 3200, cfg.spots[id].hint, el); return;
    }
    techTalk(child);
  }
  var pickJob = null;
  function collectPick(el) {
    if (!pickJob || el.classList.contains('got')) return;
    el.classList.add('got');
    pickJob.n++;
    var c = document.getElementById('pick-count'); if (c) c.textContent = pickJob.n + ' / ' + pickJob.need;
    var f = document.getElementById('pick-fill'); if (f) f.style.width = (pickJob.n / pickJob.need * 100) + '%';
    setTimeout(function () { el.remove(); }, 400);
    if (pickJob.n >= pickJob.need) { var done = pickJob.done; pickJob = null; setTimeout(function () { var p = document.getElementById('story-panel'); if (p) p.remove(); done(); }, reduceMotion ? 100 : 500); }
  }
  /** 互動 collect：地圖上出現幾個發光的東西，點一下撿起來 */
  function storyCollect(board, id, sp, world) {
    var els = [];
    sp.items.forEach(function (o) {
      var q = storyXY(board, id, o), b = document.createElement('div');
      b.className = sp.itemCls; b.setAttribute('data-tap', 'pick'); b.setAttribute('role', 'button'); b.setAttribute('aria-label', sp.itemLabel);
      if (sp.itemIcon) b.textContent = sp.itemIcon;
      b.style.left = q.x + 'px'; b.style.top = q.y + 'px'; b.style.zIndex = 1500;
      world.appendChild(b); els.push(b);
    });
    var panel = document.createElement('div');
    panel.className = 'charge-panel story-panel' + (sp.top ? ' top' : ''); panel.id = 'story-panel';   // 面板放上方，不擋住地圖上的東西
    panel.innerHTML = '<b>' + h(sp.title) + '</b><small>' + h(sp.sub) + '</small><span class="charge-bar"><i id="pick-fill"></i></span><span class="story-count" id="pick-count">0 / ' + sp.items.length + '</span>';
    document.body.appendChild(panel);
    return new Promise(function (resolve) { pickJob = { n: 0, need: sp.items.length, done: resolve, els: els }; });
  }
  /** 互動 press：按一個按鈕，地圖上出現變化（礦車開走、吊橋拉緊） */
  async function storyPress(board, id, sp, world) {
    var panel = document.createElement('div');
    panel.className = 'charge-panel story-panel' + (sp.top ? ' top' : ''); panel.id = 'story-panel';
    panel.innerHTML = '<b>' + h(sp.title) + '</b><small>' + h(sp.sub) + '</small><button type="button" class="btn primary charge-btn" id="story-btn">' + h(sp.btn) + '</button>';
    document.body.appendChild(panel);
    await new Promise(function (resolve) { panel.querySelector('#story-btn').addEventListener('click', resolve); });
    panel.remove();
    var a = storyXY(board, id, sp.path[0]), z = storyXY(board, id, sp.path[1]);
    {
      // 吊橋：一排木板從左到右拉緊出現
      var br = document.createElement('div');
      br.className = 'story-bridge'; br.id = 'story-bridge';
      var len = Math.hypot(z.x - a.x, z.y - a.y);
      br.style.left = a.x + 'px'; br.style.top = a.y + 'px'; br.style.width = len + 'px'; br.style.zIndex = 1500;
      br.style.transform = 'rotate(' + Math.atan2(z.y - a.y, z.x - a.x) + 'rad)';
      world.appendChild(br);
      await sleep(30); br.classList.add('go');
      await sleep(reduceMotion ? 100 : 1500);
      br.classList.add('bye');
      setTimeout(function () { br.remove(); }, 600);
    }
  }
  /**
   * 互動 scene：視窗裡先顯示「出問題」的圖，孩子拖曳拉桿拉到底後，同一個視窗換成「問題解決」的圖，按按鈕關閉
   * 還沒有正式圖時用 scene.fallback 暫代（加上「！」／「✨」標記）
   */
  async function storyScene(sp) {
    var sc = sp.scene;
    var panel = document.createElement('div');
    panel.className = 'scene-panel story-panel'; panel.id = 'story-panel';
    panel.innerHTML = '<div class="scene-art' + (sc.before ? '' : ' ph') + '" id="scene-art"><img id="scene-img" src="' + (sc.before || sc.fallback) + '" alt="礦車卡在坑道裡" width="1200" height="900" decoding="async"></div>' +
      '<b id="scene-title">' + h(sp.title) + '</b><small id="scene-sub">' + h(sp.sub) + '</small>' + pullLeverHtml();
    document.body.appendChild(panel);
    if (sc.after) { var pre = new Image(); pre.src = sc.after; }   // 先載入解決後的圖，換圖不會閃
    await pullLever(panel.querySelector('#pull-lever'), document.getElementById('story-lever'));
    await sleep(reduceMotion ? 50 : 300);
    var art = panel.querySelector('#scene-art'), img = panel.querySelector('#scene-img');
    art.classList.add('solved');
    img.src = sc.after || sc.fallback; img.alt = '問題解決了';
    panel.querySelector('#scene-title').textContent = sc.doneTitle;
    panel.querySelector('#scene-sub').textContent = sc.doneSub;
    panel.querySelector('#pull-lever').remove();
    var ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'btn primary charge-btn'; ok.id = 'scene-ok'; ok.textContent = sc.ok;
    panel.appendChild(ok);
    await new Promise(function (resolve) { ok.addEventListener('click', resolve); });
    panel.remove();
  }
  // ---------- 木島「森林派對」視窗互動（2026-11-09；圖片在 images/wood/party/） ----------
  var PARTY_IMG = 'images/wood/party/';
  /** 共用：開一個劇情視窗（上方場景圖、標題、說明），回傳 { panel, art, title, sub } */
  function partyPanel(sp, bg, extraCls) {
    var panel = document.createElement('div');
    panel.className = 'scene-panel story-panel party-panel ' + (extraCls || ''); panel.id = 'story-panel';
    panel.innerHTML = '<div class="scene-art party-art" id="party-art">' + (bg ? '<img class="party-bg" id="party-bg" src="' + PARTY_IMG + bg + '" alt="" width="1200" height="900" draggable="false">' : '') + '</div>' +
      '<b id="scene-title">' + h(sp.title) + '</b><small id="scene-sub">' + h(sp.sub) + '</small><div class="party-tools" id="party-tools"></div>';
    document.body.appendChild(panel);
    return { panel: panel, art: panel.querySelector('#party-art'), title: panel.querySelector('#scene-title'), sub: panel.querySelector('#scene-sub'), tools: panel.querySelector('#party-tools') };
  }
  /** 共用：完成後換標題、出現「太好了」按鈕，按下關閉 */
  function partyDone(P, sp) {
    P.title.textContent = sp.doneTitle; P.sub.textContent = sp.doneSub;
    P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="scene-ok">🎉 太好了！</button>';
    return new Promise(function (resolve) { P.tools.querySelector('#scene-ok').addEventListener('click', function () { P.panel.remove(); resolve(); }); });
  }
  function partyImg(name, cls, label) {
    return '<img class="' + cls + '" src="' + PARTY_IMG + name + '.webp" alt="' + (label || '') + '" width="256" height="256" draggable="false">';
  }
  /** 第 40 格：草地上散著 5 朵花＋5 顆莓果，點一下飛進下方的籃子 */
  async function storyMeadow(sp) {
    var P = partyPanel(sp, 'meadow.webp');
    var need = { flower: 5, berries: 5 }, got = { flower: 0, berries: 0 }, spots = [];
    function count() { P.tools.innerHTML = '<span class="party-count" id="meadow-count">🌸 ' + got.flower + ' / 5　🍓 ' + got.berries + ' / 5</span>'; }
    count();
    function freeSpot() {   // 草地中間隨機，彼此不要太近、避開下方籃子
      for (var t = 0; t < 40; t++) {
        var x = 12 + Math.random() * 76, y = 14 + Math.random() * 56;
        if (spots.every(function (q) { return Math.hypot(q[0] - x, (q[1] - y) * 0.75) > 13; })) { spots.push([x, y]); return [x, y]; }
      }
      var q = [12 + Math.random() * 76, 14 + Math.random() * 56]; spots.push(q); return q;
    }
    await new Promise(function (resolve) {
      ['flower', 'berries'].forEach(function (kind) {
        for (var i = 0; i < need[kind]; i++) {
          var q = freeSpot(), b = document.createElement('button');
          b.type = 'button'; b.className = 'meadow-item meadow-' + kind; b.setAttribute('data-kind', kind); b.setAttribute('aria-label', kind === 'flower' ? '花' : '莓果');
          b.style.left = q[0] + '%'; b.style.top = q[1] + '%';
          b.innerHTML = partyImg(kind, 'meadow-img');
          b.addEventListener('click', function () {
            var me = this;
            if (me.classList.contains('got')) return;
            me.classList.add('got');
            me.style.left = '50.5%'; me.style.top = '84%';   // 飛進籃子
            got[me.getAttribute('data-kind')]++; count();
            setTimeout(function () { me.remove(); }, reduceMotion ? 50 : 600);
            if (got.flower >= need.flower && got.berries >= need.berries) setTimeout(resolve, reduceMotion ? 100 : 650);
          });
          P.art.appendChild(b);
        }
      });
    });
    await partyDone(P, sp);
  }
  /**
   * 第 65 格：把花瓣、樹葉貼紙「拖曳」到邀請卡上（點一下也會貼在卡片上隨機位置），貼 6 個以上完成；
   * 接著出現兔子、刺蝟、貓頭鷹，點一隻送一張邀請卡
   */
  /** 邀請卡可以畫圖的粉彩顏色 */
  var INVITE_COLORS = [['#f7a1c4', '粉紅'], ['#fbe08a', '粉黃'], ['#9fd3f5', '粉藍'], ['#a8e2a8', '粉綠'], ['#c9adf0', '粉紫']];
  async function storyInvite(sp) {
    var P = partyPanel(sp, null, 'invite-panel');
    var NEED = 6, MAX = 20, AREA = 0.17;   // 至少 6 張才能完成、最多 20 張；AREA：白色內框離卡片邊緣的比例（和 CSS .invite-area 一致）
    P.art.classList.add('invite-art');
    P.art.innerHTML = '<div class="invite-card" id="invite-card"><img class="invite-card-img" src="' + PARTY_IMG + 'card.webp" alt="邀請卡" width="640" height="640" draggable="false">' +
      '<div class="invite-area" id="invite-area"><canvas class="invite-draw" id="invite-draw" aria-label="在卡片上畫圖"></canvas></div><span class="invite-count" id="invite-count">0 / ' + MAX + '</span></div>';
    P.tools.innerHTML = '<div class="pen-tray" role="radiogroup" aria-label="畫筆顏色">' + INVITE_COLORS.map(function (c, i) {
      return '<button type="button" class="pen-color' + (i ? '' : ' on') + '" data-color="' + c[0] + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" aria-label="' + c[1] + '畫筆" style="--pen:' + c[0] + '"></button>';
    }).join('') + '<button type="button" class="pen-color pen-eraser" data-color="erase" role="radio" aria-checked="false" aria-label="橡皮擦">🧽</button></div>' +
      '<div class="sticker-tray">' + [['petal', '花瓣'], ['leaf', '樹葉']].map(function (s) {
        return '<button type="button" class="sticker-src" data-sticker="' + s[0] + '" aria-label="' + s[1] + '貼紙">' + partyImg(s[0], 'sticker-img') + '<small>' + s[1] + '</small></button>';
      }).join('') + '<div class="pen-actions"><button type="button" class="pen-act" id="invite-undo" disabled>↩ 上一步</button><button type="button" class="pen-act" id="invite-clear" disabled>🗑 全部清除</button></div></div>' +
      '<button type="button" class="btn primary charge-btn" id="invite-done" disabled>💌 卡片做好了！</button>';
    var area = P.art.querySelector('#invite-area'), cnt = P.art.querySelector('#invite-count'), doneBtn = P.tools.querySelector('#invite-done');
    var cv = P.art.querySelector('#invite-draw'), ctx = cv.getContext('2d');
    var undoBtn = P.tools.querySelector('#invite-undo'), clearBtn = P.tools.querySelector('#invite-clear');
    var strokes = [], stickers = [], history = [], pen = INVITE_COLORS[0][0];
    function refresh() {
      cnt.textContent = stickers.length + ' / ' + MAX;
      cnt.classList.toggle('ok', stickers.length >= NEED);
      doneBtn.disabled = stickers.length < NEED;
      undoBtn.disabled = !history.length;
      clearBtn.disabled = !strokes.length && !stickers.length;
      P.tools.querySelectorAll('.sticker-src').forEach(function (b) { b.classList.toggle('full', stickers.length >= MAX); });
    }
    // 畫圖：線條用比例座標記下來，上一步、橡皮擦、改變大小時整張重畫
    function drawStroke(c, st, W, H) {
      c.save();
      c.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
      c.strokeStyle = c.fillStyle = st.erase ? '#000' : st.color;
      c.lineWidth = (st.erase ? 0.08 : 0.025) * W; c.lineCap = c.lineJoin = 'round';
      if (st.pts.length === 1) { c.beginPath(); c.arc(st.pts[0][0] * W, st.pts[0][1] * H, c.lineWidth / 2, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.moveTo(st.pts[0][0] * W, st.pts[0][1] * H); for (var i = 1; i < st.pts.length; i++) c.lineTo(st.pts[i][0] * W, st.pts[i][1] * H); c.stroke(); }
      c.restore();
    }
    function redraw() {
      var r = area.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      ctx.clearRect(0, 0, w, h);
      strokes.forEach(function (st) { drawStroke(ctx, st, w, h); });
    }
    redraw();
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(area);
    P.tools.querySelectorAll('.pen-color').forEach(function (b) {
      b.addEventListener('click', function () {
        pen = b.getAttribute('data-color');
        P.tools.querySelectorAll('.pen-color').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      });
    });
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
      var r = cv.getBoundingClientRect();
      function pt(ev) { return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; }
      var st = { color: pen, erase: pen === 'erase', pts: [pt(e)] };
      strokes.push(st); history.push({ t: 'stroke' });
      drawStroke(ctx, st, cv.width, cv.height);
      function move(ev) {
        st.pts.push(pt(ev));
        drawStroke(ctx, { color: st.color, erase: st.erase, pts: st.pts.slice(-2) }, cv.width, cv.height);
      }
      function up() {
        cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
        refresh();
      }
      cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    });
    function stick(kind, px, py) {   // px、py：在貼紙區的比例（0～1）
      if (stickers.length >= MAX) return;
      var rot = Math.round(Math.random() * 60 - 30);
      var el = document.createElement('img');
      el.className = 'card-sticker'; el.src = PARTY_IMG + kind + '.webp'; el.alt = ''; el.draggable = false;
      el.style.left = (px * 100).toFixed(1) + '%'; el.style.top = (py * 100).toFixed(1) + '%';
      el.style.transform = 'translate(-50%, -50%) rotate(' + rot + 'deg)';
      area.appendChild(el);
      stickers.push({ el: el, px: px, py: py, rot: rot }); history.push({ t: 'sticker' });
      refresh();
    }
    undoBtn.addEventListener('click', function () {
      var h = history.pop();
      if (!h) return;
      if (h.t === 'stroke') { strokes.pop(); redraw(); }
      else if (h.t === 'sticker') stickers.pop().el.remove();
      else {   // 復原「全部清除」
        strokes = h.strokes; stickers = h.stickers;
        stickers.forEach(function (k) { area.appendChild(k.el); });
        redraw();
      }
      refresh();
    });
    clearBtn.addEventListener('click', function () {
      history.push({ t: 'clear', strokes: strokes, stickers: stickers });
      stickers.forEach(function (k) { k.el.remove(); });
      strokes = []; stickers = [];
      redraw(); refresh();
    });
    P.tools.querySelectorAll('.sticker-src').forEach(function (src) {
      src.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (stickers.length >= MAX) { src.classList.remove('shake'); void src.offsetWidth; src.classList.add('shake'); return; }
        var kind = src.getAttribute('data-sticker'), sx = e.clientX, sy = e.clientY, moved = false;
        var ghost = document.createElement('img');
        ghost.className = 'sticker-ghost'; ghost.src = PARTY_IMG + kind + '.webp'; ghost.alt = '';
        ghost.style.left = sx + 'px'; ghost.style.top = sy + 'px';
        document.body.appendChild(ghost);
        try { src.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
        function move(ev) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
          ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
        }
        function up(ev) {
          src.removeEventListener('pointermove', move); src.removeEventListener('pointerup', up); src.removeEventListener('pointercancel', up);
          ghost.remove();
          var r = area.getBoundingClientRect();
          if (!moved) stick(kind, 0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8);   // 點一下：貼在卡片上隨機位置
          else if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) stick(kind, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
        }
        src.addEventListener('pointermove', move); src.addEventListener('pointerup', up); src.addEventListener('pointercancel', up);
      });
    });
    refresh();
    await new Promise(function (resolve) { doneBtn.addEventListener('click', resolve); });
    // 先把整張卡片（卡片圖＋畫的圖＋貼紙）合成一張 PNG，下載按鈕按下去就能直接存（手機分享選單需要在點擊當下呼叫）
    var cardBlob = null;
    (function () {
      var card = P.art.querySelector('.invite-card-img'), S = card.naturalWidth || 640;
      var out = document.createElement('canvas'); out.width = out.height = S;
      var c = out.getContext('2d');
      c.drawImage(card, 0, 0, S, S);
      var x0 = S * AREA, aw = S * (1 - AREA * 2);
      var layer = document.createElement('canvas'); layer.width = layer.height = Math.round(aw);
      var lc = layer.getContext('2d');
      strokes.forEach(function (st) { drawStroke(lc, st, layer.width, layer.height); });   // 用原始比例重畫，畫質不受螢幕大小影響
      c.drawImage(layer, x0, x0, aw, aw);
      stickers.forEach(function (k) {
        var im = k.el, w = aw * 0.18, h = w * ((im.naturalHeight || 1) / (im.naturalWidth || 1));
        c.save(); c.translate(x0 + k.px * aw, x0 + k.py * aw); c.rotate(k.rot * Math.PI / 180);
        c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
      });
      try { out.toBlob(function (b) { cardBlob = b; }, 'image/png'); } catch (err) { /* 圖片跨來源時不能匯出 */ }
    })();

    // 送卡片給三隻森林動物
    P.title.textContent = sp.doneTitle; P.sub.textContent = sp.doneSub;
    P.art.classList.add('invite-send');
    P.art.querySelector('#invite-card').classList.add('small');
    var friends = document.createElement('div');
    friends.className = 'invite-friends';
    friends.innerHTML = [['bunny', '兔子'], ['hedgehog', '刺蝟'], ['owl', '貓頭鷹']].map(function (a) {
      return '<button type="button" class="invite-friend" data-friend="' + a[0] + '" aria-label="送給' + a[1] + '">' + partyImg(a[0], 'friend-img') + '<span class="friend-thanks">謝謝！</span></button>';
    }).join('');
    P.art.appendChild(friends);
    P.tools.innerHTML = '<span class="party-count" id="invite-sent">已送出 0 / 3</span>' +
      '<button type="button" class="btn small invite-save" id="invite-save">⬇ 下載我的卡片</button>';
    P.tools.querySelector('#invite-save').addEventListener('click', function () {
      if (!cardBlob) { toast('卡片還在準備中，再按一次'); return; }
      var name = 'forest-party-card.png';
      var file = window.File ? new File([cardBlob], name, { type: 'image/png' }) : null;
      // 手機、平板：跳出分享選單，可以選「儲存影像」；電腦：直接下載
      if (file && !window.__cgpNoShare && navigator.canShare && navigator.canShare({ files: [file] }) && window.matchMedia('(pointer: coarse)').matches) {
        navigator.share({ files: [file], title: '森林派對邀請卡' }).catch(function () { /* 取消分享 */ });
        return;
      }
      var url = URL.createObjectURL(cardBlob), link = document.createElement('a');
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
    var sent = 0;
    await new Promise(function (resolve) {
      friends.querySelectorAll('.invite-friend').forEach(function (f) {
        f.addEventListener('click', function () {
          if (f.classList.contains('got')) return;
          f.classList.add('got'); sent++;
          P.tools.querySelector('#invite-sent').textContent = '已送出 ' + sent + ' / 3';
          if (sent >= 3) setTimeout(resolve, reduceMotion ? 100 : 900);
        });
      });
    });
    await partyDone(P, sp);
  }
  /** 第 92 格：空的派對場地有 10 個發光空位；選一種裝飾、再點空位放上去；放滿換成派對完成的畫面 */
  var PARTY_SLOTS = [[23.3, 72], [30.4, 69], [37.5, 66], [45, 64.2],   // 長桌上（場景圖 1200×900 的百分比，裝飾底部中央）
    [70.8, 62.8], [77.5, 61.1], [83.3, 63.9],                              // 圓形舞台上
    [9.2, 76.7], [54.2, 81.1], [68.3, 86.7]];                              // 草地上
  var PARTY_DECOS = [['vase', '花瓶'], ['pinecone', '松果'], ['juice', '莓果汁'], ['basket', '一籃莓果'], ['balloons', '汽球']];
  async function storyParty(sp) {
    var P = partyPanel(sp, 'party_empty.webp');
    var pick = PARTY_DECOS[0][0], filled = 0;
    P.tools.innerHTML = '<div class="deco-tray" role="radiogroup" aria-label="選擇裝飾">' + PARTY_DECOS.map(function (d, i) {
      var src = d[0] === 'pinecone' ? 'images/wood/leaf_pinecone.webp' : PARTY_IMG + d[0] + '.webp';
      return '<button type="button" class="deco-src' + (i ? '' : ' on') + '" data-deco="' + d[0] + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" aria-label="' + d[1] + '"><img src="' + src + '" alt="" width="256" height="256" draggable="false"><small>' + d[1] + '</small></button>';
    }).join('') + '</div><span class="party-count" id="party-count">0 / ' + PARTY_SLOTS.length + '</span>';
    P.tools.querySelectorAll('.deco-src').forEach(function (b) {
      b.addEventListener('click', function () {
        pick = b.getAttribute('data-deco');
        P.tools.querySelectorAll('.deco-src').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      });
    });
    await new Promise(function (resolve) {
      PARTY_SLOTS.forEach(function (q, i) {
        var s = document.createElement('button');
        s.type = 'button'; s.className = 'party-slot'; s.setAttribute('data-slot', i); s.setAttribute('aria-label', '放裝飾的位置 ' + (i + 1));
        s.style.left = q[0] + '%'; s.style.top = q[1] + '%';
        s.addEventListener('click', function () {
          if (s.classList.contains('filled')) return;
          s.classList.add('filled', 'deco-' + pick);
          s.innerHTML = '<img src="' + (pick === 'pinecone' ? 'images/wood/leaf_pinecone.webp' : PARTY_IMG + pick + '.webp') + '" alt="" width="256" height="256" draggable="false">';
          filled++; P.tools.querySelector('#party-count').textContent = filled + ' / ' + PARTY_SLOTS.length;
          if (filled >= PARTY_SLOTS.length) setTimeout(resolve, reduceMotion ? 100 : 700);
        });
        P.art.appendChild(s);
      });
    });
    // 放滿了：換成派對完成的畫面（動物們跳舞、串燈亮起）
    P.art.querySelectorAll('.party-slot').forEach(function (s) { s.remove(); });
    var bg = P.art.querySelector('#party-bg');
    bg.src = PARTY_IMG + 'party_done.webp'; P.art.classList.add('party-done');
    await partyDone(P, sp);
  }
  /** 可以拖曳的拉桿：直立的軌道＋紅色把手，往下拖到底才算拉下（放開沒到底會彈回去） */
  function pullLeverHtml() {
    return '<div class="pull-lever" id="pull-lever" role="slider" tabindex="0" aria-label="拉桿：往下拉到底" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
      '<span class="pull-slot" aria-hidden="true"></span><span class="pull-handle" id="pull-handle" aria-hidden="true"><i></i></span>' +
      '<span class="pull-arrow" aria-hidden="true">⬇</span></div>';
  }
  /**
   * 拖曳拉桿：把手跟著手指往下移；拉到 85% 以上放開（或直接拉到底）就完成。
   * mapLever：地圖上的拉桿，跟著一起扳下。鍵盤可按 ↓／Enter／空白鍵（無障礙）
   * @returns Promise（拉下時完成）
   */
  function pullLever(el, mapLever) {
    return new Promise(function (resolve) {
      var handle = el.querySelector('#pull-handle'), RANGE = 110, start = null, p = 0, done = false;
      function set(v, anim) {
        p = Math.max(0, Math.min(1, v));
        handle.style.transition = anim ? 'transform .25s ease-out' : 'none';
        handle.style.transform = 'translate(-50%, ' + (p * RANGE).toFixed(1) + 'px)';
        el.setAttribute('aria-valuenow', Math.round(p * 100));
        if (mapLever) mapLever.style.setProperty('--pull', p.toFixed(2));
      }
      function finish() {
        if (done) return;
        done = true; set(1, true); el.classList.add('pulled');
        if (mapLever) mapLever.classList.add('pulled');
        resolve();
      }
      el.addEventListener('pointerdown', function (e) {
        if (done) return;
        e.preventDefault();
        start = { y: e.clientY, p: p };
        el.classList.add('grab');
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
      });
      el.addEventListener('pointermove', function (e) {
        if (!start || done) return;
        set(start.p + (e.clientY - start.y) / RANGE, false);
        if (p >= 1) finish();
      });
      function release() {
        if (!start || done) return;
        start = null; el.classList.remove('grab');
        if (p >= 0.85) finish(); else set(0, true);   // 沒拉到底：彈回去
      }
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
      });
      set(0, false);
    });
  }
  /** 互動 charge：連點充能，地圖上的光跟著變亮 */
  async function storyCharge(board, id, sp, world) {
    var q = storyXY(board, id, sp.glow), glow = document.createElement('div');
    glow.className = 'story-glow'; glow.id = 'story-glow';
    glow.style.left = q.x + 'px'; glow.style.top = q.y + 'px'; glow.style.zIndex = 1500;
    world.appendChild(glow);
    await chargeTower({ title: sp.title, sub: sp.sub, btn: sp.btn, full: sp.full, onTap: function (r) { glow.style.setProperty('--charge', r.toFixed(2)); } });
    glow.classList.add('full');
    await sleep(reduceMotion ? 100 : 1400);
    glow.classList.add('bye');
    setTimeout(function () { glow.remove(); }, 600);
  }
  /** 劇情演出：鏡頭移過去 → 導遊說明 → 孩子互動 → 地圖變化 → 導遊道謝＋⭐3 → 回到角色 */
  async function runStory(child, id) {
    var board = store.getBoard(child.id), cfg = ISLAND_STORY[board.id], sp = cfg && cfg.spots[id], world = document.getElementById('map-world');
    var guide = document.querySelector('.story-guide[data-story="' + id + '"]');
    if (!sp || !world || !guide) return;
    ui.busy = true; document.body.classList.add('pawn-acting', 'story-on');
    try {
      var cam = storyXY(board, id, sp.cam);
      if (ui.cam) { ui.cam.cx = cam.x; ui.cam.cy = cam.y; applyCam(true); await sleep(reduceMotion ? 50 : 800); }
      techTalk(child, 3000, sp.intro, guide);
      await sleep(reduceMotion ? 800 : 2600);
      if (sp.type === 'scene') await storyScene(sp);
      else if (sp.type === 'meadow') await storyMeadow(sp);
      else if (sp.type === 'invite') await storyInvite(sp);
      else if (sp.type === 'party') await storyParty(sp);
      else if (sp.type === 'leaf') {   // 全螢幕記憶遊戲（劇情版不限翻錯次數）
        var lr = await leafGame({ rounds: [GAME.LEAF_GAME.story], misses: 0, title: sp.title, subtitle: sp.sub, desc: '先記住松果藏在哪幾堆落葉下，落葉蓋回去後把它們翻出來！' });
        await sleep(reduceMotion ? 100 : 600);
        lr.el.remove(); document.body.classList.remove('mg-open');
      } else if (sp.type === 'collect') await storyCollect(board, id, sp, world);
      else if (sp.type === 'press') await storyPress(board, id, sp, world);
      else await storyCharge(board, id, sp, world);
      var first = store.completeStory(child.id, id);
      techTalk(child, 3400, sp.done + (first ? ' 送你 ⭐' + GAME.STORY_STARS + '！' : ''), guide);
      if (first) toast('⭐ 完成任務「' + GAME.STORIES[id].name + '」：+' + GAME.STORY_STARS + ' 能量星星', 'pos');
      await sleep(reduceMotion ? 1500 : 3400);
      guide.classList.add('bye');
      followPawn(true);
      await sleep(reduceMotion ? 50 : 500);
    } finally { ui.busy = false; document.body.classList.remove('pawn-acting', 'story-on'); pickJob = null; }
  }

  /** 第一次通電：亮起動畫（資料已寫入，只是演出） */
  function towerPowerOn() {
    var t = document.getElementById('gold-tower');
    if (!t) return;
    t.classList.add('lit', 'just-lit');
    toast('⚡ 能源主塔通電了！', 'pos');
    setTimeout(function () { t.classList.remove('just-lit'); }, 2000);
  }

  function renderMap(child) {
    var player = store.getPlayer(child.id);
    var board = store.getBoard(child.id);
    var region = regionOf(board, board.tiles[player.pos]);
    var W = board.world.width, H = board.world.height;   // 長地圖總覽尺寸
    var bag = player.bag;
    var canPlay = store.canPlayToday(child.id);
    var used = store.getRollsToday(child.id);
    var limit = store.getLimits().dice;   // 2026-11-09：每日上限依家長設定
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
      : picking ? '🚪 傳送門：點地圖上的格子選擇要去的地方'
      : atEnd ? (board.tiles[player.pos].type === 'end' ? '🏁 已抵達' + (board.goalName || '終點') + '、通關' + board.name + '！' + (GAME.nextIsland(player.island) ? '下次出發前往「' + GAME.BOARDS[GAME.nextIsland(player.island)].name + '」' : '下次出發從起點開始新的一輪') : '🚪 已抵達目前開放區域的終點！下次出發從起點開始新的一輪')
        : noRolls ? '今天的 ' + limit + ' 次骰子用完了，明天再來！' + (lim.move && (bag.skates || bag.wings) ? '（前進道具今天還可以用 ' + lim.move + ' 次）' : '')
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
      var sw = t.id === TOWER_SWITCH_ID && board.id === 'gold' && goldMaxOf(player) < TOWER_LIT_AT;   // 能源開關（通電前）
      return '<div class="mtile mt-' + shown + (shown !== t.type ? ' looted' : '') + (sw ? ' mt-switch' : '') + (t.id === player.tileId ? ' here' : '') + '" data-n="' + t.n + '" data-tile="' + t.id + '" style="left:' + p.x.toFixed(1) + 'px;top:' + p.y.toFixed(1) + 'px;z-index:' + Math.round(t.gy / 6) + '"' +
        (sw ? ' title="能源開關：走到這裡幫能源塔充電"' : TILE_LABEL[shown] ? ' title="' + TILE_LABEL[shown] + '"' : '') + '>' + tileArt(shown, 'mtile-icon') +
        (sw ? '<span class="switch-ico" aria-hidden="true">⚡</span>' : '') + '</div>';
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
      towerDecor(board, player) +
      storyDecor(board, player) +
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
      (picking ? '<button type="button" class="btn block" data-action="cancel-door">取消傳送門</button>' : '') +
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
    // 撿東西任務進行中地圖被重畫（例如切到別頁再回來）：把還沒撿的東西放回地圖，任務可以接著完成
    if (pickJob) pickJob.els.forEach(function (b) { if (!b.classList.contains('got') && !world.contains(b)) world.appendChild(b); });
    var pts = {}, last = null;
    function zoomAt(f, px, py) {
      var c = ui.cam, rect = view.getBoundingClientRect();
      var ox = px - rect.left - rect.width / 2, oy = py - rect.top - rect.height / 2;
      var wx = c.cx + ox / c.z, wy = c.cy + oy / c.z;      // 手指下的地圖點保持不動
      c.z = Math.max(b.min, Math.min(b.max, c.z * f));
      c.cx = wx - ox / c.z; c.cy = wy - oy / c.z;
      c.manual = true; applyCam(false);
    }
    var tap = null;   // 傳送門：手指幾乎沒移動就放開＝點選格子
    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.map-ctrl, .map-shop')) return;
      view.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      tap = Object.keys(pts).length === 1 ? { x: e.clientX, y: e.clientY, el: e.target.closest('[data-tap]') } : null;   // 地圖接管觸控後點擊不會傳到地圖上的東西，改在放開時判斷
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
      var tapEl = wasTap && tap.el;
      delete pts[e.pointerId]; last = null; tap = null;
      if (wasTap && ui.doorPick === child.id) pickDoorAt(child, e.clientX, e.clientY);
      else if (tapEl) mapTap(child, tapEl);   // 點技師、礦石等
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
    if (ev.shielded) return 'happy';   // 防護罩擋住往回退或推開路障
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


  /** 傳送門：找出被點到的格子並確認傳送 */
  function pickDoorAt(child, x, y) {
    var hit = null;
    app.querySelectorAll('.map-world .mtile').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = el;
    });
    if (!hit) return;
    var n = Number(hit.dataset.n), p = store.getPlayer(child.id), end = store.getBoard(child.id).tiles.length - 1;
    if (n === p.pos) { toast('你已經在這一格了'); return; }
    if (n >= end) { toast('傳送門不能傳送到終點木門', 'neg'); return; }
    var dl = store.doorLimit(child.id);   // 不能跳過還沒完成的任務格
    if (dl && n > dl.tile) { toast('第 ' + dl.tile + ' 格的任務「' + dl.name + '」還沒完成，\n傳送門最遠只能到第 ' + dl.tile + ' 格', 'neg'); return; }
    var label = TILE_LABEL[hit.className.match(/mt-(\w+)/)[1]];
    confirmThen('用 🚪 傳送門傳送到第 ' + n + ' 格' + (label ? '（' + label + '）' : '') + '？', '傳送', false, function () {
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
    var towerBefore = goldMaxOf(store.getPlayer(childId));   // 走過第 80 格的那一次播放通電動畫
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
      else if (kind === 'door') { res = store.useDoor(childId, arg); toast('🚪 傳送門傳送到第 ' + arg + ' 格！', 'pos'); }
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
        var cu = cartUI(store.getPlayer(childId).island);
        if (ev.cart) await cartBoard(cu.text(ev.extraPath.length), cu);   // 機會卡礦車（木島藤蔓）：按「上車！」才出發
        toast((ev.shielded ? '' : cu.icon + ' ') + ev.text.split('\n')[0], 'pos');   // 礦車或防護罩推開路障
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
    if (towerBefore < TOWER_LIT_AT && goldMaxOf(store.getPlayer(childId)) >= TOWER_LIT_AT && document.getElementById('gold-tower')) {
      ui.busy = true; document.body.classList.add('pawn-acting');   // 演出期間暫停骰子
      document.getElementById('gold-tower').classList.remove('lit');   // 先顯示未通電，再播亮起動畫
      // 地圖上的變化要讓孩子看到：鏡頭移到主塔 → 閃光亮起 → 技師自動說台詞 → 台詞說完才回到角色
      await lookAtTower();
      await chargeTower();   // 孩子連點充電，充滿才通電
      towerPowerOn();
      var towerFirst = store.completeStory(childId, 'tower');
      await sleep(reduceMotion ? 50 : 700);
      techTalk(child, 3600, '謝謝你！能源塔亮起來了，金冠城堡就在前面！' + (towerFirst ? ' 送你 ⭐' + GAME.STORY_STARS + '！' : ''));
      if (towerFirst) toast('⭐ 完成任務「能源主塔」：+' + GAME.STORY_STARS + ' 能量星星', 'pos');
      await sleep(reduceMotion ? 1500 : 3600);
      followPawn(true);   // 回到角色
      await sleep(reduceMotion ? 50 : 500);
      ui.busy = false; document.body.classList.remove('pawn-acting');
    }
    var visited = [].concat(res.path || [], (ev && ev.extraPath) || [], (ev && ev.backPath) || [], (ev && ev.then && ev.then.extraPath) || []);
    if (!res.travel) {   // 這次走過的格子有還沒完成的劇情：依序演出（換島那一步不演）
      var sboard = store.getBoard(childId), sids = storyOpen(sboard, store.getPlayer(childId));
      for (var si = 0; si < sids.length; si++) {
        if (visited.indexOf(GAME.STORIES[sids[si]].tile) >= 0) { await runStory(child, sids[si]); render(); }
      }
    }
    await towerIntro(child);
    var react = pawnReaction(res);
    if (react) { ui.busy = true; document.body.classList.add('pawn-acting'); try { await pawnPlay(react); } finally { ui.busy = false; document.body.classList.remove('pawn-acting'); } }   // 角色先反應，再顯示事件說明（pawn-acting：動作中，骰子暫停）
    var head = kind === 'skates' ? '🛼 前進 3 格' : kind === 'wings' ? '🪽 飛行翼' : kind === 'door' ? '🚪 傳送門'
      : (kind === 'magic' || (pr && pr.die === 'magic') ? '✨ 神奇骰子擲出 ' : '🎲 擲出 ') + res.value;
    // 停在小遊戲格（或礦車載到小遊戲格）：直接開始「抓住星星」
    var clearEv = ev && ev.clear ? ev : (ev && ev.then && ev.then.clear ? ev.then : null);
    if (clearEv && clearEv.clear.island === 'wood') { await woodEnding(child, clearEv); return; }   // 木島：樹洞溜滑梯結局
    if (clearEv) { await mapFireworks(); showClear(child, clearEv); return; }
    var mgEv = ev && ev.minigame ? ev : (ev && ev.then && ev.then.minigame ? ev.then : null);
    if (mgEv) { openMinigame(childId, head + '・停在第 ' + store.getPlayer(childId).pos + ' 格'); return; }
    var cards = eventCards(res.event, res.found);   // 2026-11-09：一般冒險事件改用卡片式視窗（內容與原本文字相同）
    if (cards.length) eventPopup(head.replace(/^\S+\s/, '') + '・停在第 ' + store.getPlayer(childId).pos + ' 格', cards);
    else toast(head + '，停在第 ' + store.getPlayer(childId).pos + ' 格');   // 一般移動：維持小提示，不另外跳視窗
  }

  // ---------- 一般冒險事件視窗（2026-11-09 家長指定：和成就視窗同風格；只換顯示方式，不改事件內容與效果） ----------
  // 版面：主標題 → 移動結果 → 主題插圖 → 事件卡片（獎勵＝奶油黃、命運卡＝淡紫、路障＝珊瑚橘、其他＝天藍）→「繼續冒險！」
  function evStrip(t) { return String(t || '').replace(/^(?:[\u2600-\u27bf\ud83c-\udbff][\udc00-\udfff]?\ufe0f?\s*)+/, '').trim(); }   // 去掉開頭的表情符號
  /** 把 store 回傳的事件（含礦車連鎖的 then）與沿路撿到的神秘寶箱，整理成卡片清單；文字沿用事件原文 */
  function eventCards(ev, found) {
    var cards = [];
    if (found) cards.push({ theme: 'reward', img: 'images/items/mystery_chest.webp', title: '神秘寶箱 ×' + found, lines: ['已放進冒險背包，用 🔑 黃金鑰匙打開'] });
    (function add(e) {
      if (!e || e.type === 'normal' || e.type === 'start') return;
      var lines = String(e.text || '').split('\n').filter(Boolean), c;
      if (e.type === 'fate') {
        var block = e.card === 'roadblock' && !e.shielded, m = block && /^路障：(.*)（(.*)）$/.exec(lines[0] || '');
        if (m) lines = [m[1], m[2]];
        var sub = e.card === 'roadblock' ? (e.shielded ? '推開路障' : '路障') : e.card === 'back' ? (e.shielded ? '防護罩擋住了' : '往回退') : '特殊任務';
        c = { theme: block ? 'block' : 'fate', img: e.shielded ? 'images/items/shield.webp' : 'images/tiles/fate.webp', title: '命運卡｜' + sub, lines: lines };
      } else {
        var got = (e.type === 'chest' || e.type === 'chance') ? rewardEntries(e.stars, e.items, 0) : [];
        if (got.length) {   // 寶箱／機會拿到東西：每樣獎勵一張奶油黃卡（主獎勵排第一）；機會卡的情境文字、好運金牌放在第一張
          got.forEach(function (g, i) {
            cards.push({ theme: 'reward', kind: e.type, img: g.img, title: g.name + ' ×' + g.qty,
              lines: [g.desc].concat(i ? [] : (e.medal ? ['🥇 好運金牌：這次效果發生 2 次'] : []).concat(e.type === 'chance' ? lines : [])) });
          });
          add(e.then);
          return;
        }
        c = { theme: 'info', kind: e.type, img: TILE_ART[e.type] || 'images/items/dice_6.webp', title: evStrip(e.title) || '冒險事件', lines: lines };
      }
      cards.push(c);
      add(e.then);
    })(ev);
    return cards;
  }
  /** cards：eventCards 的結果；sub：移動結果（例如「擲出 4・停在第 11 格」） */
  function eventPopup(sub, cards, opts) {
    opts = opts || {};
    var has = function (t) { return cards.some(function (c) { return c.theme === t || c.kind === t; }); };
    var theme = has('reward') ? 'reward' : has('block') ? 'block' : has('fate') ? 'fate' : 'move';
    var title = opts.title || { reward: '冒險新發現！', block: '遇到小麻煩！', fate: '命運卡出現！', move: has('boundary') ? '抵達區域終點！' : '成功前進！' }[theme];
    var main = cards.filter(function (c) { return c.theme === (theme === 'move' ? 'info' : theme); })[0] || cards[0];   // 主圖：獎勵 → 命運／路障 → 其他
    confirmEl.classList.add('ev-modal');
    confirmEl.innerHTML = '<div class="ev ev-' + theme + '" data-testid="event">' +
      '<div class="ev-body"><h2 class="ev-title">' + h(title) + '</h2>' + (sub ? '<p class="ev-sub">' + h(sub) + '</p>' : '') +
      '<span class="ev-art"><img src="' + main.img + '" alt="" aria-hidden="true" width="256" height="256" decoding="async"></span>' +
      cards.map(function (c) {
        return '<div class="ev-card ev-' + c.theme + '"><span class="ev-ico"><img src="' + c.img + '" alt="" aria-hidden="true" width="64" height="64" decoding="async"></span>' +
          '<span class="ev-txt"><b>' + h(c.title) + '</b>' + c.lines.map(function (l, i) { return '<span' + (i ? ' class="ev-note"' : '') + '>' + h(l) + '</span>'; }).join('') + '</span></div>';
      }).join('') + '</div>' +
      '<button type="button" class="ev-btn" data-yes>繼續冒險！</button></div>';
    var btn = confirmEl.querySelector('[data-yes]');
    btn.onclick = function () { btn.disabled = true; confirmEl.close(); };   // 事件效果在顯示前已完成，這裡只關閉
    confirmEl.addEventListener('close', function done() { confirmEl.removeEventListener('close', done); confirmEl.classList.remove('ev-modal'); });
    confirmEl.oncancel = null;
    if (typeof confirmEl.showModal === 'function') confirmEl.showModal(); else confirmEl.setAttribute('open', '');
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
            (a.done ? badgeHtml(a, 'xs') : '<span class="ach-badge"><img src="' + BADGE_IMG.locked + '" alt="未解鎖" width="256" height="256" decoding="async" draggable="false"></span>') + '<small>' + h(a.name) + '</small></button>';   // 已解鎖：完整彩色徽章
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
  var BADGE_IMG = {};   // 2026-11-09 正式徽章圖上線（家長 Gemini 圖：去白底、統一大小 256×256；松果、松鼠套紫色框）
  ('advStart goldClear1 reachR2 reachR3 reachR4 goldHero woodClear1 woodHero chest1 chests10 mystery1 catch5 catch10 pine10 squirrel5 ' +
    'earn1000 earn2000 earn3000 earn4000 earn5000 earn6000 earn7000 earn8000 earn9000 earn10000 special1 special5 streak7 locked').split(' ')
    .forEach(function (id) { BADGE_IMG[id] = 'images/badges/badge_' + id + '.webp'; });
  /** 主徽章挑選：越高階／越稀有分數越高（只影響演出，不影響成就條件） */
  var ACH_RANK = { goldClear1: 300, woodClear1: 300, streak7: 120, reachR4: 110, catch10: 100, special5: 95, reachR3: 80, chests10: 75, mystery1: 70,
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
  /** job.view：從「全部成就」點進來查看單一成就（同樣版面、徽章放大；不放煙火與音效，只有「知道了」） */
  function openTheater(job) {
    var child = job.child, list = job.list.slice().sort(function (x, y) { return achRank(y) - achRank(x); });
    var main = list[0], others = list.slice(1), many = list.length > 1, view = !!job.view;
    var dlg = document.createElement('dialog');
    dlg.className = 'ach-theater' + (view ? ' th-view still' : thStill() ? ' still' : '');
    dlg.id = 'ach-theater';
    dlg.setAttribute('aria-labelledby', 'ach-theater-title');
    var sparks = new Array(19).join('<i></i>'), hearts = '<b>♥</b><b>♥</b><b>♥</b>';
    dlg.innerHTML = '<div class="th-stage">' +
      '<div class="th-beam" aria-hidden="true"></div>' +
      (view ? '' : '<div class="th-burst" aria-hidden="true">' + sparks + hearts + '</div>') +
      '<div class="th-card" tabindex="-1" autofocus>' +
        (view ? '' : '<button type="button" class="th-sound" data-th="sound" aria-pressed="' + soundOn() + '" aria-label="成就音效">' + (soundOn() ? '🔊' : '🔇') + '</button>') +
        '<p class="th-kicker" aria-hidden="true">✦ ✧ ✦</p>' +
        '<h2 id="ach-theater-title">' + (view ? '🏆 我的成就' : many ? '🎉 哇！一次解鎖 ' + list.length + ' 個成就！' : '🎉 成就解鎖！') + '</h2>' +
        '<p class="th-who">' + h(child.name) + '</p>' +
        '<div class="th-left"><div class="th-main">' + badgeHtml(main, 'lg') + '</div>' +
        '<div class="th-actions">' + (view ? '<button type="button" class="btn primary block" data-th="close">知道了</button>'
          : '<button type="button" class="btn primary block" data-th="close">繼續冒險</button>' +   // 2026-11-12：拿掉「查看我的成就收藏」（會跳離冒險畫面），改用文字說明去哪裡看
          '<p class="th-where">之後可以在「小孩」頁的「🏆 全部成就」看到</p>') + '</div></div>' +
        '<h3 class="th-name" data-th-name>' + h(main.name) + '</h3>' +
        '<p class="th-desc" data-th-desc>' + h(main.desc) + '</p>' +
        (view ? '<p class="th-date">' + (main.done ? '✅ ' + shortDate(main.date) + ' 達成' : '🔒 還沒達成，繼續加油！') + '</p>' : '') +
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
      close(false);
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (!view) playFanfare();
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

  // ---------- 木島結局（2026-11-12 家長設計）：樹洞對話 → 第一人稱溜滑梯（5 張圖）→ 神祕藍光 → 木島冒險完成 ----------
  // 通關獎勵與通關次數在走到第 100 格時就已由 store 寫入（islandClears.wood）；這裡只負責演出，中途離開不會重複或漏發。
  // 不顯示角色（每個孩子的夥伴不同），也不顯示水島的任何畫面（水島開場由水島負責，見 docs/WOOD_TO_WATER_HANDOFF.md）。
  var WOOD_SLIDES = [1, 2, 3, 4, 5].map(function (n) { return 'images/wood/ending/slide' + n + '.webp'; });
  var WOOD_END_LINES = [
    ['me', '咦？樹洞裡怎麼會有海浪聲？'],
    ['elf', '傳說這裡藏著一條通往水島的祕密隧道喔！'],
    ['me', '真的嗎？那我們進去冒險吧！'],
    ['me', '哇啊啊！原來是溜滑梯！']
  ];
  function preloadImages(list, ms) {
    return Promise.race([Promise.all(list.map(function (u) {
      return new Promise(function (res) { var im = new Image(); im.onload = im.onerror = function () { res(); }; im.src = u; });
    })), sleep(ms || 4000)]);
  }
  function woodEnding(child, ev) {
    return new Promise(function (resolve) {
      var fast = window.__cgpFastEnding ? 0.08 : 1;   // 自動測試：縮短時間
      var still = reduceMotion, FRAME = (still ? 900 : 1700) * fast, repeat = ev.clear.count > 1;
      var ready = preloadImages(WOOD_SLIDES.concat(['images/wood/region04.webp', 'images/wood/elf.webp']));
      var el = document.createElement('div');
      el.className = 'wood-end' + (still ? ' still' : ''); el.id = 'wood-ending';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '木島結局');
      el.innerHTML = '<div class="we-scene we-tree" data-we="tree"></div>' +
        '<div class="we-slide" data-we="slide" hidden>' + WOOD_SLIDES.map(function (u, i) { return '<i class="we-frame we-f' + (i + 1) + '" style="background-image:url(' + u + ')"></i>'; }).join('') + '<b class="we-glow"></b></div>' +
        '<div class="we-talk" data-we="talk"><span class="we-who"></span><p class="we-line"></p><button type="button" class="btn primary we-next" data-we-next>繼續</button></div>' +
        (repeat ? '<button type="button" class="we-skip" data-we-skip>略過 ›</button>' : '');
      document.body.appendChild(el);
      document.body.classList.add('pawn-acting');
      toastEl.hidden = true;
      var skipped = false, stepWait = null;
      function finish() {
        var first = ev.clear.first;
        el.innerHTML = '<div class="we-card" data-testid="wood-end-card"><div class="we-crown"><img src="images/badges/badge_woodClear1.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async"></div><h2>木島冒險完成！</h2>' +
          '<p class="we-q">「神祕的樹洞隧道，<br>究竟會通往什麼地方呢？」</p>' +
          '<ul class="clear-rewards">' + (first
            ? '<li><img src="images/items/mystery_chest.webp" alt="" width="48" height="48"> 神秘寶箱 ×1（不用鑰匙）</li><li><span>🏅</span> 成就「木島通關」</li>'
            : '<li>' + STAR_IMG + ' 能量星星 +' + GAME.GOLD_CLEAR_STARS + '</li>') + '</ul>' +
          '<p class="we-soon">敬請期待下一場冒險！</p>' +
          '<p class="muted small">' + (ev.clear.next ? '下次出發會前往「' + h(ev.clear.next) + '」！' : '下一座島還在準備中，下次出發會從木島起點開始新的一輪。') + '</p>' +
          '<button type="button" class="btn primary block" data-we-ok>太棒了！</button></div>';
        el.classList.add('done');
        el.querySelector('[data-we-ok]').onclick = function () {
          el.remove(); document.body.classList.remove('pawn-acting'); render(); announceAchievements(child.id, ['woodClear1']); resolve();   // 「木島通關」卡片上已經顯示，劇場不重複演出
        };
      }
      function talk(i) {
        return new Promise(function (res) {
          var L = WOOD_END_LINES[i];
          el.querySelector('.we-who').innerHTML = L[0] === 'elf' ? '<img src="images/wood/elf.webp" alt="" width="203" height="300">森林小精靈' : h(child.name);
          el.querySelector('.we-talk').className = 'we-talk we-' + L[0];
          el.querySelector('.we-line').textContent = L[1];
          stepWait = res;
        });
      }
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-we-skip]')) { skipped = true; if (stepWait) { var r0 = stepWait; stepWait = null; r0(); } return; }
        if (e.target.closest('[data-we-next]') && stepWait) { var r = stepWait; stepWait = null; r(); }
      });
      (async function () {
        for (var i = 0; i < 3 && !skipped; i++) await talk(i);
        if (!skipped) {
          await ready;   // 圖片先載好再開始滑，避免破圖（最多等 4 秒，失敗時用漸層底色）
          el.querySelector('[data-we=tree]').classList.add('enter');   // 鏡頭推進樹洞
          el.querySelector('.we-next').hidden = true;
          await sleep(900 * fast);
          var slide = el.querySelector('[data-we=slide]');
          slide.hidden = false; el.querySelector('[data-we=tree]').hidden = true;
          talk(3); stepWait = null;   // 「哇啊啊！原來是溜滑梯！」停在畫面上一下
          var frames = slide.querySelectorAll('.we-frame');
          for (var k = 0; k < frames.length && !skipped; k++) {
            frames[k].classList.add('on');
            if (k) frames[k - 1].classList.add('out');
            if (k === 1) el.querySelector('.we-talk').hidden = true;
            await sleep(FRAME);
          }
          if (!skipped) { slide.classList.add('glow'); await sleep((still ? 600 : 1300) * fast); }   // 神祕藍光放大、淡出
        }
        finish();
      })();
    });
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
          showReward('寶物磁鐵吸到了！', r, r.type === 'mystery', '🧲 第 ' + r.n + ' 格');
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
   * 前 5 秒：每 0.67 秒出現 1 顆、停留 1.7 秒；後 5 秒加快：每 0.47 秒出現 2 顆、停留 1.3 秒、大小 0.5 倍。
   * 抓的是「銀色星星」；結束後先排出抓到的銀色星星，再每 3 顆合成 1 顆能量星星（無條件進位，最多 GAME.MINIGAME_MAX_STARS 顆）；按「收下」才寫入。
   */
  function openMinigame(childId, subtitle, opts) {
    var practice = !!(opts && opts.practice);   // 試玩模式：不寫入存檔、不給星星、不算每日次數
    if (document.getElementById('mg')) return;
    if (!practice && !store.getPendingMinigame(childId)) return;
    if (practice ? opts.leaf : store.getPendingMinigame(childId).game === 'leaf') { openLeafMinigame(childId, subtitle, opts); return; }   // 木島：落葉找松果
    var MAX = GAME.MINIGAME_MAX_STARS, SEC = GAME.MINIGAME_SECONDS;
    // 2026-11-08 家長調整（孩子反映星星消失太快）：每顆多停留 0.5 秒、出現數量 1.5 倍（間隔縮為 2/3）
    var PHASES = [{ until: 5000, gap: 667, life: 1700, count: 1, small: false },   // 前 5 秒
      { until: SEC * 1000, gap: 467, life: 1300, count: 2, small: true }];           // 後 5 秒：加快、一次 2 顆、縮小
    var el = document.createElement('div');
    el.className = 'mg' + (practice ? ' practice' : ''); el.id = 'mg';
    el.innerHTML = '<div class="mg-top"><span class="mg-count"><img class="mg-ico mg-silver-ico" src="images/minigame/star.webp" alt="銀色星星" width="256" height="256"> <b id="mg-count">0</b></span>' +
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
      var gain = GAME.minigameStars(caught), rate = GAME.MINIGAME_RATE;
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var SILVER = '<img class="mg-silver" src="images/minigame/star.webp" alt="" aria-hidden="true" width="256" height="256" draggable="false">';
      // 第 1 個視窗：抓到幾顆銀色星星（一顆顆排出來）
      var res = document.createElement('div');
      res.className = 'mg-result mg-step1';
      res.innerHTML = '<b>' + (caught >= 20 ? '🎉 太厲害了！' : caught >= 10 ? '👏 好厲害！' : '✨ 完成！') + '</b>' +
        '<p>抓到 <strong>' + caught + '</strong> 顆銀色星星</p>' +
        '<div class="mg-silver-grid" aria-hidden="true">' + new Array(caught + 1).join(SILVER) + '</div>' +
        '<button type="button" class="btn primary" data-mg="merge">' + (caught ? '✨ 合成能量星星' : '知道了') + '</button>';
      el.appendChild(res);
      res.querySelectorAll('.mg-silver').forEach(function (img, k) { img.style.animationDelay = (still ? 0 : Math.min(k * 0.06, 1.6)) + 's'; });
      res.querySelector('[data-mg=merge]').onclick = function () { res.remove(); showMerge(); };
      // 第 2 個視窗：每 3 顆銀色星星聚在一起，合成 1 顆能量星星（實際得到的數量）
      function showMerge() {
        var m = document.createElement('div');
        m.className = 'mg-result mg-step2';
        var groups = [];
        for (var g = 0; g < gain; g++) groups.push(Math.min(rate, Math.max(1, caught - g * rate)));   // 最後一組不滿 3 顆也算 1 顆
        m.innerHTML = '<b>⭐ 合成能量星星</b>' +
          '<p class="mg-rate">每 ' + rate + ' 顆銀色星星合成 1 顆能量星星（不滿 ' + rate + ' 顆也算 1 顆）</p>' +
          '<div class="mg-merge" aria-hidden="true">' + groups.map(function (n, k) {
            var d = still ? 0 : k * 0.35;
            return '<span class="mg-group" style="--d:' + d + 's">' + new Array(n + 1).join(SILVER.replace('mg-silver', 'mg-silver mg-fly')) +
              '<span class="mg-energy">' + STAR_IMG + '</span></span>';
          }).join('') + '</div>' +
          (practice ? '<p class="mg-gain">' + STAR_IMG + ' ' + gain + ' 能量星星</p><p class="mg-practice-note">🧪 試玩模式，不會真的得到星星</p>' +
            '<div class="mg-acts"><button type="button" class="btn" data-mg="exit">離開</button><button type="button" class="btn primary" data-mg="again">再玩一次</button></div>'
            : '<p class="mg-gain">' + STAR_IMG + ' +' + gain + ' 能量星星</p>' + (Math.ceil(caught / rate) > MAX ? '<p class="mg-cap">（每局最多 ' + MAX + ' 顆能量星星）</p>' : '') +
              '<button type="button" class="btn primary" data-mg="claim">收下</button>');
        el.appendChild(m);
        if (practice) {
          m.querySelector('[data-mg=again]').onclick = function () { cleanup(); openMinigame(null, null, opts); };
          m.querySelector('[data-mg=exit]').onclick = close;
          return;
        }
        m.querySelector('[data-mg=claim]').onclick = function () {
          try {
            var r = store.finishMinigame(childId, caught);
            toast('⭐ 小遊戲得到 ' + r.stars + ' 顆能量星星！', 'pos');
          } catch (err) { toast(err.message, 'neg'); }
          close();
        };
      }
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

  // ---------- 木島小遊戲「落葉找松果」（記憶遊戲，2026-11-08 家長決定） ----------
  /**
   * 全螢幕：25 堆落葉（5×5）。每回合先亮出松果幾秒讓孩子記住位置，落葉蓋回去後翻找。
   * o.rounds：[{ pine, show }]；o.misses：每回合可翻錯幾次（0＝不限，劇情版不會失敗）
   * @returns Promise：{ found, el }（找到的松果總數、遊戲畫面，呼叫端負責結果視窗與關閉）；按「稍後再玩」回傳 null
   */
  function leafGame(o) {
    return new Promise(function (resolve) {
      var N = GAME.LEAF_GAME.piles, rounds = o.rounds, multi = rounds.length > 1;
      var el = document.createElement('div');
      el.className = 'mg leaf-mg'; el.id = 'mg';
      el.innerHTML = '<div class="mg-top"><span class="mg-count" aria-label="找到的松果"><img class="leaf-ico" src="images/wood/leaf_pinecone.webp" alt="" width="256" height="256"> <b id="leaf-found">0</b></span>' +
        '<b class="leaf-round" id="leaf-round"></b><span class="leaf-miss" id="leaf-miss" aria-label="還可以翻錯的次數"></span></div>' +
        '<div class="leaf-field"><p class="leaf-msg" id="leaf-msg" role="status"></p><div class="leaf-grid" id="leaf-grid"></div></div>' +
        '<div class="mg-tip leaf-tip" id="mg-tip"><b class="leaf-title"><img class="leaf-ico" src="images/wood/leaf_pinecone.webp" alt="" width="256" height="256"> ' + h(o.title) + '</b>' + (o.subtitle ? '<small>' + h(o.subtitle) + '</small>' : '') +
        '<span>' + h(o.desc) + '</span>' +
        (o.practice ? '<small class="mg-practice">🧪 試玩模式：不會得到星星，也不算今天的次數</small>' : '') +
        '<button type="button" class="btn primary leaf-start" data-leaf="start">開始！</button>' +
        (o.later ? '<button type="button" class="btn link mg-later" data-mg="later">' + (o.practice ? '離開試玩' : '稍後再玩') + '</button>' : '') + '</div>';
      document.body.appendChild(el);
      document.body.classList.add('mg-open');
      var grid = el.querySelector('#leaf-grid'), msg = el.querySelector('#leaf-msg'), foundEl = el.querySelector('#leaf-found');
      var total = 0, squirrelsHit = 0, r = 0, timers = [];   // squirrelsHit：這局翻到幾隻松鼠（成就用）
      function later(fn, ms) { timers.push(setTimeout(fn, reduceMotion ? Math.min(ms, 300) : ms)); }
      el._stop = function () { timers.forEach(clearTimeout); timers.forEach(clearInterval); };
      function showMiss(left) {
        el.querySelector('#leaf-miss').innerHTML = o.misses ? new Array(left + 1).join('<i class="leaf-heart">🍃</i>') + new Array(o.misses - left + 1).join('<i class="leaf-heart off">🍃</i>') : '';
      }
      function round() {
        var R = rounds[r], found = 0, miss = 0, locked = true, pines = {}, squirrels = {}, D = GAME.LEAF_GAME.decoys;
        var idx = []; for (var i = 0; i < N; i++) idx.push(i);
        for (var k = 0; k < R.pine + D; k++) {   // 洗牌取前幾格：先放松果，再放干擾的松鼠
          var j = k + Math.floor(Math.random() * (N - k)); var t = idx[k]; idx[k] = idx[j]; idx[j] = t;
          if (k < R.pine) pines[idx[k]] = true; else squirrels[idx[k]] = true;
        }
        el.querySelector('#leaf-round').textContent = multi ? '第 ' + (r + 1) + ' / ' + rounds.length + ' 回合' : '找出 ' + R.pine + ' 顆松果';
        showMiss(o.misses);
        grid.className = 'leaf-grid peek';
        grid.innerHTML = '';
        for (var n = 0; n < N; n++) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'leaf-pile' + (pines[n] ? ' pine' : squirrels[n] ? ' squirrel' : ''); b.setAttribute('aria-label', '落葉堆');
          if (pines[n]) b.setAttribute('data-pine', '1');
          if (squirrels[n]) b.setAttribute('data-squirrel', '1');
          // 2026-11-08 正式圖（家長 Gemini 圖，去除外框相連白底）：落葉堆蓋著，底下是松果／松鼠／空地
          var under = pines[n] ? 'leaf_pinecone' : squirrels[n] ? 'leaf_squirrel' : 'leaf_empty';
          b.innerHTML = '<span class="leaf-under" aria-hidden="true"><img src="images/wood/' + under + '.webp" alt="" width="256" height="256" draggable="false"></span>' +
            '<span class="leaf-cover" aria-hidden="true"><img src="images/wood/leaf_pile.webp" alt="" width="256" height="256" draggable="false"></span>';
          b.addEventListener('pointerdown', tap);
          grid.appendChild(b);
        }
        // 先亮出松果，倒數結束後落葉蓋回去
        var left = Math.ceil(R.show / 1000);
        msg.textContent = '👀 記住松果的位置！' + left;
        var cd = setInterval(function () { left--; if (left > 0) msg.textContent = '👀 記住松果的位置！' + left; }, 1000);
        timers.push(cd);
        later(function () {
          clearInterval(cd);
          grid.className = 'leaf-grid';
          msg.textContent = '🍂 翻開落葉，\n找出 ' + R.pine + ' 顆松果！';
          locked = false;
        }, R.show);
        function tap(e) {
          e.preventDefault();
          var b = e.currentTarget;
          if (locked || b.classList.contains('open')) return;
          b.classList.add('open');
          if (b.hasAttribute('data-pine')) {
            found++; total++; foundEl.textContent = total;
            if (found >= R.pine) end(true);
          } else {
            if (b.hasAttribute('data-squirrel')) { squirrelsHit++; b.classList.add('caught'); msg.textContent = '🐿️ 松鼠在吃松果，\n不是這裡！'; }   // 干擾物：算翻錯 1 次
            else b.classList.add('empty');
            if (o.misses) { miss++; showMiss(o.misses - miss); if (miss >= o.misses) end(false); }
          }
        }
        function end(all) {
          locked = true;
          grid.querySelectorAll('.leaf-pile.pine:not(.open)').forEach(function (b) { b.classList.add('open', 'missed'); });   // 沒找到的松果亮出來
          msg.textContent = all ? '🎉 全部找到了！' : '🍃 翻錯 ' + o.misses + ' 次了，\n找到 ' + found + ' 顆';
          later(function () {
            r++;
            if (r < rounds.length) round();
            else { el._stop(); resolve({ found: total, squirrels: squirrelsHit, el: el }); }
          }, 1300);
        }
      }
      el.querySelector('[data-leaf=start]').onclick = function () { el.querySelector('#mg-tip').hidden = true; round(); };
      var lt = el.querySelector('[data-mg=later]');
      if (lt) lt.onclick = function () { el._stop(); el.remove(); document.body.classList.remove('mg-open'); resolve(null); };
    });
  }
  /** 木島小遊戲格：落葉找松果（計分版 3 回合；每 2 顆松果換 1 顆能量星星，按「收下」才寫入） */
  async function openLeafMinigame(childId, subtitle, opts) {
    var practice = !!(opts && opts.practice), LG = GAME.LEAF_GAME;
    var res = await leafGame({ rounds: LG.rounds, misses: LG.misses, title: '落葉找松果', subtitle: subtitle, practice: practice, later: true,
      desc: '先記住松果藏在哪幾堆落葉下，落葉蓋回去後把它們翻出來！共 ' + LG.rounds.length + ' 回合，每回合翻錯 ' + LG.misses + ' 次就進下一回合。' });
    if (!res) {
      if (!practice) toast('小遊戲留著，等一下再玩');
      if (practice) location.replace('#home');
      render(); return;
    }
    var el = res.el, found = res.found, gain = GAME.leafStars(found);
    function close() { el.remove(); document.body.classList.remove('mg-open'); if (practice) location.replace('#home'); render(); }
    // 2026-11-08 家長調整：結算比照「抓住星星」分兩個視窗——先排出找到的松果，再每 2 顆松果合成 1 顆能量星星
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, rate = LG.rate;
    var PINE = '<img class="leaf-pine" src="images/wood/leaf_pinecone.webp" alt="" aria-hidden="true" width="256" height="256" draggable="false">';
    // 第 1 個視窗：找到幾顆松果（一顆顆排出來）
    var s1 = document.createElement('div');
    s1.className = 'mg-result leaf-result leaf-step1';
    s1.innerHTML = '<b>' + (found >= GAME.LEAF_MAX_FOUND ? '🎉 全部找到了！' : found >= 10 ? '👏 記憶力好棒！' : '✨ 完成！') + '</b>' +
      '<p>找到 <strong>' + found + '</strong> / ' + GAME.LEAF_MAX_FOUND + ' 顆松果</p>' +
      '<div class="mg-silver-grid leaf-pine-grid" aria-hidden="true">' + new Array(found + 1).join(PINE) + '</div>' +
      '<button type="button" class="btn primary" data-mg="merge">' + (found ? '✨ 換成能量星星' : '知道了') + '</button>';
    el.appendChild(s1);
    s1.querySelectorAll('.leaf-pine').forEach(function (img, k) { img.style.animationDelay = (still ? 0 : Math.min(k * 0.06, 1.6)) + 's'; });
    await new Promise(function (resolve) { s1.querySelector('[data-mg=merge]').onclick = resolve; });
    s1.remove();
    // 第 2 個視窗：每 2 顆松果聚在一起，換成 1 顆能量星星（實際得到的數量）
    var groups = [];
    for (var g = 0; g < gain; g++) groups.push(Math.min(rate, Math.max(1, found - g * rate)));   // 最後一組不滿 2 顆也算 1 顆
    var m = document.createElement('div');
    m.className = 'mg-result leaf-result mg-step2';
    m.innerHTML = '<b>⭐ 換成能量星星</b>' +
      '<p class="mg-rate">' + (rate === 1 ? '每顆松果換 1 顆能量星星' : '每 ' + rate + ' 顆松果換 1 顆能量星星（不滿 ' + rate + ' 顆也算 1 顆）') + '</p>' +
      '<div class="mg-merge" aria-hidden="true">' + groups.map(function (n, k) {
        return '<span class="mg-group leaf-group" style="--d:' + (still ? 0 : k * 0.35) + 's">' + new Array(n + 1).join(PINE.replace('leaf-pine', 'leaf-pine mg-fly')) +
          '<span class="mg-energy">' + STAR_IMG + '</span></span>';
      }).join('') + '</div>' +
      (practice ? '<p class="mg-gain">' + STAR_IMG + ' ' + gain + ' 能量星星</p><p class="mg-practice-note">🧪 試玩模式，不會真的得到星星</p>' +
        '<div class="mg-acts"><button type="button" class="btn" data-mg="exit">離開</button><button type="button" class="btn primary" data-mg="again">再玩一次</button></div>'
        : '<p class="mg-gain">' + STAR_IMG + ' +' + gain + ' 能量星星</p><button type="button" class="btn primary" data-mg="claim">收下</button>');
    el.appendChild(m);
    if (practice) {
      m.querySelector('[data-mg=exit]').onclick = close;
      m.querySelector('[data-mg=again]').onclick = function () { el.remove(); document.body.classList.remove('mg-open'); openLeafMinigame(null, null, opts); };
      return;
    }
    m.querySelector('[data-mg=claim]').onclick = function () {
      try {
        var r = store.finishMinigame(childId, found, res.squirrels);
        toast('⭐ 小遊戲得到 ' + r.stars + ' 顆能量星星！', 'pos');
      } catch (err) { toast(err.message, 'neg'); }
      close();
    };
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
        '<p class="muted small">買來的道具放進背包，沒用完隔天仍然保留。每天最多擲 ' + store.getLimits().dice + ' 次骰子。</p>' +
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
        '<div class="ch-head"><span class="ch-icon">' + (st.claimed ? '<img class="ch-icon-img" src="images/challenge_medal.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async">' : st.done ? '<img class="ch-icon-img" src="images/challenge_done.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async">' : '<img class="ch-icon-img" src="images/challenge_scroll.webp" alt="" aria-hidden="true" width="256" height="256" decoding="async">') + '</span>' +
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
    var total = store.getTotal(child.id), starBal = store.getStarBalance(child.id);
    var all = store.getRewards().slice().sort(function (a, b) { return a.cost - b.cost; });
    var rewards = all.filter(function (r) { return r.currency !== 'stars'; });
    var starRewards = all.filter(function (r) { return r.currency === 'stars'; });
    // 2026-11-09：用能量星星兌換的現實獎勵
    var starCards = starRewards.length ? '<div class="shop-grid">' + starRewards.map(function (r) {
      var ok = starBal >= r.cost;
      return '<div class="shop-item star-reward ' + (ok ? 'can' : '') + '"><span class="shop-icon">⭐</span><b class="shop-name">' + h(r.name) + '</b>' +
        '<span class="shop-cost">' + STAR_IMG + ' ' + num(r.cost) + ' 顆</span>' +
        (ok ? '<button class="btn primary small" data-action="redeem" data-id="' + h(r.id) + '">兌換</button>'
          : progressBar(starBal, r.cost) + '<small class="muted">還差 ' + num(r.cost - starBal) + ' 顆</small>') + '</div>';
    }).join('') + '</div>' : '<p class="muted small">還沒有用能量星星兌換的獎勵，可以到設定 → 獎勵新增。</p>';
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
        '<span class="rec-name">' + (r.starCost ? '⭐ ' : '🎁 ') + h(r.name) + '</span><span class="pts neg">' + (r.starCost ? '−⭐' + r.starCost : signed(r.points)) + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted small">還沒有兌換紀錄</p>';
    return pageHeader('獎勵兌換', child, 'shop') +
      '<main class="page">' +
      '<section class="wallet" style="--c:' + h(child.color) + '">' + avatar(child, 'md') +
      '<div><div class="label">' + h(child.name) + ' 可以用的點數</div><div class="wallet-value" data-testid="total"><i class="coin" aria-hidden="true">點</i>' + num(total) + '</div></div></section>' +
      treasurePanel(child) +
      '<section class="panel"><h2>🎁 用點數兌換</h2>' + cards +
      '<p class="muted small">兌換會扣除總點數，不影響今日淨得分與等級。</p></section>' +
      '<section class="panel star-shop" data-testid="star-rewards"><h2>⭐ 用能量星星兌換</h2>' +
      '<p class="star-wallet">' + STAR_IMG + ' ' + h(child.name) + ' 的能量星星：<b>' + num(starBal) + '</b> 顆</p>' + starCards +
      '<p class="muted small">兌換會扣除能量星星（冒險世界賺到的星星），生活點數不變；撤銷這筆兌換會退回星星。</p></section>' +
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
          (x.message ? '・「' + h(x.message) + '」' : '') + (x.revoked ? '・' + revokedText(x) : x.seen ? '・已領取' : '・尚未打開') + '</small></span>' +
          (!x.revoked && x.date === store.today() ? '<button class="btn small" data-action="blessing-revoke" data-id="' + h(x.id) + '">收回</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="muted small">還沒有發送紀錄</p>') + '</section>' +
      '<section class="card"><h2>🔐 家長密碼</h2><button class="btn block" data-action="pin-change">更換家長密碼</button></section>';
  }
  function revokedText(x) {
    var r = x.revoked, star = x.kind === 'luckyStar';
    if (!r.taken) return '已收回（都已用掉，沒有收回東西）';
    return '已收回 ' + (star ? '⭐' + r.taken : r.taken + ' 份') + (r.taken < r.total ? '（' + (star ? '⭐' + (r.total - r.taken) : (r.total - r.taken) + ' 份') + '已用掉）' : '');
  }
  /** 收回當天的神諭祝福：只收回還沒用掉的，孩子那邊不另外提示 */
  function revokeBlessing(id) {
    var x = store.getBlessings().find(function (y) { return y.id === id; });
    if (!x) return;
    var b = GAME.BLESSINGS.find(function (y) { return y.id === x.kind; }) || { icon: '🎁', name: x.kind };
    var c = store.getChild(x.childId);
    confirmThen('要收回送給 ' + (c ? c.name : '') + ' 的「' + b.icon + ' ' + b.name + ' ×' + x.qty + '」嗎？\n只會收回還沒用掉的部分（已打開的寶箱、已花掉的星星不會追討），孩子那邊不會跳出提示。', '收回', true, function () {
      var r = store.revokeBlessing(id);
      toast(r.taken ? '↩️ 已收回 ' + (r.stars ? '⭐' + r.taken : r.taken + ' 份') + (r.used ? '，' + (r.stars ? '⭐' + r.used : r.used + ' 份') + '已用掉' : '') : '都已用掉，沒有可收回的', r.taken ? 'pos' : '');
    });
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
  // ---------- 獎勵整理（給冒險事件視窗用） ----------
  // 獎勵在顯示前就已由 store 寫入存檔；視窗按鈕只關閉，不會重複發放
  var RARE_ITEMS = ['magicDice', 'luckyMedal', 'shield', 'wings', 'door', 'airplane', 'mysteryChest', 'giftMysteryChest'];
  /**
   * 把 { stars, items, found } 整理成獎勵清單（第一個是主獎勵，其餘是額外獎勵）
   * found＝撿到的地圖神秘寶箱數（已收入背包）
   */
  function rewardEntries(stars, items, found) {
    var list = [];
    if (found) list.push({ key: 'mysteryChest', qty: found });
    Object.keys(items || {}).forEach(function (k) { if (items[k] > 0) list.push({ key: k, qty: items[k] }); });
    if (stars > 0) list.push({ key: 'stars', qty: stars });
    list.forEach(function (e) {
      if (e.key === 'stars') { e.name = '能量星星'; e.img = 'images/items/star.webp'; e.desc = '已存入能量星星'; return; }
      var b = BAG_INFO[e.key] || {};
      e.img = b.img || 'images/tiles/chest.webp';
      e.name = e.key === 'mysteryChest' ? '神秘寶箱' : b.name || e.key;
      e.desc = e.key === 'mysteryChest' ? '已收入冒險背包・黃金鑰匙開啟' : '已收入冒險背包';
    });
    // 主獎勵：稀有道具優先，其次一般道具，最後才是星星
    list.sort(function (a, b) { return rank(a) - rank(b); });
    function rank(e) { return e.key === 'stars' ? 2 : RARE_ITEMS.indexOf(e.key) >= 0 ? 0 : 1; }
    return list;
  }
  /** 開箱、寶物磁鐵的結果：res＝store 回傳的 { stars, items }；rare＝神秘寶箱；note＝說明前綴 */
  // 2026-11-09：背包開寶箱、寶物磁鐵也改用冒險事件的卡片式視窗（每樣獎勵一張奶油黃卡）；舊的獎勵彈窗已移除
  function showReward(title, res, rare, note) {
    var entries = rewardEntries(res.stars, res.items, 0);
    if (!entries.length) { showInfo(title, res.text); return; }
    eventPopup(note || '', entries.map(function (e) { return { theme: 'reward', img: e.img, title: e.name + ' ×' + e.qty, lines: [e.desc] }; }), { title: title });
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
    var lim = store.getItemLimitsToday(child.id);   // 前進類合計每天 5 次、傳送門每天 1 次
    if (bag.wings) btn('wings', 'use-item', '飛行翼 +20', '×' + bag.wings + (lim.move ? '・今天剩 ' + lim.move + ' 次' : '・今天已用完'), busy || !lim.move);
    if (bag.door) btn('door', 'pick-door', '傳送門', '×' + bag.door + (lim.door ? '・今天剩 ' + lim.door + ' 次' : '・今天已用完'), busy || !lim.door);
    if (bag.luckyMedal) btn('luckyMedal', 'activate-medal', '好運金牌', player.medalArmed ? '已啟用・×' + bag.luckyMedal : '×' + bag.luckyMedal + '・點我啟用', !!player.medalArmed);
    var L = store.getLimits();
    if (bag.pineHide) { var phUsed = store._usesToday(child.id, ['pineHide']) >= L.pineHide; btn('pineHide', 'use-pinehide', '松果躲躲', phUsed ? '今天已用・×' + bag.pineHide : '×' + bag.pineHide + '・玩一局', busy || phUsed || !!store.getPendingMinigame(child.id)); }
    if (bag.starCall) { var scUsed = store._usesToday(child.id, ['starCall']) >= L.starCall; btn('starCall', 'use-starcall', '星星呼喚', scUsed ? '今天已用・×' + bag.starCall : '×' + bag.starCall + '・玩一局', busy || scUsed || !!store.getPendingMinigame(child.id)); }
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
    shield: '🛡️ 防護罩：停在命運格抽到「往回退」或「路障」時會自動用掉 1 個：擋住往回退；推開路障還能前進 1 格。不用手動使用。',
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
    door: { name: '傳送門', img: 'images/items/magic_door.webp', note: '地圖上使用' },
    airplane: { name: '呼叫專機', img: 'images/items/airplane.webp', note: '其他島嶼開放後可用' },
    goldenKey: { name: '黃金鑰匙', img: 'images/items/golden_key.webp', note: '開神秘寶箱' },
    magnet: { name: '寶物磁鐵', img: 'images/items/treasure_magnet.webp', note: '地圖上使用' },
    rerollTicket: { name: '命運重骰券', img: 'images/items/reroll_ticket.webp', note: '擲骰後可用' },
    bonusPlay: { name: '再來 3 次', img: 'images/items/bonus_play.webp', note: '地圖上啟用' },
    starCall: { name: '星星呼喚', img: 'images/minigame/star.webp', note: '地圖上使用' },
    pineHide: { name: '松果躲躲', img: 'images/wood/leaf_pinecone.webp', note: '地圖上使用' },
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
      (r.starCost ? '<span class="pts neg">−⭐' + r.starCost + '</span></li>' : '<span class="pts ' + signClass(r.points) + '">' + signed(r.points) + '</span></li>');
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
    else if (tab === 'limits') body = settingsLimits();
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
    var replay = '<p class="tour-replay-row"><button type="button" class="btn small" data-action="tour-replay">📖 再看一次新手導覽</button>' +
      (store.data.flags.tipsDone ? ' <button type="button" class="btn small" data-action="tips-show">🧭 首頁重新顯示新手任務</button>' : '') + '</p>';
    var list = store.getChildren().map(function (c) {
      return '<li class="row">' + avatar(c, 'sm') +
        '<span class="row-main"><b>' + h(c.name) + ' ' + (c.badge ? h(c.badge) : '') + '</b><small>' + h((c.title ? c.title + ' ' : '') + 'Lv.' + store.getLevel(c.id).level) +
        '・目前 ' + num(store.getTotal(c.id)) + ' 點' + (c.weeklyGoal ? '・每週目標 ' + num(c.weeklyGoal) : '') + '・起始 ' + c.startPoints + '</small></span>' +
        (store.getSettlement(c.id) ? '<button class="btn small" data-action="resettle-day" data-id="' + h(c.id) + '">重新結算今天</button>' : '') +
        '<button class="btn small" data-action="reset-limits" data-id="' + h(c.id) + '">重置今天上限</button>' +
        (store.isAdventureEnded(c.id) ? '<button class="btn small" data-action="reopen-day" data-id="' + h(c.id) + '">解除今天的結束</button>' : '') +
        '<button class="btn small" data-action="edit-child" data-id="' + h(c.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-child" data-id="' + h(c.id) + '">刪除</button></li>';
    }).join('');
    return replay + '<ul class="rows">' + (list || '<li class="muted">還沒有孩子</li>') + '</ul>' +
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


  function settingsRewards() {
    var list = store.getRewards().map(function (r) {
      return '<li class="row"><span class="row-main"><b>' + (r.currency === 'stars' ? '⭐ ' : '🎁 ') + h(r.name) + '</b><small>需要 ' + r.cost + (r.currency === 'stars' ? ' 顆能量星星' : ' 點') + '</small></span>' +
        '<button class="btn small" data-action="edit-reward" data-id="' + h(r.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-reward" data-id="' + h(r.id) + '">刪除</button></li>';
    }).join('');
    return '<p class="muted small">每個獎勵可以選用「生活點數」或「能量星星」兌換。能量星星是孩子在冒險世界賺到的星星，換現實獎勵後會從星星餘額扣除。</p>' +
      '<ul class="rows">' + (list || '<li class="muted">尚未建立</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-reward">＋ 新增獎勵</button>';
  }

  /** 設定 → 冒險上限：冒險世界各項每日使用上限（0～10，全部孩子共用；2026-11-09 家長決定） */
  var LIMIT_ROWS = [
    ['dice', '🎲 每日擲骰次數', '設 0：今天不能擲骰（只能用道具前進）'],
    ['minigame', '🎮 小遊戲次數（停在小遊戲格）', '用完後再停到小遊戲格，會轉成神秘寶箱'],
    ['move', '🛼 前進道具（溜冰鞋＋飛行翼合計）', ''],
    ['door', '🚪 傳送門', ''],
    ['magic', '✨ 神奇骰子', ''],
    ['starCall', '🌠 星星呼喚', ''],
    ['pineHide', '🌰 松果躲躲', '']
  ];
  function settingsLimits() {
    var L = store.getLimits(), D = window.CGP.DEFAULT_LIMITS, max = window.CGP.LIMIT_MAX;
    return '<section class="panel limits-panel" data-testid="limits"><h2>⏱️ 冒險世界每日上限</h2>' +
      '<p class="limits-tip">冒險世界是好表現的獎勵，不是主角。建議替每一項設定合理的每日上限，讓孩子玩得開心又不會過度沉迷；想調高之前，先和孩子約定好每天玩多久。</p>' +
      '<ul class="rows limits-rows">' + LIMIT_ROWS.map(function (r) {
        var v = L[r[0]];
        return '<li class="row limit-row" data-key="' + r[0] + '"><span class="row-main"><b>' + r[1] + '</b><small>預設 ' + D[r[0]] + (r[2] ? '・' + r[2] : '') + '</small></span>' +
          '<span class="stepper"><button type="button" class="btn small" data-action="limit-step" data-key="' + r[0] + '" data-d="-1" aria-label="減少"' + (v <= 0 ? ' disabled' : '') + '>－</button>' +
          '<b class="limit-val' + (v !== D[r[0]] ? ' changed' : '') + '" data-testid="limit-' + r[0] + '">' + v + '</b>' +
          '<button type="button" class="btn small" data-action="limit-step" data-key="' + r[0] + '" data-d="1" aria-label="增加"' + (v >= max ? ' disabled' : '') + '>＋</button></span></li>';
      }).join('') + '</ul>' +
      '<p class="muted small">每天 0～' + max + ' 次，全部孩子共用；改完當天就生效，已經用掉的次數照算。「再來 3 次」的額外次數另外計算。</p>' +
      '<button class="btn block" data-action="limits-reset">↩️ 全部恢復預設</button></section>';
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
        '<button class="btn small" data-action="restore-snap" data-id="' + h(x.id) + '">還原</button>' +
        '<button class="btn small danger" data-action="delete-snap" data-id="' + h(x.id) + '" aria-label="刪除這份備份">刪除</button></li>';
    }).join('');
    return '<div class="card restore-card" data-testid="restore"><h2>♻️ 還原資料</h2>' +
      '<p class="muted small">App 每天第一次打開時會自動備份，保留最近 7 天（另外最多 1 份「還原前的狀態」），超過會自動刪除；不需要的也可以按「刪除」。還原會讓<b>整個 App 回到那時的狀態</b>（點數紀錄、星星、冒險進度、背包都會回去）；還原前會先自動備份目前狀態，按錯可以再還原回來。</p>' +
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
      '<label class="btn primary block file-btn">選擇 CSV 或 JSON 檔<input type="file" accept=".csv,text/csv,application/json,.json,text/plain" data-action="import-rules" hidden></label>' +
      '<p class="muted small">先匯出目前的規則表，用 Excel 修改後再匯入最方便（同一個規則ID會更新原本的規則，不會重複新增）。</p>' +
      '<button class="btn block" data-action="export-rules">📄 匯出目前規則表（CSV）</button></div>' +
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
      (c.badge && BADGES.indexOf(c.badge) < 0 ? [c.badge] : []).concat(BADGES).map(function (b) {   // 舊的代表圖示不在新清單裡：放在最前面保留，不會被清掉
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
      if (!child && !store.data.flags.rulesSeen && !onboardOff()) setTimeout(rulesGuide, 350);   // 2026-11-10：新增孩子後引導設定加扣分
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
      (rec.starCost ? '<p class="muted small">用 ⭐' + rec.starCost + ' 顆能量星星兌換（刪除這筆會退回星星）</p><input type="hidden" name="points" id="rec-points" value="0">' :
      '<label class="field">' + (neg ? (rec.type === 'reward' ? '扣除點數' : '扣除點數') : '點數') +
      '<input type="number" name="points" id="rec-points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(rec.points) + '"></label>') +
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
    var r = reward || { name: '', cost: 30, currency: 'points' };
    var stars = r.currency === 'stars';
    var fields =
      '<label class="field">獎勵名稱<input type="text" name="name" maxlength="30" required value="' + h(r.name) + '"></label>' +
      '<fieldset class="field currency-pick"><legend>用什麼兌換</legend>' +
      '<label><input type="radio" name="currency" value="points"' + (stars ? '' : ' checked') + '> 🎁 生活點數</label>' +
      '<label><input type="radio" name="currency" value="stars"' + (stars ? ' checked' : '') + '> ⭐ 能量星星</label></fieldset>' +
      '<label class="field"><span id="cost-label">' + (stars ? '需要幾顆能量星星' : '所需生活點數') + '</span><input type="number" name="cost" min="0" step="1" inputmode="numeric" required value="' + r.cost + '"></label>';
    openModal(reward ? '編輯獎勵' : '新增獎勵', fields, function (fd) {
      var data = { name: fd.get('name'), cost: fd.get('cost'), currency: fd.get('currency') };
      if (reward) store.updateReward(reward.id, data);
      else store.addReward(data);
      toast('已儲存');
    });
    document.querySelectorAll('.currency-pick input').forEach(function (inp) {
      inp.onchange = function () { document.getElementById('cost-label').textContent = inp.value === 'stars' ? '需要幾顆能量星星' : '所需生活點數'; };
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

  /** 匯出目前規則表（CSV，欄位和匯入相同，可用 Excel 修改後再匯入） */
  function exportRules() {
    var csv = window.CGPCsv.rulesToCSV(store.data.items, store.getChildren());
    var n = csv.split('\r\n').length - 2;
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'child-points-rules-' + store.today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已匯出 ' + n + ' 條規則（CSV）', 'pos');
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
    // 地圖演出或劇情任務進行中（角色動作、撿礦石…）：地圖上的商店、骰子、道具先不能點，避免中途重畫畫面卡住任務
    if (document.body.classList.contains('pawn-acting') && el.closest('.map-page')) return;
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
        case 'tips-done': store.setFlag('tipsDone', true); render(); break;
        case 'tips-show': store.setFlag('tipsDone', false); toast('首頁會重新顯示新手任務'); render(); break;
        case 'tour-replay': openTour(); break;
        case 'limit-step': {
          var lk = el.getAttribute('data-key'), lv = store.getLimits()[lk] + Number(el.getAttribute('data-d'));
          store.setLimits((function () { var o = {}; o[lk] = lv; return o; })());
          render();
          break;
        }
        case 'limits-reset':
          confirmThen('把冒險世界的每日上限全部恢復預設？', '恢復預設', false, function () { store.setLimits({}, true); toast('已恢復預設上限'); });
          break;
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
          var chestTitle = id === 'chest' ? '打開一般寶箱！' : '打開神秘寶箱！', chestNote = id === 'mysteryChest' ? '🔑 用掉 1 把黃金鑰匙' : '';
          if (document.getElementById('pawn')) { pawnPlay('openChest').then(function () { showReward(chestTitle, cres, id !== 'chest', chestNote); render(); }); break; }
          showReward(chestTitle, cres, id !== 'chest', chestNote);
          render();
          break;
        }
        case 'delete-snap': {
          var ds = store.getSnapshots().find(function (x) { return x.id === id; });
          if (!ds) break;
          confirmThen('刪除 ' + shortDate(ds.date) + ' 的這份自動備份？\n刪除後就不能還原到那時的狀態（目前的資料不受影響）。', '刪除', true, function () {
            store.deleteSnapshot(id).then(function () { toast('已刪除這份備份'); render(); }, function (err) { toast(err.message, 'neg'); });
          });
          break;
        }
        case 'export-rules': exportRules(); break;
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
        case 'blessing-revoke': revokeBlessing(id); break;
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
          confirmThen('讓 ' + child.name + ' 用 ' + (reward.currency === 'stars' ? '⭐' + reward.cost + ' 顆能量星星' : reward.cost + ' 點') + '兌換「' + reward.name + '」？', '兌換', false, function () {
            store.redeemReward(childId, id);
            toast('已兌換 ' + reward.name + (reward.currency === 'stars' ? '（−⭐' + reward.cost + '）' : ''), 'pos');
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
          openTheater({ child: store.getChild(childId), list: [ach], view: true });   // 2026-11-09：比照得到成就的視窗，徽章放大
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
        case 'reset-limits': {
          var lc = store.getChild(id);
          confirmThen('重置 ' + lc.name + ' 今天的次數上限？\n骰子 3 次、小遊戲 1 次、前進道具 5 次、傳送門 1 次、神奇骰子 1 顆、星星呼喚 1 個，今天都重新計算。\n已經用掉的道具不會退回；明天照常重新計算。', '重置', false, function () {
            store.resetDailyLimits(id); toast('已重置 ' + lc.name + ' 今天的次數上限', 'pos');
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
        case 'tech-talk': break;   // 地圖的觸控處理已經處理（見 setupMap）
        case 'use-starcall':
          confirmThen('使用 🌠 星星呼喚？\n馬上玩一局「抓住星星」（不占今天的 1 次小遊戲，每天最多用 1 個）。', '開始玩', false, function () {
            store.useStarCall(childId);
            setTimeout(function () { openMinigame(childId, '🌠 星星呼喚：額外一局'); }, 0);
          });
          break;
        case 'use-pinehide':
          confirmThen('使用 🌰 松果躲躲？\n馬上玩一局「落葉找松果」（不占今天的 1 次小遊戲，每天最多用 1 個）。', '開始玩', false, function () {
            store.usePineHide(childId);
            setTimeout(function () { openMinigame(childId, '🌰 松果躲躲：額外一局'); }, 0);
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
      // 2026-11-10：離線用的圖片等頁面能用之後才在背景慢慢下載（第一次開啟不搶網路）
      setTimeout(function () {
        navigator.serviceWorker.ready.then(function (reg) { if (reg.active) reg.active.postMessage('precache'); }).catch(function () {});
      }, window.__cgpPrecacheDelay != null ? window.__cgpPrecacheDelay : 6000);
    });
  }

  // 2026-11-10 字型：下載過的裝置一開始就用粉圓體；第一次開啟等頁面載完才下載，不擋畫面
  (function () {
    var KEY = 'cgp-font-ok', root = document.documentElement;
    function on() { root.classList.add('font-on'); }
    var ok = false;
    try { ok = localStorage.getItem(KEY) === '1'; } catch (e) { /* 不能存就每次載完再套用 */ }
    if (ok) { on(); return; }
    function load() {
      if (!document.fonts || !document.fonts.load) { on(); return; }
      document.fonts.load('1em "jf-openhuninn"', '親子集點').then(function (f) {
        if (f && f.length) { on(); try { localStorage.setItem(KEY, '1'); } catch (e) { /* 忽略 */ } }
      }).catch(function () { /* 字型下載失敗：維持系統字體 */ });
    }
    if (document.readyState === 'complete') setTimeout(load, 0); else window.addEventListener('load', function () { setTimeout(load, 300); });
  })();

  // 測試與除錯用
  window.__cgpStore = store;

  render();
})();
