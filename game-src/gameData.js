export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GROUND_Y = 590;

export const HEROES = {
  a: {
    name: '小宇',
    title: '奇瑞队长',
    texture: 'hero-a-actions',
    portrait: './assets/portraits/player-a.png',
    maxHp: 120,
    speed: 325,
    attack: 18,
    skill: '回旋飞盾',
  },
  b: {
    name: '阿鼎',
    title: '上海交通骑士',
    texture: 'hero-b-actions',
    portrait: './assets/portraits/player-b.png',
    maxHp: 105,
    speed: 370,
    attack: 15,
    skill: '交大冲锋',
  },
};

export const POSE = {
  idle: 0,
  run: 1,
  jump: 2,
  attack: 3,
  skill: 4,
  guard: 5,
  dodge: 6,
  hurt: 7,
};

export const MAPS = [
  {
    id: 1,
    title: '秦岭山道',
    subtitle: '教学区 · 清除两批伏兵',
    background: 'stage-1',
    width: 4600,
    exitX: 4420,
    introX: 240,
    waveZone: {
      left: 1260,
      right: 2700,
      trigger: 1340,
      waves: [
        [
          { type: 'shield', x: 1740 },
          { type: 'shield', x: 2070 },
        ],
        [
          { type: 'shield', x: 1660 },
          { type: 'ranged', x: 2110 },
          { type: 'heavy', x: 2420 },
        ],
      ],
    },
    terrain: [
      { type: 'crate', x: 700 },
      { type: 'platform', x: 950, y: 465, width: 320 },
      { type: 'rock', x: 3000, warningX: 3040 },
      { type: 'crate', x: 3420 },
      { type: 'platform', x: 3670, y: 445, width: 360 },
    ],
  },
  {
    id: 2,
    title: '国轩之窟 · 外环',
    subtitle: '佣兵封锁 · 秦岭杀人兔',
    background: 'stage-2',
    width: 6500,
    exitX: 6310,
    introX: 220,
    waveZone: {
      left: 820,
      right: 2260,
      trigger: 910,
      waves: [
        [
          { type: 'shield', x: 1320 },
          { type: 'ranged', x: 1780 },
        ],
        [
          { type: 'heavy', x: 1280 },
          { type: 'shield', x: 1710 },
          { type: 'ranged', x: 2070 },
        ],
      ],
    },
    bossZone: { left: 2960, right: 4240, trigger: 3070, boss: 'c' },
    cabin: { left: 5230, doorIn: 5440, doorOut: 6220 },
    terrain: [
      { type: 'crate', x: 520 },
      { type: 'platform', x: 2470, y: 455, width: 330 },
      { type: 'rock', x: 2630, warningX: 2670 },
      { type: 'crate', x: 4850 },
    ],
  },
  {
    id: 3,
    title: '草莓熊基地',
    subtitle: '立体弹幕战 · 最终营救',
    background: 'stage-3',
    width: 6100,
    exitX: 6000,
    introX: 260,
    waveZone: {
      left: 900,
      right: 2350,
      trigger: 990,
      waves: [
        [
          { type: 'berryGround', x: 1420 },
          { type: 'berryGround', x: 1900 },
        ],
        [
          { type: 'berryFlying', x: 1420, y: 360 },
          { type: 'berryGround', x: 1770 },
          { type: 'berryFlying', x: 2120, y: 295 },
        ],
        [
          { type: 'berryGround', x: 1290 },
          { type: 'berryFlying', x: 1640, y: 330 },
          { type: 'berryGround', x: 1960 },
          { type: 'berryFlying', x: 2190, y: 255 },
        ],
      ],
    },
    bossZone: { left: 4760, right: 6040, trigger: 4850, boss: 'd' },
    terrain: [
      { type: 'crate', x: 510 },
      { type: 'platform', x: 2520, y: 455, width: 360 },
      { type: 'rock', x: 2950, warningX: 2990 },
      { type: 'platform', x: 5060, y: 410, width: 440, bossPlatform: true },
      { type: 'platform', x: 5320, y: 286, width: 420, bossPlatform: true },
    ],
  },
];

