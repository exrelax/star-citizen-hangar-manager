import type { BuybackPledge } from '@/buyback/buyback';
import type { ExpectedPriceIncrease, ExpectedTime } from '@/price-increases/price-increases';
import type { Ship } from '@/ships/ships';
import type { DemoCatalog } from './catalog';
import { ccuTargetsOf, type DemoPledge } from './generate-hangar';

/*
 * The expected price increases of the demo (#194) instead of the website's file: made up for the
 * ships of the generated hangar and buy back, with dates relative to now, so the countdowns always
 * run. Every case of the Buy Back Reminder shows:
 * - a ship whose flight ready date is still ahead, with a probable time, inside the period – with
 *   a module, and a CCU to it in My Hangar;
 * - an already flight ready ship, only the day known, inside the period;
 * - one outside the period (the filter and the notification leave it out), and one ending within
 *   the hour, counting down in minutes and seconds.
 * And the Price Increase Advisor's (#255), each with a known new price, inside the period:
 * - the ship of its chain in My Hangar (`demoPivotShip`): the ship itself, a CCU to it that gains
 *   value and one from it that loses value – the advice and the sidebar's notification;
 * - a ship RSI sells CCUs to without a CCU from it in My Hangar: the Pledge Store tab's CCUs to
 *   secure and the sidebar's hint.
 * The first one is confirmed by CIG, with a source, the second only expected (#275).
 * And a ship RSI doesn't sell CCUs to right now, with CCUs to it in the buy back (#311).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A time on the full hour, `days` days and `hours` hours from now. */
const at = (now: number, days: number, hours = 0): ExpectedTime => ({
  at: Math.ceil((now + days * DAY + hours * HOUR) / HOUR) * HOUR,
});
/** A day (UTC), `days` days from now. */
const day = (now: number, days: number): ExpectedTime => ({
  at: Date.parse(new Date(now + days * DAY).toISOString().slice(0, 10)),
  dayOnly: true,
});

const shipNamed = (catalog: DemoCatalog, name: string | undefined): Ship | undefined =>
  catalog.ships.find((ship) => ship.name === name);

/** The source of the demo's confirmed price increase (#275): RSI's Comm-Link, no real post. */
const DEMO_SOURCE = 'https://robertsspaceindustries.com/comm-link';

/** A new price about 10 % higher, in steps of $5. */
const risenPrice = (ship: Ship) => ({
  from: ship.msrp,
  to: ship.msrp + Math.max(5, Math.round((ship.msrp * 0.1) / 5) * 5),
});

/** The ship of a CCU's target, by the name in its title. */
const targetOf = (title: string) =>
  /\bto\s+(.+?)\s+(?:standard|warbond)\s+edition$/i.exec(title)?.[1];

