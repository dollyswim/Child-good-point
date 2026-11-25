# 專案現況盤點（CURRENT_STATUS）

> 盤點日期：2026-11-24｜App 版本 `2026.11.25-261`｜Service Worker 快取 `cgp-shell-v271`（圖片快取 `cgp-img-v1`）
> 依**實際程式碼**整理（主要來源：`js/store.js`、`js/game.js`、`js/app.js`、`js/water.js`、`js/gear-house.js`、`js/lava.js`、`sw.js`）。
> 標 **⚠️ 與規格不同** 的地方，是和 `PROJECT_SPEC.md` 不一致之處（多數是家長後來決定的調整）。
> 本次只整理，未修改任何程式或檔案。

---

## 1. 專案形式

- **形式**：純前端網頁 **PWA**（不是原生 App）。
  - `index.html` 單頁、`manifest.webmanifest`（可加到主畫面）、`sw.js` Service Worker 離線快取。
  - 部署在 GitHub Pages：https://dollyswim.github.io/Child-good-point/
- **技術**：原生 HTML／CSS／JavaScript（ES5 風格、IIFE 模組），**沒有框架、沒有建置步驟、沒有執行期套件**。
  - 字型：jf open 粉圓 2.0（`fonts/`，含常用字小包 `jf-openhuninn-app.woff2`，由 `tools/font_subset.py` 產生）。
  - 圖片：WebP（`images/`）。
  - 安全：`index.html` 有 Content-Security-Policy，只允許同源腳本。
- **開發／測試工具**（`package.json` 無 dependencies）：
  - 單元測試：Node 內建 `node --test tests/store.test.js`（目前 166 項）。
  - 端對端：Playwright（環境預裝）`node tests/e2e.js`，模擬手機尺寸。
  - 地圖座標轉換：`tools/gen_board*.py`（Python）。
- **資料儲存**：
  - 主資料：**localStorage** 鍵 `cgp-data`（整份 JSON）。
  - 自動備份：**IndexedDB**（資料庫 `cgp-snapshots`），每天第一次開啟存一份、保留 7 天，還原前也會另存；沒有 IndexedDB 時退回 localStorage（`cgp-data-snapshots`）。
  - 介面小設定：localStorage（`cgp-ui-current` 目前孩子、音效開關、水島試玩 `cgp-water-trial`、字型載入旗標）。
  - **沒有伺服器、沒有帳號、不同裝置之間不同步**（只能靠 JSON 匯出入）。

---

## 2. 已完成的功能

### Phase 1｜生活積分核心 — ✅ 已完成
- ✅ 多孩子新增／修改／刪除（名稱、冒險夥伴頭像、代表色、起始點數）。
- ✅ 首頁孩子卡片（總點數、今日淨得分），點卡片進入孩子頁。
- ✅ 孩子頁大按鈕加減分、今日任務、最近紀錄；點了立即記錄。
- ✅ 撤銷上一筆。
- ✅ 計分規則設定頁（加分、扣分、任務、獎勵）。
- ✅ 共同／專屬任務（`childIds: 'all' | [id]`），完成狀態各自獨立。
- ✅ 任務頻率：每日、平日、週末、指定星期、每週 N 次、單次。
- ✅ 今日淨得分、起始點數（不算今日）。
- ✅ 現實獎勵兌換。
- ✅ 本機儲存、JSON 匯出／匯入。
- ⚠️ 與規格不同：現實獎勵可設定用「生活點數」或「能量星星」兌換（`reward.currency`）。
- ⚠️ 與規格不同：家長功能（設定、匯入、上限調整等）需要**家長密碼**。

### Phase 2｜冒險解鎖與能量星星 — ✅ 已完成
- ✅ 今日淨得分 > 0 才能進入冒險。
- ✅ 能量星星 = `ceil(今日淨得分 / 5)`，同一天只結算一次，各孩子獨立。
- ⚠️ 與規格不同：改成「**出發今日冒險**」時結算；出發後再加的分數會併入（`latePoints`），家長可「重新結算今天」只補差額。
- ⚠️ 與規格不同：加分項目可設定「另外給星星」（`item.stars`，記錄時立即入帳，上限 20）；記錄當下的額外星星選擇列已於 2026-11-09 拿掉，資料欄位保留。

