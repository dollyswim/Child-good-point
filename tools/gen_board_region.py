# 由 data/gold_regionNN_tiles.json 產生 js/board-gold-NN.js（勿手改產出檔）
# 用法：python3 tools/gen_board_region.py data/gold_region03_tiles.json js/board-gold-03.js CGP_GOLD_REGION03 56 80
import json, sys
src, out, var, first, last = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
j = json.load(open(src, encoding='utf-8'))
t = j['tiles']
assert [x['order'] for x in t] == list(range(first, last + 1)), '格號要連續 %d～%d' % (first, last)
assert len({x['id'] for x in t}) == len(t)
assert all(0 <= x['gx'] <= j['world']['width'] and 0 <= x['gy'] <= j['world']['height'] for x in t)
body = json.dumps({'status': j['status'], 'world': j['world'], 'name': j['name'], 'backgroundStrip': j['backgroundStrip'], 'tiles': t}, ensure_ascii=False, separators=(',', ':'))
open(out, 'w', encoding='utf-8').write(f"""/*
 * 金島「{j['name']}」第 {first}～{last} 格
 * 自動產生自 {src}，請勿手動修改。gx、gy 為金島長地圖總覽座標（1080×5400，左上為原點）。
 */
(function (root) {{
  'use strict';
  var DATA = {body};
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.{var} = DATA;
}})(typeof self !== 'undefined' ? self : this);
""")
print('ok', len(t))
