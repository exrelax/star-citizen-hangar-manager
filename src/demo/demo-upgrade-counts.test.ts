import { describe, expect, it } from 'vitest';
import { demoCatalog } from './catalog';
import { DEFAULT_DEMO_SETTINGS } from './demo-settings';
import { demoBaseShipCounts, type DemoCountsInput } from './demo-upgrade-counts';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const { ships } = demoCatalog(undefined, undefined);

const input = (overrides: Partial<DemoCountsInput> = {}): DemoCountsInput => ({
  key: 'test-key',
  settings: DEFAULT_DEMO_SETTINGS,
  ships,
  storeItems: undefined,
  buyable: undefined,
  realIncreases: [],
  today: TODAY,
  now: NOW,
  ...overrides,
});

describe('demoBaseShipCounts', () => {
  it('counts the generated demo hangar and buy back', () => {
    const countsOf = demoBaseShipCounts(input());
    const counts = ships.map((ship) => countsOf({ id: ship.id }));
    expect(counts.every((entry) => entry?.buybackCcus !== undefined)).toBe(true);
    expect(counts.some((entry) => entry!.owned > 0)).toBe(true);
    expect(counts.some((entry) => entry!.hangarCcus > 0)).toBe(true);
    expect(counts.some((entry) => entry!.buybackCcus! > 0)).toBe(true);
    expect(
      counts.some((entry) => entry!.owned + entry!.hangarCcus + entry!.buybackCcus! === 0),
    ).toBe(true);
  });

  it('follows the demo key', () => {
    const totals = (key: string) => {
      const countsOf = demoBaseShipCounts(input({ key }));
      return ships.map((ship) => JSON.stringify(countsOf({ id: ship.id }))).join();
    };
    expect(totals('test-key')).toBe(totals('test-key'));
    expect(totals('another-key')).not.toBe(totals('test-key'));
  });

  it('shows no counts with the own pledges as source or without a key', () => {
    const own = demoBaseShipCounts(
      input({ settings: { ...DEFAULT_DEMO_SETTINGS, source: 'own' } }),
    );
    const keyless = demoBaseShipCounts(input({ key: null }));
    expect(ships.every((ship) => own({ id: ship.id }) === undefined)).toBe(true);
    expect(ships.every((ship) => keyless({ id: ship.id }) === undefined)).toBe(true);
  });
});
