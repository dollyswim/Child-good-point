# 水島美術需求與提示詞（給 Codex／Gemini）

> 2026-11-16｜確認版。完整計畫：`docs/water/WATER_ISLAND_PLAN.md`（以計畫為準）。
> 水島是第三座島，畫風**和金島、木島同一系列**：可愛 Q 版 3D、黏土玩具般圓潤、明亮溫暖。請先上傳金島或木島的地圖、木島森林小精靈、飛行員阿翔當風格參考。
> 每張圖：**不要文字、字母、數字、浮水印**（文字全部由 App 疊上去）。所有元素原創，不要像任何現有遊戲或動畫。

## 交件總表

| 節 | 內容 | 數量 | 尺寸 | 誰做（建議） | 順序 |
|---|---|---|---|---|---|
| A | 全島草圖＋座標 JSON | 4 草圖＋1 JSON＋4 檢視圖 | 1080×1350 | Codex | ① 先交、家長確認 |
| B | 正式場景地圖 S1～S4 | 4 | 1080×1350 | Codex | ② 一次一張 |
| C | 角色（NPC） | 7 | 直式白底 | Gemini 等 | 可和 B 同時 |
| D | 任務視窗場景 | 4 | 1200×900 | Gemini 等 | 可和 B 同時 |
| E | 任務小圖（貼紙）＋潛水艇、魚桶 | 28（＋第二版選做 2） | 1024×1024 白底 | Gemini 等 | 可和 B 同時 |
| F | 過場動畫 | 5 | 直式 3:4 | Gemini 等 | 可和 B 同時 |
| G | 成就徽章（選做） | 1 | 1024×1024 | 任一 | 最後 |

**數量**：第一版必做 4 張地圖＋7 角色＋4 視窗場景＋28 小圖＋5 過場＝48 張（另有草圖 4 張、座標 JSON 1 份；徽章與第二版小圖選做）。

### 給 Codex：這次先做什麼
1. **只做第 A 節**：4 張草圖、4 張標號檢視圖、座標 JSON。家長確認前**不要**畫正式地圖。
2. 草圖確認後，第 B 節一次畫一張（S1 → S2 → S3 → S4），每張交給 Claude 驗收才做下一張。
3. 第 C～F 節可以由 Codex 或其他工具（Gemini 等）同時進行，不影響地圖。
4. 有疑問或發現規格衝突，先回報家長，不要自己改規則（故事與玩法以 `docs/water/WATER_ISLAND_PLAN.md` 為準）。

交件方式和之前一樣：直接傳圖（PNG／JPG），Claude 負責去背、縮尺寸、壓縮、換進 App。白底圖只會去除和外框相連的白色。

---

## 共用風格（每張貼在提示詞最前面）

**地圖與場景（B、D、F）**
```
Bright cute 2.5D clay-toy style children's mobile game art, rounded chunky friendly shapes, soft warm sunny lighting,
saturated but gentle colors (teal, aqua, coral pink, warm sand), matching an existing gold island and forest island in the same series,
no text, no letters, no numbers, no watermark, no UI
```
中文：明亮可愛的 2.5D 黏土玩具風兒童手機遊戲美術，圓潤厚實友善的造型，柔和溫暖陽光，飽和但柔和的顏色（青綠、水藍、珊瑚粉、暖沙色），和同系列的金島、木島一致，不要任何文字、字母、數字、浮水印、介面。

**角色與小圖（C、E）**
```
Cute chibi 3D game asset, soft clay-toy style, rounded chunky shapes, glossy highlights, soft studio lighting,
warm pastel colors, children's mobile game, clean silhouette readable at small size, centered with margin,
single subject, no text, no watermark, plain white background
```
中文：可愛 Q 版 3D 遊戲素材，軟黏土玩具質感，圓潤厚實，帶光澤高光，柔和攝影棚打光，溫暖粉彩，兒童手機遊戲，縮小後輪廓仍清楚，置中留邊，單一主體，不要文字與浮水印，純白背景。

**深海也要明亮友善**：不要恐怖的黑暗、尖牙、血腥或嚇人的生物。

---

## A. 全島草圖與座標（Codex，先交）

和木島不同：水島是 **4 張各自獨立的場景**（不用上下接縫），App 一次只顯示一張，走到邊界淡出淡入切換。

### 要交的東西
1. 4 張草圖 `water_scene01_draft.png`～`water_scene04_draft.png`（各 1080×1350，低細節即可）。
2. 4 張標格號的檢視圖（格號、每格 70×50 平坦區、NPC 站位框、安全區框；這些標記**不能**出現在正式圖）。
3. 座標 JSON `water_island_coordinates_0_100.json`，格式比照木島 `data/wood_island_coordinates_0_100.json`，但每格用**場景內座標**：

