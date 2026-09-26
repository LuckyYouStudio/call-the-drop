import './style.css';
import { bossPortrait, classEmblem, itemIcon } from './art';
import {
  CLASSES, CLASS_KEYS, EQUIP_SLOTS, XP_PER_LEVEL,
  bagUpgrades, bestUpgrade, cannotEquip, equip, equipAllUpgrades, gainXp, gatePower, gearScore, itemPower, lockReason, newCharacter,
  power, unequipSlot, usableByClass, xpFor,
  type Character, type ClassKey, type EquipSlot,
} from './character';
import { connectHost, type HostLink } from './host';
import {
  ARMOR_NAMES, SLOT_NAMES, STAT_NAMES, WEAPON_NAMES, helpHtml, lang, langChosen, setLang, t, tx,
} from './i18n';
import {
  MAX_MULT, RTP, decodeGameData, decodeGameState, demoRoll, encodeGameData, formatAmount, formatMult, formatPct,
  invalidReason, multiplier, parseAmount, payoutFor, slotOf, winChance, type Pick,
} from './odds';
import { computeMaxWager } from './sdk/guest';
import { bragCard, characterCard, openShare, type Brag } from './share';
import { isMuted, setMuted, sfx, unlockAudio } from './sound';
import { DUNGEONS, ITEMS, MAX_LEVEL, findBoss, type Boss, type Dungeon, type Item, type StatKey } from './world';

// ------------------------------------------------------------------ storage

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the session still plays, it just does not persist */
  }
}

// ------------------------------------------------------------------ state

const DEMO_DECIMALS = 2;
const DEMO_START = 1000n * 100n;

type Screen = 'select' | 'create' | 'game';
type RoundStatus = 'opening' | 'waiting' | 'revealed';
type Round = {
  boss: Boss;
  bet: Pick;
  wager: bigint;
  status: RoundStatus;
  startedAt: number;
  sessionKey?: string;
  sessionId?: string;
  balanceFloor?: bigint;
  dropped?: number;
  payout?: bigint;
  brag?: Brag;
  /** Set once the drop is known, so repeated host snapshots cannot settle the round twice. */
  presenting?: boolean;
  unlocked?: Dungeon[];
};

let chars: Character[] = load<Character[]>('cd.chars', []).filter(c => CLASSES[c.cls]);
let active: Character | null = chars.find(c => c.id === load<string | null>('cd.active', null)) ?? null;
let screen: Screen = active ? 'game' : chars.length ? 'select' : 'create';
let demoBalance = BigInt(load('cd.demo', DEMO_START.toString()));
let dungeonKey: string | null = load('cd.dungeon', null);
let bossId: number | null = load('cd.boss', null);
let picks = new Set<number>();
let wagerText = load('cd.wager', '10');
let round: Round | null = null;
let error: string | null = null;
let adoptChecked = false;

let createClass: ClassKey = 'warblade';
let createName = '';

const app = document.getElementById('app')!;
const tooltip = document.getElementById('tooltip')!;
setLang(lang, false);

const link: HostLink = connectHost(next => {
  Object.assign(link, next);
  if (link.mode === 'live') {
    // Follow the casino's language unless the player picked one here.
    const hostLang = link.snapshot?.ui.locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    if (link.snapshot && !langChosen() && hostLang !== lang) {
      setLang(hostLang, false);
      render();
    }
    adoptOpenSession();
    settleFromSnapshot();
  }
  renderTop();
  renderBet();
});

// ------------------------------------------------------------------ money

const live = () => link.mode === 'live' && !!link.snapshot;
const decimals = () => (live() ? link.snapshot!.token.decimals ?? 18 : DEMO_DECIMALS);
const symbol = () => (live() ? link.snapshot!.token.symbol ?? '' : t('gold'));
const inFlight = () => !!round && round.status !== 'revealed';

function balance(): bigint | undefined {
  if (!live()) return link.mode === 'demo' ? demoBalance : undefined;
  const raw = link.snapshot!.balances.smartVaultBalance;
  if (raw === undefined) return undefined;
  const value = BigInt(raw);
  // Never let a settled win leak into the balance before the loot window has shown it.
  if (round?.balanceFloor !== undefined && inFlight() && value > round.balanceFloor) return round.balanceFloor;
  return value;
}

const money = (value: bigint) => `${formatAmount(value, decimals(), decimals() > 6 ? 4 : 2)} ${symbol()}`;

function persist(): void {
  if (active) chars = chars.map(c => (c.id === active!.id ? active! : c));
  save('cd.chars', chars);
  save('cd.active', active?.id ?? null);
  save('cd.demo', demoBalance.toString());
}

// ------------------------------------------------------------------ helpers

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const img = (src: string, cls: string, alt = '') => `<img class="${cls}" src="${src}" alt="${esc(alt)}" draggable="false" />`;
const itemImg = (item: Item, size: 'sm' | 'md' | 'lg') => img(itemIcon(item), `icon icon--${size} q${item.quality}b`);
const emblem = (cls: ClassKey, size: 'xs' | 'sm' | 'md') => img(classEmblem(cls, CLASSES[cls].color), `icon icon--${size}`);
const clsName = (cls: ClassKey) => tx(CLASSES[cls].name);

function typeLabel(item: Item): string {
  if (item.weapon) return `${tx(SLOT_NAMES[item.slot])} ${tx(WEAPON_NAMES[item.weapon])}`;
  if (item.slot === 'shield') return lang === 'zh' ? '盾牌' : 'Shield';
  if (item.armor && item.slot !== 'back') return `${tx(SLOT_NAMES[item.slot])} · ${tx(ARMOR_NAMES[item.armor])}`;
  return tx(SLOT_NAMES[item.slot]);
}

function currentDungeon(): Dungeon | null {
  if (!active) return null;
  const d = DUNGEONS.find(x => x.key === dungeonKey);
  if (d) return d;
  // Default to the highest unlocked five-player dungeon.
  const open = DUNGEONS.filter(x => !lockReason(active!, x));
  return open.filter(x => !x.raid).at(-1) ?? DUNGEONS[0];
}

function currentBoss(): Boss | null {
  const d = currentDungeon();
  if (!d) return null;
  return d.bosses.find(b => b.id === bossId) ?? d.bosses[0] ?? null;
}

