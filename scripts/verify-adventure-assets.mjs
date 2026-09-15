import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { ENVIRONMENT_ART } from '../game-src/EnvironmentArt.js';
import { Traversal } from '../game-src/Traversal.js';
const require = createRequire(import.meta.url);
const overlapY = require(`${process.cwd()}/node_modules/phaser/src/physics/arcade/GetOverlapY.js`);
const constants = require(`${process.cwd()}/node_modules/phaser/src/physics/arcade/const.js`);

for (const file of Object.values(ENVIRONMENT_ART)) {
  const image = sharp(`public/game/assets/props/${file}`);
  const meta = await image.metadata();
  assert.equal(meta.hasAlpha, true, `${file} needs alpha`);
  assert.ok(meta.width > 40 && meta.height > 40);
}
for (const hero of ['a', 'b']) {
  const original = await sharp(`public/game/assets/atlases/player-${hero}/idle.png`).ensureAlpha().raw().toBuffer();
  const [left, top, width, height] = hero === 'a' ? [290, 65, 57, 70] : [215, 82, 42, 65];
  for (let frame = 0; frame < 12; frame++) {
    const { data, info } = await sharp(`public/game/assets/props/motion-${hero}-${frame}-v2.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 512); assert.equal(info.height, 512);
    let error = Infinity;
    // The entire A cutout shifts vertically only to anchor its soles. Search
    // that translation; verify opaque facial RGB against the original pixels.
    for (let dy = -45; dy <= 45; dy++) {
      let total = 0, count = 0;
      for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
        const old = (y * 512 + x) * 4, now = ((y + dy) * 512 + x) * 4;
        if (original[old + 3] < 250) continue;
        total += Math.abs(data[now] - original[old]) + Math.abs(data[now + 1] - original[old + 1]) + Math.abs(data[now + 2] - original[old + 2]);
        count += 3;
      }
      error = Math.min(error, total / count);
    }
    assert.ok(error < 0.5, `hero ${hero} frame ${frame} face drift: ${error}`);
    for (let p = 0; p < 512; p++) {
      assert.equal(data[(p * 512) * 4 + 3], 0);
      assert.equal(data[(p * 512 + 511) * 4 + 3], 0);
      assert.equal(data[p * 4 + 3], 0);
      assert.equal(data[(511 * 512 + p) * 4 + 3], 0);
    }
  }
}
const collisionBody = (y, dy, stationary = false) => ({
  y, bottom: y + (stationary ? 20 : 150), _dy: dy, deltaAbsY: () => Math.abs(dy),
  checkCollision: { up: true, down: !stationary }, touching: {}, blocked: {}, physicsType: stationary ? constants.STATIC_BODY : constants.DYNAMIC_BODY,
});
const deck = collisionBody(400, 0, true);
assert.ok(overlapY(collisionBody(252, 5), deck, false, 4) > 0, 'descending player lands on top');
assert.equal(overlapY(collisionBody(417, -5), deck, false, 4), 0, 'ascending player passes through underside');
// Exercise the actual lift update before the actual Phaser Body postUpdate.
const code = await readFile('node_modules/phaser/src/physics/arcade/Body.js', 'utf8');
const match = code.match(/postUpdate: function \(\)\s*\{([\s\S]*?)\n    \},/);
assert.ok(match);
const postUpdate = new Function('CONST', `return function() {${match[1]}}`)(constants);
const sprite = { x: 3530, y: 465, body: { velocity: { y: 0 }, position: { x: 3506, y: 390 }, prevFrame: { x: 3501, y: 390 }, deltaMax: { x: 0, y: 0 }, moves: true, updateCenter() {}, autoFrame: { set() {} } } };
sprite.body.gameObject = sprite;
const lift = { type: 'lift', x: 3530, y: 540, lowY: 540, highY: 300, width: 270, body: { refreshBody() {} }, visual: {} };
const route = Object.assign(Object.create(Traversal.prototype), { elapsed: 1600, scene: { player: { body: sprite } }, objects: [lift] });
route.update(16);
const delta = lift.y - 540;
postUpdate.call(sprite.body);
assert.equal(sprite.x, 3535, 'lift preserves the current horizontal physics step');
assert.equal(sprite.y, 465 + delta, 'apply vertical carry once');
console.log('PASS: all environment alpha; 24 unclipped motion frames with original facial pixels; true Phaser one-way collision and lift postUpdate.');
