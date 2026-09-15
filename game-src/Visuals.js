import Phaser from 'phaser';
import { POSE } from './gameData.js';
import { propImage } from './EnvironmentArt.js';

function applyWhiteFlash(target, enabled) {
  if (!target?.setTint) return;
  if (enabled) {
    target.setTint(0xffffff);
    target.setTintMode?.(Phaser.TintModes.FILL);
  } else {
    target.clearTint();
    target.setTintMode?.(Phaser.TintModes.MULTIPLY);
  }
}

export class ActionVisual {
  constructor(scene, x, y, texture, fallbackTexture, height = 180, frames = 8) {
    this.scene = scene;
    this.frameKeys = Array.from({ length: frames }, (_, index) => `${texture}-pose-${index}`);
    this.hasSplitFrames = this.frameKeys.every((key) => scene.textures.exists(key));
    this.textureKey = this.hasSplitFrames ? this.frameKeys[0] : (scene.textures.exists(texture) ? texture : fallbackTexture);
    this.frames = this.hasSplitFrames ? frames : (this.textureKey === texture ? frames : 1);
    this.targetHeight = height;
    this.image = scene.add.image(x, y, this.textureKey).setOrigin(0.5, 1).setDepth(12);
    const source = scene.textures.get(this.textureKey).getSourceImage();
    this.sourceWidth = source?.width || this.image.width;
    this.sourceHeight = source?.height || this.image.height;
    this.frameWidth = this.sourceWidth / this.frames;
    this.baseScale = height / this.sourceHeight;
    this.image.setScale(this.baseScale);
    this.state = '';
    this.facing = 1;
    this.hero = texture.includes('hero-b') ? 'b' : 'a';
    this.travel = 0;
    this.previousVelocity = 0;
    this.lastSyncTime = 0;
    this.transition = null;
    this.setState('idle', true);
  }

