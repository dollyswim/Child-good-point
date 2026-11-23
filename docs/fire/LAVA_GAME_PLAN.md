# 火島小遊戲《熔岩跳跳路》V1.0 計畫

> 2026-11-22 家長草稿＋確認｜程式：`js/lava.js`（`CGPLava(A)`）｜試玩：`#lava-test`
> 狀態：V1.0 原型（CSS 圖形暫代）。火島還沒開放，正式版要等火島有小遊戲格才會出現。

## 1. 與現有系統的對應（評估結果）

| 草稿要求 | 做法 |
|---|---|
| 兩關只算一次每日小遊戲 | 沿用「待玩紀錄」：一筆紀錄 `game: 'lava'`，整場結束才標記完成 |
| 5／10／15 星、只結算一次 | 新增 `store.finishLava(childId, outcome)`，依結果給固定星星；其他島的算法不動；上限 15 與現有一致 |
| 中途關掉不重複領星 | 結束前不發星；簡易版成績存在紀錄的 `lava.easy`（家長決定：回來直接到「領 10 星／挑戰困難版」） |
| 角色 | 孩子選的冒險夥伴圖 |
| 洛洛防護罩 | 只是小遊戲演出，不碰背包防護罩、不觸發回補 10 星 |
| 火島主線、火山隧道快車 | 專案裡都還沒有，不受影響 |
| 正式入口 | 火島還沒開放：`minigameOf('fire')` 先設成 `lava`，火島開放後小遊戲格自動用這個 |

## 2. 家長確認的細節（2026-11-22）
- **洛洛（Lolo）**：未來火島的冒險嚮導，可愛的火山蜥蜴；深灰色身體、橘金色火山紋路、探險護目鏡、小背包；活潑、熱心、勇敢。負責提示、鼓勵、失敗救援。圖到之前用 🦎 暫代。
- **平台邊緣**：角色到最邊邊那一格時閃紅光、顯示「快跳！」；被平台帶出畫面才算 1 次失敗。
- **蒸氣**：左 3 格、右 3 格輪流噴（永遠有一邊安全），噴發前冒泡預警 1.2 秒。
- **中途關掉**：保留簡易版成績。

## 3. 規則（照草稿）
- 簡易版 6×6：終點／落石 C／安全區／落石 B／落石 A／起點；落石約 0.8 格／秒，相鄰排反向。
- 困難版 6×8：終點／蒸氣／平台 B／平台 A／安全區／落石 B／落石 A／起點；落石約 1.15 格／秒、平台約 0.75 格／秒（寬 2 格）。
- 每關 3 次機會；失敗回到身後最近的安全區（起點或中途安全區），復位後 1 秒保護。
- 失敗 3 次：洛洛救援（金色防護罩自動護送到終點）。
- 結算：簡易版救援 5、簡易版過關選擇結束 10、困難版救援 10、兩關都過 15。
- 操作：下方四個方向鍵（也支援鍵盤方向鍵）；跳一格 0.18 秒，動畫中不接受下一次按鍵。
- 切到背景自動暫停。

## 4. 美術需求（請 Gemini 製作；V1.0 先用 CSS 圖形）

共用風格：`2.5D chibi clay toy style, round soft shapes, warm lighting, bright clear colors, same series as the other islands, no text, no watermark`

| # | 檔名 | 內容 | 規格 |
|---|---|---|---|
| L-1 | `lolo.webp` | 洛洛全身：可愛的火山蜥蜴，深灰色身體、橘金色火山紋路、推到額頭的探險護目鏡、小背包，一手舉起打招呼、表情活潑勇敢 | 白底、直式約 2:3、至少 800×1200 |
| L-2 | `rock.webp` | 圓滾滾的火山落石：深灰黑色、表面有幾道發光橘色裂紋，圓潤不尖銳、側面看起來在滾 | 白底、正方形 512 |
| L-3 | `platform.webp` | 冷卻的火山岩平台：扁平長條、頂面是比較亮的灰褐色可以踩、邊緣有一點橘光，**要一眼和岩漿區分**；**正面略高、左右水平擺正、兩端一樣大、幾乎填滿寬度**（2026-11-23：第一版斜放有透視，請重畫） | 白底、橫式約 5:2 |
| L-4 | `lava.webp` | 岩漿河紋理：橘紅色流動岩漿、有亮黃色光點，可以左右無縫重複 | 畫滿、橫式 4:1、1600×400 |
| L-5 | `ground.webp` | 安全地面紋理（起點、中途安全區用）：黑色火山岩地面、有幾株小草和小石頭，可以左右無縫重複 | 畫滿、橫式 4:1、1600×400 |
| L-6 | `vent_warn.webp`／`vent_burst.webp` | 地熱孔兩個狀態：①地面圓孔冒小泡泡和一點白煙（預警）②白色蒸氣柱往上噴（危險），同一個孔、同一個視角 | 白底、正方形 512，兩張一組 |
| L-7 | `goal.webp` | 終點：火山口前的小拱門，掛著橘色小旗子，看起來很安全 | 白底、橫式 2:1 |

提示詞（英文給 Gemini，中文對照）：

