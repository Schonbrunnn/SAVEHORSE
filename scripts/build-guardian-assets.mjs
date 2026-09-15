import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ids = ['shield', 'quarry', 'core'];
const out = 'public/game/assets/props';
await mkdir(out, { recursive: true });
const report = { frameSize: 512, footY: 460, extraction: 'connected alpha components, not equal-cell crops', assets: [] };

// A wide swing may cross a nominal atlas column. Label the actual transparent
// silhouettes first, then pack each WHOLE character into a padded frame.
function separate(data, width, height) {
  const count = width * height, labels = new Int32Array(count), queue = new Int32Array(count), components = [];
  let id = 0;
  for (let start = 0; start < count; start++) {
    if (labels[start] || data[start * 4 + 3] <= 8) continue;
    id++;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = start; labels[start] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!labels[next] && data[next * 4 + 3] > 8) { labels[next] = id; queue[tail++] = next; }
      }
    }
    components.push({ id, pixels: tail, left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 });
  }
  const largest = [...components].sort((a, b) => b.pixels - a.pixels).slice(0, 12);
  if (largest.length !== 12 || largest.some(c => c.pixels < 4000)) throw new Error('Expected twelve separate full character silhouettes; inspect source before extracting.');
  const sorted = [];
  const vertical = largest.sort((a, b) => a.cy - b.cy);
  for (let row = 0; row < 3; row++) sorted.push(...vertical.slice(row * 4, row * 4 + 4).sort((a, b) => a.cx - b.cx));
  const owners = new Map(sorted.map((c, frame) => [c.id, frame]));
  const nearest = (x, y) => {
    let chosen = 0, score = Infinity;
    sorted.forEach((c, frame) => {
      const dx = Math.max(c.left - x, x - c.right, 0), dy = Math.max(c.top - y, y - c.bottom, 0);
      const value = dx * dx + dy * dy + 0.0001 * ((x - c.cx) ** 2 + (y - c.cy) ** 2);
      if (value < score) { score = value; chosen = frame; }
    });
    return chosen;
  };
  for (const c of components) if (!owners.has(c.id)) {
    const frame = nearest(c.cx, c.cy), main = sorted[frame];
    const gapX = Math.max(main.left - c.right, c.left - main.right, 0), gapY = Math.max(main.top - c.bottom, c.top - main.bottom, 0);
    // Keep adjacent detached edge details; discard isolated generated specks
    // which otherwise move the apparent foot anchor dozens of pixels.
    if (Math.hypot(gapX, gapY) <= 5) owners.set(c.id, frame);
  }
  const masks = sorted.map(() => Buffer.alloc(count * 4));
  const bounds = sorted.map(() => ({ left: width, top: height, right: 0, bottom: 0, pixels: 0 }));
  for (let p = 0; p < count; p++) {
    if (data[p * 4 + 3] <= 8 || !owners.has(labels[p])) continue;
    const x = p % width, y = Math.floor(p / width);
    const frame = owners.get(labels[p]);
    data.copy(masks[frame], p * 4, p * 4, p * 4 + 4);
    const b = bounds[frame]; b.left = Math.min(b.left, x); b.right = Math.max(b.right, x); b.top = Math.min(b.top, y); b.bottom = Math.max(b.bottom, y); b.pixels++;
  }
  return { masks, bounds, main: sorted };
}

for (const id of ids) {
  const input = `art-source/guardian-${id}-v2.png`;
  const metadata = await sharp(input).metadata();
  if (!metadata.hasAlpha) throw new Error(`${input} must have genuine alpha`);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { masks, bounds, main } = separate(data, info.width, info.height);
  // Fixed scale for the entire character, including overhead weapons. No
  // per-pose resizing, no stretched body, and at least 30px frame safety margin.
  const scale = Math.min(...bounds.flatMap(b => [440 / (b.right - b.left + 1), 424 / (b.bottom - b.top + 1)]));
  const composites = [], frames = [];
  for (let frame = 0; frame < 12; frame++) {
    const b = bounds[frame], crop = { left: b.left, top: b.top, width: b.right - b.left + 1, height: b.bottom - b.top + 1 };
    const width = Math.max(1, Math.round(crop.width * scale)), height = Math.max(1, Math.round(crop.height * scale));
    // Use the lower-body footprint for ground pivots, not the swinging weapon.
    // Core hovering poses use the central reactor instead of a changing nozzle.
    let mass = 0, weightedX = 0;
    for (let y = Math.max(b.top, b.bottom - Math.round(crop.height * 0.12)); y <= b.bottom; y++) for (let x = b.left; x <= b.right; x++) {
      const a = masks[frame][(y * info.width + x) * 4 + 3];
      if (a > 64) { weightedX += x * a; mass += a; }
    }
    const anchor = id === 'core' || frame === 11 ? main[frame].cx : mass ? weightedX / mass : main[frame].cx;
    const left = Math.max(30, Math.min(482 - width, Math.round(256 - (anchor - b.left) * scale)));
    const top = 460 - height;
    const cut = await sharp(masks[frame], { raw: { width: info.width, height: info.height, channels: 4 } }).extract(crop).resize(width, height).png().toBuffer();
    const padded = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } }).composite([{ input: cut, left, top }]).png().toBuffer();
    composites.push({ input: padded, left: (frame % 4) * 512, top: Math.floor(frame / 4) * 512 });
    if (frame === 0) await sharp(padded).flatten({ background: '#17232b' }).png().toFile(`${out}/guardian-${id}-v2-preview.png`);
    frames.push({ frame, sourceBounds: crop, mainPixels: main[frame].pixels, width, height, left, top, bottom: 460 });
  }
  await sharp({ create: { width: 2048, height: 1536, channels: 4, background: '#00000000' } }).composite(composites)
    .webp({ quality: 92, alphaQuality: 100 }).toFile(`${out}/guardian-${id}-v2.webp`);
  if (id === 'core') {
    // Derive its projectile from its OWN generated cyan muzzle flash, not the
    // regular teddy-bear projectile. This is alpha extraction, not new artwork.
    const b = bounds[4], glow = Buffer.alloc(masks[4].length);
    for (let y = Math.round((b.top + b.bottom) / 2); y <= b.bottom; y++) for (let x = Math.round(b.left + (b.right - b.left) * 0.65); x <= b.right; x++) {
      const at = (y * info.width + x) * 4, r = masks[4][at], g = masks[4][at + 1], blue = masks[4][at + 2];
      if (g > 145 && blue > 160 && (r < g * 0.9 || Math.min(r, g, blue) > 220)) masks[4].copy(glow, at, at, at + 4);
    }
    await sharp(glow, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 })
      .resize(96, 96, { fit: 'contain', background: '#00000000' }).webp({ quality: 92, alphaQuality: 100 }).toFile(`${out}/guardian-core-shot-v2.webp`);
  }
  report.assets.push({ id, source: input, sourceWidth: info.width, sourceHeight: info.height, scale, frames });
  console.log(`${id}: 12 complete alpha silhouettes, common scale ${scale.toFixed(3)}, no cell cropping`);
}
await writeFile(`${out}/guardian-v2-report.json`, JSON.stringify(report, null, 2) + '\n');
