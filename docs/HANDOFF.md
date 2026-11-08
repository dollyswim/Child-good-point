# 親子集點冒險 App：交接文件

> 最後更新：2026-11-07｜App 版本 `2026.11.08-65`｜Service Worker 快取 `cgp-shell-v75`
> 給接手的開發者（或下一個 Claude session）。請先讀 `PROJECT_SPEC.md`，再讀本文件。

---

## 0. 為什麼要交接

- 原本的 repo `lulukiwkiw-prog/Child-good-point` 的 GitHub 帳號無法登入（收不到密碼重設信），已經無法推送；最近一次推送回應為 `repository not found`。
- 專案改到新 repo：**`dollyswim/Child-good-point`**（新建、目前是空的）。
- 舊 repo 的 `main` 停在 PR #7（`c4de1b8`）。其後有 **2 個 commit 只存在 bundle 裡**：
  - `f340e94` 金島第一區：使用無格子正式背景與 JSON 座標建立第 1～30 格
  - `eb51994` 金島第一區：石板改用家長提供的石板圖
- 交付檔案：`child-good-point.bundle`（完整 git 紀錄，32 個 commit）、`child-good-point-gold-region01.zip`（純程式碼備份）。

---

## 1. 接下來要做的工作（依順序）

### A. 搬到新 repo（必做）

1. 以 `dollyswim` 帳號連結 claude.ai 的 GitHub，安裝 Claude GitHub App 並勾選 `dollyswim/Child-good-point`。
2. 開新的 Claude Code session，來源選 `dollyswim/Child-good-point`，上傳 `child-good-point.bundle`。
3. 在新 session 執行：
   ```bash
   git fetch /path/to/child-good-point.bundle 'refs/heads/*:refs/remotes/bundle/*'
   git checkout -B main bundle/claude/parent-child-points-adventure-app-syxbxi
   npm test && npm run test:e2e        # 預期：單元 59 項、E2E 全部通過
   git push -u origin main
   ```
   - **請用 `claude/parent-child-points-adventure-app-syxbxi` 分支**（最新，含交接文件）。bundle 裡的 `refs/heads/main` 是最早的初始 commit，請勿使用；舊 repo 的 main（PR #7，`c4de1b8`）在 `refs/remotes/origin/main`，已包含在最新分支的歷史中。
   - 若 `main` 不是空的，先確認內容再決定是否覆蓋，勿直接強推。
4. 開啟 GitHub Pages：Settings → Pages → Deploy from a branch → `main` / `(root)`。
   新網址：`https://dollyswim.github.io/Child-good-point/`
5. 開 Pages 後在手機實測（見第 6 節驗收清單），特別是金島第一區。

### B. 手機資料搬家（家長操作）

網址改變後 localStorage 不會帶過去：
1. 舊 App（`lulukiwkiw-prog.github.io/Child-good-point`）：⚙️ 設定 → 備份 → **匯出 JSON**。
2. 新網址加到主畫面 → ⚙️ 設定 → 備份 → **📥 完整還原**。
3. 舊版存檔可直接還原：表情符號頭像會自動轉成冒險夥伴；冒險位置的整數格號會自動轉成穩定格子 ID。
4. ⚠️ 舊 repo 若已刪除，舊網址可能打不開，資料仍在舊網址的瀏覽器儲存空間，但必須能開啟舊網址才拿得到。

### C. 舊帳號申訴（家長操作，可平行進行）

已提供中英文申訴信，於 https://support.github.com/contact（Account access）以 `dollyswim` 送出。

### D. 下一個開發階段：Phase 4（進行中：第 1 步命運格＋特殊任務、第 2 步抓住星星已完成）

> 詳細規劃（含家長已決定的規則）見 **`docs/PHASE4_PLAN.md`** 與 **`docs/TREASURE_SHOP_PLAN.md`**（寶物商店、神諭祝福）；以下為原始摘要。