```json
{
  "schemaVersion": "water-1.0",
  "coordinateSystem": { "origin": "top-left", "xDirection": "right", "yDirection": "down", "unit": "px", "sceneWidth": 1080, "sceneHeight": 1350 },
  "scenes": [
    { "sceneId": "water-01", "file": "water_scene01.png", "name": "珊瑚淺灘", "from": 0, "to": 24 },
    { "sceneId": "water-02", "file": "water_scene02.png", "name": "深海世界", "from": 25, "to": 58 },
    { "sceneId": "water-03", "file": "water_scene03.png", "name": "水下洞穴", "from": 59, "to": 82 },
    { "sceneId": "water-04", "file": "water_scene04.png", "name": "沉船", "from": 83, "to": 100 }
  ],
  "tiles": [ { "tile": 0, "id": "water-01-start", "sceneId": "water-01", "x": 540, "y": 1240 } ],
  "npcSpots": [ { "npc": "fisherman", "tile": 16, "sceneId": "water-01", "x": 0, "y": 0, "w": 100, "h": 140 } ],
  "safeZones": [ { "sceneId": "all", "x": 0, "y": 1130, "w": 180, "h": 220 }, { "sceneId": "all", "x": 1000, "y": 1170, "w": 80, "h": 180 } ]
}
```
（上面數字只是格式範例，請填實際量測值。tiles 要有 0～100 共 101 筆；格子 ID：`water-01-start`、`water-01-001`～`024`、`water-02-025`～`058`、`water-03-059`～`082`、`water-04-083`～`100`。）

### 路線與格距（和金島、木島相同）
- 一條清楚的主路，淺色沙道（S1～S3）或平坦船板（S4），和周圍明顯分開；路面寬約 110～140px。
- 同一場景內相鄰格中心距離 **64～76px**；不同彎段之間至少約 140px，避免看起來可以抄捷徑。
- 每格中心周圍約 **70×50 平坦**，上方約 **70px 不放高物件**（要放格子圖示和角色）。
- **安全區**：左下 180×220（商店按鈕）、右下 80×180（縮放按鈕）不放主路與重要物件。
- 場景的入口與出口不用貼到圖邊，可以在畫面內（例如 S1 的下潛點、S2 的洞口），但不要放在右下角安全區。

### NPC 站位（地圖上要留的平坦空地，不要畫角色）
| 角色 | 旁邊的格 | 空地大小 | 備註 |
|---|---|---|---|
| 牛奶瓶提示 | 8（S1） | 80×80 | 放瓶子圖示 |
| 漁夫（迎接） | 0（S1） | 140×140 | 起點旁的小木碼頭，放漁夫和裝魚水桶（2026-11-16 新增） |
| 漁夫 | 16（S1） | 100×140 | 岸邊或露出水面的木平台 |
| 小白鯨 | 34、42（S2）、62（S3） | 240×180 | 路旁水域 |
| 大鯊魚 | 48（S2） | 300×220 | 路的側邊，不能蓋到 48、49 格 |
| 燈籠魚 | 56（S2） | 160×160 | 靠近 58 的洞口 |
| 健忘怪房門 | 100（S4） | 300×200 | 門前空地中間保持空曠 |

---

## B. 正式場景地圖 S1～S4（Codex，草圖確認後一次一張）

每張 1080×1350、PNG。**不畫格子、角色、大型海洋動物、文字、介面、寶箱、事件圖示。** 交件附：該場景最終座標 JSON（第 A 節格式）、標號檢視圖。

### S1 珊瑚淺灘（0～24）
```
Vertical 1080x1350 game map background, Water Island "Coral Shallows". Fixed isometric 2.5D view.
A sunny tropical shoreline with shallow clear turquoise water, colorful rounded coral, smooth round rocks and little shells.
Near the bottom right (roughly 70% to 92% of the width, low in the image, but left of the bottom-right 80x180 button strip), the end of a big curved tree-root tunnel
whose round opening faces LEFT toward the path and opens onto white sand (where the player just slid out from the forest island); we see the opening from the side, not from behind.
One clear pale sandy path starts right in front of that opening (the starting point) and winds smoothly to the left and upward through the beach and shallow coral water
to a small diving point near the top of the image (a wooden jetty edge over deeper blue water).
Close to the starting point, beside the path on the water side (not blocking the tunnel opening or the path), a small wooden pier with a flat empty spot (about 140x140) for a fisherman and a bucket.
Beside the path, a flat wooden platform at the water's edge left empty for a fisherman character.
The path is continuous, flat and spacious with room for 25 stops, but do not draw any tiles or numbers.
Keep the bottom-left 180x220 and bottom-right 80x180 corners calm with no path or important objects.
No characters, no large sea animals, no text, no UI.
```
中文重點：暖陽海岸、清澈水藍淺水、彩色圓潤珊瑚、礁石與小貝殼；**大樹根隧道的出口在右下方**（約畫面寬度 70%～92%、靠下，但要在右下角 80×180 縮放按鈕區的左邊），**洞口朝左、對著路**，從側面看得到圓形洞口（剛從木島滑出來的地方）通到白沙；第 0 格就在洞口前，淺色沙道往左、往上蜿蜒，到畫面上方的下潛點（深藍水邊的木棧橋）；路旁有空的木平台給漁夫。起點附近、路旁靠水的一側要有一個小木碼頭（不要擋住洞口和路），留 140×140 平坦空地給漁夫和魚桶（不要畫漁夫、不要畫魚桶）。

