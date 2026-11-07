# 由 data/gold_region01_tiles.json 產生 js/board-gold.js（勿手改產出檔）
import json, sys
src, out = sys.argv[1], sys.argv[2]
j = json.load(open(src, encoding='utf-8'))
t = j['tiles']
assert len(t) == 30 and len({x['id'] for x in t}) == 30
assert [x['order'] for x in t] == list(range(1, 31))
assert all(0 <= x['x'] <= 1 and 0 <= x['y'] <= 1 for x in t)
tiles = [{'id': x['id'], 'order': x['order'], 'x': x['x'], 'y': x['y'], 'eventType': x['eventType']} for x in t]
body = json.dumps({'referenceSize': j['referenceSize'], 'tilePreviewSize': j['tilePreviewSize'], 'tiles': tiles}, ensure_ascii=False, separators=(',', ':'))
js = f"""/*
 * 金島第一區（黃金沙灘與初級礦場）第 1～30 格座標
 * 自動產生自 data/gold_region01_tiles.json，請勿手動修改；更新座標時改 JSON 後重新產生。
 * x、y 為相對背景圖左上角的標準化中心座標（0～1）。
 */
(function (root) {{
  'use strict';
  var GOLD_REGION01 = {body};
  if (typeof module !== 'undefined' && module.exports) module.exports = GOLD_REGION01;
  else root.CGP_GOLD_REGION01 = GOLD_REGION01;
}})(typeof self !== 'undefined' ? self : this);
"""
open(out, 'w', encoding='utf-8').write(js)
print('ok', len(tiles))
