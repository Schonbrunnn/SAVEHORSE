// Original biome art is packed once per map. Only collision-bearing ledges
// receive a bright top edge; murals never pretend to be traversable floors.
export const WORLD_KITS = ['mountain', 'mine', 'reactor'];
export const WORLD_FRAMES = ['distant', 'chamber', 'ledge', 'pier', 'arch', 'machine', 'landmark', 'scatter'];
export const worldTexture = stage => `world-${WORLD_KITS[stage - 1]}`;

export function worldImage(scene, x, y, frame, width, originY = 1) {
  const image = scene.add.image(x, y, worldTexture(scene.map.id), frame).setOrigin(0.5, originY);
  image.setScale(width / image.width);
  return image;
}

const DRESSING = {
  1: [
    ['landmark', 720, 590, 330], ['arch', 1160, 590, 390],
    ['scatter', 80, 590, 240], ['scatter', 1000, 590, 180], ['scatter', 1670, 590, 140],
    ['pier', 2910, 595, 160, 380], ['pier', 3600, 595, 185, 470], ['pier', 4260, 595, 185, 470],
    ['landmark', 3780, 110, 370], ['machine', 4390, 110, 230], ['scatter', 4220, -210, 180],
    ['arch', 5490, 590, 510], ['scatter', 5340, 590, 200], ['scatter', 6060, 590, 250],
  ],
  2: [
    ['arch', 310, 590, 560], ['scatter', 720, 590, 210], ['landmark', 2060, 590, 280],
    ['pier', 1460, 590, 170, 740], ['pier', 2150, 590, 160, 740], ['arch', 1870, -210, 510],
    ['landmark', 1550, -210, 270], ['scatter', 2430, -210, 180],
    ['machine', 1740, 1120, 370], ['arch', 2430, 1120, 470], ['scatter', 1510, 1120, 170],
    ['arch', 3070, 590, 550], ['scatter', 4030, 590, 220],
    ['pier', 4450, 1120, 135, 500], ['machine', 4870, 1120, 250], ['scatter', 5070, 1120, 180],
    ['scatter', 5240, 590, 190],
  ],
  3: [
    ['arch', 350, 590, 510], ['scatter', 760, 590, 210], ['landmark', 1770, 590, 260],
    ['pier', 2430, 590, 150, 680], ['arch', 2910, 590, 470], ['scatter', 3220, 590, 180],
    ['machine', 4170, -350, 380], ['landmark', 3570, -350, 300], ['pier', 4350, 590, 165, 920],
    ['arch', 3830, 1130, 540], ['machine', 2670, 1130, 350], ['landmark', 3160, 1130, 200],
    ['scatter', 4410, 1130, 190], ['arch', 4850, 590, 650], ['scatter', 5990, 590, 230],
  ],
};

// These are functional wiring diagrams embedded in the world, not decoration
// standing in for generated art. Their endpoints are real switches and gates.
const CIRCUITS = {
  1: [{ id: 'mountain-winch', points: [[4320, 60], [4485, 60], [4485, 525], [4550, 525], [4910, 525]] }],
  2: [{ id: 'cave-counterweight', points: [[1740, 1070], [1740, 1225], [2600, 1225], [2600, 660], [2890, 660]] },
    { id: 'cave-drain', points: [[4630, 960], [4710, 960], [4710, 660], [5210, 660]] }],
  3: [{ id: 'base-north', points: [[4170, -390], [4355, -390], [4355, 385], [4660, 385]] },
    { id: 'base-south', points: [[2670, 1080], [2670, 1240], [4440, 1240], [4440, 485], [4660, 485]] }],
};

export class WorldArt {
  constructor(scene) {
    this.scene = scene;
    this.blend = 0;
    this.layers = ['distant', 'chamber'].map((frame, i) => {
      const layer = scene.add.image(640, 360, worldTexture(scene.map.id), frame)
        .setDisplaySize(1600, 800).setScrollFactor(0).setDepth(-40 + i).setAlpha(i ? 0 : 1);
      return layer;
    });
    // Fixed-screen shade: never repeats the horizon when the camera climbs.
    scene.add.rectangle(640, 360, 1280, 720, 0x070c15, 0.21).setScrollFactor(0).setDepth(-37);
    for (const [frame, x, y, width, height] of DRESSING[scene.map.id]) {
      const image = worldImage(scene, x, y, frame, width).setDepth(-8);
      if (height) image.setDisplaySize(width, height);
      image.setAlpha(frame === 'pier' ? 0.77 : 0.91);
    }
    this.wires = scene.add.graphics().setDepth(1);
    this.refresh(new Set());
  }

  refresh(flags) {
    const g = this.wires.clear();
    for (const circuit of CIRCUITS[this.scene.map.id]) {
      const on = flags.has(circuit.id);
      for (let i = 1; i < circuit.points.length; i++) {
        const [ax, ay] = circuit.points[i - 1], [bx, by] = circuit.points[i];
        g.lineStyle(9, 0x0c151e, 0.9).lineBetween(ax, ay, bx, by);
        g.lineStyle(3, on ? 0x79e4c2 : 0xa08353, on ? 0.9 : 0.42).lineBetween(ax, ay, bx, by);
      }
      for (const [x, y] of [circuit.points[0], circuit.points.at(-1)]) g.fillStyle(on ? 0xafffee : 0xcc9358, 0.9).fillCircle(x, y, on ? 6 : 4);
    }
  }

  update(delta) {
    const s = this.scene, feet = s.player.body.y + 75;
    const target = s.map.id === 1 ? (s.player.body.x > 2780 && feet < 340 ? 0.94 : 0)
      : feet > 790 ? 1 : feet < 250 ? 0.7 : 0;
    this.blend += (target - this.blend) * Math.min(1, delta / 430);
    this.layers[1].setAlpha(this.blend);
    this.layers.forEach((layer, i) => {
      const progress = Math.max(0, Math.min(1, s.cameras.main.scrollX / (s.map.width - 1280)));
      layer.x = 640 + (0.5 - progress) * (i ? 120 : 180);
    });
  }
}
