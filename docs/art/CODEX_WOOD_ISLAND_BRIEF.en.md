# For Codex: Wood Island, 100 tiles (Step 1: whole-island layout draft + Region 1 background)

> 2026-11-07 | Chinese version: `CODEX_WOOD_ISLAND_BRIEF.md` | Overall plan: `WOOD_ISLAND_PLAN.md`.
> Wood Island is the second island. Its structure is **identical to Gold Island**: one 1080 × 5400 long map, walked bottom to top, made of four 1080 × 1350 backgrounds. Use the Gold Island delivery (`gold_island_overview.jpg`, `gold_island_coordinates_1_100.json`) as the format reference.

## Deliverables this round
### A. Whole-island layout draft (deliver first; to be approved)
- One **rough** 1080 × 5400 overview (sketch or low detail is fine), four regions bottom to top: Forest Entrance (1–30), Vine Bridges (31–55), Treehouse Village (56–80), Spirit Great Tree (81–100).
- A **suggested coordinates JSON** for tiles 0 (start) to 100 (world coordinates + each tile's `backgroundId`).
- One review image with tile numbers.
- The draft is only for approving the route and themes; final backgrounds start **after the parent approves**.

### B. Region 1 "Forest Entrance" final background (after the draft is approved)
- `wood_region01.png`, 1080 × 1350, world y = 4050–5400.
- Final coordinates for tiles 1–30 in `wood_region01_tiles_final.json`, plus a **top 320px seam reference** (for Region 2 to connect to).

## Common spec (same as Gold Island)
- PNG. **No tiles, no text, no characters, no UI** in the background.
- Style: cute chibi 3D, bright and saturated, same family as Gold Island (consistent lighting, perspective and path width). Wood Island is mainly greens, wood browns and flower colors, with only small gold accents.
- The path must be clear and distinct from the grass (light dirt path or wooden boardwalk). Leave about 70 × 50 of flat path around each tile center, and **nothing tall within about 70px above a tile** (event icons and characters go there).
- Distance between adjacent tile centers: **64–76px**.
- Safe zones: bottom-left about 180 × 220 (shop button) and bottom-right about 80 × 180 (zoom buttons) — no important objects or path there.
- Vertically adjacent images must join seamlessly (continuous path position and ground colors).
- Everything must be original; do not resemble scenes or characters from any existing game or animation.

## Region themes
| Region | Content | Special requirements |
|---|---|---|
| Forest Entrance (1–30) | Bright forest trail, big mushrooms, flower bushes, a stream with a small wooden bridge, sunlight through leaves | Start (tile 0) near the bottom center; tile 1 right after it |
| Vine Bridges (31–55) | Vine rope bridges and wooden walkways between tall tree trunks, hanging lantern flowers, canopy visible below | Bridge deck wide enough to hold tiles |
| Treehouse Village (56–80) | Treehouses of forest animals, spiral stairs, a small market on branches, pinecones and fruit | Leave a clearing of about 220 × 180 in the upper right (for an NPC later) |
| Spirit Great Tree (81–100) | A glowing spirit great tree at the island top, an archway formed by roots, firefly lights, blue sky | **Tile 100 in front of the root archway**, with a **300 × 200** celebration clearing in front |

## Prompt template (Region 1)
```
Vertical 1080x1350 game map background, the bottom of a cute chibi 3D forest island, bright and saturated.
A clear light dirt path starts at the bottom center and winds upward to the top edge,
lined with big mushrooms, flower bushes, ferns, a small stream and a little wooden bridge, sunlight through leaves,
the path flat and wide, nothing tall right above the path, no tiles, no characters, no text, no UI.
```
