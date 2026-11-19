# 木島 → 水島 銜接文件（WOOD_TO_WATER_HANDOFF）

> 2026-11-12 建立，**2026-11-16 更新**（目前版本 `2026.11.19-217`、快取 `cgp-shell-v227`）。
> 水島確認版計畫：`docs/water/WATER_ISLAND_PLAN.md`；美術提示詞：`docs/water/CODEX_WATER_ISLAND_BRIEF.md`。
> 水島計畫審查與家長決定：`docs/water/WATER_PLAN_REVIEW.md`（以它為準）。
> 水島分工：另一個 AI 先寫水島總計畫草稿 → Claude 審查是否可執行 → 美術交給 Codex，其他部分由 Claude 處理。
> 木島已開放（結局、任務、飛行員阿翔都已上線）；水島尚未製作。以下都依實際程式記錄。
> 水島製作前也請先讀：`CLAUDE.md`（工作規則）、`docs/HANDOFF.md` 第 0、1 節（固定流程、容易踩到的地方）。

## 0. 現況一句話
- 島嶼順序：金 → 木 →（水島未註冊）→ 回金島。水島註冊後會自動變成金 → 木 → 水 → 回金。
- 金島 → 木島：飛行員阿翔駕駛「飛行者」載過去（有過場動畫）。
- 木島 → 回金島：下一次擲骰時播 `returnScene()`（沿用樹洞隧道圖 →「回到金島！」卡片，2026-11-16）。**木島 → 水島目前沒有過場**，要由水島製作。
- 木島結局每次通關都會播（第二次起可略過），內容只到「滑進樹洞隧道、看到藍光」，**不演出抵達水島**。

## 1. 木島結局的觸發條件
- 孩子在木島走到**第 100 格**（全島終點，精靈巨樹樹洞口）時觸發。多餘的步數捨棄，和金島相同。
- 不是在第 92 格「森林派對」結束時觸發（家長決定：維持 100 格規則）。
- 用骰子走過去不會被任務格擋住（任務格只會擋傳送門，見第 7 節），所以森林派對沒完成也能通關。
- 程式：`js/app.js` 的 `playMove()` → 事件有 `clear` 且 `clear.island === 'wood'` → `woodEnding(child, ev)`；金島仍走 `mapFireworks()` + `showClear()`。
- 每次通關都會播；第 2 次起右上角有「略過 ›」（`repeat = ev.clear.count > 1`）。系統「減少動態效果」時只淡入淡出。

## 2. 通關資料（localStorage，每個孩子各自一份）
- 位置：`store.getPlayer(childId)`（`data.adventure.players[childId]`）。
- 欄位：`islandClears.wood`（整數，木島通關次數）。金島沿用舊欄位 `goldClears`。水島請用 `islandClears.water`（同一段程式自動處理，不用新增欄位）。
- 寫入時機：`js/game.js` 的 `_resolveTile()` 停在 `end` 格時，**在演出開始前**就寫入並發獎勵：
  - 第 1 次：神祕寶箱 ×1（免鑰匙，`bag.giftMysteryChest`）。
  - 第 2 次起：能量星星 +10（`GOLD_CLEAR_STARS`）。
- 動畫中途關掉、重新整理都不會重複或漏發；重新進入後孩子停在第 100 格，下一次移動就前往下一座島。
- 成就「木島通關」（`woodClear1`）：`islandClears.wood >= 1` 時解鎖，顯示在木島完成卡片上。成就共 28 項。

## 3. 水島如何判斷木島已完成
```js
var p = store.getPlayer(childId);
var woodDone = (p.islandClears && p.islandClears.wood >= 1);
```

## 4. 換島機制（水島要接的地方）
| 段落 | 怎麼換島 | 程式 |
|---|---|---|
| 金島 → 木島 | 金島第 100 格：阿翔自動跳出對話 →「好，出發！」→ 飛行過場（不扣骰子） | `game.js` 的 `flightReady()`／`takeFlight()`（**只限金島**）；`app.js` 的 `pilotTalk()`、`flightScene()` |
| 木島 → 下一座 | 木島第 100 格，下一次擲骰或前進道具 | `game.js` 的 `_startNext()`（`nextIsland('wood')`），結果放在 `res.travel` |
| 木島 → 回金島 | 同上；播 `returnScene()` | `app.js` 的 `playMove()`：`fromIsland === 'wood' && res.travel.island === 'gold'` |
| 回到某座島 | 同上 | `_startNext()` 會呼叫 `_offerStoryReset()`（見第 6 節） |