### S2 深海世界（25～58）
```
Vertical 1080x1350 game map background, Water Island "Deep Sea World". Fixed isometric 2.5D view, underwater but bright and friendly.
Light rays enter from the upper left where the water is lighter aqua, gradually becoming deeper teal-blue toward the lower right, still clearly readable.
One pale grey-beige fine seabed sand path with gentle ripple patterns, small shells and pebbles along its edges, becoming slightly cooler toward the lower right but always clearly brighter than the surrounding water (2026-11-17: not the yellow beach sand of S1), enters near the upper left and winds smoothly in 2 to 3 gentle bends toward the lower right,
ending at a softly glowing cave mouth set slightly inside the frame (not in the bottom-right corner).
Soft coral gardens, swaying seaweed, glowing jellyfish lights as small accents, scattered bubbles, a few tiny fish only far in the background.
Leave open water areas beside the path for a large friendly beluga (240x180), a big shark (300x220) and a lantern fish near the cave (160x160); do not draw these animals.
Room for 34 stops, no tiles, no numbers, no characters, no text, no UI.
```
中文重點：明亮友善的海底；左上淺色光束、往右下漸深但仍清楚；淺色海底沙脊從左上 2～3 段平滑彎到右下，終點是微微發光的洞口（不要貼在右下角）；路旁留空水域給白鯨、鯊魚、燈籠魚（不要畫牠們）。

### S3 水下洞穴（59～82）
```
Vertical 1080x1350 game map background, Water Island "Underwater Cave". Fixed isometric 2.5D view.
A cozy underwater cave with rounded stone pillars, gentle stalactites, a calm underground waterway and warm glowing amber and pink minerals.
One clear path of smooth, flat, pale cream-grey cave rock floor (worn smooth like a natural stone walkway, with soft subtle cracks and a little fine sand in the seams, gently lit by the warm glowing minerals; not yellow beach sand) enters from a cave entrance and makes a smooth S-shaped route through the scenery,
the path must stay clearly lighter than the darker cave surroundings so tiles placed on it are easy to see,
ending at a broken wooden hatch of a sunken ship whose cute rounded bow can be seen between pillars.
On one wall, faint glowing old route drawings made of simple shapes (no letters).
Side caves are only narrow dark cracks or rock walls, never paths of the same width.
Room for 24 stops, no tiles, no numbers, no characters, no text, no UI. Warm and safe, not scary.
```
中文重點：溫暖安全的水下洞穴，圓潤石柱、鐘乳石、地下水道、暖橘與粉紅發光礦物；S 形主路；終點是沉船破開的木艙門，柱子間看得到圓潤船首；牆上有發光的舊航線圖（只用圖形，不要字）；岔洞只是窄縫，不要像路。**路面（2026-11-17 家長決定）**：不用沙灘黃，改成洞穴裡平滑、平坦的淡米灰色岩石地面（像被水磨平的天然石板步道，有淡淡的細紋、石縫裡一點細沙，被暖色礦物光照亮）；一定要比周圍深色洞穴亮，格子放上去才清楚。

### S4 沉船（83～100）
```
Vertical 1080x1350 game map background, Water Island "Sunken Ship". Fixed isometric 2.5D cutaway view of a cute rounded wooden shipwreck.
Flat wooden deck planks form one clear path from a broken entrance through the ship's corridors and cabins.
Inside, a magical dry air bubble fills the cabins so paper, laundry and furniture stay dry: small round bubble walls glimmer at the edges.
Along the later part of the path: scattered rummaging traces (open drawers, tipped stools, socks), small blank paper notes pinned on walls,
a clothesline with drying cloths, and at the end a cozy round cabin door with a flat open space (300x200) in front of it, kept empty.
Do not draw any blanket, any storage boxes, any treasure or any characters.
Room for 18 stops, no tiles, no numbers, no text, no UI. Warm lantern light, cozy and funny, not spooky.
```
中文重點：可愛圓潤的木沉船剖面，平坦船板主路；船艙裡有魔法乾燥氣泡（邊緣微微發亮），所以有紙、晾衣服、家具；後段路旁有翻找的痕跡（打開的抽屜、倒下的小椅子、襪子）、牆上釘著空白小紙條、晾衣繩；終點是圓形船艙門，門前留 300×200 空地。**不要畫被子、收納箱、寶藏、角色。**

---

## C. 角色（7 張，直式白底，全身）

共同要求：全身、正面或 3/4 側、**上半身要清楚**（App 的對話框會用這張圖的上半部當「半身大圖」）、純白背景、四周留邊、不要文字。至少 800×1200（鯊魚、白鯨可以橫式）。

