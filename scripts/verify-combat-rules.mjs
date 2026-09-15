import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HEROES, MAPS, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, DIALOGUES } from '../game-src/gameData.js';
import { BERRY_CYCLE, RABBIT_SMASH, RABBIT_PHASE2, segmentDistance, MECH, mechPhaseReady, motionBlend, skillCooldownMs, nextStageHp } from '../game-src/CombatRules.js';

// Run the actual scene methods with a small physics/display stub, without a
// browser or Phaser renderer. This checks timing, not game feel or collision QA.
const source = (await readFile(new URL('../game-src/GameScene.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/export class /g, 'class ');
const Phaser = { Scene: class {}, Math: { Linear: (a, b, t) => a + (b - a) * t } };
const FightScene = new Function('Phaser', 'HEROES', 'MAPS', 'GAME_HEIGHT', 'GAME_WIDTH', 'GROUND_Y', 'DIALOGUES', 'BERRY_CYCLE', 'RABBIT_SMASH', 'skillCooldownMs', 'nextStageHp', 'ActionVisual', 'BossVisual', 'InputManager', 'SoundBus', 'MECH', 'mechPhaseReady', 'motionBlend', 'Traversal', 'propImage', 'RABBIT_PHASE2', 'segmentDistance', `${source}\nreturn FightScene;`)(Phaser, HEROES, MAPS, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, DIALOGUES, BERRY_CYCLE, RABBIT_SMASH, skillCooldownMs, nextStageHp, class {}, class {}, class { setEnabled(value) { this.enabled = value; } destroy() {} }, class { play() {} }, MECH, mechPhaseReady, motionBlend, class {}, () => shape(), RABBIT_PHASE2, segmentDistance);
globalThis.window = {};
const noOp = () => {};
const body = (x = 100, y = 500) => ({
  x, y, active: true,
  body: { blocked: { down: false }, touching: { down: false }, velocity: { x: 0, y: 0 }, setAllowGravity(value) { this.allowGravity = value; } },
  setVelocity(x, y) { this.body.velocity = { x, y }; return this; },
  setVelocityX(x) { this.body.velocity.x = x; return this; },
  setVelocityY(y) { this.body.velocity.y = y; return this; },
});
const scene = () => Object.assign(Object.create(FightScene.prototype), {
  time: { now: 0 }, carry: {}, player: {}, enemies: [], projectiles: [], crates: [],
  soundBus: { play: noOp }, cameras: { main: { shake: noOp, fadeOut: noOp } },
  spawnSheetFx: noOp, spawnHitParticles: noOp, impactFeedback: noOp,
  setPlayerState(state) { this.player.state = state; },
});

assert.equal(skillCooldownMs(HEROES.a), 4100);
assert.equal(skillCooldownMs(HEROES.b), 1600);
assert.equal(skillCooldownMs(HEROES.a, { skillCooldownReductionMs: 500 }), 3600);
assert.equal(skillCooldownMs(HEROES.b, { skillCooldownReductionMs: 500 }), 1100);
assert.equal(nextStageHp(42, 105), 72);
assert.equal(nextStageHp(100, 105), 105);

const flying = scene();
const bear = { body: body(), visual: { setState: noOp, sync: noOp }, cyclePhase: 'air', cycleUntil: 10000, state: 'windup', hurtUntil: 0, height: 100, facing: -1, telegraph: { destroy: noOp } };
flying.projectiles = [{ active: true, sourceEnemy: bear, image: { destroy: noOp } }];
assert.equal(flying.updateBerryCycle(bear, 9999), false);
assert.equal(flying.updateBerryCycle(bear, 10000), true);
assert.equal(bear.cyclePhase, 'landing');
assert.equal(bear.state, 'idle');
assert.equal(flying.projectiles[0].active, false);
flying.updateBerryCycle(bear, 22300);
assert.equal(bear.cyclePhase, 'landing', 'rest must begin at actual landing, not the air deadline');
bear.body.body.blocked.down = true;
flying.updateBerryCycle(bear, 22400);
assert.equal(bear.cycleUntil, 26400);
assert.equal(bear.cyclePhase, 'rest');
assert.equal(flying.updateBerryCycle(bear, 26399), true);
assert.equal(flying.updateBerryCycle(bear, 26400), false);
assert.equal(bear.cyclePhase, 'air');
assert.equal(bear.cycleUntil, 36400);
assert.equal(bear.body.body.allowGravity, false);

const paused = scene();
paused.time.now = 1000;
paused.tweens = { getGlobalTimeScale: () => 1 };
paused.enemies = [{ cycleUntil: 11000, nextAttack: 2500 }];
paused.boss = { nextSmash: 5000, aimLockAt: 1600, comboSecondAt: 2320 };
const snapshot = paused.captureCombatDeadlines();
paused.time.now = 6000;
paused.shiftCombatDeadlines(snapshot);
assert.equal(paused.enemies[0].cycleUntil, 16000);
assert.equal(paused.boss.nextSmash, 10000);
assert.equal(paused.boss.aimLockAt, 6600);
assert.equal(paused.boss.comboSecondAt, 7320);

const shopper = scene();
shopper.merchantVisited = true;
shopper.carry = { skillCooldownReductionMs: 0, slowUntil: 10 };
shopper.time.now = 5000;
shopper.combatPauseSnapshot = { clockTime: 1000 };
shopper.player = { hp: 35, body: body(), skillReadyAt: 2000 };
shopper.setPhysicsPause = shopper.setObjective = noOp;
shopper.inputManager = { setEnabled: noOp };
shopper.chooseShopItem('badfruit');
assert.equal(shopper.player.hp, 25);
assert.equal(shopper.carry.skillCooldownReductionMs, 500);
assert.equal(shopper.carry.slowUntil, 0);
assert.equal(shopper.player.skillReadyAt, 5500);
shopper.chooseShopItem('heal');
assert.equal(shopper.player.hp, 25, 'only one shop item may be applied');

const travelling = scene();
travelling.mapIndex = 0;
travelling.player = { hp: 100, maxHp: 105, body: body() };
travelling.inputManager = { setEnabled: noOp };
travelling.time.delayedCall = (_, callback) => callback();
let restarts = 0;
travelling.scene = { restart(payload) { restarts++; assert.equal(payload.hp, 105); assert.equal(payload.mapIndex, 1); } };
travelling.transitionToMap(1);
travelling.transitionToMap(1);
assert.equal(restarts, 1);

const hurt = scene();
hurt.heroId = 'b'; hurt.heroData = HEROES.b;
hurt.player = { hp: 105, body: body(), invulnerableUntil: 0, facing: 1, state: 'idle', dashHit: new Set(), visual: { flash: noOp } };
assert.equal(hurt.damagePlayer(22, 300, 520, true), true);
assert.equal(hurt.player.state, 'knockdown');
assert.equal(hurt.player.stateUntil, 800);
assert.equal(hurt.player.invulnerableUntil, 1250);
hurt.time.now = 801;
hurt.startDodge(801);
assert.equal(hurt.player.invulnerableUntil, 1250, 'dodge must not shorten recovery protection');
hurt.startPlayerSkill(810);
assert.equal(hurt.player.invulnerableUntil, 1250, 'dash must not shorten recovery protection');
assert.equal(hurt.damagePlayer(22, 300, 520, true), false);
assert.equal(hurt.player.hp, 83);

const shield = scene();
shield.map = { width: 2000 };
shield.player = { body: body(0, 500) };
shield.enemies = [0, 1].map(() => ({ alive: true, body: body(600, 500) }));
shield.createFxImage = () => ({ angle: 0, setPosition() { return this; }, setAngle() { return this; }, setFlipX() { return this; }, destroy: noOp });
const hits = new Map();
shield.hurtEnemy = (enemy) => hits.set(enemy, (hits.get(enemy) || 0) + 1);
const shot = shield.spawnProjectile({ owner: 'player', type: 'shield', x: 600, y: 500, vx: 610, vy: 0, life: 2000, returnAt: 520, facing: 1 });
shield.updateProjectiles(500, 0);
shield.updateProjectiles(501, 0);
assert.deepEqual([...hits.values()], [1, 1]);
assert.equal(shot.active, true);
shield.updateProjectiles(520, 0);
assert.deepEqual([...hits.values()], [1, 1], 'turnaround overlap must not double-hit immediately');
shield.updateProjectiles(700, 0);
shield.updateProjectiles(701, 0);
assert.deepEqual([...hits.values()], [2, 2]);
for (let index = 0; index < 10; index++) assert.ok(shield.spawnProjectile({ owner: index % 2 ? 'boss' : 'enemy', life: 2000 }));
assert.equal(shield.spawnProjectile({ owner: 'enemy', life: 2000 }), null);
// Exercise the real init/create/retry/startBossArena paths with rendering stubbed.
const checkpointScene = (data) => {
  const s = scene();
  s.init(data);
  s.events = { once: noOp };
  s.tweens = { setGlobalTimeScale: noOp };
  s.time.delayedCall = (delay, callback) => { s.startDelay = delay; s.delayed = callback; };
  s.physics = { world: { setBounds: noOp, resume() { s.resumed = true; } }, add: {
    collider: noOp,
    sprite(x, y) {
      const sprite = body(x, y);
      for (const key of ['setAlpha', 'setDisplaySize', 'setCollideWorldBounds', 'setGravityY', 'setMaxVelocity', 'setDragX', 'setImmovable']) sprite[key] = () => sprite;
      return sprite;
    },
  } };
  Object.assign(s.cameras.main, { setBounds: noOp, startFollow: noOp, setBackgroundColor: noOp, centerOn(x, y) { s.cameraCenter = { x, y }; } });
  s.createBackground = s.createHud = s.showStageCard = noOp;
  s.createTerrain = () => { s.solids = {}; s.hazards = s.map.terrain.filter(t => t.type === 'rock').map(t => ({ ...t, state: 'idle' })); };
  s.setObjective = text => { s.objective = text; };
  s.showNotice = noOp;
  s.showDialogue = (key, done) => { s.lastDialogue = key; done(); };
  s.startMechEntrance = done => done();
  s.setArenaLock = (left, right) => { s.activeLock = { left, right }; };
  s.scene = { restart(payload) { s.retryPayload = payload; } };
  // Stale fields must be cleared by create, not carried into a fresh attempt.
  s.enemies = [{}]; s.projectiles = [{}]; s.laser = {}; s.activeLock = {};
  s.bossDefeated = true; s.boss = { hp: 1, phase: 2 };
  s.create();
  return s;
};
for (const [mapIndex, bossId] of [[1, 'c'], [2, 'd']]) {
  const carry = { selectedItem: 'badfruit', skillCooldownReductionMs: 500, maxHpBonus: 25, attackMultiplier: 1.22 };
  const initial = checkpointScene({ heroId: 'b', mapIndex, carry });
  assert.equal(initial.player.body.x, MAPS[mapIndex].introX, 'ordinary stage entry must not skip waves');
  assert.equal(initial.bossCheckpoint, null);
  initial.waveState.complete = true;
  initial.startBossArena();
  assert.equal(initial.bossCheckpoint, bossId, 'activate only when reaching this boss');
  initial.player.hp = 0;
  initial.boss.hp = 1; initial.boss.phase = 2;
  initial.restartMap();
  assert.equal(initial.retryPayload.hp, undefined, 'retry must not carry death HP');
  const revived = checkpointScene(initial.retryPayload);
  assert.equal(revived.player.body.x, MAPS[mapIndex].bossZone.trigger - 120);
  assert.equal(revived.player.hp, HEROES.b.maxHp + 25);
  assert.equal(revived.player.skillReadyAt, 0);
  assert.equal(revived.player.state, 'idle');
  assert.equal(revived.waveState.complete, true);
  assert.equal(revived.waveState.waiting, false);
  assert.equal(revived.waveState.index, MAPS[mapIndex].waveZone.waves.length - 1);
  assert.equal(revived.hazards.every(h => h.state === 'done'), true);
  assert.equal(revived.activeLock, null);
  assert.equal(revived.boss, null);
  assert.equal(revived.laser, null);
  assert.equal(revived.enemies.length + revived.projectiles.length, 0);
  assert.equal(revived.resumed, true);
  assert.equal(revived.startDelay, 250);
  assert.equal(revived.cameraCenter.x, revived.player.body.x + 145);
  assert.equal(revived.carry.skillCooldownReductionMs, 500, 'do not apply merchant benefits twice');
  assert.equal(revived.player.attack, HEROES.b.attack * 1.22);
  assert.equal(revived.merchantVisited, false);
  revived.startWaveZone = () => assert.fail('a boss retry must never restart earlier waves');
  revived.updateStageFlow();
  assert.equal(revived.bossTriggered, false, 'allow the player to walk into the arena');
  revived.player.body.x = revived.map.bossZone.trigger;
  revived.updateStageFlow();
  assert.equal(revived.boss.type, bossId);
  assert.equal(revived.boss.hp, revived.boss.maxHp);
  assert.equal(revived.boss.phase, 1);
  assert.equal(revived.boss.firstHurtSpoken, false);
  assert.equal(revived.bossBattleStarted, true);
  revived.restartMap();
  assert.equal(revived.retryPayload.bossCheckpoint, bossId, 'checkpoint survives repeated deaths');
  revived.bossDefeated = true;
  revived.restartMap();
  assert.equal(revived.retryPayload.bossCheckpoint, null, 'post-victory replay starts normally');
  if (mapIndex === 1) {
    revived.transitionToMap(2); revived.delayed();
    assert.equal(revived.retryPayload.bossCheckpoint, undefined, 'checkpoint must not follow the player to Map3');
  }
}
for (const data of [{ mapIndex: 0, bossCheckpoint: 'c' }, { mapIndex: 2, bossCheckpoint: 'c' }]) {
  const ordinary = checkpointScene(data);
  assert.equal(ordinary.bossCheckpoint, null);
  assert.equal(ordinary.waveState.triggered, false);
  assert.equal(ordinary.player.body.x, ordinary.map.introX);
}
console.log('PASS: combat timings/items, piercing and projectile budget; C/D checkpoint lifecycle, full-health retries, fresh bosses, cleared waves/hazards and cross-map isolation.');

// September adventure update: exercise actual scene methods, not copies of AI.
const shape = (x = 0, y = 0) => {
  const o = { x, y, active: true, displayHeight: 100, destroy() { this.active = false; } };
  for (const method of ['setDepth', 'setStrokeStyle', 'setOrigin', 'setAlpha', 'setScale', 'setTexture', 'clear', 'lineStyle', 'lineBetween', 'strokeCircle']) o[method] = () => o;
  return o;
};
const mechScene = () => {
  const s = scene();
  s.map = MAPS[2]; s.heroId = 'a'; s.heroData = HEROES.a; s.bossCheckpoint = 'd';
  s.bossDefeated = false;
  s.bossBattleStarted = true;
  s.boss = { type: 'd', alive: true, hp: 620, maxHp: 620, phase: 1, nextAttack: 0, busyUntil: 0,
    summonWavesStarted: 0, summonPending: false, summonedAdds: [], attackVersion: 0, patternObjects: [], body: body(5720, 385),
    visual: { setState: noOp, flash: noOp, destroy: noOp, image: shape() } };
  s.boss.body.disableBody = noOp;
  s.player = { hp: 100, maxHp: 120, invulnerableUntil: 0, state: 'idle', facing: 1, body: body(5500, 515), visual: { flash: noOp } };
  s.tasks = [];
  s.time.delayedCall = (delay, callback) => s.tasks.push({ delay, callback });
  s.add = { circle: shape, rectangle: shape, text: shape };
  s.tweens = { add: noOp, killTweensOf: noOp };
  s.addWarningText = s.setObjective = s.showNotice = s.clearArenaLock = noOp;
  s.cameras.main.flash = noOp;
  s.spawnEnemy = spec => { const e = { ...spec, alive: true }; s.enemies.push(e); return e; };
  return s;
};
const waves = mechScene();
let phaseCalls = 0;
waves.beginBossPhase = () => { phaseCalls++; waves.boss.phaseTransitioning = true; };
waves.updateBossD(0);
assert.equal(waves.boss.summonPending, true);
assert.equal(waves.boss.summonWavesStarted, 0);
assert.equal(mechPhaseReady(waves.boss), false);
waves.updateBossD(100);
assert.equal(waves.tasks.length, 1, 'do not double schedule the pre-spawn window');
waves.tasks.shift().callback();
assert.equal(waves.enemies.length, 2);
assert.equal(waves.boss.summonWavesStarted, 1);
waves.updateBossD(5000);
assert.equal(waves.tasks.length, 0, 'wait for all members of the first wave');
waves.enemies[0].alive = false;
waves.updateBossD(5000);
assert.equal(waves.tasks.length, 0);
waves.enemies[1].alive = false;
waves.updateBossD(5000);
assert.equal(mechPhaseReady(waves.boss), false, 'second wave warning is not a clear');
waves.tasks.shift().callback();
assert.equal(waves.boss.summonWavesStarted, 2);
waves.updateBossD(9000);
assert.equal(phaseCalls, 0);
waves.boss.summonedAdds.forEach(e => { e.alive = false; });
waves.updateBossD(9000);
assert.equal(phaseCalls, 1);
waves.updateBossD(9500);
assert.equal(waves.boss.summonWavesStarted, 2, 'no third wave');
const threshold = mechScene();
threshold.boss.hp = 372;
assert.equal(mechPhaseReady(threshold.boss), false, '60% exactly is not below 60%');
threshold.boss.hp = 371.9;
assert.equal(mechPhaseReady(threshold.boss), true, 'HP branch must work before either wave is cleared');
threshold.startSummonPattern(0);
threshold.cancelBossPatterns(threshold.boss);
threshold.boss.phaseTransitioning = true;
threshold.tasks.shift().callback();
assert.equal(threshold.enemies.length, 0, 'cancelled summon must not leak into phase two');
assert.equal(threshold.boss.summonWavesStarted, 0);

const story = scene();
story.heroData = HEROES.a; story.physicsPauseReasons = new Set();
story.inputManager = { setEnabled(value) { story.enabled = value; } };
story.setPhysicsPause = (reason, paused) => { if (paused) story.physicsPauseReasons.add(reason); else story.physicsPauseReasons.delete(reason); };
const shown = [];
let completeStory;
window.friendFightersUI = { showDialogue(lines, options) { shown.push(lines); completeStory = options.onComplete; } };
story.showDialogue('d_first_hurt');
const firstComplete = completeStory;
story.showDialogue('d_phase');
assert.equal(shown.length, 1);
firstComplete();
assert.equal(shown.length, 2);
assert.equal(story.enabled, false, 'keep inputs paused between story entries');
firstComplete();
assert.equal(shown.length, 2, 'stale completion callback may be consumed only once');
completeStory();
assert.equal(story.enabled, true);
assert.equal(story.dialogueActive, false);
assert.equal(story.physicsPauseReasons.size, 0);
window.friendFightersUI = { hideResults: noOp };
const interrupted = scene();
interrupted.inputManager = { poll: noOp };
interrupted.drawHud = noOp;
interrupted.updatePlayer = () => { interrupted.dialogueActive = true; };
interrupted.updateEnemies = () => assert.fail('no combat after the dialogue begins mid-frame');
interrupted.update(100, 16);
const dialogueHit = mechScene();
dialogueHit.dialogueActive = true;
assert.equal(dialogueHit.damagePlayer(12, 5720, 0, false, true), false);
assert.equal(dialogueHit.player.hp, 100);
assert.ok(Math.abs(motionBlend(1000 / 30, 0.31) - (1 - 0.69 ** 2)) < 1e-9);
console.log('PASS: exactly two ordered mech waves, cancellation, strict 60% boundary, serial dialogue and same-frame combat pause.');

for (const spec of [
  { hp: 100, x: 5500, state: 'guard', protection: 0, expectedHp: 88, dead: false },
  { hp: 10, x: 5500, state: 'guard', protection: 0, expectedHp: 0, dead: true },
  { hp: 5, x: 4900, state: 'idle', protection: 0, expectedHp: 5, dead: false },
  { hp: 100, x: 5500, state: 'dodge', protection: 2000, expectedHp: 100, dead: false },
]) {
  const death = mechScene();
  death.player.hp = spec.hp; death.player.body.x = spec.x;
  death.player.state = spec.state; death.player.invulnerableUntil = spec.protection;
  death.playerDefeated = () => { death.gameOver = true; };
  death.scene = { restart(payload) { death.retryPayload = payload; } };
  death.showDialogue = (key, callback) => { if (key === 'rescue') death.rescued = true; callback(); };
  death.missionComplete = () => { death.completed = true; };
  death.defeatBoss();
  assert.equal(death.boss.alive, false);
  assert.equal(death.boss.dying, true);
  assert.equal(death.bossDefeated, false, 'do not commit victory during the self-destruct warning');
  assert.equal(death.player.hp, spec.hp);
  assert.equal(death.tasks.filter(t => t.delay === MECH.blastWarningMs).length, 1);
  death.time.now = MECH.blastWarningMs;
  death.tasks.find(t => t.delay === MECH.blastWarningMs).callback();
  assert.equal(death.player.hp, spec.expectedHp);
  assert.equal(Boolean(death.gameOver), spec.dead);
  assert.equal(death.bossDefeated, !spec.dead);
  if (spec.dead) {
    death.restartMap();
    assert.equal(death.retryPayload.bossCheckpoint, 'd');
    assert.equal(death.tasks.some(t => t.delay === 1300), false, 'lethal blast must not queue rescue');
  } else {
    death.tasks.find(t => t.delay === 1300).callback();
    assert.equal(death.completed, true);
    assert.equal(death.rescued, true);
  }
}
console.log('PASS: mech explosion warning, max-HP 10% damage, guard bypass, safe zone/dodge, lethal checkpoint and delayed rescue.');

{
const rabbitScene = (playerX = 1120) => {
  const s = mechScene();
  Object.assign(s.boss, { type: 'c', phase: 2, hp: 66, maxHp: 330, phaseSpoken: true, firstHurtSpoken: true, state: 'idle', hurtUntil: 0, facing: 1, nextAttack: 0, body: body(1000, 500) });
  s.boss.body.body.blocked.down = true;
  s.boss.visual.sync = noOp;
  s.player.body = body(playerX, 500);
  s.add.graphics = shape;
  s.tick = time => { s.time.now = time; s.updateBoss(time); };
  return s;
};
const combo = rabbitScene();
combo.tick(0);
assert.equal(combo.boss.attackKind, 'combo');
combo.tick(499); assert.equal(combo.player.hp, 100);
combo.tick(500); assert.equal(combo.player.hp, 86);
combo.tick(501); assert.equal(combo.player.hp, 86, 'first hit cannot repeat');
combo.tick(1320); assert.equal(combo.player.hp, 62); assert.equal(combo.player.state, 'knockdown');
combo.tick(1321); assert.equal(combo.player.hp, 62, 'second hit cannot repeat');
const flank = rabbitScene();
flank.tick(0); flank.player.body.x = 900;
flank.tick(500); flank.tick(1320);
assert.equal(flank.player.hp, 100, 'both melee strikes can be avoided by crossing behind');
const interrupted = rabbitScene();
interrupted.tick(0); interrupted.tick(500);
interrupted.time.now = 700; interrupted.hurtBoss(1, 0);
assert.equal(interrupted.boss.state, 'idle');
interrupted.tick(1320);
assert.equal(interrupted.player.hp, 86, 'hurt cancels the pending finisher');
const sniper = rabbitScene(1550);
const sniperShots = [];
sniper.spawnProjectile = config => sniperShots.push(config);
sniper.tick(0); assert.equal(sniper.boss.attackKind, 'sniper');
sniper.player.body.x = 1600; sniper.player.body.y = 460;
sniper.tick(590);
const frozenTarget = { ...sniper.boss.aimTarget };
sniper.tick(600); assert.equal(sniper.boss.aimLocked, true);
sniper.player.body.x = 1300; sniper.player.body.y = 300;
sniper.tick(959); assert.equal(sniperShots.length, 0);
sniper.tick(960); sniper.tick(961);
assert.equal(sniperShots.length, 1);
assert.deepEqual(sniper.boss.aimTarget, frozenTarget, 'a locked shot must never retarget');
assert.equal(sniperShots[0].damage, 22);
assert.ok(Math.abs(Math.hypot(sniperShots[0].vx, sniperShots[0].vy) - 1000) < 0.001);
assert.ok(Math.abs(Math.atan2(sniperShots[0].vy, sniperShots[0].vx) - Math.atan2(frozenTarget.y - sniperShots[0].y, frozenTarget.x - sniperShots[0].x)) < 0.001);
const cancelShot = rabbitScene(1500);
let cancelledShots = 0;
cancelShot.spawnProjectile = () => cancelledShots++;
cancelShot.tick(0); cancelShot.tick(600);
cancelShot.hurtBoss(1, 0); cancelShot.tick(960);
assert.equal(cancelledShots, 0);
const swept = scene();
swept.player = { body: body(200, 500) }; swept.map = { width: 2000 };
swept.createFxImage = shield.createFxImage;
let sweptHits = 0;
swept.damagePlayer = () => { sweptHits++; return true; };
swept.spawnProjectile({ owner: 'boss', type: 'sniper', x: 100, y: 500, vx: 1000, vy: 0, life: 1600, damage: 22 });
swept.updateProjectiles(200, 0.2);
swept.updateProjectiles(400, 0.2);
assert.equal(sweptHits, 1, 'a fast projectile crossing the player hits once, even when both endpoints are outside');
console.log('PASS: rabbit two-hit combo, flank and hurt interruption, tracking/locked sniper, pause deadlines and swept projectile collision.');
}