### Phase 3｜最小可玩金島 — ✅ 已完成（並已擴充）
- ✅ 金島 **100 格**（規格要求先做 30 格、可擴充）：4 區長地圖。
- ✅ 逐格跳動移動。
- ✅ 能量星星商店：6 面骰 5 星、12 面骰 10 星、溜冰鞋 4 星（前進 3 格），和規格一致。
- ✅ 每日擲骰上限 3 次、背包隔天保留。
- ✅ 格子類型：一般、寶箱、機會、命運、小遊戲、起點、終點。
- ✅ 寶箱 1～3 星或道具、機會卡全部正向。
- ⚠️ 與規格不同：棋子直接用 8 種正式冒險夥伴（不是 2～3 種測試棋子）。

### Phase 4｜事件、小遊戲與 5 分鐘回合 — ✅ 已完成
- ✅ 小遊戲「抓住星星」約 10 秒，每天 1 次。
- ✅ 機會卡（礦車前進 2 格、礦石 +2 星、6 面骰、小寶箱 1～3 星、溜冰鞋）。
- ✅ 命運卡：特殊任務（家務／讚美／幫忙大師，3 天內完成 +20 點）、後退 1～2 格、路障。
- ✅ 溢出 → 神祕寶箱（出現在前方附近，提示「附近似乎藏著神祕寶物……」）。
- ✅ 今日小結。
- ⚠️ 與規格不同：
  - 機會卡礦車是前進 **2** 格（規格寫 3 格）。
  - 命運卡有「後退 1～2 格」（規格寫不要大量倒退；目前為小量後退，可用防護罩擋）。
  - 小遊戲獎勵：每抓 3 顆換 1 星，最多 15 星。

### Phase 5｜完整道具＋8 種角色 — 🟡 部分完成
- ✅ 8 種原創冒險夥伴（圓耳獸、長耳獸、小角龍獸、小翼獸、水滴獸、葉芽獸、火苗獸、石球獸），每個孩子各自選擇。
- ✅ 角色動畫：跳格、開寶箱、驚訝、開心（`pawn-acting`）。
- ✅ 道具：飛行翼（20 格）、防護罩、傳送門、黃金鑰匙、寶物磁鐵（前後 5 格）、神奇骰子、好運金牌。
- ✅ 神祕寶箱掉落：溜冰鞋、神奇骰子、好運金牌、防護罩、飛行翼、傳送門。
- ❌ 未做：**呼叫專機**（`AIRPLANE_READY = false`，神祕寶箱暫時不開出這個道具）。
- ⚠️ 與規格不同：道具價格與購買方式大幅調整（見第 3 節）。飛行翼、防護罩、傳送門等改在「**寶物商店**」用**生活點數**兌換，而不是能量星星；黃金鑰匙 10 星（規格 30 星）。

### Phase 6｜正式五行島世界 — 🟡 部分完成（3／5 座）
- ✅ 金島（100 格）、木島（100 格）、水島（100 格，4 個獨立場景）已開放。
- ✅ 島嶼環狀順序已定義：金 → 木 → 水 → 火 → 土 → 金（未開放的島自動跳過）。
- ✅ 每島獨立的機會／命運文字、NPC 導遊、劇情任務、小遊戲、通關動畫與成就。
- ✅ 第 100 格通關：動畫、通關獎勵、前往下一座島。
- 🟡 火島：只有小遊戲《熔岩跳跳路》與劇情規格、地圖需求（地圖尚未交件、`BOARDS` 還沒有 fire）。
- ❌ 土島：未做（只有島嶼插圖 `images/islands/earth.webp`）。
- 🟡 效能：圖片分兩層快取、各島大圖按需下載與預先下載；尚未做系統性的 Android 效能報告。

