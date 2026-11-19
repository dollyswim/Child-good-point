/* 親子集點 — 金島第 53 格：齒輪小屋「吃飯好行為大挑戰」（2026-11-19 家長企劃）
 * 計畫：docs/gold/GEAR_HOUSE_PLAN.md；題庫（六項吃飯好行為）在 js/game.js 的 MEAL_RULES。
 * app.js 呼叫 CGPGearHouse(A) 時把共用的工具傳進來（A）；reduceMotion 用 A.reduceMotion 即時讀取。
 * 美術圖還沒到：GH_ART 裡是 null 的就用表情符號暫代，圖到貨後填上檔名即可（餐廳圖都是同一個場景的整張圖，程式只換圖）。 */
(function () {
  'use strict';

  window.CGPGearHouse = function (A) {
    var store = A.store, h = A.h, toast = A.toast, GAME = A.GAME, talkPortrait = A.talkPortrait, charIdOf = A.charIdOf, preloadImages = A.preloadImages;

    /** 圖檔（images/gold/gear-house/）：null＝還沒有圖，用表情符號暫代 */
    var D = 'images/gold/gear-house/';
    var GH_ART = { house: D + 'house.webp', mom: D + 'mom.webp', eat: D + 'eat.webp', happy: D + 'happy.webp', cough: D + 'cough.webp', messy: D + 'messy.webp', dusk: D + 'dusk.webp',   // 2026-11-19 家長圖（13 張到齊）；dusk＝30 分鐘的後果（黃昏、湯涼了）
      pose: { time: D + 'time2.webp', eyes: D + 'eyes.webp', mouth: D + 'mouth.webp', tool: D + 'hand.webp', sit: D + 'walk.webp', feet: D + 'feet.webp' } };
    /** 地圖上的小屋：長地圖座標（第二區左上的空草地，腳底 y）；第 53 格觸發任務 */
    var HOUSE = { gx: 255, gy: 2935, w: 150, tile: 53 };
    var NAME = { kid: '小齒', mom: '媽媽', house: '齒輪小屋' };

    function rule(id) { return GAME.MEAL_RULES.filter(function (r) { return r.id === id; })[0]; }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function still() { return !!A.reduceMotion; }
    /** 金島走到過第幾格（人在其他島時讀金島保存的進度） */
    function goldMax(p) { return p.island === 'gold' ? (p.maxReached || 0) : (((p.islands || {}).gold || {}).maxReached || 0); }
    function reached(player) { return goldMax(player) >= HOUSE.tile; }
    /** 會用到的圖（第 45 格起在背景先下載） */
    function assets() {
      var out = [GH_ART.mom, GH_ART.eat, GH_ART.happy, GH_ART.cough, GH_ART.messy, GH_ART.dusk];
      Object.keys(GH_ART.pose).forEach(function (k) { out.push(GH_ART.pose[k]); });
      return out.filter(Boolean);
    }
    var preloaded = false;
    function preload(board, player) {
      if (preloaded || board.id !== 'gold' || player.pos < 45 || player.story.meal) return;
      preloaded = true;
      var list = assets();
      if (list.length) preloadImages(list, 20000);
    }

    /** 地圖上的齒輪小屋：任務還沒完成又走到過第 53 格時頭上有「！」 */
    function houseDecor(board, player) {
      if (board.id !== 'gold' || !board.regions.some(function (r) { return r.id === 'gold-02' && r.available; })) return '';
      var open = !player.story.meal && !window.__cgpNoStory;
      var art = GH_ART.house ? '<img src="' + GH_ART.house + '" alt="" draggable="false">' : '<span class="gh-house-emoji" aria-hidden="true">🏡<i>⚙️</i></span>';
      return '<div class="story-guide gear-house' + (open && reached(player) ? ' open' : '') + '" id="gear-house" data-tap="house" data-story="meal" style="left:' + HOUSE.gx + 'px;top:' + HOUSE.gy + 'px;width:' + HOUSE.w + 'px;z-index:' + Math.round(HOUSE.gy / 6) + '" role="img" aria-label="' + NAME.house + '">' +
        art + (open ? '<span class="story-bang" aria-hidden="true">！</span>' : '') + '</div>';
    }

    /** 餐廳畫面：有圖就放整張圖；沒有圖用表情符號暫代（小齒＋動作＋餐桌） */
    function sceneHtml(state, r, opts) {
      var img = state === 'eat' ? GH_ART.eat : state === 'happy' ? GH_ART.happy : state === 'cough' ? GH_ART.cough
        : state === 'after' && r.id === 'tool' && GH_ART.messy ? GH_ART.messy : state === 'after' && r.id === 'time' && GH_ART.dusk ? GH_ART.dusk : r ? GH_ART.pose[r.id] : null;
      var overlay = state === 'after' && r && !(r.id === 'tool' && GH_ART.messy) && !(r.id === 'time' && GH_ART.dusk) && r.id !== 'sit' ? '<span class="gh-after-ico" aria-hidden="true">' + r.ico + '</span>' : '';
      var mom = '';   // 2026-11-19 家長：嗆咳時畫面裡不放媽媽（她的圖是笑著揮手），媽媽只出現在對話框
      if (img) return '<img class="gh-scene-img" src="' + img + '" alt="" draggable="false">' + overlay + mom;
      // 部分圖已到：缺的畫面先用「正常吃飯」（嗆咳用「邊走邊吃」）的圖，疊上表情符號標示（2026-11-19）
      var base = state === 'cough' ? GH_ART.pose.sit : GH_ART.eat;
      if (base) {
        var badge = state === 'happy' ? '😄👍' : state === 'cough' ? '😣💦' : r ? r.pose : '';
        return '<img class="gh-scene-img' + (state === 'after' && r && r.id === 'time' ? ' dusk' : '') + '" src="' + base + '" alt="" draggable="false">' +
          (badge ? '<span class="gh-badge" aria-hidden="true">' + badge + '</span>' : '') + overlay + mom;
      }
      var away = r && r.id === 'sit' && (state === 'cue' || state === 'after' || state === 'cough');
      var kid = state === 'happy' ? '😄' : state === 'cough' ? '😣' : '🧒';
      var pose = state === 'cue' || state === 'after' ? '<i class="gh-pose">' + r.pose + '</i>' : state === 'happy' ? '<i class="gh-pose">👍</i>' : state === 'eat' ? '<i class="gh-pose">🥄</i>' : '';
      var dusk = state === 'after' && r && r.id === 'time';   // 30 分鐘的後果：窗外變黃昏
      return '<div class="gh-ph' + (dusk ? ' dusk' : '') + '" aria-hidden="true"><span class="gh-window">' + (dusk ? '🌇' : '🌤️') + '</span><span class="gh-clock">🕰️</span><span class="gh-toys">🧸</span>' +
        '<span class="gh-kid' + (away ? ' away' : '') + '">' + kid + pose + '</span><span class="gh-chair">🪑</span>' +
        '<span class="gh-table">🍚🥣🥛</span></div>' + overlay + mom;
    }

    /**
     * 開一局齒輪小屋（全螢幕）。
     * opts.practice：試玩（#gear-test，不寫存檔）；opts.replay：任務完成後重玩（不給星星）
     * @returns {Promise<{done?:boolean, later?:boolean, quit?:boolean}>}
     */
    function play(child, opts) {
      opts = opts || {};
      return new Promise(function (resolve) {
        var ids = [];   // 按「好啊！」才抽題（選「等一下」不算一局）
        function pick() {
          var forced = window.__cgpMealIds;   // 自動測試指定題目（仍照常記一局）
          var got = child && !opts.practice ? store.startMealGame(child.id) : GAME.pickMealRounds(Math.random, false);
          return forced ? forced.slice() : got;
        }
        var C = GAME.MEAL_GAME, waitMs = window.__cgpMealWait || C.waitSec * 1000, calmMs = window.__cgpMealCalm || (still() ? 1200 : 2500);
        var meImg = child ? 'images/characters/' + charIdOf(child) + '.webp' : null;
        var el = document.createElement('div');
        el.className = 'mg gh-mg'; el.id = 'mg';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', NAME.house + '：吃飯好行為大挑戰');
        el.innerHTML = '<div class="mg-top gh-top"><button type="button" class="btn link gh-quit" data-gh="quit">✕ 離開</button>' +
          '<b class="gh-title">⚙️ ' + NAME.house + '</b><span class="mg-count" id="gh-prog">0 / ' + C.rounds + '</span></div>' +
          '<div class="gh-scene" id="gh-scene"></div>' +
          '<p class="gh-line" id="gh-line" role="status"></p>' +
          '<div class="gh-btns" id="gh-btns">' + GAME.MEAL_RULES.map(function (r) {
            return '<button type="button" class="gh-btn" data-rule="' + r.id + '"><span aria-hidden="true">' + r.icon + '</span>' + h(r.label) + '</button>';
          }).join('') + '</div>' +
          (opts.practice ? '<small class="mg-practice gh-practice">🧪 試玩模式：不會得到星星</small>' : '') +
          '<div class="gh-talk" id="gh-talk"></div>';
        document.body.appendChild(el); document.body.classList.add('mg-open');
        var sceneEl = el.querySelector('#gh-scene'), lineEl = el.querySelector('#gh-line'), progEl = el.querySelector('#gh-prog'), talkEl = el.querySelector('#gh-talk');
        var idx = -1, cur = null, phase = 'intro', timer = 0, afterShown = false, momHome = false, closed = false;
        var talkNext = null;

        function scene(state) { sceneEl.innerHTML = sceneHtml(state, cur, { momHome: momHome }); sceneEl.setAttribute('data-state', state); }
        function line(text, cls) { lineEl.className = 'gh-line' + (cls ? ' ' + cls : ''); lineEl.textContent = text; }
        /** 下方對話框：who＝mom／me／kid／narr；acts＝按鈕 [[代號, 文字, primary]] */
        function talk(who, text, acts) {
          return new Promise(function (res) {
            var port = who === 'mom' ? (GH_ART.mom ? talkPortrait(GH_ART.mom) : '') : who === 'me' && meImg ? talkPortrait(meImg, true) : '';
            var name = who === 'mom' ? (GH_ART.mom ? '' : '👩 ') + NAME.mom : who === 'me' ? (child ? h(child.name) : '我') : who === 'kid' ? '🧒 ' + NAME.kid : '';
            acts = acts || [['next', '繼續', true]];
            talkEl.innerHTML = '<div class="we-talk gh-box' + (who === 'narr' ? ' gh-narr' : '') + '">' + port + (name ? '<span class="we-who">' + name + '</span>' : '') +
              '<p class="we-line">' + h(text) + '</p><div class="pilot-acts">' + acts.map(function (a) {
                return '<button type="button" class="btn' + (a[2] ? ' primary' : '') + '" data-talk="' + a[0] + '">' + h(a[1]) + '</button>';
              }).join('') + '</div></div>';
            el.classList.add('gh-talking');
            talkNext = function (v) { talkEl.innerHTML = ''; el.classList.remove('gh-talking'); talkNext = null; res(v); };
          });
        }
        function finish(r) {
          if (closed) return;
          closed = true; clearTimeout(timer);
          el.remove(); document.body.classList.remove('mg-open');
          resolve(r);
        }
        async function nextRound() {
          idx++;
          if (idx >= ids.length) { await ending(); return; }
          cur = rule(ids[idx]); afterShown = false; phase = 'calm';
          progEl.textContent = (idx + 1) + ' / ' + ids.length;
          scene('eat'); line(NAME.kid + '乖乖吃飯中……');
          timer = setTimeout(cue, calmMs);
        }
        function cue() {
          if (closed) return;
          phase = 'cue'; scene('cue'); line(cur.cue, 'gh-cue');
          timer = setTimeout(after, waitMs);   // 不顯示倒數：時間到就播一次後果
        }
        async function after() {
          if (closed || phase !== 'cue' || afterShown) return;
          afterShown = true; phase = 'after';
          if (cur.safety) {   // 屁股坐：嗆咳（有效咳嗽、恢復呼吸），玩家角色喊大人、媽媽跑回來（2026-11-19 家長決定）
            scene('cough'); line(cur.after, 'gh-after');
            await talk('me', '媽媽！' + NAME.kid + '嗆到了！快來！');
            momHome = true; scene('cough');
            await talk('mom', '我來了！' + NAME.kid + '，用力咳嗽，媽媽在這裡陪你。');
            await talk('narr', NAME.kid + '用力咳嗽，把食物咳出來了，呼吸恢復正常。');
            if (closed) return;
            line('想一想：剛剛應該提醒' + NAME.kid + '什麼呢？', 'gh-cue');
            phase = 'cue';
            return;
          }
          scene('after'); line(cur.after + ' 想一想：應該提醒' + NAME.kid + '什麼呢？', 'gh-after');
          phase = 'cue';
        }
        async function press(id) {
          if (phase === 'calm') { line(NAME.kid + '現在吃得很好喔！等等看他有沒有需要提醒的地方。'); return; }
          if (phase !== 'cue') return;
          if (id !== cur.id) { line('嗯……' + cur.hint + '再看看他在做什麼。', 'gh-hint'); return; }
          clearTimeout(timer); phase = 'fixed';
          var btn = el.querySelector('[data-rule="' + id + '"]'); if (btn) { btn.classList.add('ok'); setTimeout(function () { btn.classList.remove('ok'); }, 900); }
          scene('happy'); line(NAME.kid + '：「' + cur.fixed + '」', 'gh-ok');
          await wait(window.__cgpMealCalm ? 300 : still() ? 1200 : 2400);
          if (!closed) nextRound();
        }
        async function ending() {
          phase = 'end'; progEl.textContent = ids.length + ' / ' + ids.length;
          scene('happy'); line('');
          await talk('mom', (momHome ? '' : '我回來了！') + '謝謝你陪' + NAME.kid + '吃飯！你真是個好幫手！', [['done', '挑戰完成！回到金島', true]]);
          finish({ done: true });
        }

        el.addEventListener('click', function (e) {
          var t = e.target.closest('[data-talk],[data-rule],[data-gh]');
          if (!t) return;
          if (t.hasAttribute('data-talk')) { if (talkNext) talkNext(t.getAttribute('data-talk')); return; }
          if (t.getAttribute('data-gh') === 'quit') { finish({ quit: true }); return; }
          if (el.classList.contains('gh-talking')) return;
          press(t.getAttribute('data-rule'));
        });

        (async function () {
          scene('eat'); line('');
          var ans = await talk('mom', '我得去工坊拿個東西，可以幫我陪' + NAME.kid + '吃飯嗎？', [['later', '等一下', false], ['ok', '好啊！', true]]);
          if (ans === 'later') { finish({ later: true }); return; }
          ids = pick(); progEl.textContent = '0 / ' + ids.length;
          await talk('mom', '謝謝你！' + NAME.kid + '吃飯的時候，如果做得不好，就按下面的按鈕提醒他喔！', [['go', '知道了', true]]);
          nextRound();
        })();
      });
    }

    return { HOUSE: HOUSE, houseDecor: houseDecor, reached: reached, preload: preload, play: play, assets: assets };
  };
})();
