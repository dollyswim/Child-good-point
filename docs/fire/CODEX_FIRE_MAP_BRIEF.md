# 火島地圖需求（給 Codex，2026-11-24）

> 比照水島（`docs/water/CODEX_WATER_ISLAND_BRIEF.md` 第 A、B 節）的做法：4 張各自獨立的場景，App 一次顯示一張。
> 故事依據 `docs/fire/FIRE_ISLAND_SPEC.md`；整體計畫 `docs/fire/FIRE_ISLAND_PLAN.md`。有疑問或規格衝突先回報家長，不要自己改。

## 給 Codex：這次先做什麼
1. **只做第 A 節**：4 張草圖、4 張標號檢視圖、座標 JSON。家長確認前**不要**畫正式地圖。
2. 草圖確認後，第 B 節一次畫一張（S1 → S2 → S3 → S4），每張交給 Claude 驗收才做下一張。
3. 交件直接傳圖（PNG），Claude 負責縮圖、壓縮、換進 App。

## 共用風格（每張貼在提示詞最前面；2026-11-24 家長改版：火的元素越往上越多）
```
Bright cute 2.5D clay-toy style children's mobile game art, rounded chunky friendly shapes, warm glowing lighting,
a volcano island full of fire features: glowing orange lava, chubby cute flames, steam vents, glowing volcanic stones and dark basalt rock,
exciting but friendly and safe-looking for young children, matching the existing gold, forest and water islands in the same series,
no text, no letters, no numbers, no watermark, no UI
```
中文：明亮可愛的 2.5D 黏土玩具風兒童手機遊戲美術，圓潤厚實友善的造型，溫暖發光的光線；充滿火元素的火山島：發光的橘色岩漿、圓胖可愛的火焰、噴氣孔、發光火山石、深色玄武岩；刺激但對幼兒來說友善、看起來安全；和同系列金島、木島、水島一致；不要任何文字、字母、數字、浮水印、介面。

**兩個原則一定要守**
1. **主路一定看起來安全**：岩漿、火焰只在路的兩側，或用石橋、金屬橋跨過；格子上方不能有火。**唯一例外是下方「熔岩危險格」**。
2. **刺激但可愛**：亮橘色黏土岩漿、圓胖火焰；不畫爆炸、燒焦的房子、受傷或嚇人的臉。

**火山大小的變化**：S1 遠方中型火山 → S2 巨大火山佔畫面上半部 → S3 已在火山側面、看得到火山口紅光 → S4 在火山裡面。

## A. 全島草圖與座標（先交）
### 要交的東西
1. 4 張草圖 `fire_scene01_draft.png`～`fire_scene04_draft.png`（各 1080×1350，低細節即可）。
2. 4 張標格號的檢視圖（格號、每格 70×50 平坦區、NPC 站位框、安全區框；這些標記**不能**出現在正式圖）。
3. 座標 JSON `fire_island_coordinates_0_100.json`（格式同水島，場景內座標）：
```json
{
  "schemaVersion": "fire-1.0",
  "coordinateSystem": { "origin": "top-left", "xDirection": "right", "yDirection": "down", "unit": "px", "sceneWidth": 1080, "sceneHeight": 1350 },
  "scenes": [
    { "sceneId": "fire-01", "file": "fire_scene01.png", "name": "港口村莊", "from": 0, "to": 20 },
    { "sceneId": "fire-02", "file": "fire_scene02.png", "name": "山坡農園", "from": 21, "to": 40 },
    { "sceneId": "fire-03", "file": "fire_scene03.png", "name": "火山峭壁", "from": 41, "to": 65 },
    { "sceneId": "fire-04", "file": "fire_scene04.png", "name": "秘密基地", "from": 66, "to": 100 }
  ],
  "tiles": [ { "tile": 0, "id": "fire-01-start", "sceneId": "fire-01", "x": 540, "y": 1240 } ],
  "npcSpots": [ { "npc": "lolo", "tile": 1, "sceneId": "fire-01", "x": 0, "y": 0, "w": 120, "h": 140 } ],
  "safeZones": [ { "sceneId": "all", "x": 0, "y": 1130, "w": 180, "h": 220 }, { "sceneId": "all", "x": 1000, "y": 1170, "w": 80, "h": 180 } ]
}
```
（數字只是格式範例。tiles 要有 0～100 共 101 筆；格子 ID：`fire-01-start`、`fire-01-001`～`020`、`fire-02-021`～`040`、`fire-03-041`～`065`、`fire-04-066`～`100`。）