/** The demo's price increases for its generated hangar and buy back. */
export function demoPriceIncreases(
  catalog: DemoCatalog,
  hangar: readonly DemoPledge[],
  buyback: readonly BuybackPledge[],
  now: number,
  /** The ships RSI sells CCUs to (the upgrade tool's), if known: for the CCUs to secure. */
  buyable?: ReadonlySet<number>,
  /** A ship not on sale with CCUs to it in the buy back (`demoNotOnSaleShip`, #311). */
  notOnSale?: Ship,
): ExpectedPriceIncrease[] {
  const used = new Set<string>(notOnSale ? [notOnSale.name] : []);
  /** The first of the candidates not used yet, else any ship of the catalog not used yet. */
  const free = (...candidates: (Ship | undefined)[]): Ship | undefined =>
    [...candidates, ...catalog.ships].find((ship) => ship && !used.has(ship.name));
  const increase = (
    ship: Ship | undefined,
    priceIncreaseAt: ExpectedTime,
    extra: Partial<ExpectedPriceIncrease> = {},
  ): ExpectedPriceIncrease[] => {
    if (!ship) return [];
    used.add(ship.name);
    return [{ ship: { id: ship.id, name: ship.name }, priceIncreaseAt, ...extra }];
  };

  // A module of the buy back whose ship is in the catalog ("Galaxy - Cargo Module").
  const module = buyback.find(
    (pledge) =>
      pledge.title.startsWith('Add-Ons - ') && shipNamed(catalog, pledge.contained.split(' - ')[0]),
  );
  const moduleShip = module && shipNamed(catalog, module.contained.split(' - ')[0]);
  const hangarCcuTarget = shipNamed(
    catalog,
    hangar.find((pledge) => pledge.upgrade)?.upgrade?.targetItems[0]?.name,
  );
  const buybackShip = shipNamed(
    catalog,
    buyback.find((pledge) => pledge.category === 'standalone_ship')?.items?.[0],
  );
  const buybackCcuTargets = buyback
    .filter((pledge) => pledge.isUpgrade)
    .map((pledge) => shipNamed(catalog, targetOf(pledge.title)));
  const hangarShip = shipNamed(
    catalog,
    hangar.find((pledge) => pledge.demoKind === 'ships' && !pledge.isUpgraded)?.items[0]?.title,
  );

  // The Price Increase Advisor's ships (#255), kept from the cases above.
  const pivotShip = shipNamed(
    catalog,
    hangar.find((pledge) => pledge.demoPivot === 'ship')?.items[0]?.title,
  );
  if (pivotShip) used.add(pivotShip.name);
  // The other ships of its CCUs don't rise: they change by the pivot's price increase only.
  for (const pledge of hangar.filter((entry) => entry.demoPivot)) {
    for (const item of [
      ...(pledge.upgrade?.matchItems ?? []),
      ...(pledge.upgrade?.targetItems ?? []),
    ]) {
      used.add(item.name);
    }
  }
  const bases = new Set(
    hangar.flatMap((pledge) => pledge.upgrade?.matchItems.map((item) => item.name) ?? []),
  );
  const secureCandidates = ccuTargetsOf(catalog.ships)
    .filter(
      (ship) =>
        !bases.has(ship.name) &&
        ship.name !== moduleShip?.name &&
        !used.has(ship.name) &&
        (!buyable || buyable.has(ship.id)),
    )
    .sort((a, b) => a.msrp - b.msrp);
  // A ship in the middle: there are cheaper ones to start the CCUs from.
  const secureShip = secureCandidates[Math.floor(secureCandidates.length / 2)];
  if (secureShip) used.add(secureShip.name);

  return [
    // Flight ready ahead, with a probable time, with its module.
    ...increase(free(moduleShip, hangarCcuTarget), at(now, 3, 4), {
      flightReadyAt: at(now, 2, 4),
      ...(module && { relatedItems: [{ name: module.contained }] }),
      note: { en: 'Expected with the next event.', de: 'Erwartet mit dem nächsten Event.' },
    }),
    ...increase(free(hangarCcuTarget), at(now, 5, 2), { flightReadyAt: at(now, 4, 2) }),
    // Already flight ready, only the day known.
    ...increase(free(buybackShip), day(now, 6)),
    // Within the hour: minutes and seconds.
    ...increase(free(...buybackCcuTargets), {
      at: Math.ceil((now + 40 * 60 * 1000) / 60_000) * 60_000,
    }),
    ...increase(free(hangarShip), day(now, 9)),
    // Outside the period of the settings (14 days by default).
    ...increase(free(...[...buybackCcuTargets].reverse()), at(now, 30)),
    // The Price Increase Advisor's (#255).
    ...(pivotShip
      ? [
          {
            ship: { id: pivotShip.id, name: pivotShip.name },
            priceIncreaseAt: at(now, 4, 3),
            price: risenPrice(pivotShip),
            // Confirmed by CIG, with its source (#275); the other one only expected.
            confirmed: true as const,
            source: DEMO_SOURCE,
          },
        ]
      : []),
    ...(notOnSale
      ? [
          {
            ship: { id: notOnSale.id, name: notOnSale.name },
            priceIncreaseAt: at(now, 7, 5),
            price: risenPrice(notOnSale),
          },
        ]
      : []),
    ...(secureShip
      ? [
          {
            ship: { id: secureShip.id, name: secureShip.name },
            priceIncreaseAt: at(now, 8, 1),
            price: risenPrice(secureShip),
          },
        ]
      : []),
  ];
}

/**
 * A ship RSI doesn't sell CCUs to right now (#311), for the CCUs to secure from the buy back: of
 * the catalog's ships in the middle of the price range, with cheaper ones to start from. Only
 * while it is known which ships RSI sells CCUs to.
 */
export function demoNotOnSaleShip(
  catalog: DemoCatalog,
  buyable?: ReadonlySet<number>,
): Ship | undefined {
  if (!buyable?.size) return undefined;
  const candidates = ccuTargetsOf(catalog.ships)
    .filter((ship) => !buyable.has(ship.id))
    .sort((a, b) => a.msrp - b.msrp || a.name.localeCompare(b.name));
  return candidates[Math.floor(candidates.length / 2)];
}

/**
 * The ships of the website's price increases (#310) RSI doesn't sell CCUs to right now, still
 * ahead: with the real Pledge Store data, the demo buy back has CCUs to them, so they show among
 * the CCUs to secure (#311). Only while it is known which ships RSI sells CCUs to.
 */
export function realNotOnSaleShips(
  catalog: DemoCatalog,
  increases: readonly ExpectedPriceIncrease[],
  now: number,
  buyable?: ReadonlySet<number>,
): Ship[] {
  if (!buyable?.size) return [];
  const targets = new Map(ccuTargetsOf(catalog.ships).map((ship) => [ship.id, ship]));
  const ships = increases
    .filter((increase) => increase.priceIncreaseAt.at > now && !buyable.has(increase.ship.id))
    .map((increase) => targets.get(increase.ship.id))
    .filter((ship) => ship !== undefined);
  return [...new Set(ships)];
}
