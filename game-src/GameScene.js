import Phaser from 'phaser';
import { InputManager } from './InputManager.js';
import { SoundBus } from './SoundBus.js';
import { ActionVisual, BossVisual, EnemyVisual, createCabin, createCrateVisual, createPlatformVisual, drawBones } from './Visuals.js';
import { DIALOGUES, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, HEROES, MAPS } from './gameData.js';
import { ENVIRONMENT_ART, propImage } from './EnvironmentArt.js';
import { Traversal } from './Traversal.js';
import { atGroundTrigger } from './RouteMaps.js';
import { BERRY_CYCLE, RABBIT_SMASH, RABBIT_PHASE2, segmentDistance, MECH, mechPhaseReady, motionBlend, skillCooldownMs, nextStageHp } from './CombatRules.js';

const RED = 0xe43b4f;
const RED_DARK = 0x551923;
const WHITE = 0xfff4e5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    Object.entries(ENVIRONMENT_ART).forEach(([id, file]) => this.load.image(`prop-${id}`, `./assets/props/${file}`));
    ['hover', 'attack', 'rest'].forEach((pose) => this.load.image(`berry-${pose}`, `./assets/berry-v1/${pose}.webp`));
    this.load.image('stage-1', './assets/backgrounds/stage1-qinling-road.png');
    this.load.image('stage-2', './assets/backgrounds/stage2-cave-arena.png');
    this.load.image('stage-3', './assets/backgrounds/stage3-strawberry-lab.png');
    this.load.image('hero-a', './assets/portraits/player-a.png');
    this.load.image('hero-b', './assets/portraits/player-b.png');
    const heroPoses = ['idle', 'run', 'jump', 'attack', 'skill', 'guard', 'dodge', 'hurt'];
    heroPoses.forEach((pose, index) => {
      this.load.image(`hero-a-actions-pose-${index}`, `./assets/atlases/player-a/${pose}.png`);
      this.load.image(`hero-b-actions-pose-${index}`, `./assets/atlases/player-b/${pose}.png`);
    });
    for (const hero of ['a', 'b']) for (let frame = 0; frame < 12; frame++) {
      this.load.image(`motion-${hero}-${frame}`, `./assets/props/motion-${hero}-${frame}-v2.png`);
    }
    const bossCPoses = ['idle', 'run', 'jump', 'attack', 'skill', 'gun', 'fire', 'hurt'];
    const bossDPoses = ['idle', 'charge', 'summon', 'lanes', 'fan', 'laser', 'overload', 'hurt'];
    bossCPoses.forEach((pose, index) => this.load.image(`boss-c-actions-pose-${index}`, `./assets/atlases/boss-c/${pose}.png`));
    bossDPoses.forEach((pose, index) => this.load.image(`boss-d-actions-pose-${index}`, `./assets/atlases/boss-d/${pose}.png`));
    this.load.image('boss-c', './assets/portraits/boss-c.png');
    this.load.image('boss-d', './assets/portraits/boss-d.png');
    this.load.image('merchant', './assets/shop-v1/quan-seated.webp');
    this.load.image('princess', './assets/princess.png');
    ['shield', 'ranged', 'heavy'].forEach((type) => {
      ['idle', 'run', 'attack'].forEach((pose) => this.load.image(`minion-${type}-${pose}`, `./assets/atlases/minions/${type}-${pose}.png`));
    });
    ['shield', 'charge', 'slash', 'bullet', 'berry', 'fan', 'laser'].forEach((name, index) => {
      this.load.image(`skill-effect-${index}`, `./assets/atlases/effects/${name}.png`);
    });
  }

  create() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8);
    graphics.generateTexture('pixel', 8, 8);
    graphics.destroy();

    window.friendFightersStart = (payload) => this.scene.start('FightScene', payload);
    window.dispatchEvent(new CustomEvent('friend-fighters-ready'));
    if (window.__friendFightersPendingRun) {
      const payload = window.__friendFightersPendingRun;
      window.__friendFightersPendingRun = null;
      this.scene.start('FightScene', payload);
    }
  }

}

export class FightScene extends Phaser.Scene {
  constructor() {
    super('FightScene');
  }

  init(data = {}) {
    this.heroId = data.heroId === 'b' ? 'b' : 'a';
    this.heroData = HEROES[this.heroId];
    this.mapIndex = clamp(Number(data.mapIndex) || 0, 0, MAPS.length - 1);
    this.map = MAPS[this.mapIndex];
    // A checkpoint belongs to this map, never to the cross-map item carry.
    this.bossCheckpoint = this.map.bossZone && data.bossCheckpoint === this.map.bossZone.boss
      ? data.bossCheckpoint : null;
    this.miniCheckpoint = this.map.route.minis.some(m => m.id === data.miniCheckpoint) ? data.miniCheckpoint : null;
    this.routeRestore = (this.bossCheckpoint || this.miniCheckpoint) && data.routeProgress?.mapId === this.map.id ? data.routeProgress : null;
    this.carry = {
      maxHpBonus: data.carry?.maxHpBonus || 0,
      attackMultiplier: data.carry?.attackMultiplier || 1,
      slowUntil: data.carry?.slowUntil || 0,
      skillCooldownReductionMs: data.carry?.skillCooldownReductionMs || 0,
      selectedItem: data.carry?.selectedItem || null,
    };
    this.incomingHp = Number.isFinite(data.hp) ? data.hp : null;
  }

  create() {
    this.soundBus = window.__friendFightersSoundBus || new SoundBus();
    window.__friendFightersSoundBus = this.soundBus;
    this.inputManager = new InputManager(this);
    this.inputManager.setEnabled(false);
    this.events.once('shutdown', () => this.inputManager.destroy());

    this.dialogueActive = false;
    this.dialogueQueue = [];
    this.manualPaused = false;
    this.gameOver = false;
    this.physicsPauseReasons = new Set();
    this.combatPauseSnapshot = null;
    this.time.paused = false;
    this.physics.world.resume();
    this.tweens.setGlobalTimeScale(1);
    this.hitStopRunning = false;
    this.enemies = [];
    this.projectiles = [];
    this.crates = [];
    this.pickups = [];
    this.hazards = [];
    this.bones = [];
    this.activeLock = null;
    this.gates = [];
    this.boss = null;
    this.bossTriggered = false;
    this.bossBattleStarted = false;
    this.bossDefeated = false;
    this.merchantVisited = false;
    this.shopChosen = Boolean(this.carry.selectedItem);
    this.cabinInside = false;
    this.transitioning = false;
    this.waveState = { triggered: false, index: -1, waiting: false, complete: false };
    this.laser = null;

    this.physics.world.setBounds(0, this.map.route.top, this.map.width, this.map.route.bottom - this.map.route.top);
    this.createBackground();
    this.createTerrain();
    this.traversal = new Traversal(this);
    this.createPlayer();
    this.createHud();

    this.physics.add.collider(this.player.body, this.solids);
    this.cameras.main.setBounds(0, this.map.route.top, this.map.width, this.map.route.bottom - this.map.route.top);
    this.cameras.main.startFollow(this.player.body, false, 0.095, 0.1, -145, 155);
    this.cameras.main.setBackgroundColor('#08090d');

    if (this.bossCheckpoint) {
      this.restoreBossCheckpoint();
      this.setObjective('Boss 战前检查点 · 向右重新挑战');
      this.time.delayedCall(250, () => this.beginControl());
    } else if (this.miniCheckpoint) {
      if (this.routeRestore?.waveComplete) this.waveState = { triggered: true, index: this.map.waveZone.waves.length - 1, waiting: false, complete: true };
      this.setObjective('守卫战前检查点 · 已开启的机关保持接通');
      this.time.delayedCall(250, () => this.beginControl());
    } else {
      this.showStageCard();
      this.setObjective(this.mapIndex === 0 ? '山门封闭 · 沿两侧阶梯登上绞盘楼' : '先清除封锁区 · 留意上行阶梯和下行井口');
      this.time.delayedCall(2900, () => {
        if (this.mapIndex === 0) {
          this.showDialogue('prologue', () => this.beginControl());
        } else {
          this.showDialogue(this.mapIndex === 1 ? 'cave_arrival' : 'base_arrival', () => this.beginControl());
        }
      });
    }

    window.friendFightersPause = () => this.setPaused(true);
    window.friendFightersResume = () => this.setPaused(false);
    window.friendFightersRetry = () => this.restartMap();
    window.friendFightersChooseItem = (item) => this.chooseShopItem(item);
  }

  beginControl() {
    if (this.gameOver || this.manualPaused) return;
    this.inputManager.setEnabled(true);
    window.friendFightersUI?.setGameplayVisible(true);
  }

  restoreBossCheckpoint() {
    const spawnX = this.map.bossZone.trigger - 120;
    // Rebuilding the scene clears old enemies, boss patterns, timers and locks.
    // Keep the approach cleared so updateStageFlow cannot restart its waves.
    this.waveState = { triggered: true, index: this.map.waveZone.waves.length - 1, waiting: false, complete: true };
    this.hazards.forEach((hazard) => { if (hazard.warningX < spawnX) hazard.state = 'done'; });
    this.cameras.main.centerOn(spawnX + 145, GAME_HEIGHT / 2);
  }

  createBackground() {
    const count = Math.ceil(this.map.width / GAME_WIDTH);
    for (let row = Math.floor(this.map.route.top / GAME_HEIGHT); row * GAME_HEIGHT < this.map.route.bottom; row++) {
      for (let i = 0; i < count; i += 1) {
        this.add.image(i * GAME_WIDTH + GAME_WIDTH / 2, row * GAME_HEIGHT + GAME_HEIGHT / 2, this.map.background)
        .setDisplaySize(GAME_WIDTH + 4, GAME_HEIGHT)
        .setFlipX(i % 2 === 1)
        .setTint(row > 0 ? 0x868ca4 : row < 0 ? 0xb0b9c5 : 0xffffff)
        .setDepth(-30);
      const shade = this.add.rectangle(i * GAME_WIDTH + GAME_WIDTH / 2, row * GAME_HEIGHT + GAME_HEIGHT / 2, GAME_WIDTH + 4, GAME_HEIGHT, i % 2 ? 0x090912 : 0x15101b, row > 0 ? 0.32 : 0.17).setDepth(-29);
      shade.setBlendMode(Phaser.BlendModes.MULTIPLY);
      }
    }

    if (this.mapIndex === 0) {
      this.add.text(330, 205, '国轩之窟  →', { fontFamily: 'serif', fontSize: '28px', color: '#f1d39b', fontStyle: 'bold', backgroundColor: '#1a1114bb', padding: { x: 16, y: 8 } }).setAngle(-3).setDepth(1);
      this.add.text(320, 345, 'A / D 移动　W 二段跳\nJ 攻击　K 技能\nL：原地格挡 / 带方向闪避', { fontFamily: 'sans-serif', fontSize: '22px', lineSpacing: 10, color: '#fff2d8', backgroundColor: '#090a10cc', padding: { x: 18, y: 14 } }).setDepth(1);
    }
  }

