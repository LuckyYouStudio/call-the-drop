// The Shattered Crown — an original dark-fantasy world. Dungeons and bosses are written by hand;
// every item (name, stats, drop rate) is generated from a fixed seed, so the world is the same on
// every load and nothing is borrowed from another game.

export type Lang = 'en' | 'zh';
export type Text = { en: string; zh: string };

export type Archetype =
  | 'beast' | 'undead' | 'cultist' | 'brute' | 'golem' | 'elemental' | 'aberration' | 'dragon' | 'spectre' | 'knight' | 'hag';

export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate';
export type WeaponType = 'sword' | 'axe' | 'mace' | 'dagger' | 'staff' | 'bow' | 'wand';
export type Slot =
  | 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'wrist' | 'hands' | 'waist' | 'legs' | 'feet'
  | 'finger' | 'trinket' | 'oneHand' | 'twoHand' | 'shield' | 'orb';
export type StatKey = 'str' | 'agi' | 'int' | 'sta' | 'wil' | 'armor' | 'dps' | 'ap' | 'sp' | 'crit' | 'haste';
export type Stats = Partial<Record<StatKey, number>>;

export type Item = {
  id: number;
  name: Text;
  quality: 2 | 3 | 4 | 5;
  slot: Slot;
  armor?: ArmorType;
  weapon?: WeaponType;
  ilvl: number;
  req: number;
  stats: Stats;
  damage?: [number, number];
  speed?: number;
  flavor?: Text;
  /** Drawing inputs for the icon. */
  hue: number;
  seed: number;
};

export type Loot = { item: Item; pct: number; weight: number };

export type Boss = {
  id: number;
  name: Text;
  title: Text;
  archetype: Archetype;
  /** Main colour of the portrait. */
  hue: number;
  level: number;
  loot: Loot[];
  dungeon: Dungeon;
};

export type Dungeon = {
  key: string;
  name: Text;
  blurb: Text;
  min: number;
  max: number;
  raid?: boolean;
  tier: number;
  /** Words that flavour this dungeon's epic loot. */
  theme: Text[];
  bosses: Boss[];
};

export const MAX_LEVEL = 30;

// ------------------------------------------------------------------ hand-written world

type BossDef = [en: string, zh: string, titleEn: string, titleZh: string, archetype: Archetype, hue: number];
type DungeonDef = {
  key: string; en: string; zh: string; blurbEn: string; blurbZh: string;
  min: number; max: number; raid?: boolean; theme: Array<[string, string]>; bosses: BossDef[];
};