- 開放水島：比照木島，在 `game.js` 加 `buildWater()` 與 `WATER_OPEN`，或直接 `GAME.registerBoard('water', board)`。註冊後 `nextIsland('wood')` 就會回傳 `water`，不用改換島程式。
- **水島開場動畫**請掛在 `js/app.js` 的 `playMove()` 這一段（目前約第 1915 行）：
  ```js
  if (res.travel) {
    if (res.travel.island === 'wood') { await flightScene(...); }   // 金島 → 木島
    else if (fromIsland === 'wood' && res.travel.island === 'gold') { await returnScene(child, res.travel); }   // 木島 → 暫時回金島
    else { toast('🛶 出發前往' + res.travel.name + '！', 'pos'); render(); await sleep(500); }   // ← 水島開場加在這裡
  }
  ```
  建議加 `else if (res.travel.island === 'water') { await waterOpening(child, res.travel); }`。水島開放後木島不會再回金島，`returnScene()` 會自然用不到。
- **略過按鈕**（2026-11-16 家長決定：所有換島過場第一次完整播、第二次起可略過）：共用 `tripSkipper(el)`，畫面放 `<button class="we-skip" data-trip-skip>略過 ›</button>`，等待改用 `trip.wait(ms)`，到卡片前呼叫 `trip.done()`。水島開場請照做。
- 換島那一步不會演出任務（`if (!res.travel)`），水島開場演完後孩子停在水島第 0 格。
- 要像阿翔一樣「不扣骰子、按了就走」：`flightReady()` 目前寫死 `p.island !== 'gold'`，要改成判斷目的地；若維持「下一次擲骰才換島」則不用改。

## 5. 水島上線時一定要改的地方
- **木島完成卡片的文字**：`app.js` 的 `woodEnding()` 裡寫著「下一座島還在準備中，敬請期待！」，以及「下次出發會先回到『…』繼續冒險」。水島開放後要改成前往水島的說法。
- **E2E 斷言**：`木島正式地圖與樹洞結局` 檢查完成卡片「不含『水島』字樣」，改文字時要一起改。
- **地圖提示**：`app.js` 約第 1562 行的終點提示會自動顯示「下次出發前往『水島』」，不用改。
- **小遊戲**：`minigameOf()` 目前木島＝落葉找松果、其他島＝抓住星星；水島要專屬小遊戲就在這裡加。
- **冒險大廳插圖**：`app.js` 約第 651 行已有水島的大廳設定（`images/islands/water.webp`）。

## 6. 任務（劇情）怎麼接
- 任務定義兩處：`game.js` 的 `STORIES`（代號、島、格號、名稱；代號各島不能重複）、`app.js` 的 `ISLAND_STORY[島]`（導遊圖、站位、任務類型與文案）。水島加 `ISLAND_STORY.water` 與 `STORIES` 裡 `island: 'water'` 的項目即可，下面這些會自動套用：
  - **傳送門限制**（`doorLimit()`）：傳送門不能跳過還沒完成的任務格。
  - **任務重置**（2026-11-16 家長決定）：重新回到一座島的起點時，如果這座島有做過任務，導遊會問「這次要不要把任務重新來一次？」；選要就清掉這座島的任務紀錄，再完成一樣各給 ⭐3（`STORY_STARS`）。程式：`_offerStoryReset()`、`storyResetOffer()`、`answerStoryReset()`、`app.js` 的 `storyResetAsk()`；存檔欄位 `players[id].storyAsk`（`migrate()` 已處理）。
  - 每個任務第一次完成給 ⭐3（`completeStory()`）。
- 任務視窗：可沿用 `partyPanel()`（外面有全螢幕遮罩 `.party-shade`，點偏了不會點到後面的地圖）。
- **家長預覽連結**：網址加 `?preview=party`／`flowers`／`invite` 可直接試玩木島任務視窗（`app.js` 最後面）。水島任務可照樣加進去。

## 7. 對話的樣式（水島請沿用）
- 所有角色對話都是「畫面下方對話框＋上方人物半身大圖」：
  - 共用函式 `talkPortrait(src, right)`（`.we-portrait`；孩子在右、其他角色在左），對話框 `.we-talk`。
  - 地圖上導遊說的話：`techTalk()` 已改成 `.we-talk.map-talk`（id 仍是 `tech-bubble`），時間到自動收起、點一下可關。
  - 木島結局對話、阿翔對話、任務重置詢問都用同一套。
