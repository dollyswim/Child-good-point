# For Codex: Gold Island "Gear Workshop" background (tiles 56–80)

> English version of `CODEX_GOLD_REGION03_BRIEF.md` (sections match one-to-one).
> Third image from the bottom of the long map (1080 × 5400), **world y = 1350–2700**; directly below is "Crystal Mine Valley" (y = 2700–4050, approved v3).
> Tiles 56 and 57 sit on the top road of the Crystal Mine Valley image (not in this image). This image covers tiles 58–80; tile 81 lands near the top of this image (logically part of region 4).

## Common specs (same as Crystal Mine Valley)
- Size **1080 × 1350 (4:5)**, PNG. **No tiles, no text, no characters in the background.**
- Keep the style of regions 1 and 2: cute chibi 3D, bright, gold accents; same path width, perspective and brightness.
- Leave a flat road area of about 70 × 50 around each tile center, and **keep tall objects out of the ~70px above each tile** (event icons and the character go there).
- Keep adjacent tile centers **64–76px** apart. The route may be fine-tuned; please deliver a **final coordinates JSON** with the image (same format as Crystal Mine Valley: `gold_region0X_tiles_final.json`, normalized 0–1 coordinates within the image plus world coordinates).
- Safe areas: avoid important objects or the path in the bottom-left ~180 × 220 (shop button) and bottom-right ~80 × 180 (zoom buttons).
- Story events are deferred; only reserve empty clearings (see below).

## Seam (most important)
- **The bottom edge must join the top edge of Crystal Mine Valley seamlessly.** Reference: `docs/art/region02_top_seam_reference.png` (top 320px of the approved v3 Crystal Mine Valley image).
- Measured road position at the top edge of Crystal Mine Valley: **x ≈ 500–612 (center ≈ 556)**, heading up and to the right. The road at the bottom of this image must start at the same position and width; the grass on the left and the rock wall / waterfall on the right should continue too.
- The top edge will join "Golden Crown Castle": please let the road leave the top edge around **x ≈ 650–720** (tile 81 is near the top of this image), with terrain on both sides that can continue.
- As with Crystal Mine Valley, we recommend **splitting both images from one shared seam image**. If the top 320px of Crystal Mine Valley needs retouching, deliver region02 and region03 as a pair.

## Path and tiles (proposed coordinates)
Tiles 56–57 are on the Crystal Mine Valley image and are listed for reference. The route was re-spaced evenly (about 70px apart) starting from tile 55's actual position (520, 2850) and your suggested tile 56 (540, 83). **It differs from tiles 56–58 in draft v2; please use this table.**

| Tile | Stable ID | Type | Image | x (px) | y (px in image) | x (0–1) | y (0–1) |
|---|---|---|---|---|---|---|---|
| 56 | gold-03-056 | normal | Crystal Mine Valley (done) | 540.0 | 83.0 | 0.5000 | 0.0615 |
| 57 | gold-03-057 | normal | Crystal Mine Valley (done) | 586.0 | 30.2 | 0.5426 | 0.0224 |
| 58 | gold-03-058 | chance | Gear Workshop | 633.2 | 1328.4 | 0.5863 | 0.9840 |
| 59 | gold-03-059 | normal | Gear Workshop | 679.0 | 1275.5 | 0.6287 | 0.9448 |
| 60 | gold-03-060 | chest | Gear Workshop | 717.5 | 1217.3 | 0.6643 | 0.9017 |
| 61 | gold-03-061 | normal | Gear Workshop | 742.0 | 1152.5 | 0.6871 | 0.8537 |
| 62 | gold-03-062 | minigame | Gear Workshop | 744.9 | 1083.6 | 0.6897 | 0.8027 |
| 63 | gold-03-063 | normal | Gear Workshop | 724.9 | 1017.4 | 0.6712 | 0.7536 |
| 64 | gold-03-064 | chance | Gear Workshop | 688.9 | 957.6 | 0.6379 | 0.7093 |
| 65 | gold-03-065 | normal | Gear Workshop | 644.4 | 903.7 | 0.5967 | 0.6694 |
| 66 | gold-03-066 | fate | Gear Workshop | 595.7 | 853.3 | 0.5515 | 0.6321 |
| 67 | gold-03-067 | chest | Gear Workshop | 545.1 | 804.9 | 0.5048 | 0.5962 |
| 68 | gold-03-068 | normal | Gear Workshop | 494.5 | 756.5 | 0.4578 | 0.5604 |
| 69 | gold-03-069 | fate | Gear Workshop | 445.2 | 706.7 | 0.4122 | 0.5235 |
| 70 | gold-03-070 | chance | Gear Workshop | 399.6 | 653.7 | 0.3700 | 0.4842 |
| 71 | gold-03-071 | normal | Gear Workshop | 361.4 | 595.4 | 0.3346 | 0.4410 |
| 72 | gold-03-072 | minigame | Gear Workshop | 337.3 | 530.3 | 0.3123 | 0.3928 |
| 73 | gold-03-073 | normal | Gear Workshop | 335.0 | 461.3 | 0.3102 | 0.3417 |
| 74 | gold-03-074 | chest | Gear Workshop | 355.8 | 395.1 | 0.3294 | 0.2927 |
| 75 | gold-03-075 | normal | Gear Workshop | 392.3 | 335.6 | 0.3632 | 0.2486 |
| 76 | gold-03-076 | fate | Gear Workshop | 437.1 | 281.7 | 0.4047 | 0.2087 |
| 77 | gold-03-077 | chance | Gear Workshop | 486.0 | 231.7 | 0.4500 | 0.1716 |
| 78 | gold-03-078 | chest | Gear Workshop | 536.6 | 183.2 | 0.4968 | 0.1357 |
| 79 | gold-03-079 | minigame | Gear Workshop | 587.3 | 134.9 | 0.5438 | 0.0999 |
| 80 | gold-03-080 | region boundary | Gear Workshop | 636.5 | 85.0 | 0.5893 | 0.0630 |
| 81 | gold-04-081 | normal | Gear Workshop | 682.0 | 32.0 | 0.6315 | 0.0237 |

Conversion: normalized 0–1 within the image = px ÷ 1080, px ÷ 1350; world y = y within this image + 1350.

## Theme (Gear Workshop)
Golden gears of all sizes, steam pipes and valves, conveyor belts, small smoking chimneys, tool racks, mine cart rails leading into the workshop, a metal arch bridge, a little greenery.
- **Tile 55 "factory" clearing**: already reserved at the upper left of Crystal Mine Valley (250, 150); the lower left of this image may extend the factory surroundings (do not draw the building itself).
- **Tile 80 "energy tower" clearing**: around x 820, y 100 at the upper right of this image, keep a flat area of about 220 × 180; do not draw the tower itself.

## English prompt (paste after the shared style)
```
Vertical 1080x1350 game map background, continuation of a cute 3D golden island,
a winding sandy-stone path entering from the bottom (slightly right of center) and snaking upward
through a gear workshop: big and small golden gears, steam pipes with valves, conveyor belts,
small chimneys with soft smoke, tool racks, mine cart rails leading into the workshop,
a small metal arch bridge, some greenery, bright daylight, the path clearly visible and unobstructed,
an empty flat clearing near the upper right for a future energy tower,
no tiles, no characters, no text, no UI
```