function currentPick(boss: Boss): Pick {
  return { weights: boss.loot.map(l => l.weight), picks: [...picks].filter(i => i < boss.loot.length).sort((a, b) => a - b) };
}

// ------------------------------------------------------------------ tooltip

function showTip(target: HTMLElement, html: string): void {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const r = target.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let x = r.right + 10;
  if (x + tw > window.innerWidth - 8) x = r.left - tw - 10;
  if (x < 8) x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left));
  let y = r.top;
  if (x === r.left || x < r.right - 20) y = r.bottom + 8;
  if (y + th > window.innerHeight - 8) y = Math.max(8, window.innerHeight - th - 8);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTip(): void {
  tooltip.hidden = true;
}

const STAT_ORDER: StatKey[] = ['str', 'agi', 'int', 'sta', 'wil'];

/** The item card, in the classic tooltip layout. */
function itemCard(item: Item): string {
  const lines: string[] = [];
  lines.push(`<div class="tt-name q${item.quality}">${esc(tx(item.name))}</div>`);
  lines.push(`<div class="tt-ilvl">${t('itemLevel', { n: item.ilvl })}</div>`);
  const kind = item.weapon ? tx(WEAPON_NAMES[item.weapon]) : item.slot === 'shield' ? (lang === 'zh' ? '盾牌' : 'Shield') : item.armor && item.slot !== 'back' ? tx(ARMOR_NAMES[item.armor]) : '';
  lines.push(`<div class="tt-row"><span>${tx(SLOT_NAMES[item.slot])}</span><span>${kind}</span></div>`);
  if (item.damage) {
    lines.push(`<div class="tt-row"><span>${t('damage', { min: item.damage[0], max: item.damage[1] })}</span><span>${t('speed', { n: item.speed!.toFixed(2) })}</span></div>`);
    lines.push(`<div>${t('perSecond', { n: item.stats.dps!.toFixed(1) })}</div>`);
  }
  if (item.stats.armor) lines.push(`<div>${t('armorLine', { n: item.stats.armor })}</div>`);
  for (const k of STAT_ORDER) if (item.stats[k]) lines.push(`<div>+${item.stats[k]} ${tx(STAT_NAMES[k])}</div>`);
  if (item.stats.ap) lines.push(`<div class="tt-equip">${t('equipAp', { n: item.stats.ap })}</div>`);
  if (item.stats.sp) lines.push(`<div class="tt-equip">${t('equipSp', { n: item.stats.sp })}</div>`);
  if (item.stats.crit) lines.push(`<div class="tt-equip">${t('equipCrit', { n: item.stats.crit })}</div>`);
  if (item.stats.haste) lines.push(`<div class="tt-equip">${t('equipHaste', { n: item.stats.haste })}</div>`);
  const low = active && item.req > active.level;
  lines.push(`<div class="${low ? 'tt-bad' : ''}">${t('requires', { n: item.req })}</div>`);
  if (item.flavor) lines.push(`<div class="tt-flavor">“${esc(tx(item.flavor))}”</div>`);
  return lines.join('');
}

function itemTip(item: Item, extra = ''): string {
  let foot = '';
  if (active) {
    const why = cannotEquip(active, item, lang);
    if (why && !usableByClass(active, item)) foot = `<div class="tip-warn">${esc(why)}</div>`;
    else foot = `<div class="tip-power">${t('powerTip', { n: itemPower(active.cls, item) })} ${powerDeltaText(item)}</div>`;
  }
  return `<div class="tt">${itemCard(item)}</div>${foot}${extra}`;
}

function powerDeltaText(item: Item): string {
  if (!active || Object.values(active.equipped).includes(item.id) || cannotEquip(active, item)) return '';
  const up = bestUpgrade(active, item.id);
  return up ? `<span class="up">${t('upgradeTip', { n: up.gain })}</span>` : `<span class="muted">${t('worseTip')}</span>`;
}

document.addEventListener('mouseover', event => {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (!el) return;
  const item = ITEMS.get(Number(el.dataset.tip));
  if (item) showTip(el, itemTip(item, el.dataset.tipExtra ?? ''));
});
document.addEventListener('mouseout', event => {
  const el = (event.target as HTMLElement).closest('[data-tip]');
  if (el && !el.contains(event.relatedTarget as Node)) hideTip();
});
document.addEventListener('scroll', hideTip, true);

// ------------------------------------------------------------------ render: shell

function render(): void {
  hideTip();
  document.title = `${t('title')} — ${lang === 'zh' ? '看掉落表猜装备' : 'call the boss loot'}`;
  if (screen === 'create') return renderCreate();
  if (screen === 'select' || !active) return renderSelect();
  renderGame();
}

const langButton = () => `<button class="icon-btn lang-btn" data-lang title="Language / 语言">${lang === 'zh' ? 'EN' : '中'}</button>`;

function renderSelect(): void {
  app.innerHTML = `
  <div class="gate">
    <div class="gate__lang">${langButton()}</div>
    <h1 class="logo">${t('title')}</h1>
    <p class="logo-sub">${t('tagline')}</p>
    <div class="panel roster">
      <h3>${t('chooseHero')}</h3>
      ${chars.length ? chars.map(c => `
        <div class="roster__row" data-enter="${c.id}">
          ${emblem(c.cls, 'md')}
          <div class="roster__who">
            <span class="roster__name" style="color:${CLASSES[c.cls].color}">${esc(c.name)}</span>
            <span class="roster__meta">${t('levelClass', { level: c.level, cls: clsName(c.cls) })} · ${t('power')} ${power(c).toLocaleString('en-US')}</span>
          </div>
          <button class="btn" data-enter="${c.id}">${t('enter')}</button>
          <button class="btn btn--ghost" data-delete="${c.id}">${t('delete')}</button>
        </div>`).join('') : `<p class="muted">${t('noHeroes')}</p>`}
    </div>
    <button class="btn btn--big" data-go="create">${t('newHero')}</button>
  </div>`;
}

