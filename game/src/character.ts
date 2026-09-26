import { DUNGEONS, ITEMS, MAX_LEVEL, type ArmorType, type Dungeon, type Item, type Lang, type StatKey, type Text, type WeaponType } from './world';

export type ClassKey = 'warblade' | 'shadowblade' | 'ranger' | 'hexcaster' | 'lightbinder';

type ClassDef = {
  name: Text;
  role: Text;
  color: string;
  armor: ArmorType[];
  weapons: WeaponType[];
  dualWield: boolean;
  shield: boolean;
  orb: boolean;
  /** Value per point of each stat (percent stats per 1%). */
  weights: Partial<Record<StatKey, number>>;
};

export const CLASSES: Record<ClassKey, ClassDef> = {
  warblade: {
    name: { en: 'Warblade', zh: '战刃' }, role: { en: 'Strength · heavy armour', zh: '力量 · 重甲近战' }, color: '#d8a15e',
    armor: ['plate', 'mail', 'leather', 'cloth'], weapons: ['sword', 'axe', 'mace'], dualWield: true, shield: true, orb: false,
    weights: { str: 2, agi: 0.8, sta: 1.2, armor: 0.04, dps: 3, ap: 1, crit: 18, haste: 12 },
  },
  shadowblade: {
    name: { en: 'Shadowblade', zh: '影刃' }, role: { en: 'Agility · daggers', zh: '敏捷 · 双持刺客' }, color: '#e8d95a',
    armor: ['leather', 'cloth'], weapons: ['dagger', 'sword', 'mace'], dualWield: true, shield: false, orb: false,
    weights: { agi: 2, str: 0.6, sta: 1, armor: 0.02, dps: 3.5, ap: 1, crit: 20, haste: 14 },
  },
  ranger: {
    name: { en: 'Ranger', zh: '游侠' }, role: { en: 'Agility · bows', zh: '敏捷 · 弓箭' }, color: '#8fcf6a',
    armor: ['mail', 'leather', 'cloth'], weapons: ['bow', 'sword', 'axe', 'dagger'], dualWield: true, shield: false, orb: false,
    weights: { agi: 2, sta: 1, int: 0.3, armor: 0.02, dps: 3, ap: 1, crit: 20, haste: 12 },
  },
  hexcaster: {
    name: { en: 'Hexcaster', zh: '咒术师' }, role: { en: 'Intellect · spells', zh: '智力 · 法术输出' }, color: '#8f7cf0',
    armor: ['cloth'], weapons: ['staff', 'wand', 'dagger', 'sword'], dualWield: false, shield: false, orb: true,
    weights: { int: 1.3, wil: 0.4, sta: 1, sp: 1.2, dps: 0.4, crit: 13, haste: 12 },
  },
  lightbinder: {
    name: { en: 'Lightbinder', zh: '缚光者' }, role: { en: 'Intellect · healing', zh: '智力 · 治疗' }, color: '#f2e6c4',
    armor: ['mail', 'leather', 'cloth'], weapons: ['mace', 'staff'], dualWield: false, shield: true, orb: true,
    weights: { int: 1.1, wil: 1, sta: 1.1, sp: 1.1, str: 0.4, armor: 0.02, dps: 0.8, crit: 10, haste: 10 },
  },
};

export const CLASS_KEYS = Object.keys(CLASSES) as ClassKey[];

export type EquipSlot =
  | 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'wrist' | 'hands' | 'waist' | 'legs' | 'feet'
  | 'finger1' | 'finger2' | 'trinket1' | 'trinket2' | 'main' | 'off';

export const EQUIP_SLOTS: Array<{ key: EquipSlot; name: Text }> = [
  { key: 'head', name: { en: 'Head', zh: '头部' } }, { key: 'neck', name: { en: 'Neck', zh: '颈部' } },
  { key: 'shoulder', name: { en: 'Shoulder', zh: '肩部' } }, { key: 'back', name: { en: 'Back', zh: '背部' } },
  { key: 'chest', name: { en: 'Chest', zh: '胸部' } }, { key: 'wrist', name: { en: 'Wrist', zh: '手腕' } },
  { key: 'hands', name: { en: 'Hands', zh: '手' } }, { key: 'waist', name: { en: 'Waist', zh: '腰部' } },
  { key: 'legs', name: { en: 'Legs', zh: '腿部' } }, { key: 'feet', name: { en: 'Feet', zh: '脚' } },
  { key: 'finger1', name: { en: 'Finger', zh: '手指' } }, { key: 'finger2', name: { en: 'Finger', zh: '手指' } },
  { key: 'trinket1', name: { en: 'Trinket', zh: '饰品' } }, { key: 'trinket2', name: { en: 'Trinket', zh: '饰品' } },
  { key: 'main', name: { en: 'Main hand', zh: '主手' } }, { key: 'off', name: { en: 'Off hand', zh: '副手' } },
];