  setState(state, force = false) {
    if (!force && state === this.state) return;
    if (this.state && !force) {
      this.transition?.destroy();
      this.transition = this.scene.add.image(this.image.x, this.image.y, this.textureKey)
        .setOrigin(0.5, 1).setScale(this.image.scaleX, this.image.scaleY).setFlipX(this.image.flipX)
        .setAngle(this.image.angle).setDepth(this.image.depth).setAlpha(0.5);
      const previous = this.transition;
      this.scene.tweens.add({ targets: previous, alpha: 0, duration: state === 'hurt' ? 60 : 110,
        onComplete: () => { previous.destroy(); if (this.transition === previous) this.transition = null; } });
    }
    this.state = state;
    this.scene.tweens.killTweensOf(this.image);
    this.image.setScale(this.baseScale).setAngle(0).setAlpha(1);
    if (this.hasSplitFrames) {
      const index = Math.min(this.frames - 1, POSE[state] ?? 0);
      this.textureKey = this.frameKeys[index];
      this.image.setTexture(this.textureKey).setCrop();
      const source = this.scene.textures.get(this.textureKey).getSourceImage();
      this.sourceWidth = source.width;
      this.sourceHeight = source.height;
      this.baseScale = this.targetHeight / this.sourceHeight;
      this.image.setScale(this.baseScale);
    } else if (this.frames > 1) {
      const index = Math.min(this.frames - 1, POSE[state] ?? 0);
      this.image.setCrop(index * this.frameWidth, 0, this.frameWidth, this.sourceHeight);
    } else {
      this.image.setCrop();
    }

    if (state === 'attack') {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.12, scaleY: this.baseScale * 0.94, duration: 95, yoyo: true, ease: 'Quad.Out' });
    } else if (state === 'skill') {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.15, scaleY: this.baseScale * 1.04, duration: 130, yoyo: true, ease: 'Back.Out' });
    } else if (state === 'guard') {
      this.image.setAngle(-this.facing * 5);
    } else if (state === 'knockdown') {
      this.scene.tweens.add({ targets: this.image, angle: -this.facing * 64, duration: 140, ease: 'Quad.Out' });
    } else if (state === 'hurt') {
      this.image.setAngle(-this.facing * 10);
    } else if (state === 'dodge') {
      this.image.setAngle(this.facing * 13).setAlpha(0.82);
    }
  }

  sync(x, feetY, facing, time, velocityX = 0) {
    const dt = Math.min(34, Math.max(0, time - (this.lastSyncTime || time)));
    this.lastSyncTime = time;
    this.facing = facing || this.facing;
    this.image.setFlipX(this.facing < 0);
    const speed = Math.abs(velocityX);
    if (this.state === 'run') {
      this.travel += speed * dt / 1000;
      const stride = this.hero === 'b' ? 115 : 160;
      const frame = Math.floor((this.travel % stride) / stride * 12);
      const key = `motion-${this.hero}-${frame}`;
      if (this.scene.textures.exists(key)) {
        this.textureKey = key;
        this.image.setTexture(key).setCrop();
      }
    }
    const step = this.travel / (this.hero === 'b' ? 115 : 160) * Math.PI * 2;
    const runBob = this.state === 'run' ? -Math.abs(Math.sin(step)) * (this.hero === 'b' ? 1.25 : 3) * Math.min(1, speed / 220) : 0;
    const idleBob = this.state === 'idle' ? Math.sin(time * 0.003) * 0.8 : 0;
    this.image.setPosition(x, feetY + (this.hasSplitFrames ? 44 * this.baseScale : 0) + runBob + idleBob);
    if (this.state === 'run' || this.state === 'idle') {
      const lean = this.hero === 'b' ? Math.max(-2.8, Math.min(2.8, (velocityX - this.previousVelocity) * 0.055)) : velocityX / 220;
      this.image.setAngle(this.image.angle + (lean - this.image.angle) * 0.18);
    }
    if (this.transition?.active) this.transition.setPosition(this.image.x, this.image.y).setFlipX(this.facing < 0);
    this.previousVelocity = velocityX;
  }

  setDepth(depth) {
    this.image.setDepth(depth);
  }

  flash(duration = 85) {
    applyWhiteFlash(this.image, true);
    this.scene.time.delayedCall(duration, () => {
      if (this.image?.active) applyWhiteFlash(this.image, false);
    });
  }

  afterimage(tint = 0xf75d80) {
    const ghost = this.scene.add.image(this.image.x, this.image.y, this.textureKey)
      .setOrigin(0.5, 1)
      .setScale(this.image.scaleX, this.image.scaleY)
      .setFlipX(this.image.flipX)
      .setAngle(this.image.angle)
      .setAlpha(0.28)
      .setTint(tint)
      .setDepth(this.image.depth - 1);
    if (!this.hasSplitFrames && this.frames > 1 && this.image.isCropped) {
      const crop = this.image._crop;
      ghost.setCrop(crop.x, crop.y, crop.width, crop.height);
    }
    this.scene.tweens.add({
      targets: ghost,
      x: ghost.x - this.facing * 26,
      alpha: 0,
      duration: 210,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  destroy() {
    this.transition?.destroy();
    this.image.destroy();
  }
}

export class EnemyVisual {
  constructor(scene, x, y, type, sizeMultiplier = 1) {
    this.scene = scene;
    this.type = type;
    this.berry = type.startsWith('berry');
    this.sizeMultiplier = sizeMultiplier;
    this.state = 'idle';
    this.facing = -1;

    this.textureKey = this.berry ? 'berry-hover' : `minion-${type}-idle`;
    this.image = scene.add.image(x, y, this.textureKey).setOrigin(0.5, 1).setDepth(11);
    this.baseScale = (this.berry ? 116 : 178) * this.sizeMultiplier / this.image.height;
    this.image.setScale(this.baseScale);
    this.object = this.image;
    this.setState('idle', true);
  }

  setState(state, force = false) {
    if (!force && this.state === state) return;
    this.state = state;
    const pose = state === 'attack' ? 'attack' : state === 'run' ? 'run' : 'idle';
    this.textureKey = this.berry ? `berry-${state === 'attack' ? 'attack' : state === 'rest' ? 'rest' : 'hover'}` : `minion-${this.type}-${pose}`;
    this.image.setTexture(this.textureKey);
    if (this.berry) this.baseScale = (state === 'rest' ? 86 : 116) * this.sizeMultiplier / this.image.height;
    this.scene.tweens.killTweensOf(this.image);
    // A state change may interrupt the spawn fade before alpha reaches 1.
    this.image.setScale(this.baseScale).setAlpha(1).setAngle(state === 'hurt' ? -this.facing * 10 : 0);
    if (state === 'attack') {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.1, duration: 110, yoyo: true });
    }
  }

  sync(x, feetY, facing, time) {
    this.facing = facing || this.facing;
    this.object.setPosition(x, feetY + (this.berry ? 1 : 44 * this.baseScale) + (this.state === 'run' ? Math.sin(time * 0.025) * 3 : 0));
    this.image.setFlipX(this.facing < 0);
  }

  flash(duration = 90) {
    applyWhiteFlash(this.image, true);
    this.scene.time.delayedCall(duration, () => this.image?.active && applyWhiteFlash(this.image, false));
  }

  fadeDeath(onComplete) {
    this.scene.tweens.add({
      targets: this.object,
      y: this.object.y + 18,
      angle: -this.facing * 34,
      alpha: 0,
      duration: 330,
      ease: 'Quad.In',
      onComplete,
    });
  }

  destroy() {
    this.object.destroy();
  }
}

