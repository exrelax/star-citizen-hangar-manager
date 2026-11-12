import { describe, expect, it } from 'vitest';
import type { PledgeView } from '@/hangar/pledge-view';
import { adviceEvents } from './advice-events';
import type { CcuAdviceGroup, CcuSwitch } from './ccu-advice';
import type { ExpectedPriceIncrease } from './price-increases';

const prospector: ExpectedPriceIncrease = {
  ship: { id: 109, name: 'Prospector' },
  priceIncreaseAt: { at: 2000 },
  price: { from: 155, to: 175 },
};
const liberator: ExpectedPriceIncrease = {
  ship: { id: 224, name: 'Liberator' },
  priceIncreaseAt: { at: 1000 },
};
const ship = (id: number, name: string, msrp: number) => ({ id, name, msrp });
const ccus = (...ids: number[]) =>
  ids.map((id) => ({ id, isGiftable: true, valueUsd: 15 }) as PledgeView);

const plan: CcuSwitch = {
  from: ship(32, 'Freelancer MAX', 150),
  choice: 'alwaysAvailable',
  holdings: { hangarShips: 0, hangarCcus: 3, buybackCcus: 0 },
  alternatives: [],
  to: ship(109, 'Prospector', 155),
  price: 5,
  total: 0,
  upgradeValueAfter: 25,
  discountAfter: 20,
  storeCreditNeeded: 0,
};
/** A group of `count` CCUs from the Prospector, each kept: $25 → $5 of upgrade value, paid $15. */
const group = (
  target: string,
  ids: number[],
  extra: Partial<CcuAdviceGroup> = {},
): CcuAdviceGroup => ({
  increase: prospector,
  target: ship(ids[0]!, target, 180),
  ccus: ccus(...ids),
  meltValue: 15 * ids.length,
  giftable: ids.length,
  keep: {
    upgradeValueNow: 25 * ids.length,
    upgradeValueAfter: 5 * ids.length,
    discountNow: 10 * ids.length,
    discountAfter: -10 * ids.length,
  },
  targetInConcept: false,
  switch: { ...plan, total: 5 * ids.length },
  ...extra,
});

describe('adviceEvents (#274)', () => {
  it('sums the groups of a rising ship, the most discount at stake first', () => {
    const [event] = adviceEvents([group('Fortune', [1, 2]), group('Vulture', [3, 4, 5])], 0);
    expect(event?.rows.map((row) => row.group.target.name)).toEqual(['Vulture', 'Fortune']);
    expect(event?.rows[0]).toMatchObject({ today: 30, kept: -30, swapped: 60, credit: 30 });
    expect(event?.plan).toMatchObject({
      ccus: 5,
      giftable: 5,
      total: 25,
      swapped: 100,
      credit: 50,
      storeCreditNeeded: 0,
      enoughStoreCredit: true,
    });
    expect(event?.outcome).toEqual({ ccus: 5, today: 50, kept: -50, swapped: 100, credit: 50 });
  });

  it('needs store credit where melting gives back less than the new CCUs cost', () => {
    const cheap = group('Fortune', [1, 2], { meltValue: 4 });
    const [event] = adviceEvents([cheap], 2);
    expect(event?.plan).toMatchObject({
      credit: -6,
      storeCreditNeeded: 6,
      enoughStoreCredit: false,
    });
  });

  it('lists the groups without a recommendation apart, and leaves out the outcome when unknown', () => {
    const unknown = group('Merchantman', [7], {
      increase: liberator,
      switch: undefined,
      keep: undefined,
    });
    const noKeep = group('Fortune', [1], { keep: undefined });
    const [first, second] = adviceEvents([unknown, noKeep]);
    expect(first?.increase).toBe(prospector);
    expect(first?.outcome).toBeUndefined();
    expect(second).toMatchObject({ increase: liberator, rows: [], others: [unknown] });
    expect(second?.plan).toBeUndefined();
  });

  it('puts the rising ship of the CCU it was opened from first, and marks its row', () => {
    const unknown = group('Merchantman', [7], { increase: liberator, switch: undefined });
    const events = adviceEvents([group('Fortune', [1]), unknown], undefined, 7);
    expect(events.map((event) => event.increase.ship.name)).toEqual(['Liberator', 'Prospector']);
    const [only] = adviceEvents([group('Fortune', [1]), group('Vulture', [2])], undefined, 2);
    expect(only?.rows.find((row) => row.origin)?.group.target.name).toBe('Vulture');
  });
});