const WORLD: DungeonDef[] = [
  {
    key: 'cellars', en: 'The Rattling Cellars', zh: '窸窣地窖', min: 1, max: 5,
    blurbEn: 'Rats, rot and something older beneath the inn.', blurbZh: '旅店地下，老鼠、腐烂，和更古老的东西。',
    theme: [['Cellar', '地窖'], ['Rat-gnawed', '鼠啮'], ['Mildew', '霉斑']],
    bosses: [
      ['Gnawbone', '啃骨者', 'the Rat King', '鼠王', 'beast', 30],
      ['Old Mother Mold', '霉母老妪', 'Keeper of Spores', '孢子看守', 'hag', 95],
      ['Sexton Crane', '司事克雷恩', 'Who Buried the Wrong Man', '埋错了人的人', 'undead', 200],
    ],
  },
  {
    key: 'chapel', en: 'The Drowned Chapel', zh: '沉没礼拜堂', min: 4, max: 9,
    blurbEn: 'The tide took the village. The choir kept singing.', blurbZh: '潮水吞没了村庄，唱诗班却没停下。',
    theme: [['Tidewashed', '潮蚀'], ['Choir', '圣咏'], ['Brine', '盐渍']],
    bosses: [
      ['Tidecaller Maren', '唤潮者玛伦', 'of the Sunken Hymn', '沉没圣歌', 'cultist', 190],
      ['The Bloated Abbot', '肿胀修道院长', 'Last to Drown', '最后溺亡者', 'undead', 150],
      ['Choirmaw', '颂喉', 'Voice of the Deep', '深渊之声', 'aberration', 175],
    ],
  },
  {
    key: 'woods', en: 'Hollowpine Woods', zh: '空心松林', min: 8, max: 13,
    blurbEn: 'Every tree is hollow. Something lives in all of them.', blurbZh: '每一棵树都是空的，每一棵里都住着东西。',
    theme: [['Hollowpine', '空松'], ['Briar', '荆丛'], ['Wildwood', '野林']],
    bosses: [
      ['Thornback Matriarch', '棘背母兽', 'Mother of the Den', '兽穴之母', 'beast', 100],
      ['Nine-Knot Nell', '九结奈尔', 'Witch of the Crossroads', '十字路口的女巫', 'hag', 280],
      ['Rootwyrm', '根龙', 'Beneath the Oldest Pine', '最老松树下', 'dragon', 80],
    ],
  },
  {
    key: 'mines', en: 'The Cinder Mines', zh: '余烬矿坑', min: 12, max: 17,
    blurbEn: 'They dug too deep and found a furnace that was already lit.', blurbZh: '他们挖得太深，发现一座早已点燃的熔炉。',
    theme: [['Slagforged', '熔渣锻'], ['Cinder', '余烬'], ['Deepvein', '深脉']],
    bosses: [
      ['Foreman Grax', '工头格拉克斯', 'Whip of the Pits', '矿坑之鞭', 'brute', 20],
      ['The Slag Colossus', '熔渣巨像', 'Born of Tailings', '尾矿所生', 'golem', 25],
      ['Kiln Mother', '窑母', 'Heart of the Furnace', '熔炉之心', 'elemental', 15],
    ],
  },
  {
    key: 'barrow', en: 'The Silent Barrow', zh: '寂静古冢', min: 16, max: 21,
    blurbEn: 'A king was buried with his hounds and his grudges.', blurbZh: '一位国王与他的猎犬和怨恨一同下葬。',
    theme: [['Barrow', '古冢'], ['Gravewatch', '守墓'], ['Hushed', '寂声']],
    bosses: [
      ['Vesk', '维斯克', 'the Grave Hound', '墓犬', 'beast', 220],
      ['The Lantern Widow', '提灯寡妇', 'Who Waits', '守候之人', 'spectre', 55],
      ['Barrow King Oswin', '古冢之王奥斯温', 'the Unforgiving', '不宽恕者', 'undead', 210],
    ],
  },
  {
    key: 'spire', en: 'The Glass Spire', zh: '琉璃尖塔', min: 20, max: 25,
    blurbEn: 'A wizard’s tower where every window shows a different year.', blurbZh: '法师之塔，每扇窗都映出不同的年份。',
    theme: [['Prismatic', '棱光'], ['Glasswoven', '琉璃织'], ['Starlit', '星辉']],
    bosses: [
      ['Archivist Pell', '档案官佩尔', 'Keeper of Unwritten Books', '未写之书的看守', 'cultist', 250],
      ['The Mirror Knight', '镜之骑士', 'Your Reflection, Armed', '持剑的倒影', 'knight', 185],
      ['Prism Eye', '棱镜之眼', 'That Sees All Colours', '洞见万色者', 'aberration', 300],
    ],
  },
  {
    key: 'fen', en: 'Blightfen', zh: '疫病腐沼', min: 24, max: 29,
    blurbEn: 'The marsh breathes, and its breath is plague.', blurbZh: '沼泽在呼吸，呼出的是瘟疫。',
    theme: [['Blightfen', '腐沼'], ['Mirebound', '泥缚'], ['Plaguewoven', '疫织']],
    bosses: [
      ['Mirehag Olga', '泥沼妖婆奥尔加', 'Brewer of Sorrows', '悲伤酿造者', 'hag', 110],
      ['Plaguefather Rusk', '疫父拉斯克', 'Shepherd of Flies', '蝇群牧者', 'cultist', 70],
      ['The Fen Hydra', '腐沼九头蛇', 'Many-Throated', '千喉者', 'dragon', 120],
    ],
  },
  {
    key: 'keep', en: 'Frostfang Keep', zh: '霜牙要塞', min: 28, max: 30,
    blurbEn: 'The last fortress before the ice, held by those too stubborn to die.', blurbZh: '冰原前最后的要塞，由倔强到不肯死去的人守着。',
    theme: [['Frostfang', '霜牙'], ['Rimecrest', '霜冠'], ['Wintersworn', '凛冬誓约']],
    bosses: [
      ['Jarl Hrimgar', '领主赫里姆加', 'the Unthawed', '永不解冻者', 'brute', 200],
      ['The Icewrought Colossus', '冰铸巨像', 'Guardian of the Gate', '城门守卫', 'golem', 195],
      ['Queen Sveva the Pale', '苍白女王斯薇娃', 'Crowned in Frost', '以霜为冠', 'undead', 190],
    ],
  },
  {
    key: 'throne', en: 'Throne of Embers', zh: '余烬王座', min: 30, max: 30, raid: true,
    blurbEn: 'A fallen fire-king rules a court of ash. Raid.', blurbZh: '陨落的火焰之王统治着灰烬宫廷。团队副本。',
    theme: [['Kingflame', '王焰'], ['Emberthrone', '烬座'], ['Ashen Court', '灰烬宫廷']],
    bosses: [
      ['The Ashen Seneschal', '灰烬总管', 'Voice of the Throne', '王座之声', 'knight', 25],
      ['Magmaw', '熔喉', 'the Everhungry', '永饥者', 'beast', 10],
      ['The Twin Cinders', '双生余烬', 'Burning in Unison', '同焰共燃', 'elemental', 40],
      ['King Ignarr', '伊格纳尔王', 'the Unburnt', '不焚者', 'elemental', 18],
    ],
  },
  {
    key: 'maw', en: 'Maw of the Starless Deep', zh: '无星深渊之喉', min: 30, max: 30, raid: true,
    blurbEn: 'Below the world, a hunger older than stars. Raid.', blurbZh: '世界之下，是比群星更古老的饥饿。团队副本。',
    theme: [['Starless', '无星'], ['Voidtouched', '虚触'], ['Abyssal', '深渊']],
    bosses: [
      ['The Void Herald', '虚空先驱', 'First to Kneel', '最先跪下者', 'cultist', 270],
      ['The Many-Eyed', '千目者', 'Watcher Between Worlds', '界间守望者', 'aberration', 285],
      ['Nyxara', '妮克萨拉', 'Devourer of Light', '吞光者', 'dragon', 265],
    ],
  },
];