依 `PROJECT_SPEC.md` Phase 4：
1. **「抓住星星」小遊戲**：約 10 秒、星星隨機出現、手指點擊、依表現給少量獎勵；從小遊戲格（第 7、17、24 格，`type: 'minigame'`）觸發。
2. **每日小遊戲 1 次上限**：仿照擲骰紀錄 `data.adventure.rolls`，新增獨立紀錄，避免重新整理重複遊玩。
3. **機會卡擴充**、**命運卡**（小麻煩，禁止大量倒退／清空星星／清空背包）。
4. **溢出機會 → 神秘寶箱**：今日骰子 3/3 或小遊戲 1/1 時，事件再給的使用機會改成神秘寶箱。目前寶箱與機會格仍會直接給骰子，需加入轉換。
5. **神秘寶箱**：下次冒險出現在角色前方 2～8 格，提示「附近似乎藏著神秘寶物……」。
6. **回合結束結算畫面**：今日走了幾格、得到的道具與星星、神秘寶箱提示。

開始前建議先用選擇題向家長確認：小遊戲獎勵數量、命運卡內容、神秘寶箱內容、結算畫面觸發時機。

### E. 待補美術（家長以 AI 繪圖製作，提示詞在 `docs/art-prompts.md`）

| 優先 | 項目 | 目前 |
|---|---|---|
| ✅ | 6 面骰、12 面骰（正式版）、溜冰鞋圖示 | `images/items/`（白底圖＋白色圖示框，contain） |
| ✅ | 格子事件圖示：起點旗、寶箱、機會、小遊戲、終點旗 | `images/tiles/`（192px WebP，白色圓角圖示框浮在石板上；角色所在格 `.here` 時圖示縮小移到右上角）。第 30 格用礦場木門 `door.webp`，終點旗 `finish.webp` 保留給全島終點 |
| ✅ | 能量星星圖示 | `images/items/star.webp`，以 `mix-blend-mode: multiply` 顯示在淺色底（星星卡、地圖 HUD、商店餘額、結算摘要）；句子、提示訊息、商店橘色價格按鈕仍用 ⭐ 文字 |
| ✅ | 五島入口插圖（冒險大廳地圖關卡卡） | 金島 `images/gold-island.*`；木／水／火／土島 `images/islands/<wood|water|fire|earth>.*`，依 `players[id].island` 自動切換（`js/app.js` 的 `ISLANDS`）。木、火、土島原圖右下角的淡浮水印已修除（反算半透明白框＋周圍紋理補圖）；換圖時同檔名覆蓋並升 `sw.js` 快取版本 |
| — | 「抓住星星」小遊戲素材 | Phase 4 需要 |

家長提供的圖通常需要：去背（若非透明）、裁切、統一尺寸、壓縮成 WebP、加入 `sw.js` 快取清單。

---

## 2. 目前完成的功能

| 階段 | 內容 | 狀態 |
|---|---|---|
| Phase 1 | 多孩子、首頁、孩子計分頁、撤銷、規則設定、共同／專屬任務、任務頻率、今日淨得分、起始點數、現實獎勵、本機儲存、JSON 備份還原 | ✅ |
| Phase 1 延伸 | 加分扣分搜尋＋分數篩選、CSV 規則表匯入（UTF-8／Big5，依規則ID更新）、自填點數、額外能量星星、記分總覽（日／週／月、排行、完成率、更正、補登）、「任務」改為加分上的「📋 每日任務」標記 | ✅ |
| 介面改版 | 冒險島風格、底部導覽列、頭銜＋等級（起始點數＋累計得分，每 1000 分升 1 級，Lv.1＝0～999；兌換不影響）、每週目標、本週挑戰、兌換頁 | ✅ |
| Phase 2 | 今日淨得分 > 0 解鎖、進入冒險時結算 `ceil(淨得分/5)`＋額外星星、一天一次、冒險大廳 | ✅ |
| Phase 3 | 星星商店、背包、每日 3 次骰子、逐格移動、寶箱／機會／小遊戲占位格、8 種冒險夥伴（家長原創） | ✅ |
| 金島 100 格 | 長地圖四區（黃金礦港、水晶礦谷、齒輪工坊、金冠城堡）全部開放，穩定格子 ID、第 100 格全島終點與通關慶祝 | ✅ |
| Phase 4 | 命運格與特殊任務、小遊戲「抓住星星」、寶物商店（10 種道具）、神秘寶箱＋黃金鑰匙＋寶物磁鐵、里程碑、媽媽加碼（神諭祝福） | ✅ |
| Phase 5 | 結束今日冒險＋今日小結、成就 22 項、家長密碼、自動備份與備份提醒、重新結算今天 | ✅ |
| 待做 | 成就徽章正式圖、能源主塔與技師（等 Codex）；木島（規劃 `docs/art/WOOD_ISLAND_PLAN.md`，等 Codex 全島配置草圖）；劇情與角色動畫；封存舊紀錄 | ⬜ |