| 代號 | 角色 | 提示詞 |
|---|---|---|
| C-1 | 漁夫 | `A cute chibi friendly old fisherman, full body standing, straw hat, striped shirt, rolled-up trousers, holding a small fishing rod, kind face with a raised eyebrow as if slightly puzzled, white beard` 中文：和氣的 Q 版老漁夫，草帽、條紋衣、捲褲管、拿小釣竿，表情有點疑惑地挑眉，白鬍子 |
| C-2 | 小白鯨 | `A cute chubby baby beluga whale, white with a soft blue tint, big round friendly eyes, smiling, small flippers, gentle pose, side 3/4 view, horizontal` 中文：圓胖的小白鯨，白色帶淡藍、大眼睛、微笑、小鰭，3/4 側面，橫式 |
| C-3 | 大鯊魚 | `A big but playful cartoon shark guarding a path, rounded body, light gray-blue, mischievous grin with no sharp teeth showing, arms-like fins crossed like a gatekeeper, side 3/4 view, horizontal` 中文：調皮的大鯊魚守門員，圓潤身體、灰藍色、壞壞的笑**但不露尖牙**，鰭像手一樣交叉擋路，3/4 側面，橫式 |
| C-4 | 燈籠魚 | `A cute shy little anglerfish, round body, soft purple, a glowing warm yellow lantern on its head clearly separated above the body, big shy eyes, blushing, no sharp teeth` 中文：害羞的小燈籠魚，圓身體、淡紫色、頭上溫暖黃色發光燈籠、害羞大眼、臉紅、不露尖牙 |
| C-5 | 健忘怪（迷糊） | `A cute round chubby forgetful monster, blue-purple fluffy body, short round horns, a crooked little hat, mismatched socks, big confused eyes, scratching its head with one hand, friendly and silly` 中文：圓胖的健忘怪，藍紫色毛茸茸、短圓角、歪帽子、左右不同的襪子，一手抓頭、一臉迷糊 |
| C-6 | 健忘怪（驚喜） | 同 C-5 角色、同角度，`both hands on cheeks, mouth wide open in a happy surprise, sparkling eyes` 中文：雙手捧臉、張嘴驚喜、眼睛發亮 |
| C-7 | 健忘怪（抱被被） | 同 C-5 角色，`hugging a soft cream-colored blanket with a big yellow star patch tightly, eyes closed, cheek pressed against it, very happy and relieved` 中文：緊緊抱著有黃色大星星布章的奶油色小被被，閉眼貼臉，非常安心 |

> ✅ 2026-11-17 已收：C-1 漁夫、C-2 小白鯨、C-3 鯊魚、C-4 燈籠魚（Gemini），已去背存為 `images/water/npc/fisherman.webp`、`beluga.webp`、`shark.webp`、`anglerfish.webp`（640×640，只去除與外框相連的白底；燈籠魚另去掉燈旁淡黃光暈與燈桿內側白底，燈泡保留）。C-5～C-7 健忘怪也已收（2026-11-17）：`monster_confused.webp`（迷糊）、`monster_surprised.webp`（驚喜）、`monster_blanket.webp`（抱小被被）。**C 節全部完成。** 2026-11-18：C-3 鯊魚換成家長提供的新圖（壞笑露牙的鯊魚惡霸，已去背）→ `images/water/npc/shark_v2.webp`，舊的 `shark.webp` 已刪除。 小被被定案外觀：奶油色、中間一顆黃色大星星，E-25 要畫成一樣。

> ✅ 2026-11-18 C-8 已收（Gemini）→ `images/water/npc/monster_lying_v2.webp`（去白底、900 寬；含手臂和頭之間被圍住的白底），疊在併排的三個箱子上。
> 2026-11-18 新增 **C-8 健忘怪橫躺發呆（橫圖）**：給第 100 格房間用，App 把三個箱子（E-20～E-22）併排放在地上，這張疊在箱子上，看起來像健忘怪躺在箱子上。**不要畫箱子**。檔名放 `images/water/npc/monster_lying.webp`，到貨後把 `js/app.js` 的 `MONSTER_SEAT` 換成新檔、`MONSTER_SEAT_PH` 改成 false。
> 提示詞：`The same forgetful monster character as the reference image (same purple body, horns, beanie hat, striped socks, same proportions and 3D clay style), lying lazily on his back / half-reclining sideways along a long low flat surface, body stretched horizontally across the frame, head and shoulders slightly raised on the left, legs stretched out to the right, one hand scratching his head, dazed spaced-out face, eyes looking up and around as if trying to remember what he was looking for. The surface he lies on is NOT drawn (no boxes, no bench, no furniture); his back and bottom form a flat line along the lower edge. Wide horizontal 3:2 composition, plain white background, no text, no shadow on the ground`
> 中文：同一隻健忘怪（附 C-5 當參考），懶洋洋地橫躺／半躺，身體橫向伸展，頭和肩膀在左邊微微抬起、腳伸向右邊，一手抓頭，恍神發呆、眼睛往上東張西望像在想自己在找什麼。**底下躺的東西不要畫**（不要箱子、椅子），背和屁股貼著畫面下緣成一直線。橫式 3:2、白底、不要字、不要地面影子。

