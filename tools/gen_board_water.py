# 由 data/water/water_scene0N_tiles_final.json（4 個獨立場景）產生 js/board-water.js（勿手改產出檔）
# 用法：python3 tools/gen_board_water.py
import json, math
tiles, npc = [], {}
for i in range(1, 5):
    j = json.load(open('data/water/water_scene0%d_tiles_final.json' % i, encoding='utf-8'))
    t = j['tiles']
    ds = [math.dist((a['x'], a['y']), (b['x'], b['y'])) for a, b in zip(t, t[1:])]
    assert 64 <= min(ds) and max(ds) <= 76, '場景 %d 格距要在 64～76px' % i
    for x in t:
        tiles.append({'n': x['tile'], 'id': x['id'], 'regionId': x['sceneId'], 'gx': x['x'], 'gy': x['y']})
    # NPC 站位框（左上角＋寬高）→ [中心 x, 腳底 y, 寬, 高]
    for s in j.get('npcSpots', []):
        npc[str(s['tile'])] = [s['x'] + s['w'] / 2, s['y'] + s['h'] - 10, s['w'], s['h']]
tiles.sort(key=lambda x: x['n'])
assert [x['n'] for x in tiles] == list(range(101)), '格號要連續 0～100'
body = json.dumps({'scene': {'width': 1080, 'height': 1350}, 'tiles': tiles, 'npcSpots': npc}, ensure_ascii=False, separators=(',', ':'))
open('js/board-water.js', 'w', encoding='utf-8').write("""/*
 * 水島第 0～100 格（Codex 正式圖，2026-11-17 驗收通過；4 張獨立場景，每張 1080×1350）
 * 自動產生自 data/water/water_scene01～04_tiles_final.json（tools/gen_board_water.py），請勿手動修改。
 * gx、gy 為「所在場景」內的座標（左上為原點）；regionId＝場景代號；npcSpots＝依任務格號的 NPC 站位 [中心 x, 腳底 y, 寬, 高]。
 */
(function (root) {
  'use strict';
  var DATA = %s;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.CGP_WATER_BOARD = DATA;
})(typeof self !== 'undefined' ? self : this);
""" % body)
print('ok', len(tiles), sorted(npc))