新網址 https://dollyswim.github.io/Child-good-point/ 為正式版，`main` 推送後自動更新。

---

## 3. 技術架構

- 純 HTML／CSS／JS 的 PWA，不需建置。`index.html` 直接開啟即可；`npm start` 起本機伺服器。
- 資料存在 `localStorage` 鍵 `cgp-data`；`schemaVersion: 1`，新欄位都在 `migrate()` 補預設值（不需升版）。

| 檔案 | 職責 |
|---|---|
| `js/store.js` | 資料層：孩子、規則、紀錄、獎勵、挑戰、等級、每週目標、能量星星結算、遷移、匯入匯出 |
| `js/rules-csv.js` | CSV 規則表解析與轉換 |
| `js/report.js` | 記分總覽統計（期間、合計、排行、完成率） |
| `js/board-gold.js` | **自動產生**：金島第一區 30 格座標。改座標請改 `data/gold_region01_tiles.json` 後執行 `python3 tools/gen_board.py data/gold_region01_tiles.json js/board-gold.js` |
| `js/game.js` | 冒險邏輯：區域、格子、商店、擲骰、溜冰鞋、停格事件、角色（擴充 `Store.prototype`） |
| `js/art.js` | 插圖 `<img>` 片段（吉祥物、寶箱、漂浮城堡） |
| `js/app.js` | 所有畫面、路由、對話框、地圖鏡頭（拖曳／縮放／跟隨） |
| `css/style.css` | 樣式；後段為依序追加的主題與覆寫，修改時注意後面的規則會覆蓋前面 |
| `sw.js` | 離線快取（網路優先＋`cache: 'no-cache'` 驗證）；**新增圖片或 JS 時要加入 `SHELL` 並升 `CACHE` 版本** |
| `tests/store.test.js` | 單元測試（`npm test`） |
| `tests/e2e.js` | Playwright 手機尺寸 E2E（`npm run test:e2e`），含 360／390／430px 地圖檢查 |