/** Hand-named legendaries, dropped (rarely) by the last boss of each raid and the final dungeon. */
const LEGENDARIES: Record<string, Array<{ slot: Slot; weapon?: WeaponType; armor?: ArmorType; aff: 'str' | 'agi' | 'int'; en: string; zh: string; flavorEn: string; flavorZh: string }>> = {
  keep: [
    { slot: 'twoHand', weapon: 'axe', aff: 'str', en: 'Hrimgar’s Last Oath', zh: '赫里姆加的最后誓言', flavorEn: 'He swore he would not fall. He did not say he would not die.', flavorZh: '他发誓不会倒下，却没说自己不会死。' },
  ],
  throne: [
    { slot: 'oneHand', weapon: 'sword', aff: 'str', en: 'Emberheart, the Unburnt Blade', zh: '烬心·不焚之刃', flavorEn: 'Still warm from a fire that went out a thousand years ago.', flavorZh: '一千年前熄灭的火，余温至今未散。' },
    { slot: 'twoHand', weapon: 'staff', aff: 'int', en: 'Scepter of the Ashen Crown', zh: '灰烬王冠之杖', flavorEn: 'Whoever holds it is king of whatever is left.', flavorZh: '握着它的人，便是残余一切的王。' },
  ],
  maw: [
    { slot: 'twoHand', weapon: 'bow', aff: 'agi', en: 'Starfall, Bow of the Deep', zh: '坠星·深渊之弓', flavorEn: 'Every arrow is a star that forgot how to shine.', flavorZh: '每一支箭，都是一颗忘了如何发光的星。' },
    { slot: 'back', armor: 'cloth', aff: 'int', en: 'Veil of the Devourer', zh: '吞噬者之纱', flavorEn: 'Light goes in. Nothing comes out.', flavorZh: '光落进去，什么也不会出来。' },
    { slot: 'oneHand', weapon: 'dagger', aff: 'agi', en: 'Nyxara’s Fang', zh: '妮克萨拉之牙', flavorEn: 'Pried from the dark itself.', flavorZh: '从黑暗本身撬下来的。' },
  ],
};