  createTerrain() {
    this.solids = this.physics.add.staticGroup();
    for (const floor of this.map.route.floors) {
      this.solids.create((floor.left + floor.right) / 2, floor.y + 64, 'pixel')
        .setDisplaySize(floor.right - floor.left, 128).setAlpha(0.001).refreshBody();
      createPlatformVisual(this, (floor.left + floor.right) / 2, floor.y, floor.right - floor.left, this.map.id);
    }

    for (const spec of this.map.terrain) {
      if (spec.type === 'platform') this.createPlatform(spec);
      if (spec.type === 'crate') this.createCrate(spec.x);
      if (spec.type === 'rock') this.createRockHazard(spec);
    }

    if (this.mapIndex === 1) {
      this.cabin = createCabin(this, (this.map.cabin.doorIn + this.map.cabin.doorOut) / 2, GROUND_Y);
      this.add.text(5420, GROUND_Y - 32, '进入', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffe0a0', backgroundColor: '#090a0dcc', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(6);
      this.add.text(6220, GROUND_Y - 32, '离开 →', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffe0a0', backgroundColor: '#090a0dcc', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(6);
    }
  }

  createPlatform(spec) {
    const platform = this.solids.create(spec.x, spec.y + 11, 'pixel');
    platform.setDisplaySize(spec.width, 24).setAlpha(0.001).refreshBody();
    platform.body.checkCollision.down = false;
    platform.body.checkCollision.left = false;
    platform.body.checkCollision.right = false;
    createPlatformVisual(this, spec.x, spec.y, spec.width, this.map.id);
  }

  createCrate(x) {
    const body = this.solids.create(x, GROUND_Y - 34, 'pixel');
    body.setDisplaySize(72, 68).setAlpha(0.001).refreshBody();
    this.crates.push({ x, y: GROUND_Y, hp: 28, body, visual: createCrateVisual(this, x, GROUND_Y), alive: true });
  }

  createRockHazard(spec) {
    this.hazards.push({ ...spec, state: 'idle', y: -80, vy: 0, warning: null, rock: null });
  }

  createPlayer() {
    const maxHp = this.heroData.maxHp + this.carry.maxHpBonus;
    const mini = this.map.route.minis.find(m => m.id === this.miniCheckpoint);
    const spawnX = this.bossCheckpoint ? this.map.bossZone.trigger - 120 : mini?.entry.x ?? this.map.introX;
    const spawnY = this.bossCheckpoint ? GROUND_Y - 75 : mini?.entry.y ?? GROUND_Y - 75;
    const body = this.physics.add.sprite(spawnX, spawnY, 'pixel');
    body.setAlpha(0.001).setDisplaySize(58, 150).setCollideWorldBounds(true);
    body.setGravityY(1520).setMaxVelocity(760, 920).setDragX(1400);
    const visual = new ActionVisual(this, body.x, spawnY + 75, this.heroData.texture, `hero-${this.heroId}`, this.heroId === 'b' ? 208 : 212, 8);
    this.player = {
      body,
      visual,
      hp: clamp(this.incomingHp ?? maxHp, 1, maxHp),
      maxHp,
      attack: this.heroData.attack * this.carry.attackMultiplier,
      speed: this.heroData.speed,
      facing: 1,
      state: 'idle',
      stateUntil: 0,
      invulnerableUntil: 0,
      jumpsUsed: 0,
      attackHitAt: 0,
      attackDidHit: false,
      attackQueued: false,
      combo: 0,
      skillReadyAt: 0,
      dashHit: new Set(),
      lastAfterimage: 0,
      hurtTintUntil: 0,
    };
    window.friendFightersUI?.setSkillCooldown?.(0, skillCooldownMs(this.heroData, this.carry));
  }

  createHud() {
    // Scene restart destroys the old Text texture; never reuse its JS reference.
    this.bossNameLabel = null;
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.worldHud = this.add.graphics().setDepth(40);
    this.speedLines = this.add.graphics().setScrollFactor(0).setDepth(80);
    this.heroLabel = this.add.text(30, 18, `${this.heroData.title} · ${this.heroData.name}`, { fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#fff4e5' }).setScrollFactor(0).setDepth(91);
    this.objectiveLabel = this.add.text(GAME_WIDTH / 2, 23, '', { fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#f5dfb1', backgroundColor: '#090a10aa', padding: { x: 18, y: 8 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(91);
    this.noticeLabel = this.add.text(GAME_WIDTH / 2, 118, '', { fontFamily: 'serif', fontSize: '34px', fontStyle: 'bold', color: '#fff1d0', stroke: '#501927', strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(92).setAlpha(0);
    this.skillLabel = this.add.text(31, 81, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#d5c8bd' }).setScrollFactor(0).setDepth(91);
  }

  setObjective(text) {
    this.objectiveLabel?.setText(text);
  }

  showNotice(text, duration = 1500) {
    this.noticeLabel.setText(text).setAlpha(0).setScale(0.92);
    this.tweens.killTweensOf(this.noticeLabel);
    this.tweens.add({ targets: this.noticeLabel, alpha: 1, scale: 1, duration: 180, yoyo: true, hold: Math.max(200, duration - 360), ease: 'Quad.Out' });
  }

  showStageCard() {
    window.friendFightersUI?.showStage(this.map.id, this.map.title, this.map.subtitle);
  }

  showDialogue(key, onComplete, valid = () => true) {
    if (this.gameOver || !valid()) return;
    this.dialogueQueue ||= [];
    this.dialogueQueue.push({ key, onComplete, valid });
    if (!this.dialogueActive) this.advanceStoryQueue();
  }

  advanceStoryQueue() {
    let entry;
    while (this.dialogueQueue.length) {
      const candidate = this.dialogueQueue.shift();
      if (candidate.valid()) { entry = candidate; break; }
    }
    if (!entry || this.gameOver) {
      this.dialogueActive = false;
      this.setPhysicsPause('dialogue', false);
      if (!this.manualPaused && !this.gameOver && !this.physicsPauseReasons.has('shop')) this.inputManager.setEnabled(true);
      return;
    }
    const { key, onComplete, valid } = entry;
    const lines = DIALOGUES[key];
    if (!lines) {
      onComplete?.();
      this.advanceStoryQueue();
      return;
    }
    this.dialogueActive = true;
    this.inputManager.setEnabled(false);
    this.player?.body?.setVelocityX(0);
    this.setPhysicsPause('dialogue', true);
    let completed = false;
    window.friendFightersUI?.showDialogue(lines, {
      hero: this.heroData,
      onComplete: () => {
        if (completed) return;
        completed = true;
        // Keep the clock paused between queued lines and callbacks. A phase
        // transition can enqueue its story here without one controllable frame.
        if (!this.gameOver && valid()) onComplete?.();
        this.advanceStoryQueue();
      },
    });
  }

  setPhysicsPause(reason, paused) {
    if (paused) this.physicsPauseReasons.add(reason);
    else this.physicsPauseReasons.delete(reason);
    if (this.physicsPauseReasons.size > 0) this.physics.world.pause();
    else this.physics.world.resume();

    // Hit stop deliberately keeps its short, real-time release. Menus and
    // dialogue freeze warning timers and animation as well as physics.
    const freezeCombat = [...this.physicsPauseReasons].some((entry) => entry !== 'hitstop');
    if (freezeCombat && !this.combatPauseSnapshot) {
      this.combatPauseSnapshot = this.captureCombatDeadlines();
      this.time.paused = true;
      // Keep the TweenManager clock ticking at zero scale so resuming a short
      // pause cannot consume the entire pause as a single animation delta.
      this.tweens.setGlobalTimeScale(0);
    } else if (!freezeCombat && this.combatPauseSnapshot) {
      const snapshot = this.combatPauseSnapshot;
      this.combatPauseSnapshot = null;
      this.shiftCombatDeadlines(snapshot);
      this.time.paused = false;
      this.tweens.setGlobalTimeScale(snapshot.tweenTimeScale);
    }
  }

  captureCombatDeadlines() {
    const deadlines = [];
    const capture = (object, keys) => {
      if (!object) return;
      keys.forEach((key) => {
        const value = object[key];
        if (Number.isFinite(value) && value > 0) deadlines.push({ object, key, value });
      });
    };
    capture(this.player, ['stateUntil', 'invulnerableUntil', 'attackHitAt', 'skillReadyAt', 'hurtTintUntil', 'lastAttackAt', 'lastAfterimage']);
    this.enemies.forEach((enemy) => capture(enemy, ['stateUntil', 'hurtUntil', 'nextAttack', 'hitAt', 'cycleUntil', 'nextFlinchAt']));
    capture(this.boss, ['stateUntil', 'hurtUntil', 'nextAttack', 'nextLeap', 'nextSmash', 'hitAt', 'busyUntil', 'aimLockAt', 'comboSecondAt']);
    this.projectiles.forEach((projectile) => capture(projectile, ['createdAt', 'expiresAt', 'returnAt']));
    capture(this.laser, ['startedAt', 'until', 'nextDamage']);
    return {
      clockTime: this.time.now,
      wallTime: Date.now(),
      slowUntil: this.carry.slowUntil,
      tweenTimeScale: this.tweens.getGlobalTimeScale(),
      deadlines,
    };
  }

  shiftCombatDeadlines(snapshot) {
    const elapsed = Math.max(0, this.time.now - snapshot.clockTime);
    snapshot.deadlines.forEach(({ object, key, value }) => {
      // Do not extend a newly assigned deadline, e.g. an item selected in the
      // shop while the pre-existing combat state was frozen.
      if (object[key] === value) object[key] += elapsed;
    });
    if (snapshot.slowUntil > snapshot.wallTime && this.carry.slowUntil === snapshot.slowUntil) {
      this.carry.slowUntil += Math.max(0, Date.now() - snapshot.wallTime);
    }
  }

  setPaused(paused) {
    if (this.gameOver || this.dialogueActive) return;
    this.manualPaused = paused;
    this.inputManager.setEnabled(!paused);
    this.setPhysicsPause('manual', paused);
    window.friendFightersUI?.setPaused(paused);
  }

  restartMap() {
    window.friendFightersUI?.hideResults();
    this.scene.restart({ heroId: this.heroId, mapIndex: this.mapIndex, carry: this.carry, bossCheckpoint: this.bossDefeated ? null : this.bossCheckpoint,
      miniCheckpoint: this.miniCheckpoint, routeProgress: this.traversal?.snapshot?.() });
  }

  update(time, delta) {
    const dt = Math.min(delta, 34) / 1000;
    this.inputManager.poll();
    this.drawHud(time);
    if (this.dialogueActive || this.manualPaused || this.gameOver || this.hitStopRunning) return;

    this.updatePlayer(time, delta);
    if (this.dialogueActive || this.gameOver) return;
    this.traversal?.update(delta);
    this.updateEnemies(time);
    this.updateBoss(time, dt);
    if (this.dialogueActive || this.gameOver) return;
    this.updateProjectiles(time, dt);
    if (this.dialogueActive || this.gameOver) return;
    this.updateHazards(time, dt);
    this.updatePickups(time);
    this.updateStageFlow(time);
    this.enforceArenaLock();
    this.drawWorldHud();
  }

  updatePlayer(time, delta = 1000 / 60) {
    const p = this.player;
    const body = p.body;
    const axis = this.inputManager.axisX();
    const grounded = body.body.blocked.down || body.body.touching.down;
    if (grounded && Math.abs(body.body.velocity.y) < 24) p.jumpsUsed = 0;

    if (p.hurtTintUntil && time >= p.hurtTintUntil) {
      p.hurtTintUntil = 0;
      p.visual.image.clearTint();
      p.visual.image.setTintMode?.(Phaser.TintModes.MULTIPLY);
    }

    if (p.state === 'hurt' || p.state === 'knockdown') {
      if (time >= p.stateUntil) this.setPlayerState(grounded ? 'idle' : 'jump');
      else {
        p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
        return;
      }
    }

    if (p.state === 'dodge') {
      body.setVelocityX(p.facing * 650);
      if (time - p.lastAfterimage > 48) {
        p.lastAfterimage = time;
        p.visual.afterimage(this.heroId === 'a' ? 0x69a8ff : 0xff485b);
      }
      if (time >= p.stateUntil) this.setPlayerState(grounded ? 'idle' : 'jump');
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (p.state === 'attack') {
      if (this.inputManager.justPressed('attack') && time > p.attackHitAt) p.attackQueued = true;
      if (!p.attackDidHit && time >= p.attackHitAt) {
        p.attackDidHit = true;
        this.performPlayerAttack(p.combo === 2);
      }
      body.setVelocityX(Phaser.Math.Linear(body.body.velocity.x, 0, motionBlend(delta, grounded ? 0.25 : 0.08)));
      if (time >= p.stateUntil) {
        if (p.attackQueued) this.startPlayerAttack(time, true);
        else this.setPlayerState(grounded ? (Math.abs(axis) ? 'run' : 'idle') : 'jump');
      }
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (p.state === 'skill') {
      if (this.heroId === 'b') {
        body.setVelocityX(p.facing * 760);
        if (time - p.lastAfterimage > 42) {
          p.lastAfterimage = time;
          p.visual.afterimage(0xff435d);
        }
        this.performDashHits();
      } else {
        body.setVelocityX(Phaser.Math.Linear(body.body.velocity.x, 0, 0.28));
      }
      if (time >= p.stateUntil) this.setPlayerState(grounded ? 'idle' : 'jump');
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (this.inputManager.justPressed('guard') && axis !== 0) {
      p.facing = axis;
      this.startDodge(time);
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (this.inputManager.down('guard') && grounded && axis === 0) {
      body.setVelocityX(0);
      this.setPlayerState('guard');
      p.visual.sync(body.x, body.y + 75, p.facing, time, 0);
      return;
    }

    if (this.inputManager.justPressed('jump') && p.jumpsUsed < 2) {
      p.jumpsUsed += 1;
      body.setVelocityY(p.jumpsUsed === 1 ? -610 : -560);
      this.setPlayerState('jump');
      this.soundBus.play(p.jumpsUsed === 1 ? 'jump' : 'doubleJump');
      this.spawnJumpFx(body.x, body.y + 72, p.jumpsUsed === 2);
      if (p.jumpsUsed === 2) {
        p.visual.afterimage(0xe5f1ff);
        // Keep the rider and shield fighter upright during the air boost.
        p.visual.image.setAngle(0);
      }
    }

    if (this.inputManager.justPressed('attack')) {
      this.startPlayerAttack(time, false);
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (this.inputManager.justPressed('skill') && time >= p.skillReadyAt) {
      this.startPlayerSkill(time);
      p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
      return;
    }

    if (axis !== 0) {
      p.facing = axis;
      const slow = this.carry.slowUntil > Date.now() ? 0.72 : 1;
      const target = axis * p.speed * slow;
      body.setVelocityX(Phaser.Math.Linear(body.body.velocity.x, target, motionBlend(delta, grounded ? 0.31 : 0.17)));
    } else if (grounded) {
      body.setVelocityX(Phaser.Math.Linear(body.body.velocity.x, 0, motionBlend(delta, 0.36)));
    }

    if (!grounded) this.setPlayerState('jump');
    else if (Math.abs(body.body.velocity.x) > 48) this.setPlayerState('run');
    else this.setPlayerState('idle');

    p.visual.sync(body.x, body.y + 75, p.facing, time, body.body.velocity.x);
    this.updateSpeedLines(time);
  }

  setPlayerState(state) {
    const p = this.player;
    if (p.state === state) return;
    p.state = state;
    p.visual.facing = p.facing;
    p.visual.setState(state);
  }

  startPlayerAttack(time, chained) {
    const p = this.player;
    p.combo = chained ? (p.combo === 1 ? 2 : 1) : (time - (p.lastAttackAt || 0) < 520 ? (p.combo === 1 ? 2 : 1) : 1);
    p.lastAttackAt = time;
    p.attackQueued = false;
    p.attackDidHit = false;
    p.attackHitAt = time + (p.combo === 2 ? 105 : 120);
    p.stateUntil = time + (p.combo === 2 ? 355 : 315);
    this.setPlayerState('attack');
    this.soundBus.play('swing');
    this.spawnSheetFx(p.body.x + p.facing * 72, p.body.y + 4, 2, p.combo === 2 ? 150 : 118, p.facing);
  }

  performPlayerAttack(heavy) {
    const p = this.player;
    const range = this.heroId === 'b' ? 132 : 116;
    const damage = p.attack * (heavy ? 1.28 : 1);
    let connected = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive || !this.isInFront(p.body, enemy.body, p.facing, range, 150)) continue;
      this.hurtEnemy(enemy, damage, p.facing * (heavy ? 390 : 270), heavy);
      connected = true;
    }
    if (this.boss?.alive && this.isInFront(p.body, this.bossContactPoint(p.body), p.facing, range + 25, this.boss.type === 'd' ? 280 : 175)) {
      this.hurtBoss(damage, p.facing * (heavy ? 280 : 175), heavy);
      connected = true;
    }
    for (const crate of this.crates) {
      if (crate.alive && Math.abs(crate.y - 35 - p.body.y) < 130 && Math.abs(crate.x - p.body.x) < range + 30 && Math.sign(crate.x - p.body.x || p.facing) === p.facing) {
        this.hurtCrate(crate, damage);
        connected = true;
      }
    }
    connected = this.traversal?.attack(p, range, damage) || connected;
    if (connected) this.impactFeedback(p.body.x + p.facing * range, p.body.y, heavy);
  }

  startPlayerSkill(time) {
    const p = this.player;
    const cooldown = skillCooldownMs(this.heroData, this.carry);
    p.skillReadyAt = time + cooldown;
    window.friendFightersUI?.setSkillCooldown?.(cooldown, cooldown);
    p.stateUntil = time + (this.heroId === 'a' ? 560 : 430);
    p.dashHit.clear();
    this.setPlayerState('skill');
    this.soundBus.play('skill');
    if (this.heroId === 'a') {
      this.time.delayedCall(145, () => {
        if (!this.player?.body?.active) return;
        this.spawnProjectile({
          owner: 'player',
          type: 'shield',
          piercing: true,
          x: p.body.x + p.facing * 62,
          y: p.body.y - 16,
          vx: p.facing * 610,
          vy: 0,
          damage: p.attack * 1.65,
          life: 980,
          cell: 0,
          height: 92,
          facing: p.facing,
          returnAt: this.time.now + 520,
        });
      });
    } else {
      p.invulnerableUntil = Math.max(p.invulnerableUntil, time + 310);
      this.spawnSheetFx(p.body.x - p.facing * 70, p.body.y + 30, 1, 190, p.facing);
      this.cameras.main.shake(150, 0.004);
    }
  }

  startDodge(time) {
    const p = this.player;
    p.stateUntil = time + 370;
    p.invulnerableUntil = Math.max(p.invulnerableUntil, time + 275);
    p.lastAfterimage = 0;
    this.setPlayerState('dodge');
    this.soundBus.play('dodge');
    this.spawnSheetFx(p.body.x - p.facing * 45, p.body.y + 25, 1, 130, p.facing);
  }

  performDashHits() {
    const p = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.alive || p.dashHit.has(enemy) || distance(p.body, enemy.body) > 125) continue;
      p.dashHit.add(enemy);
      this.hurtEnemy(enemy, p.attack * 1.8, p.facing * 480, true);
      this.impactFeedback(enemy.body.x, enemy.body.y, true);
    }
    if (this.boss?.alive && !p.dashHit.has(this.boss) && distance(p.body, this.bossContactPoint(p.body)) < 145) {
      p.dashHit.add(this.boss);
      this.hurtBoss(p.attack * 1.8, p.facing * 260, true);
      this.impactFeedback(this.boss.body.x - 90, p.body.y, true);
    }
  }

  isInFront(source, target, facing, range, yRange) {
    const dx = target.x - source.x;
    return dx * facing >= -18 && Math.abs(dx) <= range && Math.abs(target.y - source.y) <= yRange;
  }

  bossContactPoint(source) {
    const boss = this.boss;
    if (boss.type !== 'd') return boss.body;
    const body = boss.body.body;
    return { x: clamp(source.x, body.left, body.right), y: clamp(source.y, body.top, body.bottom) };
  }

  spawnEnemy(spec) {
    const strawberry = spec.type.startsWith('berry');
    const flying = strawberry;
    const base = {
      shield: { hp: 46, speed: 112, damage: 10, range: 92, cooldown: 1250, height: 142 },
      ranged: { hp: 38, speed: 88, damage: 9, range: 410, cooldown: 1850, height: 138 },
      heavy: { hp: 72, speed: 72, damage: 16, range: 112, cooldown: 1900, height: 158 },
      berryGround: { hp: 34, speed: 115, damage: 9, range: 410, cooldown: 1750, height: 100 },
      berryFlying: { hp: 28, speed: 105, damage: 8, range: 420, cooldown: 1850, height: 100 },
    }[spec.type];
    const values = spec.miniBoss ? { ...base, ...spec.miniBoss, height: Math.round(base.height * 1.3) } : base;
    const floorY = spec.floorY ?? GROUND_Y;
    const y = flying ? (spec.y ?? floorY - 260) : floorY - values.height / 2;
    const body = this.physics.add.sprite(spec.x, y, 'pixel');
    body.setAlpha(0.001).setDisplaySize(strawberry ? 62 : 56, values.height);
    body.setMaxVelocity(520, 880);
    if (flying) {
      body.body.setAllowGravity(false);
      body.setImmovable(false);
      body.setGravityY(1520);
      body.body.checkCollision.up = false;
      this.physics.add.collider(body, this.solids);
    } else {
      body.setGravityY(1520);
      this.physics.add.collider(body, this.solids);
    }
    const enemy = {
      ...values,
      type: spec.type,
      body,
      visual: new EnemyVisual(this, body.x, body.y + values.height / 2, spec.type, spec.miniBoss ? 1.3 : 1),
      miniBoss: spec.miniBoss || null, floorY, attackCycle: 0, nextFlinchAt: 0,
      hp: values.hp,
      maxHp: values.hp,
      alive: true,
      state: 'idle',
      stateUntil: 0,
      hurtUntil: 0,
      nextAttack: this.time.now + Phaser.Math.Between(500, 1050),
      hitAt: 0,
      didHit: false,
      facing: -1,
      spawnY: y,
      telegraph: null,
      id: `${spec.type}-${this.time.now}-${Math.random()}`,
      cyclePhase: strawberry ? 'air' : null,
      cycleUntil: strawberry ? this.time.now + BERRY_CYCLE.airMs : 0,
    };
    this.enemies.push(enemy);
    this.tweens.add({ targets: enemy.visual.object, alpha: { from: 0, to: 1 }, y: enemy.visual.object.y - 14, duration: 260, ease: 'Back.Out' });
    return enemy;
  }

  updateEnemies(time) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const e = enemy;
      const p = this.player;
      const dx = p.body.x - e.body.x;
      const absDx = Math.abs(dx);
      e.facing = e.miniBoss && e.state === 'windup' ? e.attackFacing : Math.sign(dx) || e.facing;

      if (e.type.startsWith('berry') && this.updateBerryCycle(e, time)) continue;
      if (e.type.startsWith('berry')) {
        const targetY = clamp(p.body.y - 120, e.floorY - 340, e.floorY - 190) + Math.sin(time * 0.004 + e.body.x) * 18;
        e.body.setVelocityY((targetY - e.body.y) * 2.1);
      }

      if (time < e.hurtUntil) {
        e.visual.setState('hurt');
        e.visual.sync(e.body.x, e.body.y + e.height / 2, e.facing, time);
        continue;
      }

      if (e.state === 'windup') {
        e.body.setVelocityX(0);
        e.visual.setState('attack');
        if (!e.didHit && time >= e.hitAt) {
          e.didHit = true;
          this.resolveEnemyAttack(e);
        }
        if (time >= e.stateUntil) {
          e.state = 'idle';
          e.telegraph?.destroy();
          e.telegraph = null;
        }
      } else {
        const ranged = e.type === 'ranged' || e.type.startsWith('berry');
        const preferred = ranged ? e.range * 0.82 : e.range;
        if (absDx > preferred) {
          e.state = 'run';
          e.body.setVelocityX(e.facing * e.speed);
          e.visual.setState('run');
        } else if (ranged && absDx < 210) {
          e.state = 'run';
          e.body.setVelocityX(-e.facing * e.speed * 0.75);
          e.visual.setState('run');
        } else {
          e.state = 'idle';
          e.body.setVelocityX(Phaser.Math.Linear(e.body.body.velocity.x, 0, 0.32));
          e.visual.setState('idle');
        }
        if (time >= e.nextAttack && absDx <= e.range && Math.abs(p.body.y - e.body.y) < (ranged ? 300 : 140)) this.startEnemyAttack(e, time);
      }
      e.visual.sync(e.body.x, e.body.y + e.height / 2, e.facing, time);
    }
  }

  updateBerryCycle(enemy, time) {
    if (enemy.cyclePhase === 'air' && time >= enemy.cycleUntil) {
      enemy.cyclePhase = 'landing';
      enemy.state = 'idle';
      enemy.telegraph?.destroy();
      enemy.telegraph = null;
      enemy.moveLabel?.destroy(); enemy.moveLabel = null;
      enemy.body.body.setAllowGravity(true);
      enemy.body.setVelocity(0, 180);
      // The rest window must be safe from this bear's already-fired shots too.
      this.projectiles.filter((p) => p.active && p.sourceEnemy === enemy).forEach((p) => this.destroyProjectile(p));
    }
    if (enemy.cyclePhase === 'landing') {
      enemy.body.setVelocityX(0);
      if (enemy.body.body.blocked.down || enemy.body.body.touching.down) {
        enemy.cyclePhase = 'rest';
        enemy.cycleUntil = time + BERRY_CYCLE.restMs;
        enemy.body.setVelocity(0, 0);
      }
    } else if (enemy.cyclePhase === 'rest' && time >= enemy.cycleUntil) {
      enemy.cyclePhase = 'air';
      enemy.cycleUntil = time + BERRY_CYCLE.airMs;
      enemy.nextAttack = time + 850;
      enemy.state = 'idle';
      enemy.body.body.setAllowGravity(false);
      enemy.body.setVelocity(0, -260);
    }
    if (enemy.cyclePhase === 'air') return false;
    enemy.body.setVelocityX(0);
    enemy.visual.setState(time < enemy.hurtUntil ? 'hurt' : enemy.cyclePhase === 'rest' ? 'rest' : 'idle');
    enemy.visual.sync(enemy.body.x, enemy.body.y + enemy.height / 2, enemy.facing, time);
    return true;
  }

  startEnemyAttack(enemy, time) {
    enemy.state = 'windup';
    enemy.didHit = false;
    const heavy = enemy.type === 'heavy';
    const ranged = enemy.type === 'ranged' || enemy.type.startsWith('berry');
    const move = enemy.miniBoss?.attacks[enemy.attackCycle++ % enemy.miniBoss.attacks.length];
    enemy.miniMove = move;
    enemy.attackFacing = enemy.facing;
    const warning = move?.warning ?? (heavy ? 520 : ranged ? 430 : 330);
    enemy.hitAt = time + warning;
    enemy.stateUntil = enemy.hitAt + (move ? 440 : 240);
    enemy.nextAttack = Math.max(time + enemy.cooldown, enemy.stateUntil + 250);
    enemy.body.setVelocityX(0);
    const color = enemy.type.startsWith('berry') ? 0xff4f92 : 0xffb45c;
    enemy.telegraph = this.add.arc(enemy.body.x + enemy.facing * (ranged ? 44 : 68), enemy.body.y + enemy.height / 2 - 12, heavy ? 64 : 42, 205, 335, false, color, 0.25).setStrokeStyle(4, color, 0.95).setDepth(8);
    this.tweens.add({ targets: enemy.telegraph, alpha: 0.25, scale: 1.35, duration: warning, ease: 'Sine.In' });
    if (move) enemy.moveLabel = this.addWarningText(move.name, enemy.body.x, enemy.body.y - enemy.height / 2 - 34, warning);
  }

  resolveEnemyAttack(enemy) {
    enemy.telegraph?.destroy();
    enemy.telegraph = null;
    if (!enemy.alive) return;
    if (enemy.miniMove) {
      const move = enemy.miniMove;
      enemy.moveLabel?.destroy(); enemy.moveLabel = null;
      if (move.volley) {
        const angle = Math.atan2(this.player.body.y - enemy.body.y, this.player.body.x - enemy.body.x);
        for (const offset of move.volley) this.spawnProjectile({ owner: 'enemy', sourceEnemy: enemy, type: 'berry', x: enemy.body.x, y: enemy.body.y,
          vx: Math.cos(angle + offset) * move.speed, vy: Math.sin(angle + offset) * move.speed, damage: move.damage, life: 2300, cell: 4, height: 42, facing: enemy.attackFacing });
        this.soundBus.play('shot');
      } else {
        const dx = this.player.body.x - enemy.body.x;
        if (dx * enemy.attackFacing >= -20 && Math.abs(dx) < move.range && Math.abs(this.player.body.y - enemy.body.y) < (move.knockdown ? 125 : 150))
          this.damagePlayer(move.damage, enemy.body.x, move.knockdown ? 490 : 320, Boolean(move.knockdown));
        this.spawnSheetFx(enemy.body.x + enemy.attackFacing * 95, enemy.body.y, 2, move.knockdown ? 225 : 165, enemy.attackFacing);
        this.soundBus.play(move.knockdown ? 'heavyHit' : 'swing');
      }
      return;
    }
    if (enemy.type === 'ranged' || enemy.type.startsWith('berry')) {
      const target = this.player.body;
      const angle = Phaser.Math.Angle.Between(enemy.body.x, enemy.body.y, target.x, target.y);
      const berry = enemy.type.startsWith('berry');
      const speed = berry ? 280 : 390;
      this.spawnProjectile({ owner: 'enemy', sourceEnemy: enemy, type: berry ? 'berry' : 'bolt', x: enemy.body.x + enemy.facing * 35, y: enemy.body.y - 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: enemy.damage, life: 2100, cell: berry ? 4 : 3, height: berry ? 42 : 30, facing: enemy.facing });
      this.soundBus.play('shot');
      return;
    }
    const reach = enemy.range + (enemy.type === 'heavy' ? 35 : 12);
    if (distance(enemy.body, this.player.body) <= reach) this.damagePlayer(enemy.damage, enemy.body.x, enemy.type === 'heavy' ? 440 : 260);
    this.spawnSheetFx(enemy.body.x + enemy.facing * 62, enemy.body.y, 2, enemy.type === 'heavy' ? 125 : 88, enemy.facing);
  }

  hurtEnemy(enemy, damage, knockback, heavy = false) {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    const flinch = !enemy.miniBoss || this.time.now >= enemy.nextFlinchAt;
    enemy.hurtUntil = this.time.now + (enemy.miniBoss ? 90 : heavy ? 260 : 170);
    if (flinch) { enemy.state = 'hurt'; enemy.nextFlinchAt = this.time.now + 1250; }
    enemy.body.setVelocityX(knockback * (enemy.miniBoss ? 0.22 : 1));
    if (!enemy.type.startsWith('berry')) enemy.body.setVelocityY(-90);
    enemy.visual.setState('hurt');
    enemy.visual.flash();
    if (flinch) { enemy.telegraph?.destroy(); enemy.telegraph = null; enemy.moveLabel?.destroy(); enemy.moveLabel = null; }
    this.soundBus.play('enemyHurt');
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    enemy.alive = false;
    enemy.body.disableBody(true, true);
    const boneX = enemy.body.x;
    const feetY = enemy.body.y + enemy.height / 2;
    const surfaces = this.map.terrain.filter((spec) => spec.type === 'platform' && Math.abs(spec.x - boneX) < spec.width / 2 && spec.y >= feetY - 20);
    const boneY = this.traversal?.floorBelow?.(boneX, feetY) ?? Math.min(GROUND_Y, ...surfaces.map((spec) => spec.y - 1));
    enemy.telegraph?.destroy(); enemy.moveLabel?.destroy();
    this.traversal?.onMiniDefeated?.(enemy);
    enemy.visual.fadeDeath(() => enemy.visual.destroy());
    this.time.delayedCall(245, () => this.bones.push(drawBones(this, boneX, boneY, enemy.type.startsWith('berry'))));
  }

  damagePlayer(amount, sourceX, knockback = 280, knockdown = false, unblockable = false) {
    const p = this.player;
    const now = this.time.now;
    if (this.dialogueActive || this.gameOver || now < p.invulnerableUntil || p.hp <= 0) return false;
    const sourceDirection = Math.sign(sourceX - p.body.x) || -p.facing;
    const guardingFront = !unblockable && p.state === 'guard' && sourceDirection === p.facing;
    if (guardingFront) {
      const chip = Math.max(0, Math.round(amount * 0.15));
      p.hp = Math.max(1, p.hp - chip);
      p.body.setVelocityX(-sourceDirection * 70);
      p.invulnerableUntil = now + 180;
      this.soundBus.play('block');
      this.spawnBlockFx(p.body.x + p.facing * 38, p.body.y - 8);
      return false;
    }
    p.hp = Math.max(0, p.hp - amount);
    p.stateUntil = now + (knockdown ? RABBIT_SMASH.stunMs : 330);
    p.invulnerableUntil = now + (knockdown ? RABBIT_SMASH.protectionMs : 740);
    p.body.setVelocity(-sourceDirection * knockback, -170);
    this.setPlayerState(knockdown ? 'knockdown' : 'hurt');
    p.visual.flash(115);
    p.hurtTintUntil = now + 115;
    this.soundBus.play('hurt');
    this.cameras.main.shake(150, 0.009);
    this.spawnHitParticles(p.body.x, p.body.y, 0xff4f63, 7);
    if (p.hp <= 0) this.playerDefeated();
    return true;
  }

  updateStageFlow() {
    const p = this.player.body;
    const zone = this.map.waveZone;
    if (!this.activeLock && !this.waveState.triggered && atGroundTrigger(p, zone.trigger) && this.traversal?.canEnter?.('wave') !== false) this.startWaveZone();

    if (this.waveState.triggered && !this.waveState.complete && !this.waveState.waiting) {
      const alive = this.enemies.some((enemy) => enemy.alive);
      if (!alive && this.waveState.index >= 0) {
        if (this.waveState.index < zone.waves.length - 1) {
          this.waveState.waiting = true;
          this.showNotice(`WAVE ${this.waveState.index + 1} CLEAR`, 900);
          this.time.delayedCall(900, () => {
            if (this.gameOver) return;
            this.waveState.waiting = false;
            this.waveState.index += 1;
            this.spawnWave(this.waveState.index);
          });
        } else {
          this.completeWaveZone();
        }
      }
    }

    if (!this.activeLock && this.map.bossZone && this.waveState.complete && !this.bossTriggered && atGroundTrigger(p, this.map.bossZone.trigger) && this.traversal?.canEnter?.('boss') !== false) this.startBossArena();

    if (this.mapIndex === 0 && this.waveState.complete && atGroundTrigger(p, this.map.exitX) && this.traversal?.canEnter?.('exit') !== false) this.transitionToMap(1);

    if (this.mapIndex === 1 && this.bossDefeated) {
      if (!this.merchantVisited && atGroundTrigger(p, this.map.cabin.doorIn) && this.traversal?.canEnter?.('cabin') !== false) this.enterCabin();
      if (this.shopChosen && this.merchantVisited && atGroundTrigger(p, this.map.cabin.doorOut)) this.transitionToMap(2);
    }
  }

  startWaveZone() {
    this.waveState.triggered = true;
    this.waveState.index = 0;
    this.setArenaLock(this.map.waveZone.left, this.map.waveZone.right);
    this.spawnWave(0);
  }

  spawnWave(index) {
    const specs = this.map.waveZone.waves[index];
    this.soundBus.play('wave');
    this.showNotice(`WAVE ${index + 1} / ${this.map.waveZone.waves.length}`);
    this.setObjective(`封锁战斗区 · 清除第 ${index + 1} 批敌人`);
    specs.forEach((spec) => this.spawnEnemy(spec));
  }

  completeWaveZone() {
    this.waveState.complete = true;
    this.clearArenaLock();
    this.soundBus.play('pickup');
    this.showNotice('AREA CLEAR', 1500);
    if (this.mapIndex === 0) this.setObjective('道路已解锁 · 继续向右抵达洞窟入口');
    else if (this.map.bossZone) this.setObjective(this.mapIndex === 1 ? '交汇井：下行配重室是主路，上层矿廊可选挑战' : '双回路：上层冷却、下层动力，可按任意顺序接通');
  }

  setArenaLock(left, right, floorY = GROUND_Y) {
    this.activeLock = { left, right, floorY };
    this.cameras.main.setBounds(left, floorY - GROUND_Y, right - left, GAME_HEIGHT);
    this.gates.forEach((gate) => gate.destroy());
    this.gates = [this.createGate(left, 'LOCK', floorY), this.createGate(right, 'LOCK', floorY)];
  }

  createGate(x, label, floorY = GROUND_Y) {
    const container = this.add.container(x, floorY - GROUND_Y / 2).setDepth(28);
    const beam = this.add.rectangle(0, 0, 20, GROUND_Y, 0xd92952, 0.52).setStrokeStyle(4, 0xffccbd, 0.9);
    const core = this.add.rectangle(0, 0, 5, GROUND_Y, 0xffffff, 0.7);
    const text = this.add.text(0, -205, label, { fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffe6d2', backgroundColor: '#4d1020dd', padding: { x: 8, y: 5 } }).setOrigin(0.5).setAngle(-90);
    container.add([beam, core, text]);
    this.tweens.add({ targets: [beam, core], alpha: { from: 0.22, to: 0.78 }, duration: 330, yoyo: true, repeat: -1 });
    return container;
  }

  clearArenaLock() {
    this.activeLock = null;
    this.cameras.main.setBounds(0, this.map.route.top, this.map.width, this.map.route.bottom - this.map.route.top);
    this.gates.forEach((gate) => this.tweens.add({ targets: gate, alpha: 0, scaleY: 0, duration: 340, onComplete: () => gate.destroy() }));
    this.gates = [];
  }

  enforceArenaLock() {
    if (!this.activeLock) return;
    const p = this.player.body;
    const min = this.activeLock.left + 48;
    const max = this.boss?.alive && this.boss.type === 'd'
      ? Math.min(this.activeLock.right - 48, this.boss.body.x - 225)
      : this.activeLock.right - 48;
    if (p.x < min) {
      p.x = min;
      if (p.body.velocity.x < 0) p.setVelocityX(0);
    }
    if (p.x > max) {
      p.x = max;
      if (p.body.velocity.x > 0) p.setVelocityX(0);
    }
    const floorY = this.activeLock.floorY ?? GROUND_Y;
    if (p.y < floorY - GROUND_Y + 75) { p.y = floorY - GROUND_Y + 75; p.setVelocityY(Math.max(0, p.body.velocity.y)); }
    const mini = this.traversal?.activeMini?.enemy;
    if (mini?.alive) {
      if (mini.body.x < min || mini.body.x > max) { mini.body.x = clamp(mini.body.x, min, max); mini.body.setVelocityX(0); }
    }
  }

  startBossArena() {
    this.bossCheckpoint = this.map.bossZone.boss;
    this.bossTriggered = true;
    this.setArenaLock(this.map.bossZone.left, this.map.bossZone.right);
    if (this.map.bossZone.boss === 'c') this.spawnBossC();
    else this.spawnBossD();
    const enterStory = () => this.showDialogue(`${this.map.bossZone.boss}_enter`, () => {
      this.bossBattleStarted = true;
      this.boss.nextAttack = this.time.now + 850;
      this.setObjective(this.boss.type === 'c' ? '击败秦岭杀人兔 · 注意刀光前摇' : '机甲防线 · 清除两波小熊，或将装甲打到 60% 以下');
      this.showNotice('BOSS BATTLE', 1600);
    });
    if (this.boss.type === 'd') this.startMechEntrance(enterStory);
    else enterStory();
  }

  startMechEntrance(onComplete) {
    const b = this.boss;
    this.inputManager.setEnabled(false);
    this.player.body.setVelocityX(0);
    b.visual.motion = { x: 520, y: -90, angle: -7 };
    b.visual.sync(b.body.x, GROUND_Y + 4, -1, this.time.now);
    this.setObjective('基地震动 · 重型机甲正在进场');
    this.soundBus.play('charge');
    this.tweens.add({ targets: b.visual.motion, x: 0, y: 0, angle: 0, duration: MECH.entranceMs, ease: 'Cubic.Out',
      onUpdate: () => b.visual.sync(b.body.x, GROUND_Y + 4, -1, this.time.now),
      onComplete: () => {
        if (this.gameOver || this.boss !== b) return;
        this.cameras.main.shake(380, 0.013);
        this.soundBus.play('heavyHit');
        this.spawnHitParticles(b.body.x - 100, GROUND_Y - 8, 0xc4b5a7, 12);
        this.time.delayedCall(450, onComplete);
      },
    });
  }

  spawnBossC() {
    const zone = this.map.bossZone;
    const body = this.physics.add.sprite(zone.right - 260, GROUND_Y - 88, 'pixel');
    body.setAlpha(0.001).setDisplaySize(70, 176).setGravityY(1520).setImmovable(false);
    this.physics.add.collider(body, this.solids);
    this.boss = {
      type: 'c', body, visual: new BossVisual(this, 'c', body.x, GROUND_Y), alive: true,
      hp: 330, maxHp: 330, phase: 1, facing: -1, state: 'idle', hurtUntil: 0,
      nextAttack: this.time.now + 1000, nextLeap: this.time.now + 1700, hitAt: 0, stateUntil: 0, didHit: false,
      nextSmash: this.time.now + 2500, attackKind: 'normal', attackFacing: -1,
      firstHurtSpoken: false, phaseSpoken: false, phaseTransitioning: false, defeatedSpoken: false, telegraph: null,
    };
  }

  spawnBossD() {
    const zone = this.map.bossZone;
    const body = this.physics.add.sprite(zone.right - 320, GROUND_Y - 205, 'pixel');
    body.setAlpha(0.001).setDisplaySize(430, 410).setImmovable(true);
    body.body.setAllowGravity(false);
    this.physics.add.collider(this.player.body, body);
    this.boss = {
      type: 'd', body, visual: new BossVisual(this, 'd', body.x, GROUND_Y + 4), alive: true,
      hp: 620, maxHp: 620, phase: 1, facing: -1, state: 'idle', hurtUntil: 0,
      nextAttack: this.time.now + 1350, busyUntil: 0, cycle: 0,
      attackVersion: 0, patternObjects: [],
      summonWavesStarted: 0, summonPending: false, summonedAdds: [],
      firstHurtSpoken: false, phaseSpoken: false, phaseTransitioning: false, defeatedSpoken: false, telegraph: null,
    };
  }

  updateBoss(time) {
    const b = this.boss;
    if (!b?.alive || !this.bossBattleStarted) return;
    if (time < b.hurtUntil) {
      b.visual.setState(b.type === 'c' && b.phase === 2 ? 'gun-hurt' : 'hurt');
      b.visual.sync(b.body.x, b.type === 'c' ? b.body.y + 88 : GROUND_Y + 4, b.facing, time);
      return;
    }
    if (b.phaseTransitioning) {
      b.body.setVelocity(0, 0);
      b.visual.setState(b.type === 'c' ? 'skill' : 'overload');
      b.visual.sync(b.body.x, b.type === 'c' ? b.body.y + 88 : GROUND_Y + 4, b.facing, time);
      return;
    }
    if (b.type === 'c') this.updateBossC(time);
    else this.updateBossD(time);
    b.visual.sync(b.body.x, b.type === 'c' ? b.body.y + 88 : GROUND_Y + 4, b.facing, time);
  }

  updateBossC(time) {
    const b = this.boss;
    const dx = this.player.body.x - b.body.x;
    const absDx = Math.abs(dx);
    b.facing = b.state === 'windup' ? b.attackFacing : (Math.sign(dx) || -1);
    const grounded = b.body.body.blocked.down || b.body.body.touching.down;
    if (!grounded) {
      b.body.setVelocityX(b.facing * 220);
      b.visual.setState(b.phase === 2 ? 'gun-jump' : 'jump');
      return;
    }
    if (b.state === 'windup') {
      if (b.phase === 2) { this.updateRabbitPhase2Attack(time); return; }
      b.body.setVelocityX(0);
      if (!b.didHit && time >= b.hitAt) {
        b.didHit = true;
        b.telegraph?.destroy();
        b.telegraph = null;
        if (b.phase === 1) {
          b.visual.setState('skill');
          const smash = b.attackKind === 'smash';
          const inFront = dx * b.attackFacing >= -25;
          if (inFront && absDx < (smash ? RABBIT_SMASH.range : 185) && Math.abs(this.player.body.y - b.body.y) < 135) {
            this.damagePlayer(smash ? RABBIT_SMASH.damage : 18, b.body.x, smash ? 520 : 460, smash);
          }
          this.spawnSheetFx(b.body.x + b.facing * (smash ? 145 : 92), b.body.y - 4, 2, smash ? 245 : 165, b.facing);
          this.impactFeedback(b.body.x + b.facing * 90, b.body.y, true, false);
        }
      }
      if (time >= b.stateUntil) {
        b.state = 'idle';
        b.visual.setState(b.phase === 2 ? 'gun' : 'idle');
      }
      return;
    }
    if (b.phase === 2 && time >= b.nextAttack && absDx < 900) {
      this.startRabbitPhase2Attack(time);
      return;
    }
    if (b.phase === 1 && time >= b.nextSmash && absDx < 360) {
      this.startBossCAttack(time, true);
      return;
    }
    if (b.phase === 1 && time >= b.nextLeap && absDx > 300 && absDx < 720) {
      b.nextLeap = time + 3600;
      b.nextAttack = Math.max(b.nextAttack, time + 900);
      b.body.setVelocity(b.facing * 235, -510);
      b.visual.setState('jump');
      return;
    }
    const preferred = b.phase === 1 ? 145 : 430;
    if ((b.phase === 1 && absDx > preferred) || (b.phase === 2 && absDx > 560)) {
      b.body.setVelocityX(b.facing * (b.phase === 1 ? 155 : 105));
      b.visual.setState(b.phase === 2 ? 'gun-run' : 'run');
    } else if (b.phase === 2 && absDx < 280) {
      b.body.setVelocityX(-b.facing * 130);
      b.visual.setState('gun-run');
    } else {
      b.body.setVelocityX(Phaser.Math.Linear(b.body.body.velocity.x, 0, 0.25));
      b.visual.setState(b.phase === 2 ? 'gun' : 'idle');
    }
    if (time >= b.nextAttack && absDx < (b.phase === 1 ? 210 : 680)) this.startBossCAttack(time);
  }

  startBossCAttack(time, smash = false) {
    const b = this.boss;
    if (b.phase === 2) { this.startRabbitPhase2Attack(time); return; }
    const warning = smash ? RABBIT_SMASH.windupMs : b.phase === 1 ? 540 : 680;
    b.attackKind = smash ? 'smash' : 'normal';
    b.attackFacing = b.facing;
    b.state = 'windup';
    b.didHit = false;
    b.hitAt = time + warning;
    b.stateUntil = b.hitAt + (smash ? RABBIT_SMASH.recoveryMs : 320);
    b.nextAttack = smash ? b.stateUntil + 300 : time + (b.phase === 1 ? 1450 : 1650);
    if (smash) b.nextSmash = time + RABBIT_SMASH.cooldownMs;
    b.body.setVelocityX(0);
    b.visual.setState(b.phase === 1 ? 'attack' : 'gun');
    if (smash) {
      b.telegraph = this.add.rectangle(b.body.x + b.facing * 145, GROUND_Y - 12, RABBIT_SMASH.range, 22, 0xff582f, 0.32).setStrokeStyle(3, 0xffd9a5).setDepth(21);
      this.addWarningText('重斩 · 闪避或跳开', b.body.x, b.body.y - 125, warning);
      this.soundBus.play('charge');
    } else if (b.phase === 1) {
      b.telegraph = this.add.arc(b.body.x + b.facing * 102, b.body.y + 72, 88, 195, 342, false, 0xff284f, 0.23).setStrokeStyle(6, 0xffd3c7, 0.9).setDepth(21);
    } else {
      b.telegraph = this.add.rectangle((b.body.x + this.player.body.x) / 2, this.player.body.y - 16, Math.abs(b.body.x - this.player.body.x), 8, 0xff3e53, 0.58).setDepth(21);
    }
    this.tweens.add({ targets: b.telegraph, alpha: 0.1, duration: warning / 4, yoyo: true, repeat: 3 });
  }

  startRabbitPhase2Attack(time) {
    const b = this.boss, rules = RABBIT_PHASE2;
    const close = Math.abs(this.player.body.x - b.body.x) < rules.closeRange && Math.abs(this.player.body.y - b.body.y) < 135;
    b.state = 'windup';
    b.attackKind = close ? 'combo' : 'sniper';
    b.attackFacing = b.facing;
    b.didHit = false;
    b.comboStep = 0;
    b.aimLocked = false;
    b.aimTarget = null;
    b.body.setVelocityX(0);
    b.visual.setState('gun');
    if (close) {
      b.hitAt = time + rules.firstHitMs;
      b.comboSecondAt = time + rules.secondHitMs;
      b.stateUntil = b.comboSecondAt + rules.comboRecoveryMs;
      b.telegraph = this.add.rectangle(b.body.x + b.facing * 135, GROUND_Y - 14, 270, 24, 0xff582f, 0.3).setStrokeStyle(3, 0xffd9a5).setDepth(21);
      b.warningLabel = this.addWarningText('枪托两连 · 末击击倒', b.body.x, b.body.y - 130, rules.secondHitMs);
    } else {
      b.aimLockAt = time + rules.trackMs;
      b.hitAt = b.aimLockAt + rules.lockMs;
      b.stateUntil = b.hitAt + rules.sniperRecoveryMs;
      b.telegraph = this.add.graphics().setDepth(21);
      b.warningLabel = this.addWarningText('狙击追踪 → 金线锁定后闪避', b.body.x, b.body.y - 135, rules.trackMs + rules.lockMs);
      this.updateRabbitAim(time);
    }
    b.nextAttack = b.stateUntil + 450;
    this.soundBus.play('charge');
  }

  updateRabbitAim(time) {
    const b = this.boss;
    // Freeze the last visible aim sample, never retarget at the firing frame.
    if (time < b.aimLockAt || !b.aimTarget) {
      const target = this.player.body;
      b.attackFacing = b.facing = Math.sign(target.x - b.body.x) || b.attackFacing;
      b.aimTarget = { x: target.x + clamp(target.body.velocity.x * 0.12, -100, 100), y: target.y };
      b.aimOrigin = { x: b.body.x + b.attackFacing * 72, y: b.body.y - 25 };
    }
    if (time >= b.aimLockAt && !b.aimLocked) {
      b.aimLocked = true;
      this.soundBus.play('charge');
    }
    const from = b.aimOrigin, target = b.aimTarget;
    const length = Math.hypot(target.x - from.x, target.y - from.y) || 1;
    b.telegraph.clear().lineStyle(b.aimLocked ? 5 : 2, b.aimLocked ? 0xffd675 : 0xff365e, 0.9)
      .lineBetween(from.x, from.y, from.x + (target.x - from.x) / length * 1200, from.y + (target.y - from.y) / length * 1200)
      .strokeCircle(target.x, target.y, b.aimLocked ? 22 : 32)
      .lineBetween(target.x - 42, target.y, target.x + 42, target.y)
      .lineBetween(target.x, target.y - 42, target.x, target.y + 42);
  }

  updateRabbitPhase2Attack(time) {
    const b = this.boss, rules = RABBIT_PHASE2;
    b.body.setVelocityX(0);
    if (b.attackKind === 'sniper' && !b.didHit) {
      this.updateRabbitAim(time);
      if (time >= b.hitAt) {
        b.didHit = true;
        b.telegraph?.destroy(); b.telegraph = null;
        b.warningLabel?.destroy(); b.warningLabel = null;
        this.spawnBossGunshot(b);
      }
    } else if (b.attackKind === 'combo') {
      const second = b.comboStep === 1;
      if (b.comboStep < 2 && time >= (second ? b.comboSecondAt : b.hitAt)) {
        b.comboStep++;
        b.visual.setState('gun-strike', true);
        const dx = this.player.body.x - b.body.x;
        if (dx * b.attackFacing >= -25 && Math.abs(dx) < (second ? 285 : 215) && Math.abs(this.player.body.y - b.body.y) < 135) {
          this.damagePlayer(second ? rules.secondDamage : rules.firstDamage, b.body.x, second ? 560 : 240, second);
        }
        this.spawnSheetFx(b.body.x + b.attackFacing * (second ? 150 : 92), b.body.y, 2, second ? 230 : 145, b.attackFacing);
        this.impactFeedback(b.body.x + b.attackFacing * 95, b.body.y, second, false);
        this.soundBus.play(second ? 'heavyHit' : 'swing');
        if (second) { b.telegraph?.destroy(); b.telegraph = null; b.warningLabel?.destroy(); b.warningLabel = null; }
      } else if (b.comboStep === 1 && time > b.hitAt + 180) b.visual.setState('gun');
    }
    if (time >= b.stateUntil) {
      b.state = 'idle';
      b.aimTarget = null;
      b.visual.setState('gun');
    }
  }

  spawnBossGunshot(boss) {
    boss.visual.setState('fire');
    const target = boss.aimTarget, origin = boss.aimOrigin;
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    this.spawnProjectile({ owner: 'boss', type: 'sniper', x: origin.x, y: origin.y, vx: Math.cos(angle) * RABBIT_PHASE2.sniperSpeed, vy: Math.sin(angle) * RABBIT_PHASE2.sniperSpeed, damage: RABBIT_PHASE2.sniperDamage, life: 1600, cell: 3, height: 42, facing: boss.attackFacing });
    this.soundBus.play('shot');
    this.cameras.main.shake(100, 0.005);
  }

  updateBossD(time) {
    const b = this.boss;
    b.body.setVelocity(0, 0);
    if (mechPhaseReady(b)) { this.beginBossPhase(); return; }
    if (b.phase === 1) {
      // Empty pre-spawn windows are not cleared waves. Count only actual
      // summons, and never start the second batch while the first is alive.
      if (time >= b.nextAttack && !b.summonPending && b.summonWavesStarted < MECH.summonWaves && !b.summonedAdds.some(enemy => enemy.alive)) this.startSummonPattern(time);
      else if (time >= b.busyUntil) b.visual.setState('idle');
      return;
    }
    if (time < b.busyUntil) return;
    b.visual.setState('idle');
    if (time < b.nextAttack) return;
    const pattern = ['laser', 'lanes', 'fan', 'laser'][b.cycle++ % 4];
    if (pattern === 'lanes') this.startLanePattern(time);
    if (pattern === 'fan') this.startFanPattern(time);
    if (pattern === 'summon') this.startSummonPattern(time);
    if (pattern === 'laser') this.startLaserPattern(time);
  }

  startLanePattern(time) {
    const b = this.boss;
    const version = b.attackVersion;
    const warning = 850;
    const lanes = [GROUND_Y - 55, GROUND_Y - 225, GROUND_Y - 390];
    b.busyUntil = time + warning + 520;
    b.nextAttack = b.busyUntil + 650;
    b.visual.setState('lanes');
    const warnings = lanes.map((y) => this.add.rectangle((this.map.bossZone.left + b.body.x) / 2, y, b.body.x - this.map.bossZone.left, 7, 0xff3d70, 0.44).setDepth(20));
    b.patternObjects = warnings;
    warnings.forEach((warningLine, index) => this.tweens.add({ targets: warningLine, alpha: 0.08, duration: 160 + index * 35, yoyo: true, repeat: 3 }));
    this.addWarningText('低 / 中 / 高位弹幕', b.body.x - 310, 135, warning);
    this.time.delayedCall(warning, () => {
      warnings.forEach((line) => line.destroy());
      if (!b.alive || b.phaseTransitioning || version !== b.attackVersion) return;
      lanes.forEach((y, index) => this.spawnProjectile({ owner: 'boss', type: 'berry', x: b.body.x - 115, y, vx: -(360 + index * 25), vy: 0, damage: 12, life: 4200, cell: 4, height: 46, facing: -1 }));
      this.soundBus.play('shot');
    });
  }

  startFanPattern(time) {
    const b = this.boss;
    const version = b.attackVersion;
    const warning = 950;
    b.busyUntil = time + warning + 680;
    b.nextAttack = b.busyUntil + 700;
    b.visual.setState('fan');
    const fan = this.spawnSheetFx(b.body.x - 175, b.body.y + 10, 5, 260, -1, warning + 100);
    fan?.setAlpha(0.35);
    b.patternObjects = fan ? [fan] : [];
    this.addWarningText('扇形弹幕 · 寻找弹间空隙', b.body.x - 340, 148, warning);
    this.time.delayedCall(warning, () => {
      if (!b.alive || b.phaseTransitioning || version !== b.attackVersion) return;
      const base = Phaser.Math.Angle.Between(b.body.x - 130, b.body.y, this.player.body.x, this.player.body.y);
      [-0.44, -0.22, 0, 0.22, 0.44].forEach((offset) => {
        const angle = base + offset;
        this.spawnProjectile({ owner: 'boss', type: 'berry', x: b.body.x - 140, y: b.body.y, vx: Math.cos(angle) * 345, vy: Math.sin(angle) * 345, damage: 11, life: 3900, cell: 4, height: 44, facing: -1 });
      });
      this.soundBus.play('shot');
    });
  }

  startSummonPattern(time) {
    const b = this.boss;
    if (b.phase !== 1 || b.summonPending || b.summonWavesStarted >= MECH.summonWaves) return;
    b.summonPending = true;
    const version = b.attackVersion;
    const warning = 760;
    b.busyUntil = time + warning + 450;
    b.nextAttack = b.busyUntil + 850;
    b.visual.setState('summon');
    const ringA = this.add.circle(b.body.x - 360, GROUND_Y - 8, 68, 0xff3977, 0.12).setStrokeStyle(6, 0xff9bbb, 0.9).setDepth(18);
    const ringB = this.add.circle(b.body.x - 690, GROUND_Y - 190, 58, 0xff3977, 0.12).setStrokeStyle(6, 0xff9bbb, 0.9).setDepth(18);
    b.patternObjects = [ringA, ringB];
    this.tweens.add({ targets: [ringA, ringB], scale: 0.25, alpha: 1, duration: warning, ease: 'Sine.In' });
    this.addWarningText(`小熊防线 ${b.summonWavesStarted + 1} / 2`, b.body.x - 430, 142, warning);
    this.time.delayedCall(warning, () => {
      ringA.destroy(); ringB.destroy();
      if (!b.alive || b.phaseTransitioning || version !== b.attackVersion || this.boss !== b) return;
      b.summonedAdds = [
        this.spawnEnemy({ type: 'berryGround', x: b.body.x - 370, y: 390 }),
        this.spawnEnemy({ type: 'berryFlying', x: b.body.x - 710, y: 300 }),
      ];
      b.summonWavesStarted += 1;
      b.summonPending = false;
      this.setObjective(`小熊防线 ${b.summonWavesStarted} / 2 · 清除后推进；也可直接攻击机甲`);
    });
  }

  startLaserPattern(time) {
    const b = this.boss;
    const version = b.attackVersion;
    const warning = 1250;
    const y = GROUND_Y - 90;
    b.busyUntil = time + warning + 1250;
    b.nextAttack = b.busyUntil + 1200;
    b.visual.setState('charge');
    this.time.delayedCall(720, () => {
      if (b.alive && !b.phaseTransitioning && version === b.attackVersion) b.visual.setState('laser');
    });
    const line = this.add.rectangle((this.map.bossZone.left + b.body.x) / 2, y, b.body.x - this.map.bossZone.left, 18, 0xff315f, 0.3).setStrokeStyle(4, 0xffe8d9, 0.85).setDepth(23);
    b.patternObjects = [line];
    this.tweens.add({ targets: line, alpha: 0.9, scaleY: 1.8, duration: 210, yoyo: true, repeat: 4 });
    this.addWarningText('激光向上扫射 · 二段跳到最高平台！', b.body.x - 440, 130, warning);
    this.time.delayedCall(warning, () => {
      line.destroy();
      if (!b.alive || b.phaseTransitioning || version !== b.attackVersion) return;
      this.soundBus.play('laser');
      this.cameras.main.shake(640, 0.011);
      this.cameras.main.flash(100, 255, 235, 238, false);
      const beam = this.add.rectangle((this.map.bossZone.left + b.body.x) / 2, y, b.body.x - this.map.bossZone.left, 104, 0xff2d68, 0.82).setStrokeStyle(8, 0xffffff, 0.9).setDepth(24);
      const fx = this.spawnSheetFx((this.map.bossZone.left + b.body.x) / 2, y, 6, 170, -1, 1100);
      if (fx) fx.setDisplaySize(b.body.x - this.map.bossZone.left, 150);
      this.laser = { y, fromY: y, toY: GROUND_Y - 230, startedAt: this.time.now, height: 104, until: this.time.now + 1100, nextDamage: 0, beam, fx };
      this.time.delayedCall(1100, () => { beam.destroy(); fx?.destroy(); if (this.laser?.beam === beam) this.laser = null; });
    });
  }

  addWarningText(text, x, y, duration) {
    const label = this.add.text(x, y, `⚠ ${text}`, { fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff0d9', backgroundColor: '#731b35dd', padding: { x: 14, y: 8 } }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: label, alpha: 0.32, duration: 170, yoyo: true, repeat: Math.max(1, Math.floor(duration / 340)), onComplete: () => label.destroy() });
    return label;
  }

  hurtBoss(damage, knockback, heavy = false) {
    const b = this.boss;
    if (!b?.alive || !this.bossBattleStarted) return;
    b.hp -= damage;
    b.hurtUntil = this.time.now + (heavy ? 230 : 145);
    if (b.type === 'c' && b.phase === 2 && b.state === 'windup') {
      // A real hit interrupts the current windup/combo; no delayed ghost shot.
      b.telegraph?.destroy(); b.telegraph = null;
      b.warningLabel?.destroy(); b.warningLabel = null;
      b.aimTarget = null;
      b.state = 'idle';
      b.nextAttack = this.time.now + 650;
    }
    b.visual.setState(b.type === 'c' && b.phase === 2 ? 'gun-hurt' : 'hurt');
    b.visual.flash(110);
    if (b.type === 'c') b.body.setVelocityX(knockback * 0.3);
    this.soundBus.play('enemyHurt');

    if (b.hp <= 0) { this.defeatBoss(); return; }
    if (!b.firstHurtSpoken) {
      b.firstHurtSpoken = true;
      this.showDialogue(`${b.type}_first_hurt`, undefined, () => this.boss === b && b.alive);
    }
    if ((b.type === 'c' && b.hp <= b.maxHp * 0.2) || (b.type === 'd' && mechPhaseReady(b))) this.beginBossPhase();
  }

  cancelBossPatterns(b) {
    b.attackVersion = (b.attackVersion || 0) + 1;
    b.summonPending = false;
    b.telegraph?.destroy();
    b.telegraph = null;
    b.warningLabel?.destroy(); b.warningLabel = null;
    b.aimTarget = null;
    b.patternObjects?.forEach(object => object?.active && object.destroy());
    b.patternObjects = [];
    this.projectiles.filter(p => p.owner === 'boss').forEach(p => this.destroyProjectile(p));
    this.laser?.beam.destroy();
    this.laser?.fx?.destroy();
    this.laser = null;
  }

  beginBossPhase() {
    const b = this.boss;
    if (!b?.alive || b.phaseSpoken || b.phaseTransitioning) return;
    b.phaseSpoken = true;
    b.phaseTransitioning = true;
    b.state = 'phase';
    b.didHit = true;
    this.cancelBossPatterns(b);
    b.body.setVelocity(0, 0);
    b.visual.setState(b.type === 'c' ? 'skill' : 'overload');
    this.showDialogue(`${b.type}_phase`, () => {
      b.phase = 2;
      b.phaseTransitioning = false;
      b.state = 'idle';
      b.hurtUntil = 0;
      b.busyUntil = this.time.now + 600;
      b.nextAttack = this.time.now + 1200;
      b.visual.setState(b.type === 'c' ? 'gun' : 'overload');
      this.setObjective(b.type === 'c' ? '秦岭杀人兔 · 近身两连，狙击金线锁定后闪避' : '超载模式 · 跳上高台躲扫射，抓住炮击间隙反击');
      this.cameras.main.flash(180, 255, 60, 105, false);
    }, () => this.boss === b && b.alive);
  }

  defeatBoss() {
    const b = this.boss;
    if (!b?.alive || b.defeatedSpoken) return;
    b.hp = 0;
    b.alive = false;
    b.defeatedSpoken = true;
    b.body.disableBody(true, true);
    this.cancelBossPatterns(b);
    this.projectiles.filter(projectile => projectile.owner !== 'player').forEach(projectile => this.destroyProjectile(projectile));
    this.enemies.filter((enemy) => enemy.alive).forEach((enemy) => this.killEnemy(enemy));
    this.soundBus.play('heavyHit');
    this.cameras.main.shake(360, 0.016);
    this.cameras.main.flash(180, 255, 255, 255, false);
    if (b.type === 'd') {
      b.dying = true;
      b.visual.setState('overload');
      this.showDialogue('d_defeated', () => this.startMechExplosion(b));
      return;
    }
    this.showDialogue(`${b.type}_defeated`, () => {
      this.tweens.add({ targets: b.visual.image, alpha: 0, y: b.visual.image.y + 36, angle: 7, duration: 700, onComplete: () => b.visual.destroy() });
      this.bossDefeated = true;
      this.clearArenaLock();
      if (b.type === 'c') {
        this.setObjective('道路已解锁 · 亲自向右走到小木屋');
        this.showNotice('道路解锁 · 继续向右', 1900);
      } else {
        this.time.delayedCall(750, () => this.missionComplete());
      }
    });
  }

  startMechExplosion(b) {
    if (this.gameOver || this.boss !== b || b.explosionStarted) return;
    b.explosionStarted = true;
    this.setObjective('机甲自爆 · 退到左侧灯标外，或抓准时机闪避！');
    const dangerLeft = b.body.x - MECH.blastRadius;
    const warning = this.add.rectangle((dangerLeft + this.map.bossZone.right) / 2, GROUND_Y - 205,
      this.map.bossZone.right - dangerLeft, 410, 0xff542b, 0.15).setStrokeStyle(3, 0xffb34d, 0.85).setDepth(8);
    this.addWarningText('机甲自爆 · 退到左侧安全区', dangerLeft + 200, 170, MECH.blastWarningMs);
    this.tweens.add({ targets: warning, alpha: 0.6, duration: 160, yoyo: true, repeat: 5 });
    this.tweens.add({ targets: b.visual.image, angle: { from: -2, to: 2 }, duration: 75, yoyo: true, repeat: 10 });
    this.soundBus.play('charge');
    // Scene-clock timer freezes with pause/dialogue. The player remains in
    // control until this exact instant; no victory/checkpoint is committed yet.
    this.time.delayedCall(MECH.blastWarningMs, () => {
      warning.destroy();
      if (this.gameOver || this.boss !== b) return;
      this.soundBus.play('heavyHit');
      this.cameras.main.shake(680, 0.025);
      this.cameras.main.flash(200, 255, 198, 113, false);
      this.tweens.killTweensOf(b.visual.image);
      b.visual.destroy();
      propImage(this, b.body.x, GROUND_Y + 5, 'wreck', 560).setDepth(9);
      const blast = propImage(this, b.body.x - 70, GROUND_Y - 200, 'explosion-0', 680, 0.5).setDepth(35);
      [1, 2, 3].forEach((frame, index) => this.time.delayedCall(110 + index * 170, () => {
        if (blast.active) blast.setTexture(`prop-explosion-${frame}`);
      }));
      this.tweens.add({ targets: blast, alpha: 0, delay: 520, duration: 650, onComplete: () => blast.destroy() });
      this.spawnHitParticles(b.body.x - 100, GROUND_Y - 160, 0xffa12b, 18);
      if (Math.abs(this.player.body.x - b.body.x) < MECH.blastRadius) {
        this.damagePlayer(this.player.maxHp * MECH.blastHpRatio, b.body.x, 430, false, true);
      }
      if (this.gameOver || this.player.hp <= 0) return;
      b.dying = false;
      this.bossDefeated = true;
      this.clearArenaLock();
      this.time.delayedCall(1300, () => {
        if (this.gameOver || this.boss !== b) return;
        this.showDialogue('rescue', () => this.missionComplete());
      });
    });
  }

  enterCabin() {
    if (this.merchantVisited) return;
    this.merchantVisited = true;
    this.cabinInside = true;
    this.player.body.setVelocityX(0);
    this.showDialogue('merchant', () => {
      this.inputManager.setEnabled(false);
      this.setPhysicsPause('shop', true);
      window.friendFightersUI?.showShop();
    });
  }

  chooseShopItem(item) {
    if (!this.merchantVisited || this.shopChosen) return;
    const allowed = ['heal', 'max', 'badfruit', 'hurt', 'knife'];
    if (!allowed.includes(item)) return;
    this.shopChosen = true;
    this.carry.selectedItem = item;
    if (item === 'heal') this.player.hp = this.player.maxHp;
    if (item === 'max') {
      this.carry.maxHpBonus += 25;
      this.player.maxHp += 25;
      this.player.hp += 25;
    }
    if (item === 'badfruit') {
      this.player.hp = Math.max(1, this.player.hp - 10);
      const combatNow = this.combatPauseSnapshot?.clockTime ?? this.time.now;
      const remaining = Math.max(0, this.player.skillReadyAt - combatNow);
      this.carry.skillCooldownReductionMs += 500;
      this.carry.slowUntil = 0;
      this.player.skillReadyAt = this.time.now + Math.max(0, remaining - 500);
    }
    if (item === 'hurt') this.player.hp = Math.max(1, this.player.hp - 34);
    if (item === 'knife') {
      this.carry.attackMultiplier *= 1.22;
      this.player.attack *= 1.22;
    }
    this.soundBus.play(item === 'badfruit' || item === 'hurt' ? 'hurt' : 'pickup');
    window.friendFightersUI?.hideShop(item);
    this.setPhysicsPause('shop', false);
    this.inputManager.setEnabled(true);
    this.setObjective('已选择 1 件物品 · 从木屋右门离开');
    this.player.body.x = Math.max(this.player.body.x, 5820);
  }

  transitionToMap(nextMapIndex) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.inputManager.setEnabled(false);
    this.player.body.setVelocityX(0);
    this.cameras.main.fadeOut(430, 8, 7, 12);
    this.time.delayedCall(470, () => {
      const hp = nextMapIndex > this.mapIndex ? nextStageHp(this.player.hp, this.player.maxHp) : this.player.hp;
      this.scene.restart({ heroId: this.heroId, mapIndex: nextMapIndex, hp, carry: this.carry });
    });
  }

  playerDefeated() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.inputManager.setEnabled(false);
    this.setPhysicsPause('gameover', true);
    const atBoss = Boolean(this.bossCheckpoint && !this.bossDefeated);
    const atMini = Boolean(this.miniCheckpoint);
    window.friendFightersUI?.showResult(false, '救援暂时中断',
      atBoss ? '将在 Boss 战前满血复活，保留道具，无需重打前面的小兵。' : atMini ? '将在守卫房间入口满血复活，已接通的机关和已清除的封锁区会保留。' : '调整闪避和格挡时机，再从本关起点重试。',
      atBoss ? '重新挑战 Boss' : atMini ? '重新挑战守卫' : '重试本关');
  }

  missionComplete() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.inputManager.setEnabled(false);
    this.setPhysicsPause('gameover', true);
    window.friendFightersUI?.showResult(true, '小马公主获救', `${this.heroData.name}穿过国轩之窟，击败草莓熊博士，把公主平安带回了小马国。`);
  }

  spawnProjectile(config) {
    // Combined enemy + boss projectile budget for readable phone encounters.
    if (config.owner !== 'player' && this.projectiles.filter((p) => p.active && p.owner !== 'player').length >= 10) return null;
    if (config.owner === 'boss') {
      const activeBossShots = this.projectiles.filter((projectile) => projectile.active && projectile.owner === 'boss');
      while (activeBossShots.length >= 10) this.destroyProjectile(activeBossShots.shift());
    }
    const image = this.createFxImage(config.x, config.y, config.cell, config.height, config.facing);
    const projectile = {
      ...config,
      image,
      active: true,
      createdAt: this.time.now,
      expiresAt: this.time.now + config.life,
      hit: new Set(),
      lastHits: new Map(),
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  updateProjectiles(time, dt) {
    for (const projectile of this.projectiles) {
      if (this.dialogueActive || this.gameOver) break;
      if (!projectile.active) continue;
      if (projectile.returnAt && time >= projectile.returnAt && !projectile.returning) {
        projectile.returning = true;
        projectile.hit.clear();
        projectile.vx *= -1;
        projectile.facing *= -1;
        projectile.image.setFlipX(projectile.facing < 0);
      }
      const previous = { x: projectile.x, y: projectile.y };
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.image.setPosition(projectile.x, projectile.y).setAngle(projectile.image.angle + dt * (projectile.type === 'shield' ? 780 : 80));

      if (projectile.owner === 'player') {
        for (const enemy of this.enemies) {
          if (!enemy.alive || projectile.hit.has(enemy) || time - (projectile.lastHits.get(enemy) ?? -Infinity) < 200 || Math.hypot(enemy.body.x - projectile.x, enemy.body.y - projectile.y) > 92) continue;
          projectile.hit.add(enemy);
          projectile.lastHits.set(enemy, time);
          this.hurtEnemy(enemy, projectile.damage, Math.sign(projectile.vx) * 390, true);
          this.impactFeedback(projectile.x, projectile.y, true);
        }
        if (this.boss?.alive && !projectile.hit.has(this.boss) && time - (projectile.lastHits.get(this.boss) ?? -Infinity) >= 200 && distance(this.bossContactPoint(projectile), projectile) < 120) {
          projectile.hit.add(this.boss);
          projectile.lastHits.set(this.boss, time);
          this.hurtBoss(projectile.damage, Math.sign(projectile.vx) * 240, true);
          this.impactFeedback(projectile.x, projectile.y, true);
        }
        for (const crate of this.crates) {
          if (crate.alive && !projectile.hit.has(crate) && Math.abs(crate.x - projectile.x) < 70 && Math.abs(GROUND_Y - 35 - projectile.y) < 80) {
            projectile.hit.add(crate);
            this.hurtCrate(crate, projectile.damage);
          }
        }
        if (projectile.returning && Math.abs(projectile.x - this.player.body.x) < 58) this.destroyProjectile(projectile);
      } else if (segmentDistance(this.player.body, previous, projectile) < (projectile.type === 'berry' ? 62 : 52)) {
        if (this.damagePlayer(projectile.damage, projectile.x, 250)) this.impactFeedback(projectile.x, projectile.y, false);
        this.destroyProjectile(projectile);
      }
      if (time >= projectile.expiresAt || projectile.x < -150 || projectile.x > this.map.width + 150 || projectile.y < (this.map.route?.top ?? 0) - 150 || projectile.y > (this.map.route?.bottom ?? 720) + 150) this.destroyProjectile(projectile);
    }

    if (this.laser) {
      const sweep = clamp((time - this.laser.startedAt) / (this.laser.until - this.laser.startedAt), 0, 1);
      this.laser.y = Phaser.Math.Linear(this.laser.fromY, this.laser.toY, sweep);
      this.laser.beam.y = this.laser.y;
      if (this.laser.fx?.active) this.laser.fx.y = this.laser.y;
    }
    if (this.laser && time <= this.laser.until && time >= this.laser.nextDamage) {
      const p = this.player.body;
      if (Math.abs(p.y - this.laser.y) < this.laser.height / 2 + 58) {
        this.laser.nextDamage = time + 330;
        this.damagePlayer(18, this.boss?.body.x || p.x + 1, 390);
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
  }

  destroyProjectile(projectile) {
    if (!projectile?.active) return;
    projectile.active = false;
    projectile.image?.destroy();
  }

  createFxImage(x, y, cell, height, facing = 1) {
    const image = this.add.image(x, y, `skill-effect-${cell}`).setOrigin(0.5).setDepth(22);
    image.setScale(height / image.height).setFlipX(facing < 0);
    return image;
  }

  spawnSheetFx(x, y, cell, height, facing = 1, duration = 280) {
    if (!this.textures.exists(`skill-effect-${cell}`)) return null;
    const image = this.createFxImage(x, y, cell, height, facing).setAlpha(0.92);
    this.tweens.add({ targets: image, alpha: 0, scaleX: image.scaleX * 1.18, scaleY: image.scaleY * 1.18, duration, ease: 'Quad.Out', onComplete: () => image.destroy() });
    return image;
  }

  hurtCrate(crate, damage) {
    if (!crate.alive) return;
    crate.hp -= damage;
    this.tweens.add({ targets: crate.visual, x: crate.x + Phaser.Math.Between(-7, 7), duration: 45, yoyo: true, repeat: 2 });
    this.spawnHitParticles(crate.x, GROUND_Y - 35, 0xd99a51, 5);
    if (crate.hp > 0) return;
    crate.alive = false;
    crate.body.destroy();
    this.tweens.add({ targets: crate.visual, alpha: 0, y: crate.visual.y + 22, angle: 18, duration: 270, onComplete: () => crate.visual.destroy() });
    this.spawnHeart(crate.x, GROUND_Y - 50);
  }

  spawnHeart(x, y) {
    const c = this.add.container(x, y).setDepth(17);
    const glow = this.add.circle(0, 0, 27, 0xff4261, 0.18);
    const text = this.add.text(0, 0, '♥', { fontFamily: 'serif', fontSize: '34px', color: '#ff5268', stroke: '#fff2dc', strokeThickness: 2 }).setOrigin(0.5);
    c.add([glow, text]);
    this.tweens.add({ targets: c, y: y - 12, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.pickups.push({ type: 'heart', object: c, active: true });
  }

  updatePickups() {
    for (const pickup of this.pickups) {
      if (!pickup.active || distance(pickup.object, this.player.body) > 72) continue;
      pickup.active = false;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.soundBus.play('pickup');
      this.tweens.add({ targets: pickup.object, alpha: 0, scale: 1.6, duration: 220, onComplete: () => pickup.object.destroy() });
    }
  }

  updateHazards(time, dt) {
    for (const hazard of this.hazards) {
      if (hazard.state === 'idle' && !this.activeLock && atGroundTrigger(this.player.body, hazard.warningX)) {
        hazard.state = 'warning';
        hazard.warning = this.add.ellipse(hazard.x, GROUND_Y - 2, 190, 42, 0xff354f, 0.2).setStrokeStyle(5, 0xffd2b6, 0.92).setDepth(8);
        this.tweens.add({ targets: hazard.warning, alpha: 0.8, scaleX: 0.58, duration: 720, ease: 'Sine.In' });
        this.addWarningText('落石', hazard.x, 260, 720);
        this.time.delayedCall(720, () => {
          if (hazard.state !== 'warning') return;
          hazard.state = 'falling';
          hazard.y = -70;
          hazard.vy = 90;
          hazard.rock = propImage(this, hazard.x, hazard.y, 'boulder', 98, 0.5).setDepth(19);
        });
      }
      if (hazard.state !== 'falling') continue;
      hazard.vy += 1550 * dt;
      hazard.y += hazard.vy * dt;
      hazard.rock.setY(hazard.y).setAngle(hazard.rock.angle + dt * 210);
      if (hazard.y >= GROUND_Y - 45) this.impactRock(hazard);
    }
  }

  impactRock(hazard) {
    hazard.state = 'done';
    hazard.rock?.destroy();
    hazard.warning?.destroy();
    this.cameras.main.shake(220, 0.012);
    this.spawnHitParticles(hazard.x, GROUND_Y - 24, 0xb89b78, 13);
    if (Math.abs(this.player.body.x - hazard.x) < 120 && Math.abs(this.player.body.y - (GROUND_Y - 75)) < 155) this.damagePlayer(16, hazard.x, 410);
    for (const enemy of this.enemies) {
      if (enemy.alive && Math.abs(enemy.body.x - hazard.x) < 115) this.hurtEnemy(enemy, 32, Math.sign(enemy.body.x - hazard.x || 1) * 380, true);
    }
    if (this.boss?.alive && Math.abs(this.boss.body.x - hazard.x) < 150) this.hurtBoss(28, 0, true);
  }

  impactFeedback(x, y, heavy = false, pause = true) {
    this.spawnHitParticles(x, y, heavy ? 0xfff2c0 : 0xff5369, heavy ? 12 : 7);
    this.soundBus.play(heavy ? 'heavyHit' : 'hit');
    this.cameras.main.shake(heavy ? 135 : 80, heavy ? 0.011 : 0.006);
    if (heavy) this.cameras.main.flash(65, 255, 248, 225, false);
    if (pause) this.hitStop(heavy ? 72 : 45);
  }

  hitStop(duration) {
    if (this.hitStopRunning) return;
    this.hitStopRunning = true;
    this.setPhysicsPause('hitstop', true);
    window.setTimeout(() => {
      if (!this.scene?.isActive?.()) return;
      this.hitStopRunning = false;
      this.setPhysicsPause('hitstop', false);
    }, duration);
  }

  spawnHitParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(3, 8), i % 3 === 0 ? WHITE : color, 0.95).setDepth(34);
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const speed = Phaser.Math.Between(55, 190);
      this.tweens.add({ targets: particle, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed, alpha: 0, scale: 0.2, duration: Phaser.Math.Between(180, 360), ease: 'Quad.Out', onComplete: () => particle.destroy() });
    }
  }

  spawnJumpFx(x, y, doubleJump) {
    const ring = this.add.ellipse(x, y, doubleJump ? 90 : 62, 20, doubleJump ? 0xb9e7ff : 0xe8d4bd, 0.42).setStrokeStyle(3, 0xffffff, 0.75).setDepth(9);
    this.tweens.add({ targets: ring, scaleX: 1.7, scaleY: 0.45, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.spawnHitParticles(x, y, doubleJump ? 0x9ee8ff : 0xd8c29b, doubleJump ? 8 : 4);
  }

  spawnBlockFx(x, y) {
    const shield = this.spawnSheetFx(x, y, 0, 88, this.player.facing, 220);
    shield?.setAlpha(0.72);
    this.spawnHitParticles(x, y, 0x8bd5ff, 5);
  }

  updateSpeedLines(time) {
    this.speedLines.clear();
    const p = this.player;
    const velocity = Math.abs(p.body.body.velocity.x);
    if (velocity < 275 || !['run', 'dodge', 'skill'].includes(p.state)) return;
    const intensity = clamp((velocity - 250) / 500, 0.15, 0.8);
    this.speedLines.lineStyle(2, this.heroId === 'a' ? 0xaed7ff : 0xffd0d0, intensity * 0.5);
    for (let i = 0; i < 9; i += 1) {
      const y = 100 + ((i * 67 + Math.floor(time / 19) * 17) % 500);
      const x = p.facing > 0 ? 70 + (i * 131) % 760 : 1210 - (i * 131) % 760;
      this.speedLines.beginPath();
      this.speedLines.moveTo(x, y);
      this.speedLines.lineTo(x - p.facing * Phaser.Math.Between(60, 175), y + Phaser.Math.Between(-8, 8));
      this.speedLines.strokePath();
    }
  }

  drawHud(time) {
    if (!this.player) return;
    const p = this.player;
    const hpRatio = clamp(p.hp / p.maxHp, 0, 1);
    this.hud.clear();
    this.hud.fillStyle(0x08090d, 0.82).fillRoundedRect(24, 43, 390, 30, 8);
    this.hud.lineStyle(2, 0xe9cfac, 0.5).strokeRoundedRect(24, 43, 390, 30, 8);
    this.hud.fillStyle(RED_DARK, 1).fillRoundedRect(30, 49, 378, 18, 5);
    this.hud.fillStyle(RED, 1).fillRoundedRect(30, 49, 378 * hpRatio, 18, 5);
    this.hud.fillStyle(0xffffff, 0.34).fillRect(34, 51, Math.max(0, 370 * hpRatio), 3);

    // Pause and dialogue freeze the same clock for both HUD representations.
    const cooldownTime = this.combatPauseSnapshot?.clockTime ?? time;
    const cooldown = Math.max(0, p.skillReadyAt - cooldownTime);
    this.skillLabel.setText(cooldown > 0 ? `${this.heroData.skill} · ${Math.ceil(cooldown / 100) / 10}s` : `${this.heroData.skill} · READY`);
    window.friendFightersUI?.setSkillCooldown?.(cooldown, skillCooldownMs(this.heroData, this.carry));

    const hudBoss = this.boss?.alive ? this.boss : this.traversal?.activeMini?.enemy;
    if (hudBoss?.alive) {
      const ratio = clamp(hudBoss.hp / hudBoss.maxHp, 0, 1);
      const width = 430;
      const x = GAME_WIDTH - width - 28;
      this.hud.fillStyle(0x08090d, 0.86).fillRoundedRect(x, 43, width, 30, 8);
      this.hud.lineStyle(2, 0xe9cfac, 0.5).strokeRoundedRect(x, 43, width, 30, 8);
      this.hud.fillStyle(0x4d101c, 1).fillRoundedRect(x + 6, 49, width - 12, 18, 5);
      this.hud.fillStyle(hudBoss.type === 'd' ? 0xf03a66 : 0xd92946, 1).fillRoundedRect(x + 6, 49, (width - 12) * ratio, 18, 5);
      this.hud.fillStyle(0xffffff, 0.3).fillRect(x + 10, 51, Math.max(0, (width - 20) * ratio), 3);
      this.hud.fillStyle(WHITE, 1).fillCircle(x + 8, 28, 2);
      const name = hudBoss.miniBoss?.name || (hudBoss.type === 'c' ? '秦岭杀人兔' : '草莓熊博士 · 机甲');
      if (!this.bossNameLabel) this.bossNameLabel = this.add.text(GAME_WIDTH - 30, 18, name, { fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#fff4e5' }).setOrigin(1, 0).setScrollFactor(0).setDepth(91);
      this.bossNameLabel.setText(name).setVisible(true);
    } else this.bossNameLabel?.setVisible(false);
  }

  drawWorldHud() {
    this.worldHud.clear();
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp >= enemy.maxHp) continue;
      const width = enemy.type.startsWith('berry') ? 70 : 82;
      const x = enemy.body.x - width / 2;
      const y = enemy.body.y - enemy.height / 2 - 24;
      this.worldHud.fillStyle(0x2a0c13, 0.85).fillRoundedRect(x, y, width, 8, 3);
      this.worldHud.fillStyle(RED, 1).fillRoundedRect(x + 1, y + 1, (width - 2) * clamp(enemy.hp / enemy.maxHp, 0, 1), 6, 2);
    }
  }
}