### 金島長地圖（四區全部開放：第 1～100 格）
- 地圖改為一條長地圖：總覽座標 1080×5400（左上原點），四張 1080×1350 背景由上到下為第四、三、二、一區（`REGIONS[].stripY` = 0、1350、2700、4050）。格子帶 `gx、gy`（總覽座標）與 `x、y`（所在背景圖內 0～1）；第一區換算 `gy = 4050 + y × 1350`，格子 ID 與存檔不變。
- 未開放區域以雲霧＋「即將開放」遮住；最小縮放＝寬度填滿畫面。
- 第二區資料 `data/gold_region02_tiles.json` → `tools/gen_board02.py` → `js/board-gold-02.js`（座標暫用 Codex 草圖 v2；類型已排好，見 `docs/art/gold_region02_layout_preview.png`）。
- **2026-11-07 第二區（水晶礦谷）已上線**：Codex 核定版 v3（`region01` 與 `region02` 必須成對使用，第一區上方 320px 已為接縫修整）。`REGION02_OPEN = true`；第 30 格變一般格、第 55 格為邊界，「回起點下一輪」在目前最後一格（現為第 80 格）。任意門可在整座島已開放的格子間傳送。
- 背景用 WebP 品質 92（約 400KB／張）；接縫處誤差與整張圖相同，看不出接線。
- **2026-11-07 第三區（齒輪工坊）已上線**：Codex 檢視版 v1（`region02` 上方 320px 再修整、與 `region03` 成對使用；320px 以下與 v3 完全相同）。第 56～57 格在水晶礦谷圖最上方，第 58～80 格在齒輪工坊。能源主塔空地在第三區 (850, 190)。
- **2026-11-07 第四區（金冠城堡）已上線，全島 100 格開放**：Codex 金島四區整合交件 v1（`docs/art/CODEX_GOLD_REGION04_HANDOFF.md`）。`region03` 上方 320px 再修整、與 `region04` 成對使用（320px 以下與檢視版 v1 完全相同；`region01`、`region02` 未變）。第 81 格在齒輪工坊圖頂端 (680, 1382)，第 82～100 格在城堡圖；第 100 格為全島終點，城堡門前 (540, 520)，門前留 300×200 慶祝空地（x 390～690、y 450～650）。格子類型：寶箱 85、91、97；機會 83、89、95；命運 87、93；小遊戲 90、99；其餘普通。全島座標合併檔 `docs/art/gold_island_coordinates_1_100.json`、總覽 `docs/art/gold_island_overview.jpg`。
- 開放區數由 `js/game.js` 的 `OPEN_REGIONS` 控制（目前 4＝全島）；只有最後開放區域的最後一格是邊界，前面的邊界格自動改為一般格。各區資料用 `tools/gen_board_region.py` 由 `data/gold_regionNN_tiles.json` 產生 `js/board-gold-NN.js`。
- 全島開放後沒有區域邊界格（圖例改顯示「全島終點」旗）；區域邊界規則仍保留，單元測試以 `buildGold(3)` 模擬。
- 第 100 格門前慶祝：程式在慶祝空地放煙火彩帶約 2 秒（`mapFireworks()`），再顯示全螢幕恭喜畫面。
- 等美術：能源主塔（off／on）與技師，規格 `docs/art/CODEX_GOLD_TOWER_BRIEF.md`；家長決定走過第 80 格後通電、技師點了說一句話。右側管線維持靜態。