// ------------------------------------------------------------------ generator

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

type Base = { slot: Slot; armor?: ArmorType; weapon?: WeaponType; names: Array<[string, string]> };

const ARMOR_SLOTS: Array<[Slot, Record<ArmorType, Array<[string, string]>>]> = [
  ['head', { plate: [['Greathelm', '巨盔'], ['Helm', '头盔']], mail: [['Coif', '链甲头罩'], ['Warhelm', '战盔']], leather: [['Cowl', '皮兜帽'], ['Mask', '面具']], cloth: [['Hood', '兜帽'], ['Circlet', '头环']] }],
  ['shoulder', { plate: [['Pauldrons', '肩铠']], mail: [['Spaulders', '护肩']], leather: [['Shoulderguards', '肩垫']], cloth: [['Mantle', '披肩']] }],
  ['chest', { plate: [['Breastplate', '胸铠']], mail: [['Hauberk', '锁子甲']], leather: [['Jerkin', '皮外衣'], ['Tunic', '短衫']], cloth: [['Robe', '长袍'], ['Vestments', '法衣']] }],
  ['wrist', { plate: [['Vambraces', '臂铠']], mail: [['Bracers', '护腕']], leather: [['Armguards', '护臂']], cloth: [['Cuffs', '袖口']] }],
  ['hands', { plate: [['Gauntlets', '铁手套']], mail: [['Grips', '握手']], leather: [['Gloves', '手套']], cloth: [['Handwraps', '缠手']] }],
  ['waist', { plate: [['Girdle', '腰铠']], mail: [['Belt', '腰带']], leather: [['Strap', '皮束带']], cloth: [['Sash', '饰带'], ['Cord', '绳带']] }],
  ['legs', { plate: [['Legplates', '腿铠']], mail: [['Leggings', '护腿']], leather: [['Breeches', '马裤']], cloth: [['Trousers', '长裤']] }],
  ['feet', { plate: [['Sabatons', '铁靴']], mail: [['Greaves', '战靴']], leather: [['Boots', '皮靴']], cloth: [['Slippers', '便鞋']] }],
];