- 水島導遊的圖：放在 `ISLAND_STORY.water.guide.img`，地圖小人和對話大圖會共用同一張；建議全身直式、去白底，上半身要清楚（大圖只露上半部）。

## 8. 木島滑梯最後一幕（水島開場要接的畫面）
- 素材：`images/wood/ending/tunnel1.webp`～`tunnel5.webp`（810×1080 直式，家長正式圖）。
- 分鏡：①古樹內部、樹根滑梯向下 ②彎曲木隧道、發光蘑菇 ③急彎、螢火蟲 ④越來越深、藍色光點 ⑤前方神祕藍光照亮隧道。
- 最後一幕：第 5 張圖放大，畫面中央一團白→淺藍（#c9f4ff → #6fd6f2）的光蓋滿畫面，接著出現「🌳 木島冒險完成！」卡片（藍白底）。
- 全程第一人稱，不出現角色、不出現水島或出口的景色。森林小精靈的台詞有說「傳說這裡藏著一條通往水島的祕密隧道喔！」（家長文案）。

### 建議水島開場的第一個畫面
- 從同一條樹根隧道內開始：木質紋理、藍綠色調、第一人稱、畫面中央是藍白色的光（接木島第 5 張）。
- 接著才是出口、滑出、白色沙灘、「歡迎來到水島！」。
- 可參考 `flightScene()` 的做法：全螢幕圖片＋緩慢平移（`.fl-fly` 圖比畫面寬，用 `transform` 由左往右移）→ 最後出現抵達卡片。
- 注意：結局動畫與換島之間隔了一次擲骰（可能隔天才擲），所以開場不要假設孩子「剛看完」滑梯。

## 9. 相關程式
| 檔案 | 內容 |
|---|---|
| `js/game.js` | `ISLAND_ORDER`、`registerBoard()`、`nextIsland()`、`buildWood()`、`WOOD_OPEN`、`_resolveTile()` 的 `end` 分支、`_startNext()`、`flightReady()`／`takeFlight()`、`STORIES`、`storiesOf()`、`doorLimit()`、`_offerStoryReset()`／`answerStoryReset()`、`minigameOf()` |
| `js/board-wood.js` | 木島 101 格座標與小精靈站位（由 `tools/gen_board_wood.py` 從 `data/wood_island_coordinates_0_100.json` 產生） |
| `js/store.js` | `migrate()`（新欄位在這裡補預設值） |
| `js/app.js` | `ISLAND_STORY`、`runStory()`、`partyPanel()`、`techTalk()`、`talkPortrait()`、`storyResetAsk()`、`pilotTalk()`、`flightScene()`、`woodEnding()`、`WOOD_SLIDES`、`WOOD_END_LINES`、`playMove()` |
| `css/style.css` | `.wood-end`、`.we-*`、`.we-portrait`、`.map-talk`、`.flight`／`.fl-*`、`.party-*` |

## 10. 測試與注意事項
- 單元測試（`tests/store.test.js`，目前 146 項）：檔案開頭 `delete G.BOARDS.wood`（舊測試以「只有金島」為前提），要測木島時在測試內 `G.registerBoard('wood', G.buildWood())`，結束時刪掉。水島請比照。
  - 相關：`木島正式地圖：101 格…`、`金島 → 木島專機…`、`任務重置…`、`換島不受任務影響：…金島→木島→金島一直走下去`（水島開放後要把水島加進這條）。
- E2E（`tests/e2e.js`）：預設注入 `__cgpWoodClosed`、`__cgpNoStory`、`__cgpNoOnboard`、`__cgpNoTheater`；要測對應功能時傳 `wood`／`story`／`onboard`／`theater: true`。水島建議也做一個 `__cgpWaterClosed`，避免舊測試因多一座島而失敗。
  - 相關：`木島正式地圖與樹洞結局`（對話 3 句 → 5 張滑梯 → 完成卡片；獎勵不重複；第二次可略過；卡片不含「水島」字樣）。
- 其他島的大地圖、大廳插圖、劇情圖**不要**放進 `sw.js` 的 `SHELL`（用到才下載）；同檔名換圖要換新檔名才會立刻生效。
- 改了畫面文字要重跑 `tools/font_subset.py`（字型小包）。
- 保留既有存檔：新欄位在 `migrate()` 補預設值；不改既有規則（每日 3 骰、小遊戲 1 次、道具價格）。
