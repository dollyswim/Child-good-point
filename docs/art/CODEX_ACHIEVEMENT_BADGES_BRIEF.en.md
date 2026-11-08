# Achievement Badge Art Brief (for Codex)

> Approved by the parent: `docs/art/achievement_badges.csv` (2026-11-07). 26 images: 25 achievements + 1 "locked" badge (#25 `woodHero` added 2026-11-08; it may be delivered later). Chinese version: `CODEX_ACHIEVEMENT_BADGES_BRIEF.md`.

## Common spec
- Each image: 1024×1024 PNG, **plain white background**, badge centered with ~8% margin. The app shows it at about 56px, so keep shapes simple with clear silhouettes.
- Style: match the Gold Island set — bright, cute chibi 3D game icons (same family as the item and tile icons), soft lighting, rounded shapes, suitable for kids aged 5–10.
- Shape: round badge with a thick rim colored by category — **Adventure = green, Collect = purple, Life = gold, Locked = gray**; main motif inside. Rims in the same category must match exactly.
- No text, letters or numbers. **Only exception:** the 10 "Earn N points" gold medals must show the engraved text "N 分" (N points, in Traditional Chinese). Please check each number is correct and legible.
- No watermarks, signatures, decorations outside the badge, or large gray shadows on the background.
- Use the file names below (`badge_<code>.png`); do not change the codes.

## Badge list

| # | File | Rim | Achievement | Motif |
|---|---|---|---|---|
| 1 | `badge_advStart.png` | green | 冒險開始 | an open treasure map with a compass placed on it |
| 2 | `badge_goldClear1.png` | green | 金島通關 | a golden castle with a golden crown on top and a small flag planted beside it |
| 3 | `badge_reachR2.png` | green | 抵達水晶礦谷 | a cluster of glowing blue-violet crystals |
| 4 | `badge_reachR3.png` | green | 抵達齒輪工坊 | two interlocking golden gears |
| 5 | `badge_reachR4.png` | green | 抵達金冠城堡 | a golden royal crown |
| 6 | `badge_chest1.png` | purple | 第一個寶箱 | an open wooden treasure chest overflowing with gold coins |
| 7 | `badge_chests10.png` | purple | 寶箱獵人 | a pile of several wooden treasure chests, with a magnifying glass or an explorer hat beside them |
| 8 | `badge_mystery1.png` | purple | 一個大秘寶 | a purple mystery chest with glowing question-mark sparkles floating above it |
| 9 | `badge_catch5.png` | purple | 星星捕手 | a small hand catching one glowing golden star |
| 10 | `badge_catch10.png` | purple | 星海傳說 | a small hand holding a handful of glowing golden stars |
| 11 | `badge_earn1000.png` | gold | 獲得 1000 分 | a gold medal engraved with the text "1000 分" |
| 12 | `badge_earn2000.png` | gold | 獲得 2000 分 | a gold medal engraved with the text "2000 分" |
| 13 | `badge_earn3000.png` | gold | 獲得 3000 分 | a gold medal engraved with the text "3000 分" |
| 14 | `badge_earn4000.png` | gold | 獲得 4000 分 | a gold medal engraved with the text "4000 分" |
| 15 | `badge_earn5000.png` | gold | 獲得 5000 分 | a gold medal engraved with the text "5000 分" |
| 16 | `badge_earn6000.png` | gold | 獲得 6000 分 | a gold medal engraved with the text "6000 分" |
| 17 | `badge_earn7000.png` | gold | 獲得 7000 分 | a gold medal engraved with the text "7000 分" |
| 18 | `badge_earn8000.png` | gold | 獲得 8000 分 | a gold medal engraved with the text "8000 分" |
| 19 | `badge_earn9000.png` | gold | 獲得 9000 分 | a gold medal engraved with the text "9000 分" |
| 20 | `badge_earn10000.png` | gold | 獲得 10000 分 | a gold medal engraved with the text "10000 分" |
| 21 | `badge_special1.png` | gold | 第一個特殊任務 | a fortune-telling crystal ball with a check mark beside it |
| 22 | `badge_special5.png` | gold | 特殊任務達人 | a fortune-telling crystal ball with a small medal badge beside it |
| 23 | `badge_streak7.png` | gold | 連續 7 天冒險 | a calendar page with exactly 7 small boxes, all checked, and a small flame beside it (no numbers) |
| 24 | `badge_goldHero.png` | green | 金島小英雄 | a little caped hero in a miner's helmet holding a glowing gold ore, a small energy tower behind (added 2026-11-08) |
| 25 | `badge_woodHero.png` | green | 木島小英雄 | a little hero in a leaf cape holding a glowing pinecone, a glowing fairy great tree with fireflies behind (added 2026-11-08, may be delivered later) |
| 26 | `badge_locked.png` | gray | （未解鎖） | a padlock with a question mark |

## Prompt template (swap the motif and rim color for each badge)

```
Bright cute chibi 3D game achievement badge icon, round badge with a thick {rim color} rim, {motif} in the center, soft lighting, rounded shapes, clear silhouette, plain white background, centered with margin, no text, no watermark.
```

Deliverables: 26 PNGs + one contact sheet showing all badges side by side + `CODEX_HANDOFF.md` listing each file name and any notes.
