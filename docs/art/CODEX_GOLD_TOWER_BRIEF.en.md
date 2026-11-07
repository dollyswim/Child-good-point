# Gold Island Finishing: Energy Tower & Technician (for Codex)

> 2026-11-07 | Chinese version: `CODEX_GOLD_TOWER_BRIEF.md` | Parent decisions: the tower "powers on after the child reaches tile 80"; the technician "says one line when tapped".
> Fireworks and ribbons at tile 100 are already done in code — no art needed.

## Placement (already reserved; do not change the backgrounds)
- Background `region03` "Gear Workshop" (1080×1350), upper-right clearing: **center (850, 190), about 220×180px** (Gold Island world coordinates (850, 1540)).
- The road and tiles nearby are at x 550–700; the tower and technician must stay inside the clearing and not cover the road.
- The glowing pipes on the right side of region04 stay as they are (static). **No pipe on/off art this time.**

## Deliverables (3 images)
| File | Content | Size |
|---|---|---|
| `tower_off.png` | Energy tower, **unpowered**: lights and energy core dark gray, no glow — clearly "waiting to be lit up" | 880×720 |
| `tower_on.png` | Energy tower, **powered**: **exactly the same composition and position as off**; only the core glows warm gold, lights are on, a few sparks/glow at the top | 880×720 |
| `technician.png` | Technician: a cute chibi mechanic (goggles, overalls, holding a wrench), facing front-left, waving happily | 512×512 |

## Common spec
- **Transparent-background PNG** (overlaid on the map), clean edges, no white or gray fringe; a small soft semi-transparent ground shadow under the subject is fine.
- Tower: bottom aligned to the image's lower edge (feet about 5% above it); the app anchors it by the bottom-center.
- Style: match Gold Island — bright chibi 3D, consistent with the golden gears and brass pipes in the Gear Workshop background. The tower is a gold-and-brass machine tower with gears and an energy core (a round crystal or orb is suggested).
- At about 110×90px on a phone, the dark vs. lit difference must still be obvious.
- Technician must read clearly at about 60px tall. Original character — must not resemble characters from existing works.
- No text, numbers, watermarks or signatures.

## How the app will use it (for reference)
- Before the child reaches tile 80: show `tower_off`; from the first time they reach tile 80: `tower_on`, permanently.
- The technician stands at the tower's lower left; tapping shows one line:
  - Unpowered: "The energy tower has no power yet! Reach tile 80 to light it up!"
  - Powered: "Thank you! The tower is lit — the Golden Crown Castle is just ahead!"

## Prompt templates
```
Bright cute chibi 3D game prop, a gold-and-brass mechanical energy tower with interlocking gears, pipes and a round energy-crystal core, {unpowered: core dark gray, all lights off, no glow | powered: core glowing warm gold, lights on, a few sparks at the top}, soft lighting, rounded shapes, transparent background, centered, tower base near the bottom edge, no text, no watermark.
```
```
Bright cute chibi 3D original game character, a small mechanic wearing goggles and overalls, holding a wrench, facing front-left and waving happily, full body, soft lighting, rounded shapes, transparent background, no text, no watermark.
```

Deliverables: 3 PNGs + preview images placed on region03 (one off, one on) + `CODEX_HANDOFF.md`.
