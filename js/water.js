/* 親子集點 — 水島（劇情、任務、撈魚小遊戲）
 * 2026-11-19 從 js/app.js 拆出來，內容與行為不變。
 * app.js 呼叫 CGPWater(A) 時把共用的工具傳進來（A）；
 * reduceMotion、BADGE_IMG、WOOD_SLIDES、audioCtx 在 app.js 比較晚才建立，所以用 A.xxx 即時讀取。 */
(function () {
  'use strict';

  window.CGPWater = function (A) {
    var store = A.store, h = A.h, toast = A.toast, confirmThen = A.confirmThen, charIdOf = A.charIdOf, render = A.render,
        GAME = A.GAME, STAR_IMG = A.STAR_IMG, regionOf = A.regionOf, talkPortrait = A.talkPortrait, partyPanel = A.partyPanel, followPawn = A.followPawn,
        sleep = A.sleep, hopAlong = A.hopAlong, announceAchievements = A.announceAchievements, soundOn = A.soundOn, islandCard = A.islandCard, tripSkipper = A.tripSkipper,
        preloadImages = A.preloadImages;

    /** 小白鯨載我前進（水島：餵過小白鯨後每天 3 次；佔用溜冰鞋的位置，水島不能用溜冰鞋） */
    function belugaAct(child, player, off) {
      var friend = !!player.story.feed, left = store.belugaRidesLeft(child.id);
      return '<button class="dice-btn beluga" data-action="beluga-ride" data-kind="beluga"' + (off || !friend || !left ? ' disabled' : '') + '>' +
        '<span class="item-art dice-icon"><img src="' + WATER_NPC.beluga + '" alt="" aria-hidden="true" width="256" height="256" decoding="async"></span><b>小白鯨載我</b><small>' +
        (!friend ? '先在第 34 格和牠當朋友' : left ? '今天還可以 ' + left + ' 次' : '牠游累了，明天再來') + '</small></button>';
    }
    /** 水島地圖上的 NPC（迎接漁夫、魚桶、牛奶瓶提示等由劇情另外放；這裡放第 100 格萊莫的門口標記） */
    var WATER_NPC = { fisherman: 'images/water/npc/fisherman.webp', beluga: 'images/water/npc/beluga.webp', shark: 'images/water/npc/shark_v2.webp',   // 2026-11-18 家長換新圖（壞笑露牙的鯊魚惡霸；換檔名讓快取立刻生效）
      lantern: 'images/water/npc/anglerfish.webp',
      monster: 'images/water/npc/monster_confused.webp', monsterSurprised: 'images/water/npc/monster_surprised.webp', monsterBlanket: 'images/water/npc/monster_blanket.webp' };
    /**
     * 水島圖片提前下載（2026-11-18 家長選）：水島圖不在 SHELL，第一次用到才下載；網路慢時任務視窗會先空白。
     * 每次畫地圖時看前方 12 格：有任務格就先下載那關的圖；會換場景就先下載下一張場景背景。下載過的不重複。
     */
    var waterPreloaded = {};
    function waterAssets(tile) {
      var I = 'images/water/items/', F = 'images/water/find/';
      switch (tile) {
        case 8: return [WATER_ART.memo, WATER_ART.bottle];
        case 16: return [WATER_ART.potion, WATER_NPC.fisherman];
        case 34: return [WATER_ART.seabed, WATER_ART.fish, WATER_ART.bucket, WATER_NPC.beluga, I + 'heart_bubble.webp'];
        case 48: return [WATER_ART.sharkBg, WATER_NPC.shark];
        case 56: return [WATER_ART.lanternBg, WATER_NPC.lantern].concat(LANTERN_ITEMS.map(function (it) { return F + it[0] + '.webp'; }));
        case 100: return [WATER_ART.room, MONSTER_SEAT, WATER_NPC.monster, WATER_NPC.monsterSurprised, WATER_NPC.monsterBlanket, WATER_ART.blanket, WATER_ART.bottle,
          I + 'notebook_closed.webp', I + 'notebook_open.webp', I + 'wrench.webp', I + 'puddle.webp', I + 'box_open.webp']
          .concat(BOSS_BOXES.map(function (b) { return I + 'box_' + b[0] + '.webp'; }), BOSS_CARDS.map(function (c) { return I + 'card_' + c[0] + '.webp'; }),
            [WATER_TRIP[3], WATER_TRIP[2], WATER_TRIP[4], A.BADGE_IMG.waterClear1, WATER_END_ART.boat, FIRE_FOLK.faint, FIRE_FOLK.panic, FIRE_FOLK.calm]);
      }
      return [];
    }
    function waterPreload(board, player) {
      if (!board || board.id !== 'water') return;
      var list = [], end = Math.min(board.tiles.length - 1, player.pos + 12);
      for (var n = player.pos + 1; n <= end; n++) {
        list = list.concat(waterAssets(n));
        var r = regionOf(board, board.tiles[n]); if (r && r.background) list.push(r.background.webp);
      }
      list = list.filter(function (u) { if (!u || waterPreloaded[u]) return false; waterPreloaded[u] = true; return true; });
      if (list.length) preloadImages(list, 15000);
    }
    function waterDecor(child, board, player, scene) {
      if (board.id !== 'water' || typeof waterMapDecor !== 'function') return '';
      return waterMapDecor(child, board, player, scene);
    }

    // ---------- 水島劇情（2026-11-17 起；計畫 docs/water/WATER_ISLAND_PLAN.md 第 4、5 節）----------
    // 還沒到貨的插圖先用佔位（表情符號、色塊、程式畫的備忘圖）；正式圖到貨後只要填 WATER_ART 的檔名。
    var WATER_ART = {
      // 2026-11-17 D 節正式圖（Codex）驗收通過；水島圖不放進 SHELL，第一次用到才下載
      memo: 'images/water/task/memo_map.webp',        // D-1 備忘藏寶圖 1200×900（拼圖底圖；下方空白由 App 寫「最重要的寶……」再切片）
      seabed: 'images/water/task/open_water.webp',    // D-2 明亮海底（餵白鯨）
      sharkBg: 'images/water/task/shark_deep.webp',   // 2026-11-18 家長提供：較深的藍色海底（只給第 48 格鯊魚惡霸用）
      lanternBg: 'images/water/task/search_cave.webp', // D-3 燈籠魚找東西的海底（明亮版，黑暗由程式疊上）
      room: 'images/water/task/cabin_room.webp',      // D-4 萊莫房間
      bottle: 'images/water/items/bottle.webp', potion: 'images/water/items/potion.webp', fish: 'images/water/items/fish.webp', bucket: 'images/water/items/fish_bucket.webp',
      blanket: 'images/water/items/blanket.webp'
    };
    function kidImg(child) { return 'images/characters/' + charIdOf(child) + '.webp'; }
    function waterImg(src, alt, cls, emoji) {
      return src ? '<img class="' + (cls || '') + '" src="' + src + '" alt="' + (alt || '') + '" draggable="false">' : '<span class="w-emoji ' + (cls || '') + '" aria-hidden="true">' + (emoji || '❔') + '</span>';
    }
    /**
     * 連續對話（下方對話框＋人物半身大圖）：lines＝[{ who, img, me, text, choices }]；最後一句的選項回傳 val
     * 孩子說的話 me＝true（大圖在右邊）
     */
    function talkSeq(lines) {
      return new Promise(function (resolve) {
        var i = 0, el = document.createElement('div');
        el.className = 'pilot-talk water-talk'; el.id = 'water-talk'; el.setAttribute('role', 'dialog');
        function draw() {
          var L = lines[i], last = i === lines.length - 1, ch = L.choices || [{ label: last ? '好！' : '繼續', val: true, primary: true }];
          el.setAttribute('aria-label', L.who || '對話');
          el.innerHTML = '<div class="we-talk pilot-box">' + (L.img ? talkPortrait(L.img, L.me).replace('we-portrait', 'we-portrait' + (L.big ? ' we-big' : '')) : '') + '<span class="we-who">' + h(L.who || '') + '</span><p class="we-line">' + h(L.text) + '</p>' +
            '<div class="pilot-acts' + (ch.length < 2 ? ' one' : '') + '">' + ch.map(function (c, k) { return '<button type="button" class="btn' + (c.primary ? ' primary' : '') + '" data-talk="' + k + '">' + h(c.label) + '</button>'; }).join('') + '</div></div>';
        }
        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-talk]');
          if (!b) return;
          var c = (lines[i].choices || [{ val: true }])[Number(b.getAttribute('data-talk'))];
          if (i < lines.length - 1 && !lines[i].choices) { i++; draw(); return; }
          el.remove(); resolve(c.val);
        });
        draw(); document.body.appendChild(el);
      });
    }
    var WHO = {
      fisher: function () { return { who: '漁夫爺爺', img: WATER_NPC.fisherman }; },
      beluga: function () { return { who: '小白鯨', img: WATER_NPC.beluga }; },
      shark: function () { return { who: '大鯊魚', img: WATER_NPC.shark }; },
      lantern: function () { return { who: '燈籠魚', img: WATER_NPC.lantern }; },
      monster: function (k) { return { who: '萊莫', big: true, img: k === 'surprised' ? WATER_NPC.monsterSurprised : k === 'blanket' ? WATER_NPC.monsterBlanket : WATER_NPC.monster }; },
      me: function (child) { return { who: child.name, img: kidImg(child), me: true }; }
    };
    function line(w, text, extra) { return Object.assign({}, w, { text: text }, extra || {}); }
    /** 預覽模式（?preview=water-…）不寫存檔 */
    function wflag(child, k, v) { if (!child.preview) store.setWaterFlag(child.id, k, v); }
    function wstate(child) { return child.preview ? { water: {}, bag: { shield: 1 } } : store.getPlayer(child.id); }

    // 沿路短對話（A 類，經過就播；12 段，計畫第 4 節）
    var WATER_NOTES = {
      4: { id: 'n4', who: 'me', text: '咦？沙灘上有一個玻璃牛奶瓶，裡面塞著好多碎紙條！先帶著它吧。', bottle: true },
      24: { id: 'n24', who: 'fisher', text: '喝了藥水就可以在水裡呼吸囉！出發吧，小心別迷路！' },
      30: { id: 'n30', who: 'me', text: '哇～海底好漂亮！好多會發光的水母和彩色小魚！' },
      42: { id: 'n42', who: 'beluga', text: '前面有一隻大鯊魚守著路，要小心喔！' },
      58: { id: 'n58', who: 'lantern', text: '洞口就在這裡！跟著小白鯨游進去吧！' },
      62: { id: 'n62', who: 'beluga', text: '我帶你穿過石柱，跟緊我喔！' },
      70: { id: 'n70', who: 'me', text: '牆上的礦石在發光……上面好像畫著一條船的航線！' },
      78: { id: 'n78', who: 'me', text: '看！柱子後面有一艘沉船！藏寶圖上畫的就是它！' },
      82: { id: 'n82', who: 'me', text: '船艙門破了一個洞，我們從這裡進去吧！' },
      86: { id: 'n86', who: 'voice', text: '（門後傳來聲音）「我的寶貝跑去哪裡了？」……一定是寶藏！' },
      92: { id: 'n92', who: 'me', text: '牆上的紙牌寫著「記得看提醒」……是誰這麼健忘呀？' },
      98: { id: 'n98', who: 'voice', text: '（門後）「找到了！……喔，是我的腳。」門縫裡看得到倒放的椅子。' }
    };
    /** 這次走過的格子有沒看過的沿路對話：依序播出（點一下可以先關掉） */
    async function waterNotes(child, visited) {
      var p = store.getPlayer(child.id);
      if (p.island !== 'water' || window.__cgpNoStory) return;
      var list = visited.filter(function (n, i) { return WATER_NOTES[n] && visited.indexOf(n) === i; });
      for (var i = 0; i < list.length; i++) {
        var N = WATER_NOTES[list[i]];
        if (!store.markWaterNote(child.id, N.id)) continue;
        if (N.bottle) wflag(child, 'bottle', true);
        var w = N.who === 'me' ? WHO.me(child) : N.who === 'voice' ? { who: '？？？', img: '' } : WHO[N.who]();
        await talkSeq([line(w, N.text)]);
      }
    }

    /** 抵達水島：漁夫迎接（第一次完整說明＋送魚桶；之後一句提醒）、重置任務詢問（計畫第 4.1 節） */
    async function waterWelcome(child) {
      var p = store.getPlayer(child.id);
      if (p.island !== 'water' || window.__cgpNoStory) return;
      var F = WHO.fisher(), first = !p.water.welcomed;
      if (first) {
        await talkSeq([line(F, '歡迎來到水島！我是這裡的漁夫爺爺。'),
          line(F, '在水裡，溜冰鞋、飛行翼和傳送門都不能用喔！要靠自己的腳和骰子前進。'),
          line(F, '海裡的朋友常常肚子餓，這個魚桶和泡泡網給你，遇到餓肚子的朋友，就撈魚餵牠吧！', { choices: [{ label: '🪣 拿魚桶和泡泡網', val: true, primary: true }] })]);
        wflag(child, 'bucket', true); wflag(child, 'welcomed', true); wflag(child, 'rulesSeen', true);
        toast('🪣 拿到空魚桶和泡泡網！（故事物品）', 'pos');
        if (!p.story.feed) await fillBucket(child, [line(F, '魚桶空空的可不行！先在珊瑚灣撈 ' + GAME.FISH_GAME.storyGoal + ' 條魚，把魚桶裝滿吧！')]);   // 2026-11-19 家長：拿到魚桶就開始撈
        return;
      }
      await talkSeq([line(F, '又見面啦！記得在水裡不能用溜冰鞋、飛行翼和傳送門喔！', { choices: [{ label: '知道了', val: true, primary: true }] })]);
      var offer = store.storyResetOffer(child.id);
      if (offer && store.canPlayToday(child.id)) {
        var yes = await talkSeq([line(F, '這次要不要把 ' + offer.count + ' 個任務重新來一次？再完成一樣送你 ⭐' + GAME.STORY_STARS + '！',
          { choices: [{ label: '不用了', val: false }, { label: '好，重新來！', val: true, primary: true }] })]);
        store.answerStoryReset(child.id, yes);
        if (yes) {
          await talkSeq([line(F, '好！魚桶和泡泡網再給你一次！', { choices: [{ label: '🪣 拿魚桶和泡泡網', val: true, primary: true }] })]);
          wflag(child, 'bucket', true);
          toast('🔄 水島的任務重新開始囉！', 'pos');
        }
      } else if (!p.water.bucket && !p.story.feed) {
        await talkSeq([line(F, '魚桶和泡泡網帶著吧，遇到餓肚子的朋友用得到！', { choices: [{ label: '🪣 拿魚桶和泡泡網', val: true, primary: true }] })]);
        wflag(child, 'bucket', true);
      }
    }

    /** 水島任務入口（runStory 遇到水島時改走這裡）：每一關自己完成資料寫入 */
    async function waterTask(child, id, sp, guide) {
      if (id === 'memo') return waterMemo(child);
      if (id === 'potion') return waterPotion(child);
      if (id === 'feed') return waterFeed(child);
      if (id === 'shark') return waterShark(child);
      if (id === 'lantern') return waterLantern(child);
      if (id === 'blanket') return waterBoss(child);
    }
    /** 完成一般關卡：⭐3＋提示 */
    function waterDone(child, id) {
      if (child.preview) return false;
      var first = store.completeStory(child.id, id);
      if (first) toast('⭐ 完成任務「' + GAME.STORIES[id].name + '」：+' + GAME.STORY_STARS + ' 能量星星', 'pos');
      return first;
    }

    // 第 8 格：拼回 20 片備忘地圖（5×4，點一片再點位置；選了的片會提示正確位置的輪廓）
    /**
     * 拼圖底圖準備：正式圖下方的空白處先寫上「最重要的寶……」再切片（不然最下面一排都是一樣的空白紙）；
     * 並比對每一片的縮圖，長得幾乎一樣的碎紙互相算對（孩子分不出來的不該算錯）
     */
    async function memoPrepare(url, COLS, ROWS) {
      var N = COLS * ROWS, fallback = { src: url, text: false, same: function () { return false; } };
      if (/^data:/.test(url)) return fallback;   // 佔位圖已經有字
      try {
        var img = new Image(); img.src = url;
        await img.decode();
        try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('900 40px "jf-openhuninn"', '最重要的寶……'), sleep(1500)]); } catch (e) { /* 沒有字型也照樣寫 */ }
        var W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var g = cv.getContext('2d'); g.drawImage(img, 0, 0);
        g.save(); g.translate(W * 0.5, H * 0.875); g.rotate(-0.03);
        g.font = '900 ' + Math.round(H * 0.11) + 'px "jf-openhuninn", "Huninn", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = H * 0.012; g.strokeStyle = 'rgba(120, 70, 30, .35)'; g.strokeText('最重要的寶……', 0, 0);
        g.fillStyle = '#7a4a26'; g.fillText('最重要的寶……', 0, 0);
        g.restore();
        var tw = 16, th = 12, sm = document.createElement('canvas'); sm.width = COLS * tw; sm.height = ROWS * th;
        var sg = sm.getContext('2d'); sg.drawImage(cv, 0, 0, sm.width, sm.height);
        var px = sg.getImageData(0, 0, sm.width, sm.height).data;
        function diff(a, b) {
          var ax = (a % COLS) * tw, ay = Math.floor(a / COLS) * th, bx = (b % COLS) * tw, by = Math.floor(b / COLS) * th, t = 0;
          for (var y = 0; y < th; y++) for (var x = 0; x < tw; x++) for (var c = 0; c < 3; c++) t += Math.abs(px[((ay + y) * sm.width + ax + x) * 4 + c] - px[((by + y) * sm.width + bx + x) * 4 + c]);
          return t / (tw * th * 3);
        }
        var SAME = {};
        for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) if (diff(a, b) < 7) { SAME[a + '-' + b] = SAME[b + '-' + a] = true; }
        return { src: cv.toDataURL('image/webp', 0.85), text: true, same: function (a, b) { return !!SAME[a + '-' + b]; } };
      } catch (err) { return fallback; }
    }
    function memoPlaceholder() {   // 正式 D-1 到貨前：程式畫的蠟筆風備忘圖（沉船、大星星、歪箭頭、三個箱子、小枕頭）
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f6ead0"/><rect x="30" y="30" width="1140" height="840" fill="none" stroke="#d8c39a" stroke-width="10" stroke-dasharray="40 20"/>' +
        '<path d="M120 640 q90 70 260 0 l-30 -90 h-200 z" fill="#b5835a" stroke="#6b4426" stroke-width="10"/><rect x="200" y="470" width="20" height="90" fill="#6b4426"/><path d="M220 470 l90 45 l-90 25z" fill="#e7c37a"/>' +
        '<path d="M430 590 q60 -120 140 -60 q60 50 120 -40" fill="none" stroke="#4a7fbf" stroke-width="12" stroke-dasharray="30 18"/><path d="M690 480 l-10 40 l40 -14z" fill="#4a7fbf"/>' +
        '<polygon points="900,150 935,240 1030,245 955,300 985,390 900,335 815,390 845,300 770,245 865,240" fill="#ffd23f" stroke="#c9961a" stroke-width="8"/>' +
        '<g fill="#e0b98a" stroke="#6b4426" stroke-width="8"><rect x="700" y="610" width="110" height="90" rx="8"/><rect x="840" y="610" width="110" height="90" rx="8"/><rect x="980" y="610" width="110" height="90" rx="8"/></g>' +
        '<ellipse cx="200" cy="200" rx="110" ry="60" fill="#fff" stroke="#9aa6c8" stroke-width="8"/><path d="M110 200 q90 30 180 0" stroke="#c7cde3" stroke-width="6" fill="none"/>' +
        '<path d="M500 260 q40 -60 80 0 t80 0" stroke="#7a5a3a" stroke-width="10" fill="none"/><path d="M640 250 l20 15 l-25 10z" fill="#7a5a3a"/></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    async function waterMemo(child) {
      var p = wstate(child);
      if (!p.water.bottle) { wflag(child, 'bottle', true); await talkSeq([line(WHO.me(child), '路上撿到的玻璃牛奶瓶，裡面塞著好多碎紙條……')]); }
      await talkSeq([line(WHO.me(child), '瓶子裡的紙條好像可以拼成一張圖！我來拼拼看！')]);
      var COLS = 5, ROWS = 4, N = COLS * ROWS, prep = await memoPrepare(WATER_ART.memo || memoPlaceholder(), COLS, ROWS), src = prep.src, same = prep.same;
      function ok(i) { return at[i] != null && (at[i] === i || same(at[i], i)); }   // 長得一樣的碎紙放哪一片都算對
      var P = partyPanel({ title: '拼回神祕的地圖！', sub: '把碎紙拖到地圖上（或先點碎紙、再點位置），放錯可以再拖去別的地方' }, null, 'water-panel memo-panel');
      // 2026-11-17 家長：要真的能拼——想放哪就放哪、可以自己調整，全部放對才完成；另有提示按鈕
      // 狀態：at[格子]＝放在那裡的碎紙編號（null＝空）；碎紙 k 的正確位置就是格子 k
      var at = []; for (var k = 0; k < N; k++) at.push(null);
      var trayOrder = []; for (k = 0; k < N; k++) trayOrder.push(k);
      for (var j = N - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)); var tmp = trayOrder[j]; trayOrder[j] = trayOrder[r]; trayOrder[r] = tmp; }
      function bgPos(k) { return (k % COLS) / (COLS - 1) * 100 + '% ' + Math.floor(k / COLS) / (ROWS - 1) * 100 + '%'; }
      function paint(el, k) {   // 把碎紙 k 的圖案畫在元素上
        el.style.backgroundImage = 'url("' + src + '")'; el.style.backgroundSize = COLS * 100 + '% ' + ROWS * 100 + '%'; el.style.backgroundPosition = bgPos(k);
      }
      P.art.innerHTML = '<div class="memo-board" id="memo-board">' + at.map(function (_, i) { return '<button type="button" class="memo-slot" data-slot="' + i + '" aria-label="位置 ' + (i + 1) + '"></button>'; }).join('') + '</div>';
      P.tools.innerHTML = '<div class="memo-tray" id="memo-tray"></div>' +
        '<div class="memo-bar"><span class="party-count" id="memo-count">0 / ' + N + '</span><button type="button" class="btn" id="memo-hint">💡 提示</button></div>';
      var board = P.art.querySelector('#memo-board'), tray = P.tools.querySelector('#memo-tray'), slots = board.querySelectorAll('.memo-slot');
      var sel = null;   // 目前選起來的碎紙：{ k, from: 'tray'｜格子編號 }
      function onBoard(k) { return at.indexOf(k) >= 0; }
      function draw() {
        slots.forEach(function (sl, i) {
          var k = at[i];
          sl.classList.toggle('filled', k != null); sl.classList.remove('hint', 'wrong');
          if (k != null) { paint(sl, k); sl.setAttribute('data-piece-on', String(k)); }
          else { sl.style.backgroundImage = ''; sl.removeAttribute('data-piece-on'); }
          sl.classList.toggle('on', !!sel && sel.from === i);
        });
        tray.innerHTML = trayOrder.filter(function (k) { return !onBoard(k); }).map(function (k) {
          return '<button type="button" class="memo-piece' + (sel && sel.from === 'tray' && sel.k === k ? ' on' : '') + '" data-piece="' + k + '" aria-label="碎紙"></button>';
        }).join('');
        tray.querySelectorAll('.memo-piece').forEach(function (b) { paint(b, Number(b.getAttribute('data-piece'))); });
        var filled = at.filter(function (x) { return x != null; }).length, right = at.filter(function (x, i) { return ok(i); }).length;
        P.tools.querySelector('#memo-count').textContent = filled + ' / ' + N;
        if (filled === N && right < N) P.sub.textContent = '還有 ' + (N - right) + ' 片位置不對，拖一拖換個位置，或按「💡 提示」';
        return right === N;
      }
      /** 把碎紙 k（從 from 拿起）放到 to（格子編號，或 'tray' 收回） */
      function move(k, from, to) {
        if (to === 'tray') { if (from !== 'tray') at[from] = null; return; }
        if (from === to) return;
        var other = at[to];
        at[to] = k;
        if (from !== 'tray') at[from] = other;          // 從地圖上拖過來：兩片交換
        // 從下面拿上來、目標格子已經有一片：那一片回到下面（other 不在地圖上就會出現在下面）
      }
      var finish;
      var done = new Promise(function (r) { finish = r; });
      function after() { sel = null; if (draw()) { P.tools.querySelector('#memo-hint').disabled = true; setTimeout(finish, A.reduceMotion ? 100 : 500); } }
      // 點選：先點碎紙（下面或地圖上的），再點格子；選起地圖上的碎紙後點下面＝收回
      function tapAt(target) {
        var slot = target.closest && target.closest('.memo-slot'), piece = target.closest && target.closest('.memo-piece'), inTray = target.closest && target.closest('#memo-tray');
        if (piece) { var pk = Number(piece.getAttribute('data-piece')); sel = { k: pk, from: 'tray' }; draw(); return; }   // 點同一片也維持選取（提示幫忙選好後，孩子常會再點一次）
        if (slot) {
          var i = Number(slot.getAttribute('data-slot'));
          if (sel) { move(sel.k, sel.from, i); after(); return; }
          if (at[i] != null) { sel = { k: at[i], from: i }; draw(); }
          return;
        }
        if (inTray && sel && sel.from !== 'tray') { move(sel.k, sel.from, 'tray'); after(); }
      }
      // 拖曳：按住碎紙移動超過 8px 就變成拖曳，放開的地方是格子就放上去、是下面就收回
      var drag = null;
      P.shade.addEventListener('pointerdown', function (e) {
        var piece = e.target.closest('.memo-piece'), slot = e.target.closest('.memo-slot.filled');
        if (!piece && !slot) return;
        var k = piece ? Number(piece.getAttribute('data-piece')) : at[Number(slot.getAttribute('data-slot'))];
        drag = { k: k, from: piece ? 'tray' : Number(slot.getAttribute('data-slot')), x: e.clientX, y: e.clientY, el: null, src: piece || slot, id: e.pointerId };
      });
      P.shade.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.el) {
          if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
          var w = slots[0].getBoundingClientRect();
          drag.el = document.createElement('div'); drag.el.className = 'memo-drag'; paint(drag.el, drag.k);
          drag.el.style.width = w.width + 'px'; drag.el.style.height = w.height + 'px';
          document.body.appendChild(drag.el); drag.src.classList.add('lifting');
          try { P.shade.setPointerCapture(e.pointerId); } catch (err) { /* 有些瀏覽器不支援 */ }
        }
        e.preventDefault();
        drag.el.style.left = e.clientX + 'px'; drag.el.style.top = e.clientY + 'px';
        slots.forEach(function (sl) { sl.classList.remove('over'); });
        var under = document.elementFromPoint(e.clientX, e.clientY), os = under && under.closest('.memo-slot');
        if (os) os.classList.add('over');
      });
      function endDrag(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag; drag = null;
        if (!d.el) return;   // 沒有移動：當作點一下（交給 click 處理）
        d.el.remove(); d.src.classList.remove('lifting'); slots.forEach(function (sl) { sl.classList.remove('over'); });
        var under = document.elementFromPoint(e.clientX, e.clientY), os = under && under.closest('.memo-slot');
        if (os) move(d.k, d.from, Number(os.getAttribute('data-slot')));
        else if (d.from !== 'tray') move(d.k, d.from, 'tray');   // 從地圖拖到外面：收回下面
        d.dragged = true; P.shade._skipClick = true; setTimeout(function () { P.shade._skipClick = false; }, 0);
        after();
      }
      P.shade.addEventListener('pointerup', endDrag);
      P.shade.addEventListener('pointercancel', function (e) { if (drag && drag.el) { drag.el.remove(); drag.src.classList.remove('lifting'); } drag = null; });
      P.shade.addEventListener('click', function (e) {
        if (P.shade._skipClick) return;
        if (e.target.closest('#memo-hint')) { hint(); return; }
        tapAt(e.target);
      });
      // 提示：先標出一片放錯的；都沒放錯，就亮出一片碎紙和它的位置
      function hint() {
        draw();
        var wrong = at.findIndex(function (x, i) { return x != null && !ok(i); });
        if (wrong >= 0) { slots[wrong].classList.add('wrong'); P.sub.textContent = '💡 亮紅框的這片放錯了，拖去別的地方試試看！'; return; }
        var left = trayOrder.filter(function (x) { return !onBoard(x); }), k = left[0];
        if (k == null) return;
        var to = at[k] == null ? k : at.findIndex(function (x, i) { return x == null && same(k, i); });   // 位置被長得一樣的碎紙佔了：找一個一樣的空位
        if (to < 0) to = k;
        sel = { k: k, from: 'tray' }; draw();
        slots[to].classList.add('hint');
        P.sub.textContent = '💡 這片碎紙（已經幫你選好了）要放在亮黃框的位置！';
      }
      draw();
      await done;
      P.art.querySelector('#memo-board').classList.add('complete');   // 拼好：拿掉格線，變成一整張圖
      if (!prep.text) P.art.insertAdjacentHTML('beforeend', '<p class="memo-text">最重要的寶……</p>');
      P.title.textContent = '🗺️ 拼好了！'; P.sub.textContent = '沉船、大星星、歪歪的箭頭、三個箱子……還有一個小枕頭？';
      P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="scene-ok">一定是藏寶圖！</button>';
      await new Promise(function (r) { P.tools.querySelector('#scene-ok').onclick = function () { P.shade.remove(); r(); }; });
      waterDone(child, 'memo');
      await talkSeq([line(WHO.me(child), '「最重要的寶……」一定是寶藏！我們去找漁夫爺爺問問看！')]);
    }

    // 第 16 格：漁夫看藏寶圖、送潛水藥水
    async function waterPotion(child) {
      var F = WHO.fisher(), M = WHO.me(child);
      await talkSeq([line(F, '這張圖怪怪的……怎麼還畫著一個枕頭？'), line(M, '那一定是藏寶的暗號！'), line(F, '……你確定？'),
        line(F, '好吧，要去海底找沉船，就喝下這瓶潛水藥水，在水裡也能呼吸！', { choices: [{ label: '🧪 喝下藥水', val: true, primary: true }] })]);
      var P = partyPanel({ title: '喝下潛水藥水！', sub: '咕嚕咕嚕……身體輕飄飄的！' }, null, 'water-panel potion-panel');
      P.art.innerHTML = '<div class="potion-show">' + waterImg(WATER_ART.potion, '潛水藥水', 'potion-img', '🧪') + '<i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i></div>';
      P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="scene-ok">🌊 可以在水裡呼吸了！</button>';
      await new Promise(function (r) { P.tools.querySelector('#scene-ok').onclick = function () { P.shade.remove(); r(); }; });
      waterDone(child, 'potion');
    }

    // 第 34 格：一條一條把魚餵給小白鯨（10 條）
    async function waterFeed(child) {
      var p = wstate(child), B = WHO.beluga();
      if (!p.water.bucket) {
        await talkSeq([line(B, '好餓喔……'), line(WHO.fisher(), '（漁夫爺爺划著小船過來）忘了帶魚桶和泡泡網嗎？拿去吧！', { choices: [{ label: '🪣 拿魚桶和泡泡網', val: true, primary: true }] })]);
        wflag(child, 'bucket', true);
      }
      // 2026-11-19 家長：魚桶要撈滿 10 條才能餵（通常在漁夫給魚桶時就撈好；沒撈滿就在這裡接著撈）
      var GOAL = GAME.FISH_GAME.storyGoal, have0 = child.preview ? (fillBucket.pv || 0) : (wstate(child).water.fishCaught || 0);
      if (have0 < GOAL) {
        var full = await fillBucket(child, have0 ? [line(B, '咕嚕～還是好餓……'), line(WHO.me(child), '魚桶裡有 ' + have0 + ' 條了，再撈 ' + (GOAL - have0) + ' 條就夠了！')]
          : [line(B, '咕嚕～我肚子好餓喔……'), line(WHO.me(child), '我的魚桶是空的……我去撈 ' + GOAL + ' 條魚給你吃！')]);
        if (!full) return;   // 先休息：關卡還在，下次接著撈
      }
      await talkSeq([line(B, '咕嚕～我肚子好餓喔……'), line(WHO.me(child), '魚桶裝滿了！一條一條餵你吃！')]);
      var P = partyPanel({ title: '餵小白鯨吃魚！', sub: '點一條魚，餵給小白鯨（共 10 條）' }, null, 'water-panel feed-panel');
      P.art.innerHTML = (WATER_ART.seabed ? '<img class="party-bg" src="' + WATER_ART.seabed + '" alt="" draggable="false">' : '') +
        '<div class="feed-beluga" id="feed-beluga">' + waterImg(WATER_NPC.beluga, '小白鯨') + '</div>' +
        '<div class="feed-fish">' + Array.from({ length: 10 }, function (_, i) { return '<button type="button" class="feed-one" data-i="' + i + '" aria-label="魚">' + waterImg(WATER_ART.fish, '', '', '🐟') + '</button>'; }).join('') + '</div>';
      P.tools.innerHTML = '<span class="party-count" id="feed-count">🐟 0 / 10</span>';
      await new Promise(function (resolve) {
        var n = 0, bel = P.art.querySelector('#feed-beluga');
        P.art.addEventListener('click', function (e) {
          var f = e.target.closest('.feed-one');
          if (!f || f.classList.contains('got')) return;
          f.classList.add('got'); n++;
          bel.classList.remove('yum'); void bel.offsetWidth; bel.classList.add('yum');
          var hb = document.createElement('img'); hb.className = 'feed-heart'; hb.src = 'images/water/items/heart_bubble.webp'; hb.alt = ''; hb.draggable = false;   // 每餵一條冒一顆愛心泡泡
          hb.style.left = (bel.offsetLeft + bel.offsetWidth * (0.35 + Math.random() * 0.3)).toFixed(0) + 'px'; hb.style.top = (bel.offsetTop + bel.offsetHeight * 0.5).toFixed(0) + 'px';
          P.art.appendChild(hb); setTimeout(function () { hb.remove(); }, 1600);
          P.tools.querySelector('#feed-count').textContent = '🐟 ' + n + ' / 10';
          if (n >= 10) setTimeout(resolve, A.reduceMotion ? 100 : 700);
        });
      });
      P.shade.remove();
      wflag(child, 'bucket', false);   // 魚桶空了
      waterDone(child, 'feed');
      await talkSeq([line(B, '好飽好飽！謝謝你！我們是好朋友了！'), line(B, '以後我每天可以載你游 ' + store.getLimits().beluga + ' 次喔！按「小白鯨載我」就可以了！'),
        line(B, '還有這個貝殼送你！在水島想我的時候吹一吹，我就會游過來陪你玩！', { choices: [{ label: '🐚 收下呼喚貝殼', val: true, primary: true }] })]);
    }

    // 第二版：小白鯨呼喚貝殼（2026-11-17 家長決定現在做）。餵過小白鯨（story.feed）就有，只限水島、不限次數、不給獎勵，也不存檔
    var CALL_LINES = ['咕嚕～我來了！', '一起游泳好開心！', '噗噗～送你愛心泡泡！', '你今天也很棒喔！', '我在這裡～要加油喔！'];
    var callBusy = false;
    function callBeluga() {
      if (callBusy) return;
      callBusy = true;
      var pawn = document.getElementById('pawn');
      if (pawn) {   // 冒險地圖上：小白鯨游到角色旁邊，冒愛心泡泡
        var f = document.createElement('div');
        f.className = 'pawn-beluga-friend'; f.setAttribute('aria-hidden', 'true');
        f.innerHTML = '<img class="pbf-body" src="' + WATER_NPC.beluga + '" alt="" draggable="false">' +
          Array.from({ length: 4 }, function (_, i) { return '<img class="pbf-bubble" src="images/water/items/heart_bubble.webp" alt="" draggable="false" style="left:' + (10 + i * 22) + '%;animation-delay:' + (0.6 + i * 0.35).toFixed(2) + 's">'; }).join('');
        pawn.appendChild(f);
        if (typeof followPawn === 'function') followPawn(true);
        toast('🐳 ' + CALL_LINES[Math.floor(Math.random() * CALL_LINES.length)], 'pos');
        setTimeout(function () { f.remove(); callBusy = false; }, A.reduceMotion ? 1500 : 3600);
        return;
      }
      var el = document.createElement('div');
      el.className = 'beluga-call'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="bc-beluga"><img src="' + WATER_NPC.beluga + '" alt="" draggable="false"></div>' +
        Array.from({ length: 6 }, function (_, i) { return '<img class="bc-bubble" src="images/water/items/heart_bubble.webp" alt="" draggable="false" style="left:' + (18 + i * 12 + Math.random() * 6).toFixed(0) + '%;animation-delay:' + (0.5 + i * 0.22).toFixed(2) + 's;width:' + (34 + Math.random() * 22).toFixed(0) + 'px">'; }).join('');
      document.body.appendChild(el);
      toast('🐳 ' + CALL_LINES[Math.floor(Math.random() * CALL_LINES.length)], 'pos');
      setTimeout(function () { el.remove(); callBusy = false; }, A.reduceMotion ? 1200 : 3000);
    }

    /**
     * 撈魚把魚桶裝滿（劇情模式，可分好幾局累積、存檔；不算每日小遊戲、不給能量星星）。intro：開始前的對話
     * @returns 是否已經裝滿
     */
    async function fillBucket(child, intro) {
      var GOAL = GAME.FISH_GAME.storyGoal, have = child.preview ? (fillBucket.pv || 0) : (wstate(child).water.fishCaught || 0);
      if (have >= GOAL) return true;
      if (intro && intro.length) await talkSeq(intro);
      while (have < GOAL) {
        var fr = await fishGame({ title: '撈魚裝滿魚桶', sub: '累積撈到 ' + GOAL + ' 條，就能餵餓肚子的小白鯨', story: true, have: have, laterLabel: '等一下再撈' });
        if (fr.quit) { toast('🐟 走到第 34 格遇到小白鯨時，還可以接著撈', 'pos'); return false; }
        have = child.preview ? (fillBucket.pv = Math.min(GOAL, have + fr.caught)) : store.addFeedFish(child.id, fr.caught);
        if (have >= GOAL) break;
        var again = await talkSeq([line(WHO.me(child), '魚桶裡有 ' + have + ' 條魚了，還差 ' + (GOAL - have) + ' 條！',
          { choices: [{ label: '先休息', val: false }, { label: '🫧 再撈一次', val: true, primary: true }] })]);
        if (!again) { toast('🐟 魚桶裡的 ' + have + ' 條魚會留著，下次接著撈！', 'pos'); return false; }
      }
      await talkSeq([line(WHO.me(child), '魚桶裝滿 ' + GOAL + ' 條魚了！遇到餓肚子的朋友就可以餵牠！')]);
      return true;
    }

    // 第 48 格：大鯊魚（免費 12 面骰擲到 11 或 12 才過；或用防護罩，過關後補 10 星）
    async function waterShark(child) {
      await talkSeq([line(WHO.shark(), '是誰想偷偷經過我的地盤？'), line(WHO.shark(), '想通過？你試試看！'),
        line(WHO.beluga(), '哇！是鯊魚惡霸，我們要用最快的速度游過去才行！')]);   // 2026-11-18 家長改台詞
      // 2026-11-18 家長：排版優化（圖片 → 標題 → 過關條件 → 本次擲骰結果 → 再擲一次 → 防護罩），精簡說明文字；規則不變
      var P = partyPanel({ title: '鯊魚惡霸擋路！', sub: '' }, null, 'water-panel shark-panel');
      P.sub.innerHTML = '擲出 <em>11</em> 或 <em>12</em>，就能通過！';
      P.art.innerHTML = '<img class="party-bg" src="' + (WATER_ART.sharkBg || WATER_ART.seabed) + '" alt="" draggable="false">' +
        '<div class="shark-big" id="shark-big">' + waterImg(WATER_NPC.shark, '大鯊魚') + '</div>';
      var shieldN = wstate(child).bag.shield;
      // 2026-11-18 家長：視窗出現時先顯示提示，按「開始擲骰！」才進入擲骰畫面（沒有防護罩就不提防護罩）
      var PAY = GAME.SHARK_PAY_STARS;   // 2026-11-18 家長：沒有防護罩時可以花 ⭐5 直接過關
      P.tools.innerHTML = '<div class="shark-intro" id="shark-intro"><p>💡 ' + (shieldN ? '擲出 11、12，或是使用防護罩，就能快速通過！' : '擲出 11、12，或是花 ⭐' + PAY + ' 顆能量星星，就能快速通過！') + '</p>' +
        '<button type="button" class="btn primary shark-roll" id="shark-start">開始擲骰！</button></div><div class="shark-main" id="shark-main" hidden>' +
        '<div class="shark-result"><span class="shark-result-label">本次擲骰結果</span><div class="shark-die" id="shark-die" aria-live="polite">？</div></div>' +
        '<button type="button" class="btn primary shark-roll" id="shark-roll"><img src="images/items/dice_12.webp" alt="" aria-hidden="true" draggable="false"><span id="shark-roll-text">擲骰子！</span></button>' +
        (shieldN ? '<button type="button" class="btn shark-shield" id="shark-shield"><img src="images/items/shield.webp" alt="" aria-hidden="true" draggable="false">' +
          '<span><b>使用防護罩直接過關</b><small>消耗 1 個・回補 ⭐' + GAME.SHARK_SHIELD_STARS + '</small></span></button>'
          : '<button type="button" class="btn shark-shield" id="shark-pay"><img src="images/items/star.webp" alt="" aria-hidden="true" draggable="false">' +
            '<span><b>花能量星星直接過關</b><small>消耗 ⭐' + PAY + '（目前 ⭐' + (child.preview ? '—' : store.getStarBalance(child.id)) + '）</small></span></button>') + '</div>';
      P.sub.hidden = true;
      P.tools.querySelector('#shark-start').onclick = function () { P.tools.querySelector('#shark-intro').remove(); P.tools.querySelector('#shark-main').hidden = false; P.sub.hidden = false; };
      var res = await new Promise(function (resolve) {
        var busy = false, die = P.tools.querySelector('#shark-die');
        P.tools.querySelector('#shark-roll').onclick = async function () {
          if (busy) return; busy = true;
          var r;
          try { if (child.preview) { var v = 1 + Math.floor(Math.random() * 12); r = { value: v, pass: v >= GAME.SHARK_PASS, first: true }; } else r = store.sharkTry(child.id); } catch (err) { toast(err.message, 'neg'); busy = false; return; }
          for (var i = 0; i < (A.reduceMotion ? 1 : 6); i++) { die.textContent = 1 + Math.floor(Math.random() * 12); await sleep(60); }
          die.textContent = r.value;
          die.classList.toggle('win', r.pass);
          if (r.pass) P.sub.textContent = '🎉 擲出 ' + r.value + '！快游過去！';
          else P.tools.querySelector('#shark-roll-text').textContent = '再擲一次！';
          busy = false;
          if (r.pass) setTimeout(function () { resolve(r); }, A.reduceMotion ? 300 : 1200);   // 2026-11-18 家長：擲出 11、12 時鯊魚留在原地，不做讓開的動畫
        };
        var pb = P.tools.querySelector('#shark-pay');
        if (pb) pb.onclick = function () {
          confirmThen('花 ⭐' + PAY + ' 顆能量星星讓鯊魚讓路？', '花星星', false, function () {
            try { var r = child.preview ? { pass: true, paid: true, first: true } : store.sharkPay(child.id); setTimeout(function () { resolve(r); }, A.reduceMotion ? 300 : 600); } catch (err) { toast(err.message, 'neg'); }
          });
        };
        var sb = P.tools.querySelector('#shark-shield');
        if (sb) sb.onclick = function () {
          confirmThen('用 1 個 🛡️ 防護罩讓鯊魚讓路？\n過關後補你 ' + GAME.SHARK_SHIELD_STARS + ' 顆能量星星。', '使用', false, function () {
            try { var r = child.preview ? { pass: true, shield: true, stars: GAME.SHARK_SHIELD_STARS, first: true } : store.sharkShield(child.id); P.art.querySelector('#shark-big').classList.add('aside'); setTimeout(function () { resolve(r); }, A.reduceMotion ? 300 : 900); } catch (err) { toast(err.message, 'neg'); }
          });
        };
      });
      P.shade.remove();
      if (res.first) toast('⭐ 完成任務「大鯊魚攔路」：+' + GAME.STORY_STARS + ' 能量星星' + (res.shield ? '，防護罩補償 +' + res.stars : ''), 'pos');
      await talkSeq(res.paid ? [line(WHO.shark(), '哼，亮晶晶的星星……好吧，這次讓你過去！'), line(WHO.me(child), '謝謝大鯊魚！')]
        : res.shield ? [line(WHO.shark(), '哇，防護罩好厲害！過去吧！'), line(WHO.me(child), '謝謝大鯊魚！')]
        : [line(WHO.shark(), '等等！你去哪裡！'), line(WHO.me(child), '我們趕路，先走囉～')]);   // 2026-11-18 家長改台詞（擲出 11、12）
      if (!child.preview) await hopAlong(child, [GAME.STORIES.shark.tile + 1]);
    }

    // 第 56 格：在黑暗中，拖著燈籠魚的燈照亮一小圈，找回 10 樣東西（計畫第 4.3 節；光圈直徑先用畫面寬度 1/8）
    var LANTERN_ITEMS = [['coral', '珊瑚', ''], ['scallop', '扇貝', ''], ['starfish', '海星', ''], ['conch', '海螺', ''], ['pearl', '珍珠', ''],
      ['seaglass', '海玻璃', ''], ['stone', '小石片', ''], ['driftwood', '漂流木', ''], ['seaweed', '海草束', ''], ['bell', '銅鈴', '']];
    var LANTERN_SPOTS = [[14, 22], [32, 74], [50, 32], [72, 20], [86, 62], [20, 52], [62, 82], [42, 56], [80, 40], [10, 84]];
    var LANTERN_LIGHT = 3 / 8;   // 照亮的圓直徑＝畫面寬度的 3/8（2026-11-16 家長定 1/8；2026-11-18 試玩後改大 3 倍）
    var LANTERN_CAVE = [84, 46];  // D-3 右邊石拱洞口的位置（畫面百分比）：全部找到後，光聚到這裡
    async function waterLantern(child) {
      var L = WHO.lantern();
      await talkSeq([line(L, '嗚嗚……我的東西掉了一地，這裡好黑，我一個人找不到……'), line(WHO.me(child), '我來幫你！拖著你的燈，我們一起找！')]);
      var P = partyPanel({ title: '燈籠魚找東西', sub: '拖著燈籠魚移動，燈光照到東西時點一下（共 10 樣）' }, null, 'water-panel lantern-panel');
      P.art.innerHTML = (WATER_ART.lanternBg ? '<img class="party-bg" src="' + WATER_ART.lanternBg + '" alt="" draggable="false">' : '<div class="lantern-bg-ph"></div>') +
        LANTERN_ITEMS.map(function (it, i) {
          var src = it[2] ? '' : 'images/water/find/' + it[0] + '.webp';
          return '<button type="button" class="lantern-item" data-i="' + i + '" style="left:' + LANTERN_SPOTS[i][0] + '%;top:' + LANTERN_SPOTS[i][1] + '%" aria-label="' + it[1] + '">' + waterImg(src, '', '', it[2]) + '</button>';
        }).join('') +
        '<div class="lantern-dark" id="lantern-dark"></div><div class="lantern-fish" id="lantern-fish">' + waterImg(WATER_NPC.lantern, '燈籠魚') + '</div><div class="lantern-say" id="lantern-say" hidden></div>';
      P.tools.innerHTML = '<div class="lantern-list" id="lantern-list">' + LANTERN_ITEMS.map(function (it, i) {
        return '<span class="lantern-want" data-i="' + i + '">' + waterImg(it[2] ? '' : 'images/water/find/' + it[0] + '.webp', '', '', it[2]) + '<small>' + it[1] + '</small></span>';
      }).join('') + '</div><div class="lantern-acts"><span class="party-count" id="lantern-count">0 / 10</span><button type="button" class="btn small" id="lantern-hint">💡 提示</button></div>';
      var art = P.art, dark = art.querySelector('#lantern-dark'), fish = art.querySelector('#lantern-fish'), say = art.querySelector('#lantern-say');
      var lx = 50, ly = 50, boost = 1, found = 0, hintLv = 0, timers = [];
      function radius() { return art.clientWidth * LANTERN_LIGHT / 2 * boost; }
      function place() {
        // 2026-11-18 家長：照亮的地方要有漸層 → 中心全亮，半徑 55% 起慢慢變暗，到 1.3 倍半徑全黑（找東西的判定範圍不變）
        var W = art.clientWidth, H = art.clientHeight, x = lx / 100 * W, y = ly / 100 * H, r = radius(), out = place.soft ? 1.6 : 1.3;
        dark.style.background = 'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(8,18,46,0) 0, rgba(8,18,46,0) ' + (r * .55) + 'px, rgba(8,18,46,.35) ' + (r * .85) + 'px, rgba(8,18,46,.75) ' + (r * 1.1) + 'px, rgba(8,18,46,.97) ' + (r * out) + 'px)';
        fish.style.left = x + 'px'; fish.style.top = y + 'px';
      }
      function moveTo(e) {
        var R = art.getBoundingClientRect();
        lx = Math.max(2, Math.min(98, (e.clientX - R.left) / R.width * 100));
        ly = Math.max(2, Math.min(98, (e.clientY - 34 - R.top) / R.height * 100));   // 燈在手指上方一點，手指不會擋住
        place();
      }
      function lit(i) {
        var W = art.clientWidth, H = art.clientHeight;
        return Math.hypot((LANTERN_SPOTS[i][0] - lx) / 100 * W, (LANTERN_SPOTS[i][1] - ly) / 100 * H) <= radius() + W * 0.035;
      }
      function nearest() {
        var best = -1, bd = 1e9;
        LANTERN_ITEMS.forEach(function (_, i) { if (art.querySelector('.lantern-item[data-i="' + i + '"].got')) return; var d = Math.hypot(LANTERN_SPOTS[i][0] - lx, LANTERN_SPOTS[i][1] - ly); if (d < bd) { bd = d; best = i; } });
        return best;
      }
      function speak(t) { say.hidden = false; say.textContent = t; clearTimeout(speak.t); speak.t = setTimeout(function () { say.hidden = true; }, 2600); }
      place();
      await new Promise(function (resolve) {
        var dragging = false;
        art.addEventListener('pointerdown', function (e) {
          var it = e.target.closest('.lantern-item');
          if (it && lit(Number(it.getAttribute('data-i')))) {
            if (it.classList.contains('got')) return;
            var i = Number(it.getAttribute('data-i'));
            it.classList.add('got'); found++;
            P.tools.querySelector('.lantern-want[data-i="' + i + '"]').classList.add('got');
            P.tools.querySelector('#lantern-count').textContent = found + ' / 10';
            speak('找到' + LANTERN_ITEMS[i][1] + '了！');
            if (found >= 10) { timers.forEach(clearInterval); setTimeout(resolve, A.reduceMotion ? 100 : 700); }
            return;
          }
          dragging = true; try { art.setPointerCapture(e.pointerId); } catch (err) { /* 不支援也能點 */ }
          moveTo(e);
        });
        art.addEventListener('pointermove', function (e) { if (dragging) moveTo(e); });
        art.addEventListener('pointerup', function () { dragging = false; });
        art.addEventListener('pointercancel', function () { dragging = false; });
        timers.push(setInterval(function () {   // 黑暗中偶爾在還沒找到的東西附近閃一下
          var left = LANTERN_ITEMS.map(function (_, i) { return i; }).filter(function (i) { return !art.querySelector('.lantern-item[data-i="' + i + '"].got'); });
          if (!left.length) return;
          var i = left[Math.floor(Math.random() * left.length)], s = document.createElement('i');
          s.className = 'lantern-spark'; s.style.left = LANTERN_SPOTS[i][0] + (Math.random() * 8 - 4) + '%'; s.style.top = LANTERN_SPOTS[i][1] + (Math.random() * 8 - 4) + '%';
          art.appendChild(s); setTimeout(function () { s.remove(); }, 900);
        }, 4500));
        P.tools.querySelector('#lantern-hint').onclick = function () {
          var i = nearest(); if (i < 0) return;
          hintLv = hintLv % 3 + 1;
          var dx = LANTERN_SPOTS[i][0] - lx, dy = LANTERN_SPOTS[i][1] - ly;
          var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '右邊' : '左邊') : (dy > 0 ? '下面' : '上面');
          if (hintLv === 1) speak('好像在' + dir + '……');
          else if (hintLv === 2) { boost = 1.5; place(); speak('我用力發光！'); setTimeout(function () { boost = 1; place(); }, 5000); }
          else speak('往' + dir + '游！' + (dir === '右邊' ? '➡️' : dir === '左邊' ? '⬅️' : dir === '下面' ? '⬇️' : '⬆️'));
        };
      });
      // 2026-11-18 家長：不要整片變亮——燈籠魚游到洞口，光只聚在洞口那一角，其他地方仍然黑黑的
      var sx = lx, sy = ly, steps = A.reduceMotion ? 1 : 30;
      place.soft = true;
      for (var st = 1; st <= steps; st++) {
        var t = st / steps, e2 = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        lx = sx + (LANTERN_CAVE[0] - sx) * e2; ly = sy + (LANTERN_CAVE[1] - sy) * e2; boost = 1 - 0.12 * t; place();
        await sleep(40);
      }
      art.classList.add('cave-lit');
      P.title.textContent = '✨ 全部找到了！'; P.sub.textContent = '燈籠魚游到角落，照出了一個洞口！';
      P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="scene-ok">🎉 太好了！</button>';
      await new Promise(function (r) { P.tools.querySelector('#scene-ok').onclick = function () { P.shade.remove(); r(); }; });
      waterDone(child, 'lantern');
      await talkSeq([line(L, '謝謝你幫忙！唔？我們好像來到海底洞穴入口了。'), line(WHO.me(child), '燈籠魚，我們在找這張地圖上的沉船，你有看過嗎？'),
        line(L, '這個海底洞穴裡好像有一艘沉船，不知道是不是你要找的沉船。'), line(WHO.me(child), '好，那我進去看看！')]);   // 2026-11-18 家長改台詞
    }

    // 第 100 格：萊莫的家（三階段：搜索 → 整理昨天 → 牛奶瓶真相與選箱），每完成一階段存檔（計畫第 5.3 節）
    var BOSS_SPOTS = [
      // 2026-11-17 位置對準 D-4 正式圖的家具（x、y＝中心、w、h＝可點範圍，都是畫面百分比）；圖裡沒有木箱，改成布簾
      // 2026-11-18 家長：不顯示文字標籤（會擋住家具），改成透明可點範圍＋手勢游標，另有提示按鈕
      { id: 'bed', label: '床', emoji: '🛏️', x: 15, y: 62, w: 28, h: 34, card: 0, say: '床底下只有一隻拖鞋……床沿露出一角紙！' },
      { id: 'cupboard', label: '雪花櫃', emoji: '🧊', x: 30.5, y: 42, w: 15, h: 31, say: '櫃子門上貼著雪花……打開一看，只有一條木頭魚。這只是普通的櫃子嘛！', monster: '我貼了雪花，它還不肯變冰箱，真有個性！' },
      { id: 'desk', label: '書桌', emoji: '🪑', x: 54, y: 46, w: 31, h: 18, card: 2, notebook: true, say: '桌上有墨跡，側邊抽屜露出筆記本的一角，桌腳旁還有一張紙！' },
      { id: 'curtain', label: '布簾', emoji: '🪟', x: 95, y: 30, w: 10, h: 46, card: 1, say: '把布簾掀開一點……後面藏著一張紙！' },
      { id: 'wardrobe', label: '衣櫃', emoji: '🚪', x: 80, y: 37, w: 21, h: 46, card: 3, say: '衣櫃門縫夾著一張紙！' },
      { id: 'seat', label: '萊莫坐的地方', emoji: '📦', x: 50, y: 76, w: 52, h: 36, say: '三個箱子被萊莫的大屁股壓住了……大概是他的座位吧？', monster: '嗯？我坐在什麼上面？……先別管了，快幫我找！' },
      { id: 'rack', label: '窗邊的瓶架', emoji: '🫙', x: 52, y: 28, w: 16, h: 12, say: '窗台上有一個空空的圓形瓶架……原本放什麼呢？先記下來。' }
    ];
    var FLOOR_BOX_X = [37, 50, 63], FLOOR_BOX_OPEN_X = [30, 50, 70];   // 地上三個箱子的中心 x（畫面百分比）：萊莫躺著時併排靠在一起，站起來後分開一點方便點
    var MONSTER_SEAT_PH = false;   // true＝正方形佔位圖（用高度）；false＝C-8 橫圖（用寬度）
    var MONSTER_SEAT = 'images/water/npc/monster_lying_v2.webp';   // C-8 萊莫橫躺在三個箱子上發呆（2026-11-18 家長 Gemini 圖；v2 補去手臂和頭之間被圍住的白底）
    var BOSS_CARDS = [['soiled', '弄髒了', '🟤'], ['wash', '洗一洗', '🫧'], ['dry', '晾乾', '☀️'], ['store', '收好', '📥']];   // 2026-11-17 E-16～E-19 正式圖：images/water/items/card_<id>.webp
    function bossCard(c) { var k = BOSS_CARDS[c]; return '<img class="card-art" src="images/water/items/card_' + k[0] + '.webp" alt="" draggable="false"><small>' + k[1] + '</small>'; }
    var BOSS_BOXES = [['star', '星星箱', '⭐', '箱子裡有扳手和起子，叮叮噹噹的。', 'wrench'], ['shell', '貝殼箱', '🐚', '箱子摸起來濕濕的，旁邊有一小灘水。', 'puddle'], ['moon', '月亮箱', '🌙', '箱子乾乾的，裡面也沒有工具。', '']];   // 第 5 欄：點開後出現的證據圖（E-24 扳手、E-26 水窪）
    async function waterBoss(child) {
      var M = WHO.monster(), me = WHO.me(child), stage = wstate(child).water.bossStage || 0;
      if (!stage) await talkSeq([line(M, '不見了！我的寶貝不見了！到底放到哪去了？'), line(me, '你在找什麼？是寶物嗎？我幫你一起找吧？'), line(M, '太好了！我一直找不到我的寶……咦……我剛才要找什麼？是寶物嗎？'), line(M, '好像在床底下……不對！在冰箱裡！')]);
      var P = partyPanel({ title: '萊莫的家', sub: '' }, null, 'water-panel boss-panel');
      // 2026-11-18 家長：三個箱子一開始就在地上，萊莫半躺在箱子上發呆（站起來之後才在房間裡直接選箱子）
      P.art.innerHTML = (WATER_ART.room ? '<img class="party-bg" src="' + WATER_ART.room + '" alt="" draggable="false">' : '<div class="room-ph"></div>') +
        '<div class="boss-floor" id="boss-floor">' + BOSS_BOXES.map(function (b, i) {
          return '<button type="button" class="floor-box" data-b="' + i + '" aria-label="' + b[1] + '" style="left:' + FLOOR_BOX_X[i] + '%" disabled><img src="images/water/items/box_' + b[0] + '.webp" alt="" class="box-art" draggable="false">' +
            (b[4] ? '<img src="images/water/items/' + b[4] + '.webp" alt="" class="box-ev ev-' + b[4] + '" draggable="false" hidden>' : '') + '<i class="boss-check" aria-hidden="true" hidden>✓</i></button>';
        }).join('') + '<img class="monster-seat' + (MONSTER_SEAT_PH ? ' ph' : '') + '" id="monster-seat" src="' + MONSTER_SEAT + '" alt="" draggable="false"></div>' +
        '<div class="boss-layer" id="boss-layer"></div>';
      var layer = P.art.querySelector('#boss-layer');
      function say(w, t) { return talkSeq([line(w, t)]); }
      function okBtn(label) { return new Promise(function (r) { P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="scene-ok">' + label + '</button>'; P.tools.querySelector('#scene-ok').onclick = function () { r(); }; }); }
      // 階段一：搜索
      if (stage < 1) {
        P.title.textContent = '🔍 找找看！'; P.sub.textContent = '點房間裡的東西，找出筆記本和 4 張紙卡';
        layer.innerHTML = BOSS_SPOTS.map(function (s) { return '<button type="button" class="boss-spot boss-hit" data-spot="' + s.id + '" aria-label="' + s.label + '" style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%"></button>'; }).join('');
        await new Promise(function (resolve) {
          var cards = 0, notebook = false;
          function prog() {
            P.tools.innerHTML = '<div class="boss-bar"><span class="party-count">📒 ' + (notebook ? 1 : 0) + ' / 1　📄 ' + cards + ' / 4</span><button type="button" class="btn small" id="boss-hint">💡 提示</button></div>';
            P.tools.querySelector('#boss-hint').onclick = function () {   // 提醒還沒找過的地方（有紙卡、筆記本的優先）
              var left = BOSS_SPOTS.filter(function (x) { return x.id !== 'seat' && !layer.querySelector('.boss-spot[data-spot="' + x.id + '"].seen'); });
              left.sort(function (a, b) { return (b.card != null || b.notebook ? 1 : 0) - (a.card != null || a.notebook ? 1 : 0); });
              if (!left.length) return;
              var t = layer.querySelector('.boss-spot[data-spot="' + left[0].id + '"]');
              layer.querySelectorAll('.boss-spot.hint').forEach(function (x) { x.classList.remove('hint'); });
              void t.offsetWidth; t.classList.add('hint'); setTimeout(function () { t.classList.remove('hint'); }, 2600);
              P.sub.textContent = '💡 ' + left[0].label + '那邊好像還沒找過！';
            };
          }
          prog();
          layer.addEventListener('click', async function (e) {
            var b = e.target.closest('.boss-spot'); if (!b || b.classList.contains('seen')) return;
            var s = BOSS_SPOTS.filter(function (x) { return x.id === b.getAttribute('data-spot'); })[0];
            b.classList.add('seen'); b.innerHTML = '<i class="boss-check" aria-hidden="true">✓</i>';   // 找過的家具打小勾勾
            await say(me, s.say);
            if (s.monster) await say(M, s.monster);
            if (s.card != null) {   // 2026-11-18 家長：找到紙片時跳出那張紙片的圖，孩子才知道是後面排順序用的
              cards++; prog();
              var cardEl = document.createElement('div'); cardEl.className = 'boss-card-pop';
              cardEl.innerHTML = '<img src="images/water/items/card_' + BOSS_CARDS[s.card][0] + '.webp" alt="" draggable="false"><b>' + BOSS_CARDS[s.card][1] + '</b>';
              layer.appendChild(cardEl);
              await say(me, '找到一張紙片（第 ' + cards + ' 張）！上面畫著「' + BOSS_CARDS[s.card][1] + '」。');
              cardEl.remove();
            }
            if (s.notebook) {
              notebook = true;
              var book = document.createElement('div'); book.className = 'boss-book';   // E-15 翻開的筆記本：頁面上的字由 App 寫
              // E-14 先闔上看封面，再換 E-15 翻開
              book.className = 'boss-book closed';
              book.innerHTML = '<img src="images/water/items/notebook_closed.webp" alt="" draggable="false"><p class="bb-cover">萊莫的<br>重要事情！<br>千萬不能<br>忘記！</p>';
              layer.appendChild(book);
              await talkSeq([line(me, '筆記本封面寫著：「萊莫的重要事情！千萬不能忘記！」')]);
              book.className = 'boss-book';
              book.innerHTML = '<img src="images/water/items/notebook_open.webp" alt="" draggable="false"><p class="bb-l">重要事情<br>千萬不能<br>忘記！</p><p class="bb-r">記得帶<br>筆記本。</p>';
              await talkSeq([line(me, '第一頁寫著：「記得帶筆記本。」'),
                line(M, '太好了，提醒得真清楚！……筆記本在哪？'), line(me, '就在我手上啊！'), line(M, '喔喔喔！原來在這裡！')]);
              book.remove();
            }
            prog();
            if (cards >= 4 && notebook) setTimeout(resolve, 300);
          });
        });
        wflag(child, 'bossStage', 1); stage = 1;
      }
      // 階段二：把 4 張紙卡排成昨天的順序
      if (stage < 2) {
        P.title.textContent = '🗂️ 昨天發生了什麼事？'; P.sub.textContent = '點一張紙卡，再點空格，排出昨天的順序';
        await talkSeq([line(M, '哎呀，這四頁紙片好像是從筆記本裡掉出來的……原本我好像寫了什麼重要的事。'), line(me, '紙片順序好像亂了，我們一起幫你重新排好，看看到底寫什麼吧！')]);   // 2026-11-18 家長改台詞
        var deck = [0, 1, 2, 3]; do { deck.sort(function () { return Math.random() - .5; }); } while (deck.join() === '0,1,2,3');
        layer.innerHTML = '<div class="order-row">' + [0, 1, 2, 3].map(function (i) { return '<button type="button" class="order-slot" data-o="' + i + '"></button>' + (i < 3 ? '<span class="order-arrow">→</span>' : ''); }).join('') + '</div>';
        P.tools.innerHTML = '<div class="order-deck">' + deck.map(function (c) { return '<button type="button" class="order-card" data-c="' + c + '">' + bossCard(c) + '</button>'; }).join('') + '</div>' +
          '<button type="button" class="btn primary" id="order-check" disabled>看看順不順</button>';
        await new Promise(function (resolve) {
          var pick = null, put = [null, null, null, null];
          function sync() { P.tools.querySelector('#order-check').disabled = put.some(function (x) { return x == null; }); }
          P.tools.addEventListener('click', function (e) {
            var c = e.target.closest('.order-card');
            if (c && !c.classList.contains('used')) { pick = Number(c.getAttribute('data-c')); P.tools.querySelectorAll('.order-card').forEach(function (x) { x.classList.toggle('on', x === c); }); return; }
            if (e.target.closest('#order-check')) {
              // 2026-11-17 家長：台詞要和排錯的地方有關 → 找第一個放錯的位置 i，看那裡放了哪張卡 c（c 一定排在比 i 後面）
              var bad = -1; for (var i = 0; i < 4; i++) if (put[i] !== i) { bad = i; break; }
              if (bad < 0) { resolve(); return; }
              var WRONG = {
                '0-1': ['還沒弄髒就先洗？乾乾淨淨的幹嘛洗呀？', '第一張應該是「弄髒了」，髒了才要洗喔！'],
                '0-2': ['還沒弄髒、也沒洗，要晾什麼呢？', '第一張應該是「弄髒了」！'],
                '0-3': ['一開始就收好了？那後來怎麼會弄髒？', '第一張應該是「弄髒了」，收好是最後一步喔！'],
                '1-2': ['髒髒的就直接晾乾？泥巴還黏在上面耶！', '弄髒之後，要先洗一洗才晾乾喔！'],
                '1-3': ['髒髒的就收起來？箱子會變得臭臭的！', '弄髒之後，要先洗一洗喔！'],
                '2-3': ['剛洗完濕答答就收好？那箱子不就會下雨？', '洗完要先晾乾，才能收起來喔！']
              }[bad + '-' + put[bad]];
              say(M, WRONG[0]); toast('🤔 ' + WRONG[1], 'neg');
            }
          });
          layer.addEventListener('click', function (e) {
            var s = e.target.closest('.order-slot'); if (!s) return;
            var o = Number(s.getAttribute('data-o'));
            if (put[o] != null) {   // 點已放的格子：拿回來
              P.tools.querySelector('.order-card[data-c="' + put[o] + '"]').classList.remove('used'); put[o] = null; s.innerHTML = ''; sync(); return;
            }
            if (pick == null) return;
            put[o] = pick; s.innerHTML = bossCard(pick);
            var c = P.tools.querySelector('.order-card[data-c="' + pick + '"]'); c.classList.add('used'); c.classList.remove('on'); pick = null; sync();
          });
        });
        await talkSeq([line(M, '乾乾的才收好！這次我寫得比記得還清楚。'), line(me, '最後一張紙卡畫著太陽，還有一個被劃掉的扳手……'), line(M, '對！不能跟扳手一起睡，叮叮噹噹會吵醒寶貝！')]);
        toast('📌 得到線索：「要乾乾的」「不跟工具放一起」', 'pos');
        wflag(child, 'bossStage', 2); stage = 2;
      }
      // 階段三：牛奶瓶真相 → 選對收納箱
      await talkSeq([line(me, '（看看手中的牛奶瓶）這個瓶架……怎麼好像……')]);   // 2026-11-18 家長：先對話再放牛奶瓶
      P.title.textContent = '🍼 這個瓶架……'; P.sub.textContent = '把路上撿到的牛奶瓶放到窗邊的瓶架上';
      // 2026-11-18 家長：要拖曳牛奶瓶到瓶架上（也可以先點牛奶瓶再點瓶架）；拖到別的地方會彈回來
      P.sub.textContent = '把下面的牛奶瓶拖到窗邊的瓶架上';
      layer.innerHTML = '<button type="button" class="boss-spot boss-hit rack-spot target" id="rack-spot" aria-label="窗邊的瓶架" style="left:52%;top:28%;width:16%;height:12%"><span></span></button>' +
        '<i class="rack-arrow" id="rack-arrow" aria-hidden="true" style="left:52%;top:28%">⬇</i>';   // 醒目提示：瓶架發亮＋箭頭閃爍
      P.tools.innerHTML = '<div class="bottle-tray"><button type="button" class="bottle-drag" id="use-bottle" aria-label="牛奶瓶"><img src="' + WATER_ART.bottle + '" alt="" draggable="false"></button><small>按住牛奶瓶，拖到瓶架上</small></div>';
      await new Promise(function (r) {
        var rk = layer.querySelector('#rack-spot'), bt = P.tools.querySelector('#use-bottle'), picked = false, drag = null, done = false;
        function onRack(x, y) { var R = rk.getBoundingClientRect(), m = 14; return x >= R.left - m && x <= R.right + m && y >= R.top - m && y <= R.bottom + m; }
        function put() {
          if (done) return; done = true;
          rk.classList.remove('target'); var ar = layer.querySelector('#rack-arrow'); if (ar) ar.remove();
          rk.classList.add('match'); rk.querySelector('span').innerHTML = '<img src="' + WATER_ART.bottle + '" alt="" class="rack-bottle" draggable="false">';
          P.tools.querySelector('.bottle-tray').style.visibility = 'hidden'; P.sub.textContent = '剛好放得進去！';
          setTimeout(r, A.reduceMotion ? 50 : 700);
        }
        bt.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, el: null, id: e.pointerId }; try { bt.setPointerCapture(e.pointerId); } catch (err) { /* 不支援也能點 */ } });
        bt.addEventListener('pointermove', function (e) {
          if (!drag || e.pointerId !== drag.id) return;
          if (!drag.el) {
            if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
            drag.el = document.createElement('img'); drag.el.src = WATER_ART.bottle; drag.el.className = 'bottle-ghost'; document.body.appendChild(drag.el); bt.classList.add('lifting');
          }
          e.preventDefault(); drag.el.style.left = e.clientX + 'px'; drag.el.style.top = e.clientY + 'px';
          rk.classList.toggle('over', onRack(e.clientX, e.clientY));
        });
        function end(e) {
          if (!drag || e.pointerId !== drag.id) return;
          var d = drag; drag = null; rk.classList.remove('over');
          if (!d.el) { picked = true; bt.classList.add('on'); P.sub.textContent = '現在點一下窗邊的瓶架'; return; }   // 沒拖動：當作點選
          d.el.remove(); bt.classList.remove('lifting');
          if (e.type === 'pointerup' && onRack(e.clientX, e.clientY)) put();
          else { bt.classList.remove('bounce'); void bt.offsetWidth; bt.classList.add('bounce'); }   // 沒放到瓶架：彈回來
        }
        bt.addEventListener('pointerup', end); bt.addEventListener('pointercancel', end);
        rk.addEventListener('click', function () { if (picked) put(); else { rk.classList.remove('hint'); void rk.offsetWidth; rk.classList.add('hint'); P.sub.textContent = '先拿起下面的牛奶瓶喔！'; } });
      });
      await talkSeq([line(me, '牛奶瓶的瓶底，跟瓶架的圓圈剛好一樣大！'), line(WHO.monster('surprised'), '啊啊啊！這不是我的牛奶瓶嗎？！'),
        line(WHO.monster('surprised'), '我怕忘記重要的事情，就把紙條塞進瓶子裡……'), line(WHO.monster('surprised'), '結果我忘記把瓶子放在哪裡！'),
        line(me, '所以我們找到的不是藏寶圖，是你的備忘紙！'), line(M, '對！我還畫了回家的路，怕連家也忘記！'), line(M, '等等，你說什麼……寶圖？給我看一下……')]);
      // 2026-11-18 家長：放大顯示藏寶圖（第 8 格拼好的那張，含「最重要的寶……」），萊莫認出三個大框框就是三個箱子
      var mp = await memoPrepare(WATER_ART.memo || memoPlaceholder(), 5, 4), mapEl = document.createElement('div');
      mapEl.className = 'boss-map'; mapEl.innerHTML = '<img src="' + mp.src + '" alt="藏寶圖" draggable="false">';
      layer.appendChild(mapEl);
      await talkSeq([line(M, '對，這是我畫的……喔！這三個大框框好像是那三個箱子！', { img: '' })]);   // 不顯示大頭像，免得擋住地圖上的三個框框
      mapEl.remove();
      await talkSeq([line(M, '對了，我好像晾乾之後，就把寶貝放在地上的箱子裡了！')]);
      // 2026-11-18 家長：說「可是放在哪裡呢？」之前，背景的萊莫就換成站著（淡出→站在房間裡跳一下）
      layer.innerHTML = '';
      var seatImg = P.art.querySelector('#monster-seat');
      if (seatImg) {
        seatImg.classList.add('fade'); await sleep(A.reduceMotion ? 50 : 400); seatImg.remove();
        P.art.querySelector('#boss-floor').insertAdjacentHTML('beforeend', '<img class="monster-stand jump" id="monster-stand" src="' + WATER_NPC.monster + '" alt="" draggable="false">');
        await sleep(A.reduceMotion ? 50 : 500);
      }
      await talkSeq([line(M, '（萊莫跳起來）可是放在哪裡呢？')]);
      var floor = P.art.querySelector('#boss-floor'); floor.classList.add('ready');
      floor.querySelectorAll('.floor-box').forEach(function (x, i) { x.disabled = false; x.style.left = FLOOR_BOX_OPEN_X[i] + '%'; });   // 箱子稍微分開
      await sleep(A.reduceMotion ? 0 : 450);
      P.title.textContent = '📦 寶貝在哪個箱子裡？'; P.sub.textContent = '點一個箱子看看，再按「打開」（要乾乾的、不跟工具放一起）';
      P.tools.innerHTML = '<span class="party-count" id="box-tip">先點一個箱子</span>';   // 2026-11-18 家長：不用三個都看過，點了就能打開
      await new Promise(function (resolve) {
        var seen = {}, chosen = null;
        floor.addEventListener('click', function (e) {
          var b = e.target.closest('.floor-box'); if (!b || b.disabled) return;
          var i = Number(b.getAttribute('data-b'));
          if (!seen[i]) { seen[i] = true; b.classList.add('seen'); b.querySelector('.boss-check').hidden = false; var ev = b.querySelector('.box-ev'); if (ev) ev.hidden = false; }
          floor.querySelectorAll('.floor-box').forEach(function (x) { x.classList.toggle('on', x === b); }); chosen = i;
          P.sub.textContent = BOSS_BOXES[i][2] + ' ' + BOSS_BOXES[i][1] + '：' + BOSS_BOXES[i][3];
          P.tools.innerHTML = '<button type="button" class="btn primary charge-btn" id="box-open">打開' + BOSS_BOXES[chosen][1] + '</button>';
          P.tools.querySelector('#box-open').onclick = function () {
            if (BOSS_BOXES[chosen][0] === 'moon') { resolve(); return; }
            // 開錯：萊莫用對話框說（原本的提示條被視窗擋住看不到）
            say(M, chosen === 0 ? '不對不對！星星箱裡有扳手，會叮叮噹噹吵醒寶貝！' : '不對不對！貝殼箱濕濕的，寶貝要放在乾乾的地方！');
          };
        });
      });
      var moonBox = floor.querySelector('.floor-box[data-b="2"]'); moonBox.classList.add('open'); moonBox.disabled = true;
      // E-23 打開的箱子＋E-25 小被被從箱子裡冒出來
      moonBox.querySelector('.box-art').src = 'images/water/items/box_open.webp';
      if (WATER_ART.blanket) moonBox.insertAdjacentHTML('beforeend', '<img src="' + WATER_ART.blanket + '" alt="小被被" class="box-blanket" draggable="false">');
      P.title.textContent = '🌙 找到了！'; P.sub.textContent = '月亮箱裡有……'; P.tools.innerHTML = '';
      await new Promise(function (r) { setTimeout(r, A.reduceMotion ? 300 : 1800); });   // 先讓孩子看到小被被從箱子裡冒出來，再關掉視窗
      P.shade.remove();
      await talkSeq([line(WHO.monster('blanket'), '找到啦！小被被，你都沒長高，我怎麼會找不到你！'), line(me, '原來最重要的寶……是小被被！'), line(WHO.monster('blanket'), '它從我小時候就陪著我，有它就安心了。')]);   // 2026-11-18 家長：前兩句互換
      // 通關：⭐3＋第一次 3 個神祕寶箱（之後 10 星）
      var ev = child.preview ? { clear: { first: true, next: '金島' }, text: '\n通關獎勵：🎁 神祕寶箱 ×3（不用鑰匙）（預覽，沒有存檔）' } : store.finishWaterBoss(child.id);
      if (ev.clear.first) {
        await talkSeq([line(me, '下面好像還有東西，那是什麼？'), line(M, '哦？那個東西喔？'),
          line(WHO.monster('blanket'), '太佔空間了啦，小被被都快沒空間放了！你幫我把這個拿走吧！', { choices: [{ label: '🎁 收下神祕禮物', val: true, primary: true }] })]);
      } else await talkSeq([line(WHO.monster('blanket'), '這次換我請你吃星星糖！', { choices: [{ label: '⭐ 收下 ' + GAME.GOLD_CLEAR_STARS + ' 顆能量星星', val: true, primary: true }] })]);
      await talkSeq([line(M, '謝謝你！我一定會記得你的！'), line(M, '……欸？你叫什麼名字？'), line(me, '我是你的冒險朋友！'),
        line(M, '謝謝朋友，我要記下來今天的事。'), line(M, '（拿起筆記本，好像在畫著小被被、一條魚和奇怪的生物）'), line(WHO.beluga(), '既然完成任務了，我送你回到岸上吧！')]);   // 2026-11-18 家長改台詞
      await waterEnding(child, ev);
    }

    // 2026-11-17 F 節正式圖（Codex，810×1080）：開場 F-1～F-3、通關送回岸 F-4、出發去下一座島 F-5（水島圖不放進 SHELL）
    var WATER_TRIP = ['f1_exit', 'f2_out', 'f3_beach', 'f4_return', 'f5_depart'].map(function (n) { return 'images/water/trip/' + n + '.webp'; });
    /** 白鯨送回岸＋「水島冒險完成！」卡片（F-4：騎在小白鯨背上滑向沙灘） */
    // 2026-11-18 家長：水島結尾銜接火島——小白鯨送回珊瑚淺灘 → 沙灘上的破小船和昏倒的火島居民 → 居民說火山冒黑煙 → 漁夫答應載你去火島
    // （不提生氣怪、火箭實驗。火島還沒開放時，漁夫說船要先修好，孩子照舊先回金島）。每次通關都演，第二次以後可以略過。
    // 正式圖到貨後把檔名填進 FIRE_FOLK／WATER_END_ART（白底圖去背）；空白時用表情符號佔位
    var FOLK_THANKS = ['謝謝你救了我！等火島安全了，一定請你來玩！', '謝謝你和漁夫爺爺！我現在好多了。', '火山的黑煙……不知道大家還好嗎？謝謝你願意幫忙！'];
    var FIRE_FOLK = { faint: 'images/water/ending/fire_folk_faint.webp', panic: 'images/water/ending/fire_folk_panic.webp', calm: 'images/water/ending/fire_folk_calm_v2.webp' };   // C-9 火島居民（2026-11-18 家長 Gemini 圖）：昏倒、驚慌、平靜
    var WATER_END_ART = { boat: 'images/water/ending/wreck_boat.webp', toFire: '' };          // E-32 破舊小船（白底去背）、F-6 漁夫划船前往冒黑煙的火山島（直式 3:4）
    function fireFolkArt(k) {
      return FIRE_FOLK[k] ? '<img src="' + FIRE_FOLK[k] + '" alt="" draggable="false">' : '<span class="folk-ph" aria-hidden="true">' + ({ faint: '😵', panic: '😨', calm: '🙂' })[k] + '</span>';
    }
    function waterEnding(child, ev) {
      return new Promise(function (resolve) {
        var fireOpen = ev.clear.next === '火島', repeat = (ev.clear.count || 1) > 1;
        var el = document.createElement('div');
        el.className = 'flight water-trip' + (A.reduceMotion ? ' still' : ''); el.id = 'water-ending'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '水島冒險完成');
        el.innerHTML = '<div class="wt-photo" style="background-image:url(' + WATER_TRIP[3] + ')"></div>' + (repeat ? '<button type="button" class="we-skip" data-trip-skip>略過 ›</button>' : '');
        document.body.appendChild(el); document.body.classList.add('pawn-acting');
        var skipped = false, sk = el.querySelector('[data-trip-skip]');
        if (sk) sk.onclick = function () {   // 略過：把正在顯示的對話一路點完
          skipped = true; sk.remove();
          for (var n = 0; n < 30 && document.querySelector('#water-talk [data-talk]'); n++) { var bs = document.querySelectorAll('#water-talk [data-talk]'); bs[bs.length - 1].click(); }
        };
        function talk(lines) { return skipped ? Promise.resolve() : talkSeq(lines); }
        var me = WHO.me(child), F = WHO.fisher(), folk = function () { return { who: '火島居民', img: '' }; };   // 居民已經在畫面上，不另外顯示大頭像
        var met = !!wstate(child).water.folkMet;   // 2026-11-18 家長：看過居民那段、又沒重置任務 → 改成漁夫問要不要搭船去火島
        (async function () {
          if (!skipped) await sleep(A.reduceMotion ? 300 : 1600);   // 小白鯨送回岸邊（F-4）
          if (met) {
            if (sk && sk.parentNode) sk.remove();
            el.insertAdjacentHTML('beforeend', '<div class="wo-beach" style="background-image:url(' + WATER_TRIP[2] + ')"></div>');
            await talkSeq(fireOpen ? [line(F, '要不要搭我的船去火島看看？', { choices: [{ label: '🛶 好！', val: true, primary: true }] })]
              : [line(F, '我的船還在修，修好就載你去火島！')]);   // 火島開放前不問
            showCard(); return;
          }
          // 珊瑚淺灘（F-3）：破小船＋昏倒的居民
          el.insertAdjacentHTML('beforeend', '<div class="wo-beach" style="background-image:url(' + WATER_TRIP[2] + ')"></div>' +
            '<div class="wend-shore"><span class="wend-boat">' + (WATER_END_ART.boat ? '<img src="' + WATER_END_ART.boat + '" alt="" draggable="false">' : '<span class="folk-ph" aria-hidden="true">🛶</span>') + '</span>' +
            '<span class="wend-folk faint" id="wend-folk">' + fireFolkArt('faint') + '</span></div>');
          if (sk && sk.parentNode) el.appendChild(sk);
          var fk = el.querySelector('#wend-folk');
          function pose(k) { fk.className = 'wend-folk ' + k; fk.innerHTML = fireFolkArt(k); }
          await talk([line(me, '咦？沙灘上有一艘破破的小船……旁邊有人倒在地上！'), line(me, '漁夫爺爺！快來幫忙！'), line(F, '喂！你還好嗎？醒醒啊！')]);
          pose('panic');
          await talk([line(folk('panic'), '我是從火島來的……'), line(folk('panic'), '最近火山口一直冒黑煙，還常常傳來轟隆隆的巨響！')]);
          pose('calm');
          await talk([line(folk('calm'), '大家都很害怕，我只好划船逃出來……'), line(F, '火島？我知道那個地方！不過最近那裡好像不太平靜。'),
            line(me, '我想去火島看看發生了什麼事！'), line(F, '好吧！我划船載你過去！')].concat(fireOpen ? [] : [line(F, '不過我的船得先修一修，修好就來接你！')]));
          wflag(child, 'folkMet', true);
          if (sk && sk.parentNode) sk.remove();
          showCard();
        })();
        function showCard() {
          el.insertAdjacentHTML('beforeend', islandCard({ testid: 'water-end-card', badge: A.BADGE_IMG.waterClear1, title: '水島冒險完成！', quote: '「火山口冒出黑煙……<br>火島到底發生了什麼事？」',
            first: ev.clear.first, chest: 3, chestName: '神祕寶箱', ach: '水島通關', soon: false,
            next: fireOpen ? '下次出發，漁夫爺爺會划船載你去「火島」！' : '漁夫爺爺修好船就載你去火島！在那之前，下次出發先回「' + h(ev.clear.next || '金島') + '」。', ok: 'data-we-ok' }));
          el.querySelector('[data-we-ok]').onclick = function () { el.remove(); document.body.classList.remove('pawn-acting'); render(); if (!child.preview) announceAchievements(child.id); resolve(); };
        }
      });
    }
    /** 木島 → 水島開場：木島滑梯最後一張 → F-1 出口亮起 → F-2 衝出樹洞 → F-3 落在沙灘＋歡迎卡片（第二次以後可略過） */
    function waterOpening(child, travel, repeat) {
      return new Promise(function (resolve) {
        var fast = window.__cgpFastEnding ? 0.08 : 1;
        var el = document.createElement('div');
        el.className = 'wood-end water-open' + (A.reduceMotion ? ' still' : ''); el.id = 'water-open'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '來到水島');
        var shots = [A.WOOD_SLIDES[4], WATER_TRIP[0], WATER_TRIP[1]], says = ['咦？前面好亮！', '是出口！', '咻——！'];
        el.innerHTML = '<div class="we-slide">' + shots.map(function (u, i) { return '<i class="we-frame we-f' + (i + 1) + (i ? '' : ' on') + '" style="background-image:url(' + u + ')"></i>'; }).join('') + '</div>' +
          '<p class="fl-msg" role="status">' + says[0] + '</p>' + (repeat ? '<button type="button" class="we-skip" data-trip-skip>略過 ›</button>' : '');
        document.body.appendChild(el); document.body.classList.add('pawn-acting');
        var trip = tripSkipper(el), frames = el.querySelectorAll('.we-frame');
        (async function () {
          await Promise.race([preloadImages(WATER_TRIP.slice(0, 3), 2500), sleep(2500)]);
          await trip.wait((A.reduceMotion ? 700 : 1400) * fast);
          for (var i = 1; i < frames.length; i++) {   // 一張接一張往前衝
            frames[i - 1].classList.remove('on'); frames[i - 1].classList.add('out'); frames[i].classList.add('on');
            var msg0 = el.querySelector('.fl-msg'); if (msg0) msg0.textContent = says[i];
            await trip.wait((A.reduceMotion ? 600 : 1300) * fast);
          }
          trip.done(); var msg = el.querySelector('.fl-msg'); if (msg) msg.remove();
          el.insertAdjacentHTML('beforeend', '<div class="wo-beach" style="background-image:url(' + WATER_TRIP[2] + ')"></div>' +
            '<div class="we-card trip-card" data-testid="water-open-card"><h2>🌊 歡迎來到水島！</h2><p>第一區：珊瑚淺灘</p><p class="muted small">哇！我們真的來到水島了！</p>' +
            '<button type="button" class="btn primary block" data-trip-ok>開始探索！</button></div>');
          el.querySelector('[data-trip-ok]').onclick = function () { el.remove(); document.body.classList.remove('pawn-acting'); render(); resolve(); };
        })();
      });
    }
    /** 水島 → 下一座島：去火島＝漁夫划船（F-6，到貨前用 F-5）；火島還沒開放＝小白鯨先送回金島（F-5） */
    function waterLeave(child, travel, repeat) {
      return new Promise(function (resolve) {
        var el = document.createElement('div');
        el.className = 'flight water-trip' + (A.reduceMotion ? ' still' : ''); el.id = 'water-leave'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '小白鯨送你出發');
        var toFire = travel.island === 'fire';
        el.innerHTML = '<div class="wt-photo" style="background-image:url(' + (toFire && WATER_END_ART.toFire ? WATER_END_ART.toFire : WATER_TRIP[4]) + ')"></div>' +
          '<div class="fl-card" data-testid="water-leave-card"><h2>' + (toFire ? '🛶 出發去火島！' : '🐳 小白鯨送你出發！') + '</h2><p>' +
          (toFire ? '漁夫爺爺划著小船，載你前往冒著黑煙的火島！' : travel.island === 'gold' ? '漁夫爺爺還在修船，小白鯨先送你回到「金島」繼續冒險！' : '前往「' + h(travel.name) + '」！') + '</p>' +
          '<button type="button" class="btn primary block" data-trip-ok>繼續冒險！</button></div>';
        document.body.appendChild(el);
        el.querySelector('[data-trip-ok]').onclick = function () { el.remove(); render(); resolve(); };
      });
    }
    /** 地圖上的水島裝飾：起點旁的迎接漁夫與魚桶（還沒迎接時） */
    function waterMapDecor(child, board, player, scene) {
      if (!scene || scene.id !== 'water-01') return '';
      var s = board.npcSpots && board.npcSpots['0'];
      if (!s) return '';
      // 2026-11-18 家長：通關過水島後，獲救的火島居民站在起點旁，點了會跟孩子道謝（不給獎勵）
      var folk = ((player.islandClears || {}).water || 0) >= 1 ? '<div class="story-guide water-npc fire-folk-npc" data-tap="folk" style="left:' + (s[0] + 70) + 'px;top:' + s[1] + 'px;width:90px;z-index:' + Math.round(s[1] / 6) + '" role="img" aria-label="火島居民：點我說話">' + waterImg(FIRE_FOLK.calm, '') + '</div>' : '';
      if (player.water.welcomed) return folk;
      return folk + '<div class="story-guide water-npc" style="left:' + s[0] + 'px;top:' + s[1] + 'px;width:90px;z-index:' + Math.round(s[1] / 6) + '" role="img" aria-label="漁夫爺爺">' + waterImg(WATER_NPC.fisherman, '') + '</div>';
    }

    // ---------- 水島小遊戲「珊瑚灣撈魚趣」（2026-11-19 家長定稿；參數在 game.js 的 FISH_GAME） ----------
    // 2026-11-19 正式圖（家長 Gemini 圖，去白底、256×256、都面朝右；水島圖不放進 SHELL，開遊戲時先下載）
    var FISH_ART = { clown: 'images/water/fish/clown.webp', tang: 'images/water/fish/tang.webp', puffer: 'images/water/fish/puffer.webp', pufferBig: 'images/water/fish/puffer_big.webp', jelly: 'images/water/fish/jelly_v3.webp' };
    var FISH_EMOJI = { clown: '🐠', tang: '🐟', puffer: '🐡', pufferBig: '🐡', jelly: '🪼' };
    function fishArt(kind) {
      return FISH_ART[kind] ? '<img src="' + FISH_ART[kind] + '" alt="" draggable="false">' : '<span class="fg-emoji" aria-hidden="true">' + FISH_EMOJI[kind] + '</span>';
    }
    function fgIco(kind) { return FISH_ART[kind] ? '<img class="fg-ico" src="' + FISH_ART[kind] + '" alt="" aria-hidden="true">' : FISH_EMOJI[kind]; }
    /** 啵！（Web Audio 合成，跟著成就音效開關；失敗就安靜） */
    function playPop() {
      if (!soundOn()) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        A.audioCtx = A.audioCtx || new AC(); if (A.audioCtx.state === 'suspended') A.audioCtx.resume();
        var t0 = A.audioCtx.currentTime, o = A.audioCtx.createOscillator(), g = A.audioCtx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(220, t0 + 0.12);
        g.gain.setValueAtTime(0.18, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
        o.connect(g); g.connect(A.audioCtx.destination); o.start(t0); o.stop(t0 + 0.16);
      } catch (e) { /* 音效失敗不影響遊戲 */ }
    }
    /**
     * 撈魚一局（日常與劇情共用）。opts：{ title, sub, story（劇情：顯示累積）, have（劇情已累積數）, practice, laterLabel }
     * @returns Promise<{ caught, used, broken, quit }>（quit＝還沒開始就按「稍後再玩」）
     */
    function fishGame(opts) {
      var C = GAME.FISH_GAME;
      return new Promise(function (resolve) {
        var el = document.createElement('div');
        el.className = 'mg fish-mg'; el.id = 'mg';
        el.innerHTML = '<div class="mg-top fg-top"><span class="mg-count" id="fg-time">⏱️ 00:' + String(C.seconds).padStart(2, '0') + '</span>' +
          '<span class="mg-count" id="fg-caught">🐟 ' + (opts.story ? (opts.have || 0) + ' / ' + C.storyGoal : '0') + '</span>' +
          '<span class="mg-count" id="fg-nets">🫧 ×' + C.nets + '</span></div>' +
          '<div class="mg-field fg-field" id="fg-field"><div class="fg-net" id="fg-net" hidden><i></i><b class="fg-warn">快破了！</b></div></div>' +
          '<div class="mg-tip fg-tip" id="fg-tip"><b>' + fgIco('clown') + ' ' + h(opts.title || '珊瑚灣撈魚趣') + '</b>' + (opts.sub ? '<small>' + h(opts.sub) + '</small>' : '') +
          '<span>按住拖曳泡泡網，放開就能撈魚！</span>' +
          '<span class="fg-rule">' + fgIco('clown') + fgIco('tang') + ' 小丑魚、藍倒吊可以撈</span>' +   // 2026-11-19 家長：說明用遊戲裡同一張圖
          '<span class="fg-rule">' + fgIco('puffer') + ' 河豚會刺破網子一部分</span><span class="fg-rule">' + fgIco('jelly') + ' 水母碰到網子就破！</span>' +
          (opts.practice ? '<small class="mg-practice">🧪 試玩模式：不會得到星星，也不算今天的次數</small>' : '') +
          '<button type="button" class="btn primary" data-fg="start">開始撈魚</button>' +
          '<button type="button" class="btn link mg-later" data-fg="later">' + (opts.laterLabel || '稍後再玩') + '</button></div>';
        document.body.appendChild(el); document.body.classList.add('mg-open');
        preloadImages(Object.keys(FISH_ART).map(function (k) { return FISH_ART[k]; }).filter(Boolean), 4000);   // 看說明時先下載魚的圖
        var field = el.querySelector('#fg-field'), netEl = el.querySelector('#fg-net'), still = A.reduceMotion;
        var W = 0, H = 0, R = 40, raf = 0, last = 0, timeLeft = C.seconds, started = false, ended = false;
        var netsLeft = C.nets, caught = 0, used = 0, broken = 0, mobs = [], net = null;
        function size() { W = field.clientWidth; H = field.clientHeight; R = Math.max(44, Math.min(W, H) * 0.15); netEl.style.width = netEl.style.height = R * 2 + 'px'; }
        function spawn(kind) {
          var m = { kind: kind, el: document.createElement('div'), s: Math.max(44, W * (kind === 'jelly' ? 0.13 : kind === 'puffer' ? 0.15 : 0.13)) };
          var fromLeft = Math.random() < 0.5;
          var sp0 = openSpot(); m.x = sp0[0]; m.y = sp0[1];   // 2026-11-19 家長：新魚在畫面中間隨機浮出來（不從兩側），也不出現在網子旁
          if (mobs.length >= C.fish + C.puffers + C.jellies) m.el.classList.add('fg-in');
          var speed = (kind === 'tang' ? 70 : kind === 'jelly' ? 18 : 38) * (W / 390);
          m.sp = speed * (0.7 + Math.random() * 0.6); m.phase = Math.random() * 6;
          var ang = (Math.random() - 0.5) * 1.2;   // 2026-11-19 家長：上下左右隨機游（進場時大致朝畫面裡面）
          m.vx = (fromLeft ? 1 : -1) * Math.cos(ang) * m.sp; m.vy = Math.sin(ang) * m.sp;
          m.el.className = 'fg-mob fg-' + kind; m.el.innerHTML = fishArt(kind); m.el.style.width = m.el.style.height = m.s + 'px'; m.el.style.setProperty('--s', m.s + 'px');
          field.appendChild(m.el); mobs.push(m); return m;
        }
        /** 畫面中隨機一個位置，避開正在用的網子 */
        function openSpot() {
          var x, y, k = 0;
          do { x = W * (0.1 + Math.random() * 0.8); y = H * (0.12 + Math.random() * 0.76); k++; }
          while (net && Math.hypot(x - net.x, y - net.y) < R * 1.8 && k < 20);
          return [x, y];
        }
        function fishKind() { return Math.random() < 0.55 ? 'clown' : 'tang'; }
        function hud() {
          el.querySelector('#fg-caught').textContent = '🐟 ' + (opts.story ? Math.min(C.storyGoal, (opts.have || 0) + caught) + ' / ' + C.storyGoal : caught);
          el.querySelector('#fg-nets').textContent = '🫧 ×' + netsLeft;
          var t = Math.ceil(timeLeft); el.querySelector('#fg-time').textContent = '⏱️ 00:' + String(Math.max(0, t)).padStart(2, '0');
        }
        function point(e) { var r = field.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top - (e.pointerType === 'mouse' ? 0 : 36) }; }   // 觸控：網子在手指上方一點
        function drawNet() {
          if (!net) { netEl.hidden = true; return; }
          netEl.hidden = false; netEl.style.transform = 'translate(' + (net.x - R) + 'px,' + (net.y - R) + 'px)';
          var f = Math.max(0, net.dur) / C.durability;
          netEl.style.setProperty('--dur', f); netEl.style.setProperty('--hue', Math.round(f * 120));   // 綠 120 → 黃 60 → 紅 0
          netEl.classList.toggle('weak', net.dur < C.warnAt);
        }
        function inNet(m) { return net && Math.hypot(m.x - net.x, m.y - net.y) <= R; }
        function burst() {   // 網子破了：啵！網內的魚繼續游
          var b = document.createElement('i'); b.className = 'fg-pop'; b.style.left = net.x + 'px'; b.style.top = net.y + 'px'; field.appendChild(b); setTimeout(function () { b.remove(); }, 450);
          mobs.forEach(function (m) {   // 2026-11-19 家長：網裡的魚往四面八方快速逃走、游出畫面就消失（罩住時已經補過新魚）
            if (!m.held) return;
            var dx = m.x - net.x, dy = m.y - net.y, d = Math.hypot(dx, dy) || 1, a = d < 4 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx), sp = Math.max(W, H) * 0.9;
            m.held = false; m.flee = true; m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp; m.el.classList.remove('fg-held'); m.el.classList.add('fg-flee');
          });
          playPop(); broken++; used++; net = null; drawNet(); afterNet();
        }
        function release() {
          if (!net) return;
          var got = mobs.filter(function (m) { return (m.kind === 'clown' || m.kind === 'tang') && !m.caught && (m.held || inNet(m)); });
          got.forEach(function (m) {
            var refill = !m.held; m.held = false; m.caught = true; caught++; m.el.classList.add('fg-got');
            (function (mm) { setTimeout(function () { mm.el.remove(); mobs.splice(mobs.indexOf(mm), 1); if (!ended && refill) spawn(fishKind()); }, 400); })(m);
          });
          if (got.length) { var t = document.createElement('b'); t.className = 'fg-plus'; t.textContent = '+' + got.length; t.style.left = net.x + 'px'; t.style.top = net.y + 'px'; field.appendChild(t); setTimeout(function () { t.remove(); }, 800); }
          used++; net = null; drawNet(); hud(); afterNet();
        }
        function afterNet() { hud(); if (netsLeft <= 0) setTimeout(finish, 500); }
        function loop(ts) {
          if (ended) return;
          var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
          timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; hud(); if (net) release(); finish(); return; }
          mobs.forEach(function (m) {
            if (m.caught) return;
            if (m.flee) {   // 逃走的魚：直直衝出畫面後消失
              m.x += m.vx * dt; m.y += m.vy * dt;
              m.el.style.transform = 'translate(' + (m.x - m.s / 2) + 'px,' + (m.y - m.s / 2) + 'px) scaleX(' + (m.vx < 0 ? -1 : 1) + ')';
              if (m.x < -m.s || m.x > W + m.s || m.y < -m.s || m.y > H + m.s) { m.caught = true; m.el.remove(); setTimeout(function () { var i = mobs.indexOf(m); if (i >= 0) mobs.splice(i, 1); }, 0); }
              return;
            }
            if (m.held) {   // 2026-11-19 家長：被網子罩住的魚跟著網子走，在網裡輕輕擺動
              m.phase += dt * 6;
              m.x = net.x + m.ox + Math.sin(m.phase) * 3; m.y = net.y + m.oy + Math.cos(m.phase * 0.7) * 2;
              m.el.style.transform = 'translate(' + (m.x - m.s / 2) + 'px,' + (m.y - m.s / 2) + 'px) scaleX(' + (m.vx < 0 ? -1 : 1) + ')';
              return;
            }
            if (net && (m.kind === 'clown' || m.kind === 'tang') && Math.hypot(m.x - net.x, m.y - net.y) <= R * 0.8) {   // 進網：之後跟著網子
              var ox = m.x - net.x, oy = m.y - net.y, d = Math.hypot(ox, oy), lim = R * 0.55;
              if (d > lim) { ox *= lim / d; oy *= lim / d; }
              m.held = true; m.ox = ox; m.oy = oy; m.el.classList.add('fg-held');
              if (!ended) spawn(fishKind());   // 2026-11-19 家長：一罩住就馬上補一條新魚
              return;
            }
            if (Math.random() < (m.kind === 'tang' ? 0.9 : m.kind === 'jelly' ? 0.3 : 0.5) * dt) {   // 偶爾換一個隨機方向（上下左右都可能）
              var a2 = Math.random() * Math.PI * 2; m.vx = Math.cos(a2) * m.sp; m.vy = Math.sin(a2) * m.sp * (m.kind === 'jelly' ? 1 : 0.8);
            }
            m.phase += dt * (m.kind === 'jelly' ? 1.6 : 3);
            m.x += m.vx * dt; m.y += m.vy * dt + Math.sin(m.phase) * (m.kind === 'jelly' ? 14 : 5) * dt;
            if (m.y < H * 0.1) { m.y = H * 0.1; m.vy = Math.abs(m.vy); }      // 碰到上下邊緣彈回來
            if (m.y > H * 0.92) { m.y = H * 0.92; m.vy = -Math.abs(m.vy); }
            if ((m.x < -m.s * 1.2 || m.x > W + m.s * 1.2) && (m.kind === 'clown' || m.kind === 'tang') && mobs.filter(function (q) { return (q.kind === 'clown' || q.kind === 'tang') && !q.caught && !q.held && !q.gone; }).length > C.fish) { m.gone = true; m.caught = true; m.el.remove(); setTimeout(function () { var i = mobs.indexOf(m); if (i >= 0) mobs.splice(i, 1); }, 0); return; }
            if (m.x < -m.s * 1.2 || m.x > W + m.s * 1.2) {   // 游出去：在畫面中間隨機浮出來（不從兩側進來）
              var sp1 = openSpot(); m.x = sp1[0]; m.y = sp1[1]; m.vx = -m.vx; m.el.classList.remove('fg-in'); void m.el.offsetWidth; m.el.classList.add('fg-in');
            }
            m.el.style.transform = 'translate(' + (m.x - m.s / 2) + 'px,' + (m.y - m.s / 2) + 'px) scaleX(' + (m.vx < 0 ? -1 : 1) + ')';
          });
          if (net) {
            net.t += dt; if (net.t > C.grace) net.dur -= C.drainPerSec * dt;
            var touch = mobs.filter(function (m) { return !m.caught && Math.hypot(m.x - net.x, m.y - net.y) <= R + m.s * 0.3; });
            if (touch.some(function (m) { return m.kind === 'jelly'; })) { burst(); }   // 水母優先：立刻破
            else {
              touch.forEach(function (m) {
                if (m.kind === 'puffer' && m.hitNet !== net) { m.hitNet = net;   // 同一網只扣一次（記在河豚身上，魚被撈走後陣列位置會變）
                  net.dur -= C.puffer; m.el.classList.add('fg-puff'); m.el.innerHTML = fishArt('pufferBig'); (function (mm) { setTimeout(function () { mm.el.classList.remove('fg-puff'); mm.el.innerHTML = fishArt('puffer'); }, 1200); })(m); }
              });
              if (net && net.dur <= 0) burst(); else drawNet();
            }
          }
          raf = requestAnimationFrame(loop);
        }
        field.addEventListener('pointerdown', function (e) {
          if (!started || ended || net || netsLeft <= 0) return;
          e.preventDefault(); try { field.setPointerCapture(e.pointerId); } catch (err) { /* 不支援也能玩 */ }
          var p = point(e); netsLeft--; net = { x: p.x, y: p.y, dur: C.durability, t: 0, puffed: {}, id: e.pointerId }; drawNet(); hud();
        });
        field.addEventListener('pointermove', function (e) { if (!net || e.pointerId !== net.id) return; e.preventDefault(); var p = point(e); net.x = Math.max(0, Math.min(W, p.x)); net.y = Math.max(0, Math.min(H, p.y)); drawNet(); });
        field.addEventListener('pointerup', function (e) { if (net && e.pointerId === net.id) release(); });
        field.addEventListener('pointercancel', function (e) { if (net && e.pointerId === net.id) release(); });
        function cleanup() { ended = true; cancelAnimationFrame(raf); window.removeEventListener('resize', size); el.remove(); document.body.classList.remove('mg-open'); }
        function finish() {
          if (ended) return;
          ended = true; cancelAnimationFrame(raf); net = null; drawNet();
          var gain = GAME.fishStars(caught);
          var res = document.createElement('div'); res.className = 'mg-result fg-result';
          res.innerHTML = '<b>🐠 撈魚成果！</b>' +
            '<p>捕獲 <strong>' + caught + '</strong> 條魚</p><p class="fg-stat">成功下網 ' + (used - broken) + ' 次・破掉 ' + broken + ' 個網子</p>' +
            (opts.story ? '<p class="fg-stat">小白鯨的魚：' + Math.min(C.storyGoal, (opts.have || 0) + caught) + ' / ' + C.storyGoal + ' 條</p>'
              : '<p class="mg-gain">' + new Array(gain + 1).join(STAR_IMG) + '</p><p class="fg-stat">' + (opts.practice ? '🧪 試玩：' + gain + ' 顆能量星星（不會真的得到）' : '得到 ' + gain + ' 顆能量星星') + '</p>') +
            '<button type="button" class="btn primary" data-fg="done">' + (opts.story ? '好！' : opts.practice ? '離開' : '收下') + '</button>';
          el.appendChild(res);
          res.querySelector('[data-fg=done]').onclick = function () { cleanup(); resolve({ caught: caught, used: used, broken: broken }); };
        }
        el.querySelector('[data-fg=later]').onclick = function () { cleanup(); resolve({ quit: true, caught: 0, used: 0, broken: 0 }); };
        el.querySelector('[data-fg=start]').onclick = function () {
          el.querySelector('#fg-tip').remove(); started = true; last = 0; raf = requestAnimationFrame(loop);
        };
        requestAnimationFrame(function () {
          size(); window.addEventListener('resize', size);
          for (var i = 0; i < C.fish; i++) spawn(fishKind());
          for (i = 0; i < C.puffers; i++) spawn('puffer');
          for (i = 0; i < C.jellies; i++) spawn('jelly');
          mobs.forEach(function (m) { m.el.style.transform = 'translate(' + (m.x - m.s / 2) + 'px,' + (m.y - m.s / 2) + 'px)'; });
          if (still) mobs.forEach(function (m) { m.sp *= 0.6; m.vx *= 0.6; m.vy *= 0.6; });   // 減少動態：游慢一點
          if (window.__cgpFishHook) window.__cgpFishHook({ mobs: mobs, net: function () { return net; }, size: function () { return [W, H, R]; }, field: field });   // 自動測試：可以固定魚的位置
        });
      });
    }
    /** 日常模式：水島小遊戲格（每天次數、獎勵照既有小遊戲規則） */
    function openFishMinigame(childId, subtitle, opts) {
      var practice = !!(opts && opts.practice);
      fishGame({ sub: subtitle, practice: practice }).then(function (r) {
        if (r.quit) { if (!practice) toast('小遊戲留著，等一下再玩'); render(); return; }
        if (practice) { location.replace('#home'); render(); return; }
        try { var m = store.finishMinigame(childId, r.caught); toast('⭐ 撈魚得到 ' + m.stars + ' 顆能量星星！', 'pos'); } catch (err) { toast(err.message, 'neg'); }
        render();
      });
    }

    return {
      belugaAct: belugaAct, WATER_NPC: WATER_NPC, waterPreload: waterPreload, waterDecor: waterDecor,
      waterNotes: waterNotes, waterWelcome: waterWelcome, waterTask: waterTask, callBeluga: callBeluga,
      WATER_TRIP: WATER_TRIP, FOLK_THANKS: FOLK_THANKS, waterEnding: waterEnding, waterOpening: waterOpening,
      waterLeave: waterLeave, openFishMinigame: openFishMinigame
    };
  };
})();
