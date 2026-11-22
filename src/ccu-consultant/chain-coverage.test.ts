import { describe, expect, it } from 'vitest';
import type { AlwaysAvailableList } from './always-available';
import { chainCoverage } from './chain-coverage';
import type { CcuCoverage, CoverageMatch } from './coverage';

/*
 * The deep view's chain rule (#563): a CCU to a base ship only counts if its own base ship has a
 * way too, and each way serves one CCU.
 */

const SHIPS: Record<string, number> = { Aurora: 1, Arrow: 2, Cutlass: 3, Hull: 4, Razor: 5, Z: 9 };
type Name = keyof typeof SHIPS;

const ship = (id: number, source: 'hangar' | 'buyback' = 'hangar'): CoverageMatch => ({
  source,
  kind: 'ship',
  id,
  title: `Ship ${id}`,
});
const ccuMatch = (id: number, source: 'hangar' | 'buyback' = 'hangar'): CoverageMatch => ({
  source,
  kind: 'ccu',
  id,
  title: `CCU ${id}`,
});

/** Builds the coverages of hangar CCUs from a few lines, as `ccuCoverage` would. */
function hangar(
  ccus: { id: number; from: Name; to: Name }[],
  owned: { ships?: Partial<Record<Name, number[]>>; buyback?: Partial<Record<Name, number[]>> },
): CcuCoverage[] {
  return ccus.map((ccu) => {
    const ships = (owned.ships?.[ccu.from] ?? []).map((id) => ship(id));
    const incoming = ccus
      .filter((other) => other.to === ccu.from && other.id !== ccu.id)
      .map((other) => ccuMatch(other.id));
    const buyback = (owned.buyback?.[ccu.from] ?? []).map((id) => ship(id, 'buyback'));
    return {
      id: ccu.id,
      baseShip: { id: SHIPS[ccu.from]!, name: ccu.from },
      hangar: { ships, ccus: incoming },
      buyback: { ships: buyback, ccus: [] },
      covered: ships.length + incoming.length + buyback.length > 0,
    };
  });
}

const alwaysList = (...names: Name[]): AlwaysAvailableList => ({
  source: { id: 'wiki', name: 'Wiki', url: 'https://w', facts: [] },
  changedAt: '',
  has: (id) => names.some((name) => SHIPS[name] === id),
});

const key = (name: Name) => `id:${SHIPS[name]}`;

