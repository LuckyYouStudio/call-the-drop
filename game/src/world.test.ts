import { describe, expect, it } from 'vitest';
import { CLASS_KEYS, bestPower, gatePower, usableByClass } from './character';
import { MAX_MULT, invalidReason } from './odds';
import { DUNGEONS, ITEMS } from './world';

describe('world', () => {
  it('is deterministic', async () => {
    const first = [...ITEMS.values()].map(i => `${i.id}:${i.name.en}:${JSON.stringify(i.stats)}`).join('|');
    const again = await import('./world?reload=' + Date.now()).catch(() => null);
    if (again) expect([...again.ITEMS.values()].map((i: any) => `${i.id}:${i.name.en}:${JSON.stringify(i.stats)}`).join('|')).toBe(first);
  });

  it('every boss table is bettable item by item', () => {
    for (const d of DUNGEONS) {
      expect(d.bosses.length).toBeGreaterThan(0);
      for (const b of d.bosses) {
        const weights = b.loot.map(l => l.weight);
        expect(weights.length).toBeGreaterThanOrEqual(2);
        expect(weights.length).toBeLessThanOrEqual(32);
        for (let i = 0; i < weights.length; i++) expect(invalidReason({ weights, picks: [i] }), `${b.name.en} #${i}`).toBeNull();
        const best = Math.max(...weights.map(w => (0.96 * weights.reduce((a, c) => a + c, 0)) / w));
        expect(best).toBeLessThanOrEqual(MAX_MULT);
      }
    }
  });

  it('every class finds gear in every dungeon', () => {
    for (const cls of CLASS_KEYS) {
      for (const d of DUNGEONS) {
        const usable = d.bosses.flatMap(b => b.loot).filter(l => usableByClass({ cls }, l.item));
        expect(usable.length, `${cls} in ${d.key}`).toBeGreaterThan(2);
      }
    }
  });

  it('raid gates are reachable and on one scale', () => {
    const throne = DUNGEONS.find(d => d.key === 'throne')!;
    const maw = DUNGEONS.find(d => d.key === 'maw')!;
    for (const cls of CLASS_KEYS) {
      const five = bestPower(cls, DUNGEONS.filter(d => !d.raid).map(d => d.key));
      expect(gatePower(cls, throne)).toBeLessThan(five);
      expect(gatePower(cls, maw)).toBeGreaterThan(gatePower(cls, throne));
      // Dungeon gear alone must not open the last raid, but dungeon + first raid gear must.
      expect(gatePower(cls, maw)).toBeGreaterThan(five);
      expect(gatePower(cls, maw)).toBeLessThan(bestPower(cls, [...DUNGEONS.filter(d => !d.raid).map(d => d.key), 'throne']));
      expect(Math.abs(bestPower(cls, DUNGEONS.map(d => d.key)) - 16200)).toBeLessThan(30);
    }
  });

  it('only original names', () => {
    const banned = /azeroth|horde|alliance|blizzard|warcraft|ragnaros|onyxia|nefarian|kel'?thuzad|thunderfury|sulfuras|ashbringer|frostmourne|deadmines|molten core|naxx/i;
    for (const i of ITEMS.values()) expect(banned.test(i.name.en), i.name.en).toBe(false);
    for (const d of DUNGEONS) {
      expect(banned.test(d.name.en)).toBe(false);
      for (const b of d.bosses) expect(banned.test(b.name.en)).toBe(false);
    }
  });
});
