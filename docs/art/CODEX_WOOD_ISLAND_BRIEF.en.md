# For Codex: Wood Island, 100 tiles (Step 1: whole-island layout draft + Region 1 background)

> 2026-11-07 | **Updated 2026-11-09: the Wood Island story is now a "Forest Party"** (a forest fairy invites the child to prepare a party). See "2026-11-09 update" below. A draft already in progress does not need to be redone — just adjust it to these points.
> Chinese version: `CODEX_WOOD_ISLAND_BRIEF.md` | Overall plan: `WOOD_ISLAND_PLAN.md`.
> Wood Island is the second island. Its structure is **identical to Gold Island**: one 1080 × 5400 long map, walked bottom to top, made of four 1080 × 1350 backgrounds. Use the Gold Island delivery (`gold_island_overview.jpg`, `gold_island_coordinates_1_100.json`) as the format reference.

## 2026-11-09 update (Forest Party)
Story: a forest fairy invites the child to prepare a forest party — tile 8 collect pinecones, tile 40 pick flowers and berries, tile 65 make invitation cards for a bunny, a hedgehog and an owl, tile 92 decorate the party and the animals come to dance. All interactions happen in pop-up windows, so **the map background does not need to show them**. Only these changes:
1. **Fairy spots**: next to tiles 8, 40, 65 and 92 (left or right, not blocking the path), leave a flat clearing of about **80 × 120** for the forest fairy guide (about 54 × 85).
2. **Small party hints in each region** (light decoration, never blocking the path):
   - Vine Bridges: blooming flower bushes and small bushes full of red and blue berries on the platforms beside the bridges.
   - Treehouse Village: recognizable little homes of a **bunny, a hedgehog and an owl** (a tiny mailbox at the door is a plus).
   - Spirit Great Tree: make the 300 × 200 celebration clearing in front of tile 100 a **party lawn** (a small picnic table at the side, string lights hanging between branches), keeping the middle empty.
3. The old "220 × 180 clearing in the upper right of Treehouse Village for an NPC" is **cancelled** (replaced by point 1).
4. Everything else (route, tile spacing, safe zones, seams, no tiles/characters/text) stays the same.

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
| Forest Entrance (1–30) | Bright forest trail, big mushrooms, flower bushes, a stream with a small wooden bridge, a few piles of autumn leaves, sunlight through leaves | Start (tile 0) near the bottom center; tile 1 right after it; fairy spot beside tile 8 |
| Vine Bridges (31–55) | Vine rope bridges and wooden walkways between tall tree trunks, hanging lantern flowers, canopy visible below; flower bushes and berry bushes on the platforms | Bridge deck wide enough to hold tiles; fairy spot beside tile 40 |
| Treehouse Village (56–80) | Treehouses of forest animals (bunny, hedgehog, owl), spiral stairs, a small market on branches, pinecones and fruit | Fairy spot beside tile 65 |
| Spirit Great Tree (81–100) | A glowing spirit great tree at the island top, an archway formed by roots, firefly lights, blue sky; a party lawn in front of the archway (small picnic table, string lights) | **Tile 100 in front of the root archway**, with a **300 × 200** celebration clearing in front (middle kept empty); fairy spot beside tile 92 |

## Prompt template (Region 1)
```
Vertical 1080x1350 game map background, the bottom of a cute chibi 3D forest island, bright and saturated.
A clear light dirt path starts at the bottom center and winds upward to the top edge,
lined with big mushrooms, flower bushes, ferns, a small stream and a little wooden bridge, a few piles of autumn leaves, sunlight through leaves,
the path flat and wide, nothing tall right above the path, a few small flat clearings beside the path, no tiles, no characters, no text, no UI.
```
