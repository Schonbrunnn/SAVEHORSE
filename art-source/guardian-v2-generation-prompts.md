# Guardian V2 — Generation Prompts and Source Metadata

Date: 2026-09-15

Tool mode: **built-in** `image_gen.imagegen` (`image_gen__imagegen`). Exactly three independent new-image generation calls were made, one per character. No input or reference images were supplied; `referenced_image_paths` and `num_last_images_to_include` were omitted. No variants or retries were generated. Original files were left unchanged.

The requested canvas size was 2048 × 2048. The actual saved output from all three calls is **1254 × 1254 PNG, RGBA**, verified with Pillow. The alpha range is **0–255**, confirming genuine transparency. Reported transparent percentages count pixels with alpha exactly zero.

| Asset | Character | Actual dimensions | Mode | Alpha range | Fully transparent pixels | Source file |
|---|---|---|---|---|---|---|
| mini-shield | 盾卫长 | 1254 × 1254 | RGBA | 0–255 | 63.23% | `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-ea79995f-f38c-44a3-ba0e-edafd03c9dc8.png` |
| mini-quarry | 裂岩监工 | 1254 × 1254 | RGBA | 0–255 | 68.50% | `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-f08ed001-9453-4dac-97c5-5167f4b40103.png` |
| mini-core | 莓核巡卫 | 1254 × 1254 | RGBA | 0–255 | 66.07% | `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-83215e9a-efe7-4572-a390-d397ea323c2b.png` |

## Inspection notes

All images contain twelve poses arranged as four columns by three rows. Character identities and principal actions are readable, but the output does not fully satisfy the geometric layout specification: some mortal poses drift toward a three-quarter camera angle, wide attack equipment crosses ideal equal-column boundaries, and anchors/padding require normalization before runtime use. In particular, check shield frame 4 and quarry frames 4/5. Do not apply naive equal-grid slicing. The core's six petals are not consistently countable from the side. These notes describe the generated originals; no corrective image editing was performed.

## Exact prompts sent to the tool

Each code block below is the complete actual prompt string for that call, including the shared prefix followed by its character-specific suffix. No generation parameters were passed other than `prompt`.

### mini-shield — 盾卫长

Source: `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-ea79995f-f38c-44a3-ba0e-edafd03c9dc8.png`

```text
Use case: stylized-concept.
Asset type: production animation sprite sheet for a side-scrolling 2.5D action game.
Primary request: Create one BRAND NEW ORIGINAL character design from scratch as exactly TWELVE full-body animation poses on ONE square 2048 x 2048 pixel image, arranged in precisely FOUR columns and THREE rows of equal rectangular cells. This is one character's animation sheet, not multiple designs.
Scene/backdrop: genuinely transparent RGBA alpha background. Every empty pixel must have alpha zero. No white, black, gray, or colored backdrop; no checkerboard artwork, floor, shadow patches, environment, decorative effects, labels, numbers, frame outlines, grid lines, text, watermarks, logos, or copyrighted characters.
Style/medium: medium-detail hand-painted realistic 2.5D action-game sprites, crisp readable silhouettes, convincing textured metal and cloth where applicable. Controlled neutral lighting. No pixel art, no cute chibi proportions, no photomontage.
Composition/invariants: strict side view facing RIGHT in EVERY cell, no front, back, or three-quarter views. Same identity, anatomy, outfit, colors, equipment, dimensions and drawing scale across all twelve cells. One complete character and its attached equipment per cell. The imagined grid divides canvas at x=25%,50%,75% and y=33.333%,66.667%. All parts must remain fully INSIDE their own cell with at least 12% cell-width padding on left/right and at least 12% cell-height padding above/below, including every attack and the collapsed pose. Keep a fixed horizontal character anchor centered in each cell and foot/bottom anchor near 86% of cell height. Plan the same drawing scale small enough for the widest and tallest attack to fit. No clipping, no crossing cell boundaries, no separated weapon studies, no extra characters. Make actual articulated limb and equipment poses clearly distinct; do not make copies with rotation.
Frame reading order is left to right, top to bottom: row 1 frames 0,1,2,3; row 2 frames 4,5,6,7; row 3 frames 8,9,10,11. These numbers describe placement only and must not appear as text.
Character: 盾卫长, an entirely original ancient mountain-gate guardian. Enclosed bronze ritual mask with a LONG UPRIGHT CREST, dark teal lamellar armor, huge RECTANGULAR stone-and-bronze tower shield decorated with bell motifs, and a short copper baton. Keep exactly the same recognizable mask and crest throughout. This is not a hooded mercenary and has no round shield. The imposing rectangular shield is the primary weapon. Maintain shield shape and believable hand/forearm attachment in each pose.
Exact twelve distinct actions:
0: upright guarded idle, tower shield planted before torso, baton held close.
1: walking stride A, leading rightward leg forward, other leg back, shield carried.
2: walking stride B, opposite leg forward, visibly changed knee and arm positions.
3: primary shield-thrust windup, knees bent, torso pulled back, shield retracted toward chest.
4: primary shield thrust, one step lunging RIGHT and shield forcefully pushed forward, baton still close; complete shield within cell.
5: primary recovery, weight pulled back, shield halfway returning, shoulders settling.
6: heavy windup, both feet braced and huge rectangular shield lifted UP over the front of the helmet, elbow and shoulder articulation clear; crest, shield and baton all remain fully inside cell.
7: heavy strike, deep crouch, shield slammed DOWN vertically toward ground in front, shield lower edge at foot anchor; no impact cloud or debris.
8: heavy recovery, one knee bent, shield raised partway from ground, back straightening.
9: hurt recoil, torso leaning backward, shield tilted defensively and baton arm pulled inward, no gore.
10: kneeling rest, one knee down, shield propped upright beside the guardian, mask intact.
11: defeated collapsed body resting near the bottom anchor, same armor and recognizable mask/crest, tower shield lying alongside and partly over body, baton retained, whole grouping fully contained within cell.
No disconnected projectiles or background effects. Preserve genuine transparent alpha.
```

