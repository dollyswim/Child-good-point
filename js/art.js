/*
 * 親子集點 — 插圖
 * 吉祥物、寶箱、漂浮城堡為家長提供的原創插圖（images/*.webp）；棋盤格子與裝飾為向量圖。
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
  // 家長提供的點陣插圖（已去背，images/*.webp）
  // ---------------------------------------------------------------
  function img(src, cls, alt, w, h) {
    return '<img class="' + cls + '" src="' + src + '" alt="' + (alt || '') + '"' + (alt ? '' : ' aria-hidden="true"') +
      ' width="' + w + '" height="' + h + '" decoding="async">';
  }
  var MASCOT = img('images/mascot.webp', 'mascot', '', 203, 256);
  var CHEST = img('images/chest.webp', 'chest-art', '', 256, 229);
  var FLOAT_CASTLE = img('images/float-castle.webp', 'float-castle', '', 242, 256);

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
    castle: function (x, y, s) {
      var w = 100 * s, hh = w * 256 / 242;
      return '<image href="images/float-castle.webp" x="' + (x - w / 2).toFixed(1) + '" y="' + (y - hh).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '"/>';
    }
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
    '<linearGradient id="bd-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98457"/><stop offset="1" stop-color="#7d5233"/></linearGradient>';

  var api = { MASCOT: MASCOT, CHEST: CHEST, FLOAT_CASTLE: FLOAT_CASTLE, gearPath: gearPath,
    DECO: DECO, BOARD_DEFS: BOARD_DEFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPArt = api;
})(typeof self !== 'undefined' ? self : this);