> C-5～C-7 必須是**同一個角色、同樣比例和角度**，只換動作表情（先做 C-5，再請同一個對話改成 C-6、C-7）。小被被的樣子要和 E-25 一致。

---

## D. 任務視窗場景（4 張，橫式 4:3、1200×900、畫滿不要白底）

> ✅ 2026-11-17 D 節 4 張已收（Codex）→ `images/water/task/memo_map.webp`、`open_water.webp`、`search_cave.webp`、`cabin_room.webp`（轉 webp）。D-1 下方空白由 App 先寫「最重要的寶……」再切 20 片，長得一樣的碎紙互相算對；D-4 的搜查點對準家具，圖裡沒有木箱，原「木箱」搜查點改成「布簾」。
> 2026-11-18：第 48 格鯊魚改用家長提供的較深藍色海底 → `images/water/task/shark_deep.webp`（1200×900）；D-2 只留給第 34 格餵小白鯨。

共用風格用「地圖與場景」那段，再加 `horizontal 4:3 composition, full scene`。

| 代號 | 用在 | 提示詞 |
|---|---|---|
| D-1 | 第 8 格「神祕藏寶圖」 | `A hand-drawn memo map on old cream paper, drawn by a clumsy cute monster with crayon-like lines: a cute sunken ship, a big yellow star, wobbly arrows, three simple box outlines side by side, and a small pillow drawing in a corner. The star is not on any box and not connected to any box. Leave a blank strip at the bottom for text. Flat top-down view of the paper filling the frame, no letters` 中文：奶油色舊紙上的手繪備忘圖（蠟筆風、歪歪扭扭）：沉船、大黃星星、歪箭頭、三個並排的箱子輪廓、角落一個小枕頭。**星星不能畫在箱子上或連到箱子**；下方留空白給 App 寫字。紙張正面俯視、畫滿整張（App 會切成 20 片） |
| D-2 | 第 34 格餵白鯨、第 48 格鯊魚 | `A bright open underwater area with soft light rays, sandy seabed, a few coral clumps around the edges, large calm open water in the middle, no animals` 中文：明亮開闊的海底，光束、沙地，珊瑚只在邊緣，中間大片空水域，不要動物（白鯨、鯊魚由 App 疊上） |
| D-3 | 第 56 格燈籠魚找東西 | `A detailed seabed corner near a cave entrance, evenly and clearly lit (not dark), sand, rounded rocks, coral, seaweed, old roots and shells with many little hiding nooks spread across the whole image, the cave mouth on one side, no animals and no small loose objects` 中文：洞穴口旁邊的海底角落，**畫成正常明亮、看得清楚的版本**（不要畫成黑暗）：沙地、圓石、珊瑚、海草、老樹根，整張圖各處都有可以藏東西的小角落，一側是洞口；**不要動物、不要小物件**。漆黑效果和燈光由 App 疊上去（孩子用燈籠魚的燈照亮一小圈找東西），所以背景本身要亮、細節要清楚 |
| D-4 | 第 100 格健忘怪房間 | `A cozy messy cabin room inside a sunken ship, filled with a magical dry air bubble, warm lantern light. A small bed with a slipper under it, a plain cupboard with a snowflake sticker on its door, a wooden desk with ink smudges and a closed side drawer, a wardrobe with its door slightly open, a round window with an empty little bottle rack (a round ring-shaped holder) on the windowsill, a curtain in one corner, and an empty floor area at the bottom center for three boxes. No characters, no boxes, no blanket, no paper notes` 中文：沉船裡溫馨又亂的房間，有魔法乾燥氣泡、暖色燈光：小床（床下一隻拖鞋）、門上貼雪花的普通櫃子、有墨跡和側抽屜（關著）的木書桌、門半開的衣櫃、圓窗＋窗台上**空的小瓶架**（圓環狀）、角落一片布簾、下方中央留空地放三個箱子。**不要角色、箱子、被子、紙條**（都由 App 疊上） |

---

## E. 任務小圖（29 張，正方形 1024×1024、白底、單一物件）

用「角色與小圖」共用風格。

