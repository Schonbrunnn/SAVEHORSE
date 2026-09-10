const W = 1280;
const H = 720;
const GROUND = 570;
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const screens = $$('.screen');
const touchControls = $('#touch-controls');
const topActions = $('#top-actions');
const stageCard = $('#stage-card');
const isTouchDevice = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;

const imageSources = {
  a: './assets/chery-captain.png',
  b: './assets/jiaotong-knight.png',
  yue: './assets/qinling-rabbit.png',
  jue: './assets/strawberry-doctor.png',
  merchant: './assets/mystery-merchant.png',
};

const images = {};
await Promise.all(Object.entries(imageSources).map(([key, src]) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => { images[key] = img; resolve(); };
  img.onerror = resolve;
  img.src = src;
})));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const overlap = (a, b) => a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 && a.y - a.h < b.y && a.y > b.y - b.h;

class AudioBus {
  constructor() { this.context = null; }
  async unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.context ??= new AC();
    if (this.context.state === 'suspended') await this.context.resume();
    this.tone(180, .04, .025, 'sine');
  }
  tone(frequency = 220, duration = .08, volume = .04, type = 'square') {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(55, frequency * .66), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}

const audio = new AudioBus();

class InputManager {
  constructor() {
    this.held = { left: false, right: false };
    this.pressed = new Set();
    this.keyMap = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'attack', KeyK: 'skill', KeyL: 'dodge',
    };
    addEventListener('keydown', (event) => {
      if (event.code === 'Escape') { event.preventDefault(); togglePause(); return; }
      const action = this.keyMap[event.code];
      if (!action) return;
      event.preventDefault();
      if (action === 'left' || action === 'right') this.held[action] = true;
      else if (!event.repeat) this.pressed.add(action);
    }, { passive: false });
    addEventListener('keyup', (event) => {
      const action = this.keyMap[event.code];
      if (action === 'left' || action === 'right') this.held[action] = false;
    });
    this.bindTouch();
  }
  bindTouch() {
    $$('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      const release = (event) => {
        event.preventDefault();
        if (action === 'left' || action === 'right') this.held[action] = false;
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('pressed');
        if (action === 'left' || action === 'right') this.held[action] = true;
        else this.pressed.add(action);
      }, { passive: false });
      button.addEventListener('pointerup', release, { passive: false });
      button.addEventListener('pointercancel', release, { passive: false });
      button.addEventListener('lostpointercapture', release, { passive: false });
    });
  }
  take(action) { const active = this.pressed.has(action); this.pressed.delete(action); return active; }
  clearPulses() { this.pressed.clear(); }
  reset() { this.held.left = false; this.held.right = false; this.pressed.clear(); }
}

const input = new InputManager();
let nextEntityId = 1;

const stageInfo = {
  1: { kicker: 'STAGE 01 · 危险公路', title: '洞窟前线', copy: '向右推进，清除沿途伏兵' },
  2: { kicker: 'STAGE 02 · ARENA LOCKED', title: '秦岭杀人兔 · 玥', copy: '刀战结束前，谁都不能离开' },
  3: { kicker: 'FINAL STAGE · GUOXUAN CAVERN', title: '草莓熊博士 · 珏', copy: '打碎机甲，救出小马国公主' },
};

class Game {
  constructor() {
    this.mode = 'title';
    this.stage = 1;
    this.lastTime = performance.now();
    this.cameraX = 0;
    this.worldLength = 1280;
    this.player = null;
    this.boss = null;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.introTimer = 0;
    this.clearTimer = 0;
    this.paused = false;
    this.screenShake = 0;
    requestAnimationFrame((time) => this.loop(time));
  }

  makePlayer(fighter) {
    const a = fighter === 'a';
    return {
      id: nextEntityId++, fighter, name: a ? '奇瑞队长' : '上海交通骑士',
      x: 190, y: GROUND, vx: 0, vy: 0, w: a ? 104 : 132, h: a ? 205 : 190,
      maxHp: a ? 120 : 100, hp: a ? 120 : 100, speed: a ? 235 : 285,
      jump: a ? 500 : 480, facing: 1, onGround: true, invuln: 0, flash: 0,
      attackTimer: 0, attackHit: false, combo: 0, comboWindow: 0,
      dodgeTimer: 0, dodgeCooldown: 0, skillCooldown: 0, dashTimer: 0,
      attackPower: 1, coins: 0,
    };
  }

  begin(fighter) {
    this.player = this.makePlayer(fighter);
    this.mode = 'playing';
    hideScreens();
    this.setStage(1, true);
  }