### PROJECT_SPEC.md 沒有、後來新增的功能
- **生活點數**：本週挑戰（`challenges`）、等級（依累積賺到的加分）、頭銜／每週目標、CSV 規則匯入（`js/rules-csv.js`）、記分總覽報表（`js/report.js`）、封存舊紀錄（數字結轉不變）、補登紀錄、點數里程碑（累計 +500 給黃金鑰匙、+1000 給神祕寶箱）。
- **家長工具**：家長密碼、冒險每日上限設定（0～10）、重設今天次數、神諭祝福（家長贈送寶箱／重骰券／再來 3 次／幸運星）、重新結算今天、備份提醒（滿 7 天）、自動備份與還原、水島試玩模式。
- **冒險**：寶物商店（生活點數兌換、每週 3 件、同款持有上限）、命運重骰券、再來 3 次、成就系統與徽章（星光成就劇場）、新手導覽／冒險教學／新手禮、任務重置詢問、家長預覽連結（`?preview=`）、小遊戲試玩網址（`#minigame-test`、`#leaf-test`、`#fish-test`、`#gear-test`、`#lava-test`）。
- **各島劇情任務**：金島 4 個（含第 53 格齒輪小屋「吃飯好行為大挑戰」）、木島 4 個（森林派對）、水島 6 個關卡（走到就停）。
- **島嶼過場**：金→木飛行員阿翔專機、木→水樹洞溜滑梯、水→（火島未開放時）小白鯨送回金島。
- **小遊戲**：落葉找松果（木島）、珊瑚灣撈魚趣（水島）、熔岩跳跳路三關（火島，已完成但火島未開放）。

---

## 3. 點數與遊戲經濟的實際數值

### 好習慣升級（2026-11-24 新增，版本 2026.11.25-261）
- 預設連續 4 週、每週完成率 ≥ 85%（每個項目可改週數、完成率、一般加分每週次數，或設定不升級）；家長決定才升級。
- 升級：免鑰匙神祕寶箱（每項目一次）＋「○○高手」徽章＋升級典禮；之後「今天我也有做到」不加分、不影響星星。
- 好習慣稱號 1／3／6／10／15：銀刃衛士、幻影遊俠、破曉劍聖、聖龍騎兵、星辰統帥。細節見 `docs/HANDOFF.md`。

### 家庭點數尺度（2026-11-24 新增，版本 2026.11.25-261）
- 設定 → 點數尺度（家長密碼）：「表現不錯的一天大約拿幾分」`settings.typicalDay`，預設 200；快速選項小額制 20、中額制 50、大額制 200，或自訂。倍率＝typicalDay ÷ 200。
- 換算函式 `scalePoints(x)`：四捨五入、最少 1（`js/store.js`）。星星 `ceil(淨得分 ÷ max(1, 5 × 倍率))`。
- 會換算：能量星星結算、寶物價格、累計得分里程碑（+500 鑰匙／+1000 神祕寶箱）、等級（每 1000 分）、特殊任務 +20、分數成就「獲得 N 分」（尺度不是 200 時用空白金幣 `badge_earn_blank.webp`＋程式寫的數字）、相關說明文字。
- 不換算：家長自己設的加扣分、任務、獎勵、挑戰；星星商店與其他星星數值；每日上限。新家庭第一次選尺度時，沒改過的範例項目一併換算。
- 中途修改只影響之後：里程碑從當下累計得分重新起算（不補發）；等級從當下進度接著算（不暴衝、不降級）；已拿到的分數成就保留，當下已達標的靜默標記；已結算星星、已兌換寶物不回溯。

### 生活點數 → 能量星星
- 公式：`starsForNet(net) = net > 0 ? Math.ceil(net / 5) : 0`（大額制 200；其他尺度見上方 `starsForNetAt`），位置 **`js/store.js` 約第 1513 行**。
- 結算：「出發今日冒險」時以今日淨得分計算；出發後新增的加分併入（`latePoints`）補發差額。
- 加分項目的額外星星（`item.stars`，上限 20）記錄時立即入帳。

