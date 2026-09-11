// One isolated transparent sprite per prop; generated source art lives outside
// the public payload. Keep this list shared by preload and asset verification.
export const ENVIRONMENT_ART = {
  bones: 'bones-v1.webp',
  crate: 'crate-v1.webp',
  stone: 'stone-platform-v1.webp',
  metal: 'metal-platform-v1.webp',
  cabin: 'cabin-v1.webp',
  boulder: 'boulder-v1.webp',
};

export function propImage(scene, x, y, id, width, originY = 1) {
  const image = scene.add.image(x, y, `prop-${id}`).setOrigin(0.5, originY);
  image.setScale(width / image.width);
  return image;
}
