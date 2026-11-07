# 親子集點冒險 App：交接文件

> 最後更新：2026-11-07｜App 版本 `2026.11.07-21`｜Service Worker 快取 `cgp-shell-v31`
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

> 詳細規劃（含家長已決定的規則）見 **`docs/PHASE4_PLAN.md`**；以下為原始摘要。

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
| 金島第一區 | 依美術交接（gold_region01）使用無格子背景＋JSON 座標第 1～30 格，可拖曳縮放、穩定格子 ID、第 30 格為暫時邊界 | ✅（只在 bundle，尚未上線） |
| Phase 4～6 | 小遊戲、命運卡、神秘寶箱、角色動畫、五島 | ⬜ 未開始 |

已上線（舊網址）的最新版是 PR #7；金島第一區兩個 commit 尚未上線。

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

### 近期介面調整
- 「進入今日冒險」改為一個視窗列出所有孩子：可出發的預設勾選、未解鎖灰色顯示原因、已出發打 ✅，一次結算多位（`enterAdventure()`）。
- 星星商店移到地圖左下角大按鈕（`.map-shop`），上方 HUD 只剩星星、骰子、位置；商店插圖 `images/tiles/shop.webp`（`SHOP_ART`，透明去背＋白色描邊（貼紙效果，384px），顯示 92px，「商店」字在圖下方，直接浮在地圖左下角）。

### Phase 4 美術素材
- 命運格水晶球 `images/tiles/fate.webp` 已上線（第 11、14、21、27 格）。
- 第 3 步用的 9 張道具圖已放在 `images/items/`（mystery_chest、golden_key、treasure_magnet、lucky_medal、magic_dice、flying_wings、shield、magic_door、airplane，256px 白底），**尚未接入、也未加入 `sw.js` 快取**；第 3 步接入時再加入 `SHELL`。

### 路由（hash，只用英數與連字號）
`#minigame-test`（家長試玩「抓住星星」：不給星星、不算次數、不動存檔）、`#home`、`#child-<id>`（任務）、`#challenge-<id>`、`#shop-<id>`（兌換）、`#adventure-<id>`（冒險大廳）、`#map-<id>`（金島地圖）、`#report`、`#rules`、`#rules-<分頁>`。舊格式 `#/child/<id>` 仍相容。

### 重要資料規則
- 總點數 = 起始點數 + 所有紀錄點數（不另存）。今日淨得分不含兌換與起始點數。
- `kind: 'task'` 在介面上顯示為「📋 每日任務」（加分的一種）。
- 能量星星餘額 = `adventure.settlements` 總和 + `adventure.ledger`（購買為負）。**與生活點數完全分開**；生活點數金幣圖示印「點」，⭐ 只代表能量星星。
- `child.avatar` 存冒險夥伴代號（8 種之一），同時是頭像與地圖棋子。圓形頭像依各角色臉部位置置中並統一臉部比例（`css/style.css` 末段 `.avatar img[data-char=…]`，以眼距為準、基準＝圓耳獸）。
- 冒險位置以 `players[id].tileId`（例如 `gold-01-007`，起點 `gold-01-start`）為準；`pos` 由 tileId 推導。舊存檔只有整數時自動對應。
- 金島第 30 格 `type: 'boundary'`：抵達即停、捨棄餘步、不發獎勵（家長尚未另定規則前的預設）。

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

---

## 5. 與家長（使用者）溝通的習慣

- **全程使用繁體中文**（英文學習問題除外）。
- **詳細回答前先釐清方向**；需要家長決定的事，用**可點選的選擇題**（附建議選項）。
- 每階段完成後回報：修改檔案、新增功能、測試結果、已知問題、下一階段注意事項。
- 合併前先詢問（家長通常選「開 PR 並合併」）。
- 家長常提供 AI 生成的原創美術（角色、場景、圖示），需要去背、裁切、統一尺寸並驗證手機顯示。
- 家長主要用手機（Android，寬約 360px）使用 App；電腦偶爾用來整理規則（Excel CSV）。

---

## 6. 新網址上線後的驗收清單

- [ ] 首頁、任務、挑戰、兌換、紀錄五個分頁可正常切換
- [ ] ⚙️ 設定 → 備份 → App 版本顯示 `2026.11.07-6`
- [ ] 從舊 App 匯出的 JSON 可完整還原（孩子、點數、紀錄、冒險進度）
- [ ] 進入今日冒險 → 冒險大廳 → 開始冒險 → 金島第一區地圖顯示正式背景與 30 塊石板
- [ ] 地圖可拖曳、雙指縮放、🎯 回到角色
- [ ] 擲骰後角色逐格移動；重新整理後位置不變
- [ ] 走到第 30 格（木門）停下並提示第二區即將開放
- [ ] 離線（飛航模式）仍可開啟
