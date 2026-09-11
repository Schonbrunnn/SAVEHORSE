import sharp from 'sharp';
import { ENVIRONMENT_ART } from '../game-src/EnvironmentArt.js';
const slots = [
  ['bones', '白骨堆', 30, 75, 350, 220],
  ['crate', '可破坏木箱', 425, 75, 350, 220],
  ['boulder', '落石', 820, 75, 350, 220],
  ['stone', '山道 · 岩石平台', 30, 395, 530, 100],
  ['metal', '基地 · 金属平台', 30, 580, 530, 95],
  ['cabin', '商人木屋', 610, 415, 555, 275],
];
const layers = [];
for (const [id, , x, y, width, height] of slots) {
  const buffer = await sharp(`public/game/assets/props/${ENVIRONMENT_ART[id]}`)
    .resize({ width, height, fit: 'inside' }).toBuffer();
  const size = await sharp(buffer).metadata();
  layers.push({ input: buffer, left: x + Math.round((width - size.width) / 2), top: y + Math.round((height - size.height) / 2) });
}
const labels = slots.map(([, label, x, y]) => `<text x="${x}" y="${y - 15}">${label}</text>`).join('');
layers.push({ input: Buffer.from(`<svg width="1200" height="750"><g fill="#d6dce5" font-family="sans-serif" font-size="23">${labels}</g><text x="30" y="731" fill="#929bad" font-family="sans-serif" font-size="16">独立透明素材预览 · 非游戏截图</text></svg>`), left: 0, top: 0 });
await sharp({ create: { width: 1200, height: 750, channels: 4, background: '#161e2a' } })
  .composite(layers).webp({ quality: 92 }).toFile('docs/场景组件素材预览.webp');
console.log('docs/场景组件素材预览.webp');
