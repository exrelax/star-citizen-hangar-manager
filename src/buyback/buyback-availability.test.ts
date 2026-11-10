import { describe, expect, it } from 'vitest';
import type { BuybackPledge } from './buyback';
import { createAvailabilityCheck } from './buyback-availability';
import { BUYBACK_FILTER_PREDICATES, toBuybackView } from './buyback-view';

const ccu = (fromShipId: number, toShipId: number): BuybackPledge => ({
  id: 1,
  title: 'Upgrade - A to B',
  contained: 'Upgrade - A to B',
  isUpgrade: true,
  upgrade: { fromShipId, toShipId, toSkuId: 1 },
});

const availabilityOf = createAvailabilityCheck([
  { id: 84, name: 'Hull A', msrp: 90 },
  { id: 150, name: 'Hawk', msrp: 75 },
  { id: 222, name: 'Railen', msrp: 225 },
  { id: 178, name: 'Corsair', msrp: 225 },
  { id: 5, name: 'Aurora Mk I CL', msrp: 45 },
  { id: 9, name: 'Not sold', msrp: 0 },
]);

describe('createAvailabilityCheck', () => {
  it('marks CCUs whose base ship costs as much as or more than the target ship today', () => {
    expect(availabilityOf(ccu(84, 150))).toEqual({
      from: { name: 'Hull A', msrp: 90 },
      to: { name: 'Hawk', msrp: 75 },
    });
    expect(availabilityOf(ccu(222, 178))?.to).toEqual({ name: 'Corsair', msrp: 225 });
  });

  it('leaves CCUs to a more expensive ship, unknown ships and other pledges alone', () => {
    expect(availabilityOf(ccu(5, 150))).toBeUndefined();
    expect(availabilityOf(ccu(84, 999))).toBeUndefined();
    expect(availabilityOf(ccu(84, 9))).toBeUndefined();
    expect(availabilityOf({ ...ccu(84, 150), upgrade: undefined })).toBeUndefined();
    expect(
      availabilityOf({ ...ccu(84, 150), isUpgrade: false, title: 'Paints - X', contained: 'X' }),
    ).toBeUndefined();
  });
});

describe('filter "available"', () => {
  it('keeps what RSI can sell again', () => {
    const view = (pledge: BuybackPledge) => toBuybackView(pledge, { position: 0, availabilityOf });
    expect(BUYBACK_FILTER_PREDICATES.available(view(ccu(5, 150)))).toBe(true);
    expect(BUYBACK_FILTER_PREDICATES.available(view(ccu(84, 150)))).toBe(false);
  });
});

describe('probably giftable', () => {
  it("is never what RSI can't sell again", () => {
    const view = (pledge: BuybackPledge) =>
      toBuybackView(pledge, { position: 0, availabilityOf, giftable: () => true });
    expect(view(ccu(5, 150)).isProbablyGiftable).toBe(true);
    expect(view(ccu(84, 150)).isProbablyGiftable).toBe(false);
  });
});
