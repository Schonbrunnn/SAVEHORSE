import sharp from 'sharp';
const slots = [
  ['shop-v1/quan-seated', '泉 · 原图提取，未重绘面部', 25, 65, 535, 400],
  ['shop-v1/hand', '肉色选择手', 1030, 70, 120, 340],
  ['berry-v1/hover', '空中巡航', 580, 80, 190, 210],
  ['berry-v1/attack', '空中攻击', 800, 80, 190, 210],
  ['berry-v1/rest', '落地休息', 655, 315, 260, 160],
  ...['heal', 'max', 'badfruit', 'hurt', 'knife'].map((id, index) => [`shop-v1/${id}`, ['回血药水', '上限提升果', '拉肚子坏果', '扣血药水', '锋利刀'][index], 38 + index * 234, 535, 170, 160]),
];
const layers = [];
for (const [id, , x, y, width, height] of slots) {
  const input = await sharp(`public/game/assets/${id}.webp`).resize({ width, height, fit: 'inside' }).toBuffer();
  const size = await sharp(input).metadata();
  layers.push({ input, left: x + Math.round((width - size.width) / 2), top: y + Math.round((height - size.height) / 2) });
}
layers.push({ input: Buffer.from(`<svg width="1200" height="750"><g font-family="sans-serif" font-size="20" fill="#e9ddc5">${slots.map(([, label, x, y]) => `<text x="${x}" y="${y - 18}">${label}</text>`).join('')}</g><text x="30" y="732" font-family="sans-serif" font-size="15" fill="#8da09b">独立透明素材预览 · 非游戏截图</text></svg>`), left: 0, top: 0 });
await sharp({ create: { width: 1200, height: 750, channels: 4, background: '#192b29' } }).composite(layers).webp({ quality: 94 }).toFile('docs/泉与草莓熊素材预览.webp');
