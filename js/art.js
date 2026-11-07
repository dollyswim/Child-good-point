/*
 * 親子集點 — 插圖
 * 吉祥物、寶箱、漂浮城堡為家長提供的原創去背插圖（images/*.webp）。
 * 角色圖在 images/characters/，金島地圖背景在 images/gold/。
 */
(function (root) {
  'use strict';

  function img(src, cls, alt, w, h) {
    return '<img class="' + cls + '" src="' + src + '" alt="' + (alt || '') + '"' + (alt ? '' : ' aria-hidden="true"') +
      ' width="' + w + '" height="' + h + '" decoding="async">';
  }

  var MASCOT = img('images/mascot.webp', 'mascot', '', 203, 256);
  var CHEST = img('images/chest.webp', 'chest-art', '', 256, 229);
  var FLOAT_CASTLE = img('images/float-castle.webp', 'float-castle', '', 242, 256);

  var api = { MASCOT: MASCOT, CHEST: CHEST, FLOAT_CASTLE: FLOAT_CASTLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CGPArt = api;
})(typeof self !== 'undefined' ? self : this);
