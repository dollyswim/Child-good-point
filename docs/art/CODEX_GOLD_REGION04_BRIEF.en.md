# For Codex: Gold Island "Golden Crown Castle" background (tiles 81–100)

> English version of `CODEX_GOLD_REGION04_BRIEF.md` (sections match one-to-one).
> ⚠️ Update 2026-11-07: Gear Workshop is approved and live. Use `docs/art/region03_top_seam_reference.png` (top 320px of Gear Workshop) as the seam reference; tile 81 final world position is (680, 1382) (y = 32 inside the Gear Workshop image); the road leaves the top of region 3 around x ≈ 680. Tiles 82–100 in the table below are the old proposal; please re-lay them from the new exit.
> The fourth and topmost image of the long map, **world y = 0–1350**; directly below is "Gear Workshop".
> **Please wait until Gear Workshop is approved before drawing this one**: the seam reference must be the top 320px of the final Gear Workshop image, and tiles 81–100 will be fine-tuned to its top exit. The table below is the current proposed route.

## Common specs (same as Crystal Mine Valley)
- Size **1080 × 1350 (4:5)**, PNG. **No tiles, no text, no characters in the background.**
- Keep the style of regions 1 and 2: cute chibi 3D, bright, gold accents; same path width, perspective and brightness.
- Leave a flat road area of about 70 × 50 around each tile center, and **keep tall objects out of the ~70px above each tile** (event icons and the character go there).
- Keep adjacent tile centers **64–76px** apart. The route may be fine-tuned; please deliver a **final coordinates JSON** with the image (same format as Crystal Mine Valley: `gold_region0X_tiles_final.json`, normalized 0–1 coordinates within the image plus world coordinates).
- Safe areas: avoid important objects or the path in the bottom-left ~180 × 220 (shop button) and bottom-right ~80 × 180 (zoom buttons).
- Story events are deferred; only reserve empty clearings (see below).

## Seam
- The bottom edge joins the top edge of Gear Workshop (the road is expected to leave Gear Workshop around x ≈ 650–720).
- The top edge is the top of the whole map, **so nothing needs to join above it**; the castle can be drawn complete at the top of the image.

## Path and tiles (proposed coordinates)
Tile 81 is near the top of the Gear Workshop image and is listed for reference.

| Tile | Stable ID | Type | Image | x (px) | y (px in image) | x (0–1) | y (0–1) |
|---|---|---|---|---|---|---|---|
| 81 | gold-04-081 | normal | Gear Workshop | 682.0 | 32.0 | 0.6315 | 0.0237 |
| 82 | gold-04-082 | normal | Golden Crown Castle | 720.1 | 1323.4 | 0.6668 | 0.9803 |
| 83 | gold-04-083 | chance | Golden Crown Castle | 743.9 | 1258.2 | 0.6888 | 0.9320 |
| 84 | gold-04-084 | normal | Golden Crown Castle | 745.5 | 1188.9 | 0.6903 | 0.8807 |
| 85 | gold-04-085 | chest | Golden Crown Castle | 723.7 | 1122.8 | 0.6701 | 0.8317 |
| 86 | gold-04-086 | normal | Golden Crown Castle | 686.6 | 1063.5 | 0.6357 | 0.7878 |
| 87 | gold-04-087 | fate | Golden Crown Castle | 641.5 | 1009.9 | 0.5939 | 0.7481 |
| 88 | gold-04-088 | normal | Golden Crown Castle | 592.4 | 960.0 | 0.5485 | 0.7111 |
| 89 | gold-04-089 | chance | Golden Crown Castle | 541.7 | 911.7 | 0.5016 | 0.6753 |
| 90 | gold-04-090 | minigame | Golden Crown Castle | 491.0 | 863.3 | 0.4546 | 0.6395 |
| 91 | gold-04-091 | chest | Golden Crown Castle | 441.8 | 813.5 | 0.4090 | 0.6026 |
| 92 | gold-04-092 | normal | Golden Crown Castle | 396.2 | 760.3 | 0.3668 | 0.5632 |
| 93 | gold-04-093 | fate | Golden Crown Castle | 358.1 | 701.7 | 0.3316 | 0.5198 |
| 94 | gold-04-094 | normal | Golden Crown Castle | 334.4 | 636.1 | 0.3096 | 0.4712 |
| 95 | gold-04-095 | chance | Golden Crown Castle | 333.7 | 566.3 | 0.3090 | 0.4195 |
| 96 | gold-04-096 | normal | Golden Crown Castle | 356.7 | 500.3 | 0.3302 | 0.3706 |
| 97 | gold-04-097 | chest | Golden Crown Castle | 394.5 | 441.3 | 0.3653 | 0.3269 |
| 98 | gold-04-098 | normal | Golden Crown Castle | 440.0 | 388.1 | 0.4074 | 0.2875 |
| 99 | gold-04-099 | minigame | Golden Crown Castle | 489.2 | 338.2 | 0.4530 | 0.2505 |
| 100 | gold-04-100 | island finish | Golden Crown Castle | 540.0 | 290.0 | 0.5000 | 0.2148 |

Conversion: normalized 0–1 within the image = px ÷ 1080, px ÷ 1350; world y = y within this image.

## Theme (Golden Crown Castle)
A golden castle (spires, flags, crown-shaped roof), a plaza in front of the castle, energy pipes running up from the tower below to the castle, bunting flags and string lights, clouds and blue sky, a little garden greenery.
- **Tile 100 (island finish) is in front of the castle gate**: leave a plaza of about 300 × 200 in front of the gate as a "celebration space" for a future clear animation.
- The tile 80 energy tower is at the upper right of Gear Workshop; the lower right of this image may show pipes extending up to the castle (do not block the road).

## English prompt (paste after the shared style)
```
Vertical 1080x1350 game map background, the top of a cute 3D golden island,
a winding sandy-stone path entering from the bottom right and climbing toward a grand golden castle
at the top with spires, flags and a crown-shaped roof, a wide plaza in front of the castle gate
for celebrations, energy pipes running from below up to the castle, bunting flags and string lights,
garden greenery, blue sky with soft clouds, bright and festive, the path clearly visible,
no tiles, no characters, no text, no UI
```