### 能量星星商店（`js/game.js` 的 `SHOP`）
| 道具 | 價格 | 效果 |
|---|---|---|
| 6 面骰 | 5 星 | 擲 1～6 |
| 12 面骰 | 10 星 | 擲 1～12 |
| 溜冰鞋 | 4 星 | 前進 3 格，不算擲骰 |
| 黃金鑰匙 | 10 星 | 打開地圖撿到的神祕寶箱（⚠️ 規格 30 星） |
| 寶物磁鐵 | 10 星 | 吸取前後 5 格內寶箱 |

### 寶物商店（生活點數兌換，`js/game.js` 的 `TREASURES`；每週最多 3 件、同款最多持有 2 件）
| 寶物 | 價格（生活點數） | 規格原訂（能量星星） |
|---|---|---|
| 溜冰鞋 | 10 | — |
| 防護罩 | 10 | ⚠️ 20 星 |
| 神奇骰子 | 10 | — |
| 好運金牌 | 100 | — |
| 飛行翼 | 100 | ⚠️ 24 星 |
| 星星呼喚（額外一局抓星星） | 50 | — |
| 松果躲躲（額外一局落葉） | 50 | — |
| 傳送門 | 200 | ⚠️ 30 星 |
| 潛水艇（只限水島，持有上限 3） | 200 | — |

### 每日上限（`js/store.js` 的 `DEFAULT_LIMITS`）
| 項目 | 預設 |
|---|---|
| 擲骰 | 3 |
| 小遊戲 | 1 |
| 前進道具（溜冰鞋＋飛行翼合計） | 5 |
| 傳送門 | 1 |
| 神奇骰子 | 1 |
| 星星呼喚 | 1 |
| 松果躲躲 | 1 |
| 小白鯨（水島） | 3 |
| 潛水艇（水島） | 1 |
- 「再來 3 次」祝福可讓當天額外 +3 擲骰、+3 小遊戲（`bonusQuota`）。
- 「測試」孩子（`child.tester`）所有上限 999。

### 地圖前進怎麼決定
- 6 面骰、12 面骰、神奇骰子（12 面，不占每日次數）擲出點數，逐格前進；擲骰分兩步（`prepareRoll` → `commitRoll`），中間可用命運重骰券。
- 溜冰鞋 3 格、飛行翼 20 格、傳送門指定格（不能跳過未完成任務格；水島不能用）、小白鯨（水島）、潛水艇（水島第 25 格後）。
- 機會卡礦車 +2 格、命運卡後退 1～2 格（防護罩可擋）。
- 水島關卡格、金島第 53 格齒輪小屋等「走到就停」的格會截斷剩餘步數。

### 其他數值
- 一般寶箱（2026-11-24 調整）：55% 得 3～8 星；溜冰鞋、6 面骰、12 面骰各 15%。好運金牌：下一個寶箱升級成免鑰匙神祕寶箱、機會格 2 次。星星商店另賣命運重骰券 ⭐15、神奇骰子 ⭐50（每週 2；寶物商店不再賣）、飛行翼 ⭐150（每週 1）。
- 神祕寶箱：溜冰鞋、神奇骰子、好運金牌、防護罩各 18，飛行翼、傳送門各 12（呼叫專機 4，目前不開出）。
- 小遊戲（2026-11-25 調降）：抓住星星每 3 顆 1 星；落葉找松果每 2 顆 1 星；撈魚每 3 條 1 星（至少 1）；三者上限都 8。熔岩跳跳路依關卡結果 3／5／5／7／7／8 星。
- 劇情任務：第一次完成各 ⭐3；齒輪小屋另有神祕寶箱（一次）與一般寶箱（每天 1 個）。
- 通關：第一次＝神祕寶箱（免鑰匙，水島 3 個、其他 1 個）；之後每次 ⭐10。
- 命運卡特殊任務完成 +20 生活點數。

