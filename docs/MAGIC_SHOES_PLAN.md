# 魔法鞋規劃（2026-11-25 家長決定方向，尚未實作）

## 規則
| 項目 | 內容 |
|---|---|
| 名稱 | 魔法鞋（程式代號 `magicShoes`） |
| 效果 | 使用時自選前進 **1～6 步**，落點照常觸發事件（寶箱、機會、命運、小遊戲、危險格…） |
| 取得 | 星星商店 **⭐40**，**每週最多買 2 個**（沿用 `SHOP.weekly`） |
| 每日上限 | 每天最多用 **1 個**（新增 `DEFAULT_LIMITS.shoes = 1`，可在「設定 → 冒險上限」調整） |
| 前進道具次數 | **不佔**溜冰鞋／飛行翼的每日次數，也不佔擲骰次數 |
| 劇情任務格 | 前方有還沒完成的任務格時，最遠只能選到那一格（和傳送門一致） |
| 島嶼終點 | 最多選到終點；超過終點的步數按鈕不能按 |
| 水島 | 照一般移動規則（潛水區段等限制沿用 `_advance`） |
| 存檔 | 背包新增 `magicShoes: 0`，`migrate()` 補 0；舊資料不受影響 |

## 介面
1. 地圖道具列出現「👟 魔法鞋 ×N・選步數」。
2. 點下去 → 視窗顯示 1～6 六個按鈕，每個按鈕下方預覽「第 N 格：寶箱／機會／一般…」（讓孩子看地圖做選擇）；不能到的步數按鈕變灰並寫原因。
3. 選好 → 角色逐格走過去 → 照常觸發落點事件。
4. 星星商店新增一列：「魔法鞋 ⭐40・本週還能買 N 個」。

## 測試
- 單元：商店每週 2 個；每天 1 個；不佔前進道具與擲骰次數；1～6 步都正確；遇到未完成任務格最遠只到該格；終點不超過；落點事件照常；匯出入保留。
- E2E：商店購買 → 地圖道具列 → 選 4 步 → 走到第 N 格並顯示事件。

## 美術（1 張，家長用 Gemini 製作）
規格：正方形 1024×1024，純白背景（不要畫出來的透明格子、沒有光暈），和其他道具圖同樣的柔和 3D 光澤畫風。

> **中文**：一雙可愛的魔法鞋道具圖示。圓潤的紫色和金色兒童運動鞋，鞋側有小小的金色翅膀，鞋尖上有一顆發光的小星星，鞋子周圍飄著幾顆小星星和魔法閃光，鞋底下方有 1～6 個發光的小腳印排成一列。柔和 3D 光澤、兒童遊戲 App 道具風格，正面略側、置中，純白背景，沒有文字、沒有數字、沒有光暈外框。
>
> **English**: A cute magic shoes item icon for a children's game. A pair of rounded purple-and-gold kids' sneakers with tiny golden wings on the sides and a small glowing star on each toe, a few little stars and magic sparkles floating around, and a short trail of small glowing footprints under the shoes. Soft glossy 3D children's game app item style, slight three-quarter view, centered, plain white background, no text, no numbers, no glow frame.