export const XP_PER_LEVEL = 100;

export type Character = {
  id: string;
  name: string;
  cls: ClassKey;
  level: number;
  xp: number;
  /** Item ids won and not equipped. */
  bag: number[];
  equipped: Partial<Record<EquipSlot, number>>;
  /** Fights per boss, for the journal. */
  kills: Record<number, number>;
  created: number;
};

export function newCharacter(name: string, cls: ClassKey): Character {
  return { id: Math.random().toString(36).slice(2, 10), name, cls, level: 1, xp: 0, bag: [], equipped: {}, kills: {}, created: Date.now() };
}

export function slotsFor(item: Item, c?: Pick<Character, 'cls'>): EquipSlot[] {
  const dual = c ? CLASSES[c.cls].dualWield : true;
  switch (item.slot) {
    case 'finger': return ['finger1', 'finger2'];
    case 'trinket': return ['trinket1', 'trinket2'];
    case 'oneHand': return item.weapon === 'wand' || !dual ? ['main'] : ['main', 'off'];
    case 'twoHand': return ['main'];
    case 'shield': case 'orb': return ['off'];
    default: return [item.slot];
  }
}

/** Whether the class can use the item at all (level aside). */
export function usableByClass(c: Pick<Character, 'cls'>, item: Item): boolean {
  const cls = CLASSES[c.cls];
  if (item.armor && item.slot !== 'back' && !cls.armor.includes(item.armor)) return false;
  if (item.weapon && !cls.weapons.includes(item.weapon)) return false;
  if (item.slot === 'shield' && !cls.shield) return false;
  if (item.slot === 'orb' && !cls.orb) return false;
  return true;
}

export function cannotEquip(c: Character, item: Item, lang: Lang = 'en'): string | null {
  if (!usableByClass(c, item)) return lang === 'zh' ? `${CLASSES[c.cls].name.zh}无法使用` : `${CLASSES[c.cls].name.en}s can’t use this`;
  if (item.req > c.level) return lang === 'zh' ? `需要等级 ${item.req}` : `Requires level ${item.req}`;
  return null;
}

export function equip(c: Character, itemId: number, slot?: EquipSlot): void {
  const item = ITEMS.get(itemId);
  if (!item || cannotEquip(c, item)) return;
  const slots = slotsFor(item, c);
  const target = slot && slots.includes(slot) ? slot : slots.find(s => c.equipped[s] === undefined) ?? slots[0];
  const bagIndex = c.bag.indexOf(itemId);
  if (bagIndex >= 0) c.bag.splice(bagIndex, 1);
  const unequip = (s: EquipSlot) => {
    const old = c.equipped[s];
    if (old !== undefined) c.bag.push(old);
    delete c.equipped[s];
  };
  unequip(target);
  c.equipped[target] = itemId;
  // A two-hander takes the off hand with it; an off-hand item evicts a two-hander.
  if (item.slot === 'twoHand') unequip('off');
  if (target === 'off') {
    const main = c.equipped.main !== undefined ? ITEMS.get(c.equipped.main) : undefined;
    if (main?.slot === 'twoHand') unequip('main');
  }
}

export function unequipSlot(c: Character, slot: EquipSlot): void {
  const old = c.equipped[slot];
  if (old === undefined) return;
  c.bag.push(old);
  delete c.equipped[slot];
}

// ------------------------------------------------------------------ power

const rawPower = (cls: ClassKey, item: Item) => {
  const w = CLASSES[cls].weights;
  let score = 0;
  for (const [k, v] of Object.entries(item.stats) as Array<[StatKey, number]>) score += v * (w[k] ?? 0);
  return score;
};

/** Item power in full best-in-slot gear from every dungeon and raid, for every class alike. */
const FULL_GEAR_POWER = 15000;
export const levelPower = (level: number) => level * 40;
const scaleCache = new Map<ClassKey, number>();

/** Power one item gives this class, scaled so each class's best gear sums to FULL_GEAR_POWER. */
export function itemPower(cls: ClassKey, item: Item): number {
  if (!scaleCache.has(cls)) {
    const raw = bestGear(cls, DUNGEONS.map(d => d.key), i => rawPower(cls, i));
    scaleCache.set(cls, raw > 0 ? FULL_GEAR_POWER / raw : 1);
  }
  return Math.round(rawPower(cls, item) * scaleCache.get(cls)!);
}

export function power(c: Character): number {
  let sum = levelPower(c.level);
  for (const id of Object.values(c.equipped)) {
    const item = id !== undefined ? ITEMS.get(id) : undefined;
    if (item) sum += itemPower(c.cls, item);
  }
  return sum;
}

export function bestPower(cls: ClassKey, keys: string[]): number {
  return levelPower(MAX_LEVEL) + bestGear(cls, keys, i => itemPower(cls, i));
}