### 寫死還是可設定
- **家長可在設定調整**：每日上限（上表 9 項，0～10）、加扣分項目與點數、任務、獎勵（點數／星星）、挑戰。
- **家庭點數尺度**：星星除數、寶物價格、里程碑、等級、特殊任務點數跟著 `typicalDay` 換算（見上）。
- **寫死在程式**：商店價格、寶箱機率、機會／命運卡內容與機率、小遊戲換算、通關與任務獎勵、每週寶物件數。⚠️ 規格沒有要求可設定，但目前若要調整需改程式。

---

## 4. 島嶼與地圖

- **目前開放 3 座島**，每座 **101 個格位（第 0 格起點＋第 1～100 格）**，第 100 格為全島終點：
  | 島 | 地圖形式 | 終點 | 程式／資料 |
  |---|---|---|---|
  | 金島 | 一張長地圖（1080×5400），4 區由下往上 | 金冠城堡 | `js/board-gold.js`～`board-gold-04.js`，`data/gold_region0N_tiles.json` |
  | 木島 | 一張長地圖，4 區 | 精靈巨樹 | `js/board-wood.js`，`data/wood_island_coordinates_0_100.json` |
  | 水島 | 4 張獨立場景（各 1080×1350） | 萊莫的沉船 | `js/board-water.js`，`data/water/water_scene0N_tiles_final.json` |
  - 火島：資料尚未建立；土島：未做。
- **資料結構範例**（`js/game.js` 組合後的金島 board）：
  ```json
  {
    "id": "gold", "name": "金島", "goalName": "金冠城堡", "totalTiles": 100,
    "world": { "width": 1080, "height": 5400 },
    "regions": [{ "id": "gold-01", "name": "黃金沙灘與初級礦場", "from": 1, "to": 30, "stripY": 4050 }],
    "tiles": [
      { "n": 0, "id": "gold-01-start", "regionId": "gold-01", "type": "start", "gx": 482.5, "gy": 5324.6 },
      { "n": 1, "id": "gold-01-001", "regionId": "gold-01", "type": "normal", "gx": 529.2, "gy": 5265 }
    ]
  }
  ```
  - 水島另有 `scenes: true`（一次只顯示一個場景）與 `npcSpots`（NPC 站位）。
  - 格子類型由 `js/game.js` 的 `TYPES`（金、木共用同格號）與 `WATER_TYPES`（水島）決定；座標檔由 `tools/gen_board*.py` 從 JSON 產生，**不要手改產出的 js**。
  - 玩家位置以穩定格子 ID（`tileId`，例如 `gold-01-007`）保存，`pos` 由它推導。
- **走到第 100 格之後**：
  1. 觸發 `_clearIsland`：通關動畫、獎勵、成就。
  2. 下一次移動時 `_startNext`：前往環狀順序中**下一座已開放的島**的起點（原島進度保存在 `p.islands`）；沒有下一座則從原島起點開始新的一輪。
  3. 實際路線：金 → 木（第 100 格旁飛行員阿翔專機，可對話後搭乘）→ 水（樹洞溜滑梯）→ 金（火島未開放，小白鯨送回）。
  4. 回到已做過任務的島起點時，導遊問要不要重置任務。
- **呼叫專機**：❌ 未實作（`AIRPLANE_READY = false`），目的地邏輯尚未決定。現有的「專機」只指金島 → 木島的阿翔劇情過場（`flightReady`／`takeFlight`，目的地＝`nextIsland('gold')`）。
- **傳送門**：目的地由孩子在**本島**點選格子（`useDoor(childId, n)`），限制：
  - 不能超過前方第一個未完成的劇情任務格（`doorLimit`）。
  - 不能傳到終點；水島不能用；每天 1 次。
  - ⚠️ 規格寫「傳送到本島其他位置」一致，但價格與取得方式不同。

---

## 5. 資料格式

主資料 `cgp-data`（`schemaVersion: 1`，載入時由 `migrate()` 補預設值、清掉無效資料）：

