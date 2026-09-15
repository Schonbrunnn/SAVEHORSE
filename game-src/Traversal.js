import { GROUND_Y } from './gameData.js';
import { propImage } from './EnvironmentArt.js';
import { hasRouteFlags } from './RouteMaps.js';
import { worldImage, worldTexture } from './WorldArt.js';

export class Traversal {
  constructor(scene) {
    this.scene = scene;
    this.route = scene.map.route;
    this.objects = []; this.seals = []; this.elapsed = 0;
    this.flags = new Set(scene.routeRestore?.flags || []);
    this.visited = new Set();
    this.lastSafe = { x: scene.map.introX, y: GROUND_Y - 75 };
    if (scene.bossCheckpoint) {
      for (const id of this.route.preBossFlags || []) this.flags.add(id);
      for (const mini of this.route.minis) this.flags.add(mini.id);
    }
    if (scene.bossCheckpoint || scene.routeRestore?.waveComplete) this.flags.add('wave-clear');
    for (const spec of this.route.seals) this.createSeal(spec);
    // Fighting is necessary, but the approach stays free. The visible exit
    // seal prevents jumping beyond the encounter then snapping back into it.
    if (scene.map.waveZone) this.createSeal({ id: 'wave-exit', x: scene.map.waveZone.right + 64,
      requires: ['wave-clear'], name: '伏兵封锁', hint: '先清除左侧封锁区的普通敌人', flowSeal: true });
    if (scene.map.bossZone) this.createSeal({ id: 'boss-exit', x: Math.min(scene.map.width - 12, scene.map.bossZone.right + 64),
      requires: ['boss-clear'], name: '竞技场出口', hint: '击败守关者后道路才会开启', flowSeal: true });
    for (const spec of scene.map.traversal) this.create(spec);
    this.refresh();
    this.mapGraphic = scene.add.graphics().setScrollFactor(0).setDepth(89);
    this.roomLabel = scene.add.text(1260, 104, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffe5ad',
      backgroundColor: '#0b111bd9', padding: { x: 8, y: 5 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(90);
  }

  label(text, x, y) {
    return this.scene.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffe5ad',
      backgroundColor: '#111019d9', padding: { x: 9, y: 6 } }).setOrigin(0.5).setDepth(7);
  }

  solid(x, top, width, height) {
    return this.scene.solids.create(x, top + height / 2, 'pixel').setDisplaySize(width, height).setAlpha(0.001).refreshBody();
  }

  createSeal(spec) {
    const height = this.route.bottom - this.route.top;
    const body = this.solid(spec.x, this.route.top, 96, height);
    // A continuous painted gate shaft makes the full-height seal visible.
    const shaft = this.scene.add.tileSprite(spec.x, (this.route.top + this.route.bottom) / 2, 98, height, worldTexture(this.scene.map.id), 'shaft').setDepth(6);
    const frame = this.scene.textures.get(worldTexture(this.scene.map.id)).get('shaft');
    shaft.setTileScale(98 / frame.width);
    const arch = worldImage(this.scene, spec.x, GROUND_Y, 'arch', 340).setDepth(-3);
    const label = this.label(spec.name + ' · 未接通', spec.x - 170, GROUND_Y - 240);
    this.seals.push({ ...spec, body, shaft, arch, label, open: false });
  }

  create(spec) {
    const s = this.scene, o = { ...spec, active: true, y: spec.y ?? GROUND_Y };
    if (o.type === 'bridge') {
      o.body = this.solid(o.x, o.y, o.width, 20);
      Object.assign(o.body.body.checkCollision, { down: false, left: false, right: false });
      o.visual = propImage(s, o.x, o.y, 'bridge', o.width, 0).setDepth(3);
      o.visual.y -= o.visual.displayHeight * 0.75;
    } else if (o.type === 'lift') {
      o.y = o.lowY;
      o.body = this.solid(o.x, o.y, o.width, 20);
      Object.assign(o.body.body.checkCollision, { down: false, left: false, right: false });
      o.visual = propImage(s, o.x, o.y - 3, 'lift', o.width, 0).setDepth(3);
      o.visual.setCrop(0, 0, o.visual.width, Math.round(o.visual.height * 0.32));
      propImage(s, o.x, o.lowY + 10, 'lift', o.width).setDepth(1).setAlpha(0.8);
      o.label = this.label(o.name + ' · 等待接通', o.x, o.lowY + 58);
    } else if (o.type === 'lever' || o.type === 'power') {
      o.visual = propImage(s, o.x, o.y, o.type, o.type === 'power' ? 110 : 68).setDepth(5);
      o.label = this.label(o.name + ' · 攻击启动', o.x, o.y - 124);
    } else if (o.type === 'wall') {
      o.hp = 48;
      o.visual = propImage(s, o.x, o.y, 'wall', 130).setDepth(5).setDisplaySize(130, o.height);
      o.body = this.solid(o.x, o.y - o.height, 96, o.height);
      o.label = this.label(o.name + ' · 攻击击碎', o.x, o.y - 175);
    } else if (o.type === 'beacon') o.visual = propImage(s, o.x, o.y, 'beacon', 78).setDepth(2);
    this.objects.push(o);
  }

