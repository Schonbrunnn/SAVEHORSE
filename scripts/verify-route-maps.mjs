import assert from 'node:assert/strict';
import { MAPS } from '../game-src/gameData.js';
import { Traversal } from '../game-src/Traversal.js';
import { hasRouteFlags, atGroundTrigger } from '../game-src/RouteMaps.js';

// Execute the real traversal controller with renderer-free display doubles.
// Geometry checks are conservative reachability checks, not device/game-feel QA.
function shape(x = 0, y = 0) {
  const o = { x, y, width: 256, height: 256, displayHeight: 256, active: true,
    body: { enable: true, checkCollision: {} }, destroy() { this.active = false; this.body.enable = false; } };
  for (const name of ['setOrigin', 'setDepth', 'setAlpha', 'setTileScale', 'setScrollFactor', 'setCrop', 'setFlipX', 'refreshBody', 'setVisible', 'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'lineBetween', 'fillRect', 'fillCircle']) o[name] = () => o;
  o.setText = value => { o.text = value; return o; };
  o.setDisplaySize = (w, h) => { o.displayWidth = w; o.displayHeight = h; return o; };
  o.setScale = v => { o.displayHeight = o.height * v; return o; };
  return o;
}
function fixture(map, flags = []) {
  const scene = { map, routeRestore: { flags }, waveState: { complete: false }, projectiles: [],
    add: { text: shape, image: shape, graphics: shape, tileSprite: shape },
    solids: { create: shape }, textures: { get: () => ({ getSourceImage: () => ({ width: 256 }), get: () => ({ width: 64, height: 96 }) }) },
    tweens: { add: spec => spec.onComplete?.() }, soundBus: { play() {} }, showNotice() {}, setObjective() {},
    spawnHitParticles() {}, hearts: [], spawnHeart(x, y) { this.hearts.push({ x, y }); },
    setArenaLock(left, right, floorY) { this.activeLock = { left, right, floorY }; },
    clearArenaLock() { this.activeLock = null; },
    spawnEnemy(spec) { return { ...spec, alive: true }; }, destroyProjectile(p) { p.active = false; },
  };
  scene.player = { body: { x: map.introX, y: 515,
    body: { velocity: { y: 0 }, blocked: { down: true }, touching: { down: false }, reset(x, y) { scene.player.body.x = x; scene.player.body.y = y; } }, setVelocity() {} },
    facing: 1, hp: 100, maxHp: 100 };
  const traversal = new Traversal(scene); scene.traversal = traversal;
  return { scene, traversal, player: scene.player };
}
for (const map of MAPS) {
  const { scene, traversal, player } = fixture(map);
  for (const gate of traversal.seals) {
    assert.equal(gate.body.displayHeight, map.route.bottom - map.route.top, 'seals span the actual physics world');
    assert.equal(gate.open, false);
    assert.ok(gate.x > 0 && gate.x < map.width);
  }
  for (const [event, ids] of Object.entries(map.route.requirements)) {
    assert.equal(traversal.canEnter(event), false);
    for (const id of ids) assert.ok(map.route.objects.some(o => o.id === id), 'required switch exists');
  }
  const mini = map.route.minis[0];
  assert.equal(traversal.canEnter('wave'), true, 'opening waves never depend on a boss or switch');
  const flowSeal = traversal.seals.find(s => s.id === 'wave-exit');
  assert.equal(flowSeal.open, false);
  traversal.activate('wave-clear');
  assert.equal(flowSeal.open, true, 'ordinary wave clear opens only its physical exit');
  player.body.x = mini.entry.x; player.body.y = mini.floorY - 75;
  if (mini.needsWave) { traversal.update(16); assert.equal(traversal.activeMini, undefined, 'no simultaneous wave and mini lock'); }
  scene.waveState.complete = true;
  if (mini.triggerX) {
    player.body.x = mini.triggerX - 1;
    traversal.update(16); assert.equal(traversal.activeMini, undefined, 'approach remains safe until the later trigger');
    player.body.x = mini.entry.x;
  }
  player.body.y -= 180;
  traversal.update(16); assert.equal(traversal.activeMini, undefined, 'do not capture a player passing on another layer');
  player.body.y = mini.floorY - 75;
  traversal.update(16);
  assert.equal(traversal.activeMini.spec.id, mini.id);
  assert.equal(scene.miniCheckpoint, mini.id);
  assert.equal(scene.activeLock.floorY, mini.floorY);
  const enemy = traversal.activeMini.enemy;
  const missile = { active: true, sourceEnemy: enemy }, other = { active: true, sourceEnemy: {} };
  scene.projectiles.push(missile, other);
  const switchSpec = map.route.objects.find(o => o.requires?.includes(mini.id) && ['lever', 'power'].includes(o.type));
  if (switchSpec) {
    player.body.x = switchSpec.x - 50; player.body.y = switchSpec.y - 75;
    traversal.attack(player, 100, 30);
    assert.equal(traversal.flags.has(switchSpec.id), false, 'guardian is not skippable by attacking its switch');
  }
  traversal.onMiniDefeated(enemy);
  assert.equal(scene.activeLock, null); assert.equal(scene.miniCheckpoint, null);
  assert.ok(traversal.flags.has(mini.id));
  assert.equal(missile.active, false); assert.equal(other.active, true);
  assert.ok(scene.hearts.some(p => p.y === mini.floorY - 58), 'reward uses the room height');
  if (switchSpec) {
    traversal.attack(player, 100, 30); assert.ok(traversal.flags.has(switchSpec.id));
    const flagsBefore = traversal.flags.size;
    traversal.attack(player, 100, 30); assert.equal(traversal.flags.size, flagsBefore, 'one-shot switch');
  }
  const snapshot = traversal.snapshot();
  const restored = fixture(map, snapshot.flags).traversal;
  assert.deepEqual([...restored.flags], snapshot.flags);
  assert.ok(restored.flags.has(mini.id), 'restored route does not respawn cleared guardians');
  for (const m of map.route.minis) {
    const deck = map.terrain.find(t => t.type === 'platform' && Math.abs(t.y - m.floorY) < 2 && t.x - t.width / 2 <= m.left + 48 && t.x + t.width / 2 >= m.right - 48);
    const floor = map.route.floors.find(f => f.y === m.floorY && f.left <= m.left + 48 && f.right >= m.right - 48);
    assert.ok(deck || floor, 'locked guardian arena must have a continuous safe floor');
    assert.ok(m.entry.x > m.left + 40 && m.entry.x < m.right - 40);
  }
  assert.equal(atGroundTrigger({ x: map.width, y: 515 }, map.width - 100), true);
  assert.equal(atGroundTrigger({ x: map.width, y: 1055 }, map.width - 100), false, 'lower room cannot trigger ground exit/boss');
  assert.equal(atGroundTrigger({ x: map.width, y: -285 }, map.width - 100), false, 'upper room cannot trigger ground exit/boss');
}

const firstMap = MAPS[0], firstMini = firstMap.route.minis[0];
assert.ok(firstMini.needsWave);
assert.ok(firstMini.triggerX >= firstMap.width * 0.6, 'first guardian belongs to the latter part of Map1');
assert.ok(firstMini.entry.x >= firstMini.triggerX, 'retry enters the same late encounter');
assert.ok(firstMini.left > firstMap.waveZone.right, 'guardian room is beyond both ordinary waves');
const opener = fixture(firstMap);
for (const x of [firstMap.introX, 740, firstMap.waveZone.trigger, firstMini.entry.x]) {
  opener.player.body.x = x; opener.player.body.y = firstMini.floorY - 75;
  opener.traversal.update(16); assert.equal(opener.traversal.activeMini, undefined, 'no guardian before ordinary waves are cleared');
}
assert.equal(atGroundTrigger({ x: 5000, y: 375 }, 4800), false, 'y450 platform is not the ground-floor arena');

// Both orders must open the same final door, but either circuit alone cannot.
for (const order of [['base-north', 'base-south'], ['base-south', 'base-north']]) {
  const { traversal } = fixture(MAPS[2], ['mini-core']);
  traversal.activate(order[0]); assert.equal(traversal.canEnter('boss'), false); assert.equal(traversal.seals[0].open, false);
  traversal.activate(order[1]); assert.equal(traversal.canEnter('boss'), true); assert.equal(traversal.seals[0].open, true);
}
const cave = fixture(MAPS[1]);
cave.traversal.activate('mini-quarry');
const optionalBridge = cave.traversal.objects.find(o => o.type === 'bridge');
assert.equal(optionalBridge.body.body.enable, false, 'optional win must not close the mandatory descent before the lever is reached');
cave.traversal.activate('cave-counterweight');
assert.equal(optionalBridge.body.body.enable, true);
assert.equal(cave.traversal.canEnter('boss'), true);
assert.equal(cave.traversal.canEnter('cabin'), false);
cave.player.body.x = 4500; cave.player.body.y = 515;
cave.traversal.attack(cave.player, 180, 100);
assert.equal(cave.traversal.canEnter('cabin'), false, 'cannot break lower wall from the upper road');
cave.player.body.y = 1045;
cave.traversal.attack(cave.player, 180, 100);
assert.equal(cave.traversal.canEnter('cabin'), true);

// Analytical jump envelope: launch second jump at first apex; allow margin for
// taps away from the exact apex. Check every intentional stair transition for A/B.
const gravity = 1520;
const firstApex = 610 / gravity;
const firstRise = 610 ** 2 / (2 * gravity);
const maxRise = firstRise + 560 ** 2 / (2 * gravity);
for (const map of MAPS) {
  const stairs = map.route.platforms;
  const reached = new Set();
  const surfaces = [...map.route.floors.filter(f => f.y === 590).map(f => ({ x: (f.left + f.right) / 2, width: f.right - f.left, y: f.y })), ...stairs];
  surfaces.forEach((s, i) => { if (s.y === 590) reached.add(i); });
  for (let pass = 0; pass < surfaces.length; pass++) for (let j = 0; j < surfaces.length; j++) {
    if (reached.has(j)) continue;
    const b = surfaces[j];
    for (const i of reached) {
      const a = surfaces[i], rise = a.y - b.y;
      if (rise <= 0 || rise > maxRise - 25) continue;
      const fallTime = (560 + Math.sqrt(560 ** 2 - 2 * gravity * (rise - firstRise))) / gravity;
      const gap = Math.max(0, Math.abs(a.x - b.x) - a.width / 2 - b.width / 2) + 60;
      if (gap < 325 * (firstApex + fallTime) - 35) reached.add(j);
    }
  }
  for (const p of stairs) assert.ok(reached.has(surfaces.indexOf(p)), `Map${map.id} platform ${p.x},${p.y} must be reachable without a powered lift`);
  for (const lift of map.route.objects.filter(o => o.type === 'lift' && o.lowY > 720)) {
    assert.equal(map.route.floors.some(f => f.y === lift.highY && lift.x >= f.left && lift.x <= f.right), false, 'underground lift must rise through a real gap, not the underside of a solid floor');
    assert.ok(map.route.floors.some(f => f.y === lift.highY && Math.min(Math.abs(lift.x - f.left), Math.abs(lift.x - f.right)) < 230), 'lift must reconnect within jumping distance');
    const clearance = lift.width / 2 + 15 + 29;
    assert.equal(map.route.floors.some(f => f.y === lift.highY && lift.x + clearance > f.left && lift.x - clearance < f.right), false,
      'entire rider, not only the lift center, must clear the upper-floor underside');
  }
}
assert.equal(hasRouteFlags(new Set(), undefined), true);
console.log('PASS: full-height necessary seals, 2D progression, three guardian lifecycles, preserved switches, both circuit orders, optional shortcut safety, room-local rewards and conservative double-jump/lift geometry.');
