import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Uses the existing project's installed decoder read-only. No project files
// are modified, and the original PNG is never overwritten.
const require = createRequire(new URL('../../work/friend-fighters/package.json', import.meta.url));
const sharp = require('sharp');
const directory = fileURLToPath(new URL('./', import.meta.url));
const source = path.join(directory, 'mech-wreck-v2.png');
const output = path.join(directory, 'mech-wreck-v2-clean.png');

if (process.argv.includes('--inspect')) {
  await sharp(source).extract({ left: 760, top: 90, width: 310, height: 260 })
    .resize(930, 780).png().toFile(path.join(directory, 'mech-wreck-smoke-inspect.png'));
  await sharp(source).extract({ left: 300, top: 290, width: 160, height: 150 })
    .resize(800, 750).png().toFile(path.join(directory, 'mech-wreck-smoke-left-inspect.png'));
  console.log('Read-only source inspection crop saved; no source pixels changed.');
} else {
  const sourceHash = createHash('sha256').update(await readFile(source)).digest('hex');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1536);
  assert.equal(info.height, 768);
  assert.equal(info.channels, 4);
  // The final deterministic masks are restricted to external smoke, never
  // the cockpit, shell, exhaust pipe or any other mechanical surfaces.
  const polygons = [
    // Main plume: the lower-left boundary follows the outside of the cockpit
    // rim, ending in the transparent gap before the large exhaust pipe.
    [[870,109],[941,109],[941,205],[932,219],[925,223],[923,231],[919,239],[916,247],[912,254],[905,254],[903,242],[902,237],[897,224],[893,215],[889,207],[884,199],[879,194],[876,192],[870,190]],
    // Small checkerboard plume in the empty gap between the two exhausts.
    [[978,237],[985,238],[994,247],[998,252],[991,253],[990,256],[986,261],[982,265],[979,269],[976,274],[976,277],[970,280],[960,276],[964,264],[967,253],[971,246]],
    // A detached two-pixel fringe just left of the large pipe's cap.
    [[924,219],[931,219],[931,224],[924,224]],
    // Left shoulder plume, above the exposed shoulder casing and outside the
    // adjacent hanging cables. The sloped lower edge preserves the casing.
    [[320,300],[400,300],[400,386],[390,390],[380,393],[373,399],[370,405],[361,400],[320,380]],
  ];
  function contains(x, y, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i];
      const [xj, yj] = vertices[j];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  assert(polygons.length > 0, 'Masks must be visually verified before producing the clean asset.');
  const cleaned = Buffer.from(data);
  let removedPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!polygons.some((polygon) => contains(x + 0.5, y + 0.5, polygon))) continue;
      const offset = (y * info.width + x) * 4 + 3;
      if (cleaned[offset] > 0) removedPixels += 1;
      cleaned[offset] = 0;
    }
  }
  await sharp(cleaned, { raw: info }).png().toFile(output);
  const verified = await sharp(output).ensureAlpha().raw().toBuffer();
  assert.equal(Buffer.compare(cleaned, verified), 0, 'PNG round-trip changed pixel data');
  assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'), sourceHash, 'Source must remain unchanged');
  await sharp(output).flatten({ background: '#18323b' }).png()
    .toFile(path.join(directory, 'mech-wreck-v2-clean-preview.png'));
  await sharp(output).extract({ left: 760, top: 90, width: 310, height: 260 })
    .resize(930, 780).flatten({ background: '#18323b' }).png()
    .toFile(path.join(directory, 'mech-wreck-smoke-clean-inspect.png'));
  console.log(JSON.stringify({ source, output, size: [info.width, info.height], removedPixels, sourceUnchanged: true, outsideMasksUnchanged: true }));
}