- **孩子 `children[]`**：`id, name, avatar`（冒險夥伴代號）`, color, startPoints, title, badge, weeklyGoal, createdAt, tester`。
- **項目 `items[]`**：`id, kind`（bonus／penalty／task）`, name, points`（扣分為負）`, childIds`（'all' 或 id 陣列）`, frequency`（{type, days?, n?}）`, custom, stars, sourceId, createdAt`。
- **獎勵 `rewards[]`**：`id, name, cost, currency`（points／stars）`, createdAt`。
- **紀錄 `records[]`**：`id, childId, type`（bonus／penalty／task／reward）`, refId, name, points, date, stars, starsPaid, starCost, backfill, ts`。
  - 總點數＝起始點數＋所有紀錄點數總和＋封存結轉（不另存總數）。
- **其他生活資料**：`challenges[]`（本週挑戰）、`specialTasks[]`（命運卡特殊任務）、`milestones`（點數里程碑）、`carry`（封存結轉）、`achievements`（{孩子: {成就代號: {date, ts}}}）、`parentPin`（雜湊＋鹽）、`settings.limits`、`flags`（新手導覽等）、`backup`（備份提醒）。
- **冒險 `adventure`**：
  - `settlements[]` 每日星星結算、`ledger[]` 星星帳（星星餘額＝結算總和＋星星帳）。
  - `rolls[]` 擲骰紀錄、`minigames[]`（`game`：leaf／fish／lava、熔岩關卡成績 `lava`）、`bonusQuota[]`、`limitResets[]`、`dayEnds[]`、`mapChests[]`（地圖上的神祕寶箱）、`blessings[]`（神諭祝福）、`itemLog[]`（道具取得與使用）。
  - **`players{孩子id}`（地圖進度與背包）**：
    - 位置：`island, pos, tileId, laps, maxReached, islands`（其他島保存的進度）`, islandClears, goldClears, dayStart, pendingRoll`。
    - 背包 `bag`：`d6, d12, skates, shield, magicDice, luckyMedal, wings, door, airplane, goldenKey, magnet, rerollTicket, bonusPlay, starCall, pineHide, submarine, chest, giftMysteryChest, mysteryChest`。
    - 劇情：`story`（各任務完成日期）`, storyAsk, towerIntro, water`（水島故事進度）`, gearHouse`（齒輪小屋）`, lavaBest, lavaDemo`（熔岩跳跳路）。
    - 其他：`character, medalArmed, looted, stats, starterGift, starterBuy, tutorial`。
- **JSON 備份**（`exportJSON`）：**整份 `cgp-data` 原樣輸出**，外加 `exportedAt`、`app: 'child-good-point'`。包含上面全部生活與冒險資料。
  - ⚠️ 不包含：localStorage 的介面小設定（目前孩子、音效、水島試玩）、IndexedDB 裡的自動備份。
  - 匯入前會自動另存「還原前」備份；匯入時一樣跑 `migrate()`。

---

## 6. 檔案結構

### 根目錄
- `index.html`：單頁入口，依序載入所有 js。
- `sw.js`：Service Worker；`SHELL` 清單離線快取，圖片另有不跟版本走的 `cgp-img-v1`。
- `manifest.webmanifest`、`icons/`：PWA 設定與圖示。
- `package.json`：只有 test／test:e2e／start 指令。
- `PROJECT_SPEC.md`：原始六階段規格；`README.md`：說明；`CLAUDE.md`：給 Claude 的工作規則。

### `js/`
- `store.js`：資料層（生活積分、結算、備份、migrate），不碰畫面。
- `game.js`：冒險規則（商店、道具、格子事件、島嶼、成就、劇情任務、小遊戲數值）。
- `app.js`：所有畫面與互動（約 4,650 行，最大的檔案）。
- `water.js`：水島劇情、任務、撈魚小遊戲（從 app.js 拆出）。
- `gear-house.js`：金島第 53 格齒輪小屋。
- `lava.js`：火島小遊戲熔岩跳跳路。
- `board-gold.js`、`board-gold-02～04.js`、`board-wood.js`、`board-water.js`：地圖座標（由 tools 產生）。
- `rules-csv.js`：CSV 規則匯入；`report.js`：記分總覽統計；`art.js`：插圖路徑。

