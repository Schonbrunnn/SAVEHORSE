import { GROUND_Y } from './gameData.js';
import { propImage } from './EnvironmentArt.js';

// Forward-only main route with optional loops. All switches use the existing
// attack button; an ignored switch never strands a mobile player.
export class Traversal {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.elapsed = 0;
    for (const spec of scene.map.traversal || []) this.create(spec);
  }

  label(text, x, y) {
    return this.scene.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '17px', color: '#ffe5ad',
      backgroundColor: '#111019b8', padding: { x: 9, y: 6 } }).setOrigin(0.5).setDepth(7);
  }

  solid(x, top, width, height) {
    return this.scene.solids.create(x, top + height / 2, 'pixel').setDisplaySize(width, height).setAlpha(0.001).refreshBody();
  }

  create(spec) {
    const s = this.scene;
    const o = { ...spec, active: true, y: spec.y ?? GROUND_Y };
    const passed = s.bossCheckpoint && spec.x < s.map.bossZone.trigger - 120;
    if (o.type === 'bridge') {
      const deck = this.solid(o.x, o.y, o.width, 20);
      Object.assign(deck.body.checkCollision, { down: false, left: false, right: false });
      const img = propImage(s, o.x, o.y, 'bridge', o.width, 0).setDepth(3);
      img.y -= img.displayHeight * 0.75; // Rope is above the walkable deck.
      return;
    }
    if (o.type === 'reward') {
      if (!passed) s.spawnHeart(o.x, o.y);
      return;
    }
    if (o.type === 'lift') {
      o.y = o.lowY;
      o.previousY = o.y;
      o.body = this.solid(o.x, o.y, o.width, 20);
      Object.assign(o.body.body.checkCollision, { down: false, left: false, right: false });
      o.visual = propImage(s, o.x, o.y - 3, 'lift', o.width, 0).setDepth(3);
      // Separate the deck from the painted piston/base. Only the deck travels;
      // its floor-mounted mechanism stays anchored instead of flying with it.
      o.visual.setCrop(0, 0, o.visual.width, Math.round(o.visual.height * 0.32));
      propImage(s, o.x, GROUND_Y + 10, 'lift', o.width).setDepth(1).setAlpha(0.8);
      o.label = this.label('升降台 · 站上即可', o.x, o.lowY + 48);
    } else if (o.type === 'lever' || o.type === 'power') {
      o.visual = propImage(s, o.x, o.y, o.type, o.type === 'power' ? 110 : 63).setDepth(5);
      o.label = this.label('攻击机关 · 开启通路', o.x, o.y - 118);
      o.gate = propImage(s, o.gateX, GROUND_Y, 'gate', 160).setDepth(6);
      o.body = this.solid(o.gateX, GROUND_Y - 210, 90, 210);
      if (passed) { o.body.destroy(); o.gate.setAlpha(0.18); o.active = false; o.label.setText('通路已开启'); }
    } else if (o.type === 'wall') {
      o.hp = 32;
      o.visual = propImage(s, o.x, o.y, 'wall', 116).setDepth(5);
      o.body = this.solid(o.x, o.y - 170, 90, 170);
      o.label = this.label('裂纹石壁 · 可以击碎', o.x, o.y - 202);
      if (passed) { o.body.destroy(); o.visual.setAlpha(0.15); o.active = false; o.label.setAlpha(0); }
    } else if (o.type === 'beacon') {
      o.visual = propImage(s, o.x, GROUND_Y, 'beacon', 78).setDepth(2);
      o.active = !passed;
    }
    this.objects.push(o);
  }

  attack(player, range, damage) {
    let hit = false;
    for (const o of this.objects) {
      if (!o.active || !['lever', 'power', 'wall'].includes(o.type)) continue;
      const dx = o.x - player.body.x;
      if (dx * player.facing < -18 || Math.abs(dx) > range + 35 || Math.abs(player.body.y - (o.y - 45)) > 145) continue;
      hit = true;
      if (o.type === 'wall') {
        o.hp -= damage;
        this.scene.spawnHitParticles(o.x, o.y - 80, 0xbba58a, 5);
        if (o.hp > 0) continue;
        o.active = false;
        o.body.destroy();
        o.label.destroy();
        this.scene.tweens.add({ targets: o.visual, alpha: 0, y: o.y + 22, duration: 300, onComplete: () => o.visual.destroy() });
        this.scene.spawnHeart(o.x + 90, GROUND_Y - 48);
        this.scene.soundBus.play('heavyHit');
      } else {
        o.active = false;
        o.body.destroy();
        o.label.setText('通路已开启 →');
        o.visual.setFlipX(true);
        this.scene.tweens.add({ targets: o.gate, y: o.gate.y - 230, alpha: 0, duration: 650, ease: 'Cubic.In' });
        this.scene.soundBus.play('pickup');
        this.scene.showNotice('机关已启动 · 右侧通路开启', 1200);
      }
    }
    return hit;
  }

  update(delta) {
    this.elapsed += Math.min(delta, 34);
    const s = this.scene;
    const p = s.player;
    for (const o of this.objects) {
      if (o.type === 'lift') {
        const feet = p.body.y + 75;
        const riding = Math.abs(p.body.x - o.x) < o.width / 2 + 15 && Math.abs(feet - o.y) < 16 && p.body.body.velocity.y >= 0;
        // 1.2s dwell at both stops. Moving the static deck explicitly carries
        // a grounded rider, without vehicle physics or a new input binding.
        const phase = (this.elapsed % 7600) / 7600;
        const progress = phase < 0.16 ? 0 : phase < 0.5 ? (phase - 0.16) / 0.34 : phase < 0.66 ? 1 : 1 - (phase - 0.66) / 0.34;
        const y = o.lowY + (o.highY - o.lowY) * (0.5 - Math.cos(progress * Math.PI) / 2);
        if (riding) {
          // Arcade has stepped but not postUpdated. Move only its physics
          // position; postUpdate applies that delta to the sprite exactly once.
          p.body.body.position.y += y - o.y;
          p.body.body.updateCenter();
        }
        o.y = y;
        o.body.y = y + 10;
        o.body.refreshBody();
        o.visual.y = y - 3;
      } else if (o.type === 'beacon' && o.active && Math.abs(p.body.x - o.x) < 95) {
        o.active = false;
        s.showNotice(o.text, 2200);
        if (!o.noHeal && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + 12);
          s.soundBus.play('pickup');
        }
      }
    }
  }
}
