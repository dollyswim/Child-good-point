# 木島 → 水島 銜接文件（WOOD_TO_WATER_HANDOFF）

> 2026-11-12 建立。木島結局已實作（滑梯圖目前是佔位圖）；水島尚未製作。以下都依實際程式記錄。

## 1. 木島結局的觸發條件
- 孩子在木島走到**第 100 格**（全島終點，精靈巨樹樹洞口）時觸發。多餘的步數捨棄，和金島相同。
- 不是在第 92 格「森林派對」結束時觸發（家長決定：維持 100 格規則）。森林派對沒完成也能通關。
- 程式：`js/app.js` 的 `playMove()` → 事件有 `clear` 且 `clear.island === 'wood'` → `woodEnding(child, ev)`；金島仍走 `mapFireworks()` + `showClear()`。

## 2. 通關資料（存在 localStorage，每個孩子各自一份）
- 位置：`store.getPlayer(childId)`（`data.adventure.players[childId]`）。
- 欄位：`islandClears.wood`（整數，木島通關次數；沒通關過是 `undefined` 或 0）。金島沿用舊欄位 `goldClears`。
- 寫入時機：`js/game.js` 的 `_resolveTile()` 停在 `end` 格時，**在演出開始前**就寫入並發獎勵：
  - 第 1 次：神秘寶箱 ×1（免鑰匙，`bag.giftMysteryChest`）。
  - 第 2 次起：能量星星 +10（`GOLD_CLEAR_STARS`）。
- 所以動畫中途關掉、重新整理都不會重複或漏發；重新進入後孩子停在第 100 格，下一次移動就前往下一座島（或新的一輪）。動畫本身不會重播。
- 沒有為結局新增任何儲存欄位。
- 成就「木島通關」（代號 `woodClear1`）：`islandClears.wood >= 1` 時解鎖，顯示在木島完成畫面上。

## 3. 水島如何判斷木島已完成
```js
var p = store.getPlayer(childId);
var woodDone = (p.islandClears && p.islandClears.wood >= 1);
```
- 換島由既有機制處理：`GAME.registerBoard('water', board)` 之後，木島通關的下一次移動會自動到水島第 0 格（`nextIsland('wood')`、`store._travel`，事件 `res.travel`）。
- 水島開場（從滑梯滑出、落在沙灘、「歡迎來到水島！」）建議掛在 `playMove()` 裡 `res.travel` 且目的地是 `water` 的地方（目前那裡只有一句提示「🛶 出發前往…」）。

## 4. 木島滑梯最後一幕
- 素材：`images/wood/ending/slide1.webp`～`slide5.webp`（720×960 直式，**目前是佔位圖**，正式圖提示詞見 `docs/art-prompts.md`「木島結局：樹洞溜滑梯」）。
- 分鏡：①古樹內部、樹根滑梯向下 ②彎曲木隧道、發光蘑菇 ③急彎、螢火蟲 ④越來越深、藍色光點 ⑤前方神祕藍光照亮隧道。
- 最後一幕：第 5 張圖放大，畫面中央一團白→淺藍（#c9f4ff → #6fd6f2）的光放大蓋滿畫面，接著出現「🌳 木島冒險完成！」卡片（藍白底）。
- 全程第一人稱，不出現角色、不出現水島或出口的景色。對話裡森林小精靈有說出「通往水島的祕密隧道」（家長文案）。

## 5. 建議水島接續的第一個畫面
- 從同一條樹根隧道內開始：木質紋理、藍綠色調、第一人稱、畫面中央是藍白色的光（接木島第 5 張）。
- 接著才是出口、滑出、白色沙灘。

## 6. 相關程式
| 檔案 | 內容 |
|---|---|
| `js/game.js` | `ISLAND_ORDER`、`registerBoard()`、`nextIsland()`、`buildWood()`、`WOOD_OPEN`（目前 false）、`_resolveTile()` 的 `end` 分支、`_travel` |
| `js/board-wood.js` | 木島 101 格座標與小精靈站位（由 `tools/gen_board_wood.py` 產生） |
| `js/app.js` | `woodEnding()`、`WOOD_SLIDES`、`WOOD_END_LINES`、`playMove()`、`showClear()`（金島） |
| `css/style.css` | `.wood-end`、`.we-*` |

## 7. 測試與注意事項
- 單元：`木島正式地圖：101 格…`（通關寫入 `islandClears.wood`、不影響 `goldClears`）。
- E2E：`木島正式地圖與樹洞結局`（對話 3 句 → 5 張滑梯 → 完成卡片；獎勵不重複；第二次可略過；卡片不含「水島」字樣）。
- 木島目前**未開放**（`WOOD_OPEN = false`）。預覽：在瀏覽器主控台或測試先設 `window.__cgpWoodOpen = true` 再載入頁面。
- 第二次以後通關有「略過」按鈕；系統設定「減少動態效果」時只做淡入淡出。
- 其他島的大圖不要放進 `sw.js` 的 `SHELL`（用到才下載）。
