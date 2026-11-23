/* 親子集點 — 火島小遊戲《熔岩跳跳路》V1.0（2026-11-22 家長草稿；計畫 docs/fire/LAVA_GAME_PLAN.md）
 * 兩關：簡易版 6×6（落石）→ 可選困難版 6×8（落石、岩漿平台、地熱蒸氣）。每關 3 次機會，失敗 3 次由洛洛救援。
 * 結算 store.finishLava：簡易版救援 5、簡易版過關結束 10、困難版救援 10、兩關都過 15；整場只一次、只算一次每日小遊戲。
 * 美術圖到貨前用 CSS 圖形暫代（ART 裡填檔名即可換圖）。
 * app.js 呼叫 CGPLava(A) 時把共用工具傳進來。 */
(function () {
  'use strict';

  window.CGPLava = function (A) {
    var store = A.store, h = A.h, toast = A.toast, render = A.render, charIdOf = A.charIdOf, talkPortrait = A.talkPortrait;
    var COLS = 6, STEP_MS = 180, GUARD_MS = 1000, GOAL_EXTRA = 0.4;   // 2026-11-23 家長：終點排加高 0.4 格，終點門放大
    var D = 'images/fire/lava/';   // 2026-11-23 家長美術 L-1～L-8（不放 SHELL，打開小遊戲時才下載）
    var ART = { lolo: D + 'lolo.webp', rock: D + 'rock.webp', platform: D + 'platform2.webp', lava: D + 'lava.webp', ground: D + 'ground.webp',
      ventWarn: D + 'vent_warn.webp', ventBurst: D + 'vent_burst.webp', goal: D + 'goal.webp', bg: D + 'bg2.webp' };
    function preload() { Object.keys(ART).forEach(function (k) { var im = new Image(); im.src = ART[k]; }); }
    var LOLO = '洛洛';
    /**
     * 關卡（由上到下）：goal 終點、safe 安全區、start 起點、rock 落石、plat 岩漿平台、steam 地熱蒸氣。
     * 落石寬 1 格；平台寬 2 格；dir 1 往右、-1 往左；loop＝循環長度（格），count 個等距排列（保證有空隙）。
     */
    var LEVELS = {
      easy: { name: '簡易版', tip: '看準空隙，跳過落石！', rows: [
        { t: 'goal' }, { t: 'rock', speed: 0.8, dir: -1, count: 3, loop: 12, base: 1 }, { t: 'safe' },
        { t: 'rock', speed: 0.75, dir: 1, count: 3, loop: 12, base: 3 }, { t: 'rock', speed: 0.85, dir: -1, count: 3, loop: 12, base: 0 }, { t: 'start' }] },
      hard: { name: '困難版', tip: '躲落石、跳石板、避蒸氣！', rows: [
        { t: 'goal' }, { t: 'steam' }, { t: 'plat', speed: 0.75, dir: -1, count: 3, loop: 10, base: 0, w: 2 },
        { t: 'plat', speed: 0.7, dir: 1, count: 3, loop: 10, base: 1.5, w: 2 }, { t: 'safe' },
        { t: 'rock', speed: 1.15, dir: -1, count: 3, loop: 10.5, base: 2 }, { t: 'rock', speed: 1.1, dir: 1, count: 3, loop: 10.5, base: 0 }, { t: 'start' }] }
    };
    // 地熱蒸氣：左 3 格、右 3 格輪流（家長決定）。週期 7 秒：預警 1.2 秒 → 噴發 2 秒 → 安全；右邊晚 3.5 秒，永遠有一邊安全
    var STEAM = { period: 7, warn: 1.2, burst: 2, offset: { L: 0, R: 3.5 } };
    function steamState(t, half) {
      var p = ((t - STEAM.offset[half]) % STEAM.period + STEAM.period) % STEAM.period;
      return p < STEAM.warn ? 'warn' : p < STEAM.warn + STEAM.burst ? 'burst' : 'safe';
    }
    /** 第 i 個障礙物在時間 t 的左緣（格） */
    function obsX(row, i, t) {
      var off = (row.loop - COLS) / 2, w = row.w || 1;
      var raw = row.base + i * row.loop / row.count + row.dir * row.speed * t;
      return ((raw % row.loop) + row.loop) % row.loop - off - (w - 1) / 2;
    }
    function isGround(t) { return t === 'goal' || t === 'safe' || t === 'start' || t === 'steam' || t === 'rock'; }

    /**
     * 跑一關。回傳 Promise<'clear'|'rescue'|'quit'>
     * @param {HTMLElement} root 小遊戲視窗
     */
    function runLevel(root, child, key, hooks, demo) {   // demo：洛洛示範（自動走到終點、不算失敗、不給星）
      var L = LEVELS[key], R = L.rows.length;
      return new Promise(function (resolve) {
        var stage = root.querySelector('#lv-stage'), field = document.createElement('div');
        field.className = 'lv-field lv-' + key; [].forEach.call(stage.querySelectorAll('.lv-field'), function (f) { f.remove(); }); stage.appendChild(field);
        root.querySelector('#lv-level').textContent = '🌋 ' + L.name;
        hooks.tip(demo ? '洛洛示範：看好時機再跳！' : L.tip);
        var cell = 48, t = 0, last = 0, raf = 0, done = false, fails = 0, guardUntil = 0, rescue = false, paused = false;
        var obs = [];   // { row, i, el }
        L.rows.forEach(function (row, r) {
          var lane = document.createElement('div');
          lane.className = 'lv-lane lv-' + row.t; lane.style.top = r ? 'calc(var(--c) * ' + r + ' + var(--g))' : '0';
          if (row.t === 'steam') lane.innerHTML = '<i class="lv-vent" data-half="L"><u></u><u></u><u></u></i><i class="lv-vent" data-half="R"><u></u><u></u><u></u></i>';   // 每格一個地熱孔
          if (row.t === 'goal') lane.innerHTML = '<img class="lv-goal-art" src="' + ART.goal + '" alt="終點" draggable="false">';
          if (row.t === 'safe' && demo) lane.innerHTML = '<b class="lv-sign">安全區</b>';   // 2026-11-23 家長：安全區只在洛洛示範時標示，正式玩不放字
          field.appendChild(lane);
          if (row.t === 'rock' || row.t === 'plat') for (var i = 0; i < row.count; i++) {
            var o = document.createElement('i');
            o.className = row.t === 'rock' ? 'lv-rock' : 'lv-plat';
            o.style.top = 'calc(var(--c) * ' + r + ' + var(--g))'; if (row.w) o.style.width = 'calc(var(--c) * ' + row.w + ')';
            field.appendChild(o); obs.push({ row: row, r: r, i: i, el: o });
          }
        });
        var me = document.createElement('div');
        me.className = 'lv-me'; me.id = 'lv-me';
        var who = demo ? ART.lolo : 'images/characters/' + h(child ? charIdOf(child) : (A.defaultChar || 'roundear')) + '.webp';   // 試玩：預設冒險夥伴；示範：洛洛
        me.innerHTML = '<i class="lv-foot"></i><img src="' + who + '" alt="" draggable="false">' + '<i class="lv-shield"></i><b class="lv-warn">快跳！</b>';
        field.appendChild(me);
        // 玩家：row 第幾排、px 中心 x（格）；anim 跳躍補間
        var p = { row: R - 1, px: 2.5 }, anim = null;
        function hearts() { root.querySelector('#lv-hearts').textContent = '❤️'.repeat(3 - fails) + '🤍'.repeat(fails); }
        hearts();
        function size() {
          var w = stage.clientWidth, hgt = stage.clientHeight;
          cell = Math.max(30, Math.floor(Math.min(w / COLS, hgt / (8 + GOAL_EXTRA))));   // 兩關用同一個格子大小（以 8 排＋加高的終點計算）
          field.style.setProperty('--c', cell + 'px'); field.style.setProperty('--g', Math.round(cell * GOAL_EXTRA) + 'px');
          field.style.width = cell * COLS + 'px'; field.style.height = (cell * R + Math.round(cell * GOAL_EXTRA)) + 'px';
        }
        size();
        window.addEventListener('resize', size);
        function vis() {
          var x = p.px, y = p.row;
          if (anim) { var k = Math.min(1, (performance.now() - anim.t0) / STEP_MS); x = anim.x + (p.px - anim.x) * k; y = anim.y + (p.row - anim.y) * k; if (k >= 1) anim = null; }
          me.style.transform = 'translate(' + ((x - 0.5) * cell) + 'px,' + (y * cell + Math.round(cell * GOAL_EXTRA)) + 'px)';
        }
        function support(row, r) {   // 站在第 r 排（平台排）時，腳下的平台
          var hit = null;
          obs.forEach(function (o) { if (o.r === r) { var x = obsX(row, o.i, t); if (p.px >= x + 0.05 && p.px <= x + row.w - 0.05) hit = o; } });
          return hit;
        }
        function safeBelow(r) { for (var k = r + 1; k < R; k++) if (L.rows[k].t === 'safe' || L.rows[k].t === 'start') return k; return R - 1; }
        function fail(kind) {
          if (done || rescue || demo || performance.now() < guardUntil) return;
          fails++; hearts();
          var msg = kind === 'rock' ? '咚！被落石撞到了' : kind === 'lava' ? '噗咻～掉進岩漿冒煙了' : kind === 'steam' ? '呼～被蒸氣吹回來了' : '平台把你帶出去了';
          me.classList.remove('bump'); void me.offsetWidth; me.classList.add('bump', 'k-' + kind);
          setTimeout(function () { me.classList.remove('k-rock', 'k-lava', 'k-steam', 'k-edge'); }, 500);
          hooks.tip(msg + (fails < 3 ? '，還有 ' + (3 - fails) + ' 次機會' : ''));
          clearTimeout(hooks.tipT); hooks.tipT = setTimeout(function () { if (!rescue && !done) hooks.tip(L.tip); }, 2200);
          anim = { x: p.px, y: p.row, t0: performance.now() };
          p.row = safeBelow(p.row); p.px = Math.min(5.5, Math.max(0.5, Math.round(p.px - 0.5) + 0.5));
          guardUntil = performance.now() + GUARD_MS; me.classList.add('guard');
          setTimeout(function () { me.classList.remove('guard'); }, GUARD_MS);
          if (fails >= 3) startRescue();
        }
        function check() {
          var row = L.rows[p.row];
          if (row.t === 'rock') obs.forEach(function (o) { if (o.r === p.row && Math.abs(p.px - (obsX(row, o.i, t) + 0.5)) < 0.68) fail('rock'); });
          if (row.t === 'plat' && !support(row, p.row)) fail('lava');
          if (row.t === 'steam' && steamState(t, p.px < 3 ? 'L' : 'R') === 'burst') fail('steam');
        }
        function move(dx, dy) {
          if (done || rescue || paused || anim) return;
          var nr = Math.min(R - 1, Math.max(0, p.row + dy)), nx = p.px + dx, onPlat = L.rows[p.row].t === 'plat';
          if (dx && !onPlat && (nx < 0.5 || nx > 5.5)) return;   // 地面上不能走出邊界
          if (dy && nr === p.row) return;
          anim = { x: p.px, y: p.row, t0: performance.now() };
          p.row = nr; p.px = nx;
          if (isGround(L.rows[p.row].t)) p.px = Math.min(5.5, Math.max(0.5, Math.round(p.px - 0.5) + 0.5));   // 跳到地面對齊格子
          if (L.rows[p.row].t === 'goal') { win(); return; }
          if (p.px < 0 || p.px > COLS) { fail('edge'); return; }
          check();
        }
        hooks.move = demo ? null : move;
        if (demo) startDemo();
        function win() {
          done = true;
          setTimeout(function () { stop(); resolve(demo ? 'demo' : rescue ? 'rescue' : 'clear'); }, STEP_MS + (demo ? 700 : 250));
        }
        /** 洛洛示範：預先看 0.7 秒內前一排有沒有落石，有空隙才往上跳；到安全區停一下（只在簡易版） */
        function startDemo() {
          var steps = 0;
          function clearAhead(r) {
            var row = L.rows[r];
            if (row.t !== 'rock') return true;
            for (var k = 0; k <= 14; k++) { var tt = t + k * 0.05;
              for (var i = 0; i < row.count; i++) if (Math.abs(p.px - (obsX(row, i, tt) + 0.5)) < 0.95) return false; }
            return true;
          }
          (function tick() {
            if (done) return;
            if (hooks.isTalking() || paused) { setTimeout(tick, 200); return; }
            var r = p.row - 1;
            if (clearAhead(r)) {
              hooks.tip(L.rows[r].t === 'goal' ? '到終點了！' : '現在跳！');
              anim = { x: p.px, y: p.row, t0: performance.now() }; p.row = r; steps++;
              if (L.rows[r].t === 'goal') { win(); return; }
              if (L.rows[r].t === 'safe') { var sg = field.querySelector('.lv-sign'); if (sg) sg.classList.add('hi'); }
              setTimeout(function () { hooks.tip(L.rows[p.row].t === 'safe' ? '這排是安全區，沒有落石，可以慢慢觀察～' : '等空隙…'); tick(); }, L.rows[r].t === 'safe' ? 2000 : 450);
            } else { hooks.tip('等空隙…'); setTimeout(tick, 120); }
          })();
        }
        function startRescue() {
          rescue = true;
          setTimeout(function () {
            hooks.talk([LOLO + '：「這段路有點難呢！」', LOLO + '：「別擔心！我給你一個防護罩，我們一次衝過去吧！」']).then(function () {
              me.classList.add('shielded');
              (function step() {
                if (p.row <= 0) { win(); return; }
                anim = { x: p.px, y: p.row, t0: performance.now() };
                p.row--; p.px = Math.min(5.5, Math.max(0.5, Math.round(p.px - 0.5) + 0.5));
                if (p.row === 0) { win(); return; }
                setTimeout(step, 420);
              })();
            });
          }, 600);
        }
        function frame(now) {
          var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
          if (!paused && !hooks.isTalking()) {
            t += dt * (window.__cgpLavaSpeed != null ? window.__cgpLavaSpeed : 1);   // __cgpLavaSpeed：自動測試用（0＝障礙物停住）
            var row = L.rows[p.row];
            if (row.t === 'plat' && !rescue && !done) {   // 站在平台上：跟著平台移動；到邊邊閃紅光提醒，出界才算失敗
              var sp = support(row, p.row);
              if (sp) p.px += row.dir * row.speed * dt;
              me.classList.toggle('edge', p.px < 0.5 || p.px > 5.5);
              if (p.px < 0 || p.px > COLS) fail('edge');
            } else me.classList.remove('edge');
            if (!rescue && !done) check();
          }
          obs.forEach(function (o) { o.el.style.transform = 'translateX(' + (obsX(o.row, o.i, t) * cell) + 'px)'; });
          [].forEach.call(field.querySelectorAll('.lv-vent'), function (v) { v.setAttribute('data-s', steamState(t, v.getAttribute('data-half'))); });
          vis();
          if (!done || anim) raf = requestAnimationFrame(frame);
        }
        function onVis() { paused = document.hidden; last = 0; }
        document.addEventListener('visibilitychange', onVis);
        hooks.quit = function () { done = true; stop(); resolve(demo ? 'demo' : 'quit'); };   // 示範時按離開＝跳過示範
        function stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', onVis); hooks.move = null; }
        hooks.debug = function () { return { row: p.row, px: p.px, fails: fails, t: t, rescue: rescue }; };
        hooks.setTime = function (v) { t = v; };
        hooks.layout = function () {   // 自動測試用：每一排的類型與障礙物左緣（格）
          return L.rows.map(function (row, r) { return { t: row.t, w: row.w || 1, xs: obs.filter(function (o) { return o.r === r; }).map(function (o) { return obsX(row, o.i, t); }) }; });
        };
        raf = requestAnimationFrame(frame);
      });
    }

    /**
     * 開一場熔岩跳跳路。opts.practice＝試玩（#lava-test：不寫存檔、不給星星）。
     * @returns {Promise<{quit?:boolean, outcome?:string, stars?:number}>}
     */
    function play(child, opts) {
      opts = opts || {};
      var practice = !!opts.practice, childId = child && child.id;
      return new Promise(function (resolve) {
        var el = document.createElement('div');
        el.className = 'mg lv-mg'; el.id = 'mg';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '熔岩跳跳路');
        el.innerHTML = '<div class="lv-top"><button type="button" class="btn link lv-quit" data-lv="quit">✕ 稍後再玩</button>' +
          '<b id="lv-level">🌋 熔岩跳跳路</b><span id="lv-hearts">❤️❤️❤️</span></div>' +
          '<p class="lv-tip" id="lv-tip">看準空隙再前進！</p>' +
          '<div class="lv-stage" id="lv-stage"><button type="button" class="lv-skip" id="lv-skip" hidden>跳過示範 ⏭</button></div>' +
          '<div class="lv-pad" id="lv-pad"><button type="button" data-d="up" aria-label="往上">▲</button><button type="button" data-d="left" aria-label="往左">◀</button>' +
          '<button type="button" data-d="down" aria-label="往下">▼</button><button type="button" data-d="right" aria-label="往右">▶</button></div>' +
          (practice ? '<small class="mg-practice lv-practice">🧪 試玩模式：不會得到星星</small>' : '') +
          '<div class="lv-talk" id="lv-talk"></div>';
        document.body.appendChild(el); document.body.classList.add('mg-open'); preload();
        var talkEl = el.querySelector('#lv-talk'), tipEl = el.querySelector('#lv-tip'), talking = false, closed = false;
        var hooks = {
          tip: function (s) { tipEl.textContent = s; },
          isTalking: function () { return talking; },
          talk: function (lines, acts) { return talk(lines, acts); }
        };
        window.__cgpLava = hooks;   // 自動測試用
        /** 洛洛對話：lines 依序顯示；acts＝最後一句的按鈕 [[代號, 文字, primary]] */
        function talk(lines, acts) {
          return new Promise(function (res) {
            var i = 0; talking = true;
            function draw() {
              var lastLine = i === lines.length - 1, a = lastLine && acts ? acts : [['next', '繼續', true]];
              var line = lines[i].replace(new RegExp('^' + LOLO + '：'), '');
              talkEl.innerHTML = '<div class="we-talk lv-box">' + (ART.lolo ? talkPortrait(ART.lolo) : '<span class="lv-lolo" aria-hidden="true">🦎</span>') +
                '<span class="we-who">' + LOLO + '</span><p class="we-line">' + h(line) + '</p><div class="pilot-acts">' +
                a.map(function (b) { return '<button type="button" class="btn' + (b[2] ? ' primary' : '') + '" data-talk="' + b[0] + '">' + h(b[1]) + '</button>'; }).join('') + '</div></div>';
            }
            talkEl.onclick = function (e) {
              var b = e.target.closest('[data-talk]'); if (!b) return;
              if (b.getAttribute('data-talk') === 'next' && i < lines.length - 1) { i++; draw(); return; }
              talkEl.innerHTML = ''; talkEl.onclick = null; talking = false; res(b.getAttribute('data-talk'));
            };
            draw();
          });
        }
        function press(d) { if (hooks.move) hooks.move(d === 'left' ? -1 : d === 'right' ? 1 : 0, d === 'up' ? -1 : d === 'down' ? 1 : 0); }
        el.querySelector('#lv-pad').addEventListener('pointerdown', function (e) {
          var b = e.target.closest('[data-d]'); if (!b) return;
          e.preventDefault(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120);
          press(b.getAttribute('data-d'));
        });
        function onKey(e) {
          var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
          if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
        }
        document.addEventListener('keydown', onKey);
        var demoing = false, skipBtn = el.querySelector('#lv-skip');
        skipBtn.onclick = function () { if (demoing && hooks.quit) hooks.quit(); };
        el.querySelector('[data-lv=quit]').onclick = function () {
          if (demoing) { closed = false; if (hooks.quit) hooks.quit(); finish({ quit: true }); return; }
          if (hooks.quit) hooks.quit(); else finish({ quit: true });
        };
        function finish(r) {
          if (closed) return; closed = true;
          document.removeEventListener('keydown', onKey);
          el.remove(); document.body.classList.remove('mg-open');
          if (window.__cgpLava === hooks) window.__cgpLava = null;
          resolve(r);
        }
        function settle(outcome) {
          var stars = { easyRescue: 5, easyClear: 10, hardRescue: 10, hardClear: 15 }[outcome];
          if (!practice) { try { stars = store.finishLava(childId, outcome).stars; } catch (err) { toast(err.message, 'neg'); } }
          var line = outcome === 'hardClear' ? '你連困難版都過了！真是火島小勇士！' : outcome === 'easyRescue' ? '下次再試試看，你一定會越來越厲害！' : '做得很好！下次再來挑戰喔！';
          return talk([LOLO + '：「' + line + '」'], [['done', (practice ? '試玩結束（' : '得到 ⭐') + stars + (practice ? ' 星）' : ' 能量星星！'), true]])
            .then(function () { finish({ outcome: outcome, stars: stars }); });
        }
        function afterEasy(res) {
          if (res === 'quit') { finish({ quit: true }); return; }
          if (res === 'rescue') { if (!practice) try { store.saveLavaEasy(childId, 'rescue'); } catch (e) {} settle('easyRescue'); return; }
          if (!practice) try { store.saveLavaEasy(childId, 'clear'); } catch (e) {}
          talk([LOLO + '：「太棒了！你成功穿過落石！」', LOLO + '：「要不要挑戰更刺激的困難版？」'], [['take', '領取 10 星，結束', false], ['hard', '繼續挑戰困難版', true]]).then(function (a) {
            if (a === 'take') { settle('easyClear'); return; }
            hooks.tip('困難版：落石更快，還要跳上岩漿平台、躲開蒸氣！');
            runLevel(el, child, 'hard', hooks).then(function (r2) {
              if (r2 === 'quit') { finish({ quit: true }); return; }
              settle(r2 === 'clear' ? 'hardClear' : 'hardRescue');
            });
          });
        }
        var saved = !practice && store.getPendingMinigame(childId) && (store.getPendingMinigame(childId).lava || {}).easy;
        if (saved) { afterEasy(saved); return; }   // 家長決定：中途關掉 App，回來保留簡易版成績
        // 2026-11-23 家長：洛洛示範怎麼玩——每個孩子第一次自動播放（可跳過），之後開場可選「再看一次示範」
        var seen = practice ? false : store.lavaDemoSeen(childId);
        var intro = [LOLO + '：「嗨！我是火島嚮導洛洛！」', LOLO + '：「按下面的方向鍵一格一格跳，看準落石的空隙，跳到最上面的終點！」'];
        function demo() {
          demoing = true; skipBtn.hidden = false;
          return runLevel(el, child, 'easy', hooks, true).then(function () {
            demoing = false; skipBtn.hidden = true;
            if (!practice) try { store.markLavaDemo(childId); } catch (e) {}
            if (closed) return 'quit';
            return talk([LOLO + '：「看到了嗎？等落石過去再跳，到安全區可以慢慢看！」', LOLO + '：「換你了！」'], [['go', '出發！', true]]);
          });
        }
        function start() { if (!closed) runLevel(el, child, 'easy', hooks).then(afterEasy); }
        if (!seen) talk(intro.concat([LOLO + '：「第一次來，先看我示範一次喔！」']), [['demo', '好，看示範', true]]).then(demo).then(start);
        else talk(intro, [['demo', '再看一次示範', false], ['go', '出發！', true]]).then(function (a) { return a === 'demo' ? demo() : a; }).then(start);
      });
    }

    /** 小遊戲格（或試玩網址）開啟熔岩跳跳路 */
    function open(childId, subtitle, opts) {
      var practice = !!(opts && opts.practice), child = childId ? store.getChild(childId) : null;
      play(child, { practice: practice }).then(function (r) {
        if (practice) { location.replace('#home'); render(); return; }
        if (r.quit) { toast('熔岩跳跳路留著，等一下再玩'); render(); return; }
        toast('⭐ 熔岩跳跳路得到 ' + r.stars + ' 顆能量星星！', 'pos');
        render();
      });
    }

    return { open: open, play: play, LEVELS: LEVELS, STEAM: STEAM, steamState: steamState, obsX: obsX };
  };
})();
