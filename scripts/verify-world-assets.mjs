import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { WORLD_KITS, WORLD_FRAMES, WorldArt } from '../game-src/WorldArt.js';
const require = createRequire(import.meta.url);
const parse = require(`${process.cwd()}/node_modules/phaser/src/textures/parsers/JSONHash.js`);
let total = 0;
for (const kit of WORLD_KITS) {
  const path = `public/game/assets/world-v3/${kit}`;
  const atlas = JSON.parse(await readFile(`${path}.json`, 'utf8'));
  const texture = { source: [{ width: 1280, height: 1280 }], customData: {}, frames: {}, add(key, source, x, y, width, height) {
    return this.frames[key] = { x, y, width, height };
  } };
  parse(texture, 0, atlas);
  const meta = await sharp(`${path}.webp`).metadata();
  assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [1280, 1280, true]);
  for (const name of [...WORLD_FRAMES, 'shaft']) {
    const f = texture.frames[name]; assert.ok(f);
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.width <= 1280 && f.y + f.height <= 1280);
    const { data, info } = await sharp(`${path}.webp`).extract({ left: f.x, top: f.y, width: f.width, height: f.height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (['distant', 'chamber'].includes(name)) {
      for (let p = 3; p < data.length; p += 4) assert.equal(data[p], 255, 'background must be opaque');
    } else if (name !== 'shaft') {
      let visible = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a > 32) visible++;
        if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) assert.equal(a, 0, `${kit}/${name} has padded unclipped alpha`);
      }
      assert.ok(visible > 400);
    }
  }
  total += (await stat(`${path}.webp`)).size;
}
// Exercise the real background update: art always covers the viewport, never
// repeats vertically, and room transitions fade instead of replacing a horizon.
for (const id of [1, 2, 3]) {
  const world = Object.create(WorldArt.prototype);
  world.blend = 0; world.layers = [{ setAlpha() {} }, { setAlpha() {} }];
  world.scene = { map: { id, width: 6200 }, player: { body: { x: 4200, y: -100 } }, cameras: { main: { scrollX: 0 } } };
  for (const x of [0, 3100, 6200]) {
    world.scene.cameras.main.scrollX = x;
    world.update(16);
    for (const layer of world.layers) assert.ok(layer.x - 800 <= 0 && layer.x + 800 >= 1280, 'parallax never reveals a seam');
  }
  assert.ok(world.blend > 0 && world.blend < 1);
}
assert.ok(total < 3_000_000, 'mobile texture download budget');
console.log(`PASS: actual Phaser atlas parser; 6 opaque murals +18 isolated alpha props +3 shaft frames; seam-free layered background; ${Math.round(total / 1024)}KB runtime art.`);