const OTHER_BASES: Base[] = [
  { slot: 'back', names: [['Cloak', '斗篷'], ['Cape', '披风'], ['Shroud', '裹布']] },
  { slot: 'neck', names: [['Amulet', '护符'], ['Pendant', '吊坠'], ['Choker', '项圈']] },
  { slot: 'finger', names: [['Ring', '指环'], ['Band', '戒指'], ['Signet', '印戒']] },
  { slot: 'trinket', names: [['Idol', '神像'], ['Charm', '护身符'], ['Talisman', '符咒']] },
  { slot: 'oneHand', weapon: 'sword', names: [['Sword', '剑'], ['Blade', '刃']] },
  { slot: 'oneHand', weapon: 'axe', names: [['Hatchet', '手斧'], ['Cleaver', '劈刀']] },
  { slot: 'oneHand', weapon: 'mace', names: [['Mace', '锤'], ['Scepter', '权杖']] },
  { slot: 'oneHand', weapon: 'dagger', names: [['Dagger', '匕首'], ['Dirk', '短剑']] },
  { slot: 'oneHand', weapon: 'wand', names: [['Wand', '魔杖'], ['Rod', '法棒']] },
  { slot: 'twoHand', weapon: 'sword', names: [['Greatsword', '巨剑']] },
  { slot: 'twoHand', weapon: 'axe', names: [['Greataxe', '巨斧']] },
  { slot: 'twoHand', weapon: 'mace', names: [['Maul', '重锤']] },
  { slot: 'twoHand', weapon: 'staff', names: [['Staff', '法杖'], ['Stave', '长杖']] },
  { slot: 'twoHand', weapon: 'bow', names: [['Longbow', '长弓'], ['Recurve', '反曲弓']] },
  { slot: 'shield', names: [['Shield', '盾'], ['Bulwark', '壁垒盾']] },
  { slot: 'orb', names: [['Orb', '宝珠'], ['Tome', '法典']] },
];

const GREEN_ROLES: Array<[string, string]> = [
  ['Scout’s', '斥候的'], ['Pilgrim’s', '朝圣者的'], ['Militia', '民兵'], ['Hunter’s', '猎手的'], ['Acolyte’s', '侍僧的'], ['Sellsword’s', '佣兵的'], ['Watchman’s', '守夜人的'], ['Apprentice’s', '学徒的'],
];
const BLUE_ADJ: Array<[string, string]> = [
  ['Duskwoven', '暮织'], ['Ironbound', '铁缚'], ['Stormforged', '风暴锻'], ['Bloodstained', '血染'], ['Hollowed', '空心'], ['Moonveil', '月纱'],
  ['Thornwrought', '荆棘'], ['Wraithbone', '幽骨'], ['Oathbound', '誓约'], ['Nightstalker’s', '夜行者'], ['Runed', '符文'], ['Gloomward', '幽障'],
];
const SUFFIX: Array<[string, string]> = [
  ['of Embers', '·余烬'], ['of the Tide', '·潮汐'], ['of Ruin', '·毁灭'], ['of Vigil', '·守夜'], ['of Echoes', '·回响'], ['of the Wolf', '·狼群'],
];

const QUALITY_MULT: Record<2 | 3 | 4 | 5, number> = { 2: 0.9, 3: 1.1, 4: 1.38, 5: 1.75 };
const SLOT_MULT: Record<Slot, number> = {
  head: 1, chest: 1, legs: 1, shoulder: 0.78, hands: 0.75, feet: 0.75, waist: 0.72, wrist: 0.56,
  back: 0.56, neck: 0.56, finger: 0.56, trinket: 0.62, oneHand: 0.6, twoHand: 1.25, shield: 0.56, orb: 0.56,
};
const ARMOR_BASE: Record<ArmorType, number> = { cloth: 0.9, leather: 1.8, mail: 3.6, plate: 6.4 };

function affinityFor(base: Base, armor: ArmorType | undefined, r: () => number): 'str' | 'agi' | 'int' {
  if (armor === 'plate') return 'str';
  if (armor === 'leather') return 'agi';
  if (armor === 'cloth') return 'int';
  if (armor === 'mail') return r() < 0.5 ? 'agi' : 'int';
  switch (base.weapon) {
    case 'dagger': case 'bow': return 'agi';
    case 'staff': case 'wand': return 'int';
    case 'sword': case 'axe': return r() < 0.7 ? 'str' : 'agi';
    case 'mace': return r() < 0.6 ? 'str' : 'int';
  }
  if (base.slot === 'orb') return 'int';
  if (base.slot === 'shield') return r() < 0.7 ? 'str' : 'int';
  return pick(r, ['str', 'agi', 'int'] as const);
}