### mini-quarry — 裂岩监工

Source: `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-f08ed001-9453-4dac-97c5-5167f4b40103.png`

```text
Use case: stylized-concept.
Asset type: production animation sprite sheet for a side-scrolling 2.5D action game.
Primary request: Create one BRAND NEW ORIGINAL character design from scratch as exactly TWELVE full-body animation poses on ONE square 2048 x 2048 pixel image, arranged in precisely FOUR columns and THREE rows of equal rectangular cells. This is one character's animation sheet, not multiple designs.
Scene/backdrop: genuinely transparent RGBA alpha background. Every empty pixel must have alpha zero. No white, black, gray, or colored backdrop; no checkerboard artwork, floor, shadow patches, environment, decorative effects, labels, numbers, frame outlines, grid lines, text, watermarks, logos, or copyrighted characters.
Style/medium: medium-detail hand-painted realistic 2.5D action-game sprites, crisp readable silhouettes, convincing textured metal and cloth where applicable. Controlled neutral lighting. No pixel art, no cute chibi proportions, no photomontage.
Composition/invariants: strict side view facing RIGHT in EVERY cell, no front, back, or three-quarter views. Same identity, anatomy, outfit, colors, equipment, dimensions and drawing scale across all twelve cells. One complete character and its attached equipment per cell. The imagined grid divides canvas at x=25%,50%,75% and y=33.333%,66.667%. All parts must remain fully INSIDE their own cell with at least 12% cell-width padding on left/right and at least 12% cell-height padding above/below, including every attack and the collapsed pose. Keep a fixed horizontal character anchor centered in each cell and foot/bottom anchor near 86% of cell height. Plan the same drawing scale small enough for the widest and tallest attack to fit. No clipping, no crossing cell boundaries, no separated weapon studies, no extra characters. Make actual articulated limb and equipment poses clearly distinct; do not make copies with rotation.
Frame reading order is left to right, top to bottom: row 1 frames 0,1,2,3; row 2 frames 4,5,6,7; row 3 frames 8,9,10,11. These numbers describe placement only and must not appear as text.
Character: 裂岩监工, an entirely original stocky cave excavation foreman. Weathered ochre industrial miner apron, EXPOSED MUSCULAR ARMS, goggles and respirator with headlamp, mechanical support harness on shoulders and back, tough work boots, enormous asymmetric two-handed mining PICKHAMMER. The tool has a heavy blunt hammer face on one side and a long curved mining pick on the other. This is an industrial miner, NOT a medieval full-plate knight. Keep exactly the same goggles, respirator, headlamp, apron, harness and pickhammer identity in every frame. Both hands correctly grip the same continuous tool shaft at separated positions during every active pose, with coherent anatomy.
Exact twelve distinct actions:
0: sturdy idle, legs apart, both hands holding pickhammer low diagonally.
1: walking stride A rightward, one boot forward, other back, tool carried in both hands.
2: walking stride B, opposite boot forward, different knee bend, arms compensating for heavy tool.
3: primary windup, hips coil, knees flex, both hands draw pickhammer behind body for a horizontal sweep.
4: primary strike, torso untwists toward RIGHT, powerful horizontal pick sweep at waist height, both hands attached to continuous shaft and elbows visibly changing; pickhead and full shaft contained in cell.
5: primary recovery, sweep completes at front, body weight forward, tool lowering in both hands.
6: heavy windup, feet wide, elbows bent, enormous pickhammer raised overhead in BOTH hands, clearly separated grips; full pickhead fits beneath cell top padding.
7: heavy strike, bent knees and forward torso, tool swung down with hammer face reaching ground in front of boots, both hands holding shaft; no impact debris or background.
8: heavy recovery, muscular arms pulling hammer face up from ground, torso starts rising.
9: hurt recoil, torso recoils backward, knees buckle slightly, two-handed grip retained and headlamp/mask unchanged.
10: kneeling rest, one knee down, tool resting with head near the feet, both hands on shaft for support.
11: defeated collapsed body at bottom anchor, same ochre apron, mask and harness, pickhammer lies diagonally alongside body, all limbs and equipment contained within cell.
No disconnected projectiles, no glowing effects, no environment. Preserve genuine transparent alpha.
```