### 近期介面調整
- 冒險大廳簡化：移除背包區與四個快速入口（與底部導覽重複）；結算紀錄放進綠底「今日已結算」卡內，點了才展開。背包道具（含寶箱開箱、黃金鑰匙）統一在地圖下方的「🎒 背包道具」列。
- 星光成就劇場（2026-11-07）：新成就不再用綠色提示，改為全螢幕演出（`showAchTheater()`）：背景漸暗、金色光柱、主徽章彈跳登場、星星彩帶愛心、Web Audio 合成音效（音效開關記在 `localStorage` 的 `cgp-ach-sound`）。多個成就一次演出：「哇！一次解鎖 N 個成就！」，主徽章取最高階（`ACH_RANK`、分數金牌依分數），其他小徽章橫向排列可點選。按「查看我的成就收藏」到小孩頁面並標出新成就（`.is-new`），「繼續冒險」、返回鍵、Esc 都能關閉；其他視窗開著時排隊等候；減少動態效果時直接顯示最後畫面。成就在演出前就已存檔，動畫中斷不會重複或遺失。徽章正式圖到貨後放 `images/badges/`，在 `BADGE_IMG` 依代號加入即可（目前用程式畫的類別色徽章）。自動測試的其他流程以 `window.__cgpNoTheater` 改回文字提示。
- 加分・扣分版面（2026-11-07）：單欄條列（`.score-list`，名稱靠左可換行、分數標籤固定靠右）；不再插入「+2　2 項」分數分類標題（排序不變）；加分／扣分切換不顯示項目數；分數篩選 48×48 正圓形可橫向捲動；撤銷列精簡為一行。樣式都在 `.scorer` 範圍內，不影響紀錄頁的同名按鈕。
- 換島機制（2026-11-07，木島地圖到貨前先完成）：`ISLAND_ORDER` 金 → 木 → 水 → 火 → 土 → 金；島嶼地圖用 `registerBoard(id, board)` 加入 `BOARDS` 才算開放（board 需有 name、goalName、world、regions、tiles）。停在全島終點的下一次移動：有下一座已開放的島就前往該島起點（`_startNext`，回傳 `travel`），否則從起點開始新的一輪。各島進度存 `players[id].islands[島] = { laps, maxReached }`，金島以外的通關次數存 `islandClears`；金島區域成就固定看金島進度（`goldMax`）。通關獎勵各島相同（第一次神秘寶箱、之後 +10 星），「金島通關」成就只限金島。
- 封存舊紀錄（2026-11-07，設定 → 備份，需家長密碼）：封存日期早於家長選的日子的**生活紀錄與冒險紀錄**（`getArchivePlan`：records、settlements、ledger、rolls、minigames、bonusQuota、dayEnds、itemLog、看過的 blessings）。預設保留最近 6 個月；本週與本月不能封存；還沒發放的額外星星紀錄、封存日前 7 天的結算（連續 7 天）、未看過的媽媽加碼、進行中的小遊戲不封存；冒險位置、背包、地圖寶箱不動。先下載封存檔 `child-points-archive-before-日期.json`，再移除；總和記入 `data.carry[孩子] = { total, earned, special, stars, bestCatch, settled, count, advCount, until }`，點數、等級、累計得分、能量星星、所有成就條件都加上結轉，完全不變。
- 角色動畫（2026-11-07，Codex character-animation-pack-1 移植，原包說明 `docs/art/CODEX_CHARACTER_ANIMATION_README.md`）：地圖角色五種動作（`pawnIdle`、`pawnPlay('jump'|'happy'|'surprised'|'openChest')`），Web Animations API 作用在 `.pawn-inner`，特效放 `.pawn-fx`；依角色 `PAWN_PROFILE` 調整節奏與跳高。未直接引入原套件：其 `.pawn` 樣式名與 App 衝突、寶箱貼紙圖 2MB，改用現有 `images/chest.webp` 與角色圖。觸發：停著＝待機；每格＝跳格；寶箱格／背包開箱＝開寶箱；命運格、往回退、撿到神秘寶箱＝驚訝；機會格、全島終點＝開心。動畫在資料寫入之後播放；減少動態效果時不播。
- 頭像就代表孩子（2026-11-08 家長決定）：介面不再顯示角色名稱（石球獸等）。設定的頭像欄位標題為「頭像」、選項只有圖；冒險大廳夥伴標籤顯示孩子名字；更換視窗標題「更換 X 的頭像」；通關畫面「X 抵達了…」。角色名稱只保留在 aria-label 給讀屏。
- 孩子 4 位以上：頁首切換列改為每排 3 位（`.kid-switch.many`，名字過長分兩行）；3 位以下維持一排。設定頁 7 個分頁改為每排 4 個自動換行，不用左右滑。
- 新增孩子（2026-11-07）：首頁只在還沒有孩子時顯示；有孩子後改在小孩頁面設定城堡正下方（小圖示＋文字，`.add-kid`，`alignHeroLinks()` 對齊城堡中心）；設定 → 孩子也可新增。
- 設定 → 孩子：當天按了「結束今日冒險」的孩子會出現「解除今天的結束」（`store.reopenAdventure()`，需家長密碼）。
- 頁首按鈕：**機器貓**在首頁＝到目前孩子的冒險大廳、其他頁＝回首頁（取代原本的「‹」返回鍵）；**漂浮城堡**＝設定（取代齒輪，所有螢幕寬度都顯示）。
- 「進入今日冒險」改為一個視窗列出所有孩子：可出發的預設勾選、未解鎖灰色顯示原因、已出發打 ✅，一次結算多位（`enterAdventure()`）。
- 星星商店移到地圖左下角大按鈕（`.map-shop`），上方 HUD 只剩星星、骰子、位置；商店插圖 `images/tiles/shop.webp`（`SHOP_ART`，透明去背＋白色描邊（貼紙效果，384px），顯示 92px，「商店」字在圖下方，直接浮在地圖左下角）。

### Phase 4 美術素材
- 命運格水晶球 `images/tiles/fate.webp` 已上線（第 11、14、21、27 格）。
- 第 3 步用的 9 張道具圖已放在 `images/items/`（mystery_chest、golden_key、treasure_magnet、lucky_medal、magic_dice、flying_wings、shield、magic_door、airplane，256px 白底），**尚未接入、也未加入 `sw.js` 快取**；第 3 步接入時再加入 `SHELL`。

