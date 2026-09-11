# 《宝马之路》Boss 生成记录

生成日期：2026-09-11

本文件保存 C/D 生成批次的实际逐字提示词及当时 QA。历史记录来源为项目相对路径 `../world-assets/boss-action-atlases/generation-manifest.md`；下述交付文件名相对于 `../world-assets/boss-action-atlases/`。原始参考图只记录文件名，避免依赖个人绝对路径。

当前接入与原始生成目标存在差别：C 以 `public/game/assets/generated/boss-c-actions.png` 为源构建八动作；D 以 `public/game/assets/generated/boss-d-actions.png` 提取 idle/hurt，其他六个运行状态采用同一 idle 机甲基底叠加程序特效。原批次的“八帧姿态均有差异”只描述原始生成图，不表示当前 D 每个状态都重新绘制身体。原始生成图为 RGB，后续工程已进行算法 Alpha 与分割处理；完整规则见 `docs/角色资源规范.md`。提示词中的严格身份与透明度要求属于生成意图，不是脸部与原照完全一致或真透明已达成的保证。

## 模式与调用

- 技能：`imagegen`
- 模式：built-in `image_gen`
- 意图/分类：带单张本地身份锚图的 `identity-preserve`
- 调用次数：C 一次，D 一次；没有重抽、没有 CLI/API fallback。
- 参考图 C：`秦岭杀人兔-玥玥子.png`
- 参考图 D：`草莓熊博士-珏珏子.png`

## 交付文件

### C — 秦岭杀人兔

- 推荐接入文件：`c-qinling-rabbit-action-atlas-final-solid-cyan.png`
  - 2048×1024，RGB，纯青色键控底 `#00FFFF`
  - 主体外边距：左 168px、上 73px、右 145px、下 89px
  - 精确青色像素：1,710,959（81.58%）
- 原始一次生成：`c-qinling-rabbit-action-atlas.png`
  - 1774×887，RGB，无 alpha；模型把灰色透明棋盘格烘焙进图像

### D — 草莓熊博士

- 推荐接入文件：`d-strawberry-bear-mech-action-atlas-final-solid-cyan.png`
  - 2048×1024，RGB，纯青色键控底 `#00FFFF`
  - 主体外边距：左 143px、上 68px、右 143px、下 69px
  - 精确青色像素：1,278,625（60.97%）
- 原始一次生成：`d-strawberry-bear-mech-action-atlas.png`
  - 1774×887，RGB，无 alpha；模型把灰色透明棋盘格烘焙进图像

## C 实际逐字 prompt

```text
Use case: identity-preserve
Asset type: detailed transparent 4-by-2 combat action atlas for a landscape side-scrolling browser fighting game
Input images: Image 1 is the sole character identity, costume, weapon, rendering-style, and color reference. Use it as a reference anchor only; do not reproduce its poster layout, background, captions, labels, typography, facial-expression strip, or existing contact sheet.
Primary request: Generate exactly eight distinct full-body action poses of the same single adult male pink-bunny fighter from Image 1, arranged left-to-right in a clean 4-column by 2-row atlas. Top row action order: idle; run; jump; knife attack. Bottom row action order: knife skill; gun aim; gun fire; hurt.
Identity invariants: In all eight cells preserve the exact same recognizable face, short black hair, round wire-frame glasses, skin tone, facial proportions, and adult build from Image 1. Preserve the same tall pink satin bunny-ear headband, black bow tie, glossy pink fitted bunny suit, frilled off-shoulder sleeves, long pink gloves with white cuffs, fishnet stockings, pink high heels, and white bunny tail. The character must remain unmistakably the same person and outfit in every cell.
Action specification: idle is a readable guarded neutral stance with knife lowered; run is an energetic side-view sprint; jump shows a clear airborne silhouette; knife attack is a forceful close-range slash; knife skill adds one controlled pink crescent slash effect around the knife; gun aim has the pistol held steadily with no muzzle flash; gun fire has one bright muzzle flash and subtle recoil; hurt is a backward stagger with a pained but non-gory expression. Show only the weapon relevant to each action; no floating weapon duplicates.
Scene/backdrop: genuinely transparent RGBA background throughout; no scenery, floor, shadows, colored backing, glow wash, checkerboard, grid lines, frames, or panels.
Style/medium: match Image 1's polished realistic comic-book game concept rendering, crisp dark contours, detailed fabric and skin rendering, non-pixel art, consistent lighting and scale.
Composition/framing: exact wide 2:1 atlas, 4 equal columns by 2 equal rows. One and only one complete character per cell. All poses face screen-right in a readable side or three-quarter side game view, but every action has a unique silhouette and articulation. Keep a generous fully transparent outer border and wide fully transparent gutters between cells. Leave ample safe space around every bunny ear, heel, hand, knife, pistol, muzzle flash, and slash effect. Nothing touches a cell edge and nothing is cropped or overlaps another cell.
Constraints: exactly eight poses and exactly one character in each occupied cell; no additional people; no duplicate bodies; no cloned heads; no extra limbs; no alternate faces; no costume redesign; no missing glasses; no missing bunny ears; no masks; no extra rabbits; no blood spray; no gore; no text; no letters; no numbers; no labels; no logos; no watermark; no UI; no opaque background; no pixel art.
```

## D 实际逐字 prompt

