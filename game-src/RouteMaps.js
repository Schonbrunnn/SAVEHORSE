// Small, connected exploration spaces around the existing ground-level fights.
// Doors are physical full-height seals AND progression requirements, so a dash
// or an upper passage can never silently bypass a required circuit.
const floor = (left, right, y = 590) => ({ left, right, y });
const steps = (points) => points.map(([x, y, width = 260]) => ({ type: 'platform', x, y, width }));
const room = (id, name, x, y, width, height) => ({ id, name, x, y, width, height });

export const ROUTE_MAPS = {
  1: {
    top: -900, bottom: 960,
    floors: [floor(0, 3100), floor(3730, 4600)],
    platforms: steps([[350, 430], [600, 270], [350, 110], [600, -50],
      [920, 430, 220], [1040, 270, 220], [850, 110, 220], [1040, -50, 220], [680, -210, 950]]),
    rooms: [room('road', '山门中庭', 0, 0, 1190, 720), room('belfry', '上层绞盘楼', 140, -900, 1050, 900),
      room('ambush', '伏兵关隘', 1250, 0, 1450, 720), room('bridge', '落桥峡谷', 2730, 0, 1190, 720), room('exit', '洞窟前庭', 3920, 0, 680, 720)],
    links: [['road', 'belfry'], ['road', 'ambush'], ['ambush', 'bridge'], ['bridge', 'exit']],
    requirements: { wave: ['mountain-winch'], exit: ['mountain-winch'] },
    seals: [{ id: 'mountain-door', x: 1190, requires: ['mountain-winch'], name: '山门', hint: '先登上绞盘楼，击败守卫后攻击绞盘' }],
    objects: [
      { type: 'lever', id: 'mountain-winch', x: 380, y: -210, requires: ['mini-shield'], name: '山门绞盘', notice: '山门与峡谷落桥已开启 · 升降台接回中庭' },
      { type: 'lift', x: 980, lowY: 590, highY: -210, width: 180, requires: ['mountain-winch'], name: '中庭捷径' },
      { type: 'bridge', x: 3420, y: 465, width: 760, requires: ['mountain-winch'] },
      { type: 'beacon', x: 240, y: 590, noHeal: true, text: '山门封闭 · 两侧阶梯都通向上层绞盘楼' },
      { type: 'beacon', x: 2920, y: 590, text: '绞盘已经放下峡谷桥 · 跳上桥面穿过峡谷' },
      { type: 'reward', x: 240, y: -268 },
      { type: 'beacon', x: 4110, y: 590, text: '洞窟入口就在前方' },
    ],
    minis: [{ id: 'mini-shield', name: '盾卫长', type: 'shield', x: 670, floorY: -210, left: 200, right: 1140,
      entry: { x: 1060, y: -285 }, hp: 150, speed: 130, range: 180, damage: 14, cooldown: 1500,
      hint: '盾击之后会重砸 · 绕背或二段跳', required: true, attacks: [
        { name: '盾击', warning: 520, activeMs: 130, recoveryMs: 360, lunge: 200, range: 190, damage: 14 },
        { name: '重盾落砸 · 跳起', warning: 850, activeMs: 170, recoveryMs: 580, range: 270, damage: 20, knockdown: true },
      ] }],
  },
  2: {
    top: -900, bottom: 1450,
    floors: [floor(0, 2440), floor(2780, 4480), floor(4870, 6500), floor(1440, 2840, 1120), floor(4370, 5190, 1120)],
    platforms: steps([[2350, 430], [2640, 270], [2350, 110], [2640, -50], [1980, -210, 1450]]),
    rooms: [room('entrance', '洞窟入口', 0, 0, 820, 720), room('patrol', '佣兵封锁厅', 820, 0, 1450, 720),
      room('junction', '三层交汇井', 2280, -210, 630, 1500), room('gallery', '上层旧矿廊 · 可选', 1230, -900, 1510, 900),
      room('counterweight', '下层配重室', 1430, 720, 1390, 590), room('rabbit', '杀人兔竞技场', 2960, 0, 1280, 720),
      room('drain', '战后排水暗道', 4330, 720, 870, 590), room('cabin', '商人木屋', 5240, 0, 1260, 720)],
    links: [['entrance', 'patrol'], ['patrol', 'junction'], ['junction', 'gallery'], ['junction', 'counterweight'],
      ['junction', 'rabbit'], ['rabbit', 'drain'], ['drain', 'cabin']],
    requirements: { boss: ['cave-counterweight'], cabin: ['cave-counterweight', 'cave-drain'] },
    preBossFlags: ['cave-counterweight'],
    seals: [
      { id: 'cave-door', x: 2890, requires: ['cave-counterweight'], name: '竞技场前闸', hint: '下降到配重室，向左寻找配重机关' },
      { id: 'cabin-door', x: 5210, requires: ['cave-drain'], name: '木屋前闸', hint: '进入战后下层暗道，击碎排水石壁' },
    ],
    objects: [
      { type: 'lever', id: 'cave-counterweight', x: 1740, y: 1120, name: '配重机关', notice: '竞技场前闸开启 · 井内升降台已接通' },
      { type: 'lift', x: 2600, lowY: 1120, highY: 590, width: 230, requires: ['cave-counterweight'], name: '配重室回程' },
      { type: 'bridge', x: 2600, y: 590, width: 430, requires: ['mini-quarry', 'cave-counterweight'] },
      { type: 'reward', x: 1380, y: -265, requires: ['mini-quarry'] },
      { type: 'reward', x: 1500, y: -265, requires: ['mini-quarry'] },
      { type: 'wall', id: 'cave-drain', x: 4630, y: 1120, height: 530, name: '排水石壁' },
      { type: 'lift', x: 4790, lowY: 1120, highY: 590, width: 160, requires: ['cave-drain'], name: '木屋回程' },
      { type: 'beacon', x: 2350, y: 590, text: '岔路：上层矿廊可挑战守卫；下层配重室是主路' },
      { type: 'beacon', x: 2830, y: 590, text: '前方杀人兔 · 失败仍从 Boss 战前复活' },
      { type: 'beacon', x: 4420, y: 590, text: '木屋前闸封闭 · 下井，击碎石壁后乘升降台返回' },
      { type: 'beacon', x: 4940, y: 1120, text: '暗道通向木屋 · 从左侧升降台回到地面' },
    ],
    minis: [{ id: 'mini-quarry', name: '裂岩监工', type: 'heavy', x: 1840, floorY: -210, left: 1260, right: 2710,
      entry: { x: 2600, y: -285 }, hp: 205, speed: 105, range: 190, damage: 19, cooldown: 1800,
      hint: '可选挑战 · 胜利获得补给并放下交汇井捷径桥', required: false, needsWave: true, attacks: [
        { name: '横扫 · 绕到背后', warning: 680, activeMs: 160, recoveryMs: 420, lunge: 100, range: 215, damage: 17 },
        { name: '裂地重锤 · 二段跳', warning: 1000, activeMs: 180, recoveryMs: 650, range: 330, damage: 25, knockdown: true },
      ] }],
  },
  3: {
    top: -1010, bottom: 1500,
    floors: [floor(0, 3340), floor(3700, 6100), floor(2380, 4520, 1130)],
    platforms: steps([[2510, 450], [2800, 290], [2510, 130], [2800, -30], [3060, -190], [3800, -350, 1320]]),
    rooms: [room('entry', '基地入口', 0, 0, 900, 720), room('bears', '草莓熊防线', 900, 0, 1450, 720),
      room('hub', '双回路中枢', 2370, 0, 2250, 720), room('upper-power', '上层冷却回路', 2410, -1010, 2090, 1010),
      room('lower-power', '下层动力回路', 2370, 720, 2150, 620), room('doctor', '博士机甲室', 4760, 0, 1280, 720)],
    links: [['entry', 'bears'], ['bears', 'hub'], ['hub', 'upper-power'], ['hub', 'lower-power'], ['hub', 'doctor']],
    requirements: { boss: ['base-north', 'base-south'] }, preBossFlags: ['base-north', 'base-south', 'mini-core'],
    seals: [{ id: 'base-seal', x: 4660, requires: ['base-north', 'base-south'], name: '双回路主闸', hint: '上层冷却 + 下层动力，两处电源都接通才能前进' }],
    objects: [
      { type: 'power', id: 'base-north', x: 4170, y: -350, name: '上层冷却电源', notice: '上层冷却接通 · 东侧升降捷径开启' },
      { type: 'power', id: 'base-south', x: 2670, y: 1130, requires: ['mini-core'], name: '下层动力电源', notice: '下层动力接通 · 返回中枢检查主闸' },
      { type: 'lift', x: 4260, lowY: 590, highY: -350, width: 220, requires: ['base-north'], name: '上层回环' },
      { type: 'lift', x: 3510, lowY: 1130, highY: 590, width: 230, requires: ['base-south'], name: '下层回环' },
      { type: 'beacon', x: 2440, y: 590, noHeal: true, text: '可自行选择顺序：二段跳上行，或从右侧井口下行' },
      { type: 'beacon', x: 3860, y: -350, text: '上层冷却电源就在右侧 · 攻击启动' },
      { type: 'beacon', x: 3510, y: 1130, noHeal: true, text: '下层电源在左侧 · 莓核巡卫正在把守' },
      { type: 'beacon', x: 4500, y: 590, text: '两条回路接通后进入机甲室' },
      { type: 'beacon', x: 4880, y: 590, noHeal: true, text: '机甲自爆时退回左侧灯标附近' },
    ],
    minis: [{ id: 'mini-core', name: '莓核巡卫', type: 'berryFlying', x: 2870, floorY: 1130, left: 2400, right: 3280,
      entry: { x: 3200, y: 1055 }, hp: 210, speed: 125, range: 440, damage: 14, cooldown: 1550,
      hint: '空中三连弹 / 扇形弹 · 落地休息 4 秒时反击', required: true, needsWave: true, attacks: [
        { name: '三线瞄准', warning: 780, activeMs: 140, recoveryMs: 380, range: 520, damage: 14, volley: [-0.14, 0, 0.14], speed: 355 },
        { name: '扇形弹幕', warning: 1000, activeMs: 180, recoveryMs: 480, range: 540, damage: 16, volley: [-0.32, 0, 0.32], speed: 300 },
      ] }],
  },
};

export function hasRouteFlags(flags, required = []) { return required.every(id => flags.has(id)); }
export function atGroundTrigger(player, x, floorY = 590, radius = 150) {
  return player.x >= x && Math.abs(player.y + 75 - floorY) <= radius;
}
