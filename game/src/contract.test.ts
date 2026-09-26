// Compiles CallTheDropGame.sol, runs it in an in-process EVM and checks it against odds.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEVM } from '@ethereumjs/evm';
import { Address, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { decodeFunctionResult, encodeFunctionData, keccak256, toHex, type Abi, type Hex } from 'viem';
import solc from 'solc';
import { beforeAll, describe, expect, it } from 'vitest';
import { decodeGameState, encodeGameData, invalidReason, payoutFor, slotOf, type Pick } from './odds';

const DIR = join(__dirname, '..', 'contracts');
let abi: Abi;
let call: (fn: string, args: unknown[]) => Promise<{ ok: true; value: any } | { ok: false; error: string }>;

beforeAll(async () => {
  const input = {
    language: 'Solidity',
    sources: {
      'CallTheDropGame.sol': { content: readFileSync(join(DIR, 'CallTheDropGame.sol'), 'utf8') },
      'ICasinoGameV2.sol': { content: readFileSync(join(DIR, 'ICasinoGameV2.sol'), 'utf8') },
    },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e: any) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e: any) => e.formattedMessage).join('\n'));
  const c = out.contracts['CallTheDropGame.sol'].CallTheDropGame;
  abi = c.abi;
  const code = hexToBytes(`0x${c.evm.deployedBytecode.object}`);
  const evm = await createEVM();
  const to = new Address(hexToBytes('0x00000000000000000000000000000000000000aa'));
  await evm.stateManager.putCode(to, code);
  call = async (fn, args) => {
    const data = encodeFunctionData({ abi, functionName: fn, args } as any);
    const res = await evm.runCall({ to, data: hexToBytes(data), gasLimit: 30_000_000n });
    const ret = bytesToHex(res.execResult.returnValue) as Hex;
    if (res.execResult.exceptionError) return { ok: false, error: ret };
    return { ok: true, value: decodeFunctionResult({ abi, functionName: fn, data: ret } as any) };
  };
}, 120_000);

const errorSelector = (sig: string) => keccak256(toHex(sig)).slice(0, 10);

function ctx(wager: bigint, gameData: Hex) {
  return {
    sessionId: 1n, player: '0x0000000000000000000000000000000000000001', vault: '0x0000000000000000000000000000000000000002',
    wagerBase: wager, escrowedStake: wager, reservedProfit: 0n, step: 0, gameData, gameState: '0x',
  };
}

function randomBet(rng: () => number): Pick {
  const n = 2 + Math.floor(rng() * 31);
  const weights = Array.from({ length: n }, () => 1 + Math.floor(rng() * (rng() < 0.2 ? 65535 : 3000)));
  const picks = weights.map((_, i) => i).filter(() => rng() < 0.3);
  if (!picks.length) picks.push(Math.floor(rng() * n));
  return { weights, picks };
}

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('CallTheDropGame', () => {
  it('settles exactly like the TS mirror', async () => {
    const rng = mulberry(7);
    let checked = 0;
    for (let k = 0; k < 150; k++) {
      const bet = randomBet(rng);
      const gameData = encodeGameData(bet);
      const wager = BigInt(1 + Math.floor(rng() * 1e9)) * 10n ** 9n;
      const randomness = keccak256(toHex(`vrf-${k}`));
      const res = await call('onRandomness', [ctx(wager, gameData), randomness]);
      const reason = invalidReason(bet);
      if (reason) {
        expect(res.ok, `bet ${k} should revert (${reason})`).toBe(false);
        continue;
      }
      expect(res.ok).toBe(true);
      const step = (res as any).value;
      const state = decodeGameState(step.newGameState)!;
      const t = bet.weights.reduce((a, b) => a + b, 0);
      expect(state.total).toBe(t);
      expect(state.roll).toBeLessThan(t);
      expect(state.index).toBe(slotOf(bet.weights, state.roll));
      expect(state.won).toBe(bet.picks.includes(state.index));
      expect(step.payout).toBe(state.won ? payoutFor(wager, bet) : 0n);
      expect(step.nextPhase).toBe(3);

      const caps = (await call('quoteCaps', [wager, gameData])) as any;
      const max = payoutFor(wager, bet);
      expect(caps.value[1]).toBe(max > wager ? max - wager : 0n);
      checked++;
    }
    expect(checked).toBeGreaterThan(60);
  });

  it('returns exactly 96% in expectation for every pick', async () => {
    const bet: Pick = { weights: [1600, 1560, 1070, 1030], picks: [2] };
    const wager = 10n ** 18n;
    const t = 5260n;
    // E[payout] = P(win) × payout = (picked/total) × wager × 0.96 × total / picked = 0.96 wager (up to wei rounding)
    const payout = payoutFor(wager, bet);
    const expected = (payout * 1070n) / t;
    expect(Number(expected) / 1e18).toBeCloseTo(0.96, 12);
    const risk = (await call('quoteRiskParams', [wager, encodeGameData(bet)])) as any;
    expect(risk.value[0]).toBe(payout);
    expect(risk.value[1]).toBe((1070n * 10n ** 18n) / t);
    expect(risk.value[2]).toBe((wager * 96n) / 100n);
  });

  it('quotes the worst case for empty gameData', async () => {
    const res = (await call('quoteCaps', [10n ** 18n, '0x'])) as any;
    expect(res.value[1]).toBe(999n * 10n ** 18n);
  });

  it('rejects malformed bets', async () => {
    const cases: Array<[Pick, string]> = [
      [{ weights: [100], picks: [0] }, 'CallTheDrop__InvalidTable()'],
      [{ weights: [100, 200], picks: [] }, 'CallTheDrop__InvalidPick()'],
      [{ weights: [100, 200], picks: [0, 1] }, 'CallTheDrop__InvalidPick()'],
      [{ weights: [1, 65535, 65535], picks: [0] }, 'CallTheDrop__OddsTooLong()'],
    ];
    for (const [bet, err] of cases) {
      const res = await call('onSessionStart', [ctx(10n ** 18n, encodeGameData(bet))]);
      expect(res.ok).toBe(false);
      expect((res as any).error.slice(0, 10)).toBe(errorSelector(err));
    }
    // A gap inside the table: slot 1 empty, slot 2 set.
    const gap = `0x${(100n | (300n << 32n)).toString(16).padStart(64, '0')}${'0'.repeat(64)}${(1n).toString(16).padStart(64, '0')}` as Hex;
    const res = await call('onSessionStart', [ctx(10n ** 18n, gap)]);
    expect((res as any).error.slice(0, 10)).toBe(errorSelector('CallTheDrop__InvalidTable()'));
  });

  it('previewOutcome matches settlement', async () => {
    const bet: Pick = { weights: [1600, 1560, 1070, 1030], picks: [0, 3] };
    const randomness = keccak256(toHex('preview'));
    const gd = encodeGameData(bet);
    const preview = (await call('previewOutcome', [gd, randomness])) as any;
    const step = (await call('onRandomness', [ctx(10n ** 18n, gd), randomness])) as any;
    const state = decodeGameState(step.value.newGameState)!;
    expect(Number(preview.value[0])).toBe(state.index);
    expect(Number(preview.value[1])).toBe(state.roll);
  });
});