- **L-1** `A cute chibi volcano lizard explorer named Lolo, full body standing, dark grey body with glowing orange-gold lava stripe patterns, adventure goggles pushed up on the forehead, a small brown backpack, one hand raised waving, lively brave cheerful face, big friendly eyes, 2.5D clay toy style, same series as the gold island technician, plain white background, centered with margin, portrait 2:3, no text`
  中文：可愛的 Q 版火山蜥蜴探險家「洛洛」，全身站姿；深灰色身體、發光的橘金色火山紋路；探險護目鏡推到額頭、背小背包；一手舉起打招呼，表情活潑勇敢、大眼睛很友善；2.5D 黏土玩具風，跟金島技師同系列；純白背景、置中留邊、直式 2:3、不要文字。
- **L-2** `A single round chubby volcanic boulder rolling sideways, dark charcoal stone with a few glowing orange cracks, soft rounded shape not sharp, 2.5D clay toy style, plain white background, centered, square, no text`
  中文：一顆圓滾滾的火山落石，側面看起來在滾；深炭灰色石頭、有幾道發光的橘色裂紋；圓潤不尖銳；2.5D 黏土風；純白背景、置中、正方形、不要文字。
- **L-3** `A flat long cooled volcanic rock raft seen from the front and slightly above, perfectly straight and horizontal (long side exactly left to right, both ends the same size, no perspective tilt, no rotation), lighter grey-brown walkable top surface, thin warm orange glow along the bottom edges, fills almost the full width with a small margin, clearly solid and safe to stand on, 2.5D clay toy style, plain white background, horizontal about 5:2, no text`
  中文：扁平長條冷卻火山岩平台，從正面略高一點看、**左右水平擺正**（長邊左右平放、兩端一樣大、不要透視傾斜或旋轉）；頂面是比較亮的灰褐色、可以踩；底部邊緣有一圈細細的溫暖橘光；幾乎填滿整張寬度、只留一點邊；看起來很堅固；2.5D 黏土風；純白背景、橫式約 5:2、不要文字。（2026-11-23 家長第一版質感很好但斜放，可上傳第一版當參考重畫）
- **L-4** `Seamless horizontally tileable texture of a flowing lava river seen from above, bright orange-red molten lava with glowing yellow spots and soft swirls, cute 2.5D clay style, fills the whole image, horizontal 4:1, no text`
  中文：從上方看的流動岩漿河，左右可以無縫重複；亮橘紅色岩漿、有發光黃點和柔和漩渦；可愛 2.5D 黏土風；畫滿整張、橫式 4:1、不要文字。
- **L-5** `Seamless horizontally tileable texture of safe black volcanic rock ground seen from above, a few tiny green sprouts and small pebbles, cute 2.5D clay style, fills the whole image, horizontal 4:1, no text`
  中文：從上方看的安全黑色火山岩地面，左右可以無縫重複；有幾株小綠芽和小石頭；可愛 2.5D 黏土風；畫滿整張、橫式 4:1、不要文字。
- **L-6** ① `A small round geothermal vent hole in dark volcanic ground with little bubbles and a thin wisp of white steam (warning state), 2.5D clay toy style, plain white background, square, no text` ② `The same vent hole, same angle, now blasting a tall puffy white steam column straight up (danger state), keep the vent identical, plain white background, square, no text`
  中文：①深色火山地面上的小圓形地熱孔，冒小泡泡和一縷白煙（預警）；②同一個孔、同一個角度，噴出高高的蓬鬆白色蒸氣柱（危險），孔的樣子不要變；純白背景、正方形、不要文字。
- **L-7** `A small friendly stone archway at the foot of a cute volcano with little orange flags, looks safe and welcoming like a finish gate, 2.5D clay toy style, plain white background, horizontal 2:1, no text`
  中文：可愛火山腳下的小石頭拱門，掛著橘色小旗子，看起來安全又歡迎人，像終點門；2.5D 黏土風；純白背景、橫式 2:1、不要文字。

交件方式同其他島：照慣例收齊後由 Claude 審查、白底圖只去除與外框相連的白底，家長確認後一起換上（圖放 `images/fire/lava/`，不放 SHELL）。

## 5. V1.0 完成紀錄（2026-11-22，版本 242）
- 階段 A～D 都完成：兩關場地、方向鍵（含鍵盤）、落石／平台／蒸氣與碰撞、復位 1 秒保護、切背景暫停、洛洛救援、難度切換、結算。
- 測試：單元（四種結果 5／10／10／15、只結算一次、困難版要先過簡易版、不動背包、重新載入保留成績）；E2E（6×6／6×8、撞落石與掉岩漿扣機會回安全區、重新整理後回到選擇、困難版救援 10 星、只用一次每日小遊戲、#lava-test）；動態檢查（平台載著走約 0.7 格／秒、邊緣「快跳！」提醒、出界算失敗、蒸氣左右輪流不會同時噴）。
- 測試專用：`window.__cgpLavaSpeed`（0＝障礙物停住）、`window.__cgpLava.debug()／layout()／setTime()`。
- 待家長：手機試玩手感（速度、空隙、方向鍵大小）；美術 L-1～L-7。