> ✅ 2026-11-17 第三批已收（Gemini）：E-1 玻璃牛奶瓶（重畫版：經典瓶身、捲紙、瓶底牛奶滴浮雕）→ `images/water/items/bottle.webp`；E-9 海玻璃（重畫版：霧面）→ `images/water/find/seaglass.webp`；E-12 海草束 → `images/water/find/seaweed.webp`；E-25 小被被（與 C-7 一致）→ `images/water/items/blanket.webp`；E-30 潛水艇 → `images/items/submarine.webp`。都只去除與外框相連的白底。
> ✅ 2026-11-17 第四批已收（Gemini）：E-15 筆記本翻開 → `images/water/items/notebook_open.webp`（頁面文字由 App 寫）；E-16～E-19 紙卡（弄髒、清洗、晾乾、收好）→ `images/water/items/card_soiled／card_wash／card_dry／card_store.webp`。
> ✅ 2026-11-17 第五批已收（Gemini）：E-20～E-23 收納箱（星星、月亮、貝殼、打開）→ `images/water/items/box_star／box_moon／box_shell／box_open.webp`；選對月亮箱後換成打開的箱子，小被被從箱子裡冒出來。
> ✅ 2026-11-17 第六批已收（Gemini）：E-14 筆記本闔上 → `images/water/items/notebook_closed.webp`（封面字由 App 寫）；E-24 扳手和起子 → `wrench.webp`（看過星星箱後出現）；E-26 水窪 → `puddle.webp`（看過貝殼箱後出現）。**E 節必做的圖全部完成**（E-27、E-28 第二版選做）。

### 第 4、8、16 格
| 代號 | 物件 | 提示詞 |
|---|---|---|
| E-1 | 玻璃牛奶瓶 | `a sealed glass milk bottle with a round cork cap and a little milk-drop shaped emboss near the bottom, rolled paper scraps visible inside` 中文：密封玻璃牛奶瓶、圓軟木塞、瓶底附近有牛奶滴形浮雕，裡面看得到捲起來的碎紙（瓶底的樣子要能和 D-4 的瓶架對上） |
| E-31 | 一桶魚 | `a small wooden bucket full of cute little silver-blue fish peeking out, a rope handle, a few water drops` 中文：小木桶裝滿探出頭的銀藍小魚、繩子提把、幾滴水珠（2026-11-16 新增，地圖上放在漁夫腳邊，也當「故事物品」圖示） |
| E-2 | 潛水藥水 | `a small round potion bottle with glowing aqua liquid and a tiny bubble pattern, cork stopper` 中文：小圓藥水瓶，發光水藍色液體、小泡泡圖案 |

### 第 34 格餵白鯨
| E-3 | 小魚 | `a single cute little silver-blue fish` 中文：一條可愛的銀藍小魚 |

### 第 56 格燈籠魚的 10 樣東西
| 代號 | 物件 | 英文 |
|---|---|---|
| E-4 | 彩色珊瑚碎片 | `a small piece of pink coral` |
| E-5 | 扇貝 | `a scallop shell` |
| E-6 | 海星 | `an orange starfish` |
| E-7 | 海螺 | `a spiral conch shell` |
| E-8 | 珍珠 | `a glossy pearl in a small open clam` |
| E-9 | 海玻璃 | `a smooth frosted green sea glass pebble` |
| E-10 | 小石片 | `a flat smooth gray skipping stone` |
| E-11 | 漂流木 | `a short smooth piece of driftwood` |
| E-12 | 海草束 | `a small bundle of green seaweed` |
| E-13 | 舊銅鈴 | `a small old brass bell` |

### 第 100 格健忘怪房間
| 代號 | 物件 | 提示詞 |
|---|---|---|
| E-14 | 筆記本（闔上） | `a small chubby notebook with a soft blue cover, the cover is blank, a ribbon bookmark` 中文：圓胖小筆記本、淡藍封面（**封面空白**，字由 App 寫）、有書籤帶 |
| E-15 | 筆記本（翻開） | `the same notebook opened flat, both pages blank` 中文：同一本攤開，兩頁空白 |
| E-16 | 紙卡：弄髒 | `a small square note card drawing: a folded cloth bundle tied with a ribbon, with mud spots` 中文：小方紙卡，畫一個綁緞帶的折疊布包，上面有泥點 |
| E-17 | 紙卡：清洗 | `the same folded bundle in a wash basin with soap bubbles` 中文：同一個布包泡在有泡泡的水盆裡 |
| E-18 | 紙卡：晾乾 | `the same folded bundle hanging on a line with clothespins under a small sun` 中文：同一個布包用衣夾晾在繩上、旁邊小太陽 |
| E-19 | 紙卡：收好 | `the same folded bundle neatly placed with a small sun mark and a wrench with a cross-out line beside it` 中文：同一個布包整齊收好，旁邊有小太陽記號和一個**被斜線劃掉的扳手**（不要畫月亮） |
| E-20 | 收納箱：星星 | `a cute wooden storage box with a lid closed, a star symbol carved on the front` |
| E-21 | 收納箱：月亮 | 同 E-20，`a crescent moon symbol` |
| E-22 | 收納箱：貝殼 | 同 E-20，`a seashell symbol` |
| E-23 | 收納箱：打開 | 同 E-20 的箱子，`lid open, empty inside` 中文：同款箱子、蓋子打開、裡面是空的 |
| E-24 | 證據：扳手 | `a small cute wrench and screwdriver` 中文：小扳手和起子（放在星星箱旁） |
| E-25 | 小被被 | `a soft cream-colored small blanket, slightly folded, with one big yellow star patch sewn on, cozy and fluffy` 中文：奶油色柔軟小被被、微微折起、縫著一個黃色大星星布章（要和 C-7 一致） |
| E-26 | 濕痕 | `a small puddle of water with a few droplets` 中文：一小灘水和幾滴水珠（放在貝殼箱旁） |

