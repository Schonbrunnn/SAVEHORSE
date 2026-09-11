import Phaser from 'phaser';
import { POSE } from './gameData.js';

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
    this.setState('idle', true);
  }

  setState(state, force = false) {
    if (!force && state === this.state) return;
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
    } else if (state === 'hurt') {
      this.image.setAngle(-this.facing * 10);
    } else if (state === 'dodge') {
      this.image.setAngle(this.facing * 13).setAlpha(0.82);
    }
  }

  sync(x, feetY, facing, time, velocityX = 0) {
    this.facing = facing || this.facing;
    this.image.setFlipX(this.facing < 0);
    const runBob = this.state === 'run' ? Math.sin(time * 0.027) * 4 : 0;
    const idleBob = this.state === 'idle' ? Math.sin(time * 0.004) * 2.2 : 0;
    this.image.setPosition(x, feetY + (this.hasSplitFrames ? 44 * this.baseScale : 0) + runBob + idleBob);
    if (this.state === 'run') this.image.setAngle(Math.sin(time * 0.027) * 2.2 + Math.sign(velocityX) * 1.2);
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
    this.image.destroy();
  }
}

export class EnemyVisual {
  constructor(scene, x, y, type) {
    this.scene = scene;
    this.type = type;
    this.vector = type.startsWith('berry');
    this.state = 'idle';
    this.facing = -1;

    if (this.vector) {
      this.object = createBerryBear(scene, x, y, type === 'berryFlying');
      this.image = null;
      return;
    }

    this.textureKey = `minion-${type}-idle`;
    this.image = scene.add.image(x, y, this.textureKey).setOrigin(0.5, 1).setDepth(11);
    this.baseScale = 178 / this.image.height;
    this.image.setScale(this.baseScale);
    this.object = this.image;
    this.setState('idle', true);
  }

