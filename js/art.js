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
    '<linearGradient id="gi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6cc6f7"/><stop offset="1" stop-color="#d4f0ff"/></linearGradient>' +
    '<radialGradient id="gi-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff9d6"/><stop offset=".45" stop-color="#ffe68a" stop-opacity=".85"/><stop offset="1" stop-color="#ffe68a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gi-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ccff5"/><stop offset=".5" stop-color="#2eaee3"/><stop offset="1" stop-color="#1b86c6"/></linearGradient>' +
    '<radialGradient id="gi-shallow" cx="0.5" cy="0.5" r="0.5"><stop offset=".6" stop-color="#8be6f5"/><stop offset="1" stop-color="#8be6f5" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gi-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#ecc77e"/></linearGradient>' +
    '<linearGradient id="gi-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6ea6e"/><stop offset=".6" stop-color="#6cc94a"/><stop offset="1" stop-color="#46ad3c"/></linearGradient>' +
    '<linearGradient id="gi-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98457"/><stop offset="1" stop-color="#7d5233"/></linearGradient>' +
    '<linearGradient id="gi-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8b9a6"/><stop offset="1" stop-color="#857261"/></linearGradient>' +
    '<linearGradient id="gi-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".45" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98c00"/></linearGradient>' +
    '<linearGradient id="gi-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5fa"/><stop offset=".5" stop-color="#b4c2d1"/><stop offset="1" stop-color="#7f8fa1"/></linearGradient>' +
    '<linearGradient id="gi-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4924f"/><stop offset="1" stop-color="#8f5323"/></linearGradient>' +
    '<radialGradient id="gi-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffe680" stop-opacity=".8"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gi-crys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#f0a000"/></linearGradient>' +
    '</defs>' +
    // 天空、太陽、雲、遠方小島
    '<rect width="320" height="200" fill="url(#gi-sky)"/>' +
    '<circle cx="278" cy="26" r="34" fill="url(#gi-sun)"/><circle cx="278" cy="26" r="11" fill="#fff6c2"/>' +
    '<g fill="#fff"><ellipse cx="48" cy="26" rx="26" ry="8"/><ellipse cx="62" cy="20" rx="14" ry="10"/><ellipse cx="40" cy="22" rx="10" ry="7"/>' +
    '<ellipse cx="196" cy="18" rx="18" ry="5" opacity=".85"/><ellipse cx="205" cy="14" rx="9" ry="6" opacity=".85"/></g>' +
    '<path d="M0 62 q14 -10 28 -2 q10 -6 20 2 z" fill="#86c9a8" opacity=".55"/><path d="M262 62 q12 -9 26 -1 q8 -4 16 1 z" fill="#86c9a8" opacity=".5"/>' +
    // 海
    '<rect y="60" width="320" height="140" fill="url(#gi-sea)"/>' +
    '<g stroke="#d4f3ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75">' +
    '<path d="M16 80 q7 -3 14 0 t14 0"/><path d="M274 86 q7 -3 14 0 t14 0"/><path d="M20 182 q8 -4 16 0 t16 0"/><path d="M250 190 q8 -4 16 0"/><path d="M120 190 q8 -4 16 0"/></g>' +
    // 島的倒影與淺水
    '<ellipse cx="156" cy="146" rx="146" ry="46" fill="url(#gi-shallow)" opacity=".8"/>' +
    '<ellipse cx="156" cy="154" rx="128" ry="30" fill="#1a7fbf" opacity=".25"/>' +
    // 浪花圈與沙灘
    '<ellipse cx="156" cy="140" rx="132" ry="38" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 6" opacity=".9"/>' +
    '<ellipse cx="156" cy="138" rx="126" ry="34" fill="url(#gi-sand)"/>' +
    '<path d="M44 146 Q100 166 156 167 Q212 166 268 146" stroke="#fff6d8" stroke-width="2" fill="none" opacity=".9"/>' +
    // 島的側面厚度（土層）
    '<path d="M46 126 Q60 146 156 150 Q252 146 266 126 L266 132 Q252 154 156 158 Q60 154 46 132 Z" fill="url(#gi-earth)"/>' +
    // 草地與兩座小丘
    '<path d="M46 126 C 48 108, 70 98, 92 96 C 104 74, 140 66, 158 82 C 170 62, 212 58, 228 84 C 250 88, 268 104, 266 126 Q252 146 156 150 Q60 146 46 126 Z" fill="url(#gi-grass)"/>' +
    '<path d="M100 92 C 112 78, 136 74, 150 84 M172 76 C 186 66, 208 66, 220 80" stroke="#cdf7a0" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    // 灌木
    '<g fill="#3d9a35"><circle cx="70" cy="118" r="7"/><circle cx="78" cy="116" r="6"/><circle cx="236" cy="114" r="7"/><circle cx="244" cy="118" r="5"/><circle cx="160" cy="126" r="5"/><circle cx="166" cy="124" r="4"/></g>' +
    '<g fill="#6cc94a"><circle cx="68" cy="116" r="3"/><circle cx="234" cy="112" r="3"/></g>' +
    // 左丘：礦洞岩壁
    '<path d="M96 120 C 96 100, 106 88, 122 86 C 138 86, 148 100, 148 120 Z" fill="url(#gi-rock)"/>' +
    '<path d="M104 102 l6 -4 M136 98 l6 4" stroke="#efe6d8" stroke-width="2" stroke-linecap="round" opacity=".7"/>' +
    '<path d="M112 120 L112 108 Q112 98 122 98 Q132 98 132 108 L132 120 Z" fill="#3a2a1d"/>' +
    '<path d="M109 121 L109 106 Q109 95 122 95 Q135 95 135 106 L135 121" fill="none" stroke="url(#gi-wood)" stroke-width="4"/>' +
    '<circle cx="122" cy="110" r="8" fill="url(#gi-glow)"/>' +
    // 右丘：齒輪與小工廠
    '<g>' + gear(198, 58, 15, 12, 'url(#gi-gold)', 0.18) + '</g>' +
    '<g>' + gear(217, 48, 8.5, 9, 'url(#gi-gold)', 0.22) + '</g>' +
    '<g transform="translate(212 82)">' +
    '<rect x="0" y="8" width="24" height="15" rx="2" fill="#f1e1c6" stroke="#8a6a45" stroke-width="1.2"/>' +
    '<path d="M0 8 l8 -6 0 6 8 -6 0 6 8 -6 0 6z" fill="#d45a35" stroke="#8a3a20" stroke-width="1" stroke-linejoin="round"/>' +
    '<rect x="18" y="-8" width="4.5" height="12" fill="#9aa9b8" stroke="#64748b" stroke-width=".8"/>' +
    '<rect x="4" y="13" width="5" height="5" rx="1" fill="#ffe680"/><rect x="14" y="13" width="5" height="5" rx="1" fill="#ffe680"/>' +
    '<g fill="#fff" opacity=".9"><circle cx="21" cy="-12" r="3"/><circle cx="25" cy="-18" r="4"/><circle cx="31" cy="-23" r="5"/></g></g>' +
    // 旗子
    '<line x1="140" y1="74" x2="140" y2="52" stroke="#6b4a2b" stroke-width="2"/>' +
    '<path d="M140 52 q10 3 20 0 q-5 5 0 10 q-10 3 -20 0z" fill="#ff5a4e" stroke="#c4322a" stroke-width="1"/>' +
    // 發光礦石
    '<circle cx="168" cy="112" r="15" fill="url(#gi-glow)"/>' +
    '<g stroke="#c98a00" stroke-width="1" stroke-linejoin="round">' +
    '<path d="M164 122 L168 104 L173 122 Z" fill="url(#gi-crys)"/><path d="M157 123 L159 111 L164 123 Z" fill="url(#gi-crys)"/><path d="M172 123 L176 110 L180 123 Z" fill="url(#gi-crys)"/></g>' +
    '<g fill="#fff"><path d="M184 104 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z"/></g>' +
    // 軌道與礦車（沿沙灘）
    '<path d="M122 124 Q128 142 160 146 Q196 148 214 140" stroke="#7f8fa1" stroke-width="2" fill="none"/>' +
    '<path d="M118 128 Q126 148 160 151 Q198 153 218 144" stroke="#7f8fa1" stroke-width="2" fill="none"/>' +
    '<g stroke="#8f5323" stroke-width="2.5"><path d="M124 132 l-4 2"/><path d="M134 141 l-3 4"/><path d="M148 145 l-1 5"/><path d="M164 147 l0 5"/><path d="M182 147 l1 5"/><path d="M200 144 l2 5"/></g>' +
    '<g transform="translate(132 128)">' +
    '<path d="M0 6 L24 6 L21 18 L3 18 Z" fill="url(#gi-metal)" stroke="#5b6b7c" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<g fill="url(#gi-gold)" stroke="#c98a00" stroke-width="1"><circle cx="7" cy="5" r="4.5"/><circle cx="14" cy="3" r="5"/><circle cx="20" cy="5.5" r="4"/></g>' +
    '<circle cx="7" cy="19.5" r="3" fill="#4a5563"/><circle cx="18" cy="19.5" r="3" fill="#4a5563"/></g>' +
    // 椰子樹（左右各一）
    palm(52, 92, 1) + palm(250, 88, 0.9) +
    // 木棧橋
    '<g transform="translate(234 146) rotate(18)">' +
    '<rect x="0" y="0" width="52" height="10" rx="2" fill="url(#gi-wood)" stroke="#6b3d16" stroke-width="1"/>' +
    '<g stroke="#6b3d16" stroke-width="1" opacity=".7"><path d="M10 0 v10 M20 0 v10 M30 0 v10 M40 0 v10"/></g>' +
    '<g fill="#7a4520"><rect x="4" y="9" width="3.5" height="10"/><rect x="44" y="9" width="3.5" height="12"/></g></g>' +
    // 小寶箱
    '<g transform="translate(84 136)">' +
    '<rect x="0" y="5" width="18" height="10" rx="2" fill="url(#gi-wood)" stroke="#6b3d16" stroke-width="1"/>' +
    '<path d="M0 5 Q0 -1 9 -1 Q18 -1 18 5 Z" fill="#c77d3a" stroke="#6b3d16" stroke-width="1"/>' +
    '<rect x="0" y="5" width="18" height="2" fill="url(#gi-gold)"/><rect x="7" y="3.5" width="4" height="6" rx="1" fill="url(#gi-gold)"/></g>' +
    // 金屬橋＋小礁
    '<ellipse cx="300" cy="126" rx="16" ry="6" fill="url(#gi-sand)"/><ellipse cx="300" cy="123" rx="11" ry="4" fill="url(#gi-grass)"/>' +
    '<g stroke="url(#gi-metal)" stroke-width="2.2" fill="none" stroke-linecap="round">' +
    '<path d="M262 122 Q276 108 290 122"/><path d="M262 122 L290 122"/><path d="M269 122 L270 115 M276 122 L276 112 M283 122 L282 115"/></g>' +
    // 海鷗與海面閃光
    '<g stroke="#5a6b7c" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M100 36 q4 -4 8 0 q4 -4 8 0"/><path d="M118 46 q3 -3 6 0 q3 -3 6 0"/></g>' +
    '<g fill="#fff"><path d="M40 160 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z"/><path d="M290 160 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z"/></g>' +
    '</svg>';

  /** 椰子樹（x,y 為樹頂葉子中心，s 縮放） */
  function palm(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<path d="M2 40 C 4 26, 0 14, 4 0" stroke="#8f5323" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M2 40 C 4 26, 0 14, 4 0" stroke="#c98a4a" stroke-width="1.3" fill="none" stroke-dasharray="2 3"/>' +
      '<g fill="#3fa63a" stroke="#2c7d28" stroke-width="1">' +
      '<path d="M4 0 C -10 -6, -20 2, -22 10 C -12 2, -4 2, 4 0 Z"/><path d="M4 0 C 16 -8, 28 -2, 30 6 C 20 0, 12 0, 4 0 Z"/>' +
      '<path d="M4 0 C -2 -14, 8 -22, 16 -20 C 8 -14, 6 -8, 4 0 Z"/><path d="M4 0 C 12 6, 16 16, 14 22 C 10 12, 6 6, 4 0 Z"/>' +
      '<path d="M4 0 C -4 4, -10 14, -8 20 C -4 12, 0 6, 4 0 Z"/></g>' +
      '<g fill="#8f5323"><circle cx="2" cy="3" r="2.3"/><circle cx="7" cy="3" r="2.3"/></g></g>';
  }

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

  // ---------------------------------------------------------------
  // 角色棋子（Phase 3 測試角色）：腳底中心在 (30, 68)
  // ---------------------------------------------------------------
  var SHADOW = '<ellipse cx="30" cy="68" rx="16" ry="4" fill="#000" opacity=".18"/>';
  var CHARACTERS = {
    robot: '<svg viewBox="0 0 60 72" aria-hidden="true">' + SHADOW +
      '<defs><linearGradient id="pc-rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d4e4f4"/></linearGradient></defs>' +
      '<line x1="30" y1="10" x2="30" y2="4" stroke="#7a8da3" stroke-width="2"/><circle cx="30" cy="4" r="3.2" fill="#ffd23f" stroke="#c98a00"/>' +
      '<path d="M12 22 L9 6 L24 15 Z M48 22 L51 6 L36 15 Z" fill="url(#pc-rb)" stroke="#7a8da3" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M14 18 L12 10 L20 15 Z M46 18 L48 10 L40 15 Z" fill="#7fd3ff"/>' +
      '<path d="M19 50 Q18 66 30 66 Q42 66 41 50 Z" fill="url(#pc-rb)" stroke="#7a8da3" stroke-width="2"/>' +
      '<circle cx="30" cy="57" r="3.2" fill="#5fe0ff"/>' +
      '<rect x="6" y="10" width="48" height="42" rx="20" fill="url(#pc-rb)" stroke="#7a8da3" stroke-width="2"/>' +
      '<rect x="12" y="20" width="36" height="23" rx="11.5" fill="#1b2747"/>' +
      '<ellipse cx="23" cy="31" rx="3.6" ry="4.6" fill="#5fe0ff"/><ellipse cx="37" cy="31" rx="3.6" ry="4.6" fill="#5fe0ff"/>' +
      '<circle cx="24" cy="29" r="1.2" fill="#fff"/><circle cx="38" cy="29" r="1.2" fill="#fff"/>' +
      '<path d="M27 37 q3 3 6 0" stroke="#5fe0ff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    deer: '<svg viewBox="0 0 60 72" aria-hidden="true">' + SHADOW +
      '<defs><linearGradient id="pc-dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7a466"/><stop offset="1" stop-color="#b8743a"/></linearGradient></defs>' +
      '<g stroke="#7a4a20" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M20 16 L14 4 M16 9 L10 8 M40 16 L46 4 M44 9 L50 8"/></g>' +
      '<path d="M8 22 Q2 18 4 12 Q12 14 14 20 Z M52 22 Q58 18 56 12 Q48 14 46 20 Z" fill="url(#pc-dr)" stroke="#7a4a20" stroke-width="1.5"/>' +
      '<path d="M7 20 Q5 16 6 14 Q10 16 11 19 Z M53 20 Q55 16 54 14 Q50 16 49 19 Z" fill="#ffc7d6"/>' +
      '<path d="M19 50 Q18 66 30 66 Q42 66 41 50 Z" fill="url(#pc-dr)" stroke="#7a4a20" stroke-width="2"/>' +
      '<path d="M24 54 Q30 62 36 54" fill="#fff4e6"/>' +
      '<circle cx="30" cy="32" r="21" fill="url(#pc-dr)" stroke="#7a4a20" stroke-width="2"/>' +
      '<ellipse cx="30" cy="41" rx="11" ry="8" fill="#fff4e6"/>' +
      '<g fill="#fff4e6"><circle cx="17" cy="24" r="2"/><circle cx="43" cy="22" r="1.6"/><circle cx="40" cy="28" r="1.3"/></g>' +
      '<ellipse cx="22" cy="31" rx="3.6" ry="4.4" fill="#2b1a10"/><ellipse cx="38" cy="31" rx="3.6" ry="4.4" fill="#2b1a10"/>' +
      '<circle cx="23" cy="29" r="1.3" fill="#fff"/><circle cx="39" cy="29" r="1.3" fill="#fff"/>' +
      '<ellipse cx="30" cy="38" rx="3" ry="2" fill="#5b3418"/><path d="M27 42 q3 2.5 6 0" stroke="#5b3418" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="15" cy="38" rx="3" ry="2" fill="#ff9bb3" opacity=".7"/><ellipse cx="45" cy="38" rx="3" ry="2" fill="#ff9bb3" opacity=".7"/></svg>',
    boxcat: '<svg viewBox="0 0 60 72" aria-hidden="true">' + SHADOW +
      '<defs><linearGradient id="pc-bx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c48a"/><stop offset="1" stop-color="#c89552"/></linearGradient>' +
      '<linearGradient id="pc-bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6a6ff"/><stop offset="1" stop-color="#8b74f0"/></linearGradient></defs>' +
      // 從箱子探出頭的紫色小怪獸
      '<path d="M16 22 L13 9 L24 17 Z M44 22 L47 9 L36 17 Z" fill="url(#pc-bf)" stroke="#5b47b8" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<ellipse cx="30" cy="30" rx="18" ry="15" fill="url(#pc-bf)" stroke="#5b47b8" stroke-width="2"/>' +
      '<ellipse cx="23" cy="29" rx="3.4" ry="4.2" fill="#fff"/><ellipse cx="37" cy="29" rx="3.4" ry="4.2" fill="#fff"/>' +
      '<circle cx="23.5" cy="30" r="2" fill="#2b1a40"/><circle cx="37.5" cy="30" r="2" fill="#2b1a40"/>' +
      '<path d="M26 36 q4 3 8 0" stroke="#2b1a40" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M28 36 l1 2 1 -2" fill="#fff"/>' +
      '<path d="M14 38 Q10 36 8 40" stroke="#5b47b8" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M46 38 Q50 36 52 40" stroke="#5b47b8" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      // 紙箱
      '<path d="M10 40 L50 40 L48 66 L12 66 Z" fill="url(#pc-bx)" stroke="#8a5a26" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M10 40 L4 34 L22 34 L26 40 Z M50 40 L56 34 L38 34 L34 40 Z" fill="#f1d39f" stroke="#8a5a26" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="22" y="48" width="16" height="4" rx="1" fill="#8a5a26" opacity=".35"/>' +
      '<path d="M30 54 l1.6 3.4 3.6.5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5z" fill="#ffd23f" stroke="#c98a00" stroke-width=".8"/></svg>'
  };

  // ---------------------------------------------------------------
  // 棋盤裝飾（以螢幕座標放置，原點在物件底部中心）
  // ---------------------------------------------------------------
  function at(x, y, s, inner) { return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + s + ')">' + inner + '</g>'; }
  var DECO = {
    palm: function (x, y, s) { return palm(x, y - 40 * s, s); },
    mine: function (x, y, s) {
      return at(x, y, s,
        '<path d="M-26 0 C -26 -26, -14 -40, 0 -40 C 14 -40, 26 -26, 26 0 Z" fill="url(#bd-rock)"/>' +
        '<path d="M-10 0 L-10 -14 Q-10 -24 0 -24 Q10 -24 10 -14 L10 0 Z" fill="#3a2a1d"/>' +
        '<path d="M-13 1 L-13 -15 Q-13 -27 0 -27 Q13 -27 13 -15 L13 1" fill="none" stroke="url(#bd-wood)" stroke-width="4"/>' +
        '<circle cx="0" cy="-10" r="9" fill="url(#bd-glow)"/>' +
        '<circle cx="-16" cy="-22" r="2" fill="#efe6d8" opacity=".7"/>');
    },
    crystals: function (x, y, s) {
      return at(x, y, s, '<circle cx="0" cy="-10" r="16" fill="url(#bd-glow)"/>' +
        '<g stroke="#c98a00" stroke-width="1" stroke-linejoin="round"><path d="M-4 0 L0 -20 L5 0 Z" fill="url(#bd-crys)"/>' +
        '<path d="M-12 0 L-10 -12 L-5 0 Z" fill="url(#bd-crys)"/><path d="M4 0 L9 -14 L13 0 Z" fill="url(#bd-crys)"/></g>' +
        '<path d="M15 -16 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="#fff"/>');
    },
    gear: function (x, y, s) {
      return at(x, y, s, '<rect x="-2" y="-14" width="4" height="14" fill="#8a6a45"/>' +
        '<path d="' + gearPath(0, -26, 16, 12) + '" fill="url(#bd-gold)" stroke="#a86b00" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<circle cx="0" cy="-26" r="4" fill="#7d4f12"/>' +
        '<path d="' + gearPath(18, -36, 9, 9) + '" fill="url(#bd-gold)" stroke="#a86b00" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<circle cx="18" cy="-36" r="2.4" fill="#7d4f12"/>');
    },
    factory: function (x, y, s) {
      return at(x, y, s, '<rect x="-16" y="-20" width="32" height="20" rx="2" fill="#f1e1c6" stroke="#8a6a45" stroke-width="1.5"/>' +
        '<path d="M-16 -20 l10 -8 0 8 10 -8 0 8 10 -8 0 8z" fill="#d45a35" stroke="#8a3a20" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<rect x="8" y="-40" width="6" height="16" fill="#9aa9b8" stroke="#64748b" stroke-width="1"/>' +
        '<rect x="-11" y="-13" width="7" height="7" rx="1" fill="#ffe680"/><rect x="2" y="-13" width="7" height="7" rx="1" fill="#ffe680"/>' +
        '<g fill="#fff" opacity=".9"><circle cx="11" cy="-45" r="4"/><circle cx="16" cy="-52" r="5"/><circle cx="23" cy="-58" r="6"/></g>');
    },
    cart: function (x, y, s) {
      return at(x, y, s, '<path d="M-14 -16 L14 -16 L11 -4 L-11 -4 Z" fill="url(#bd-metal)" stroke="#5b6b7c" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<g fill="url(#bd-gold)" stroke="#c98a00" stroke-width="1"><circle cx="-6" cy="-17" r="5"/><circle cx="2" cy="-19" r="5.5"/><circle cx="9" cy="-16" r="4"/></g>' +
        '<circle cx="-7" cy="-2" r="3.2" fill="#4a5563"/><circle cx="7" cy="-2" r="3.2" fill="#4a5563"/>');
    },
    bridge: function (x, y, s) {
      return at(x, y, s, '<g stroke="url(#bd-metal)" stroke-width="3" fill="none" stroke-linecap="round">' +
        '<path d="M-30 0 Q0 -24 30 0"/><path d="M-30 0 L30 0"/><path d="M-18 0 L-17 -10 M-6 0 L-6 -15 M6 0 L6 -15 M18 0 L17 -10"/></g>' +
        '<path d="M-30 0 L30 0" stroke="#5b6b7c" stroke-width="1.2"/>');
    },
    castle: function (x, y, s) { return at(x - 50 * s, y - 88 * s, s, FLOAT_CASTLE.replace(/<\/?svg[^>]*>/g, '')); }
  };
  /** 棋盤用的共用漸層（放在棋盤 svg 的 defs 裡） */
  var BOARD_DEFS =
    '<linearGradient id="bd-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cdbda9"/><stop offset="1" stop-color="#857261"/></linearGradient>' +
    '<linearGradient id="bd-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4924f"/><stop offset="1" stop-color="#8f5323"/></linearGradient>' +
    '<linearGradient id="bd-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a6"/><stop offset=".45" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98c00"/></linearGradient>' +
    '<linearGradient id="bd-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5fa"/><stop offset=".5" stop-color="#b4c2d1"/><stop offset="1" stop-color="#7f8fa1"/></linearGradient>' +
    '<linearGradient id="bd-crys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#f0a000"/></linearGradient>' +
    '<radialGradient id="bd-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffe680" stop-opacity=".8"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="bd-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd9f7"/><stop offset="1" stop-color="#2aa3dc"/></linearGradient>' +
    '<linearGradient id="bd-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6ea6e"/><stop offset="1" stop-color="#5cbf4a"/></linearGradient>' +
    '<linearGradient id="bd-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#ecc77e"/></linearGradient>' +
    '<linearGradient id="bd-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98457"/><stop offset="1" stop-color="#7d5233"/></linearGradient>' +
    FLOAT_CASTLE.match(/<defs>([\s\S]*?)<\/defs>/)[1];

  var api = { GOLD_ISLAND: GOLD_ISLAND, MASCOT: MASCOT, CHEST: CHEST, FLOAT_CASTLE: FLOAT_CASTLE, gearPath: gearPath,
    CHARACTERS: CHARACTERS, DECO: DECO, BOARD_DEFS: BOARD_DEFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPArt = api;
})(typeof self !== 'undefined' ? self : this);
