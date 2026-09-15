export const BERRY_CYCLE = { airMs: 10000, restMs: 4000 };
export const MECH = { summonWaves: 2, phaseRatio: 0.6, entranceMs: 1700, blastWarningMs: 1800, blastRadius: 610, blastHpRatio: 0.1 };
export function mechPhaseReady(boss) {
  return boss.alive && boss.phase === 1 && !boss.phaseTransitioning &&
    (boss.hp < boss.maxHp * MECH.phaseRatio ||
      (boss.summonWavesStarted >= MECH.summonWaves && !boss.summonPending && !boss.summonedAdds.some(enemy => enemy.alive)));
}
export function motionBlend(deltaMs, at60fps) { return 1 - Math.pow(1 - at60fps, Math.min(50, Math.max(0, deltaMs)) / (1000 / 60)); }
export const RABBIT_SMASH = { windupMs: 850, recoveryMs: 950, cooldownMs: 6000, damage: 22, range: 300, stunMs: 800, protectionMs: 1250 };
export const RABBIT_PHASE2 = { closeRange: 270, firstHitMs: 500, secondHitMs: 1320, comboRecoveryMs: 480, firstDamage: 14, secondDamage: 24, trackMs: 600, lockMs: 360, sniperDamage: 22, sniperSpeed: 1000, sniperRecoveryMs: 650 };
export function segmentDistance(point, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
}
export function skillCooldownMs(hero, carry = {}) {
  return Math.max(250, hero.skillCooldownMs - (carry.skillCooldownReductionMs || 0));
}
export function nextStageHp(hp, maxHp) { return Math.min(maxHp, hp + 30); }
