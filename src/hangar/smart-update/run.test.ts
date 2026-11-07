import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hangarMeta, hangarSnapshot } from '../hangar-storage';
import type { PledgePage } from '../parse-pledges';
import { HANGAR_SNAPSHOT_VERSION, type Pledge, type PledgeCategory } from '../pledge';
import type { FetchPledgePage } from '../sync';
import { runSmartUpdate } from './run';

const pledge = (id: number, overrides: Partial<Pledge> = {}) =>
  ({
    id,
    name: `P${id}`,
    title: `P${id}`,
    value: '',
    items: [],
    ...overrides,
  }) as unknown as Pledge;

const stored = Array.from({ length: 30 }, (_, index) => pledge((30 - index) * 10));

function rsi(pledges: Pledge[], categories: Partial<Record<PledgeCategory, Pledge[]>> = {}) {
  const page = (list: Pledge[], number: number): PledgePage => ({
    pledges: list.slice((number - 1) * 10, number * 10),
    lastPage: Math.max(1, Math.ceil(list.length / 10)),
  });
  const fetchPage: FetchPledgePage = async (number, category) =>
    page(category ? (categories[category] ?? []) : pledges, number);
  return fetchPage;
}

const deps = (fetchPage: FetchPledgePage) => ({
  fetchPage,
  fetchShipImages: async () => new Map(),
  fetchShipLinks: async () => ({}),
  now: () => Date.parse('2026-11-01T12:00:00Z'),
});

beforeEach(async () => {
  fakeBrowser.reset();
  await hangarSnapshot.setValue({
    version: HANGAR_SNAPSHOT_VERSION,
    syncedAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    pledges: stored,
  });
});

describe('runSmartUpdate', () => {
  it('only records the check when nothing changed', async () => {
    const before = await hangarSnapshot.getValue();
    const outcome = await runSmartUpdate(deps(rsi(stored)));

    expect(outcome).toMatchObject({ status: 'unchanged', added: 0, removed: 0, changed: 0 });
    expect(await hangarSnapshot.getValue()).toEqual(before);
    expect(await hangarMeta.getValue()).toMatchObject({
      checkedAt: Date.parse('2026-11-01T12:00:00Z'),
      lastOutcome: { status: 'unchanged' },
    });
  });

  it('stores changes and tags new pledges with their RSI category', async () => {
    const newShip = pledge(999);
    const outcome = await runSmartUpdate(
      deps(rsi([newShip, ...stored.slice(1)], { standalone_ship: [newShip] })),
    );

    expect(outcome).toMatchObject({ status: 'updated', added: 1, removed: 1 });
    const snapshot = await hangarSnapshot.getValue();
    expect(snapshot?.pledges.map((p) => p.id).slice(0, 2)).toEqual([999, 290]);
    expect(snapshot?.pledges[0]?.category).toBe('standalone_ship');
    expect(snapshot?.syncedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(snapshot?.updatedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('does not overwrite a full sync that finished during the check', async () => {
    const fetchPage = rsi([pledge(999), ...stored]);
    const outcome = await runSmartUpdate({
      ...deps(fetchPage),
      fetchPage: async (number, category) => {
        if (number === 1 && category === 'game_package') {
          await hangarSnapshot.setValue({
            version: HANGAR_SNAPSHOT_VERSION,
            syncedAt: '2026-11-01T11:59:00.000Z',
            pledges: [],
          });
        }
        return fetchPage(number, category);
      },
    });

    expect(outcome).toBeNull();
    expect((await hangarSnapshot.getValue())?.syncedAt).toBe('2026-11-01T11:59:00.000Z');
  });

  it('does nothing without a stored hangar', async () => {
    await hangarSnapshot.setValue(null);
    expect(await runSmartUpdate(deps(rsi(stored)))).toBeNull();
  });
});