### 其他資料夾
- `css/style.css`：全部樣式（約 2,750 行）。
- `images/`（約 11MB）：`characters` 冒險夥伴、`items` 道具、`badges` 徽章、`gold`／`wood`／`water`／`fire` 各島圖、`tiles` 格子圖示、`nav`、`plaque` 介面、`flight` 專機過場、`minigame`、`islands` 島嶼入口。
- `data/`：地圖座標原始 JSON。
- `tools/`：地圖座標轉 js、字型小包產生。
- `fonts/`：粉圓字型與授權。
- `tests/`：`store.test.js` 單元、`e2e.js` 端對端、`fixtures/` 測試資料。
- `docs/`：交接（`HANDOFF.md`）、驗收清單、各島與功能計畫（`gold/`、`water/`、`fire/`、`art/`）、美術提示詞、`archive/` 舊美術封存。

### 看起來重複、沒在用或命名混亂（只列出，未處理）
- `data/water/water_island_coordinates_0_100_draftA2.json`：水島草稿座標，程式沒有引用（正式用 `water_scene0N_tiles_final.json`）。
- `tools/gen_board.py` 與 `tools/gen_board_region.py`：功能相近（前者只產生金島第一區），可考慮合併。
- `js/board-gold.js` 與 `js/board-gold-02.js`～`04.js`：第一區檔名沒有 `-01`，命名不一致。
- `images/nav/*2.webp`、`images/plaque/home2.webp`：檔名帶「2」，是換圖時為了讓快取生效改的新檔名；舊名已刪，但「2」意義不明。同類：`technician2`、`platform2`、`bg2`、`time2`、`badge_woodClear1v2`、`shark_v2`、`jelly_v3`、`fire_folk_calm_v2`、`scene01_v2`。
- `images/islands/fire.webp`、`earth.webp`：島嶼入口插圖已存在，但對應的島還沒開放。
- `docs/WOOD_TO_WATER_HANDOFF.md`、`docs/NEW_SESSION_PROMPT.md`、`docs/PHASE4_PLAN.md`：階段性文件，部分內容已被 `HANDOFF.md` 取代。
- `docs/archive/2026-11-art-archive.zip`（約 1.3MB）：舊美術封存，放在 repo 裡。
- `js/app.js` 單檔過大（約 4,650 行），金、木島劇情仍在裡面（水島已拆出）。
- 程式註解與函式名仍有舊稱呼（例如 `goldMax`、`GOLD_CLEAR_STARS` 實際用於所有島）。

---

## 7. 已知問題與待辦

### 已知問題（取自 `docs/HANDOFF.md` 並對照程式）
- **木島「落葉找松果」點落葉沒反應**（2026-11-13 Android 實機回報），模擬手機重現不出來，未解決。
- 星星發出後，再撤銷當天的加分紀錄不會扣回星星。
- 動畫中重新整理：位置與獎勵正確，但當次事件視窗不會再顯示。
- 地圖右下角控制按鈕在某些拖曳位置可能蓋住格子。
- E2E「水島預先下載」那一項偶爾因時間不穩定失敗，重跑會過。
- 金島第 27、28 格外框重疊約 1.2px（看不出來）。

### 尚未實機驗收
- 水島（撈魚難度、6 個任務、結尾過場）。
- 木島（地圖、四個任務、滑梯）、11-14～16 的新功能（派對拖曳、飛行過場、任務重置）。
- 金島齒輪小屋（5 題節奏、獎勵）、熔岩跳跳路（三關手感、洛洛示範、王者路難度）。

### 待辦
- **火島**：等 Codex 交地圖草圖與座標（`docs/fire/CODEX_FIRE_MAP_BRIEF.md`），再依 `docs/fire/FIRE_ISLAND_PLAN.md` 分 7 批施工。
- **土島**：未規劃。
- **呼叫專機**：未實作。
- 家長要手動刪除試玩用的「測試」孩子。
- 已通關木島回到金島的孩子，要再走完金、木島才會到水島（家長決定維持現狀）。
- 可考慮：家長用的「立即重置任務」按鈕（未做）。
