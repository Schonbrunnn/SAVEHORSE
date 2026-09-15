// Dedicated original guardian sheets. Never fall back to regular minion art.
export const GUARDIAN_ART = {
  'mini-shield': { file: 'guardian-shield-v2.webp', height: 260, bodyWidth: 78 },
  'mini-quarry': { file: 'guardian-quarry-v2.webp', height: 276, bodyWidth: 82 },
  'mini-core': { file: 'guardian-core-v2.webp', height: 208, bodyWidth: 90 },
};
export const GUARDIAN_FRAME_SIZE = 512;
const FOOT = 460 / GUARDIAN_FRAME_SIZE;
const clamp01 = value => Math.max(0, Math.min(1, value));

// Select poses from the very same deadlines used by combat, including pause
// compensation. The strike is never shown during the warning period.
export function guardianPose(enemy, time, travel = 0) {
  if (!enemy.alive) return { frame: 11, phase: 'dead', progress: 1 };
  if (time < enemy.hurtUntil) return { frame: 9, phase: 'hurt', progress: 0 };
  if (enemy.cyclePhase === 'landing' || enemy.cyclePhase === 'rest') return { frame: 10, phase: enemy.cyclePhase, progress: 0 };
  if (enemy.state === 'windup' && enemy.miniMove) {
    const move = enemy.miniMove, heavy = enemy.attackVariant === 1;
    if (time < enemy.hitAt) return { frame: heavy ? 6 : 3, phase: 'windup', progress: clamp01(1 - (enemy.hitAt - time) / move.warning) };
    if (time < enemy.hitAt + (move.activeMs || 130)) return { frame: heavy ? 7 : 4, phase: 'strike', progress: clamp01((time - enemy.hitAt) / (move.activeMs || 130)) };
    return { frame: heavy ? 8 : 5, phase: 'recovery', progress: clamp01((time - enemy.hitAt - (move.activeMs || 130)) / (move.recoveryMs || 440)) };
  }
  if (enemy.state === 'run' || Math.abs(enemy.body.body.velocity.x) > 18) {
    return { frame: [1, 0, 2, 0][Math.floor(travel / 28) % 4], phase: 'run', progress: 0 };
  }
  return { frame: 0, phase: 'idle', progress: 0 };
}

export class GuardianVisual {
  constructor(scene, x, feetY, id) {
    this.scene = scene; this.id = id; this.config = GUARDIAN_ART[id];
    this.texture = `guardian-${id}`;
    this.baseScale = this.config.height / 440;
    this.image = scene.add.image(x, feetY, this.texture, 0).setOrigin(0.5, FOOT).setScale(this.baseScale).setDepth(11);
    this.ghost = scene.add.image(x, feetY, this.texture, 0).setOrigin(0.5, FOOT).setScale(this.baseScale).setDepth(10.9).setVisible(false);
    this.object = this.image;
    this.state = 'idle'; this.frame = 0; this.facing = 1;
    this.travel = 0; this.motionTime = 0; this.lastTime = null; this.blendAt = -1000;
    this.lean = 0; this.previousVelocity = 0; this.dying = false;
  }

  // Compatibility with the shared AI; the final pose is selected by sync from
  // combat state, not a second independent animation timer.
  setState(state) { this.state = state; if (state === 'hurt') this.showFrame(9, 'hurt'); }

  showFrame(frame, phase) {
    if (frame === this.frame) return;
    const blend = !['strike', 'hurt', 'dead'].includes(phase);
    this.ghost.setFrame(this.frame).setVisible(blend);
    this.blendAt = blend ? this.motionTime : -1000;
    this.frame = frame; this.image.setFrame(frame);
  }

  sync(x, feetY, facing, time, enemy) {
    if (this.dying || !enemy) return;
    const dt = this.lastTime === null ? 0 : Math.min(34, Math.max(0, time - this.lastTime));
    this.lastTime = time; this.motionTime += dt;
    this.facing = facing || this.facing;
    const velocity = enemy.body.body.velocity.x;
    this.travel += Math.abs(velocity) * dt / 1000;
    const pose = guardianPose(enemy, time, this.travel);
    this.showFrame(pose.frame, pose.phase);
    let offsetX = 0, offsetY = 0, angle = 0;
    if (pose.phase === 'windup') {
      // Compress into a planted stance; the weapon itself is in its own pose.
      offsetX = -this.facing * 5 * pose.progress;
      offsetY = 3 * pose.progress;
      angle = -this.facing * pose.progress;
    } else if (pose.phase === 'strike') {
      offsetX = this.facing * 9 * Math.sin(Math.PI * pose.progress);
    } else if (pose.phase === 'run') {
      offsetY = -Math.abs(Math.sin(this.travel / 18)) * 2;
      const desiredLean = Math.max(-2, Math.min(2, velocity / 120 + (velocity - this.previousVelocity) / 80));
      this.lean += (desiredLean - this.lean) * 0.2;
      angle = this.lean;
    } else if (pose.phase === 'idle') offsetY = Math.sin(this.motionTime / 350) * 0.8;
    this.previousVelocity = velocity;
    this.image.setPosition(x + offsetX, feetY + offsetY).setFlipX(this.facing < 0).setAngle(angle);
    const blend = Math.max(0, 1 - (this.motionTime - this.blendAt) / 75);
    this.ghost.setPosition(this.image.x, this.image.y).setFlipX(this.image.flipX).setAngle(angle).setAlpha(blend * 0.3).setVisible(blend > 0);
  }

  flash(duration = 90) {
    this.image.setTint(0xffffff);
    this.image.setTintMode?.(1); // Phaser 4 TintModes.FILL; preserve texture alpha.
    this.scene.time.delayedCall(duration, () => {
      if (this.image.active) { this.image.clearTint(); this.image.setTintMode?.(0); }
    });
  }

  fadeDeath(onComplete, groundY = this.image.y) {
    this.dying = true; this.ghost.setVisible(false);
    this.scene.tweens.killTweensOf(this.image);
    this.image.clearTint().setFrame(10).setAngle(0);
    this.scene.tweens.add({ targets: this.image, y: groundY, duration: 210, ease: 'Quad.In', onComplete: () => {
      this.image.setFrame(11);
      this.scene.tweens.add({ targets: this.image, alpha: 0, delay: 170, duration: 260, onComplete });
    } });
  }

  destroy() { this.ghost.destroy(); this.image.destroy(); }
}

export function guardianRemains(scene, id, x, y, facing) {
  return scene.add.image(x, y, `guardian-${id}`, 11).setOrigin(0.5, FOOT)
    .setScale(GUARDIAN_ART[id].height / 440).setFlipX(facing < 0).setDepth(3).setAlpha(0.72);
}
