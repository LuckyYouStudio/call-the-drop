// Mirror of CallTheDropGame.sol. The chain stays authoritative: live rounds are presented from the
// settled gameState; this module builds gameData, quotes the odds and drives the demo.

export const RTP_BPS = 9600n;
export const BPS = 10_000n;
export const RTP = 0.96;
export const MAX_MULT = 1000;
export const MAX_SLOTS = 32;
const SLOT_MAX = 0xffff;

/** Drop chance (percent) → contract weight: basis points of the drop rate. */
export function weightOf(pct: number): number {
  return Math.min(SLOT_MAX, Math.max(1, Math.round(pct * 100)));
}

export type Pick = { weights: number[]; picks: number[] };

export function total(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w, 0);
}

export function pickedWeight({ weights, picks }: Pick): number {
  return picks.reduce((sum, i) => sum + weights[i], 0);
}

/** Why the contract would reject this bet, or null when it is valid. */
export function invalidReason(bet: Pick): 'table' | 'none' | 'all' | 'long' | null {
  const { weights, picks } = bet;
  if (weights.length < 2 || weights.length > MAX_SLOTS || weights.some(w => !Number.isInteger(w) || w < 1 || w > SLOT_MAX)) return 'table';
  if (!picks.length) return 'none';
  const t = total(weights);
  const p = pickedWeight(bet);
  if (p >= t) return 'all';
  if (9600 * t > 10_000 * MAX_MULT * p) return 'long';
  return null;
}

/** Chance that the revealed item is one of the picks. */
export function winChance(bet: Pick): number {
  return pickedWeight(bet) / total(bet.weights);
}

/** Payout multiple shown to the player: 0.96 × total / picked. */
export function multiplier(bet: Pick): number {
  return (RTP * total(bet.weights)) / pickedWeight(bet);
}

/** Exactly the contract's `_payout`. */
export function payoutFor(wager: bigint, bet: Pick): bigint {
  return (wager * RTP_BPS * BigInt(total(bet.weights))) / (BPS * BigInt(pickedWeight(bet)));
}

export function slotOf(weights: number[], roll: number): number {
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return i;
  }
  return weights.length - 1;
}

/** Uniform demo roll in [0, domain); rejection sampling over 32 bits so the demo is unbiased too. */
export function demoRoll(domain: number): number {
  const limit = Math.floor(0x1_0000_0000 / domain) * domain;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % domain;
  }
}

// ---- ABI (three static words; no library needed) ----

const word = (value: bigint) => value.toString(16).padStart(64, '0');

export function encodeGameData(bet: Pick): `0x${string}` {
  let lo = 0n;
  let hi = 0n;
  bet.weights.forEach((w, i) => {
    if (i < 16) lo |= BigInt(w) << BigInt(i * 16);
    else hi |= BigInt(w) << BigInt((i - 16) * 16);
  });
  const mask = bet.picks.reduce((m, i) => m | (1n << BigInt(i)), 0n);
  return `0x${word(lo)}${word(hi)}${word(mask)}`;
}

export function decodeGameData(gameData: string | undefined): Pick | null {
  if (!gameData || gameData.length !== 2 + 64 * 3) return null;
  const at = (i: number) => BigInt(`0x${gameData.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
  const lo = at(0);
  const hi = at(1);
  const mask = at(2);
  const weights: number[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const w = Number(((i < 16 ? lo : hi) >> BigInt((i % 16) * 16)) & 0xffffn);
    if (!w) break;
    weights.push(w);
  }
  const picks = weights.map((_, i) => i).filter(i => (mask >> BigInt(i)) & 1n);
  return { weights, picks };
}

export type SettledState = { index: number; roll: number; total: number; won: boolean };

/** gameState = abi.encode(uint256 index, uint256 roll, uint256 total, uint256 won). */
export function decodeGameState(gameState: string | undefined): SettledState | null {
  if (!gameState || gameState.length !== 2 + 64 * 4) return null;
  const at = (i: number) => BigInt(`0x${gameState.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
  const t = Number(at(2));
  if (!t) return null;
  return { index: Number(at(0)), roll: Number(at(1)), total: t, won: at(3) === 1n };
}

// ---- token amounts ----

export function parseAmount(text: string, decimals: number): bigint | null {
  const trimmed = text.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

export function formatAmount(value: bigint, decimals: number, maxFraction = 2): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction);
  fraction = fraction.replace(/0+$/, '');
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${wholeText}${fraction ? `.${fraction}` : ''}`;
}

export function formatMult(x: number): string {
  if (x >= 100) return `${Math.floor(x)}×`;
  if (x >= 10) return `${(Math.floor(x * 10) / 10).toFixed(1)}×`;
  return `${(Math.floor(x * 100) / 100).toFixed(2)}×`;
}

export function formatPct(p: number): string {
  const pct = p * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}
