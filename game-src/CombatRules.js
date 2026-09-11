export const BERRY_CYCLE = { airMs: 10000, restMs: 4000 };
export const RABBIT_SMASH = { windupMs: 850, recoveryMs: 950, cooldownMs: 6000, damage: 22, range: 300, stunMs: 800, protectionMs: 1250 };
export function skillCooldownMs(hero, carry = {}) {
  return Math.max(250, hero.skillCooldownMs - (carry.skillCooldownReductionMs || 0));
}
export function nextStageHp(hp, maxHp) { return Math.min(maxHp, hp + 30); }