```text
Use case: identity-preserve
Asset type: detailed transparent 4-by-2 boss combat action atlas for a landscape side-scrolling browser fighting game
Input images: Image 1 is the sole pilot identity, mech design, rendering-style, material, and color reference. Use it as a reference anchor only; do not reproduce its poster composition, captions, labels, written monitor text, close-up inset, accessory showcase, existing mini-pose strip, or background.
Primary request: Generate exactly eight distinct action poses of the same single large strawberry-bear mech with the same pilot visibly seated in its open top cockpit in every cell, arranged left-to-right in a clean 4-column by 2-row atlas. Top row action order: mech idle; charge; summon; three-lane shot. Bottom row action order: fan shot; laser; overload; hurt.
Pilot identity invariants: In every cell preserve the same recognizable adult male pilot from Image 1: identical face, skin tone, short spiky brown hair, black sunglasses, pink hooded sweatshirt, white harness straps, and red ball-top control sticks. The pilot must remain physically inside the cockpit, correctly scaled and clearly visible, never floating or duplicated.
Mech design invariants: Preserve exactly one consistent bulky pink strawberry-bear mech per cell: plush-textured hot-pink bear shell; cream muzzle and belly; dark magenta angular brows; glowing yellow eyes; maroon nose; metal jaw with triangular teeth; stitched scar detail; strawberry emblem on the belly; round bear ears with metal X hubs; open pilot cockpit above the head; black-and-brass mechanical backpack with pink screens and antenna/dish; left arm terminating in the same large circular four-barrel energy cannon; right arm terminating in the same massive three-blade claw; small rear and foot thrusters. Keep proportions, wear, materials, colors, and left/right weapon placement consistent across all eight cells.
Action specification: mech idle is a stable grounded ready stance; charge is a low forward rush with rear thrusters and a short pink-white motion trail; summon raises the claw around one abstract circular pink energy portal with nothing emerging from it; three-lane shot fires exactly three short parallel horizontal pink projectiles from the cannon; fan shot fires exactly five small pink energy rounds in a clean spreading fan from the cannon; laser fires one compact brilliant pink-white horizontal laser from the cannon; overload shows the complete mech glowing intensely with heat vents, contained electric arcs, and the pilot bracing; hurt is a unique backward recoil with localized armor sparks and the pilot grimacing, no gore. Every action must have a clearly different articulation and silhouette, not a repeated camera angle or cloned pose.
Scene/backdrop: genuinely transparent RGBA background throughout; no scenery, floor, shadows, colored backing, glow wash, checkerboard, grid lines, frames, or panels.
Style/medium: match Image 1's polished realistic comic-book game concept art, crisp dark contours, detailed plush fibers and scratched metal, cinematic mechanical lighting, non-pixel art, consistent rendering across all cells.
Composition/framing: exact wide 2:1 atlas, 4 equal columns by 2 equal rows. Exactly one complete mech-and-pilot unit per cell. Use a readable side or three-quarter side game view facing screen-right, while changing limb articulation and body lean to make all actions distinct. Keep a generous fully transparent outer border and wide fully transparent gutters between cells. Scale each full mech smaller than its cell so the entire antenna, dish, cockpit, pilot, ears, cannon, claw, legs, thrusters, projectile patterns, portal, sparks, and laser remain inside that cell with ample clear padding. Nothing touches a cell edge, nothing is cropped, and no effect enters another cell.
Constraints: exactly eight cells; exactly eight large mech units total; each cell contains one full mech and its one pilot; the sole bear form in a cell is the main large mech body itself; no summoned bear; no small bear minions; no extra mascot; no duplicate mech; no duplicate pilot; no floating heads; no accessory inset; no repeated pose; no swapped weapon arms; no missing pilot; no closed cockpit; no text; no letters; no numbers; no labels; no readable screen glyphs; no logos; no watermark; no UI; no opaque background; no pixel art; no cropped body or effects.
```

## 内容与可用性 QA

### C

- 目视确认 4×2 共 8 个动作，顺序为：idle / run / jump / knife attack / knife skill / gun aim / gun fire / hurt。
- 每格只有同一名角色；短黑发、圆框眼镜、脸型与粉色兔装保持一致。
- 八个主体均完整，兔耳、高跟鞋、刀、枪与主要特效未被画布裁切。
- 未发现文字、标签、logo、水印或额外人物。
- 原图 alpha 检查失败：PNG 为 RGB，棋盘格已烘焙；按“不重抽”的要求提供纯青底降级版本。
- 限制：刀光内原本被半透明特效包围的区域仍有少量烘焙棋盘格，需在主工程抠图时一并清理。

### D

- 目视确认 4×2 共 8 个动作，顺序为：mech idle / charge / summon / three-lane shot / fan shot / laser / overload / hurt。
- 三路线为 3 发平行弹；扇形为 5 发；召唤仅为能量门，没有出现小熊或其他召唤物。
- 每格均为一台完整机甲和驾驶舱内同一驾驶员；脸、墨镜、粉色连帽衫及机甲主设定保持一致。
- 八帧动作/姿态均有差异，没有完全重复帧；机甲、驾驶员和主要攻击特效未被画布裁切。
- 未发现文字、标签、logo、水印、额外小熊或额外驾驶员。
- 原图 alpha 检查失败：PNG 为 RGB，棋盘格已烘焙；按“不重抽”的要求提供纯青底降级版本。
- 限制：推进焰、能量门、散射弹和过载光晕内部仍保留少量与半透明光效混合的棋盘纹理，主工程需在色键处理后做局部去格纹。

## SHA-256

```text
3c454a5138de0aea30286d784221d16bd17351a17a6b163e285a74004486371d  c-qinling-rabbit-action-atlas-final-solid-cyan.png
08a20b5cf578523bcef946424e7aa69b686566617301dde6454e1c51eebc52ae  c-qinling-rabbit-action-atlas.png
10fbaec8b616fefc54960cbd8e915772d7311118a1006321a1f1ffce4247545c  d-strawberry-bear-mech-action-atlas-final-solid-cyan.png
1f4b3e45cd5ba460383f6ebd2a89f7adb503eb980b6c83ba3d61d7bf4b492e61  d-strawberry-bear-mech-action-atlas.png
```