  setState(state, force = false) {
    if (!force && this.state === state) return;
    this.state = state;
    if (this.vector) {
      this.object.setScale(state === 'attack' ? 1.08 : 1);
      this.object.setAngle(state === 'hurt' ? -this.facing * 12 : 0);
      return;
    }
    const pose = state === 'attack' ? 'attack' : state === 'run' ? 'run' : 'idle';
    this.textureKey = `minion-${this.type}-${pose}`;
    this.image.setTexture(this.textureKey);
    this.scene.tweens.killTweensOf(this.image);
    // A state change may interrupt the spawn fade before alpha reaches 1.
    this.image.setScale(this.baseScale).setAlpha(1).setAngle(state === 'hurt' ? -this.facing * 10 : 0);
    if (state === 'attack') {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.1, duration: 110, yoyo: true });
    }
  }

  sync(x, feetY, facing, time) {
    this.facing = facing || this.facing;
    this.object.setPosition(x, feetY + (this.image ? 44 * this.baseScale : 0) + (this.state === 'run' ? Math.sin(time * 0.025) * 3 : 0));
    if (this.image) this.image.setFlipX(this.facing < 0);
    else this.object.setScale(Math.abs(this.object.scaleX) * (this.facing > 0 ? -1 : 1), Math.abs(this.object.scaleY));
  }

  flash(duration = 90) {
    if (this.image) {
      applyWhiteFlash(this.image, true);
      this.scene.time.delayedCall(duration, () => this.image?.active && applyWhiteFlash(this.image, false));
    } else {
      this.object.list.forEach((child) => child.setFillStyle?.(0xffffff));
      this.scene.time.delayedCall(duration, () => {
        if (!this.object?.active) return;
        const [body, belly, earA, earB] = this.object.list;
        body?.setFillStyle?.(0xe83d70);
        belly?.setFillStyle?.(0xffd7d3);
        earA?.setFillStyle?.(0xf05b83);
        earB?.setFillStyle?.(0xf05b83);
      });
    }
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

function createBerryBear(scene, x, y, flying) {
  const container = scene.add.container(x, y).setDepth(11);
  const body = scene.add.circle(0, -54, 44, 0xe83d70).setStrokeStyle(5, 0x68233d);
  const belly = scene.add.ellipse(0, -43, 42, 35, 0xffd7d3);
  const earA = scene.add.circle(-27, -91, 17, 0xf05b83).setStrokeStyle(5, 0x68233d);
  const earB = scene.add.circle(27, -91, 17, 0xf05b83).setStrokeStyle(5, 0x68233d);
  const eyeA = scene.add.circle(-15, -64, 5, 0xffdf52);
  const eyeB = scene.add.circle(15, -64, 5, 0xffdf52);
  const nose = scene.add.circle(0, -51, 6, 0x72243f);
  const leaf = scene.add.triangle(0, -22, -11, 0, 0, -14, 11, 0, 0x55b860);
  const pack = flying ? scene.add.rectangle(0, -103, 34, 18, 0x3b3544).setStrokeStyle(3, 0xffb250) : null;
  const flameA = flying ? scene.add.triangle(-12, -111, -8, 0, 0, -23, 8, 0, 0xff774e) : null;
  const flameB = flying ? scene.add.triangle(12, -111, -8, 0, 0, -23, 8, 0, 0xffc85c) : null;
  container.add([body, belly, earA, earB, eyeA, eyeB, nose, leaf, pack, flameA, flameB].filter(Boolean));
  return container;
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
      this.stateFrames = { idle: 0, run: 1, jump: 2, attack: 3, skill: 4, gun: 5, 'gun-run': 5, 'gun-jump': 5, 'gun-hurt': 5, fire: 6, hurt: 7 };
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
    if (['attack', 'gun', 'fire', 'charge', 'summon', 'lanes', 'fan', 'laser', 'overload'].includes(state)) {
      this.scene.tweens.add({ targets: this.image, scaleX: this.baseScale * 1.035, scaleY: this.baseScale * 0.985, duration: 135, yoyo: true });
    }
  }

  sync(x, feetY, facing, time) {
    this.facing = facing || this.facing;
    this.image.setFlipX(this.type === 'c' && this.facing < 0);
    const bob = this.state === 'gun-run' ? Math.sin(time * 0.024) * 3 : Math.sin(time * 0.003) * (this.type === 'd' ? 2 : 1.5);
    this.image.setPosition(x, feetY + (this.hasSplitFrames ? 44 * this.baseScale : 0) + bob);
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
  const color = strawberry ? 0xffd9d9 : 0xe9e1cf;
  const skull = scene.add.circle(0, -12, 16, color).setStrokeStyle(3, 0x857f75);
  const eyeA = scene.add.circle(-6, -14, 3, 0x34313a);
  const eyeB = scene.add.circle(6, -14, 3, 0x34313a);
  const boneA = scene.add.rectangle(-21, 4, 38, 7, color).setAngle(28);
  const boneB = scene.add.rectangle(21, 4, 38, 7, color).setAngle(-28);
  c.add([boneA, boneB, skull, eyeA, eyeB]);
  scene.tweens.add({ targets: c, alpha: 0.72, duration: 220 });
  return c;
}

export function createCrateVisual(scene, x, feetY) {
  const c = scene.add.container(x, feetY).setDepth(5);
  const box = scene.add.rectangle(0, -34, 72, 68, 0x70452b).setStrokeStyle(5, 0xc59352);
  const slatA = scene.add.rectangle(0, -34, 8, 66, 0x3e291e).setAngle(45);
  const slatB = scene.add.rectangle(0, -34, 8, 66, 0x3e291e).setAngle(-45);
  const badge = scene.add.circle(0, -34, 11, 0xb22e3f).setStrokeStyle(2, 0xf0c66b);
  c.add([box, slatA, slatB, badge]);
  return c;
}

export function createPlatformVisual(scene, x, y, width, stage) {
  const c = scene.add.container(x, y).setDepth(3);
  const main = scene.add.rectangle(0, 0, width, 24, stage === 3 ? 0x452e4d : 0x4c4541)
    .setStrokeStyle(3, stage === 3 ? 0xff6e9c : 0xa99371);
  const underside = scene.add.rectangle(0, 15, width * 0.9, 14, 0x19171c).setAlpha(0.85);
  c.add([underside, main]);
  for (let xPos = -width / 2 + 36; xPos < width / 2; xPos += 72) {
    c.add(scene.add.circle(xPos, 0, 4, stage === 3 ? 0xffcc66 : 0xcbb57e));
  }
  return c;
}

export function createCabin(scene, x, groundY) {
  const c = scene.add.container(x, groundY).setDepth(2);
  const wall = scene.add.rectangle(0, -150, 650, 300, 0x2b1c1a).setStrokeStyle(7, 0x8b5832);
  const roof = scene.add.triangle(0, -365, -370, 0, 0, -160, 370, 0, 0x311819).setStrokeStyle(7, 0xb1663d);
  const doorA = scene.add.rectangle(-255, -84, 92, 168, 0x161117).setStrokeStyle(5, 0xe0ad67);
  const doorB = scene.add.rectangle(255, -84, 92, 168, 0x161117).setStrokeStyle(5, 0xe0ad67);
  const lamp = scene.add.circle(0, -220, 18, 0xffbd57).setStrokeStyle(5, 0x5e3523);
  const sign = scene.add.text(0, -275, '泉 · 小木屋', { fontFamily: 'serif', fontSize: '28px', color: '#ffe0a0', fontStyle: 'bold' }).setOrigin(0.5);
  const mist = scene.add.ellipse(0, -25, 560, 72, 0xb5685d, 0.12);
  c.add([mist, wall, roof, doorA, doorB, lamp, sign]);
  scene.tweens.add({ targets: lamp, alpha: 0.48, duration: 780, yoyo: true, repeat: -1 });
  return c;
}