### 自動備份與還原
- 每天第一次開啟 App 時自動備份完整資料，保留最近 7 天；還原或「載入備份檔」前另存「還原前的狀態」（只保留最新一份）。
- **備份放在 IndexedDB**（資料庫 `cgp-snapshots`），不和主資料搶 localStorage（約 5MB）；舊版放在 `localStorage['cgp-data-snapshots']` 的備份會自動搬過去並刪除。沒有 IndexedDB（例如無痕模式）時退回 localStorage，空間不足時先刪最舊的。
- 備份是非同步的：`store.snapReady`（啟動完成）、`store.restoreSnapshot()` 回傳 Promise；`store.getSnapshots()` 讀記憶體中的清單。
- 注意：自動備份和主資料在同一支手機，**換手機或清除瀏覽器資料仍需要匯出 JSON**。

### 儲存空間健檢（2026-11-07）
- 模擬兩位孩子各每天約 12 筆紀錄、一年後：主資料約 2.4MB（localStorage 上限約 5MB，約可用 2 年）；中階 Android 速度：首頁約 0.5 秒、任務頁約 0.6 秒、其他頁 0.2～0.3 秒、記一筆加分約 0.23 秒。
- 主資料超過約 3.5MB 時首頁顯示「資料量快到手機上限」；存不進去時顯示紅色警告（`store.storageNearFull`、`store.storageError`）。長期使用可到 設定 → 備份 →「封存舊紀錄」。
- 離線快取只放 WebP 背景（JPG 為備援、不預先快取），共 61 個檔案約 3.3MB。

### 成就與金島通關
- 成就 23 項（冒險 5、收集 5、生活 13；2026-11-07 加「冒險開始」advStart：第一次進入今日冒險），2026-11-07 家長定稿（`docs/art/achievement_badges.csv`），定義在 `js/game.js` 的 `ACHIEVEMENTS`；外框顏色依類別：冒險綠、收集紫、生活金。紀錄 `data.achievements[childId][成就代號] = { date, ts }`，冒險、收集類達成後不會消失；**依生活紀錄計算的成就（獲得 N 分、特殊任務）標 `revocable`**：撤銷、取消勾選、刪除、修改紀錄後條件不成立就收回（`revokeAchievements`、`store.lastRevoked`），操作前用 `achievementLossIfChanged()` 預覽並提醒家長，再次達成可重新獲得；舊版的 goldClear3、goldClear5 已移除（舊紀錄留在存檔中但不顯示）。每次畫孩子相關頁面前 `store.checkAchievements()`，新達成的顯示提示。徽章先用表情符號，正式圖規格見 `docs/art/CODEX_ACHIEVEMENT_BADGES_BRIEF.md`。
- 成就介面（2026-11-07 家長決定）：首頁「🏆 最近得到的成就」在本週進度上方，每位孩子一列、最近 3 個（沒有成就的孩子不顯示）；點一列進小孩頁面並展開「全部成就」（在最近紀錄上方，平常收起；摺疊時顯示最近得到的一個，展開只列已得到的成就）。冒險大廳不再顯示成就。底部導覽「任務」與頁面標題「今日任務」改為「小孩」（任務清單區塊仍叫「常用・今日任務」）。
- 角色統計：`players[id].goldClears`（通關次數）、`maxReached`（最遠格子）、`stats.chests／mystery`（開過的寶箱數）。
- 金島通關（第 100 格 `type: 'end'`）：第一次＝神秘寶箱 ×1（免鑰匙，`giftMysteryChest`）＋成就「金島通關」；之後每次 ＋10 能量星星；全螢幕慶祝畫面；下一次移動從起點開始新的一輪。已可實際走到第 100 格（E2E 從第 97 格擲骰走到終點驗證）。

### 備份提醒
- `data.backup`：`lastExportAt`（最後匯出）、`since`（開始計算）、`snoozeUntil`（明天再提醒）。滿 7 天沒匯出 JSON 時首頁顯示提醒，「立即匯出」不需家長密碼（匯出不改資料）。

### 家長密碼
- 整個 ⚙️ 設定需要 4 位數家長密碼（第一次進入時設定）；離開設定自動上鎖。E2E 測試用 `passPin()` 輔助函式（密碼 1234）。

