import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { GUARDIAN_ART, GuardianVisual, guardianPose } from '../game-src/GuardianVisual.js';
import { MAPS } from '../game-src/gameData.js';

const report = JSON.parse(await readFile('public/game/assets/props/guardian-v2-report.json', 'utf8'));
for (const [id, art] of Object.entries(GUARDIAN_ART)) {
  const image = sharp(`public/game/assets/props/${art.file}`), meta = await image.metadata();
  assert.equal(meta.width, 2048); assert.equal(meta.height, 1536); assert.equal(meta.hasAlpha, true);
  const hashes = new Set();
  for (let frame = 0; frame < 12; frame++) {
    const raw = await image.clone().extract({ left: frame % 4 * 512, top: Math.floor(frame / 4) * 512, width: 512, height: 512 }).ensureAlpha().raw().toBuffer();
    hashes.add(createHash('sha256').update(raw).digest('hex'));
    let count = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const a = raw[(y * 512 + x) * 4 + 3];
      if (x < 28 || x > 484 || y < 28 || y > 463) assert.equal(a, 0, `${id} frame ${frame}: outer padding must remain transparent`);
      if (a > 64) count++;
    }
    assert.ok(count > 9000, `${id} frame ${frame}: complete body required`);
  }
  assert.equal(hashes.size, 12, 'all twelve poses must be independently drawn, not duplicate idle textures');
  const entry = report.assets.find(a => `mini-${a.id}` === id);
  assert.ok(entry.frames.every(f => f.bottom === 460));
  assert.ok(entry.frames.some(f => f.sourceBounds.left < (f.frame % 4) * entry.sourceWidth / 4 || f.sourceBounds.left + f.sourceBounds.width > (f.frame % 4 + 1) * entry.sourceWidth / 4), 'wide actions are preserved outside the original nominal grid');
}

function image() {
  const o = { active: true, x: 0, y: 0, frame: 0 };
  for (const key of ['setOrigin', 'setScale', 'setDepth', 'setAlpha', 'setAngle', 'setTint']) o[key] = () => o;
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setVisible = value => { o.visible = value; return o; };
  o.setFrame = value => { o.frame = value; return o; };
  o.setFlipX = value => { o.flipX = value; return o; };
  o.setTintMode = value => { o.tintMode = value; return o; };
  o.clearTint = () => { o.tintMode = 0; return o; };
  o.destroy = () => { o.active = false; };
  return o;
}
for (const map of MAPS) {
  const mini = map.route.minis[0], tasks = [];
  const scene = { add: { image }, time: { delayedCall: (_, fn) => tasks.push(fn) }, tweens: { killTweensOf() {}, add: spec => tasks.push(spec.onComplete) } };
  const visual = new GuardianVisual(scene, 400, mini.floorY, mini.id);
  const enemy = { alive: true, state: 'windup', hurtUntil: 0, hitAt: 2000, miniMove: mini.attacks[0], attackVariant: 0, body: { body: { velocity: { x: 0 } } } };
  const sync = time => visual.sync(400, mini.floorY, 1, time, enemy);
  sync(1999); assert.equal(visual.image.frame, 3);
  sync(2000); assert.equal(visual.image.frame, 4);
  sync(2000 + mini.attacks[0].activeMs); assert.equal(visual.image.frame, 5);
  enemy.attackVariant = 1; enemy.miniMove = mini.attacks[1]; enemy.hitAt = 5000;
  sync(4999); assert.equal(visual.image.frame, 6);
  sync(5000); assert.equal(visual.image.frame, 7);
  sync(5000 + mini.attacks[1].activeMs); assert.equal(visual.image.frame, 8);
  visual.setState('hurt'); assert.equal(visual.image.frame, 9, 'hurt is visible immediately, before a subsequent Hit Stop');
  enemy.hurtUntil = 7000; sync(6999); assert.equal(visual.image.frame, 9);
  enemy.cyclePhase = 'rest'; enemy.cycleUntil = 11000; sync(7000);
  assert.equal(visual.image.frame, 10); assert.equal(enemy.cycleUntil, 11000, 'Hurt cannot restart a rest cycle');
  enemy.cyclePhase = null; enemy.state = 'run'; enemy.body.body.velocity.x = -100;
  visual.sync(400, mini.floorY, -1, 7100, enemy); assert.equal(visual.image.flipX, true);
  const frozenMotion = visual.motionTime;
  visual.sync(400, mini.floorY, -1, 7100, enemy); assert.equal(visual.motionTime, frozenMotion);
  visual.flash(); assert.equal(visual.image.tintMode, 1); tasks.shift()(); assert.equal(visual.image.tintMode, 0);
  enemy.alive = false; assert.equal(guardianPose(enemy, 8000).frame, 11);
  let completed = false;
  visual.fadeDeath(() => { completed = true; }, mini.floorY);
  assert.equal(visual.image.frame, 10); tasks.shift()(); assert.equal(visual.image.frame, 11); tasks.shift()(); assert.equal(completed, true);
}
const sceneSource = await readFile('game-src/GameScene.js', 'utf8');
assert.match(sceneSource, /visual: spec\.miniBoss \? new GuardianVisual/);
assert.doesNotMatch(sceneSource, /new EnemyVisual\([^\n]*1\.3/);
console.log('PASS: 36 independent alpha-safe poses, full-width actions, common foot anchors, real visual state transitions, mirrored walking, immediate Hurt/Phaser 4 flash, recovery/rest/death and no minion-art fallback.');