function makeStats(slot: Slot, armor: ArmorType | undefined, weapon: WeaponType | undefined, aff: 'str' | 'agi' | 'int', ilvl: number, quality: 2 | 3 | 4 | 5, r: () => number) {
  const budget = ilvl * QUALITY_MULT[quality] * SLOT_MULT[slot] * 0.9;
  const stats: Stats = {};
  const round = (v: number) => Math.max(1, Math.round(v));
  stats[aff] = round(budget * between(r, 0.36, 0.48));
  stats.sta = round(budget * between(r, 0.24, 0.34));
  const rest = budget * 0.3;
  if (aff === 'int') {
    if (r() < 0.6) stats.sp = round(rest * 0.9);
    if (r() < 0.5) stats.wil = round(rest * 0.5);
  } else if (r() < 0.6) {
    stats.ap = round(rest * 1.4);
  }
  if (quality >= 3 && r() < 0.45) stats.crit = Math.max(1, Math.round(ilvl / 30));
  if (quality >= 4 && r() < 0.4) stats.haste = Math.max(1, Math.round(ilvl / 35));
  if (armor) stats.armor = Math.round(ilvl * ARMOR_BASE[armor] * SLOT_MULT[slot] * (0.85 + quality * 0.08));
  if (slot === 'shield') stats.armor = Math.round(ilvl * 9 * (0.85 + quality * 0.08));
  let damage: [number, number] | undefined;
  let speed: number | undefined;
  if (weapon) {
    const two = slot === 'twoHand';
    const dps = (2 + ilvl * 0.62) * (two ? 1.38 : 1) * (0.9 + quality * 0.06);
    speed = weapon === 'wand' ? 1.5 : Math.round(between(r, two ? 3.0 : 1.7, two ? 3.7 : 2.7) * 10) / 10;
    damage = [Math.round(dps * speed * 0.72), Math.round(dps * speed * 1.28)];
    stats.dps = Math.round(dps * 10) / 10;
  }
  return { stats, damage, speed };
}

let nextId = 1;

function makeItem(d: DungeonDef, tier: number, boss: number, k: number, quality: 2 | 3 | 4 | 5, r: () => number, forced?: Base & { armor?: ArmorType }): Item {
  let base: Base;
  let armor: ArmorType | undefined;
  if (forced) {
    base = forced;
    armor = forced.armor;
  } else if (r() < 0.55) {
    const [slot, byType] = pick(r, ARMOR_SLOTS);
    armor = pick(r, ['cloth', 'leather', 'mail', 'plate'] as const);
    base = { slot, armor, names: byType[armor] };
  } else {
    base = pick(r, OTHER_BASES);
    if (base.slot === 'back') armor = 'cloth';
  }
  const [nounEn, nounZh] = pick(r, base.names);
  let en: string;
  let zh: string;
  if (quality === 2) {
    const [a, b] = pick(r, GREEN_ROLES);
    en = `${a} ${nounEn}`;
    zh = `${b}${nounZh}`;
  } else if (quality === 3) {
    const [a, b] = pick(r, BLUE_ADJ);
    en = `${a} ${nounEn}`;
    zh = `${b}${nounZh}`;
    if (r() < 0.35) {
      const [s, sz] = pick(r, SUFFIX);
      en += ` ${s}`;
      zh += sz;
    }
  } else {
    const [a, b] = pick(r, d.theme);
    en = `${a} ${nounEn}`;
    zh = `${b}${nounZh}`;
  }
  const bossBump = (boss / Math.max(1, d.bosses.length - 1)) * 3;
  const ilvl = Math.round(6 + tier * 7 + bossBump + (quality - 2) * 3 + (d.raid ? 6 : 0));
  const req = Math.max(1, Math.min(MAX_LEVEL, d.min + Math.floor(bossBump / 2)));
  const aff = affinityFor(base, armor, r);
  const { stats, damage, speed } = makeStats(base.slot, armor, base.weapon, aff, ilvl, quality, r);
  return {
    id: nextId++,
    name: { en, zh },
    quality,
    slot: base.slot,
    armor,
    weapon: base.weapon,
    ilvl,
    req,
    stats,
    damage,
    speed,
    hue: Math.floor(r() * 360),
    seed: Math.floor(r() * 1e9),
  };
}