  setStage(number, fresh = false) {
    this.stage = number;
    this.mode = 'playing';
    this.paused = false;
    this.cameraX = 0;
    this.projectiles = [];
    this.effects = [];
    this.enemies = [];
    this.boss = null;
    this.clearTimer = 0;
    this.screenShake = 0;
    input.reset();
    const p = this.player;
    p.x = number === 1 ? 180 : 230;
    p.y = GROUND;
    p.vx = p.vy = 0;
    p.onGround = true;
    p.invuln = 1.1;
    p.attackTimer = p.dodgeTimer = p.dashTimer = 0;
    if (!fresh) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * .35));

    if (number === 1) {
      this.worldLength = 3400;
      [700, 980, 1280, 1680, 1940, 2350, 2660, 2910].forEach((x, i) => this.enemies.push(this.makeMinion(x, i % 3)));
    } else if (number === 2) {
      this.worldLength = 1280;
      this.boss = {
        id: nextEntityId++, type: 'yue', name: '秦岭杀人兔 · 玥', x: 980, y: GROUND, vx: 0,
        w: 112, h: 250, hp: 190, maxHp: 190, phase: 1, state: 'idle', stateTimer: .7,
        action: '', attackHit: false, burstLeft: 0, burstTimer: 0, phaseTransition: 0, flash: 0,
      };
    } else {
      this.worldLength = 1280;
      this.boss = {
        id: nextEntityId++, type: 'jue', name: '草莓熊博士 · 珏', x: 1040, y: GROUND, vx: 0,
        w: 250, h: 350, hp: 300, maxHp: 300, phase: 1, state: 'idle', stateTimer: 1.4,
        action: '', warningTimer: 0, phaseTransition: 0, ultimateUsed: false,
        laserWarning: 0, laserActive: 0, laserHit: false, flash: 0,
      };
    }
    this.introTimer = 2.35;
    this.showStageCard(number);
    this.syncControls();
  }

  makeMinion(x, variant = 0, bear = false) {
    return {
      id: nextEntityId++, type: bear ? 'bear' : 'minion', x, y: GROUND, vx: 0,
      w: bear ? 72 : 62, h: bear ? 95 : 146, hp: bear ? 20 : 28,
      maxHp: bear ? 20 : 28, speed: bear ? 130 : 105 + variant * 12,
      variant, attackCd: rand(.4, 1.1), windup: 0, flash: 0, alive: true,
    };
  }

  showStageCard(number) {
    const info = stageInfo[number];
    stageCard.querySelector('small').textContent = info.kicker;
    stageCard.querySelector('h2').textContent = info.title;
    stageCard.querySelector('p').textContent = info.copy;
    stageCard.classList.remove('show');
    void stageCard.offsetWidth;
    stageCard.classList.add('show');
  }

  syncControls() {
    const visible = this.mode === 'playing' && !this.paused;
    topActions.classList.toggle('visible', visible);
    touchControls.classList.toggle('visible', visible && isTouchDevice);
  }

  loop(time) {
    const dt = Math.min(.034, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.mode === 'playing' && !this.paused) this.update(dt);
    this.render(time / 1000);
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    if (!this.player) return;
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      input.clearPulses();
      return;
    }
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      this.updateEffects(dt);
      if (this.clearTimer <= 0) this.advanceAfterClear();
      input.clearPulses();
      return;
    }
    this.updatePlayer(dt);
    if (this.stage === 1) this.updateRoad(dt);
    if (this.stage === 2) this.updateYue(dt);
    if (this.stage === 3) this.updateJue(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.screenShake = Math.max(0, this.screenShake - dt * 4);
    if (this.player.hp <= 0) this.fail();
  }

  updatePlayer(dt) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    p.skillCooldown = Math.max(0, p.skillCooldown - dt);
    p.comboWindow = Math.max(0, p.comboWindow - dt);

    if (input.take('jump') && p.onGround && p.dodgeTimer <= 0) {
      p.vy = -p.jump;
      p.onGround = false;
      audio.tone(330, .08, .025, 'triangle');
    }
    if (input.take('dodge') && p.dodgeCooldown <= 0) {
      p.dodgeTimer = .25;
      p.dodgeCooldown = 1.2;
      p.invuln = Math.max(p.invuln, .32);
      p.vx = p.facing * 720;
      this.effects.push({ kind: 'dash', x: p.x, y: p.y - 80, life: .28, max: .28, color: '#f2d08a' });
      audio.tone(190, .09, .035, 'sawtooth');
    }
    if (input.take('attack') && p.attackTimer <= 0 && p.dodgeTimer <= 0 && p.dashTimer <= 0) {
      p.combo = p.comboWindow > 0 ? (p.combo === 1 ? 2 : 1) : 1;
      p.comboWindow = .45;
      p.attackTimer = p.combo === 1 ? .31 : .36;
      p.attackHit = false;
      audio.tone(p.fighter === 'a' ? 145 : 180, .07, .04, 'square');
    }
    if (input.take('skill') && p.skillCooldown <= 0 && p.dodgeTimer <= 0) {
      if (p.fighter === 'a') {
        p.skillCooldown = 3.8;
        this.projectiles.push({ id: nextEntityId++, kind: 'shield', owner: 'player', x: p.x + p.facing * 75, y: p.y - 118, vx: p.facing * 650, vy: 0, r: 28, damage: 18 * p.attackPower, life: 1.32, outbound: true, hits: new Set() });
        audio.tone(420, .16, .04, 'triangle');
      } else {
        p.skillCooldown = 4.2;
        p.dashTimer = .36;
        p.invuln = Math.max(p.invuln, .18);
        p.vx = p.facing * 980;
        p.attackHit = false;
        this.effects.push({ kind: 'dash', x: p.x, y: p.y - 90, life: .42, max: .42, color: '#ff4857' });
        audio.tone(120, .2, .05, 'sawtooth');
      }
    }

    if (p.dodgeTimer > 0) {
      p.dodgeTimer -= dt;
    } else if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.facing * 980;
      if (!p.attackHit) this.tryPlayerHit(22 * p.attackPower, 150, true);
    } else {
      const direction = Number(input.held.right) - Number(input.held.left);
      if (direction) {
        p.facing = direction;
        p.vx = lerp(p.vx, direction * p.speed, Math.min(1, dt * 14));
      } else {
        p.vx = lerp(p.vx, 0, Math.min(1, dt * 12));
      }
    }

    if (p.attackTimer > 0) {
      p.attackTimer -= dt;
      const active = p.attackTimer < .23 && p.attackTimer > .09;
      if (active && !p.attackHit) {
        const base = p.fighter === 'a' ? (p.combo === 1 ? 10 : 12) : (p.combo === 1 ? 9 : 11);
        this.tryPlayerHit(base * p.attackPower, p.fighter === 'a' ? 135 : 155, false);
      }
    }

    p.vy += 1260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }

    const rightLimit = this.stage === 1 ? this.worldLength - 70 : (this.stage === 3 ? 920 : 1170);
    p.x = clamp(p.x, 70, rightLimit);
  }

  tryPlayerHit(damage, range, force) {
    const p = this.player;
    const targets = this.boss && this.boss.hp > 0 ? [this.boss] : this.enemies.filter((enemy) => enemy.alive);
    const target = targets.find((enemy) => Math.sign(enemy.x - p.x) === p.facing && Math.abs(enemy.x - p.x) < range + enemy.w / 2 && Math.abs(enemy.y - p.y) < 150);
    if (!target) return false;
    p.attackHit = true;
    this.hitEnemy(target, damage, force ? 85 : 34);
    this.effects.push({ kind: 'hit', x: target.x, y: target.y - target.h * .58, life: .2, max: .2, color: force ? '#ff4058' : '#ffd27b' });
    this.screenShake = force ? .22 : .08;
    audio.tone(force ? 80 : 110, .09, .055, 'square');
    return true;
  }

  hitEnemy(target, damage, knockback = 0) {
    if (!target || target.hp <= 0 || target.phaseTransition > 0) return;
    target.hp = Math.max(0, target.hp - damage);
    target.flash = .11;
    if (target.type === 'minion' || target.type === 'bear') target.x += this.player.facing * knockback;
    if (target.hp <= 0) {
      if (target.alive !== undefined) target.alive = false;
      this.player.coins += target.type === 'bear' ? 1 : 2;
      this.effects.push({ kind: 'burst', x: target.x, y: target.y - target.h / 2, life: .48, max: .48, color: '#ff6472' });
      if (target === this.boss) this.completeStage();
    }
  }

  hurtPlayer(damage, fromX) {
    const p = this.player;
    if (p.invuln > 0 || this.clearTimer > 0) return;
    p.hp = Math.max(0, p.hp - damage);
    p.invuln = .55;
    p.flash = .18;
    p.vx = (p.x < fromX ? -1 : 1) * 240;
    p.vy = -100;
    this.effects.push({ kind: 'hit', x: p.x, y: p.y - 110, life: .25, max: .25, color: '#ff3349' });
    this.screenShake = .18;
    audio.tone(72, .18, .06, 'sawtooth');
  }

  updateRoad(dt) {
    const p = this.player;
    this.enemies.forEach((enemy) => this.updateMinion(enemy, dt));
    const targetCamera = clamp(p.x - 360, 0, this.worldLength - W);
    this.cameraX = lerp(this.cameraX, targetCamera, Math.min(1, dt * 5));
    const alive = this.enemies.filter((enemy) => enemy.alive);
    if (alive.length && p.x > 3060) p.x = 3060;
    if (!alive.length && p.x > 3170) this.completeStage();
  }

  updateMinion(enemy, dt) {
    if (!enemy.alive) return;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.attackCd -= dt;
    const p = this.player;
    const distance = p.x - enemy.x;
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      if (enemy.windup <= 0 && Math.abs(p.x - enemy.x) < (enemy.type === 'bear' ? 100 : 92)) {
        this.hurtPlayer(enemy.type === 'bear' ? 7 : 6 + enemy.variant * 2, enemy.x);
        enemy.attackCd = enemy.type === 'bear' ? 1.15 : 1.3;
      }
      return;
    }
    if (Math.abs(distance) > 76) enemy.x += Math.sign(distance) * enemy.speed * dt;
    else if (enemy.attackCd <= 0) enemy.windup = .38;
  }

  updateYue(dt) {
    const b = this.boss;
    const p = this.player;
    if (!b || b.hp <= 0) return;
    b.flash = Math.max(0, b.flash - dt);
    if (b.phase === 1 && b.hp <= b.maxHp * .2) {
      b.phase = 2;
      b.phaseTransition = 1.1;
      b.state = 'phase';
      this.projectiles = this.projectiles.filter((shot) => shot.owner === 'player');
      this.showMessage('PHASE 2', '残血切枪', '所有子弹保持直线，不会追踪');
    }
    if (b.phaseTransition > 0) {
      b.phaseTransition -= dt;
      b.x = lerp(b.x, 1010, Math.min(1, dt * 3));
      return;
    }

    if (b.state === 'dash') {
      b.stateTimer -= dt;
      b.x += b.vx * dt;
      if (!b.attackHit && Math.abs(b.x - p.x) < 125) { b.attackHit = true; this.hurtPlayer(16, b.x); }
      if (b.stateTimer <= 0 || b.x < 100 || b.x > 1150) { b.state = 'recover'; b.stateTimer = .68; b.vx = 0; }
      return;
    }
    if (b.state === 'windup') {
      b.stateTimer -= dt;
      if (b.stateTimer <= 0) this.executeYueAction();
      return;
    }
    if (b.state === 'recover') {
      b.stateTimer -= dt;
      if (b.burstLeft > 0) {
        b.burstTimer -= dt;
        if (b.burstTimer <= 0) {
          this.spawnBossShot(b.x - 65, b.y - 245, -700, 0, 12, 6, '#ffd06e');
          b.burstLeft -= 1;
          b.burstTimer = .13;
        }
      }
      if (b.stateTimer <= 0 && b.burstLeft <= 0) { b.state = 'idle'; b.stateTimer = rand(.25, .55); }
      return;
    }

    b.stateTimer -= dt;
    const distance = p.x - b.x;
    if (b.phase === 1) {
      if (Math.abs(distance) > 135) b.x += Math.sign(distance) * 178 * dt;
      if (b.stateTimer <= 0) {
        b.action = Math.abs(distance) < 145 ? 'slash' : (Math.random() < .68 ? 'dash' : 'jump');
        b.state = 'windup';
        b.stateTimer = b.action === 'slash' ? .34 : .52;
        b.lockedDir = Math.sign(distance) || -1;
      }
    } else {
      if (Math.abs(distance) < 310) b.x = clamp(b.x - Math.sign(distance) * 185 * dt, 650, 1120);
      if (b.stateTimer <= 0) {
        b.action = Math.random() < .55 ? 'burst' : 'shoot';
        b.state = 'windup';
        b.stateTimer = .42;
        b.lockedDir = Math.sign(distance) || -1;
      }
    }
  }

  executeYueAction() {
    const b = this.boss;
    const p = this.player;
    if (b.action === 'slash') {
      if (Math.abs(p.x - b.x) < 165) this.hurtPlayer(12, b.x);
      this.effects.push({ kind: 'slash', x: b.x + b.lockedDir * 65, y: b.y - 130, life: .28, max: .28, color: '#ff4f80', flip: b.lockedDir });
      b.state = 'recover'; b.stateTimer = .55;
    } else if (b.action === 'dash' || b.action === 'jump') {
      b.state = 'dash'; b.stateTimer = b.action === 'jump' ? .48 : .34;
      b.vx = b.lockedDir * (b.action === 'jump' ? 590 : 780);
      b.attackHit = false;
    } else if (b.action === 'shoot') {
      this.spawnBossShot(b.x + b.lockedDir * 40, b.y - 245, b.lockedDir * 700, 0, 13, 8, '#ffd06e');
      b.state = 'recover'; b.stateTimer = .76;
    } else {
      this.spawnBossShot(b.x + b.lockedDir * 40, b.y - 245, b.lockedDir * 700, 0, 12, 6, '#ffd06e');
      b.burstLeft = 2; b.burstTimer = .13; b.state = 'recover'; b.stateTimer = .88;
    }
    audio.tone(b.phase === 1 ? 105 : 300, .11, .045, b.phase === 1 ? 'square' : 'sawtooth');
  }

  updateJue(dt) {
    const b = this.boss;
    const p = this.player;
    if (!b || b.hp <= 0) return;
    b.flash = Math.max(0, b.flash - dt);
    this.enemies.forEach((enemy) => this.updateMinion(enemy, dt));

    if (b.phase === 1 && b.hp <= b.maxHp * .5) {
      b.phase = 2;
      b.phaseTransition = 1;
      this.projectiles = this.projectiles.filter((shot) => shot.owner === 'player');
      this.showMessage('STRAWBERRY OVERDRIVE', '机甲过载', '弹幕加速，但始终保留安全空隙');
      this.screenShake = .55;
    }
    if (b.phaseTransition > 0) { b.phaseTransition -= dt; return; }

    if (b.laserWarning > 0) {
      b.laserWarning -= dt;
      if (b.laserWarning <= 0) {
        b.laserActive = .85;
        b.laserHit = false;
        this.screenShake = .6;
        audio.tone(65, .65, .07, 'sawtooth');
      }
      return;
    }
    if (b.laserActive > 0) {
      b.laserActive -= dt;
      if (!b.laserHit && p.y > 480) { b.laserHit = true; this.hurtPlayer(22, b.x); }
      return;
    }
    if (b.hp <= b.maxHp * .2 && !b.ultimateUsed) {
      b.ultimateUsed = true;
      b.laserWarning = 1.2;
      this.projectiles = this.projectiles.filter((shot) => shot.owner === 'player');
      this.showMessage('ULTIMATE WARNING', '最终草莓激光', '跳起来！');
      return;
    }

    if (b.warningTimer > 0) {
      b.warningTimer -= dt;
      if (b.warningTimer <= 0) this.executeJueAction();
      return;
    }
    b.stateTimer -= dt;
    if (b.stateTimer <= 0) {
      const roll = Math.random();
      if (b.phase === 1) b.action = roll < .36 ? 'summon' : (roll < .76 ? 'triple' : 'paw');
      else b.action = roll < .24 ? 'summon' : (roll < .58 ? 'fan' : (roll < .82 ? 'triple' : 'paw'));
      b.warningTimer = b.action === 'paw' ? .72 : .54;
      audio.tone(260, .18, .028, 'triangle');
    }
  }

  executeJueAction() {
    const b = this.boss;
    const hostileCount = this.projectiles.filter((shot) => shot.owner === 'boss').length;
    if (b.action === 'summon') {
      const livingBears = this.enemies.filter((enemy) => enemy.alive && enemy.type === 'bear').length;
      for (let i = livingBears; i < Math.min(3, livingBears + (b.phase === 1 ? 2 : 1)); i += 1) this.enemies.push(this.makeMinion(850 + i * 50, i, true));
    } else if (b.action === 'triple') {
      [350, 445, 535].forEach((y, index) => {
        if (hostileCount + index < 10) this.spawnBossShot(925, y, -430, 0, 18, 8, '#ff5ba6');
      });
    } else if (b.action === 'fan') {
      [-155, -78, 0, 78, 155].forEach((vy, index) => {
        if (hostileCount + index < 10) this.spawnBossShot(930, 410, -390, vy, 15, 6, '#ff66b3');
      });
    } else if (hostileCount < 10) {
      this.spawnBossShot(915, 435, -300, 0, 40, 18, '#ff4d90', 'paw');
    }
    b.stateTimer = b.phase === 1 ? rand(2.05, 2.65) : rand(1.6, 2.15);
    b.action = '';
  }

  spawnBossShot(x, y, vx, vy, r, damage, color, kind = 'orb') {
    if (this.projectiles.filter((shot) => shot.owner === 'boss').length >= 10) return;
    this.projectiles.push({ id: nextEntityId++, kind, owner: 'boss', x, y, vx, vy, r, damage, color, life: 4.5 });
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (const shot of this.projectiles) {
      shot.life -= dt;
      if (shot.kind === 'shield') {
        if (shot.outbound && shot.life < .68) { shot.outbound = false; }
        if (!shot.outbound) {
          const dx = p.x - shot.x;
          const dy = (p.y - 115) - shot.y;
          const length = Math.hypot(dx, dy) || 1;
          shot.vx = dx / length * 720;
          shot.vy = dy / length * 720;
          if (length < 38) shot.life = 0;
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        const targets = this.boss && this.boss.hp > 0 ? [this.boss] : this.enemies.filter((enemy) => enemy.alive);
        for (const target of targets) {
          if (shot.hits.has(target.id)) continue;
          const targetBox = { x: target.x, y: target.y, w: target.w, h: target.h };
          const shotBox = { x: shot.x, y: shot.y + shot.r, w: shot.r * 2, h: shot.r * 2 };
          if (overlap(shotBox, targetBox)) {
            shot.hits.add(target.id);
            this.hitEnemy(target, shot.damage, 30);
            this.effects.push({ kind: 'hit', x: shot.x, y: shot.y, life: .18, max: .18, color: '#7bdcff' });
          }
        }
      } else {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        const playerBox = { x: p.x, y: p.y, w: p.w, h: p.h };
        const shotBox = { x: shot.x, y: shot.y + shot.r, w: shot.r * 2, h: shot.r * 2 };
        if (overlap(shotBox, playerBox)) {
          this.hurtPlayer(shot.damage, shot.x);
          shot.life = 0;
        }
      }
    }
    this.projectiles = this.projectiles.filter((shot) => shot.life > 0 && shot.x > -120 && shot.x < this.worldLength + 160 && shot.y > -120 && shot.y < H + 160);
  }

  updateEffects(dt) {
    this.effects.forEach((effect) => { effect.life -= dt; });
    this.effects = this.effects.filter((effect) => effect.life > 0);
  }

  completeStage() {
    if (this.clearTimer > 0) return;
    this.clearTimer = 1.65;
    this.player.invuln = 5;
    this.showMessage('AREA CLEAR', this.stage === 1 ? '道路已打通' : (this.stage === 2 ? '玥已败退' : '国轩之窟解放'), this.stage === 3 ? '找到公主了' : '继续向洞窟深处推进');
    audio.tone(520, .35, .05, 'triangle');
  }

  advanceAfterClear() {
    if (this.stage === 1) this.setStage(2);
    else if (this.stage === 2) this.openShop();
    else this.win();
  }

  openShop() {
    this.mode = 'shop';
    this.syncControls();
    showScreen('shop-screen');
  }

  buy(item) {
    const p = this.player;
    if (item === 'heal') p.hp = p.maxHp;
    if (item === 'max') { p.maxHp += 25; p.hp = p.maxHp; }
    if (item === 'power') { p.attackPower *= 1.2; p.hp = Math.min(p.maxHp, p.hp + 25); }
    hideScreens();
    this.setStage(3);
  }

  showMessage(kicker, title, copy) {
    stageCard.querySelector('small').textContent = kicker;
    stageCard.querySelector('h2').textContent = title;
    stageCard.querySelector('p').textContent = copy;
    stageCard.classList.remove('show');
    void stageCard.offsetWidth;
    stageCard.classList.add('show');
  }

  fail() {
    if (this.mode !== 'playing') return;
    this.mode = 'result';
    this.syncControls();
    $('#result-kicker').textContent = 'MISSION FAILED';
    $('#result-title').textContent = '救援中断';
    $('#result-copy').textContent = '敌人守住了道路。重整装备，再试一次。';
    $('#retry-button').hidden = false;
    showScreen('result-screen');
  }

  win() {
    this.mode = 'result';
    this.syncControls();
    $('#result-kicker').textContent = 'MISSION COMPLETE';
    $('#result-title').textContent = '公主获救';
    $('#result-copy').textContent = `${this.player.name}击碎了草莓机甲，国轩之窟重新见到了光。小马国公主平安回家。`;
    $('#retry-button').hidden = true;
    showScreen('result-screen');
  }

  retry() {
    this.player.hp = this.player.maxHp;
    hideScreens();
    this.setStage(this.stage, true);
  }

  render(time) {
    ctx.save();
    if (this.screenShake > 0) ctx.translate(rand(-7, 7) * this.screenShake, rand(-5, 5) * this.screenShake);
    this.drawBackground(time);
    if (this.player) {
      this.drawWorld(time);
      if (this.mode !== 'title') this.drawHud();
    }
    ctx.restore();
  }

  drawBackground(time) {
    const gradients = [
      ['#391d25', '#12131a', '#08090d'],
      ['#4b1830', '#171019', '#08080d'],
      ['#4f1831', '#1a101b', '#06070b'],
    ][Math.max(0, this.stage - 1)];
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, gradients[0]); bg.addColorStop(.58, gradients[1]); bg.addColorStop(1, gradients[2]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const parallax = this.cameraX * .18;
    ctx.save(); ctx.translate(-parallax, 0);
    for (let i = -1; i < 12; i += 1) {
      const x = i * 330;
      ctx.fillStyle = i % 2 ? '#0d0d13aa' : '#17111aaa';
      ctx.beginPath(); ctx.moveTo(x, 420); ctx.lineTo(x + 90, 145 + (i % 3) * 45); ctx.lineTo(x + 190, 420); ctx.fill();
      ctx.fillStyle = '#f04a5720'; ctx.fillRect(x + 82, 205 + (i % 3) * 45, 13, 125);
    }
    ctx.restore();

    ctx.fillStyle = this.stage === 1 ? '#21191a' : '#1d1519';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = '#dba75a35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
    ctx.strokeStyle = '#ffffff0b'; ctx.lineWidth = 1;
    for (let y = GROUND + 28; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = -(this.cameraX % 160); x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 100, H); ctx.stroke(); }

    if (this.stage > 1) {
      ctx.fillStyle = '#f0bb5f12'; ctx.fillRect(85, 105, 10, 465); ctx.fillRect(1185, 105, 10, 465);
      ctx.strokeStyle = '#f4c66d3d'; ctx.setLineDash([9, 14]); ctx.strokeRect(94, 116, 1092, 454); ctx.setLineDash([]);
    }
    if (this.stage === 3) {
      ctx.fillStyle = '#ff4b8918';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(940 + i * 63, 150 + Math.sin(time * 2 + i) * 8, 38, 54);
    }
  }

  drawWorld(time) {
    const offset = this.cameraX;
    ctx.save(); ctx.translate(-offset, 0);
    if (this.stage === 1) this.drawRoadProps(offset);
    this.enemies.filter((enemy) => enemy.alive).forEach((enemy) => this.drawMinion(enemy, time));
    if (this.boss?.hp > 0) this.drawBoss(this.boss, time);
    this.drawPlayer(this.player, time);
    this.projectiles.forEach((shot) => this.drawProjectile(shot, time));
    this.effects.forEach((effect) => this.drawEffect(effect));
    ctx.restore();

    if (this.stage === 3 && this.boss) {
      if (this.boss.laserWarning > 0) {
        const pulse = .28 + Math.sin(time * 18) * .12;
        ctx.fillStyle = `rgba(255,70,132,${pulse})`; ctx.fillRect(0, 490, W, 82);
        ctx.fillStyle = '#ffe0ee'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('危险区域 · 立即跳跃', W / 2, 535);
      }
      if (this.boss.laserActive > 0) {
        const beam = ctx.createLinearGradient(0, 485, 0, 580);
        beam.addColorStop(0, '#ff468800'); beam.addColorStop(.25, '#ff4c9c'); beam.addColorStop(.5, '#fff'); beam.addColorStop(.75, '#ff4c9c'); beam.addColorStop(1, '#ff468800');
        ctx.fillStyle = beam; ctx.fillRect(0, 475, W, 115);
      }
    }
  }

  drawRoadProps(offset) {
    for (let x = 450; x < this.worldLength; x += 460) {
      ctx.fillStyle = '#14151b'; ctx.fillRect(x, 405, 38, 165);
      ctx.fillStyle = '#e8574650'; ctx.fillRect(x + 8, 430, 22, 8);
      ctx.fillStyle = '#e9c36d'; ctx.font = '700 17px sans-serif'; ctx.fillText(x > 2500 ? '国轩之窟 →' : '危险路段 →', x - 36, 392);
    }
    if (offset < 80) {
      ctx.fillStyle = '#f3d47d'; ctx.font = '900 22px sans-serif'; ctx.fillText('救援队出发点', 90, 495);
    }
    ctx.fillStyle = '#f2c56833'; ctx.fillRect(3260, 150, 18, 420); ctx.fillRect(3350, 150, 18, 420);
    ctx.beginPath(); ctx.arc(3314, 290, 110, Math.PI, 0); ctx.strokeStyle = '#f2c56833'; ctx.lineWidth = 18; ctx.stroke();
  }

  drawPlayer(p, time) {
    const bob = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(time * 13) * 4 : 0;
    const attackTilt = p.attackTimer > 0 ? (p.combo === 2 ? -.08 : .08) * p.facing : 0;
    ctx.save(); ctx.translate(p.x, p.y + bob); ctx.scale(p.facing, 1); ctx.rotate(attackTilt);
    if (p.flash > 0) ctx.globalAlpha = Math.floor(p.flash * 60) % 2 ? .35 : 1;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2) ctx.globalAlpha *= .55;
    if (p.fighter === 'a') {
      ctx.drawImage(images.a, 0, 0, 1536, 1024, -218, -300, 450, 300);
    } else {
      ctx.drawImage(images.b, 520, 455, 928, 631, -232, -306, 464, 316);
    }
    ctx.restore();
    if (p.attackTimer > .09 && p.attackTimer < .23) {
      ctx.save(); ctx.translate(p.x + p.facing * 108, p.y - 126); ctx.scale(p.facing, 1);
      ctx.strokeStyle = p.fighter === 'a' ? '#75d8ffcc' : '#ff647dcc'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 74, -1.1, 1.1); ctx.stroke(); ctx.restore();
    }
  }

  drawMinion(enemy, time) {
    const dir = Math.sign(this.player.x - enemy.x) || -1;
    const bob = Math.sin(time * 7 + enemy.id) * 3;
    ctx.save(); ctx.translate(enemy.x, enemy.y + bob); ctx.scale(dir, 1);
    if (enemy.flash > 0) ctx.globalAlpha = .35;
    if (enemy.type === 'bear') {
      ctx.fillStyle = '#d6366b'; ctx.fillRect(-38, -92, 76, 82);
      ctx.fillStyle = '#f2b3c4'; ctx.beginPath(); ctx.arc(-25, -84, 20, 0, Math.PI * 2); ctx.arc(25, -84, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#171018'; ctx.beginPath(); ctx.arc(-14, -58, 7, 0, Math.PI * 2); ctx.arc(14, -58, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efe0d3'; ctx.fillRect(-17, -28, 34, 8);
    } else {
      ctx.fillStyle = ['#313746','#4b3039','#2f4039'][enemy.variant]; ctx.fillRect(-30, -132, 60, 112);
      ctx.fillStyle = '#161820'; ctx.beginPath(); ctx.arc(0, -132, 29, Math.PI, 0); ctx.lineTo(29,-108); ctx.lineTo(-29,-108); ctx.fill();
      ctx.fillStyle = '#edc96f'; ctx.fillRect(4, -124, 17, 4);
      ctx.strokeStyle = '#dfe2e4'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(17,-72); ctx.lineTo(52,-30); ctx.stroke();
      ctx.fillStyle = '#15161b'; ctx.fillRect(-26,-20,19,20); ctx.fillRect(8,-20,19,20);
    }
    if (enemy.windup > 0) { ctx.strokeStyle = '#ff4c5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,-100,46,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }

  drawBoss(b, time) {
    ctx.save(); ctx.translate(b.x, b.y); const facing = Math.sign(this.player.x - b.x) || -1; ctx.scale(facing, 1);
    if (b.flash > 0) ctx.globalAlpha = Math.floor(b.flash * 80) % 2 ? .3 : 1;
    if (b.type === 'yue') {
      const gun = b.phase === 2;
      if (b.state === 'dash') ctx.rotate(facing * .1);
      if (gun) ctx.drawImage(images.yue, 720, 20, 400, 720, -128, -405, 256, 420);
      else ctx.drawImage(images.yue, 330, 15, 500, 760, -150, -420, 300, 430);
      if (b.state === 'windup') {
        ctx.strokeStyle = gun ? '#ffd273' : '#ff4a81'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -210, 72 + Math.sin(time * 18) * 8, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      ctx.scale(-facing, 1);
      const pulse = b.phase === 2 ? 1 + Math.sin(time * 11) * .018 : 1;
      ctx.scale(pulse, pulse);
      ctx.drawImage(images.jue, 0, 0, 1120, 900, -288, -448, 576, 448);
      if (b.warningTimer > 0) {
        ctx.fillStyle = '#ff548f'; ctx.shadowColor = '#ff377e'; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(-160, -265, 17 + Math.sin(time * 24) * 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawProjectile(shot, time) {
    ctx.save(); ctx.translate(shot.x, shot.y);
    if (shot.kind === 'shield') {
      ctx.rotate(time * 12); ctx.strokeStyle = '#74d8ff'; ctx.lineWidth = 9; ctx.fillStyle = '#24324f'; ctx.shadowColor = '#4fd4ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, shot.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f25a64'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, shot.r - 10, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = shot.color; ctx.shadowColor = shot.color; ctx.shadowBlur = shot.kind === 'paw' ? 30 : 18;
      ctx.beginPath(); ctx.arc(0, 0, shot.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(-shot.r*.22,-shot.r*.22,Math.max(3,shot.r*.24),0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  drawEffect(effect) {
    const progress = 1 - effect.life / effect.max;
    ctx.save(); ctx.globalAlpha = 1 - progress; ctx.translate(effect.x, effect.y);
    if (effect.kind === 'hit' || effect.kind === 'burst') {
      ctx.strokeStyle = effect.color; ctx.lineWidth = 8 * (1 - progress);
      for (let i = 0; i < 8; i += 1) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(16 + progress * 18, 0); ctx.lineTo(48 + progress * 40, 0); ctx.stroke(); }
    } else if (effect.kind === 'dash') {
      ctx.strokeStyle = effect.color; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-120 * this.player.facing, 0); ctx.lineTo(0, 0); ctx.stroke();
    } else {
      ctx.scale(effect.flip || 1, 1); ctx.strokeStyle = effect.color; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(0,0,80,-1.2,1.2); ctx.stroke();
    }
    ctx.restore();
  }

  drawHud() {
    const p = this.player;
    ctx.save();
    ctx.fillStyle = '#070910c7'; ctx.fillRect(0, 0, W, 96);
    ctx.strokeStyle = '#f1cb7840'; ctx.beginPath(); ctx.moveTo(0,96); ctx.lineTo(W,96); ctx.stroke();
    this.drawBar(56, 42, 390, 15, p.hp / p.maxHp, '#ff4052', false);
    ctx.fillStyle = '#f5ead7'; ctx.font = '800 17px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(p.name, 56, 31);
    ctx.fillStyle = '#bcae9f'; ctx.font = '700 12px sans-serif'; ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp} HP`, 56, 77);
    ctx.fillStyle = p.skillCooldown <= 0 ? '#edc66f' : '#806f58'; ctx.fillText(p.skillCooldown <= 0 ? '技能 READY' : `技能 ${p.skillCooldown.toFixed(1)}s`, 330, 77);

    ctx.textAlign = 'center'; ctx.fillStyle = '#eacb87'; ctx.font = '900 12px sans-serif'; ctx.fillText(`STAGE 0${this.stage}`, W/2, 29);
    ctx.fillStyle = '#fff0d6'; ctx.font = '900 18px sans-serif'; ctx.fillText(stageInfo[this.stage].title, W/2, 57);
    if (this.stage === 1) {
      ctx.fillStyle = '#a89b91'; ctx.font = '12px sans-serif'; ctx.fillText(`伏兵 ${this.enemies.filter((enemy)=>enemy.alive).length} · 前进 ${Math.floor(p.x / this.worldLength * 100)}%`, W/2, 79);
      this.drawBar(525, 85, 230, 3, p.x / this.worldLength, '#eac46c', false);
    }

    if (this.boss) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#f5ead7'; ctx.font = '800 17px sans-serif'; ctx.fillText(this.boss.name, 1224, 31);
      this.drawBar(834, 42, 390, 15, this.boss.hp / this.boss.maxHp, this.stage === 3 ? '#ff4a91' : '#ff7a51', true);
      ctx.fillStyle = '#bcae9f'; ctx.font = '700 12px sans-serif'; ctx.fillText(`PHASE ${this.boss.phase} · ${Math.ceil(this.boss.hp)} HP`, 1224, 77);
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#bcae9f'; ctx.font = '700 12px sans-serif'; ctx.fillText('目标：清除伏兵并抵达洞口', 1224, 53);
    }

    if (!isTouchDevice) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#d7c8b8aa'; ctx.font = '700 13px sans-serif'; ctx.fillText('A/D 移动　W 跳跃', 34, 685);
      ctx.textAlign = 'right'; ctx.fillText('J 攻击　K 技能　L 闪避', 1246, 685);
    }
    if (this.introTimer > 0) {
      ctx.fillStyle = `rgba(5,6,9,${clamp(this.introTimer - 1.4, 0, .7)})`; ctx.fillRect(0, 96, W, H - 96);
    }
    ctx.restore();
  }

  drawBar(x, y, w, h, ratio, color, reverse) {
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -.15, 1, 0, 0);
    ctx.fillStyle = '#181820'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff44'; ctx.strokeRect(0, 0, w, h);
    const fill = clamp(ratio, 0, 1) * (w - 4);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillRect(reverse ? w - 2 - fill : 2, 2, fill, h - 4); ctx.restore();
  }
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
}
function hideScreens() { screens.forEach((screen) => screen.classList.remove('active')); }
function togglePause(force) {
  if (game.mode !== 'playing') return;
  game.paused = typeof force === 'boolean' ? force : !game.paused;
  input.reset();
  if (game.paused) showScreen('pause-screen'); else hideScreens();
  game.syncControls();
}

const game = new Game();

$('#start-button').addEventListener('click', async () => { await audio.unlock(); showScreen('select-screen'); });
$$('.fighter-card').forEach((card) => card.addEventListener('click', () => game.begin(card.dataset.fighter)));
$('.back-title').addEventListener('click', () => showScreen('title-screen'));
$$('[data-item]').forEach((button) => button.addEventListener('click', () => game.buy(button.dataset.item)));
$('#pause-button').addEventListener('click', () => togglePause());
$('#resume-button').addEventListener('click', () => togglePause(false));
$('#retry-button').addEventListener('click', () => game.retry());
$('#home-button').addEventListener('click', () => {
  game.mode = 'title'; game.paused = false; game.player = null; game.syncControls(); showScreen('title-screen');
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
addEventListener('blur', () => { if (game.mode === 'playing' && !game.paused) togglePause(true); });
