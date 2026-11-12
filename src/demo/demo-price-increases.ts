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
): ExpectedPriceIncrease[] {
  const used = new Set<string>();
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
