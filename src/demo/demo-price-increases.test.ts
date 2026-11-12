import { describe, expect, it } from 'vitest';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { pledgesWithinDays } from '@/price-increases/price-increase-notes';
import { isWithinDays } from '@/price-increases/price-increases';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { demoNotOnSaleShip } from './demo-price-increases';
import { DEFAULT_DEMO_SETTINGS } from './demo-settings';
import type { PledgeView } from '@/hangar/pledge-view';
import { advisorNotes } from '@/price-increases/advisor-notes';
import { ccusToSecure } from '@/price-increases/ccus-to-secure';
import { hasPriceChangeWithin } from '@/price-increases/price-change-filter';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe.each(['key-a', 'key-b', 'key-c'])('the Buy Back Reminder of the demo %s (#194)', (key) => {
  const { pledges, buyback, priceIncreases } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);

  it('has every case of the data, with dates relative to now', () => {
    expect(
      priceIncreases.some((entry) => entry.flightReadyAt && entry.flightReadyAt.at > NOW),
    ).toBe(true);
    expect(priceIncreases.some((entry) => !entry.flightReadyAt)).toBe(true);
    expect(priceIncreases.some((entry) => entry.priceIncreaseAt.dayOnly)).toBe(true);
    expect(priceIncreases.some((entry) => !entry.priceIncreaseAt.dayOnly)).toBe(true);
    expect(priceIncreases.some((entry) => isWithinDays(entry, NOW, 14))).toBe(true);
    expect(priceIncreases.some((entry) => !isWithinDays(entry, NOW, 14))).toBe(true);
    expect(priceIncreases.some((entry) => entry.priceIncreaseAt.at - NOW < HOUR)).toBe(true);
  });

  it('labels a ship, a CCU and a module in the buy back, and items in My Hangar', () => {
    const labelled = buyback.filter((pledge) => pledge.priceIncrease);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'ship')).toBe(true);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'ccu')).toBe(true);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'related')).toBe(true);
    expect(pledges.some((pledge) => pledge.priceIncrease)).toBe(true);
  });

  it('gives the filter and the sidebar notification pledges inside the period, not outside', () => {
    expect(buyback.some(BUYBACK_FILTER_PREDICATES.priceIncrease)).toBe(true);
    const inside = pledgesWithinDays(buyback, NOW, 14);
    const labelled = buyback.filter((pledge) => pledge.priceIncrease).map((pledge) => pledge.id);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.length).toBeLessThan(new Set(labelled).size);
  });
});

describe.each(['key-a', 'key-b', 'key-c'])(
  'the Price Increase Advisor of the demo %s (#255)',
  (key) => {
    const buyable = new Set(FALLBACK_CATALOG.ships.map((ship) => ship.id));
    const {
      pledges,
      priceIncreases,
      account: demoAccount,
    } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW, DEFAULT_DEMO_SETTINGS, buyable);
    const known = priceIncreases.filter((entry) => entry.price);

    it('has price increases with a known new price inside the period', () => {
      expect(known.length).toBe(2);
      expect(known.every((entry) => isWithinDays(entry, NOW, 14))).toBe(true);
      expect(known.every((entry) => entry.price!.to > entry.price!.from)).toBe(true);
    });

    it('shows the rising ship itself, a CCU gaining and one losing value by it', () => {
      const rising = (pledge: PledgeView) =>
        known.some((entry) =>
          [pledge.ccuPriceChange?.base, pledge.ccuPriceChange?.target].includes(entry),
        );
      const losing = pledges.filter(
        (pledge) => rising(pledge) && pledge.ccuPriceChange?.direction === 'loses',
      );
      expect(losing.length).toBeGreaterThan(0);
      expect(losing.some((pledge) => pledge.ccuPriceChange?.amounts && pledge.isGiftable)).toBe(
        true,
      );
      expect(
        pledges.some((pledge) => rising(pledge) && pledge.ccuPriceChange?.direction === 'gains'),
      ).toBe(true);
      expect(
        pledges.some(
          (pledge) =>
            pledge.priceIncrease?.reason === 'ship' &&
            known.includes(pledge.priceIncrease.increase),
        ),
      ).toBe(true);
      expect(pledges.some((pledge) => hasPriceChangeWithin(pledge, NOW, 14))).toBe(true);
    });

    it('needs store credit for the CCU to the rising ship: melting covers less than it costs', () => {
      const ship = demoAccount.pledges.find((pledge) => pledge.demoPivot === 'ship')!.items[0]!
        .title;
      const msrp = FALLBACK_CATALOG.ships.find((entry) => entry.name === ship)!.msrp;
      const below = Math.max(
        ...FALLBACK_CATALOG.ships.filter((entry) => entry.msrp < msrp).map((entry) => entry.msrp),
      );
      const from = demoAccount.pledges.find((pledge) => pledge.demoPivot === 'ccuFrom')!;
      expect(from.valueUsd).toBeLessThan(msrp - below);
    });

    it('gives the sidebar a notification with affected CCUs and one to secure a CCU', () => {
      const secure = ccusToSecure({
        increases: priceIncreases,
        ships: FALLBACK_CATALOG.ships,
        buyable: FALLBACK_CATALOG.ships.map((ship) => ({
          shipId: ship.id,
          skuId: ship.id,
          title: 'Standard Edition',
          price: ship.msrp,
        })),
        warbonds: [],
        now: NOW,
      });
      const notes = advisorNotes({
        ccus: pledges.filter((pledge) => pledge.isCcu),
        secure,
        now: NOW,
        days: 14,
        secureHint: true,
        dismissed: [],
      });
      expect(notes.some((note) => note.kind === 'losing' && note.loss! > 0)).toBe(true);
      expect(notes.some((note) => note.kind === 'secure' && note.increase.price)).toBe(true);
    });
  },
);

describe.each(['key-a', 'key-b'])('the CCUs to secure from the demo buy back %s (#311)', (key) => {
  // Every other ship of the catalog is on sale.
  const onSale = FALLBACK_CATALOG.ships.filter((_, index) => index % 2 === 0);
  const { buyback, priceIncreases } = generatedDemo(
    FALLBACK_CATALOG,
    key,
    TODAY,
    NOW,
    DEFAULT_DEMO_SETTINGS,
    new Set(onSale.map((ship) => ship.id)),
  );
  const secure = ccusToSecure({
    increases: priceIncreases,
    ships: FALLBACK_CATALOG.ships,
    buyable: onSale.map((ship) => ({
      shipId: ship.id,
      skuId: ship.id,
      title: 'Standard Edition',
      price: ship.msrp,
    })),
    warbonds: [],
    buyback,
    now: NOW,
  });

  it('has a ship not on sale with CCUs from several base ships, one without a price', () => {
    const ship = demoNotOnSaleShip(FALLBACK_CATALOG, new Set(onSale.map((entry) => entry.id)));
    const offer = secure.find((entry) => entry.ship.id === ship?.id);
    expect(offer?.skuId).toBeUndefined();
    expect(offer?.buyback?.length).toBe(3);
    expect(offer?.buyback?.some((group) => group.count === 2)).toBe(true);
    expect(offer?.buyback?.at(-1)?.price).toBeUndefined();
    expect(offer?.buyback?.slice(0, 2).every((group) => group.price)).toBe(true);
  });

  it('keeps the CCUs to secure of a ship on sale', () => {
    expect(secure.some((entry) => entry.skuId && entry.bases.length)).toBe(true);
  });
});