  canEnter(event) { return hasRouteFlags(this.flags, this.route.requirements[event]); }
  snapshot() { return { mapId: this.scene.map.id, flags: [...this.flags], waveComplete: this.scene.waveState.complete }; }
  activate(id) { if (!this.flags.has(id)) { this.flags.add(id); this.refresh(); } }

  refresh() {
    this.scene.worldArt?.refresh(this.flags);
    for (const gate of this.seals) {
      if (!gate.open && hasRouteFlags(this.flags, gate.requires)) {
        gate.open = true; gate.body.destroy(); gate.label.setText(gate.name + ' · 已开启');
        this.scene.tweens.add({ targets: gate.shaft, alpha: 0, duration: 600, onComplete: () => gate.shaft.destroy() });
      }
    }
    for (const o of this.objects) {
      const ready = hasRouteFlags(this.flags, o.requires);
      if (o.type === 'bridge') { o.body.body.enable = ready; o.visual.setAlpha(ready ? 1 : 0.16); }
      if (o.type === 'lift') { o.powered = ready; o.label.setText(o.name + (ready ? ' · 站上升降台' : ' · 等待机关接通')); }
      if (o.type === 'reward' && ready && !o.spawned) { o.spawned = true; this.scene.spawnHeart(o.x, o.y); }
      if (['lever', 'power', 'wall'].includes(o.type)) {
        if (this.flags.has(o.id) && o.active) {
          o.active = false;
          if (o.type === 'wall') { o.body.destroy(); o.visual.setAlpha(0.12); o.label.setText('暗道已打通'); }
          else { o.visual.setFlipX(true); o.label.setText(o.name + ' · 已启动'); }
        } else if (o.active && o.type !== 'wall') o.label.setText(o.name + (ready ? ' · 攻击启动' : ' · 先击败守卫'));
      }
    }
  }

  attack(player, range, damage) {
    let hit = false;
    for (const o of this.objects) {
      if (!o.active || !['lever', 'power', 'wall'].includes(o.type)) continue;
      const dx = o.x - player.body.x;
      if (dx * player.facing < -18 || Math.abs(dx) > range + 35 || Math.abs(player.body.y - (o.y - 65)) > 130) continue;
      if (!hasRouteFlags(this.flags, o.requires)) continue;
      hit = true;
      if (o.type === 'wall') {
        o.hp -= damage; this.scene.spawnHitParticles(o.x, player.body.y, 0xbba58a, 6);
        if (o.hp > 0) continue;
        this.scene.soundBus.play('heavyHit');
      } else this.scene.soundBus.play('pickup');
      this.activate(o.id);
      this.scene.showNotice(o.notice || '暗道已打通 · 右侧升降台接回地面', 2300);
    }
    return hit;
  }

  startMini(spec) {
    const s = this.scene;
    s.miniCheckpoint = spec.id;
    s.setArenaLock(spec.left, spec.right, spec.floorY);
    const enemy = s.spawnEnemy({ type: spec.type, x: spec.x, floorY: spec.floorY, miniBoss: spec });
    this.activeMini = { spec, enemy };
    s.showNotice(spec.name + (spec.required ? ' · 机关守卫' : ' · 可选挑战'), 2100);
    s.setObjective(spec.hint);
  }

  onMiniDefeated(enemy) {
    if (this.activeMini?.enemy !== enemy) return;
    const { spec } = this.activeMini;
    this.activeMini = null; this.scene.miniCheckpoint = null;
    this.scene.projectiles.filter(p => p.active && p.sourceEnemy === enemy).forEach(p => this.scene.destroyProjectile(p));
    this.activate(spec.id); this.scene.clearArenaLock();
    this.scene.spawnHeart(spec.x, spec.floorY - 58);
    this.scene.setObjective(spec.required ? '守卫已倒下 · 攻击房间内的机关' : '补给已解锁 · 接通下层配重后开放捷径桥');
    this.scene.showNotice(spec.name + ' 已击败', 1700);
  }

  floorBelow(x, feet) {
    const surfaces = [...this.route.floors.map(f => ({ x: (f.left + f.right) / 2, width: f.right - f.left, y: f.y })),
      ...this.scene.map.terrain.filter(t => t.type === 'platform'),
      ...this.objects.filter(o => ['bridge', 'lift'].includes(o.type) && o.body?.body?.enable !== false)];
    const ys = surfaces.filter(f => Math.abs(x - f.x) <= f.width / 2 + 12 && f.y >= feet - 25).map(f => f.y);
    return ys.length ? Math.min(...ys) : this.lastSafe.y + 75;
  }