### 路線與格距（同前三島）
- 一條清楚的主路：S1 黑沙小路接村莊石板路、S2 田埂石階、S3 玄武岩坡道、S4 金屬走道；路面寬約 110～140px，和周圍明顯分開。
- 相鄰格中心距離 **64～76px**；不同彎段之間至少約 140px，避免看起來能抄捷徑。S4 有 35 格，請用較多彎段排滿。
- 每格中心周圍約 **70×50 平坦**，上方約 **70px 不放高物件**。
- **安全區**：左下 180×220（商店按鈕）、右下 80×180（縮放按鈕）不放主路與重要物件。

### NPC 與劇情站位（留平坦空地，不要畫角色）
| 角色／物件 | 旁邊的格 | 空地大小 | 備註 |
|---|---|---|---|
| 洛洛（望遠鏡） | 1（S1） | 120×140 | 港口的一塊大岩石頂，看得到遠方冒煙的火山 |
| 奧提斯家門 | 5（S1） | 140×160 | 一棟門窗緊閉的白牆小屋，門要正對主路；**屋後不要畫任何拱門、發光物或神秘裝置** |
| 村莊廣場與團結火堆 | 10～15 附近（S1） | 300×220 | 廣場**中央畫一個大火堆**（圓形石圍火坑、木柴、旁邊長椅），是居民團結的象徵；第 80 格第 2 天伊格尼在這裡道歉。火堆要在路旁，不能壓在格子上 |
| 米斯、魯莫 | 30（S2） | 220×160 | 一塊受損農田旁，田裡有幾處被砸壞的痕跡 |
| 咚咚與石頭村莊 | 55（S3） | 360×260 | 峭壁上的平台，平台上可以有零散石塊，但**不要畫石頭村莊模型**（之後是劇情視窗） |
| 隱藏金屬門 | 65（S3） | 160×200 | 被火山岩半遮住的金屬門，S3 的出口 |
| 伊格尼與火箭核心 | 80（S4） | 260×300 | 基地中央，火箭在背景，旁邊留空給伊格尼 |
| 修復區 | 90（S4） | 240×200 | 管線、控制台附近 |
| 發射台 | 100（S4） | 360×300 | S4 最上方，火箭停在發射台上 |

### 熔岩危險格（2026-11-24 新增：停在這格會被岩漿或落石逼退）
這幾格的主路上要畫出「危險穿過路面」，但格子本身仍要平坦、看得出是主路的一部分（例如路面上有一道細細的岩漿流過、旁邊有落石滑道）。前後兩格都要是安全的一般路面。
| 格 | 場景 | 畫面 |
|---|---|---|
| 27 | S2 | 岩漿小溪的細支流流過路面 |
| 44 | S3 | 上方岩漿細流沿岩縫流過路面 |
| 59 | S3 | 路旁的落石滑道，碎石滾過路面 |
| 76 | S4 | 熔岩導管有一段漏出，滴在走道上 |
| 86 | S4 | 走道旁的蒸氣閥，噴氣口對著走道 |

## B. 正式場景地圖（草圖確認後一次一張）
每張 1080×1350、PNG。**不畫格子、角色、文字、介面、寶箱、事件圖示。** 交件附該場景最終座標 JSON 與標號檢視圖。英文提示詞給 Codex，中文是對照。

### S1 港口村莊（0～20）：火元素少量
`Vertical 1080x1350 game map background, Fire Island "Harbor Village". Fixed isometric 2.5D view. A black sand beach with a small wooden pier at the bottom, small steam vents puffing on the sand and hot volcanic rocks steaming at the water's edge, a big flat harbor rock beside the path near the start. A winding stone path climbs into a cozy village of white houses with warm orange roofs, glowing lava-stone lanterns and glowing volcanic pebbles along the path. In the middle of the village square: a big friendly communal bonfire in a round stone fire pit with logs and benches around it, beside the path. A medium-size cute volcano in the upper background with a glowing orange crater and a thin dark smoke plume.`

