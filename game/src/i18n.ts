import type { ArmorType, Lang, Slot, StatKey, Text, WeaponType } from './world';

function detect(): Lang {
  try {
    const saved = localStorage.getItem('cd.lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export let lang: Lang = detect();

export function setLang(next: Lang, remember = true): void {
  lang = next;
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  if (!remember) return;
  try {
    localStorage.setItem('cd.lang', next);
  } catch {
    /* storage blocked */
  }
}

/** True when the player picked a language themselves (the host locale should not override it). */
export function langChosen(): boolean {
  try {
    return !!localStorage.getItem('cd.lang');
  } catch {
    return false;
  }
}

export const tx = (text: Text) => text[lang];

const S = {
  title: { en: 'Call the Drop', zh: '猜掉落' },
  tagline: { en: 'Read the loot table. Call the drop. Wear what you win.', zh: '看掉落表，猜首领掉什么，押中的装备穿上身。' },
  demo: { en: 'DEMO', zh: '试玩' },
  chooseHero: { en: 'Choose your hero', zh: '选择角色' },
  createHero: { en: 'Create a hero', zh: '创建角色' },
  noHeroes: { en: 'No heroes yet.', zh: '还没有角色。' },
  enter: { en: 'Play', zh: '进入游戏' },
  delete: { en: 'Delete', zh: '删除' },
  newHero: { en: 'New hero', zh: '创建新角色' },
  confirmDelete: { en: 'Delete {name}? Their level and gear go with them.', zh: '确定删除角色「{name}」吗？角色的装备和等级会一起删除。' },
  levelClass: { en: 'Level {level} {cls}', zh: '{level} 级 {cls}' },
  classLabel: { en: 'Class', zh: '职业' },
  nameLabel: { en: 'Name', zh: '名字' },
  random: { en: 'Random', zh: '随机' },
  back: { en: 'Back', zh: '返回' },
  create: { en: 'Begin', zh: '开始冒险' },
  createNote: { en: 'Every hero starts at level 1 in the Rattling Cellars.', zh: '新角色从 1 级开始，第一站是窸窣地窖。' },
  power: { en: 'Power', zh: '战斗力' },
  powerHint: { en: 'Power: your level plus the stats of what you wear, weighted for your class', zh: '战斗力：等级 + 已穿戴装备的属性，按职业加权' },
  balance: { en: 'Balance', zh: '余额' },
  bagTitle: { en: 'Hero & bags', zh: '角色与背包' },
  bagUpgrades: { en: '{n} upgrades in your bags', zh: '背包里有 {n} 件可以提升战斗力' },
  shareCardTitle: { en: 'Share hero card', zh: '分享角色卡' },
  howTo: { en: 'How to play', zh: '玩法说明' },
  sound: { en: 'Sound', zh: '声音' },
  switchHero: { en: 'Switch hero', zh: '切换角色' },
  dungeons: { en: 'Dungeons', zh: '地下城' },
  raids: { en: 'Raids', zh: '团队副本' },
  raidPower: { en: 'Raid · Power {n}', zh: '团本 · 战力 {n}' },
  levels: { en: 'Levels {min}–{max}', zh: '等级 {min}–{max}' },
  bossCount: { en: '{n} bosses', zh: '{n} 个首领' },
  lootIntro: { en: 'Each kill reveals <b>one</b> item from this table. Tick the ones you think will drop — pick more for safer odds.', zh: '每次击杀从下表揭晓 <b>一件</b> 装备。勾选你猜会掉的装备，选得越多越稳，赔率越低。' },
  pickMine: { en: 'Pick my class', zh: '选本职业可用' },
  clear: { en: 'Clear', zh: '清空' },
  colItem: { en: 'Item', zh: '装备' },
  colType: { en: 'Type', zh: '类型' },
  colChance: { en: 'Chance', zh: '揭晓概率' },
  colPays: { en: 'Pays', zh: '单押赔率' },
  chanceHint: { en: 'Chance this item is the one revealed', zh: '这件装备被揭晓的概率' },
  paysHint: { en: 'Payout if you pick only this item: 96% ÷ chance', zh: '只押这一件时的赔率：96% ÷ 揭晓概率' },
  cantUse: { en: 'not for you', zh: '不可用' },
  picked: { en: 'Picked', zh: '已选' },
  winChance: { en: 'Win chance', zh: '猜中概率' },
  odds: { en: 'Pays', zh: '赔率' },
  winAmount: { en: 'If you’re right', zh: '猜中可得' },
  stake: { en: 'Stake', zh: '门票' },
  max: { en: 'Max', zh: '最大' },
  fight: { en: 'Fight!', zh: '开打！' },
  connecting: { en: 'Connecting…', zh: '正在连接…' },
  connectWallet: { en: 'Connect your wallet first', zh: '请先连接钱包' },
  finishWallet: { en: 'Finish wallet setup first', zh: '请先完成钱包设置' },
  pickSome: { en: 'Tick the item(s) you think will drop', zh: '先勾选你猜会掉落的装备' },
  pickAll: { en: 'Picking everything always loses 4% — leave at least one out', zh: '全选必输 4%，请至少留一件不选' },
  tooLong: { en: 'Odds above {max}× — pick a few more items', zh: '赔率超过上限 {max}×，请多选几件' },
  badTable: { en: 'Loot table error', zh: '掉落表数据异常' },
  enterStake: { en: 'Enter a stake', zh: '请输入门票金额' },
  insufficient: { en: 'Not enough balance', zh: '余额不足' },
  overLimit: { en: 'Above the platform limit of {max}', zh: '超过平台单注上限 {max}' },
  lockedHere: { en: 'Locked — {why}. You can still browse the loot.', zh: '未解锁（{why}），可以先看看掉落表。' },
  betNote: { en: 'Each fight gives {xp} XP, whatever you stake. Every bet returns 96% on average.', zh: '每打一次得 {xp} 点经验（与门票无关）。每一注的期望回报都是 96%。' },
  tank: { en: 'Tank', zh: '坦克' },
  healer: { en: 'Healer', zh: '治疗' },
  dps: { en: 'Damage', zh: '输出' },
  waitingWallet: { en: 'Confirm in your wallet…', zh: '等待钱包确认…' },
  entering: { en: 'Entering…', zh: '进本中…' },
  fightingChain: { en: 'Fighting… waiting for on-chain randomness', zh: '战斗中… 等待链上随机数' },
  fighting: { en: 'Fighting…', zh: '战斗中…' },
  defeated: { en: '{boss} is defeated!', zh: '{boss} 被击败了！' },
  youCalledIt: { en: 'You called it!', zh: '猜中了！' },
  inBags: { en: '{item} is in your bags', zh: '{item} 已放入背包' },
  missed: { en: 'Not this time', zh: '没押中' },
  missedNote: { en: 'You didn’t pick this one. The boss keeps your {stake}.', zh: '这件装备你没有勾选，门票 {stake} 归于首领。' },
  xpGain: { en: '+{xp} XP', zh: '+{xp} 经验' },
  levelUp: { en: 'Level up! You are now level {level}', zh: '升级了！你现在是 {level} 级' },
  unlocked: { en: 'Unlocked: {name}', zh: '解锁了：{name}' },
  equipNow: { en: 'Equip', zh: '立即装备' },
  equipGain: { en: 'Equip (+{n} Power)', zh: '立即装备（战斗力 +{n}）' },
  shareBrag: { en: 'Share', zh: '分享喜报' },
  close: { en: 'Close', zh: '关闭' },
  again: { en: 'Fight again', zh: '再打一次' },
  errRisk: { en: 'This bet is above what the house can cover right now — lower the stake or pick more items', zh: '这注超出了平台当前可承担的风险，请降低门票或多选几件' },
  errCancelled: { en: 'Cancelled', zh: '已取消' },
  errGeneric: { en: 'Something went wrong — try again', zh: '出错了，请重试' },
  errChainCancelled: { en: 'The round was cancelled on-chain; your stake is back', zh: '本局已被链上取消，门票已退回' },
  unequipHint: { en: 'Click to unequip', zh: '点击卸下' },
  equipTo: { en: 'Click to equip ({slot})', zh: '点击装备到{slot}' },
  xpLine: { en: 'XP {xp} / {need}', zh: '经验 {xp} / {need}' },
  maxLevel: { en: 'Max level', zh: '已满级' },
  kills: { en: '{n} boss fights · {m} items collected', zh: '击杀首领 {n} 次 · 收集装备 {m} 件' },
  gearLevel: { en: 'Item level {n}', zh: '装等 {n}' },
  bags: { en: 'Bags', zh: '背包' },
  bagsHint: { en: '({n}) · click to equip', zh: '（{n}）· 点击装备' },
  upgradesCount: { en: '{n} upgrades', zh: '{n} 件可提升战斗力' },
  equipAll: { en: 'Equip all upgrades', zh: '一键换上更好的' },
  emptyBags: { en: 'Nothing yet. Items you call right land here.', zh: '还没有装备。押中的装备会放进这里。' },
  noStats: { en: 'Stats appear once you wear gear', zh: '穿上装备后显示属性' },
  making: { en: 'Drawing your card…', zh: '正在生成图片…' },
  refill: { en: 'Reset demo gold to 1,000', zh: '试玩金币重置为 1000' },
  gold: { en: 'gold', zh: '金' },
  // tooltip
  itemLevel: { en: 'Item Level {n}', zh: '物品等级 {n}' },
  damage: { en: '{min} – {max} Damage', zh: '{min} - {max} 伤害' },
  speed: { en: 'Speed {n}', zh: '速度 {n}' },
  perSecond: { en: '({n} damage per second)', zh: '（每秒伤害 {n}）' },
  armorLine: { en: '{n} Armor', zh: '{n} 点护甲' },
  equipAp: { en: 'Equip: +{n} Attack Power.', zh: '装备：+{n} 攻击强度。' },
  equipSp: { en: 'Equip: Increases spell power by {n}.', zh: '装备：法术强度提高 {n} 点。' },
  equipCrit: { en: 'Equip: +{n}% critical strike chance.', zh: '装备：爆击几率提高 {n}%。' },
  equipHaste: { en: 'Equip: +{n}% haste.', zh: '装备：急速提高 {n}%。' },
  requires: { en: 'Requires Level {n}', zh: '需要等级 {n}' },
  powerTip: { en: 'Power +{n}', zh: '战斗力 +{n}' },
  upgradeTip: { en: '(▲{n} if worn)', zh: '（换上 ▲{n}）' },
  worseTip: { en: '(not better than yours)', zh: '（不如当前装备）' },
  // share
  shareHint: { en: 'On a phone you can also long-press the image to save it', zh: '手机上也可以长按图片保存或转发' },
  shareNative: { en: 'Share…', zh: '分享…' },
  copyImage: { en: 'Copy image', zh: '复制图片' },
  saveImage: { en: 'Save image', zh: '保存图片' },
  copied: { en: 'Copied — paste it anywhere', zh: '已复制，可以直接粘贴到微信或 QQ' },
  copyFailed: { en: 'Copy failed — use Save or long-press the image', zh: '复制失败，请用“保存图片”或长按图片' },
  cardFooter: { en: 'Call the Drop · read the table, call the loot', zh: '猜掉落 · 看掉落表，猜首领掉什么' },
  bragTitle5: { en: 'LEGENDARY!', zh: '橙装出货！' },
  bragTitle4: { en: 'EPIC DROP!', zh: '紫装出货！' },
  bragTitleBig: { en: 'BIG CALL!', zh: '大赔率命中！' },
  bragTitle: { en: 'CALLED IT!', zh: '出货了！' },
  beat: { en: 'Defeated {boss} · {dungeon}', zh: '击败了 {boss} · {dungeon}' },
  won: { en: 'Won', zh: '赢得' },
  itemsCollected: { en: 'Items', zh: '收集装备' },
  fights: { en: 'Fights', zh: '击杀首领' },
  ilvlShort: { en: 'Item lvl', zh: '装等' },
} as const satisfies Record<string, Text>;

export type Key = keyof typeof S;

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return S[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export const STAT_NAMES: Record<StatKey, Text> = {
  str: { en: 'Strength', zh: '力量' }, agi: { en: 'Agility', zh: '敏捷' }, int: { en: 'Intellect', zh: '智力' },
  sta: { en: 'Stamina', zh: '耐力' }, wil: { en: 'Willpower', zh: '意志' }, armor: { en: 'Armor', zh: '护甲' },
  dps: { en: 'Weapon DPS', zh: '武器秒伤' }, ap: { en: 'Attack Power', zh: '攻击强度' }, sp: { en: 'Spell Power', zh: '法术强度' },
  crit: { en: 'Crit %', zh: '爆击 %' }, haste: { en: 'Haste %', zh: '急速 %' },
};

export const SLOT_NAMES: Record<Slot, Text> = {
  head: { en: 'Head', zh: '头部' }, neck: { en: 'Neck', zh: '颈部' }, shoulder: { en: 'Shoulder', zh: '肩部' },
  back: { en: 'Back', zh: '背部' }, chest: { en: 'Chest', zh: '胸部' }, wrist: { en: 'Wrist', zh: '手腕' },
  hands: { en: 'Hands', zh: '手' }, waist: { en: 'Waist', zh: '腰部' }, legs: { en: 'Legs', zh: '腿部' },
  feet: { en: 'Feet', zh: '脚' }, finger: { en: 'Finger', zh: '手指' }, trinket: { en: 'Trinket', zh: '饰品' },
  oneHand: { en: 'One-Hand', zh: '单手' }, twoHand: { en: 'Two-Hand', zh: '双手' }, shield: { en: 'Off Hand', zh: '副手' },
  orb: { en: 'Held In Off-hand', zh: '副手物品' },
};

export const ARMOR_NAMES: Record<ArmorType, Text> = {
  cloth: { en: 'Cloth', zh: '布甲' }, leather: { en: 'Leather', zh: '皮甲' }, mail: { en: 'Mail', zh: '锁甲' }, plate: { en: 'Plate', zh: '板甲' },
};

export const WEAPON_NAMES: Record<WeaponType, Text> = {
  sword: { en: 'Sword', zh: '剑' }, axe: { en: 'Axe', zh: '斧' }, mace: { en: 'Mace', zh: '锤' }, dagger: { en: 'Dagger', zh: '匕首' },
  staff: { en: 'Staff', zh: '法杖' }, bow: { en: 'Bow', zh: '弓' }, wand: { en: 'Wand', zh: '魔杖' },
};

export const QUALITY_NAMES: Record<number, Text> = {
  2: { en: 'Uncommon', zh: '优秀' }, 3: { en: 'Rare', zh: '精良' }, 4: { en: 'Epic', zh: '史诗' }, 5: { en: 'Legendary', zh: '传说' },
};

export function helpHtml(maxMult: number, demo: boolean): string {
  if (lang === 'zh') {
    return `<h2>玩法说明</h2>
      <ol>
        <li><b>选副本、选首领。</b>从 1 级的窸窣地窖开始，等级够了解锁下一个；两个团队副本还要求战斗力达标。没解锁的副本也可以先看掉落表。</li>
        <li><b>看掉落表、猜装备。</b>每个首领有自己的掉落表。每次击杀只揭晓<b>一件</b>，表里写着每件被揭晓的概率。</li>
        <li><b>赔率 = 96% ÷ 猜中概率。</b>比如只押一件 25% 的装备，猜中赔 3.84 倍；押几件就把概率相加，更稳、赔率更低。</li>
        <li><b>押中就归你。</b>装备放进背包，可以穿上提升战斗力，去挑战更强的首领。每打一次都得经验，和门票大小、输赢无关。</li>
      </ol>
      <p class="muted">公平性：结果由链上 VRF 随机数决定；合约只按提交的掉落表抽一件，任何押法的期望回报都精确为 96%。
      等级、装备、战斗力只决定能去哪里，不影响赔率。单注最高 ${maxMult} 倍。${demo ? '当前是试玩模式，使用虚拟金币。' : ''}</p>`;
  }
  return `<h2>How to play</h2>
    <ol>
      <li><b>Pick a dungeon and a boss.</b> Start in the level-1 Rattling Cellars; each level unlocks the next dungeon, and the two raids also ask for Power. Locked dungeons can still be browsed.</li>
      <li><b>Read the loot table and call the drop.</b> Every boss has its own table. Each kill reveals exactly <b>one</b> item, and the table shows each item’s chance.</li>
      <li><b>Pays = 96% ÷ your chance.</b> Call a single 25% item and a hit pays 3.84×. Pick several and their chances add up — safer, smaller payout.</li>
      <li><b>Call it right and it’s yours.</b> Won items go to your bags; wear them for Power and take on bigger bosses. Every fight gives XP, whatever you stake or win.</li>
    </ol>
    <p class="muted">Fairness: the outcome comes from on-chain VRF; the contract draws one item from the table you submit, so every way of betting returns exactly 96% on average.
    Level, gear and Power only decide where you can go — never the odds. Max ${maxMult}× per bet.${demo ? ' You are playing the demo with play gold.' : ''}</p>`;
}