export const DIALOGUES = {
  prologue: [
    { speaker: '旁白', text: '小马国的黄昏，被一道不属于这里的粉色裂隙撕开。', portrait: 'princess' },
    { speaker: '小马公主', text: '谁在那里？卫兵——！', portrait: 'princess' },
    { speaker: '草莓熊博士', text: '国轩之窟正缺最后一位贵客。', portrait: 'boss-d' },
    { speaker: '{hero}', text: '等着我。无论洞窟里有什么，我都会把你带回来。', portrait: 'hero' },
  ],
  c_enter: [
    { speaker: '旁白', text: '洞窟铁门轰然落下，粉色刀光挡住了前路。', portrait: 'boss-c' },
    { speaker: '秦岭杀人兔', text: '{hero}，我草泥马，今天你别想走！', portrait: 'boss-c' },
    { speaker: '{hero}', text: '让开。公主不该成为你们的筹码。', portrait: 'hero' },
  ],
  c_first_hurt: [
    { speaker: '秦岭杀人兔', text: '妈的……你还真敢打？', portrait: 'boss-c' },
    { speaker: '{hero}', text: '挡路的人，我当然敢打。', portrait: 'hero' },
    { speaker: '旁白', text: '杀人兔压低重心，刀锋的节奏陡然加快。', portrait: 'boss-c' },
  ],
  c_phase: [
    { speaker: '秦岭杀人兔', text: '行，逼我是吧？', portrait: 'boss-c' },
    { speaker: '旁白', text: '他放下短刀，从腰侧拔出了手枪。', portrait: 'boss-c' },
    { speaker: '{hero}', text: '枪口会先亮，盯住预警再躲！', portrait: 'hero' },
  ],
  c_defeated: [
    { speaker: '秦岭杀人兔', text: '再感麦，老子先走了。', portrait: 'boss-c' },
    { speaker: '旁白', text: '铁门重新升起，更深处传来机器的轰鸣。', portrait: 'boss-c' },
    { speaker: '{hero}', text: '还没结束。我要亲自走到那间木屋看看。', portrait: 'hero' },
  ],
  merchant: [
    { speaker: '神秘商人', text: '你居然还活着。', portrait: 'merchant' },
    { speaker: '神秘商人', text: '前面就是草莓熊博士的地盘。', portrait: 'merchant' },
    { speaker: '神秘商人', text: '拿一样东西再走吧。', portrait: 'merchant' },
  ],
  d_enter: [
    { speaker: '旁白', text: '基地最深处，巨大的草莓机甲封住整面右墙。', portrait: 'boss-d' },
    { speaker: '草莓熊博士', text: '终于来了，小马公主就在我手里，有本事自己来拿。', portrait: 'boss-d' },
    { speaker: '{hero}', text: '我已经走到这里。现在，把公主放下。', portrait: 'hero' },
  ],
  d_first_hurt: [
    { speaker: '草莓熊博士', text: '嗯？这玩意居然能伤到我的机甲？', portrait: 'boss-d' },
    { speaker: '{hero}', text: '装甲再厚，也挡不住连续命中。', portrait: 'hero' },
    { speaker: '旁白', text: '机甲的警示灯由黄转红，炮口开始重新校准。', portrait: 'boss-d' },
  ],
  d_phase: [
    { speaker: '草莓熊博士', text: '草莓熊，超载模式！', portrait: 'boss-d' },
    { speaker: '旁白', text: '上下平台同时亮起，三种高度的炮口锁定战场。', portrait: 'boss-d' },
    { speaker: '{hero}', text: '看清空隙。高低切换，别停在同一层！', portrait: 'hero' },
  ],
  d_defeated: [
    { speaker: '草莓熊博士', text: '不可能……我的草莓熊……', portrait: 'boss-d' },
    { speaker: '小马公主', text: '我就知道你们会找到这里。', portrait: 'princess' },
    { speaker: '{hero}', text: '回家吧。宝马之路，到这里才算走完。', portrait: 'hero' },
  ],
};