> E-16～E-19 四張要畫**同一個布包**，不要畫出被子的全貌，也不要數字、時鐘或能拼起來的邊緣。E-20～E-23 是同一款箱子，只換符號；要和神祕寶箱明顯不同（樸素木頭色）。

### 水島道具（2026-11-16 新增）
| 代號 | 物件 | 提示詞 |
|---|---|---|
| E-30 | 潛水艇（寶物商店道具） | `a cute small round yellow submarine with a big round porthole window, a little periscope, a tiny propeller at the back, rivets, friendly toy-like look` 中文：可愛的圓胖小黃潛水艇，大圓窗、小潛望鏡、後面小螺旋槳、鉚釘，像玩具一樣友善。和其他道具圖（防護罩、傳送門）同樣大小與畫風 |

> 「小白鯨載我前進」的按鈕和動畫沿用 C-2 小白鯨，不另做圖。

> ✅ 2026-11-17 水島通關成就徽章已收（家長提供：沉船＋小白鯨＋星星旗，綠框）→ `images/badges/badge_waterClear1.webp`，用在成就和水島通關卡片。

### 第二版（選做）

> ✅ 2026-11-17 已收（Gemini）：E-27 呼喚貝殼 → `images/water/items/call_shell.webp`（愛心光暈改成柔和漸淡）；E-28 愛心泡泡 → `images/water/items/heart_bubble.webp`。2026-11-17 已做成「呼喚貝殼」：第 34 格餵完小白鯨後送的，水島道具列點了小白鯨游出來冒愛心泡泡，不限次數、不給獎勵。

| E-27 | 小白鯨呼喚貝殼 | `a pearly pink and white spiral seashell with a tiny heart-shaped sparkle` |
| E-28 | 愛心泡泡 | `a single translucent bubble with a small pink heart inside` |
| E-29 | 地圖格的牛奶瓶標記 | 可直接用 E-1，不另做 |

---

## F. 過場動畫（5 張，直式 3:4，至少 1080×1440，畫滿不要白底）

> ✅ 2026-11-17 F 節 5 張已收（Codex）→ `images/water/trip/f1_exit／f2_out／f3_beach／f4_return／f5_depart.webp`（縮成 810×1080，和木島滑梯同尺寸）。開場：木島滑梯第 5 張 → F-1 → F-2 → F-3＋歡迎卡片；通關：F-4；離開水島：F-5（先看 1.8 秒全圖，卡片再出現）。

和木島結局的樹洞滑梯（`images/wood/ending/tunnel1～5.webp`，App 裡是 810×1080）同一系列。**第一人稱**：不要畫孩子的臉、手、腳或身體。

| 代號 | 畫面 | 提示詞 |
|---|---|---|
| F-1（K2） | 出口亮起 | `First-person view sliding forward down the same wooden root-tunnel slide as the reference image, same wood grain, low rails and vanishing point at the center slightly above middle; the bright blue-white light ahead is now a clearly visible daylight exit opening, colors warming up, a hint of sea breeze` 中文：同一條樹根滑梯往前滑（請附上木島滑梯第 5 張當參考，木紋、扶手、消失點都一樣），前方藍白光變成看得到的日光出口 |
| F-2（K3） | 滑出樹洞 | `First-person view shooting out of the round root-tunnel exit on the shore, white sand right ahead and a wide turquoise sea and horizon, a few soft clouds, sense of speed` 中文：從海邊的樹根洞口衝出來，前方是白沙、水藍大海和海平線，有速度感 |
| F-3（K4） | 落在沙灘 | `First-person view resting on soft white sand at a sunny beach, calm pale-blue shallow water and colorful round coral ahead, small shells and a little crab, calm and welcoming, empty sky area at the top for a title` 中文：停在陽光白沙灘上，前方是淺藍海水和彩色圓潤珊瑚、小貝殼、小螃蟹；上方天空留空給 App 寫「歡迎來到水島！」 |
| F-4 | 白鯨送回岸 | `First-person view riding on the back of a cute baby beluga whale (only the top of its smooth white head and back visible at the bottom of the frame), gliding on the sea surface toward the sunny coral beach, splashes and bubbles, joyful` 中文：第一人稱騎在小白鯨背上（畫面下方只看到白鯨圓滑的頭頂和背），在海面上滑向陽光珊瑚沙灘，水花和泡泡 |
| F-5 | 白鯨出發去下一座島（通用） | 同 F-4 構圖，`gliding out to the open sea toward the bright horizon at sunrise, a faint misty island silhouette far away whose shape cannot be recognized, sparkling water, sense of a new journey` 中文：同 F-4，但白鯨往開闊大海和明亮的海平線游去，遠方只有一個**看不出是哪座島**的朦朧島影。**不要畫出金島或任何特定島嶼的特徵**——現在用來回金島，火島做好後同一張圖直接改成去火島（目的地由 App 的文字卡片說明） |

