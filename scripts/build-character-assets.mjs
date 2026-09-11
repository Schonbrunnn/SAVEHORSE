import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const assets = path.join(root, 'public/game/assets');
const output = path.join(assets, 'atlases');
const poseNames = ['idle', 'run', 'jump', 'attack', 'skill', 'guard', 'dodge', 'hurt'];
const cellSize = 512;

async function cyanToAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 125 && g > 170 && b > 170 && Math.abs(g - b) < 82) {
      data[i + 3] = 0;
    } else if (r < 165 && g > 150 && b > 150 && Math.abs(g - b) < 95) {
      const edge = Math.max(0, Math.min(255, (r - 110) * 5));
      data[i + 3] = Math.min(data[i + 3], edge);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function greenToAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dominance = g - Math.max(r, b);
    if (g > 125 && dominance > 62) {
      data[i + 3] = 0;
    } else if (g > 105 && dominance > 24) {
      data[i + 3] = Math.min(data[i + 3], Math.max(0, Math.round(255 * (62 - dominance) / 38)));
      data[i + 1] = Math.min(g, Math.max(r, b) + 22);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function chromaToAlpha(input) {
  const { data } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const isCyan = data[2] > 170 && Math.abs(data[1] - data[2]) < 85;
  return isCyan ? cyanToAlpha(input) : greenToAlpha(input);
}

async function removeBakedCheckerboard(input, id) {
  if (id !== 'boss-c') return input;
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Image generators sometimes paint the editor transparency grid into VFX.
  // These three rectangles are outside the face and costume colour ranges, so
  // neutral grid tiles can be removed without altering the reference identity.
  const regions = [
    { left: 1024 + 145, top: 300, right: 1024 + 330, bottom: 445 },
    { left: 1536 + 125, top: 250, right: 1536 + 300, bottom: 385 },
    { left: 125, top: 512 + 90, right: 650, bottom: 512 + 430 },
  ];
  for (const region of regions) {
    for (let y = region.top; y < Math.min(info.height, region.bottom); y += 1) {
      for (let x = region.left; x < Math.min(info.width, region.right); x += 1) {
        const offset = (y * info.width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 17 && (r + g + b) / 3 > 92;
        if (neutral) data[offset + 3] = 0;
      }
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function segmentActionRow(sourceBuffer, referenceCenters = [128, 385, 650, 905, 1170, 1440, 1715, 2015]) {
  const { data, info } = await sharp(sourceBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const count = width * height;
  const labels = new Int32Array(count);
  const queue = new Int32Array(count);
  const components = [{ area: 0 }];
  let label = 0;

  for (let start = 0; start < count; start += 1) {
    if (labels[start] !== 0 || data[start * 4 + 3] < 14) continue;
    label += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let area = 0;
    let sumX = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      sumX += x;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbours = [index - 1, index + 1, index - width, index + width];
      for (let n = 0; n < 4; n += 1) {
        const next = neighbours[n];
        if (next < 0 || next >= count || labels[next] !== 0 || data[next * 4 + 3] < 14) continue;
        if ((n === 0 && x === 0) || (n === 1 && x === width - 1)) continue;
        labels[next] = label;
        queue[tail++] = next;
      }
    }
    components.push({ area, centerX: sumX / area, minX, maxX, minY, maxY, target: -1 });
  }

  const centers = referenceCenters.map((x) => x * width / 2172);
  for (let index = 1; index < components.length; index += 1) {
    const component = components[index];
    if (component.area < 22) continue;
    let best = 0;
    let bestDistance = Infinity;
    centers.forEach((center, pose) => {
      const current = Math.abs(component.centerX - center);
      if (current < bestDistance) { best = pose; bestDistance = current; }
    });
    component.target = best;
  }

  const poses = [];
  for (let pose = 0; pose < centers.length; pose += 1) {
    const selected = components.filter((component) => component.target === pose && component.area >= 22);
    if (!selected.length) throw new Error(`No connected artwork found for row pose ${pose}`);
    const margin = 16;
    const left = Math.max(0, Math.min(...selected.map((component) => component.minX)) - margin);
    const right = Math.min(width - 1, Math.max(...selected.map((component) => component.maxX)) + margin);
    const top = Math.max(0, Math.min(...selected.map((component) => component.minY)) - margin);
    const bottom = Math.min(height - 1, Math.max(...selected.map((component) => component.maxY)) + margin);
    const poseWidth = right - left + 1;
    const poseHeight = bottom - top + 1;
    const poseRaw = Buffer.alloc(poseWidth * poseHeight * 4);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const sourceIndex = y * width + x;
        const component = components[labels[sourceIndex]];
        if (!component || component.target !== pose) continue;
        const targetIndex = ((y - top) * poseWidth + (x - left)) * 4;
        const sourceOffset = sourceIndex * 4;
        poseRaw[targetIndex] = data[sourceOffset];
        poseRaw[targetIndex + 1] = data[sourceOffset + 1];
        poseRaw[targetIndex + 2] = data[sourceOffset + 2];
        poseRaw[targetIndex + 3] = data[sourceOffset + 3];
      }
    }
    const resized = await sharp(poseRaw, { raw: { width: poseWidth, height: poseHeight, channels: 4 } })
      .resize({ width: 438, height: 438, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    const resizedMeta = await sharp(resized).metadata();
    const leftPad = Math.floor((cellSize - resizedMeta.width) / 2);
    const rightPad = cellSize - resizedMeta.width - leftPad;
    const bottomPad = 32;
    const topPad = cellSize - resizedMeta.height - bottomPad;
    poses.push(await sharp(resized).extend({ top: topPad, bottom: bottomPad, left: leftPad, right: rightPad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  }
  return poses;
}

function bossDFxSvg(content) {
  return Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.98"/>
          <stop offset="0.22" stop-color="#ffb9df" stop-opacity="0.94"/>
          <stop offset="0.5" stop-color="#ff2f8a" stop-opacity="0.56"/>
          <stop offset="1" stop-color="#ff2f8a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="shot" x1="1" x2="0">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.32" stop-color="#ff8bc4"/>
          <stop offset="1" stop-color="#ff2f8a" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${content}
    </svg>
  `);
}

async function compositeBossDFx(idleFrame, content) {
  return sharp(idleFrame)
    .composite([{ input: bossDFxSvg(content), blend: 'screen' }])
    .png()
    .toBuffer();
}

async function buildBossDProceduralFrames(idleFrame, hurtFrame) {
  // D is deliberately a mostly fixed turret boss. Reusing the identity-locked
  // base mech and drawing each readable attack cue procedurally keeps the pilot
  // face exact, removes generated checkerboard, and prevents effects crossing
  // frame edges. The arena-wide damaging laser remains a Phaser world object.
  const charge = await compositeBossDFx(idleFrame, `
    <ellipse cx="256" cy="325" rx="218" ry="153" fill="none" stroke="#ff4b9d" stroke-width="6" stroke-opacity="0.54" stroke-dasharray="26 18"/>
    <ellipse cx="256" cy="325" rx="195" ry="132" fill="none" stroke="#ffd1e8" stroke-width="3" stroke-opacity="0.7" stroke-dasharray="8 20"/>
    <circle cx="86" cy="340" r="58" fill="url(#glow)"/>
  `);
  const summon = await compositeBossDFx(idleFrame, `
    <circle cx="405" cy="225" r="76" fill="url(#glow)" opacity="0.64"/>
    <circle cx="405" cy="225" r="58" fill="none" stroke="#fff0fa" stroke-width="7"/>
    <circle cx="405" cy="225" r="72" fill="none" stroke="#ff3188" stroke-width="8" stroke-dasharray="32 14"/>
    <path d="M373 226 C384 194 424 190 438 218 C452 246 419 267 393 251 C371 237 382 212 405 210 C425 209 433 228 421 240" fill="none" stroke="#ff7fbd" stroke-width="9" stroke-linecap="round"/>
  `);
  const lanes = await compositeBossDFx(idleFrame, `
    <rect x="18" y="306" width="80" height="13" rx="7" fill="url(#shot)"/>
    <rect x="18" y="335" width="80" height="13" rx="7" fill="url(#shot)"/>
    <rect x="18" y="364" width="80" height="13" rx="7" fill="url(#shot)"/>
    <circle cx="87" cy="312" r="12" fill="#ffffff"/><circle cx="87" cy="341" r="12" fill="#ffffff"/><circle cx="87" cy="370" r="12" fill="#ffffff"/>
  `);
  const fan = await compositeBossDFx(idleFrame, `
    <path d="M91 340 L34 258 M91 340 L24 299 M91 340 L18 340 M91 340 L24 381 M91 340 L34 422" stroke="#ff5ca8" stroke-width="8" stroke-linecap="round" opacity="0.74"/>
    <circle cx="34" cy="258" r="13" fill="url(#glow)"/><circle cx="24" cy="299" r="13" fill="url(#glow)"/><circle cx="18" cy="340" r="13" fill="url(#glow)"/><circle cx="24" cy="381" r="13" fill="url(#glow)"/><circle cx="34" cy="422" r="13" fill="url(#glow)"/>
  `);
  const laser = await compositeBossDFx(idleFrame, `
    <circle cx="86" cy="340" r="78" fill="url(#glow)"/>
    <circle cx="86" cy="340" r="45" fill="none" stroke="#fff2fb" stroke-width="7" stroke-opacity="0.92"/>
    <circle cx="86" cy="340" r="61" fill="none" stroke="#ff4b9d" stroke-width="5" stroke-opacity="0.8" stroke-dasharray="18 12"/>
    <path d="M70 314 L25 340 L70 366" fill="none" stroke="#ffb4da" stroke-width="8" stroke-linecap="round" stroke-opacity="0.72"/>
  `);
  const overload = await compositeBossDFx(idleFrame, `
    <ellipse cx="256" cy="325" rx="225" ry="162" fill="url(#glow)" opacity="0.35"/>
    <path d="M92 212 L132 183 L151 222 L190 184 M315 174 L335 211 L370 178 L392 220 M88 392 L126 371 L151 411 M354 393 L383 365 L421 397" fill="none" stroke="#fff4fb" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M67 236 L103 212 M409 236 L448 207 M67 409 L105 389 M407 410 L449 386" stroke="#ff247f" stroke-width="7" stroke-linecap="round"/>
  `);
  return [idleFrame, charge, summon, lanes, fan, laser, overload, hurtFrame];
}

async function segmentActionGrid(sourceBuffer, columns, rows, frameCount, id) {
  const { data, info } = await sharp(sourceBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const poses = [];

  for (let pose = 0; pose < frameCount; pose += 1) {
    const column = pose % columns;
    const row = Math.floor(pose / columns);
    const nominalLeft = column * cellWidth;
    const nominalTop = row * cellHeight;
    const expansion = id === 'effects' ? 240 : 118;
    const windowLeft = Math.max(0, Math.floor(nominalLeft - expansion));
    const windowTop = Math.max(0, Math.floor(nominalTop - expansion));
    const windowRight = Math.min(width, Math.ceil(nominalLeft + cellWidth + expansion));
    const windowBottom = Math.min(height, Math.ceil(nominalTop + cellHeight + expansion));
    const windowWidth = windowRight - windowLeft;
    const windowHeight = windowBottom - windowTop;
    const windowCount = windowWidth * windowHeight;
    const labels = new Int32Array(windowCount);
    const queue = new Int32Array(windowCount);
    const components = [{ area: 0 }];
    let label = 0;

    for (let start = 0; start < windowCount; start += 1) {
      if (labels[start] !== 0) continue;
      const localX = start % windowWidth;
      const localY = Math.floor(start / windowWidth);
      const globalIndex = (windowTop + localY) * width + windowLeft + localX;
      if (data[globalIndex * 4 + 3] < 14) continue;
      label += 1;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      labels[start] = label;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = windowWidth;
      let maxX = 0;
      let minY = windowHeight;
      let maxY = 0;
      while (head < tail) {
        const index = queue[head++];
        const x = index % windowWidth;
        const y = Math.floor(index / windowWidth);
        area += 1;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        const neighbours = [index - 1, index + 1, index - windowWidth, index + windowWidth];
        for (let n = 0; n < 4; n += 1) {
          const next = neighbours[n];
          if (next < 0 || next >= windowCount || labels[next] !== 0) continue;
          if ((n === 0 && x === 0) || (n === 1 && x === windowWidth - 1)) continue;
          const nextX = next % windowWidth;
          const nextY = Math.floor(next / windowWidth);
          const nextGlobal = (windowTop + nextY) * width + windowLeft + nextX;
          if (data[nextGlobal * 4 + 3] < 14) continue;
          labels[next] = label;
          queue[tail++] = next;
        }
      }
      const centerX = windowLeft + sumX / area;
      const centerY = windowTop + sumY / area;
      const expectedX = nominalLeft + cellWidth / 2;
      const expectedY = nominalTop + cellHeight / 2;
      const distance = Math.hypot((centerX - expectedX) / cellWidth, (centerY - expectedY) / cellHeight);
      const inside = centerX >= nominalLeft && centerX < nominalLeft + cellWidth && centerY >= nominalTop && centerY < nominalTop + cellHeight;
      components.push({ area, minX, maxX, minY, maxY, centerX, centerY, score: area * (inside ? 1 : 0.06) / (1 + distance) });
    }

    const component = components.filter((entry) => entry.area >= 28).sort((a, b) => b.score - a.score)[0];
    if (!component) throw new Error(`No connected artwork found for grid pose ${pose}`);
    const margin = 18;
    const left = Math.max(0, component.minX - margin);
    let right = Math.min(windowWidth - 1, component.maxX + margin);
    const top = Math.max(0, component.minY - margin);
    const bottom = Math.min(windowHeight - 1, component.maxY + margin);
    let fadeStart = Infinity;
    let fadeEnd = Infinity;
    if (id === 'boss-d' && pose === 5) {
      fadeStart = nominalLeft + 338 - windowLeft;
      fadeEnd = nominalLeft + 430 - windowLeft;
      right = Math.min(right, Math.ceil(fadeEnd));
    }
    const poseWidth = right - left + 1;
    const poseHeight = bottom - top + 1;
    const poseRaw = Buffer.alloc(poseWidth * poseHeight * 4);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const windowIndex = y * windowWidth + x;
        if (labels[windowIndex] !== components.indexOf(component)) continue;
        const sourceX = windowLeft + x;
        const sourceY = windowTop + y;
        const sourceOffset = (sourceY * width + sourceX) * 4;
        const targetOffset = ((y - top) * poseWidth + x - left) * 4;
        poseRaw[targetOffset] = data[sourceOffset];
        poseRaw[targetOffset + 1] = data[sourceOffset + 1];
        poseRaw[targetOffset + 2] = data[sourceOffset + 2];
        const fade = x <= fadeStart ? 1 : Math.max(0, (fadeEnd - x) / (fadeEnd - fadeStart));
        poseRaw[targetOffset + 3] = Math.round(data[sourceOffset + 3] * fade);
      }
    }
    const resized = await sharp(poseRaw, { raw: { width: poseWidth, height: poseHeight, channels: 4 } })
      .resize({ width: 438, height: 438, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    const resizedMeta = await sharp(resized).metadata();
    const leftPad = Math.floor((cellSize - resizedMeta.width) / 2);
    const rightPad = cellSize - resizedMeta.width - leftPad;
    // Projectiles are centered on their damage point; characters are feet-aligned.
    const bottomPad = id === 'effects' ? Math.floor((cellSize - resizedMeta.height) / 2) : 30;
    const topPad = cellSize - resizedMeta.height - bottomPad;
    poses.push(await sharp(resized).extend({ top: topPad, bottom: bottomPad, left: leftPad, right: rightPad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  }
  return poses;
}

async function buildRowAtlas({ id, input, matte = null, centers = null, frameMap = null }) {
  const sourcePath = path.join(assets, input);
  if (!existsSync(sourcePath)) return null;
  const raw = matte === 'cyan'
    ? await cyanToAlpha(sourcePath)
    : matte === 'green'
      ? await greenToAlpha(sourcePath)
      : await sharp(sourcePath).ensureAlpha().png().toBuffer();
  const poseDir = path.join(output, id);
  await mkdir(poseDir, { recursive: true });
  const sourceFrames = await segmentActionRow(raw, centers || undefined);
  const frames = frameMap ? frameMap.map((index) => sourceFrames[index]) : sourceFrames;
  for (let index = 0; index < poseNames.length; index += 1) {
    const filename = `${poseNames[index]}.png`;
    await sharp(frames[index]).png({ compressionLevel: 9 }).toFile(path.join(poseDir, filename));
  }
  const composites = frames.map((inputBuffer, index) => ({
    input: inputBuffer,
    left: (index % 4) * cellSize,
    top: Math.floor(index / 4) * cellSize,
  }));
  await sharp({ create: { width: cellSize * 4, height: cellSize * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, `${id}-actions-4x2.png`));
  return { id, layout: '4x2', cell: [cellSize, cellSize], poses: poseNames };
}

async function buildGridAtlas({ id, input, columns = 4, rows = 2, matte = null, names = poseNames }) {
  const sourcePath = path.join(assets, input);
  if (!existsSync(sourcePath)) return null;
  const keyedSource = matte === 'cyan' ? await cyanToAlpha(sourcePath) : await sharp(sourcePath).ensureAlpha().png().toBuffer();
  const source = await removeBakedCheckerboard(keyedSource, id);
  const poseDir = path.join(output, id);
  await mkdir(poseDir, { recursive: true });
  let frames = await segmentActionGrid(source, columns, rows, names.length, id);
  if (id === 'boss-d' && frames.length === 8) frames = await buildBossDProceduralFrames(frames[0], frames[7]);
  for (let index = 0; index < names.length; index += 1) {
    await sharp(frames[index]).png({ compressionLevel: 9 }).toFile(path.join(poseDir, `${names[index]}.png`));
  }
  await sharp({ create: { width: cellSize * columns, height: cellSize * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((inputBuffer, index) => ({ input: inputBuffer, left: (index % columns) * cellSize, top: Math.floor(index / columns) * cellSize })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, `${id}-actions-${columns}x${rows}.png`));
  return { id, layout: `${columns}x${rows}`, cell: [cellSize, cellSize], poses: names };
}

async function buildPortrait({ id, input, crop }) {
  const dedicatedSource = path.join(assets, 'portrait-sources', `${id}.png`);
  const chromaSource = path.join(assets, 'portrait-sources', `${id}-chroma.png`);
  const sourcePath = existsSync(dedicatedSource)
    ? dedicatedSource
    : existsSync(chromaSource)
      ? chromaSource
      : path.join(assets, input);
  if (!existsSync(sourcePath)) return null;
  const sourceBuffer = existsSync(chromaSource) && sourcePath === chromaSource
    ? await chromaToAlpha(sourcePath)
    : await sharp(sourcePath).ensureAlpha().png().toBuffer();
  const metadata = await sharp(sourceBuffer).metadata();
  const safeCrop = existsSync(dedicatedSource) || sourcePath === chromaSource || input.startsWith('atlases/')
    ? { left: 0, top: 0, width: metadata.width, height: metadata.height }
    : crop;
  const left = Math.max(0, Math.min(metadata.width - 1, safeCrop.left));
  const top = Math.max(0, Math.min(metadata.height - 1, safeCrop.top));
  const width = Math.min(safeCrop.width, metadata.width - left);
  const height = Math.min(safeCrop.height, metadata.height - top);
  const extracted = await sharp(sourceBuffer).extract({ left, top, width, height }).png().toBuffer();
  const trimmed = await sharp(extracted).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 }).png().toBuffer();
  const resized = await sharp(trimmed).resize({ width: 920, height: 1160, fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const size = await sharp(resized).metadata();
  const leftPad = Math.floor((1024 - size.width) / 2);
  const rightPad = 1024 - size.width - leftPad;
  const bottomPad = 40;
  const topPad = 1280 - size.height - bottomPad;
  const target = path.join(assets, 'portraits', `${id}.png`);
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(resized).extend({ top: topPad, bottom: bottomPad, left: leftPad, right: rightPad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(target);
  return `assets/portraits/${id}.png`;
}

await mkdir(output, { recursive: true });
const atlasEntries = [];
atlasEntries.push(await buildRowAtlas({
  id: 'player-a',
  input: 'actions/player-a-4-actions-green.png',
  matte: 'green',
  centers: [230, 785, 1305, 1810],
  frameMap: [0, 1, 1, 2, 3, 0, 1, 0],
}));
atlasEntries.push(await buildRowAtlas({ id: 'player-b', input: 'actions/player-b-8-actions.png' }));
atlasEntries.push(await buildGridAtlas({
  id: 'boss-c',
  input: 'generated/boss-c-actions.png',
  matte: 'cyan',
  names: ['idle', 'run', 'jump', 'attack', 'skill', 'gun', 'fire', 'hurt'],
}));
atlasEntries.push(await buildGridAtlas({
  id: 'boss-d',
  input: 'generated/boss-d-actions.png',
  matte: 'cyan',
  names: ['idle', 'charge', 'summon', 'lanes', 'fan', 'laser', 'overload', 'hurt'],
}));
atlasEntries.push(await buildGridAtlas({
  id: 'minions', input: 'generated/minion-actions.png', columns: 3, rows: 3,
  names: ['shield-idle', 'shield-run', 'shield-attack', 'ranged-idle', 'ranged-run', 'ranged-attack', 'heavy-idle', 'heavy-run', 'heavy-attack'],
}));
atlasEntries.push(await buildGridAtlas({
  id: 'effects', input: 'generated/skill-effects.png',
  names: ['shield', 'charge', 'slash', 'bullet', 'berry', 'fan', 'laser'],
}));

const portraits = {};
portraits.playerA = await buildPortrait({ id: 'player-a', input: 'chery-captain.png', crop: { left: 0, top: 0, width: 1536, height: 1024 } });
portraits.playerB = await buildPortrait({ id: 'player-b', input: 'jiaotong-knight.png', crop: { left: 0, top: 0, width: 625, height: 1086 } });
portraits.bossC = await buildPortrait({ id: 'boss-c', input: 'atlases/boss-c/idle.png', crop: { left: 0, top: 0, width: 512, height: 512 } });
portraits.bossD = await buildPortrait({ id: 'boss-d', input: 'strawberry-doctor.png', crop: { left: 0, top: 0, width: 1060, height: 875 } });
portraits.merchant = await buildPortrait({ id: 'merchant', input: 'mystery-merchant.png', crop: { left: 820, top: 190, width: 560, height: 570 } });

await writeFile(path.join(output, 'atlas.json'), `${JSON.stringify({ generatedBy: 'scripts/build-character-assets.mjs', cellSize, atlases: atlasEntries.filter(Boolean), portraits }, null, 2)}\n`);
console.log(`Built ${atlasEntries.filter(Boolean).length} action atlases and ${Object.values(portraits).filter(Boolean).length} portraits.`);
