import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { WORLD_KITS, WORLD_FRAMES } from '../game-src/WorldArt.js';

// Reviewed source coordinates preserve the tank cap extending across its
// nominal grid cell and exclude pale panel separators. No generated retries.
const regions = {
  mountain: [[0, 385, 627, 625], [790, 317, 1090, 627], [0, 628, 627, 937], [690, 628, 1210, 938], [30, 944, 617, 1254], [642, 966, 1254, 1254]],
  mine: [[0, 393, 627, 625], [810, 320, 1080, 627], [25, 631, 620, 938], [690, 631, 1190, 938], [0, 962, 627, 1254], [637, 971, 1254, 1254]],
  reactor: [[0, 365, 626, 610], [810, 317, 1090, 626], [0, 633, 627, 933], [680, 625, 1200, 934], [135, 932, 465, 1254], [640, 980, 1254, 1254]],
};
const sourceDir = 'art-source/world-v3', outDir = 'public/game/assets/world-v3';
await mkdir(outDir, { recursive: true });
const report = [];

function cleanAlpha(data, width, height) {
  const labels = new Int32Array(width * height), groups = [];
  // Eight-neighbour components prevent a faint seam or detached noise from
  // enlarging a sprite's bounding box, without chroma-keying its colours.
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] || data[p * 4 + 3] < 32) continue;
    const id = groups.length + 1, queue = [p]; labels[p] = id;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i], x = q % width, y = Math.floor(q / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, n = ny * width + nx;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || labels[n] || data[n * 4 + 3] < 32) continue;
        labels[n] = id; queue.push(n);
      }
    }
    groups.push(queue.length);
  }
  const largest = Math.max(...groups), keep = new Set(groups.flatMap((n, i) => n >= Math.max(90, largest * 0.008) ? [i + 1] : []));
  for (let p = 0; p < labels.length; p++) if (!keep.has(labels[p])) data[p * 4 + 3] = 0;
  if (largest < 500) throw new Error('Missing painted sprite');
}

for (const kit of WORLD_KITS) {
  const input = await readFile(`${sourceDir}/${kit}.png`);
  const meta = await sharp(input).metadata(), ratio = meta.width / 1254;
  const frames = {}, tiles = [], previews = [];
  const crop = ([l, t, r, b]) => ({ left: Math.round(l * ratio), top: Math.round(t * ratio), width: Math.round((r - l) * ratio), height: Math.round((b - t) * ratio) });
  for (let i = 0; i < 8; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    let buffer;
    if (i < 2) {
      buffer = await sharp(input).extract(crop([col * 627 + 7, 4, (col + 1) * 627 - 7, 307]))
        .flatten({ background: '#111c27' }).resize(640, 320, { fit: 'cover' }).png().toBuffer();
    } else {
      const { data, info } = await sharp(input).extract(crop(regions[kit][i - 2])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      cleanAlpha(data, info.width, info.height);
      buffer = await sharp(data, { raw: info }).trim({ threshold: 2 }).resize(606, 286, { fit: 'inside' })
        .extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#00000000' }).png().toBuffer();
    }
    const size = await sharp(buffer).metadata();
    const x = col * 640 + Math.round((640 - size.width) / 2), y = row * 320 + Math.round((320 - size.height) / 2);
    tiles.push({ input: buffer, left: x, top: y });
    frames[WORLD_FRAMES[i]] = { frame: { x, y, w: size.width, h: size.height }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size.width, h: size.height }, sourceSize: { w: size.width, h: size.height } };
    previews.push({ input: buffer, left: x, top: y });
  }
  // Repeating only the column's shaft avoids stacking full caps and feet.
  const pier = frames.pier.frame;
  const atlas = await sharp({ create: { width: 1280, height: 1280, channels: 4, background: '#00000000' } }).composite(tiles).png().toBuffer();
  frames.shaft = { frame: { x: pier.x + Math.round(pier.w * 0.39), y: pier.y + Math.round(pier.h * 0.34),
    w: Math.max(12, Math.round(pier.w * 0.22)), h: Math.round(pier.h * 0.28) }, rotated: false, trimmed: false };
  await sharp(atlas).webp({ quality: 89, alphaQuality: 100 }).toFile(`${outDir}/${kit}.webp`);
  await writeFile(`${outDir}/${kit}.json`, JSON.stringify({ frames, meta: { image: `${kit}.webp`, size: { w: 1280, h: 1280 }, scale: '1' } }, null, 2) + '\n');
  await sharp(atlas).flatten({ background: '#15202b' }).resize(960, 960).png().toFile(`${outDir}/${kit}-preview.png`);
  report.push({ kit, original: { width: meta.width, height: meta.height }, frames: Object.keys(frames), runtime: `${kit}.webp` });
}
await writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log('Built 3 original biome atlases: 6 backgrounds, 18 painted props and 3 derived structural shafts.');