中文：港口村莊。固定 2.5D 等角視角。最下方黑沙海灘和小木碼頭，沙灘上有小噴氣孔冒煙、海邊熱熱的火山石冒著蒸氣，起點旁一塊平頂大岩石（洛洛站的地方）。蜿蜒石板路往上進入溫馨村莊：白牆、暖橘色屋頂，路旁有發光的熔岩石燈籠和發光火山小石。村莊廣場中央有一個大大的、友善的團結火堆（圓形石圍火坑、木柴、周圍長椅），在路旁不壓到格子。上方遠處一座中型可愛火山，火山口發橘光、冒一縷黑煙。

### S2 山坡農園（21～40）：火山變大、岩漿小溪
`Vertical 1080x1350 game map background, Fire Island "Hillside Farms on the Volcano Slope". Fixed isometric 2.5D view. A huge cute volcano fills the whole upper half, much bigger and closer than in the village, with bright orange lava streams flowing down its sides and a dark smoke plume. Terraced fields, grape vines and olive trees on the lower slope, walls made of glowing volcanic stones, small steam vents puffing between fields, a small lava creek crossing the hillside with cute stone bridges where the path goes over it (at tile 27 a thin side trickle of lava flows across the path), a stone stairway path climbing up. Near one field a few gentle scorched dents and broken plants.`

中文：火山山坡上的農園。**巨大的可愛火山佔滿上半部**，比村莊看到的大很多、近很多，山坡上流著亮橘色岩漿、冒黑煙。下方山坡是梯田、葡萄藤、橄欖樹；田邊的矮牆用發光火山石砌成；田與田之間有小噴氣孔冒煙；一條岩漿小溪橫過山坡，主路經過的地方有可愛的石橋（第 27 格有一道細細的岩漿支流流過路面）；石階路往上爬。某塊田旁有幾處溫和的燒焦凹痕和斷掉的作物。

### S3 火山峭壁（41～65）：岩漿瀑布、火焰
`Vertical 1080x1350 game map background, Fire Island "Volcano Cliffs" high on the volcano's side. Fixed isometric 2.5D view. Dark basalt ramps and ledges with glowing orange cracks, a glowing lava waterfall pouring down one side into a bubbling lava pool, chubby cute flames peeking out of rock crevices, tall steam vents, the red glow of the crater visible above. At tile 44 a thin lava trickle runs across the path from a rock crack; at tile 59 a small rockfall chute beside the path with pebbles rolling across it. A wide flat cliff platform with scattered loose stones, and near the top exit a metal door half hidden behind volcanic rocks. The path stays on solid rock, lava only beside it.`

中文：已經在火山側面的高處峭壁。深色玄武岩坡道和岩台，岩石有發光的橘色裂縫；一側有發光的岩漿瀑布流進冒泡的岩漿池；岩縫裡探出圓胖可愛的火焰；高高的蒸氣噴口；上方看得到火山口的紅光。第 44 格有一道細岩漿從岩縫流過路面；第 59 格路旁有小落石滑道，碎石滾過路面。一片寬平的峭壁平台（咚咚的地方）上散落石塊；最上方出口有一扇被火山岩半遮住的金屬門。主路都在堅固的岩石上，岩漿只在旁邊。

### S4 秘密基地（66～100）：岩漿湖、火箭發射設施
`Vertical 1080x1350 game map background, Fire Island "Secret Rocket Base inside the Volcano". Fixed isometric 2.5D cutaway view, exciting but friendly. Metal walkways with railings built above a big glowing lava lake, lava channels and pipes carrying molten lava, steam valves puffing, big cooling tanks, a control console area, several rocket test stands with small test rockets and a tall fuel tower along the way (at tile 76 a lava pipe drips onto the walkway; at tile 86 a steam valve points at the walkway), and at the top a big launch pad with a cute rounded rocket under an opening in the crater to the sky. The walkway path is always solid metal, lava stays below and beside it.`

中文：火山裡面的秘密火箭基地，剖面 2.5D 視角，刺激但友善。有欄杆的金屬走道架在發光的大岩漿湖上方；岩漿渠道和輸送熔岩的管線；冒蒸氣的閥門；大型冷卻槽；控制台區；沿路有好幾座火箭試驗台（小型試驗火箭）和一座高高的燃料塔（第 76 格有熔岩導管滴到走道上；第 86 格走道旁的蒸氣閥對著走道）；最上方是大發射台，可愛的圓胖火箭停在火山口開口下，看得到天空。走道永遠是堅固的金屬，岩漿只在下方和兩旁。
