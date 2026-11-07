# 由 data/gold_region02_tiles.json 產生 js/board-gold-02.js（勿手改產出檔）
import json, sys
src, out = sys.argv[1], sys.argv[2]
j = json.load(open(src, encoding='utf-8'))
t = j['tiles']
assert len(t) == 25 and [x['order'] for x in t] == list(range(31, 56))
assert len({x['id'] for x in t}) == 25
assert all(0 <= x['gx'] <= j['world']['width'] and 0 <= x['gy'] <= j['world']['height'] for x in t)
body = json.dumps({'status': j['status'], 'world': j['world'], 'name': j['name'], 'backgroundStrip': j['backgroundStrip'], 'tiles': t}, ensure_ascii=False, separators=(',', ':'))
open(out, 'w', encoding='utf-8').write(f"""/*
 * 金島第二區（水晶礦谷）第 31～55 格
 * 自動產生自 data/gold_region02_tiles.json，請勿手動修改。gx、gy 為金島長地圖總覽座標（1080×5400，左上為原點）。
 */
(function (root) {{
  'use strict';
  var GOLD_REGION02 = {body};
  if (typeof module !== 'undefined' && module.exports) module.exports = GOLD_REGION02;
  else root.CGP_GOLD_REGION02 = GOLD_REGION02;
}})(typeof self !== 'undefined' ? self : this);
""")
print('ok', len(t))
