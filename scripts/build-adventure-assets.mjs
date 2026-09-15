import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'art-source/adventure-v2');
const props = path.join(root, 'public/game/assets/props');
await mkdir(props, { recursive: true });
const report = JSON.parse(await readFile(path.join(source, 'asset-report.json'), 'utf8'));
const names = [['ledge', 'bridge', 'lever', 'beacon'], ['lift', 'gate', 'wall', 'power']];
for (let atlas = 0; atlas < 3; atlas++) {
  const entry = report.assets[atlas];
  for (let i = 0; i < 4; i++) {
    const [left, top, right, bottom] = atlas < 2 ? entry.cell_bounds[i] : [0, 0, 640, 640];
    const name = atlas < 2 ? names[atlas][i] : `explosion-${i}`;
    await sharp(path.join(source, entry.file)).extract({ left: (i % 2) * 640 + left, top: Math.floor(i / 2) * 640 + top, width: right - left, height: bottom - top })
      .webp({ quality: 91, alphaQuality: 100 }).toFile(path.join(props, `${name}-v2.webp`));
  }
}
await sharp(path.join(source, 'mech-wreck-v2-clean.png')).trim({ threshold: 2 }).webp({ quality: 91, alphaQuality: 100 }).toFile(path.join(props, 'wreck-v2.webp'));

// Deterministic cutout rig: no generated face, resynthesis or frame-to-frame
// identity drift. SVG here is only an affine image-mask compositor, not art.
for (const hero of ['a', 'b']) {
  const input = await readFile(path.join(root, `public/game/assets/atlases/player-${hero}/idle.png`));
  const href = `data:image/png;base64,${input.toString('base64')}`;
  for (let frame = 0; frame < 12; frame++) {
    const phase = frame / 12 * Math.PI * 2;
    const backAngle = Math.sin(phase) * 14;
    const frontAngle = -Math.sin(phase) * 12;
    let content;
    if (hero === 'a') {
      content = `<defs>
        <clipPath id="rear"><polygon points="0,315 237,315 278,273 315,288 280,339 210,412 190,486 0,486"/></clipPath>
        <clipPath id="front"><polygon points="310,251 357,251 437,306 477,488 338,488 330,354 283,298"/></clipPath>
        <clipPath id="upper"><polygon points="0,0 512,0 512,252 359,252 319,298 285,310 239,319 0,319"/></clipPath>
      </defs>
      <g transform="rotate(${backAngle} 278 285)"><image href="${href}" width="512" height="512" clip-path="url(#rear)"/></g>
      <g transform="rotate(${frontAngle} 324 279)"><image href="${href}" width="512" height="512" clip-path="url(#front)"/></g>
      <image href="${href}" width="512" height="512" clip-path="url(#upper)"/>`;
    } else {
      content = `<image href="${href}" width="512" height="512"/>`;
      for (const [index, x, y, radius] of [[0, 148, 402, 17], [1, 353, 412, 22]]) {
        content += `<defs><clipPath id="hub${index}"><circle cx="${x}" cy="${y}" r="${radius}"/></clipPath></defs>
          <g clip-path="url(#hub${index})"><image href="${href}" width="512" height="512" transform="rotate(${frame * 30} ${x} ${y})"/></g>`;
      }
    }
    const rendered = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${content}</svg>`)).png().toBuffer();
    if (hero === 'a') {
      const { data, info } = await sharp(rendered).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let foot = 0;
      for (let y = 320; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 14) foot = Math.max(foot, y);
      const offset = 468 - foot;
      const rect = { left: 0, top: Math.max(0, -offset), width: 512, height: 512 - Math.abs(offset) };
      const shifted = await sharp(rendered).extract(rect).extend({ top: Math.max(0, offset), bottom: Math.max(0, -offset), left: 0, right: 0, background: '#00000000' }).png().toBuffer();
      await sharp(shifted).png().toFile(path.join(props, `motion-${hero}-${frame}-v2.png`));
    } else await sharp(rendered).png().toFile(path.join(props, `motion-${hero}-${frame}-v2.png`));
  }
}
console.log('Adventure props, four aligned explosion frames and 24 identity-preserving motion frames built.');