---

## H. 水島結尾銜接火島（2026-11-18 新增，Gemini）

> ✅ 2026-11-18 已收：C-9a～c 火島居民 → `images/water/ending/fire_folk_faint／fire_folk_panic／fire_folk_calm.webp`；E-32 破舊小船選黏土風那張（和居民同框那張右半）→ `wreck_boat.webp`。⏳ F-6 划船去火島等火島開放前再畫。

劇情：小白鯨送回珊瑚淺灘 → 沙灘上有破舊小船和昏倒的火島居民 → 居民醒來說火山冒黑煙、轟隆巨響 → 漁夫答應划船載孩子去火島。**不要畫出生氣怪或火箭**（之後火島才揭曉）。
到貨後填進 `js/app.js` 的 `FIRE_FOLK`、`WATER_END_ART`。

### C-9 火島居民（3 張，同一個角色，白底、正方形 1024×1024）
角色設定（家長定）：2.5D Q 版黏土玩具風、可愛圓潤；火島普通男性居民、年輕成年人；矮胖、頭大身小、四肢短圓；圓臉、大眼睛、圓鼻子；深棕色短髮、髮尾微翹；焦橘色短袖工作服、深棕色短褲、深棕色工作短靴；頭戴護目鏡、腰間掛小布袋；衣服胸前有簡單火焰圖騰；臉頰沾煤灰、衣角微焦、頭髮凌亂；善良、膽小、容易緊張；配色焦橘、磚紅、深棕、土黃。

共用：`A cute chubby young man from a volcano island, 2.5D chibi clay toy style, round soft shapes, big head small body, short round limbs, round face, big eyes, round nose, short dark brown hair with slightly flipped tips (messy), burnt-orange short-sleeve work shirt with a simple flame emblem on the chest, dark brown shorts, dark brown work boots, goggles on his head, a small cloth pouch on his belt, soot smudges on his cheeks, slightly scorched shirt hem, color palette burnt orange, brick red, dark brown, ochre, plain white background, full body, no text`

| 代號 | 表情 | 加在共用後面 |
|---|---|---|
| C-9a | 昏倒（檔名 `fire_folk_faint.webp`） | `lying on his back on the ground, eyes closed with swirly dizzy look, arms spread, exhausted, horizontal lying pose` |
| C-9b | 醒來驚慌（`fire_folk_panic.webp`） | `sitting up, wide frightened eyes, sweat drops, hands raised nervously, worried open mouth` |
| C-9c | 恢復平靜（`fire_folk_calm.webp`） | `standing, relieved gentle smile but still a little shy, hands holding his cloth pouch` |

C-9b、C-9c 請在同一個對話裡接著 C-9a 改，保持同一個角色。

### E-32 破舊小船（白底、正方形）
`a small old wooden rowboat, weathered and a bit broken, a crack on the side, one oar, a few scorch marks, beached on its side, 2.5D clay toy style, plain white background, no people, no text`（檔名 `wreck_boat.webp`）

### F-6 漁夫划船前往火島（直式 3:4，至少 1080×1440，畫滿不要白底）
`First-person view sitting in a small wooden rowboat (only the front of the boat and the old fisherman's back rowing visible at the bottom), sailing across a calm turquoise sea toward a distant volcano island on the horizon, thick dark smoke rising from the volcano crater, warm orange sky, sense of adventure and a little mystery, 2.5D clay toy style, same series as the other transition images, no text, no monster, no rocket`（檔名 `to_fire.webp`）

## G. 成就徽章（選做，1 張）

`waterClear1`「水島通關」：圓形徽章，比照木島通關徽章的外框與畫風（Claude 可提供參考），中間是 `a cute baby beluga and a sunken ship with a star blanket waving like a flag`，水藍＋金色。1024×1024 白底。

---

## 驗收時 Claude 會檢查
- 地圖：101 格都在路面中央、格距 64～76px、上方 70px 沒有高物件、NPC 空地沒有擋路、安全區乾淨、入口出口位置合理。
- 不能有文字、格子、角色、事件圖示出現在地圖背景。
- 角色：同一角色多張時比例一致；上半身可以裁成半身大圖。
- 小圖：輪廓清楚、縮小看得懂；同一組（紙卡、箱子）風格一致。
- 健忘怪的故事線索：備忘圖的星星不指向任何箱子；瓶底和瓶架對得上；紙卡不露出被子全貌。
