/** Visual only: skill availability remains owned by the shared combat logic. */
export function renderSkillCooldown(button, remainingMs, totalMs) {
  if (!button) return;
  const remaining = Math.max(0, remainingMs);
  const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, totalMs)));
  button.style.setProperty('--skill-gray', (1 - progress).toFixed(3));
  button.style.setProperty('--skill-brightness', (0.6 + progress * 0.4).toFixed(3));
  button.style.setProperty('--skill-angle', `${(progress * 360).toFixed(1)}deg`);
  const cooling = remaining > 0;
  button.classList.toggle('cooling-down', cooling);
  button.setAttribute('aria-disabled', String(cooling));
  const label = cooling ? `技能冷却中，剩余 ${(Math.ceil(remaining / 100) / 10).toFixed(1)} 秒` : '技能已就绪';
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
}