  update(delta) {
    this.elapsed += Math.min(delta, 34);
    const s = this.scene, p = s.player;
    for (const o of this.objects) {
      if (o.type === 'lift' && o.powered !== false) {
        const feet = p.body.y + 75;
        const riding = Math.abs(p.body.x - o.x) < o.width / 2 + 15 && Math.abs(feet - o.y) < 16 && p.body.body.velocity.y >= 0;
        const phase = (this.elapsed % 9000) / 9000;
        const progress = phase < 0.16 ? 0 : phase < 0.5 ? (phase - 0.16) / 0.34 : phase < 0.66 ? 1 : 1 - (phase - 0.66) / 0.34;
        const y = o.lowY + (o.highY - o.lowY) * (0.5 - Math.cos(progress * Math.PI) / 2);
        if (riding) { p.body.body.position.y += y - o.y; p.body.body.updateCenter(); }
        o.y = y; o.body.y = y + 10; o.body.refreshBody(); o.visual.y = y - 3;
      } else if (o.type === 'beacon' && o.active && Math.abs(p.body.x - o.x) < 90 && Math.abs(p.body.y + 75 - o.y) < 90) {
        o.active = false; s.showNotice(o.text, 2500);
        if (!o.noHeal && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + 12); s.soundBus.play('pickup'); }
      }
    }
    // The small lift-only regression fixture intentionally has no map model.
    if (!this.route) return;
    const feet = p.body.y + 75;
    if ((p.body.body.blocked.down || p.body.body.touching.down) && feet < this.route.bottom - 180 && Math.abs(this.floorBelow(p.body.x, feet) - feet) < 28)
      this.lastSafe = { x: p.body.x, y: p.body.y };
    if (feet > this.route.bottom - 110) {
      p.body.body.reset(this.lastSafe.x, this.lastSafe.y); p.body.setVelocity(0, 0); p.jumpsUsed = 0;
      s.showNotice('落回安全落脚点 · 不扣血', 1200);
    }
    if (!s.activeLock && !s.bossTriggered) {
      for (const mini of this.route.minis) {
        if (this.flags.has(mini.id) || (mini.needsWave && !s.waveState.complete)) continue;
        if (p.body.x >= (mini.triggerX ?? mini.left + 40) && p.body.x < mini.right - 40 && Math.abs(feet - mini.floorY) < 28 && (p.body.body.blocked.down || p.body.body.touching.down)) {
          this.startMini(mini); break;
        }
      }
    }
    for (const gate of this.seals) {
      if (!gate.open && Math.abs(p.body.x - gate.x) < 230 && Math.abs(feet - 590) < 160 && this.elapsed > (gate.hintAt || 0)) {
        gate.hintAt = this.elapsed + 7000; s.setObjective(gate.hint);
      }
    }
    this.drawMap();
  }

  drawMap() {
    const s = this.scene, p = s.player.body;
    const current = this.route.rooms.filter(r => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    if (current) this.visited.add(current.id);
    this.roomLabel.setText(current?.name || '连接通道').setVisible(!s.activeLock);
    const g = this.mapGraphic.clear().setVisible(!s.activeLock);
    if (s.activeLock) return;
    const left = 1020, top = 139, width = 235, height = 117;
    const sx = width / s.map.width, sy = height / (this.route.bottom - this.route.top);
    const point = (x, y) => ({ x: left + x * sx, y: top + (y - this.route.top) * sy });
    g.fillStyle(0x0b111b, 0.82).fillRoundedRect(left - 6, top - 6, width + 12, height + 12, 7);
    for (const [a, b] of this.route.links) {
      const ra = this.route.rooms.find(r => r.id === a), rb = this.route.rooms.find(r => r.id === b);
      if (!this.visited.has(a) && !this.visited.has(b)) continue;
      const pa = point(ra.x + ra.width / 2, ra.y + ra.height / 2), pb = point(rb.x + rb.width / 2, rb.y + rb.height / 2);
      g.lineStyle(2, 0xb09b76, 0.65).lineBetween(pa.x, pa.y, pb.x, pb.y);
    }
    for (const r of this.route.rooms) {
      if (!this.visited.has(r.id)) continue;
      const a = point(r.x, r.y);
      g.fillStyle(r === current ? 0x886c43 : 0x34414f, 0.85).fillRect(a.x, a.y, r.width * sx, r.height * sy);
    }
    for (const o of this.objects.filter(o => o.id && ['lever', 'power'].includes(o.type))) {
      const a = point(o.x, o.y);
      g.fillStyle(this.flags.has(o.id) ? 0x8cdaaa : 0xffb855, 1).fillRect(a.x - 3, a.y - 3, 6, 6);
    }
    for (const gate of this.seals) { const a = point(gate.x, 520); g.fillStyle(gate.open ? 0x8cdaaa : 0xe43b4f, 1).fillRect(a.x - 2, a.y - 5, 4, 10); }
    const a = point(p.x, p.y);
    g.fillStyle(0xffffff, 1).fillCircle(a.x, a.y, 3.5);
  }
}
