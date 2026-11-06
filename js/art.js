/*
 * 親子集點 — 插圖（原創向量圖）
 * 集中管理所有 SVG 插圖字串，供 app.js 使用。
 * 每張圖的漸層 id 都加上前綴，避免同頁多張圖互相干擾。
 */
(function (root) {
  'use strict';

  /** 產生齒輪外形路徑（中心 cx,cy、外半徑 r、齒數 n） */
  function gearPath(cx, cy, r, n) {
    var inner = r * 0.78, d = '';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
      var pts = [[inner, a - w * 1.4], [r, a - w], [r, a + w], [inner, a + w * 1.4]];
      pts.forEach(function (p, k) {
        var x = (cx + Math.cos(p[1]) * p[0]).toFixed(1), y = (cy + Math.sin(p[1]) * p[0]).toFixed(1);
        d += (i === 0 && k === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      });
    }
    return d + 'Z';
  }

  function gear(cx, cy, r, n, fill, hole) {
    return '<path d="' + gearPath(cx, cy, r, n) + '" fill="' + fill + '" stroke="#a86b00" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5) + '" fill="none" stroke="#a86b00" stroke-width="1.2" opacity=".6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * hole) + '" fill="#7d4f12"/>';
  }

  // ---------------------------------------------------------------
  // 金島關卡插圖：齒輪、礦洞、礦車、金屬橋、小工廠、發光礦石
  // ---------------------------------------------------------------
  var GOLD_ISLAND = '<svg class="island-art" viewBox="0 0 320 200" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="gi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6cc6f7"/><stop offset=".7" stop-color="#c8ecff"/><stop offset="1" stop-color="#eaf8ff"/></linearGradient>' +
    '<radialGradient id="gi-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff9d6"/><stop offset=".45" stop-color="#ffe68a" stop-opacity=".9"/><stop offset="1" stop-color="#ffe68a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gi-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47c3f0"/><stop offset=".5" stop-color="#2aa3dc"/><stop offset="1" stop-color="#1a7fbf"/></linearGradient>' +
    '<linearGradient id="gi-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7b0"/><stop offset="1" stop-color="#e3be74"/></linearGradient>' +
    '<linearGradient id="gi-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9b59a"/><stop offset=".6" stop-color="#9b8268"/><stop offset="1" stop-color="#76604b"/></linearGradient>' +
    '<linearGradient id="gi-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be36a"/><stop offset="1" stop-color="#46ad3c"/></linearGradient>' +
    '<linearGradient id="gi-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".45" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98c00"/></linearGradient>' +
    '<linearGradient id="gi-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5fa"/><stop offset=".5" stop-color="#b4c2d1"/><stop offset="1" stop-color="#7f8fa1"/></linearGradient>' +
    '<linearGradient id="gi-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4924f"/><stop offset="1" stop-color="#8f5323"/></linearGradient>' +
    '<radialGradient id="gi-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffe680" stop-opacity=".8"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gi-crys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#f0a000"/></linearGradient>' +
    '</defs>' +
    // 天空、太陽、雲
    '<rect width="320" height="200" fill="url(#gi-sky)"/>' +
    '<circle cx="270" cy="34" r="40" fill="url(#gi-sun)"/><circle cx="270" cy="34" r="13" fill="#fff6c2"/>' +
    '<g fill="#fff"><ellipse cx="52" cy="36" rx="28" ry="9"/><ellipse cx="66" cy="29" rx="15" ry="11"/><ellipse cx="44" cy="31" rx="11" ry="8"/></g>' +
    '<g fill="#fff" opacity=".85"><ellipse cx="190" cy="22" rx="20" ry="6"/><ellipse cx="200" cy="18" rx="10" ry="7"/></g>' +
    '<g fill="#dff2fc"><ellipse cx="52" cy="41" rx="24" ry="3"/></g>' +
    // 遠方小島
    '<path d="M8 128 q14 -18 30 -4 q8 -6 14 4 z" fill="#8fcfb8" opacity=".7"/>' +
    '<path d="M268 128 q10 -14 24 -2 q6 -4 12 2 z" fill="#8fcfb8" opacity=".6"/>' +
    // 海
    '<rect y="126" width="320" height="74" fill="url(#gi-sea)"/>' +
    '<g stroke="#c9efff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8">' +
    '<path d="M14 150 q8 -4 16 0 t16 0"/><path d="M262 160 q8 -4 16 0 t16 0"/><path d="M40 182 q8 -4 16 0 t16 0"/><path d="M220 188 q8 -4 16 0"/></g>' +
    '<g fill="#fff"><path d="M70 168 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z"/><path d="M286 142 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z"/></g>' +
    // 沙灘與倒影
    '<ellipse cx="150" cy="152" rx="116" ry="20" fill="#1f8ccb" opacity=".35"/>' +
    '<path d="M36 146 Q60 128 150 126 Q240 128 262 146 Q238 162 150 164 Q62 162 36 146 Z" fill="url(#gi-sand)"/>' +
    '<path d="M50 150 Q80 158 150 159 Q220 158 250 150" stroke="#f9f0d0" stroke-width="2" fill="none" opacity=".9"/>' +
    // 岩山本體
    '<path d="M62 142 C 66 108, 92 78, 128 66 C 150 58, 176 60, 196 72 C 224 88, 238 116, 240 142 Z" fill="url(#gi-rock)"/>' +
    '<path d="M96 142 C 100 120, 112 104, 126 96" stroke="#e0d1bb" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>' +
    '<path d="M200 92 l10 14 -6 2z M170 112 l12 10 -8 2z M110 118 l-8 12 7 0z" fill="#6c5642" opacity=".5"/>' +
    // 草地頂
    '<path d="M98 82 C 112 66, 136 56, 160 56 C 186 56, 206 66, 218 82 C 206 78, 196 82, 186 78 C 174 74, 166 80, 152 76 C 138 72, 126 80, 114 78 C 108 78, 102 80, 98 82 Z" fill="url(#gi-grass)"/>' +
    '<path d="M120 66 C 134 59, 150 57, 166 58" stroke="#c8f59c" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    // 大齒輪（山頂）
    '<g>' + gear(140, 50, 20, 12, 'url(#gi-gold)', 0.18) + '</g>' +
    '<g>' + gear(166, 40, 11, 9, 'url(#gi-gold)', 0.22) + '</g>' +
    // 小工廠＋煙囪
    '<g transform="translate(182 50)">' +
    '<rect x="0" y="12" width="30" height="20" rx="2" fill="#e7d3b5" stroke="#8a6a45" stroke-width="1.5"/>' +
    '<path d="M0 12 l10 -8 0 8 10 -8 0 8 10 -8 0 8z" fill="#c4522f" stroke="#8a3a20" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<rect x="22" y="-10" width="6" height="16" fill="#9aa9b8" stroke="#64748b" stroke-width="1"/>' +
    '<rect x="5" y="18" width="7" height="6" rx="1" fill="#ffe680"/><rect x="17" y="18" width="7" height="6" rx="1" fill="#ffe680"/>' +
    '<g fill="#fff" opacity=".85"><circle cx="26" cy="-15" r="4"/><circle cx="31" cy="-22" r="5"/><circle cx="38" cy="-28" r="6"/></g></g>' +
    // 礦洞入口
    '<path d="M88 142 L88 118 Q88 102 104 102 Q120 102 120 118 L120 142 Z" fill="#3a2a1d"/>' +
    '<path d="M84 142 L84 116 Q84 98 104 98 Q124 98 124 116 L124 142" fill="none" stroke="url(#gi-wood)" stroke-width="6" stroke-linejoin="round"/>' +
    '<rect x="80" y="96" width="48" height="6" rx="2" fill="url(#gi-wood)"/>' +
    '<circle cx="104" cy="114" r="10" fill="url(#gi-glow)"/>' +
    // 軌道與礦車
    '<g stroke="#7f8fa1" stroke-width="2"><path d="M96 144 L142 156"/><path d="M110 140 L156 152"/></g>' +
    '<g stroke="#8f5323" stroke-width="3"><path d="M104 146 l6 -3"/><path d="M118 150 l6 -3"/><path d="M132 154 l6 -3"/></g>' +
    '<g transform="translate(124 128) rotate(14)">' +
    '<path d="M0 6 L28 6 L24 20 L4 20 Z" fill="url(#gi-metal)" stroke="#5b6b7c" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<rect x="2" y="10" width="24" height="2.5" fill="#5b6b7c" opacity=".6"/>' +
    '<g fill="url(#gi-gold)" stroke="#c98a00" stroke-width="1"><circle cx="8" cy="5" r="5"/><circle cx="16" cy="3" r="6"/><circle cx="23" cy="6" r="4.5"/></g>' +
    '<path d="M14 0 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="#fff"/>' +
    '<circle cx="8" cy="22" r="3.5" fill="#4a5563"/><circle cx="21" cy="22" r="3.5" fill="#4a5563"/>' +
    '<circle cx="8" cy="22" r="1.2" fill="#c7d2de"/><circle cx="21" cy="22" r="1.2" fill="#c7d2de"/></g>' +
    // 發光礦石
    '<circle cx="216" cy="124" r="18" fill="url(#gi-glow)"/>' +
    '<g stroke="#c98a00" stroke-width="1" stroke-linejoin="round">' +
    '<path d="M210 136 L214 116 L220 136 Z" fill="url(#gi-crys)"/>' +
    '<path d="M202 138 L204 124 L210 138 Z" fill="url(#gi-crys)"/>' +
    '<path d="M219 138 L224 122 L229 138 Z" fill="url(#gi-crys)"/></g>' +
    '<path d="M214 118 l1 8" stroke="#fff" stroke-width="1.5" opacity=".9"/>' +
    '<g fill="#fff"><path d="M232 112 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z"/><path d="M198 116 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8z"/></g>' +
    // 金屬橋＋右側小礁
    '<path d="M250 150 q12 -10 30 -6 q8 4 6 10 q-18 6 -36 -4z" fill="url(#gi-rock)"/>' +
    '<path d="M268 144 q6 -6 14 -4" stroke="url(#gi-grass)" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<g stroke="url(#gi-metal)" stroke-width="2.5" fill="none" stroke-linecap="round">' +
    '<path d="M234 140 Q252 124 272 140"/><path d="M234 140 L272 140"/>' +
    '<path d="M241 140 L244 132 M253 140 L253 127 M265 140 L262 132"/></g>' +
    '<path d="M234 140 L272 140" stroke="#5b6b7c" stroke-width="1"/>' +
    // 椰子樹
    '<g transform="translate(58 104)">' +
    '<path d="M14 40 C 16 26, 12 14, 18 2" stroke="#8f5323" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M14 40 C 16 26, 12 14, 18 2" stroke="#c98a4a" stroke-width="1.5" fill="none" stroke-dasharray="2 3"/>' +
    '<g fill="#3fa63a" stroke="#2c7d28" stroke-width="1">' +
    '<path d="M18 2 C 4 -4, -6 4, -8 12 C 2 4, 10 4, 18 2 Z"/><path d="M18 2 C 30 -6, 42 0, 44 8 C 34 2, 26 2, 18 2 Z"/>' +
    '<path d="M18 2 C 12 -12, 22 -20, 30 -18 C 22 -12, 20 -6, 18 2 Z"/><path d="M18 2 C 26 8, 30 18, 28 24 C 24 14, 20 8, 18 2 Z"/></g>' +
    '<g fill="#8f5323"><circle cx="16" cy="5" r="2.5"/><circle cx="21" cy="5" r="2.5"/></g></g>' +
    // 旗子
    '<line x1="120" y1="62" x2="120" y2="30" stroke="#6b4a2b" stroke-width="2.5"/>' +
    '<path d="M120 30 q12 4 24 0 q-6 6 0 12 q-12 4 -24 0z" fill="#ff5a4e" stroke="#c4322a" stroke-width="1"/>' +
    '<circle cx="120" cy="29" r="2.5" fill="#ffd23f"/>' +
    // 小寶箱在沙灘
    '<g transform="translate(150 140)">' +
    '<rect x="0" y="6" width="22" height="12" rx="2" fill="url(#gi-wood)" stroke="#6b3d16" stroke-width="1.2"/>' +
    '<path d="M0 6 Q0 -2 11 -2 Q22 -2 22 6 Z" fill="#c77d3a" stroke="#6b3d16" stroke-width="1.2"/>' +
    '<rect x="0" y="6" width="22" height="2.5" fill="url(#gi-gold)"/><rect x="8.5" y="4" width="5" height="7" rx="1" fill="url(#gi-gold)" stroke="#a86b00" stroke-width=".8"/></g>' +
    // 海鷗
    '<g stroke="#5a6b7c" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M226 54 q4 -4 8 0 q4 -4 8 0"/><path d="M246 66 q3 -3 6 0 q3 -3 6 0"/></g>' +
    '</svg>';

  // ---------------------------------------------------------------
  // 吉祥物：圓頭小機器貓
  // ---------------------------------------------------------------
  var MASCOT = '<svg class="mascot" viewBox="0 0 120 130" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="ms-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7e6f5"/></linearGradient>' +
    '<linearGradient id="ms-visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3d63"/><stop offset="1" stop-color="#121a30"/></linearGradient>' +
    '<radialGradient id="ms-eye" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#d9fbff"/><stop offset=".5" stop-color="#5fe0ff"/><stop offset="1" stop-color="#21a6e0"/></radialGradient>' +
    '<radialGradient id="ms-orb" cx="0.4" cy="0.35" r="0.6"><stop offset="0" stop-color="#fffbd0"/><stop offset=".6" stop-color="#ffd23f"/><stop offset="1" stop-color="#f0a000"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="60" cy="124" rx="30" ry="5" fill="#000" opacity=".12"/>' +
    // 天線
    '<line x1="60" y1="18" x2="60" y2="6" stroke="#7a8da3" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="60" cy="6" r="6" fill="url(#ms-orb)" stroke="#c98a00" stroke-width="1.2"/><circle cx="58" cy="4" r="1.8" fill="#fff"/>' +
    // 耳朵
    '<path d="M24 40 L18 10 L48 26 Z" fill="url(#ms-body)" stroke="#7a8da3" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M96 40 L102 10 L72 26 Z" fill="url(#ms-body)" stroke="#7a8da3" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M27 34 L24 18 L40 27 Z" fill="#7fd3ff"/><path d="M93 34 L96 18 L80 27 Z" fill="#7fd3ff"/>' +
    // 身體與手
    '<path d="M38 92 Q36 118 60 118 Q84 118 82 92 Z" fill="url(#ms-body)" stroke="#7a8da3" stroke-width="3"/>' +
    '<circle cx="60" cy="104" r="6" fill="url(#ms-eye)" stroke="#21a6e0" stroke-width="1.2"/>' +
    '<path d="M38 96 Q26 100 24 110" stroke="#7a8da3" stroke-width="7" stroke-linecap="round" fill="none"/>' +
    '<path d="M38 96 Q26 100 24 110" stroke="#f3f8fd" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<path d="M82 94 Q96 88 100 74" stroke="#7a8da3" stroke-width="7" stroke-linecap="round" fill="none"/>' +
    '<path d="M82 94 Q96 88 100 74" stroke="#f3f8fd" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<circle cx="101" cy="71" r="6" fill="#f3f8fd" stroke="#7a8da3" stroke-width="3"/>' +
    // 頭
    '<rect x="14" y="18" width="92" height="76" rx="36" fill="url(#ms-body)" stroke="#7a8da3" stroke-width="3"/>' +
    '<path d="M28 34 Q40 24 60 23" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/>' +
    // 面罩
    '<rect x="25" y="36" width="70" height="42" rx="21" fill="url(#ms-visor)"/>' +
    '<path d="M32 46 Q40 39 56 39" stroke="#6f86b8" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>' +
    '<ellipse cx="45" cy="57" rx="7" ry="9" fill="url(#ms-eye)"/><ellipse cx="75" cy="57" rx="7" ry="9" fill="url(#ms-eye)"/>' +
    '<circle cx="47" cy="53" r="2.2" fill="#fff"/><circle cx="77" cy="53" r="2.2" fill="#fff"/>' +
    '<path d="M54 68 q6 6 12 0" fill="none" stroke="#5fe0ff" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="74" rx="5" ry="3" fill="#ff9bb3" opacity=".75"/><ellipse cx="88" cy="74" rx="5" ry="3" fill="#ff9bb3" opacity=".75"/>' +
    '</svg>';

  // ---------------------------------------------------------------
  // 寶箱（微微打開、發光）
  // ---------------------------------------------------------------
  var CHEST = '<svg class="chest-art" viewBox="0 0 64 56" width="58" height="51" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="ch-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d98f4a"/><stop offset="1" stop-color="#8a4f1f"/></linearGradient>' +
    '<linearGradient id="ch-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a35e"/><stop offset="1" stop-color="#a8642c"/></linearGradient>' +
    '<linearGradient id="ch-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".5" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98c00"/></linearGradient>' +
    '<radialGradient id="ch-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffe680" stop-opacity=".7"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="ch-gem" cx="0.4" cy="0.35" r="0.6"><stop offset="0" stop-color="#ffd1dc"/><stop offset=".6" stop-color="#ff4f7b"/><stop offset="1" stop-color="#c41f4c"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="32" cy="26" rx="30" ry="18" fill="url(#ch-glow)"/>' +
    '<g stroke="#fff3a6" stroke-width="2" stroke-linecap="round" opacity=".9"><path d="M32 18 V4"/><path d="M20 20 L12 10"/><path d="M44 20 L52 10"/></g>' +
    '<ellipse cx="32" cy="53" rx="24" ry="3" fill="#000" opacity=".15"/>' +
    // 箱身
    '<rect x="8" y="28" width="48" height="22" rx="4" fill="url(#ch-wood)" stroke="#5e3311" stroke-width="2"/>' +
    '<path d="M8 38 H56" stroke="#5e3311" stroke-width="1" opacity=".5"/>' +
    '<rect x="14" y="28" width="5" height="22" fill="url(#ch-gold)"/><rect x="45" y="28" width="5" height="22" fill="url(#ch-gold)"/>' +
    // 半開的蓋子
    '<path d="M6 28 Q6 12 32 12 Q58 12 58 28 Z" fill="url(#ch-lid)" stroke="#5e3311" stroke-width="2" transform="rotate(-8 8 28)"/>' +
    '<path d="M12 24 Q14 16 32 16" stroke="#f6c28c" stroke-width="2" fill="none" stroke-linecap="round" transform="rotate(-8 8 28)"/>' +
    // 金幣露出
    '<g fill="url(#ch-gold)" stroke="#c98a00" stroke-width="1"><ellipse cx="24" cy="28" rx="5" ry="2.5"/><ellipse cx="34" cy="27" rx="5" ry="2.5"/><ellipse cx="42" cy="28.5" rx="4" ry="2"/></g>' +
    // 鎖頭與寶石
    '<rect x="27" y="31" width="10" height="12" rx="2.5" fill="url(#ch-gold)" stroke="#a86b00" stroke-width="1.2"/>' +
    '<circle cx="32" cy="36" r="3" fill="url(#ch-gem)"/><circle cx="31" cy="35" r=".9" fill="#fff"/>' +
    '<path d="M10 8 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4z" fill="#fff6b0"/>' +
    '<path d="M54 16 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" fill="#fff6b0"/>' +
    '</svg>';

  // ---------------------------------------------------------------
  // 頁首漂浮城堡島
  // ---------------------------------------------------------------
  var FLOAT_CASTLE = '<svg class="float-castle" viewBox="0 -8 100 98" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="fc-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9946a"/><stop offset="1" stop-color="#6e5034"/></linearGradient>' +
    '<linearGradient id="fc-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be36a"/><stop offset="1" stop-color="#46ad3c"/></linearGradient>' +
    '<linearGradient id="fc-wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff7e8"/><stop offset="1" stop-color="#e3d2b8"/></linearGradient>' +
    '<linearGradient id="fc-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a6b"/><stop offset="1" stop-color="#c4372d"/></linearGradient>' +
    '</defs>' +
    // 岩塊與垂下的藤
    '<path d="M10 58 Q50 50 90 58 Q84 72 70 78 Q60 90 50 88 Q40 90 32 80 Q16 72 10 58 Z" fill="url(#fc-rock)"/>' +
    '<path d="M28 64 l6 8 M60 66 l-4 10 M74 62 l-2 6" stroke="#5a3f27" stroke-width="2" opacity=".5" stroke-linecap="round"/>' +
    '<path d="M22 62 q-2 10 2 16 M80 60 q2 8 -2 12" stroke="#46ad3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="50" cy="57" rx="41" ry="7" fill="url(#fc-grass)"/>' +
    // 城堡
    '<rect x="34" y="30" width="32" height="26" fill="url(#fc-wall)" stroke="#9a8064" stroke-width="1.5"/>' +
    '<path d="M34 30 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4" fill="none" stroke="#9a8064" stroke-width="1.5"/>' +
    '<rect x="24" y="26" width="12" height="30" fill="url(#fc-wall)" stroke="#9a8064" stroke-width="1.5"/>' +
    '<rect x="64" y="26" width="12" height="30" fill="url(#fc-wall)" stroke="#9a8064" stroke-width="1.5"/>' +
    '<rect x="44" y="16" width="12" height="22" fill="url(#fc-wall)" stroke="#9a8064" stroke-width="1.5"/>' +
    '<path d="M22 27 L30 12 L38 27 Z M62 27 L70 12 L78 27 Z" fill="url(#fc-roof)" stroke="#8a2a22" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M42 17 L50 0 L58 17 Z" fill="url(#fc-roof)" stroke="#8a2a22" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M50 0 v-6" stroke="#6b4a2b" stroke-width="1.5"/><path d="M50 -6 l9 3 -9 3z" fill="#ffd23f"/>' +
    '<path d="M44 56 v-10 a6 6 0 0 1 12 0 v10 z" fill="#8a5a2b"/>' +
    '<g fill="#5aa7e8"><rect x="28" y="34" width="4" height="6" rx="2"/><rect x="68" y="34" width="4" height="6" rx="2"/><rect x="48" y="22" width="4" height="6" rx="2"/></g>' +
    '<circle cx="18" cy="54" r="5" fill="#3fa63a"/><circle cx="84" cy="54" r="4" fill="#3fa63a"/>' +
    '</svg>';

  var api = { GOLD_ISLAND: GOLD_ISLAND, MASCOT: MASCOT, CHEST: CHEST, FLOAT_CASTLE: FLOAT_CASTLE, gearPath: gearPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPArt = api;
})(typeof self !== 'undefined' ? self : this);