describe('chainCoverage (#563)', () => {
  it('counts each ship of the hangar for one CCU from it', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Arrow', to: 'Z' },
          { id: 11, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Arrow: [100] } },
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    expect(arrow.ways).toEqual({ ship: 1, chain: 0, buyback: 0 });
    expect([arrow.total, arrow.short, arrow.deepOnly]).toEqual([1, 1, false]);
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Arrow']);
    expect(result.tooFewCount).toBe(1);
  });

  it('follows a chain that starts at a ship of the hangar', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Cutlass' },
          { id: 12, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Aurora: [100] } },
      ),
      undefined,
    );
    const cutlass = result.ships.get(key('Cutlass'))!;
    expect(cutlass.ways).toEqual({ ship: 0, chain: 1, buyback: 0 });
    expect(cutlass.short).toBe(0);
    expect(cutlass.routes).toEqual([
      { path: [key('Aurora'), key('Arrow')], root: 'ship', count: 1 },
    ]);
    expect(result.tooFew).toEqual([]);
  });

  it('doesn’t count a CCU whose own base ship has no way: found by the deep view', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Z' },
        ],
        {},
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    // The simple view counts the CCU to it as its way.
    expect(arrow.simpleWays).toBe(1);
    expect([arrow.total, arrow.short, arrow.deepOnly]).toEqual([0, 1, true]);
    expect(arrow.blocked).toEqual([{ from: key('Aurora'), count: 1 }]);
    const aurora = result.ships.get(key('Aurora'))!;
    // Nothing gives it at all: short, but the simple view knows that already.
    expect([aurora.short, aurora.deepOnly]).toEqual([1, false]);
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Arrow', 'Aurora']);
    expect(result.tooFewCount).toBe(2);
  });

  it('gives every CCU its own way: one ship serves one chain', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Arrow' },
          { id: 12, from: 'Arrow', to: 'Z' },
          { id: 13, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Aurora: [100] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Aurora'))!.short).toBe(1);
    const arrow = result.ships.get(key('Arrow'))!;
    expect([arrow.ways.chain, arrow.short, arrow.deepOnly]).toEqual([1, 1, true]);
    expect(arrow.blocked).toEqual([{ from: key('Aurora'), count: 1 }]);
  });

  it('starts chains at always available ships, never short of ways themselves', () => {
    const coverages = hangar(
      [
        { id: 10, from: 'Aurora', to: 'Arrow' },
        { id: 11, from: 'Aurora', to: 'Arrow' },
        { id: 12, from: 'Arrow', to: 'Z' },
        { id: 13, from: 'Arrow', to: 'Z' },
      ],
      {},
    );
    const result = chainCoverage(coverages, alwaysList('Aurora'));
    const aurora = result.ships.get(key('Aurora'))!;
    expect([aurora.always, aurora.short]).toEqual([true, 0]);
    const arrow = result.ships.get(key('Arrow'))!;
    expect([arrow.ways.chain, arrow.short]).toEqual([2, 0]);
    expect(arrow.routes).toEqual([{ path: [key('Aurora')], root: 'always', count: 2 }]);
    // Not considered: nothing gives Aurora.
    expect(chainCoverage(coverages, undefined).tooFewCount).toBe(4);
  });

  it('counts the buy back and chains starting in it as buy back', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Z' },
          { id: 12, from: 'Arrow', to: 'Z' },
        ],
        { buyback: { Aurora: [200], Arrow: [201] } },
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    expect(arrow.ways).toEqual({ ship: 0, chain: 0, buyback: 2 });
    expect(arrow.short).toBe(0);
    expect(arrow.routes).toEqual([{ path: [key('Aurora')], root: 'buyback', count: 1 }]);
    expect(arrow.buyback.map((match) => match.id)).toEqual([201]);
  });

  it('hands the hangar’s ways on before the buy back’s', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Z' },
          { id: 12, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Aurora: [100] }, buyback: { Aurora: [200] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Arrow'))!.ways).toEqual({ ship: 0, chain: 1, buyback: 0 });
  });

  it('gives a way first to a CCU whose target lacks ways', () => {
    const result = chainCoverage(
      hangar(
        [
          // The first CCU leads to a ship the hangar has already.
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Cutlass' },
          { id: 12, from: 'Arrow', to: 'Z' },
          { id: 13, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Aurora: [100], Arrow: [101] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Cutlass'))!.short).toBe(0);
    expect(result.ships.get(key('Arrow'))!.short).toBe(0);
    // Aurora's second CCU has no way: Aurora is short, not Cutlass.
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Aurora']);
  });

  it('gives a cycle of CCUs no way without a ship', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Arrow', to: 'Cutlass' },
          { id: 11, from: 'Cutlass', to: 'Arrow' },
        ],
        {},
      ),
      undefined,
    );
    expect(result.tooFewCount).toBe(2);
    expect(result.tooFew.every((entry) => entry.deepOnly)).toBe(true);
  });

  it('sorts the base ships short of ways by the most short, then by CCUs and name', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Razor', to: 'Z' },
          { id: 11, from: 'Hull', to: 'Z' },
          { id: 12, from: 'Hull', to: 'Z' },
          { id: 13, from: 'Cutlass', to: 'Z' },
          { id: 14, from: 'Cutlass', to: 'Z' },
          { id: 15, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Cutlass: [100] } },
      ),
      undefined,
    );
    expect(result.tooFew.map((entry) => [entry.name, entry.short])).toEqual([
      ['Cutlass', 2],
      ['Hull', 2],
      ['Razor', 1],
    ]);
  });
});
