import { describe, expect, it } from 'vitest';
import { DEMO } from '@/config';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { generateBuyback } from './generate-buyback';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('generateBuyback (#177)', () => {
  it('is the same for a key, newest melted first, with made-up ids', () => {
    const first = generateBuyback(FALLBACK_CATALOG, 'key-a', TODAY);
    expect(generateBuyback(FALLBACK_CATALOG, 'key-a', TODAY)).toEqual(first);
    const dates = first.pledges.map((pledge) => pledge.reclaimedAt!);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const pledge of first.pledges) expect(pledge.id).toBeLessThan(DEMO.idBase - 100_000);
    expect(first.tokens).toBeGreaterThan(0);
  });
});

describe.each(['key-a', 'key-b', 'key-c'])('the generated buy back of %s', (key) => {
  const { buyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);

  it('has pledges of each kind', () => {
    for (const filter of ['ships', 'ccus', 'paints', 'gameAccess', 'lti', 'rewards'] as const) {
      expect(buyback.some(BUYBACK_FILTER_PREDICATES[filter])).toBe(true);
    }
  });

  it('has prices of every source, and a pledge without one (#185)', () => {
    const sources = new Set(buyback.map((pledge) => pledge.price?.source ?? 'none'));
    expect([...sources].sort()).toEqual(['none', 'rsi', 'ships', 'store']);
  });

  it('has orders paid with money, and shows only made-up ids', () => {
    expect(buyback.some((pledge) => pledge.order)).toBe(true);
    for (const pledge of buyback) {
      expect(pledge.displayId).toMatch(/[A-Z]/);
      expect(pledge.searchText).not.toContain(String(pledge.id));
      if (pledge.order) expect(pledge.order.id).not.toMatch(/^DEMO/);
    }
  });
});
