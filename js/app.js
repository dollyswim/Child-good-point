/* 親子集點 — 介面層（Phase 1） */
(function () {
  'use strict';

  var CGP = window.CGP;
  var store;
  try {
    store = new CGP.Store();
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<p class="fatal">無法讀取本機儲存空間：' + String(e.message) + '</p>';
    return;
  }

  var AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐯', '🐨', '🦁', '🐸', '🐵', '🐧', '🦄', '🐲', '🐳', '⭐'];
  var COLORS = ['#ffd166', '#ffadad', '#9bd5ff', '#b8f2a8', '#d7b8ff', '#ffc58f'];
  var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  var FREQ_LABELS = {
    daily: '每日', weekdays: '平日（一～五）', weekends: '週末（六、日）',
    days: '指定星期', weeklyN: '每週 N 次', once: '單次'
  };
  var KIND_LABELS = { bonus: '加分項目', penalty: '扣分項目', task: '任務' };
  var SETTINGS_TABS = [
    ['children', '孩子'], ['task', '任務'], ['bonus', '加分'],
    ['penalty', '扣分'], ['reward', '獎勵'], ['backup', '備份']
  ];

  var app = document.getElementById('app');
  var modal = document.getElementById('modal');
  var modalForm = document.getElementById('modal-form');
  var toastEl = document.getElementById('toast');

  var ui = {
    showAllRecords: false,
    pulse: false,
    lastDate: store.today()
  };

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
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || 'home', arg: parts[1] || null };
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
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }
  function avatar(child, size) {
    return '<span class="avatar ' + (size || '') + '" style="background:' + h(child.color) + '">' + h(child.avatar) + '</span>';
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

  // ---------- 畫面 ----------
  function render() {
    var r = route();
    var html;
    if (r.name === 'child') {
      var child = store.getChild(r.arg);
      if (!child) { location.replace('#/'); return; }
      html = renderChild(child);
    } else if (r.name === 'settings') {
      html = renderSettings(r.arg || 'children');
    } else {
      html = renderHome();
    }
    app.innerHTML = html;
    app.dataset.view = r.name;
    if (ui.pulse) {
      var el = app.querySelector('.total-value');
      if (el) el.classList.add('pulse');
      ui.pulse = false;
    }
  }

  function renderHome() {
    var children = store.getChildren();
    var cards = children.map(function (c) {
      var net = store.getTodayNet(c.id);
      return '<button class="child-card" data-action="open-child" data-id="' + h(c.id) + '">' +
        avatar(c, 'lg') +
        '<span class="child-card-body">' +
        '<span class="child-name">' + h(c.name) + '</span>' +
        '<span class="child-total">目前 <b>' + store.getTotal(c.id) + '</b> 點</span>' +
        '<span class="child-today ' + signClass(net) + '">今日 ' + signed(net) + '</span>' +
        '</span><span class="chev" aria-hidden="true">›</span></button>';
    }).join('');

    return '<header class="topbar"><h1>🌟 親子集點</h1>' +
      '<a class="icon-btn" href="#/settings" aria-label="設定">⚙️</a></header>' +
      '<main class="page">' +
      (children.length
        ? '<div class="child-list">' + cards + '</div>'
        : '<div class="empty"><p>還沒有孩子資料</p><p class="muted">先新增孩子，就可以開始記錄生活積分。</p></div>') +
      '<button class="btn add-child" data-action="add-child">＋ 新增孩子</button>' +
      '</main>';
  }

  function renderChild(child) {
    var id = child.id;
    var total = store.getTotal(id);
    var net = store.getTodayNet(id);
    var tasks = store.getTodayTasks(id);
    var bonus = store.getItemsFor(id, 'bonus');
    var penalty = store.getItemsFor(id, 'penalty');
    var rewards = store.getRewards();
    var last = store.getLastRecord(id);
    var records = store.getRecords(id, ui.showAllRecords ? 0 : 8);
    var allCount = store.getRecords(id).length;

    var taskHtml = tasks.length ? tasks.map(function (t) {
      var s = t.status;
      var cls = s.doneToday ? 'done' : (s.canComplete ? '' : 'locked');
      return '<button class="task ' + cls + '" data-action="task" data-id="' + h(t.task.id) + '"' +
        (!s.doneToday && !s.canComplete ? ' disabled' : '') + '>' +
        '<span class="check" aria-hidden="true">' + (s.doneToday ? '✓' : '') + '</span>' +
        '<span class="task-name">' + h(t.task.name) +
        (s.label ? '<small>' + h(s.label) + '</small>' : '') + '</span>' +
        '<span class="pts pos">' + signed(t.task.points) + '</span></button>';
    }).join('') : '<p class="muted small">今天沒有任務</p>';

    function itemBtns(items, cls) {
      if (!items.length) return '<p class="muted small">尚未設定，可到設定頁新增</p>';
      return '<div class="grid">' + items.map(function (i) {
        return '<button class="score-btn ' + cls + '" data-action="record" data-id="' + h(i.id) + '">' +
          '<span class="score-name">' + h(i.name) + '</span>' +
          '<span class="score-pts">' + signed(i.points) + '</span></button>';
      }).join('') + '</div>';
    }

    var rewardHtml = rewards.length ? rewards.map(function (r) {
      var ok = total >= r.cost;
      return '<div class="reward-row"><span>🎁 ' + h(r.name) + '</span>' +
        '<button class="btn small ' + (ok ? 'primary' : '') + '" data-action="redeem" data-id="' + h(r.id) + '"' +
        (ok ? '' : ' disabled') + '>' + r.cost + ' 點兌換</button></div>';
    }).join('') : '<p class="muted small">尚未設定獎勵</p>';

    var recHtml = records.length ? '<ul class="records">' + groupByDate(records).map(function (g) {
      return '<li class="rec-date">' + h(dateLabel(g.date)) + '</li>' + g.items.map(recordRow).join('');
    }).join('') + '</ul>' : '<p class="muted small">還沒有紀錄</p>';

    return '<header class="topbar">' +
      '<a class="icon-btn" href="#/" aria-label="回首頁">‹</a>' +
      '<h1 class="child-title">' + avatar(child, 'sm') + h(child.name) + '</h1>' +
      '<a class="icon-btn" href="#/settings" aria-label="設定">⚙️</a></header>' +
      '<main class="page has-undo">' +
      '<section class="summary" style="--accent:' + h(child.color) + '">' +
      '<div><div class="label">目前總點數</div><div class="total-value" data-testid="total">' + total + '</div></div>' +
      '<div class="today"><div class="label">今日淨得分</div><div class="today-value ' + signClass(net) + '" data-testid="today">' + signed(net) + '</div></div>' +
      '</section>' +
      '<section><h2>📋 今日任務</h2><div class="tasks">' + taskHtml + '</div></section>' +
      '<section><h2>👍 加分</h2>' + itemBtns(bonus, 'bonus') + '</section>' +
      '<section><h2>⚠️ 扣分</h2>' + itemBtns(penalty, 'penalty') + '</section>' +
      '<section><details class="rewards"><summary><h2>🎁 兌換現實獎勵</h2></summary>' +
      '<p class="muted small">兌換會扣除總點數，不影響今日淨得分。</p>' + rewardHtml + '</details></section>' +
      '<section><h2>🕘 最近紀錄</h2>' + recHtml +
      (allCount > 8 ? '<button class="btn link" data-action="toggle-history">' +
        (ui.showAllRecords ? '只顯示最近幾筆' : '顯示全部 ' + allCount + ' 筆') + '</button>' : '') +
      '</section></main>' +
      '<div class="undo-bar"><button class="btn undo" data-action="undo"' + (last ? '' : ' disabled') + '>' +
      '↶ 撤銷上一筆' + (last ? '<small>' + h(last.name) + ' ' + signed(last.points) + '</small>' : '') +
      '</button></div>';
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

  function recordRow(r) {
    var tag = { bonus: '加分', penalty: '扣分', task: '任務', reward: '兌換' }[r.type];
    return '<li class="rec"><span class="rec-time">' + timeOf(r.ts) + '</span>' +
      '<span class="rec-name">' + (r.type === 'reward' ? '🎁 ' : '') + h(r.name) +
      ' <small class="tag tag-' + r.type + '">' + tag + '</small></span>' +
      '<span class="pts ' + signClass(r.points) + '">' + signed(r.points) + '</span></li>';
  }

  function renderSettings(tab) {
    var tabs = SETTINGS_TABS.map(function (t) {
      return '<a class="tab ' + (t[0] === tab ? 'active' : '') + '" href="#/settings/' + t[0] + '">' + t[1] + '</a>';
    }).join('');
    var body;
    if (tab === 'children') body = settingsChildren();
    else if (tab === 'reward') body = settingsRewards();
    else if (tab === 'backup') body = settingsBackup();
    else if (KIND_LABELS[tab]) body = settingsItems(tab);
    else body = settingsChildren();

    return '<header class="topbar">' +
      '<a class="icon-btn" href="#/" aria-label="回首頁">‹</a>' +
      '<h1>計分規則設定</h1><span class="icon-btn"></span></header>' +
      '<nav class="tabs">' + tabs + '</nav>' +
      '<main class="page">' + body + '</main>';
  }

  function settingsChildren() {
    var list = store.getChildren().map(function (c) {
      return '<li class="row">' + avatar(c, 'sm') +
        '<span class="row-main"><b>' + h(c.name) + '</b><small>起始 ' + c.startPoints + ' 點・目前 ' + store.getTotal(c.id) + ' 點</small></span>' +
        '<button class="btn small" data-action="edit-child" data-id="' + h(c.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-child" data-id="' + h(c.id) + '">刪除</button></li>';
    }).join('');
    return '<ul class="rows">' + (list || '<li class="muted">還沒有孩子</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-child">＋ 新增孩子</button>';
  }

  function settingsItems(kind) {
    var list = store.getItems(kind).map(function (i) {
      var meta = childIdsText(i.childIds) + (kind === 'task' ? '・' + freqText(i.frequency) : '');
      return '<li class="row"><span class="row-main"><b>' + h(i.name) +
        ' <span class="pts ' + signClass(i.points) + '">' + signed(i.points) + '</span></b>' +
        '<small>' + h(meta) + '</small></span>' +
        '<button class="btn small" data-action="edit-item" data-id="' + h(i.id) + '">編輯</button>' +
        '<button class="btn small danger" data-action="delete-item" data-id="' + h(i.id) + '">刪除</button></li>';
    }).join('');
    var hint = kind === 'task'
      ? '任務只要建立一次，可指定給全部或部分孩子，每個孩子的完成狀態各自獨立。'
      : (kind === 'penalty' ? '扣分項目輸入正數即可，系統會自動以負數記錄。' : '');
    return (hint ? '<p class="muted small">' + hint + '</p>' : '') +
      '<ul class="rows">' + (list || '<li class="muted">尚未建立</li>') + '</ul>' +
      '<button class="btn primary block" data-action="add-item" data-kind="' + kind + '">＋ 新增' + KIND_LABELS[kind] + '</button>';
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
      '<div class="card"><h2>📥 匯入還原</h2>' +
      '<p class="muted small">匯入會<b>取代</b>目前所有資料，建議先匯出備份。</p>' +
      '<label class="btn block file-btn">選擇 JSON 檔案<input type="file" accept="application/json,.json" data-action="import" hidden></label></div>' +
      '<p class="muted small center">目前資料：' + d.children.length + ' 位孩子・' + d.items.length + ' 個規則・' +
      d.rewards.length + ' 個獎勵・' + d.records.length + ' 筆紀錄</p>';
  }

  // ---------- 表單 ----------
  function openModal(title, fieldsHtml, onSubmit) {
    modalForm.innerHTML = '<h2>' + h(title) + '</h2>' + fieldsHtml +
      '<p class="form-error" hidden></p>' +
      '<div class="modal-actions"><button type="button" class="btn" data-close>取消</button>' +
      '<button type="submit" class="btn primary">儲存</button></div>';
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
    var c = child || { name: '', avatar: AVATARS[store.getChildren().length % AVATARS.length], color: COLORS[store.getChildren().length % COLORS.length], startPoints: 0 };
    var fields =
      '<label class="field">名稱<input type="text" name="name" maxlength="20" required value="' + h(c.name) + '"></label>' +
      '<fieldset class="field"><legend>頭像</legend><div class="pick">' + AVATARS.map(function (a) {
        return '<label class="pick-item"><input type="radio" name="avatar" value="' + a + '"' + (a === c.avatar ? ' checked' : '') + '><span>' + a + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<fieldset class="field"><legend>代表色</legend><div class="pick">' + COLORS.map(function (col) {
        return '<label class="pick-item color"><input type="radio" name="color" value="' + col + '"' + (col === c.color ? ' checked' : '') + '><span style="background:' + col + '"></span></label>';
      }).join('') + '</div></fieldset>' +
      '<label class="field">起始點數<input type="number" name="startPoints" inputmode="numeric" step="1" value="' + c.startPoints + '">' +
      '<small class="muted">起始點數會加入總點數，但不算今日得分。</small></label>';
    openModal(child ? '編輯孩子' : '新增孩子', fields, function (fd) {
      var data = { name: fd.get('name'), avatar: fd.get('avatar'), color: fd.get('color'), startPoints: fd.get('startPoints') };
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
      var val = ctl ? (ctl.value !== undefined ? ctl.value : '') : '';
      el.hidden = val !== p[1];
    });
  }
  modalForm.addEventListener('change', syncConditional);

  function openItemForm(kind, item) {
    var it = item || { name: '', points: kind === 'penalty' ? -5 : 5, childIds: 'all', frequency: { type: 'daily' } };
    var fields =
      '<label class="field">名稱<input type="text" name="name" maxlength="30" required value="' + h(it.name) + '"></label>' +
      '<label class="field">' + (kind === 'penalty' ? '扣除點數' : '點數') +
      '<input type="number" name="points" min="0" step="1" inputmode="numeric" required value="' + Math.abs(it.points) + '"></label>' +
      (kind === 'task' ? freqPicker(it.frequency) : '') +
      childPicker(it.childIds);
    openModal((item ? '編輯' : '新增') + KIND_LABELS[kind], fields, function (fd) {
      var scope = fd.get('scope');
      var data = {
        kind: kind,
        name: fd.get('name'),
        points: fd.get('points'),
        childIds: scope === 'all' ? 'all' : fd.getAll('childIds')
      };
      if (kind === 'task') {
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

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      if (!confirm('確定要用「' + file.name + '」取代目前所有資料嗎？')) return;
      try {
        store.importJSON(String(reader.result));
        toast('匯入完成');
        render();
      } catch (e) {
        alert('匯入失敗：' + e.message);
      }
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
        case 'open-child': ui.showAllRecords = false; go('#/child/' + id); break;
        case 'add-child': openChildForm(); break;
        case 'record': {
          var rec = store.recordItem(childId, id);
          ui.pulse = true;
          toast(rec.name + ' ' + signed(rec.points), rec.points < 0 ? 'neg' : 'pos');
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
            toast('完成 ' + tr.name + ' ' + signed(tr.points), 'pos');
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
          if (!confirm('讓 ' + child.name + ' 用 ' + reward.cost + ' 點兌換「' + reward.name + '」？')) return;
          store.redeemReward(childId, id);
          toast('已兌換 ' + reward.name, 'pos');
          ui.pulse = true;
          render();
          break;
        }
        case 'toggle-history': ui.showAllRecords = !ui.showAllRecords; render(); break;
        case 'edit-child': openChildForm(store.getChild(id)); break;
        case 'delete-child': {
          var c = store.getChild(id);
          if (confirm('確定刪除「' + c.name + '」？\n此孩子的所有紀錄也會一起刪除，且無法復原。')) {
            store.deleteChild(id);
            toast('已刪除');
            render();
          }
          break;
        }
        case 'add-item': openItemForm(el.getAttribute('data-kind')); break;
        case 'edit-item': { var it = store.getItem(id); openItemForm(it.kind, it); break; }
        case 'delete-item': {
          var item = store.getItem(id);
          if (confirm('確定刪除「' + item.name + '」？（過去的紀錄會保留）')) { store.deleteItem(id); render(); }
          break;
        }
        case 'add-reward': openRewardForm(); break;
        case 'edit-reward': openRewardForm(store.getReward(id)); break;
        case 'delete-reward': {
          var rw = store.getReward(id);
          if (confirm('確定刪除獎勵「' + rw.name + '」？（過去的兌換紀錄會保留）')) { store.deleteReward(id); render(); }
          break;
        }
        case 'export': exportData(); break;
      }
    } catch (err) {
      toast(err.message, 'neg');
      render();
    }
  });

  app.addEventListener('change', function (e) {
    if (e.target.matches('[data-action="import"]') && e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    }
  });

  window.addEventListener('hashchange', function () {
    if (modal.open) modal.close();
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

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 離線功能非必要 */ });
    });
  }

  // 測試與除錯用
  window.__cgpStore = store;

  render();
})();
