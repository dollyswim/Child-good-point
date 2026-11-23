# 火島地圖需求（給 Codex，2026-11-24）

> 比照水島（`docs/water/CODEX_WATER_ISLAND_BRIEF.md` 第 A、B 節）的做法：4 張各自獨立的場景，App 一次顯示一張。
> 故事依據 `docs/fire/FIRE_ISLAND_SPEC.md`；整體計畫 `docs/fire/FIRE_ISLAND_PLAN.md`。有疑問或規格衝突先回報家長，不要自己改。

## 給 Codex：這次先做什麼
1. **只做第 A 節**：4 張草圖、4 張標號檢視圖、座標 JSON。家長確認前**不要**畫正式地圖。
2. 草圖確認後，第 B 節一次畫一張（S1 → S2 → S3 → S4），每張交給 Claude 驗收才做下一張。
3. 交件直接傳圖（PNG），Claude 負責縮圖、壓縮、換進 App。

## 共用風格（每張貼在提示詞最前面）
```
Bright cute 2.5D clay-toy style children's mobile game art, rounded chunky friendly shapes, soft warm lighting,
volcanic island palette (charcoal and warm grey volcanic rock, black sand, glowing orange-gold lava accents, white Mediterranean village houses, olive and vineyard greens),
matching the existing gold, forest and water islands in the same series, no text, no letters, no numbers, no watermark, no UI
```
中文：明亮可愛的 2.5D 黏土玩具風兒童手機遊戲美術，圓潤厚實友善的造型，柔和溫暖光線；火山島配色（深灰與暖灰火山岩、黑沙、少量發光橘金岩漿、地中海白色村屋、橄欖與葡萄藤綠）；和同系列金島、木島、水島一致；不要任何文字、字母、數字、浮水印、介面。

**火山要可愛不恐怖**：黑煙是一縷一縷的，不要爆炸、火災、受傷或嚇人的畫面。

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
| 村莊廣場 | 10～15 附近（S1） | 300×220 | 之後第 80 格第 2 天村民集合、伊格尼道歉的地方 |
| 米斯、魯莫 | 30（S2） | 220×160 | 一塊受損農田旁，田裡有幾處被砸壞的痕跡 |
| 咚咚與石頭村莊 | 55（S3） | 360×260 | 峭壁上的平台，平台上可以有零散石塊，但**不要畫石頭村莊模型**（之後是劇情視窗） |
| 隱藏金屬門 | 65（S3） | 160×200 | 被火山岩半遮住的金屬門，S3 的出口 |
| 伊格尼與火箭核心 | 80（S4） | 260×300 | 基地中央，火箭在背景，旁邊留空給伊格尼 |
| 修復區 | 90（S4） | 240×200 | 管線、控制台附近 |
| 發射台 | 100（S4） | 360×300 | S4 最上方，火箭停在發射台上 |

## B. 正式場景地圖（草圖確認後一次一張）
每張 1080×1350、PNG。**不畫格子、角色、文字、介面、寶箱、事件圖示。** 交件附該場景最終座標 JSON 與標號檢視圖。
- **S1 港口村莊（0～20）**：`Vertical 1080x1350 game map background, Fire Island "Harbor Village". Fixed isometric 2.5D view. Black sand beach with a small wooden pier and a moored rowboat at the bottom, a big flat-topped harbor rock beside the path near the start, a winding stone path up into a cozy village of white Mediterranean houses with blue doors and flower pots, a small village square, a distant cute volcano on the horizon with a thin wisp of dark smoke.`
- **S2 山坡農園（21～40）**：`Vertical 1080x1350 game map background, Fire Island "Hillside Farms". Fixed isometric 2.5D view. Terraced fields, grape vines and olive trees, small irrigation pipes, a stone stairway path climbing the hill; near one field a few small scorched dents and broken plants (gentle, not scary); the volcano is closer in the upper background.`
- **S3 火山峭壁（41～65）**：`Vertical 1080x1350 game map background, Fire Island "Volcano Cliffs". Fixed isometric 2.5D view. Dark basalt ramps and ledges with sparse hardy plants, a wide flat cliff platform with scattered loose stones, a sea view far below, and near the top exit a metal door half hidden behind volcanic rocks.`
- **S4 秘密基地（66～100）**：`Vertical 1080x1350 game map background, Fire Island "Secret Inventor Base" inside the volcano. Fixed isometric 2.5D cutaway view, warm and friendly. Metal walkways with railings, pipes and cooling tanks, a control console area, a central bay with a cute rounded rocket, and at the top a launch pad open to the sky.`
