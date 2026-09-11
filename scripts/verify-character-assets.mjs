import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Read-only verification: run after `pnpm assets:build` from any directory.
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'public/game/assets');
const alphaThreshold = 20;
const minimumMargin = 4;
const commonPoses = ['idle', 'run', 'jump', 'attack', 'skill', 'guard', 'dodge', 'hurt'];
const expectedAtlases = {
  'player-a': commonPoses,
  'player-b': commonPoses,
  'boss-c': ['idle', 'run', 'jump', 'attack', 'skill', 'gun', 'fire', 'hurt'],
  'boss-d': ['idle', 'charge', 'summon', 'lanes', 'fan', 'laser', 'overload', 'hurt'],
  minions: ['shield-idle', 'shield-run', 'shield-attack', 'ranged-idle', 'ranged-run', 'ranged-attack', 'heavy-idle', 'heavy-run', 'heavy-attack'],
  effects: ['shield', 'charge', 'slash', 'bullet', 'berry', 'fan', 'laser'],
};
const portraitNames = ['player-a', 'player-b', 'boss-c', 'boss-d', 'merchant'];
const failures = [];
const results = new Map();

async function check(label, work) {
  try {
    await work();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

async function inspectPng(relativeFile, width, height, requireMargin) {
  const file = path.join(assets, relativeFile);
  const image = sharp(file);
  const metadata = await image.metadata();
  assert.equal(metadata.format, 'png', 'must be PNG');
  assert.equal(metadata.width, width, `width must be ${width}`);
  assert.equal(metadata.height, height, `height must be ${height}`);
  assert.equal(metadata.hasAlpha, true, 'must contain a real alpha channel');

  // Do not add an alpha channel here: an opaque RGB asset must fail.
  const { data, info } = await image.extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 1, 'expected a single alpha plane');
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let index = 0; index < data.length; index += 1) {
    const alpha = data[index];
    if (alpha === 0) transparentPixels += 1;
    if (alpha <= alphaThreshold) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    visiblePixels += 1;
  }
  assert(visiblePixels > 0, `artwork is empty at alpha > ${alphaThreshold}`);
  assert(transparentPixels > 0, 'alpha channel is present but has no fully transparent pixels');
  const margins = { left: minX, top: minY, right: width - 1 - maxX, bottom: height - 1 - maxY };
  if (requireMargin) {
    for (const [edge, pixels] of Object.entries(margins)) {
      assert(pixels >= minimumMargin, `${edge} transparent margin is ${pixels}px; expected at least ${minimumMargin}px (alpha > ${alphaThreshold})`);
    }
  }
  const result = { visibleHeight: maxY - minY + 1, margins, visiblePixels, transparentPixels };
  results.set(relativeFile, result);
  return result;
}

let expectedFrames = 0;
for (const [id, poses] of Object.entries(expectedAtlases)) {
  const relativeDirectory = `atlases/${id}`;
  expectedFrames += poses.length;
  await check(relativeDirectory, async () => {
    const pngs = (await readdir(path.join(assets, relativeDirectory))).filter((name) => name.endsWith('.png')).sort();
    assert.deepEqual(pngs, poses.map((pose) => `${pose}.png`).sort(), 'independent PNG files must exactly match the required poses');
  });
  for (const pose of poses) {
    const relativeFile = `${relativeDirectory}/${pose}.png`;
    await check(relativeFile, () => inspectPng(relativeFile, 512, 512, true));
  }
}
assert.equal(expectedFrames, 48, 'verification fixture must cover all 48 independent action PNGs');

await check('portraits', async () => {
  const pngs = (await readdir(path.join(assets, 'portraits'))).filter((name) => name.endsWith('.png')).sort();
  assert.deepEqual(pngs, portraitNames.map((name) => `${name}.png`).sort(), 'portrait PNGs must exactly match the five required characters');
});
for (const name of portraitNames) {
  const relativeFile = `portraits/${name}.png`;
  await check(relativeFile, () => inspectPng(relativeFile, 1024, 1280, false));
}

for (const [pose, lower, upper] of [['idle', 360, 480], ['hurt', 330, 500]]) {
  const relativeFile = `atlases/boss-d/${pose}.png`;
  await check(relativeFile, async () => {
    const result = results.get(relativeFile);
    assert(result, 'cannot validate screen height because the PNG failed its basic checks');
    const screenHeight = result.visibleHeight * 600 / 512;
    assert(screenHeight >= lower && screenHeight <= upper, `visible height at displayHeight=600 is ${screenHeight.toFixed(1)}px; expected ${lower}–${upper}px on the 720px canvas`);
    console.log(`Boss D ${pose}: ${result.visibleHeight}px artwork → ${screenHeight.toFixed(1)}px / 720px (${(screenHeight / 720 * 100).toFixed(1)}%).`);
  });
}

if (failures.length > 0) {
  console.error(`Asset verification failed (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const actionMargins = [...results].filter(([file]) => file.startsWith('atlases/')).flatMap(([, result]) => Object.values(result.margins));
  console.log(`PASS: ${expectedFrames} independent 512×512 RGBA action PNGs; minimum artwork-to-edge margin ${Math.min(...actionMargins)}px.`);
  console.log(`PASS: ${portraitNames.length} nonempty 1024×1280 PNG portraits with real transparency.`);
  console.log('Pixel checks do not prove facial identity or pose quality; retain visual review.');
}