export class BossVisual {
  constructor(scene, type, x, feetY) {
    this.scene = scene;
    this.type = type;
    this.state = 'idle';
    this.facing = -1;
    this.frameKeys = Array.from({ length: 8 }, (_, index) => `boss-${type}-actions-pose-${index}`);
    this.hasSplitFrames = this.frameKeys.every((key) => scene.textures.exists(key));
    this.textureKey = this.hasSplitFrames ? this.frameKeys[0] : (type === 'c' ? 'boss-c' : 'boss-d');
    this.image = scene.add.image(x, feetY, this.textureKey).setOrigin(0.5, 1).setDepth(10);
    if (type === 'c') {
      this.crops = {
        idle: [0, 0, 405, 770],
        run: [340, 0, 430, 770],
        attack: [340, 0, 470, 770],
        gun: [720, 0, 425, 760],
        hurt: [1080, 365, 235, 250],
      };
      this.targetHeight = 230;
      this.baseScale = this.hasSplitFrames ? this.targetHeight / this.image.height : 0.29;
      this.stateFrames = { idle: 0, run: 1, jump: 2, attack: 3, skill: 4, gun: 5, 'gun-run': 5, 'gun-jump': 5, 'gun-hurt': 5, 'gun-strike': 5, fire: 6, hurt: 7 };
    } else {
      this.crops = { idle: [0, 0, 1110, 855], attack: [900, 210, 630, 520], hurt: [0, 0, 1110, 855] };
      // The final mech is a fixed arena boss: its visible silhouette should
      // occupy roughly 1/2–2/3 of the 720px playfield, not read like a minion.
      this.targetHeight = 600;
      this.baseScale = this.hasSplitFrames ? this.targetHeight / this.image.height : 0.51;
      this.stateFrames = { idle: 0, charge: 1, attack: 1, summon: 2, lanes: 3, fan: 4, laser: 5, overload: 6, hurt: 7 };
    }
    this.setState('idle', true);
  }

  setState(state, force = false) {
    if (!force && state === this.state) return;
    this.state = state;
    if (this.hasSplitFrames) {
      const index = this.stateFrames[state] ?? 0;
      this.textureKey = this.frameKeys[index];
      this.image.setTexture(this.textureKey).setCrop();
      this.baseScale = this.targetHeight / this.image.height;
    } else {
      const crop = this.crops[state] || this.crops.idle;
      this.image.setCrop(...crop);
    }
    this.image.setScale(this.baseScale).setAngle(state.endsWith('hurt') ? 7 : 0);
    this.scene.tweens.killTweensOf(this.image);
    if (state === 'gun-strike') {
      this.image.setAngle(-this.facing * 12);
      this.scene.tweens.add({ targets: this.image, angle: this.facing * 14, scaleX: this.baseScale * 1.07, duration: 110, yoyo: true });
    }
    if (['attack', 'gun', 'fire', 'charge', 'summon', 'lanes', 'fan', 'laser', 'overload'].includes(state)) {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.035, scaleY: this.baseScale * 0.985, duration: 135, yoyo: true });
    }
  }

  sync(x, feetY, facing, time) {
    this.facing = facing || this.facing;
    this.image.setFlipX(this.type === 'c' && this.facing < 0);
    const bob = this.state === 'gun-run' ? Math.sin(time * 0.024) * 3 : Math.sin(time * 0.003) * (this.type === 'd' ? 2 : 1.5);
    this.image.setPosition(x + (this.motion?.x || 0), feetY + (this.hasSplitFrames ? 44 * this.baseScale : 0) + bob + (this.motion?.y || 0));
    if (this.motion) this.image.setAngle(this.motion.angle);
  }

  flash(duration = 100) {
    applyWhiteFlash(this.image, true);
    this.scene.time.delayedCall(duration, () => this.image?.active && applyWhiteFlash(this.image, false));
  }

  destroy() {
    this.image.destroy();
  }
}

export function drawBones(scene, x, y, strawberry = false) {
  const c = scene.add.container(x, y).setDepth(4).setAlpha(0);
  const remains = propImage(scene, 0, 2, 'bones', strawberry ? 84 : 108);
  remains.setFlipX(Math.round(x) % 2 === 0);
  c.add(remains);
  // No physics body: remains are scenery, never obstacles to the next wave.
  scene.tweens.add({ targets: c, alpha: 0.94, duration: 240 });
  return c;
}

export function createCrateVisual(scene, x, feetY) {
  const c = scene.add.container(x, feetY).setDepth(5);
  c.add(propImage(scene, 0, 1, 'crate', 74).setDisplaySize(74, 70));
  return c;
}

export function createPlatformVisual(scene, x, y, width, stage) {
  const c = scene.add.container(x, y).setDepth(3);
  // The artwork begins at the collision surface (spec.y - 1); all rock/beam
  // depth extends downward so characters don't appear to hover above it.
  for (let left = -width / 2; left < width / 2; left += 280) {
    const span = Math.min(280, width / 2 - left);
    c.add(propImage(scene, left + span / 2, -2, stage === 3 ? 'metal' : 'ledge', span + 2, 0));
  }
  return c;
}

export function createCabin(scene, x, groundY) {
  const c = scene.add.container(x, groundY).setDepth(2);
  c.add(propImage(scene, 0, 2, 'cabin', 1110));
  return c;
}