### 路由（hash，只用英數與連字號）
`#minigame-test`（家長試玩「抓住星星」：不給星星、不算次數、不動存檔）、`#home`、`#child-<id>`（任務）、`#challenge-<id>`、`#shop-<id>`（兌換）、`#adventure-<id>`（冒險大廳）、`#map-<id>`（金島地圖）、`#report`、`#rules`、`#rules-<分頁>`。舊格式 `#/child/<id>` 仍相容。

### 重要資料規則
- 總點數 = 起始點數 + 所有紀錄點數（不另存）。今日淨得分不含兌換與起始點數。
- `kind: 'task'` 在介面上顯示為「📋 每日任務」（加分的一種）。
- 能量星星餘額 = `adventure.settlements` 總和 + `adventure.ledger`（購買為負）。**與生活點數完全分開**；生活點數金幣圖示印「點」，⭐ 只代表能量星星。
- `child.avatar` 存冒險夥伴代號（8 種之一），同時是頭像與地圖棋子。圓形頭像依各角色臉部位置置中並統一臉部比例（`css/style.css` 末段 `.avatar img[data-char=…]`，以眼距為準、基準＝圓耳獸）。
- 冒險位置以 `players[id].tileId`（例如 `gold-01-007`，起點 `gold-01-start`）為準；`pos` 由 tileId 推導。舊存檔只有整數時自動對應。
- 目前開放的最後一格（第 55 格，`type: 'boundary'`）：抵達即停、捨棄餘步；下一次移動從起點開始新的一輪（`_newLap()`，`players[id].laps` 計輪數），一般寶箱格重新放滿。下一區開放後終點自動往後移。

### 預覽連結
另外有 claude.ai Artifact 預覽（單檔版），由腳本把 CSS／JS 內嵌成一個 HTML，並以 `files` 參數附上 `images/`。CSS 內的 `url(../images/...)` 需改成 `url(images/...)`。

---

## 4. 已知問題與待確認

- 金島第 27、28 格外框重疊 1.2px（在圓角外，畫面看不出來）。
- 地圖控制按鈕在右下角，拖曳到某些位置可能蓋住格子。
- 動畫中重新整理：位置與獎勵正確保留，但當次事件視窗不會再顯示。
- 石板圖去背後放大仍有極細雜點，正常顯示大小看不出來。
- 小翼獸舊版去背殘點已由家長的新圖取代。
- 等級屬於生活點數成就，與規格 Phase 5「角色不做等級」不衝突，但若家長覺得混淆可再調整。
- 星星發出後，結算後才撤銷的紀錄不會扣回星星。
- 道具每日上限（2026-11-07 家長決定）：前進類（溜冰鞋＋飛行翼）合計每天 5 次、任意門每天 1 次（`MOVE_DAILY_LIMIT`、`DOOR_DAILY_LIMIT`，依 `itemLog` 當天 use 紀錄計算；溜冰鞋從此也記錄）。超過上限不消耗道具，按鈕變灰；不占每日 3 次擲骰。神奇骰子維持每天 1 顆。
- 重新結算今天（設定 → 孩子，需家長密碼；今天已結算的孩子才出現）：`store.resettleToday()` 用目前今日淨得分重算，只補發差額（含結算後新增的加碼星星）到同一筆結算紀錄（`settlement.resettles` 留紀錄）；分數變少不扣回、不重複發放。

---

## 5. 與家長（使用者）溝通的習慣

- **全程使用繁體中文**（英文學習問題除外）。
- **詳細回答前先釐清方向**；需要家長決定的事，用**可點選的選擇題**（附建議選項）。
- 每階段完成後回報：修改檔案、新增功能、測試結果、已知問題、下一階段注意事項。
- 合併前先詢問（家長通常選「開 PR 並合併」）。
- 家長常提供 AI 生成的原創美術（角色、場景、圖示），需要去背、裁切、統一尺寸並驗證手機顯示。
- 家長主要用手機（Android，寬約 360px）使用 App；電腦偶爾用來整理規則（Excel CSV）。

---

## 6. 實機驗收清單

見 `docs/ACCEPTANCE_CHECKLIST.md`（每次大改版後更新版本號與項目）。
