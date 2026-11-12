# 由 data/wood_island_coordinates_0_100.json 產生 js/board-wood.js（勿手改產出檔）
# 用法：python3 tools/gen_board_wood.py
import json, math
j = json.load(open('data/wood_island_coordinates_0_100.json', encoding='utf-8'))
t = j['tiles']
assert [x['tile'] for x in t] == list(range(101)), '格號要連續 0～100'
ds = [math.dist((a['x'], a['y']), (b['x'], b['y'])) for a, b in zip(t, t[1:])]
assert 64 <= min(ds) and max(ds) <= 76, '格距要在 64～76px'
REG = {'wood_region01': 'wood-01', 'wood_region02': 'wood-02', 'wood_region03': 'wood-03', 'wood_region04': 'wood-04'}
tiles = [{'n': x['tile'], 'id': 'wood-%s-%s' % (REG[x['backgroundId']][-2:], 'start' if x['tile'] == 0 else '%03d' % x['tile']), 'regionId': REG[x['backgroundId']], 'gx': x['x'], 'gy': x['y']} for x in t]
# 小精靈站位：站位框（左上角＋寬高）換成腳底中央的座標
guides = {str(f['tileId']): [f['x'] + f['width'] / 2, f['y'] + f['height'] - 10] for f in j['fairySpots']}
body = json.dumps({'world': {'width': 1080, 'height': 5400}, 'tiles': tiles, 'guideSpots': guides, 'partyLawn': j['partyLawn']}, ensure_ascii=False, separators=(',', ':'))
open('js/board-wood.js', 'w', encoding='utf-8').write("""/*
 * 木島第 0～100 格（Codex 第 2 版地圖，2026-11-12 驗收通過）
 * 自動產生自 data/wood_island_coordinates_0_100.json（tools/gen_board_wood.py），請勿手動修改。
 * gx、gy 為木島長地圖座標（1080×5400，左上為原點）；guideSpots＝小精靈腳底中央的位置（依任務格號）。
 */
(function (root) {
  'use strict';
  var DATA = %s;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.CGP_WOOD_BOARD = DATA;
})(typeof self !== 'undefined' ? self : this);
""" % body)
print('ok', len(tiles), guides)