function bestGear(cls: ClassKey, keys: string[], score: (item: Item) => number): number {
  const who = { cls };
  const best = new Map<string, number[]>();
  const push = (k: string, v: number) => best.set(k, [...(best.get(k) ?? []), v]);
  for (const d of DUNGEONS) {
    if (!keys.includes(d.key)) continue;
    for (const b of d.bosses) {
      for (const { item } of b.loot) {
        if (!usableByClass(who, item)) continue;
        const p = score(item);
        if (item.slot === 'twoHand') push('2h', p);
        else for (const slot of slotsFor(item, who)) push(slot === 'finger2' || slot === 'trinket2' ? '' : slot, p);
      }
    }
  }
  const top = (k: string, n = 1) => (best.get(k) ?? []).sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
  let sum = 0;
  for (const k of ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist', 'hands', 'waist', 'legs', 'feet']) sum += top(k);
  sum += top('finger1', 2) + top('trinket1', 2);
  sum += Math.max(top('main') + top('off'), top('2h'));
  return sum;
}

/** Average item level over all slots; empty slots count as 0, a two-hander fills the off hand. */
export function gearScore(c: Character): number {
  let sum = 0;
  for (const { key } of EQUIP_SLOTS) {
    const id = c.equipped[key];
    if (id !== undefined) sum += ITEMS.get(id)?.ilvl ?? 0;
  }
  const main = c.equipped.main !== undefined ? ITEMS.get(c.equipped.main) : undefined;
  if (main?.slot === 'twoHand' && c.equipped.off === undefined) sum += main.ilvl;
  return Math.floor(sum / EQUIP_SLOTS.length);
}

// ------------------------------------------------------------------ upgrades

export type Upgrade = { slot: EquipSlot; gain: number };

export function bestUpgrade(c: Character, itemId: number): Upgrade | null {
  const item = ITEMS.get(itemId);
  if (!item || cannotEquip(c, item)) return null;
  const before = power(c);
  let best: Upgrade | null = null;
  for (const slot of slotsFor(item, c)) {
    const trial: Character = { ...c, bag: [...c.bag, itemId], equipped: { ...c.equipped } };
    equip(trial, itemId, slot);
    const gain = power(trial) - before;
    if (gain > 0 && (!best || gain > best.gain)) best = { slot, gain };
  }
  return best;
}

export function bagUpgrades(c: Character): Map<number, Upgrade> {
  const out = new Map<number, Upgrade>();
  c.bag.forEach((id, i) => {
    const up = bestUpgrade(c, id);
    if (up) out.set(i, up);
  });
  return out;
}

export function equipAllUpgrades(c: Character): number {
  const start = power(c);
  for (let guard = 0; guard < 40; guard++) {
    let pickUp: { index: number; up: Upgrade } | null = null;
    for (const [index, up] of bagUpgrades(c)) if (!pickUp || up.gain > pickUp.up.gain) pickUp = { index, up };
    if (!pickUp) break;
    equip(c, c.bag[pickUp.index], pickUp.up.slot);
  }
  return power(c) - start;
}

// ------------------------------------------------------------------ progression

const FIVE = DUNGEONS.filter(d => !d.raid).map(d => d.key);
const GATES: Record<string, { from: string[]; share: number }> = {
  throne: { from: FIVE, share: 0.55 },
  maw: { from: [...FIVE, 'throne'], share: 0.55 },
};
const gateCache = new Map<string, number>();

/** Power a raid asks of this class: a share of the best power the previous content allows. */
export function gatePower(cls: ClassKey, d: Dungeon): number {
  const gate = GATES[d.key];
  if (!gate) return 0;
  const key = `${cls}:${d.key}`;
  if (!gateCache.has(key)) gateCache.set(key, Math.round((bestPower(cls, gate.from) * gate.share) / 50) * 50);
  return gateCache.get(key)!;
}

export function lockReason(c: Character, d: Dungeon, lang: Lang = 'en'): string | null {
  if (c.level < d.min) return lang === 'zh' ? `需要等级 ${d.min}` : `Level ${d.min}`;
  const need = gatePower(c.cls, d);
  if (need && power(c) < need) return lang === 'zh' ? `需要战斗力 ${need}` : `Power ${need}`;
  return null;
}

/** Experience per fight: the same whatever the stake and whatever drops. */
export function xpFor(c: Character, d: Dungeon): number {
  if (c.level >= MAX_LEVEL) return 0;
  if (d.max < c.level - 2) return 15;
  return d.raid ? 60 : 50;
}

export function gainXp(c: Character, amount: number): number {
  let gained = 0;
  c.xp += amount;
  while (c.level < MAX_LEVEL && c.xp >= XP_PER_LEVEL) {
    c.xp -= XP_PER_LEVEL;
    c.level++;
    gained++;
  }
  if (c.level >= MAX_LEVEL) c.xp = 0;
  return gained;
}
