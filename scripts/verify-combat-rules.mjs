import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HEROES, MAPS, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, DIALOGUES } from '../game-src/gameData.js';
import { BERRY_CYCLE, RABBIT_SMASH, skillCooldownMs, nextStageHp } from '../game-src/CombatRules.js';

// Run the actual scene methods with a small physics/display stub, without a
// browser or Phaser renderer. This checks timing, not game feel or collision QA.
const source = (await readFile(new URL('../game-src/GameScene.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/export class /g, 'class ');
const Phaser = { Scene: class {}, Math: { Linear: (a, b, t) => a + (b - a) * t } };
const FightScene = new Function('Phaser', 'HEROES', 'MAPS', 'GAME_HEIGHT', 'GAME_WIDTH', 'GROUND_Y', 'DIALOGUES', 'BERRY_CYCLE', 'RABBIT_SMASH', 'skillCooldownMs', 'nextStageHp', `${source}\nreturn FightScene;`)(Phaser, HEROES, MAPS, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, DIALOGUES, BERRY_CYCLE, RABBIT_SMASH, skillCooldownMs, nextStageHp);
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
assert.equal(skillCooldownMs(HEROES.b), 1800);
assert.equal(skillCooldownMs(HEROES.a, { skillCooldownReductionMs: 500 }), 3600);
assert.equal(skillCooldownMs(HEROES.b, { skillCooldownReductionMs: 500 }), 1300);
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
paused.boss = { nextSmash: 5000 };
const snapshot = paused.captureCombatDeadlines();
paused.time.now = 6000;
paused.shiftCombatDeadlines(snapshot);
assert.equal(paused.enemies[0].cycleUntil, 16000);
assert.equal(paused.boss.nextSmash, 10000);

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
console.log('PASS: cooldowns, capped healing, berry air/landing/rest, paused deadlines, shop single choice, knockdown protection, piercing per-leg hits and shared projectile budget.');