function randomName(): string {
  if (lang === 'zh') {
    const a = ['夜', '霜', '烬', '岩', '风', '月', '荆', '灰', '影', '星', '潮', '铁'];
    const b = ['行者', '之刃', '守望', '低语', '猎手', '之歌', '旅人', '之牙', '之誓', '渡鸦', '之火', '孤狼'];
    return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
  }
  const a = ['Ash', 'Brin', 'Cor', 'Dra', 'Ely', 'Fen', 'Gar', 'Hal', 'Isk', 'Kael', 'Lio', 'Mor', 'Nym', 'Ro', 'Syl', 'Tor', 'Vex', 'Wren'];
  const b = ['wyn', 'dric', 'ra', 'mir', 'en', 'is', 'thas', 'ven', 'ka', 'lor', 'ric', 'dell', 'ith', 'ara'];
  return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
}

function renderCreate(): void {
  if (!createName) createName = randomName();
  app.innerHTML = `
  <div class="gate">
    <div class="gate__lang">${langButton()}</div>
    <h1 class="logo">${t('title')}</h1>
    <p class="logo-sub">${t('tagline')}</p>
    <div class="panel create">
      <h3>${t('classLabel')}</h3>
      <div class="classes">
        ${CLASS_KEYS.map(k => `
          <button class="classcard${k === createClass ? ' on' : ''}" data-class="${k}" style="--cc:${CLASSES[k].color}">
            ${emblem(k, 'md')}
            <span class="classcard__name">${clsName(k)}</span>
            <span class="classcard__role">${tx(CLASSES[k].role)}</span>
          </button>`).join('')}
      </div>
      <h3>${t('nameLabel')}</h3>
      <div class="name-row">
        <input id="create-name" class="input" maxlength="14" value="${esc(createName)}" />
        <button class="btn btn--ghost" data-reroll>${t('random')}</button>
      </div>
      <p class="muted">${t('createNote')}</p>
      <div class="create__actions">
        ${chars.length ? `<button class="btn btn--ghost" data-go="select">${t('back')}</button>` : ''}
        <button class="btn btn--big" data-create>${t('create')}</button>
      </div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ render: game

function renderGame(): void {
  app.innerHTML = `
  <header class="top" id="top"></header>
  <main class="main">
    <aside class="dungeons panel" id="dungeons"></aside>
    <section class="stage">
      <div class="bosses" id="bosses"></div>
      <div class="panel loot" id="loot"></div>
      <div class="panel bet" id="bet"></div>
    </section>
  </main>
  <div id="overlay"></div>
  <div id="share"></div>`;
  renderTop();
  renderDungeons();
  renderBosses();
  renderLoot();
  renderBet();
  if (round) renderFight();
}

function renderTop(): void {
  const el = document.getElementById('top');
  if (!el || !active) return;
  const c = active;
  const cls = CLASSES[c.cls];
  const bal = balance();
  const upgradeCount = bagUpgrades(c).size;
  el.innerHTML = `
    <div class="brand">${t('title')}${link.mode === 'demo' ? `<span class="badge">${t('demo')}</span>` : ''}</div>
    <button class="me" data-open="char" title="${t('bagTitle')}">
      ${emblem(c.cls, 'sm')}
      <span class="me__text">
        <span class="me__name" style="color:${cls.color}">${esc(c.name)}</span>
        <span class="me__lv">${t('levelClass', { level: c.level, cls: clsName(c.cls) })}</span>
      </span>
      <span class="xp" title="${c.level >= MAX_LEVEL ? t('maxLevel') : t('xpLine', { xp: c.xp, need: XP_PER_LEVEL })}"><span style="width:${c.level >= MAX_LEVEL ? 100 : c.xp}%"></span></span>
    </button>
    <div class="stat stat--power" title="${t('powerHint')}"><span>${t('power')}</span><b>${power(c).toLocaleString('en-US')}</b></div>
    <div class="stat stat--gold"><span>${t('balance')}</span><b id="balance">${bal === undefined ? '—' : money(bal)}</b></div>
    <div class="top__btns">
      <button class="icon-btn icon-btn--bag" data-open="char" title="${upgradeCount ? t('bagUpgrades', { n: upgradeCount }) : t('bagTitle')}">🎒${upgradeCount ? `<span class="badge-up">${upgradeCount}</span>` : ''}</button>
      <button class="icon-btn" data-share-card title="${t('shareCardTitle')}">↗</button>
      <button class="icon-btn" data-open="help" title="${t('howTo')}">?</button>
      ${langButton()}
      <button class="icon-btn" data-sound title="${t('sound')}">${isMuted() ? '🔇' : '🔊'}</button>
      <button class="icon-btn" data-go="select" title="${t('switchHero')}">⇄</button>
    </div>`;
}

function renderDungeons(): void {
  const el = document.getElementById('dungeons');
  if (!el || !active) return;
  const cur = currentDungeon();
  const group = (title: string, list: Dungeon[]) => `
    <h4>${title}</h4>
    ${list.map(d => {
      const lock = lockReason(active!, d, lang);
      const meta = lock ? `🔒 ${lock}` : d.raid ? t('raidPower', { n: gatePower(active!.cls, d) }) : `${d.min}–${d.max}`;
      return `<button class="dg${d === cur ? ' on' : ''}${lock ? ' locked' : ''}" data-dungeon="${d.key}">
        <span class="dg__name">${tx(d.name)}</span>
        <span class="dg__lv">${meta}</span>
      </button>`;
    }).join('')}`;
  el.innerHTML = group(t('dungeons'), DUNGEONS.filter(d => !d.raid)) + group(t('raids'), DUNGEONS.filter(d => d.raid));
  el.querySelector('.dg.on')?.scrollIntoView({ block: 'nearest' });
}

function renderBosses(): void {
  const el = document.getElementById('bosses');
  const d = currentDungeon();
  const boss = currentBoss();
  if (!el || !d) return;
  el.innerHTML = `
    <div class="bosses__head">
      <h2>${tx(d.name)}</h2>
      <span class="muted">${t('levels', { min: d.min, max: d.max })} · ${t('bossCount', { n: d.bosses.length })}</span>
      <p class="bosses__blurb">${esc(tx(d.blurb))}</p>
    </div>
    <div class="bosses__list">
      ${d.bosses.map(b => `
        <button class="boss${b === boss ? ' on' : ''}" data-boss="${b.id}">
          <span class="bport">${img(bossPortrait(b), '')}</span>
          <span class="boss__name">${esc(tx(b.name))}</span>
          ${active?.kills[b.id] ? `<span class="boss__kills">×${active.kills[b.id]}</span>` : ''}
        </button>`).join('')}
    </div>`;
}

function renderLoot(): void {
  const el = document.getElementById('loot');
  const boss = currentBoss();
  if (!el || !boss || !active) return;
  const pick = currentPick(boss);
  const total = pick.weights.reduce((a, b) => a + b, 0);
  el.innerHTML = `
    <div class="loot__head">
      <div class="loot__boss">${img(bossPortrait(boss), '', tx(boss.name))}</div>
      <div class="loot__title">
        <h3>${esc(tx(boss.name))} <small>${esc(tx(boss.title))}</small></h3>
        <p class="muted">${t('lootIntro')}</p>
      </div>
      <div class="loot__quick">
        <button class="btn btn--ghost btn--sm" data-quick="mine">${t('pickMine')}</button>
        <button class="btn btn--ghost btn--sm" data-quick="clear">${t('clear')}</button>
      </div>
    </div>
    <div class="loot__table" role="table">
      <div class="lrow lrow--head" role="row">
        <span></span><span>${t('colItem')}</span><span class="c-type">${t('colType')}</span>
        <span class="num" title="${t('chanceHint')}">${t('colChance')}</span><span class="num" title="${t('paysHint')}">${t('colPays')}</span>
      </div>
      ${boss.loot.map((l, i) => {
        const on = picks.has(i);
        const share = l.weight / total;
        const mine = usableByClass(active!, l.item);
        return `<label class="lrow${on ? ' on' : ''}${mine ? '' : ' dim'}" role="row" data-pick="${i}">
          <input type="checkbox" ${on ? 'checked' : ''} ${inFlight() ? 'disabled' : ''} />
          <span class="lrow__item" data-tip="${l.item.id}">
            ${itemImg(l.item, 'sm')}
            <span class="q${l.item.quality}">${esc(tx(l.item.name))}</span>
            ${mine ? '' : `<em class="tag">${t('cantUse')}</em>`}
          </span>
          <span class="c-type muted">${typeLabel(l.item)}</span>
          <span class="num">${formatPct(share)}</span>
          <span class="num odds">${formatMult((RTP * total) / l.weight)}</span>
        </label>`;
      }).join('')}
    </div>`;
}

function platformMaxWager(bet: Pick): bigint | undefined {
  if (!live() || invalidReason(bet)) return undefined;
  const result = computeMaxWager(link.snapshot, { maxMultiplierX: multiplier(bet) });
  return result.kind === 'limit' ? result.maxWager : undefined;
}

function betProblem(bet: Pick, wager: bigint | null): string | null {
  const boss = currentBoss();
  if (boss && active) {
    const lock = lockReason(active, boss.dungeon, lang);
    if (lock) return t('lockedHere', { why: lock });
  }
  if (link.mode === 'connecting') return t('connecting');
  if (live()) {
    const status = link.snapshot!.wallet.status;
    if (status === 'disconnected') return t('connectWallet');
    if (status !== 'ready') return t('finishWallet');
  }
  const why = invalidReason(bet);
  if (why === 'none') return t('pickSome');
  if (why === 'all') return t('pickAll');
  if (why === 'long') return t('tooLong', { max: MAX_MULT });
  if (why) return t('badTable');
  if (wager === null || wager <= 0n) return t('enterStake');
  const bal = balance();
  if (bal !== undefined && wager > bal) return t('insufficient');
  const max = platformMaxWager(bet);
  if (max !== undefined && wager > max) return t('overLimit', { max: money(max) });
  return null;
}

function renderBet(): void {
  const el = document.getElementById('bet');
  const boss = currentBoss();
  if (!el || !boss || !active) return;
  const bet = currentPick(boss);
  const wager = parseAmount(wagerText, decimals());
  const valid = !invalidReason(bet);
  const problem = betProblem(bet, wager);
  const win = valid && wager ? payoutFor(wager, bet) : null;
  const balEl = document.getElementById('balance');
  const bal = balance();
  if (balEl) balEl.textContent = bal === undefined ? '—' : money(bal);
  el.innerHTML = `
    <div class="bet__sum">
      <div><span>${t('picked')}</span><b>${bet.picks.length} / ${boss.loot.length}</b></div>
      <div><span>${t('winChance')}</span><b>${valid ? formatPct(winChance(bet)) : '—'}</b></div>
      <div><span>${t('odds')}</span><b class="odds">${valid ? formatMult(multiplier(bet)) : '—'}</b></div>
      <div><span>${t('winAmount')}</span><b class="gold">${win !== null ? money(win) : '—'}</b></div>
    </div>
    <div class="bet__row">
      <label class="wager">
        <span>${t('stake')}</span>
        <input id="wager" class="input" inputmode="decimal" autocomplete="off" value="${esc(wagerText)}" ${inFlight() ? 'disabled' : ''}/>
        <span class="muted">${symbol()}</span>
      </label>
      <div class="quick">
        <button class="btn btn--ghost btn--sm" data-amt="half">½</button>
        <button class="btn btn--ghost btn--sm" data-amt="double">2×</button>
        <button class="btn btn--ghost btn--sm" data-amt="max">${t('max')}</button>
      </div>
      <button class="btn btn--big btn--fight" data-fight ${problem || inFlight() ? 'disabled' : ''}>${t('fight')}</button>
    </div>
    <p class="bet__note ${error ? 'err' : ''}">${esc(error ?? problem ?? t('betNote', { xp: xpFor(active, boss.dungeon) }))}</p>`;
}

// ------------------------------------------------------------------ fight + loot window

function partyFor(c: Character): Array<{ name: string; cls: ClassKey; you?: boolean }> {
  const others = CLASS_KEYS.filter(k => k !== c.cls);
  const tank = others.includes('warblade') ? 'warblade' : 'shadowblade';
  const healer = others.includes('lightbinder') ? 'lightbinder' : 'hexcaster';
  const dps = others.filter(k => k !== tank && k !== healer).slice(0, 2);
  return [
    { name: c.name, cls: c.cls, you: true },
    { name: t('tank'), cls: tank },
    { name: t('healer'), cls: healer },
    { name: t('dps'), cls: dps[0] },
    { name: t('dps'), cls: dps[1] },
  ];
}

let fightTimer = 0;
let bossHp = 100;

function renderFight(): void {
  const overlay = document.getElementById('overlay');
  if (!overlay || !round || !active) return;
  const r = round;
  if (r.status !== 'revealed') {
    overlay.innerHTML = `
    <div class="modal">
      <div class="fight panel">
        <div class="fight__boss">
          <div class="fight__model">${img(bossPortrait(r.boss), '', '')}</div>
          <div class="fight__bossname">${esc(tx(r.boss.name))}<small>${esc(tx(r.boss.dungeon.name))}</small></div>
          <div class="hp hp--boss"><span id="boss-hp" style="width:${bossHp}%"></span><em id="boss-hp-text">${Math.ceil(bossHp)}%</em></div>
        </div>
        <div class="fight__arena" id="arena"></div>
        <div class="fight__party">
          ${partyFor(active).map(p => `
            <div class="unit${p.you ? ' you' : ''}">
              ${emblem(p.cls, 'sm')}
              <div class="unit__bars">
                <span class="unit__name" style="color:${CLASSES[p.cls].color}">${esc(p.name)}</span>
                <div class="hp"><span style="width:${70 + Math.random() * 30}%"></span></div>
              </div>
            </div>`).join('')}
        </div>
        <p class="fight__status muted">${r.status === 'opening' ? (live() ? t('waitingWallet') : t('entering')) : live() ? t('fightingChain') : t('fighting')}</p>
      </div>
    </div>`;
    overlay.querySelector('.fight__model img')?.setAttribute('id', 'boss-model');
    startFightLoop();
    return;
  }
  stopFightLoop();
  const item = r.boss.loot[r.dropped!].item;
  const won = r.bet.picks.includes(r.dropped!);
  const equipNowDelta = won ? bestUpgrade(active, item.id)?.gain ?? 0 : 0;
  const notes = [
    pendingLevelUp ? `<div class="levelup">${t('levelUp', { level: active.level })}</div>` : '',
    ...(r.unlocked ?? []).map(d => `<div class="unlock">🔓 ${t('unlocked', { name: tx(d.name) })}</div>`),
  ].join('');
  overlay.innerHTML = `
  <div class="modal" data-close-bg>
    <div class="lootwin panel ${won ? 'won' : 'lost'} q${item.quality}glow">
      <div class="lootwin__title">${t('defeated', { boss: esc(tx(r.boss.name)) })}</div>
      <div class="lootwin__slot">
        ${itemImg(item, 'lg')}
        <span class="q${item.quality}">${esc(tx(item.name))}</span>
      </div>
      <div class="lootwin__tip tt">${itemCard(item)}</div>
      <div class="lootwin__result">
        ${won
          ? `<div class="res res--win">${t('youCalledIt')}<b>+${money(r.payout ?? 0n)}</b><small>${t('inBags', { item: esc(tx(item.name)) })}</small></div>`
          : `<div class="res res--lose">${t('missed')}<small>${t('missedNote', { stake: money(r.wager) })}</small></div>`}
        <div class="res__xp">${t('xpGain', { xp: lastXp })}</div>
        ${notes}
      </div>
      <div class="lootwin__actions">
        ${won && !cannotEquip(active, item) ? `<button class="btn" data-equip-now="${item.id}">${equipNowDelta > 0 ? t('equipGain', { n: equipNowDelta }) : t('equipNow')}</button>` : ''}
        ${won ? `<button class="btn${item.quality >= 4 || (r.brag?.mult ?? 0) >= 10 ? ' btn--shine' : ' btn--ghost'}" data-share-brag>${t('shareBrag')}</button>` : ''}
        <button class="btn btn--ghost" data-close>${t('close')}</button>
        <button class="btn btn--big" data-again>${t('again')}</button>
      </div>
    </div>
  </div>`;
}

function startFightLoop(): void {
  if (fightTimer) return;
  const tick = () => {
    fightTimer = 0;
    if (!round || round.status === 'revealed') return;
    // Chip the boss down but never kill it before the result is in.
    bossHp = Math.max(8, bossHp - (3 + Math.random() * 7));
    const hp = document.getElementById('boss-hp');
    const txt = document.getElementById('boss-hp-text');
    if (hp) hp.style.width = `${bossHp}%`;
    if (txt) txt.textContent = `${Math.ceil(bossHp)}%`;
    floatText();
    const model = document.getElementById('boss-model');
    if (model) {
      model.classList.remove('hit');
      void model.offsetWidth;
      model.classList.add('hit');
    }
    Math.random() < 0.6 ? sfx.hit() : sfx.spell();
    fightTimer = window.setTimeout(tick, 170 + Math.random() * 160);
  };
  fightTimer = window.setTimeout(tick, 200);
}

function stopFightLoop(): void {
  window.clearTimeout(fightTimer);
  fightTimer = 0;
}

function floatText(): void {
  const arena = document.getElementById('arena');
  if (!arena) return;
  const el = document.createElement('span');
  const crit = Math.random() < 0.2;
  el.className = `float${crit ? ' crit' : ''}${Math.random() < 0.25 ? ' heal' : ''}`;
  el.textContent = `${Math.floor((crit ? 2 : 1) * (40 + Math.random() * 260) * (1 + (active?.level ?? 1) / 6))}`;
  el.style.left = `${10 + Math.random() * 80}%`;
  arena.appendChild(el);
  window.setTimeout(() => el.remove(), 900);
}

let lastXp = 0;
let pendingLevelUp = false;

/** The drop is known: finish the fight on screen, then open the loot window. */
function present(dropped: number, payout: bigint): void {
  if (!round || round.status === 'revealed' || round.presenting || !active) return;
  const r = round;
  r.presenting = true;
  const wait = Math.max(0, 1600 - (performance.now() - r.startedAt));
  window.setTimeout(() => {
    if (round !== r) return;
    bossHp = 0;
    const hp = document.getElementById('boss-hp');
    if (hp) hp.style.width = '0%';
    document.getElementById('boss-model')?.classList.add('dead');
    stopFightLoop();
    sfx.bossDie();
    window.setTimeout(() => reveal(r, dropped, payout), 650);
  }, wait);
}

function reveal(r: Round, dropped: number, payout: bigint): void {
  if (round !== r || r.status === 'revealed' || !active) return;
  const lockedBefore = DUNGEONS.filter(d => lockReason(active!, d));
  r.status = 'revealed';
  r.dropped = dropped;
  r.payout = payout;
  const won = r.bet.picks.includes(dropped);
  const item = r.boss.loot[dropped].item;
  if (link.mode === 'demo') demoBalance += payout;
  if (won) {
    active.bag.push(item.id);
    r.brag = { character: active, boss: r.boss, item, chance: winChance(r.bet), mult: multiplier(r.bet), won: money(payout) };
  }
  active.kills[r.boss.id] = (active.kills[r.boss.id] ?? 0) + 1;
  lastXp = xpFor(active, r.boss.dungeon);
  pendingLevelUp = gainXp(active, lastXp) > 0;
  r.unlocked = lockedBefore.filter(d => !lockReason(active!, d));
  save('cd.pending', null);
  persist();
  if (r.sessionId && link.api) {
    // Required guest step: the host withholds the payout from its balance displays until now.
    void link.api.revealOutcome({ sessionId: r.sessionId }).catch(() => {});
  }
  sfx.loot();
  window.setTimeout(() => {
    if (won) (item.quality >= 4 ? sfx.epic : sfx.win)();
    else sfx.lose();
    if (pendingLevelUp) window.setTimeout(sfx.levelUp, 500);
  }, 350);
  render();
}

function closeRound(): void {
  if (round?.status !== 'revealed') return;
  round = null;
  pendingLevelUp = false;
  render();
}

// ------------------------------------------------------------------ betting

async function fight(): Promise<void> {
  unlockAudio();
  const boss = currentBoss();
  if (!boss || !active || inFlight()) return;
  const bet = currentPick(boss);
  const wager = parseAmount(wagerText, decimals());
  if (betProblem(bet, wager) || !wager) return;
  error = null;
  bossHp = 100;
  const r: Round = { boss, bet, wager, status: 'opening', startedAt: performance.now() };
  round = r;
  save('cd.wager', wagerText);

  if (link.mode === 'demo') {
    demoBalance -= wager;
    persist();
    r.status = 'waiting';
    render();
    const total = bet.weights.reduce((a, b) => a + b, 0);
    const dropped = slotOf(bet.weights, demoRoll(total));
    window.setTimeout(() => present(dropped, bet.picks.includes(dropped) ? payoutFor(wager, bet) : 0n), 900 + Math.random() * 900);
    return;
  }

  render();
  try {
    const bal = balance();
    if (bal !== undefined) r.balanceFloor = bal - wager;
    const { sessionKey } = await link.api!.openSession({ wager: wager.toString(), gameData: encodeGameData(bet) });
    r.sessionKey = sessionKey;
    r.status = 'waiting';
    save('cd.pending', { sessionKey, bossId: boss.id, charId: active.id });
    settleFromSnapshot();
    render();
  } catch (cause) {
    round = null;
    error = friendlyError(cause);
    render();
  }
}

function friendlyError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/BetRiskExceedsLimit|InsufficientPortfolioReserve/i.test(message)) return t('errRisk');
  if (/reject|denied|cancel/i.test(message)) return t('errCancelled');
  if (/insufficient/i.test(message)) return t('insufficient');
  return message ? message.slice(0, 140) : t('errGeneric');
}

/** Moves the live round forward from the latest host snapshot. */
function settleFromSnapshot(): void {
  if (!live() || !round || round.status !== 'waiting') return;
  const r = round;
  const row = link.snapshot!.sessions.items.find(
    item => item.sessionKey === r.sessionKey || (r.sessionId !== undefined && item.sessionId === r.sessionId),
  );
  if (!row) return;
  if (!row.sessionId.startsWith('pending')) r.sessionId = row.sessionId;
  const terminal = row.isSettled || row.phaseName === 'SETTLED' || row.phaseName === 'FORFEITED' || row.phaseName === 'CANCELLED';
  if (!terminal) return;
  if (row.phaseName === 'CANCELLED' || row.phaseName === 'FORFEITED') {
    round = null;
    save('cd.pending', null);
    error = t('errChainCancelled');
    render();
    return;
  }
  const state = decodeGameState(row.raw.gameState);
  if (state && state.index < r.boss.loot.length) {
    const payout = row.payout !== undefined ? BigInt(row.payout) : state.won ? payoutFor(r.wager, r.bet) : 0n;
    present(state.index, payout);
  }
}

/** After a refresh mid-round, pick the open session back up instead of starting blank. */
function adoptOpenSession(): void {
  if (adoptChecked || !live() || round) return;
  adoptChecked = true;
  const pending = load<{ sessionKey: string; bossId: number; charId: string } | null>('cd.pending', null);
  if (!pending) return;
  const game = link.snapshot!.integration.gameAddress.toLowerCase();
  const open = link.snapshot!.sessions.items.find(item => item.gameAddress.toLowerCase() === game && item.sessionKey === pending.sessionKey);
  const boss = findBoss(pending.bossId);
  const bet = decodeGameData(open?.raw.gameData);
  if (!open || !boss || !bet || !open.wager || active?.id !== pending.charId) return;
  if (bet.weights.length !== boss.loot.length) return;
  dungeonKey = boss.dungeon.key;
  bossId = boss.id;
  picks = new Set(bet.picks);
  round = { boss, bet, wager: BigInt(open.wager), status: 'waiting', startedAt: performance.now(), sessionKey: open.sessionKey, sessionId: open.sessionId };
  render();
}

// ------------------------------------------------------------------ dialogs

const slotName = (slot: EquipSlot) => tx(EQUIP_SLOTS.find(s => s.key === slot)!.name);

function statList(c: Character): string {
  const total: Partial<Record<StatKey, number>> = {};
  for (const id of Object.values(c.equipped)) {
    const item = id !== undefined ? ITEMS.get(id) : undefined;
    if (!item) continue;
    for (const [k, v] of Object.entries(item.stats) as Array<[StatKey, number]>) if (k !== 'dps') total[k] = (total[k] ?? 0) + v;
  }
  const order: StatKey[] = ['str', 'agi', 'int', 'sta', 'wil', 'armor', 'ap', 'sp', 'crit', 'haste'];
  const rows = order.filter(k => total[k]).map(k => `<span>${tx(STAT_NAMES[k])}</span><b>${total[k]}</b>`);
  return rows.length ? rows.join('') : `<span class="muted">${t('noStats')}</span>`;
}

function openCharacter(): void {
  const overlay = document.getElementById('overlay');
  if (!overlay || !active || inFlight()) return;
  const c = active;
  const cls = CLASSES[c.cls];
  const slot = (key: EquipSlot) => {
    const id = c.equipped[key];
    const item = id !== undefined ? ITEMS.get(id) : undefined;
    return item
      ? `<button class="pslot" data-unequip="${key}" data-tip="${item.id}" data-tip-extra="<div class='tip-hint'>${t('unequipHint')}</div>">${itemImg(item, 'md')}</button>`
      : `<div class="pslot empty"><span>${slotName(key)}</span></div>`;
  };
  const ups = bagUpgrades(c);
  const bagOrder = c.bag.map((_, i) => i).sort((a, b) => (ups.get(b)?.gain ?? 0) - (ups.get(a)?.gain ?? 0));
  const left = EQUIP_SLOTS.slice(0, 8);
  const right = EQUIP_SLOTS.slice(8, 14);
  const bottom = EQUIP_SLOTS.slice(14);
  const collected = c.bag.length + Object.keys(c.equipped).length;
  const fights = Object.values(c.kills).reduce((a, b) => a + b, 0);
  overlay.innerHTML = `
  <div class="modal" data-close-bg>
    <div class="charwin panel">
      <button class="x" data-close>×</button>
      <div class="charwin__head">
        ${emblem(c.cls, 'md')}
        <div><div class="charwin__name" style="color:${cls.color}">${esc(c.name)}</div>
        <div class="muted">${t('levelClass', { level: c.level, cls: clsName(c.cls) })}</div></div>
        <div class="charwin__gs">${t('power')} <b>${power(c).toLocaleString('en-US')}</b><small>${t('gearLevel', { n: gearScore(c) })}</small></div>
      </div>
      <div class="doll">
        <div class="doll__col">${left.map(s => slot(s.key)).join('')}</div>
        <div class="doll__mid">
          ${img(classEmblem(c.cls, cls.color), 'icon doll__portrait')}
          <div class="doll__stats">
            <div>${c.level >= MAX_LEVEL ? t('maxLevel') : t('xpLine', { xp: c.xp, need: XP_PER_LEVEL })}</div>
            <div>${t('kills', { n: fights, m: collected })}</div>
          </div>
          <div class="statlist">${statList(c)}</div>
          <div class="doll__bottom">${bottom.map(s => slot(s.key)).join('')}</div>
        </div>
        <div class="doll__col">${right.map(s => slot(s.key)).join('')}</div>
      </div>
      <div class="charwin__share"><button class="btn btn--ghost btn--sm" data-share-card>${t('shareCardTitle')}</button></div>
      <div class="bag__head">
        <h4>${t('bags')} <span class="muted">${t('bagsHint', { n: c.bag.length })}${ups.size ? ` · <span class="up">${t('upgradesCount', { n: ups.size })}</span>` : ''}</span></h4>
        ${ups.size ? `<button class="btn btn--sm" data-equip-all>${t('equipAll')}</button>` : ''}
      </div>
      <div class="bag">
        ${c.bag.length ? bagOrder.map(i => {
          const id = c.bag[i];
          const item = ITEMS.get(id);
          if (!item) return '';
          const why = cannotEquip(c, item);
          const up = ups.get(i);
          const tipExtra = up ? `<div class='tip-hint'>${t('equipTo', { slot: slotName(up.slot) })}</div>` : '';
          return `<button class="bslot${why ? ' no' : ''}${up ? ' upg' : ''}" data-equip="${i}" data-tip="${id}" data-tip-extra="${tipExtra}">
            ${itemImg(item, 'md')}${up ? `<span class="upg__tag">▲${up.gain}</span>` : ''}</button>`;
        }).join('') : `<p class="muted">${t('emptyBags')}</p>`}
      </div>
    </div>
  </div>`;
}

async function shareCard(): Promise<void> {
  if (!active) return;
  const host = document.getElementById('share');
  if (!host) return;
  host.innerHTML = `<div class="modal"><div class="panel sharewin"><p class="muted">${t('making')}</p></div></div>`;
  const cv = await characterCard(active);
  await openShare(host, cv, `call-the-drop-${active.name}.png`);
}

async function shareBrag(): Promise<void> {
  const brag = round?.brag;
  const host = document.getElementById('share');
  if (!brag || !host) return;
  host.innerHTML = `<div class="modal"><div class="panel sharewin"><p class="muted">${t('making')}</p></div></div>`;
  const cv = await bragCard(brag);
  await openShare(host, cv, `call-the-drop-${tx(brag.item.name)}.png`);
}

function openHelp(): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.innerHTML = `
  <div class="modal" data-close-bg>
    <div class="helpwin panel">
      <button class="x" data-close>×</button>
      ${helpHtml(MAX_MULT, link.mode === 'demo')}
      ${link.mode === 'demo' ? `<button class="btn btn--ghost btn--sm" data-refill>${t('refill')}</button>` : ''}
    </div>
  </div>`;
}

function closeOverlay(): void {
  if (round) {
    if (round.status === 'revealed') closeRound();
    return;
  }
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.innerHTML = '';
  hideTip();
}

// ------------------------------------------------------------------ events

app.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const el = target.closest<HTMLElement>('[data-go],[data-enter],[data-delete],[data-class],[data-reroll],[data-create],[data-dungeon],[data-boss],[data-quick],[data-amt],[data-fight],[data-open],[data-sound],[data-lang],[data-close],[data-close-bg],[data-again],[data-equip],[data-equip-now],[data-unequip],[data-refill],[data-share-card],[data-share-brag],[data-equip-all]');
  if (!el) return;
  unlockAudio();
  const d = el.dataset;

  if (d.closeBg !== undefined && target !== el) return; // clicks inside the modal body
  if (d.lang !== undefined) {
    setLang(lang === 'zh' ? 'en' : 'zh');
    createName = '';
    sfx.click();
    return render();
  }
  if (d.go) {
    if (inFlight()) return;
    screen = d.go as Screen;
    if (screen === 'select') { active = null; round = null; persist(); }
    if (screen === 'create') createName = '';
    sfx.click();
    return render();
  }
  if (d.enter) {
    active = chars.find(c => c.id === d.enter) ?? null;
    screen = 'game';
    picks.clear();
    persist();
    sfx.click();
    return render();
  }
  if (d.delete) {
    const c = chars.find(x => x.id === d.delete);
    if (c && confirm(t('confirmDelete', { name: c.name }))) {
      chars = chars.filter(x => x.id !== d.delete);
      persist();
      screen = chars.length ? 'select' : 'create';
      render();
    }
    return;
  }
  if (d.class) { createClass = d.class as ClassKey; sfx.click(); return renderCreate(); }
  if (d.reroll !== undefined) { createName = randomName(); return renderCreate(); }
  if (d.create !== undefined) {
    const name = (document.getElementById('create-name') as HTMLInputElement).value.trim() || randomName();
    const c = newCharacter(name, createClass);
    chars.push(c);
    active = c;
    screen = 'game';
    dungeonKey = null;
    bossId = null;
    picks.clear();
    persist();
    sfx.levelUp();
    return render();
  }
  if (d.dungeon) {
    if (inFlight()) return;
    dungeonKey = d.dungeon;
    bossId = null;
    picks.clear();
    error = null;
    save('cd.dungeon', dungeonKey);
    sfx.click();
    renderDungeons(); renderBosses(); renderLoot(); renderBet();
    return;
  }
  if (d.boss) {
    if (inFlight()) return;
    bossId = Number(d.boss);
    picks.clear();
    error = null;
    save('cd.boss', bossId);
    sfx.click();
    renderBosses(); renderLoot(); renderBet();
    return;
  }
  if (d.quick) {
    const boss = currentBoss();
    if (!boss || !active || inFlight()) return;
    picks.clear();
    if (d.quick === 'mine') boss.loot.forEach((l, i) => usableByClass(active!, l.item) && picks.add(i));
    // Picking everything is a sure loss: leave the least likely one out.
    if (picks.size === boss.loot.length) picks.delete(boss.loot.length - 1);
    sfx.pick();
    renderLoot(); renderBet();
    return;
  }
  if (d.amt) {
    if (inFlight()) return;
    const boss = currentBoss();
    const current = parseAmount(wagerText, decimals()) ?? 0n;
    let next = d.amt === 'half' ? current / 2n : d.amt === 'double' ? current * 2n : current;
    let ceiling = balance();
    const platform = boss ? platformMaxWager(currentPick(boss)) : undefined;
    if (platform !== undefined && (ceiling === undefined || platform < ceiling)) ceiling = platform;
    if (d.amt === 'max' && ceiling !== undefined) next = ceiling;
    if (ceiling !== undefined && next > ceiling) next = ceiling;
    const floor = 10n ** BigInt(Math.max(0, decimals() - 2));
    if (next < floor) next = floor;
    wagerText = formatAmount(next, decimals(), Math.min(decimals(), 6)).replace(/,/g, '');
    error = null;
    sfx.click();
    return renderBet();
  }
  if (d.fight !== undefined) return void fight();
  if (d.open === 'char') { sfx.click(); return openCharacter(); }
  if (d.open === 'help') { sfx.click(); return openHelp(); }
  if (d.sound !== undefined) { setMuted(!isMuted()); return renderTop(); }
  if (d.close !== undefined || d.closeBg !== undefined) { sfx.click(); return closeOverlay(); }
  if (d.again !== undefined) {
    closeRound();
    return void fight();
  }
  if (d.equipNow && active) {
    const idx = active.bag.lastIndexOf(Number(d.equipNow));
    if (idx >= 0) equip(active, active.bag[idx], bestUpgrade(active, active.bag[idx])?.slot);
    persist();
    sfx.loot();
    closeRound();
    return;
  }
  if (d.equip && active) {
    const id = active.bag[Number(d.equip)];
    const item = ITEMS.get(id);
    if (!item || cannotEquip(active, item)) return;
    equip(active, id, bestUpgrade(active, id)?.slot);
    persist();
    sfx.loot();
    renderTop(); renderDungeons(); renderBet();
    return openCharacter();
  }
  if (d.equipAll !== undefined && active) {
    const gain = equipAllUpgrades(active);
    persist();
    if (gain > 0) sfx.levelUp();
    renderTop(); renderDungeons(); renderBet();
    return openCharacter();
  }
  if (d.unequip && active) {
    unequipSlot(active, d.unequip as EquipSlot);
    persist();
    sfx.click();
    renderTop(); renderDungeons(); renderBet();
    return openCharacter();
  }
  if (d.shareCard !== undefined) { sfx.click(); return void shareCard(); }
  if (d.shareBrag !== undefined) { sfx.click(); return void shareBrag(); }
  if (d.refill !== undefined) {
    demoBalance = DEMO_START;
    persist();
    renderTop();
    return closeOverlay();
  }
});

app.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  const row = input.closest<HTMLElement>('[data-pick]');
  if (!row || inFlight()) return;
  const i = Number(row.dataset.pick);
  if (input.checked) { picks.add(i); sfx.pick(); } else { picks.delete(i); sfx.unpick(); }
  error = null;
  row.classList.toggle('on', input.checked);
  renderBet();
});

app.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'wager') {
    wagerText = input.value;
    error = null;
    const caret = input.selectionStart;
    renderBet();
    const next = document.getElementById('wager') as HTMLInputElement | null;
    next?.focus();
    if (next && caret !== null) next.setSelectionRange(caret, caret);
  }
  if (input.id === 'create-name') createName = input.value;
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeOverlay();
});

render();
