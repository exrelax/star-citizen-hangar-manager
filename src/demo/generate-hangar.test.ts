import { describe, expect, it } from 'vitest';
import { DEMO } from '@/config';
import { PLEDGE_FILTER_PREDICATES } from '@/hangar/filters';
import { pledgeKind } from '@/hangar/pledge-kind';
import { FALLBACK_CATALOG, demoCatalog } from './catalog';
import { generatedDemo, generatedHangar } from './demo';
import { generateHangar } from './generate-hangar';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const total = Object.values(DEMO.composition).reduce((sum, count) => sum + count, 0);

describe('generateHangar (#175)', () => {
  it('is the same for a key and another for another key', () => {
    const first = generateHangar(FALLBACK_CATALOG, 'key-a');
    expect(generateHangar(FALLBACK_CATALOG, 'key-a')).toEqual(first);
    expect(generateHangar(FALLBACK_CATALOG, 'key-b')).not.toEqual(first);
  });

  it('has the pledges of the composition, with made-up ids far above RSI’s', () => {
    const pledges = generateHangar(FALLBACK_CATALOG, 'key-a');
    expect(pledges).toHaveLength(total);
    for (const kind of Object.keys(DEMO.composition)) {
      expect(pledges.filter((pledge) => pledge.demoKind === kind).length).toBe(
        DEMO.composition[kind as keyof typeof DEMO.composition],
      );
    }
    const ids = pledges.map((pledge) => pledge.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBeGreaterThan(DEMO.idBase - 1000);
    // Newest first, like RSI's list.
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('works without any stored catalog', () => {
    expect(demoCatalog(undefined, undefined).ships).toBe(FALLBACK_CATALOG.ships);
    expect(generateHangar(demoCatalog(undefined, [] as never), 'key')).toHaveLength(total);
  });
});

describe('generatedHangar', () => {
  const views = generatedHangar(FALLBACK_CATALOG, 'key-a', TODAY, NOW);

  it('looks like RSI’s pledges to the views: kinds, filters and discounts work', () => {
    const kinds = new Set(views.map(pledgeKind));
    for (const kind of ['ship', 'ships', 'ccu', 'paint', 'gamePackage', 'reward', 'other']) {
      expect(kinds).toContain(kind);
    }
    for (const filter of [
      'ships',
      'ccus',
      'paints',
      'gameAccess',
      'rewards',
      'discount',
    ] as const) {
      expect(views.some(PLEDGE_FILTER_PREDICATES[filter])).toBe(true);
    }
  });

  it('shows only made-up display ids and dates', () => {
    for (const view of views) {
      expect(view.displayId).toMatch(/^[0-9A-Z]{9}$/);
      expect(view.displayId).toMatch(/[A-Z]/);
      expect(view.searchText).not.toContain(String(view.id));
      expect(view.createdAt! >= DEMO.earliestDate && view.createdAt! <= TODAY).toBe(true);
    }
  });
});

describe('CCUs of the generated demo', () => {
  const { pledges, buyback, account } = generatedDemo(
    {
      ...FALLBACK_CATALOG,
      ships: [...FALLBACK_CATALOG.ships, { id: 28, name: 'Idris-P', msrp: 1500 }],
    },
    'key-a',
    TODAY,
    NOW,
  );
  const msrp = (name: string) =>
    [...FALLBACK_CATALOG.ships, { name: 'Idris-P', msrp: 1500 }].find((ship) => ship.name === name)
      ?.msrp ?? 0;

  it('go only to ships up to $1,000, as CIG sells them', () => {
    const targets = [
      ...account.pledges.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? []),
      ...[...account.upgradeLogs.values()]
        .flat()
        .map((entry) => / to (.+) \w+ Edition$/.exec(entry.name)![1]!),
      ...buyback.flatMap((pledge) => / to (.+) \w+ Edition$/.exec(pledge.title)?.[1] ?? []),
    ];
    expect(targets.length).toBeGreaterThan(10);
    for (const name of targets) expect(msrp(name)).toBeLessThanOrEqual(1000);
  });

  it('have warbond discounts in steps of $5, by the target’s price', () => {
    const warbonds = account.pledges.filter(
      (pledge) => pledge.upgrade && /Warbond Edition$/.test(pledge.title),
    );
    expect(warbonds.length).toBeGreaterThan(0);
    for (const pledge of warbonds) {
      const to = msrp(pledge.upgrade!.targetItems[0]!.name);
      const from = msrp(pledge.upgrade!.matchItems[0]!.name);
      const discount = to - from - pledge.valueUsd;
      if (pledge.valueUsd === 5) continue;
      expect(discount % 5).toBe(0);
      const [min, max] =
        to <= 150 ? [5, 10] : to <= 250 ? [15, 20] : to <= 600 ? [20, 40] : [40, 100];
      expect(discount).toBeGreaterThanOrEqual(min);
      expect(discount).toBeLessThanOrEqual(max);
    }
    expect(pledges.length).toBeGreaterThan(0);
  });
});
