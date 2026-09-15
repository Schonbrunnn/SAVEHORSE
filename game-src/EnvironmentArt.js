// One isolated transparent sprite per prop; generated source art lives outside
// the public payload. Keep this list shared by preload and asset verification.
export const ENVIRONMENT_ART = {
  bones: 'bones-v1.webp',
  crate: 'crate-v1.webp',
  stone: 'stone-platform-v1.webp',
  metal: 'metal-platform-v1.webp',
  cabin: 'cabin-v1.webp',
  boulder: 'boulder-v1.webp',
  ledge: 'ledge-v2.webp',
  bridge: 'bridge-v2.webp',
  lever: 'lever-v2.webp',
  beacon: 'beacon-v2.webp',
  lift: 'lift-v2.webp',
  gate: 'gate-v2.webp',
  wall: 'wall-v2.webp',
  power: 'power-v2.webp',
  wreck: 'wreck-v2.webp',
  'explosion-0': 'explosion-0-v2.webp',
  'explosion-1': 'explosion-1-v2.webp',
  'explosion-2': 'explosion-2-v2.webp',
  'explosion-3': 'explosion-3-v2.webp',
};

export function propImage(scene, x, y, id, width, originY = 1) {
  const image = scene.add.image(x, y, `prop-${id}`).setOrigin(0.5, originY);
  image.setScale(width / image.width);
  return image;
}
