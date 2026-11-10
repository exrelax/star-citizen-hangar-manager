import type { BuybackPledge } from '@/buyback/buyback';
import type { ExpectedPriceIncrease, ExpectedTime } from '@/price-increases/price-increases';
import type { Ship } from '@/ships/ships';
import type { DemoCatalog } from './catalog';
import type { DemoPledge } from './generate-hangar';

/*
 * The expected price increases of the demo (#194) instead of the website's file: made up for the
 * ships of the generated hangar and buy back, with dates relative to now, so the countdowns always
 * run. Every case of the Buy Back Reminder shows:
 * - a ship whose flight ready date is still ahead, with a probable time, inside the period – with
 *   a module, and a CCU to it in My Hangar;
 * - an already flight ready ship, only the day known, inside the period;
 * - one outside the period (the filter and the notification leave it out), and one ending within
 *   the hour, counting down in minutes and seconds.
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

/** The ship of a CCU's target, by the name in its title. */
const targetOf = (title: string) =>
  /\bto\s+(.+?)\s+(?:standard|warbond)\s+edition$/i.exec(title)?.[1];

/** The demo's price increases for its generated hangar and buy back. */
export function demoPriceIncreases(
  catalog: DemoCatalog,
  hangar: readonly DemoPledge[],
  buyback: readonly BuybackPledge[],
  now: number,
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
  ];
}