### mini-core — 莓核巡卫

Source: `/Users/quuuan/.codex/generated_images/01a0a392-c769-7520-b46a-4d8a9037782a/exec-83215e9a-efe7-4572-a390-d397ea323c2b.png`

```text
Use case: stylized-concept.
Asset type: production animation sprite sheet for a side-scrolling 2.5D action game.
Primary request: Create one BRAND NEW ORIGINAL character design from scratch as exactly TWELVE full-body animation poses on ONE square 2048 x 2048 pixel image, arranged in precisely FOUR columns and THREE rows of equal rectangular cells. This is one character's animation sheet, not multiple designs.
Scene/backdrop: genuinely transparent RGBA alpha background. Every empty pixel must have alpha zero. No white, black, gray, or colored backdrop; no checkerboard artwork, floor, shadow patches, environment, decorative effects, labels, numbers, frame outlines, grid lines, text, watermarks, logos, or copyrighted characters.
Style/medium: medium-detail hand-painted realistic 2.5D action-game sprites, crisp readable silhouettes, convincing textured metal and cloth where applicable. Controlled neutral lighting. No pixel art, no cute chibi proportions, no photomontage.
Composition/invariants: strict side view facing RIGHT in EVERY cell, no front, back, or three-quarter views. Same identity, anatomy, outfit, colors, equipment, dimensions and drawing scale across all twelve cells. One complete character and its attached equipment per cell. The imagined grid divides canvas at x=25%,50%,75% and y=33.333%,66.667%. All parts must remain fully INSIDE their own cell with at least 12% cell-width padding on left/right and at least 12% cell-height padding above/below, including every attack and the collapsed pose. Keep a fixed horizontal character anchor centered in each cell and foot/bottom anchor near 86% of cell height. Plan the same drawing scale small enough for the widest and tallest attack to fit. No clipping, no crossing cell boundaries, no separated weapon studies, no extra characters. Make actual articulated limb and equipment poses clearly distinct; do not make copies with rotation.
Frame reading order is left to right, top to bottom: row 1 frames 0,1,2,3; row 2 frames 4,5,6,7; row 3 frames 8,9,10,11. These numbers describe placement only and must not appear as text.
Character: 莓核巡卫, an entirely original AIRBORNE STRAWBERRY-REACTOR AUTOMATON. This is a compact flying machine, absolutely NOT a teddy bear, no fur, no humanoid plush body, no humanoid arms or head. Main chassis is an oval SCARLET SEGMENTED SEED-CORE with luminous CYAN MECHANICAL CENTRAL EYE facing RIGHT, SIX SMALL BRONZE PETAL STABILIZERS/ROTORS arranged around the core, TWO ARTICULATED UNDERSLUNG ENERGY EMITTERS, and folded short landing legs. Strawberry seed-like details are mechanical panels/rivets. Compact readable side silhouette. Identical chassis, cyan eye, six petals, two emitters, and landing legs across all cells. All glows are attached to emitter nozzles, compact and within the cell; no disconnected projectile, beam, sparks, smoke, or background effect.
Exact twelve distinct actions:
0: level idle hover facing RIGHT, bronze petals half-open, short landing legs tucked, both underslung cannons folded.
1: hover propulsion pose A, petals swept back at distinct angles, leading cannon lowered slightly, chassis remains upright side view.
2: hover propulsion pose B, petals pitched alternately upward/downward, cannon joints compensating, visibly different articulated pose rather than rotated copy.
3: primary windup, forward cannon articulates and aims RIGHT, its nozzle charging with tiny attached cyan glow, rear cannon remains folded.
4: primary fire, forward cannon recoils backwards on its joint, compact bright cyan nozzle flare attached directly to muzzle, petals braced.
5: primary recovery, front cannon relaxes downward, attached glow dims, petals settle.
6: heavy windup, all SIX petal stabilizers fan outward, BOTH underslung emitters unfold and aim forward, two small attached charge glows.
7: heavy fire, both emitters fire simultaneously with compact attached cyan muzzle glows, both cannon joints recoil, six petals spread to widest allowed position INSIDE cell padding.
8: heavy recovery, emitters lowered and folding, six petals half closing, all glows fading.
9: hurt recoil, chassis tips slightly backward while maintaining right-facing side view, petals asymmetrically buckled, emitters kicked upward, cyan eye still identifiable.
10: landing/rest, SIX petals folded close to chassis, short landing legs fully extended to reach fixed bottom anchor, cannons tucked, no separate stand.
11: defeated collapsed inert machine at bottom anchor, scarlet core tilted on ground with dark cyan eye, cannons folded underneath, damaged bronze petals including one broken petal resting against the machine, all pieces fully inside the cell. No gore.
Preserve genuine transparent alpha.
```