function build(): Dungeon[] {
  return WORLD.map((d, di) => {
    const tier = di + 1;
    const dungeon: Dungeon = {
      key: d.key,
      name: { en: d.en, zh: d.zh },
      blurb: { en: d.blurbEn, zh: d.blurbZh },
      min: d.min, max: d.max, raid: d.raid, tier,
      theme: d.theme.map(([en, zh]) => ({ en, zh })),
      bosses: [],
    };
    dungeon.bosses = d.bosses.map(([en, zh, titleEn, titleZh, archetype, hue], bi) => {
      const r = rng(1000 * tier + bi * 37 + 11);
      const last = bi === d.bosses.length - 1;
      const count = d.raid ? 8 + Math.floor(r() * 4) : 4 + Math.floor(r() * 3) + (last ? 1 : 0);
      const loot: Loot[] = [];
      for (let k = 0; k < count; k++) {
        const roll = r();
        const quality: 2 | 3 | 4 =
          d.raid ? (roll < 0.12 ? 3 : 4)
          : tier <= 2 ? (roll < 0.6 ? 2 : 3)
          : tier <= 5 ? (roll < 0.3 ? 2 : roll < 0.9 ? 3 : 4)
          : (roll < 0.1 ? 2 : roll < 0.75 ? 3 : 4);
        const item = makeItem(d, tier, bi, k, quality, r);
        const pct = quality === 2 ? between(r, 14, 34) : quality === 3 ? between(r, 9, 26) : between(r, 6, 19);
        loot.push({ item, pct: Math.round(pct * 10) / 10, weight: 0 });
      }
      if (last && LEGENDARIES[d.key]) {
        for (const leg of LEGENDARIES[d.key]) {
          const item = makeItem(d, tier + 1, bi, 99, 5, r, { slot: leg.slot, weapon: leg.weapon, armor: leg.armor, names: [[leg.en, leg.zh]] });
          item.name = { en: leg.en, zh: leg.zh };
          item.flavor = { en: leg.flavorEn, zh: leg.flavorZh };
          // Legendary stats lean on the intended affinity.
          const { stats, damage, speed } = makeStats(leg.slot, leg.armor, leg.weapon, leg.aff, item.ilvl, 5, r);
          Object.assign(item, { stats, damage, speed });
          loot.push({ item, pct: Math.round(between(r, 1.2, 3.2) * 10) / 10, weight: 0 });
        }
      }
      loot.sort((a, b) => b.pct - a.pct);
      for (const l of loot) l.weight = Math.max(1, Math.round(l.pct * 100));
      return {
        id: tier * 100 + bi + 1,
        name: { en, zh },
        title: { en: titleEn, zh: titleZh },
        archetype, hue,
        level: Math.min(MAX_LEVEL + 3, d.max + (last ? 1 : 0) + (d.raid ? 2 : 0)),
        loot,
        dungeon,
      };
    });
    return dungeon;
  });
}

export const DUNGEONS: Dungeon[] = build();
export const ITEMS = new Map<number, Item>(DUNGEONS.flatMap(d => d.bosses.flatMap(b => b.loot.map(l => [l.item.id, l.item] as const))));

export function findBoss(id: number): Boss | undefined {
  for (const d of DUNGEONS) for (const b of d.bosses) if (b.id === id) return b;
  return undefined;
}
