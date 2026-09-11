import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ENVIRONMENT_ART } from '../game-src/EnvironmentArt.js';

const root = process.cwd();
const sourceRoot = path.join(root, 'art-source/props-v1');
const outputRoot = path.join(root, 'public/game/assets/props');
const maxWidths = { bones: 512, crate: 384, stone: 1024, metal: 1024, cabin: 1280, boulder: 384 };
await mkdir(outputRoot, { recursive: true });
const report = {};

for (const [id, file] of Object.entries(ENVIRONMENT_ART)) {
  const input = path.join(sourceRoot, `${id}.png`);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let fringeRemoved = 0;
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let i = 0; i < data.length; i += 4) {
    // Remove isolated chroma-key spill from the generated dry bone cutout.
    // This is deterministic alpha cleanup only, never repainting bone detail.
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (id === 'bones' && data[i + 3] > 0 && r > 180 && r - b > 110 && (g < 100 || (g > 160 && g - b > 100))) {
      data[i + 3] = 0;
      fringeRemoved++;
    }
    if (data[i + 3] < 8) {
      data[i + 3] = 0;
      transparent++;
    } else {
      const pixel = i / 4, x = pixel % info.width, y = Math.floor(pixel / info.width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (transparent < info.width * info.height * 0.01 || right < left) throw new Error(`${id}: missing meaningful alpha; inspect source instead of guessing a background key`);
  const bounds = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const result = await sharp(data, { raw: info }).extract(bounds)
    .resize({ width: maxWidths[id], withoutEnlargement: true })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputRoot, file));
  report[id] = { file, sourceSize: [info.width, info.height], sourceBounds: bounds, size: [result.width, result.height], bytes: result.size, fringeRemoved };
}
await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
