import { createRebuyJudge, STANDALONE } from '@/melt-rebuy/rebuyable';
import type { RebuyInput } from '@/melt-rebuy/use-rebuyables';
import { createShipFactsLookup } from '@/ships/ship-facts';
import type { ShipSku, WarbondSku } from '@/ships/ships';
import { bundledShipFacts } from '@/ships/sync-ship-facts';
import type { StoreCatalog } from '@/watchlists/store-status';
import type { DemoCatalog } from './catalog';
import {
  demoRebuyFacts,
  demoRebuyShipItems,
  rebuyShipIds,
  type DemoRebuyShips,
} from './demo-rebuy-cases';

/*
 * The Pledge Store as Melt and Rebuy (#528) and the watchlists (#470, #531) see it in the generated
 * demo (#532), so the cases of `demo-rebuy-cases.ts` turn out the same on every account:
 *
 * - the demo catalog's ships and store items, but its own standalone ships instead of the store's:
 *   the cases' ships, each with the insurance in its name (`demoRebuyShipItems`). Other ships have
 *   no standalone item, so a watchlist's ship counts as its standard edition (#474);
 * - the ships RSI sells CCUs to as stored, or all ships of the catalog while not known; their
 *   warbond editions as stored, but none of the cases' ships, so the CCUs' target is on sale in its
 *   standard edition;
 * - which ships are always available: the demo's own facts for the cases' ships, the website's
 *   facts as bundled with the extension for the others – never the account's stored ones.
 *
 * With the demo setting "Rebuyable pledges" off, the store has none of the items the rebuyable
 * pledges would be rebought as (`demoRebuyInput`).
 */

export interface DemoRebuyStore {
  catalog: StoreCatalog;
  /** Whether a ship (the upgrade tool's id) is always available; `undefined` if not known. */
  alwaysAvailable: (shipId: number) => boolean | undefined;
}

/** Made-up SKUs of the ships' standard editions while the ones on sale aren't known. */
const SKU_BASE = 970_000_000;

export function demoRebuyStore(input: {
  catalog: DemoCatalog;
  ships: DemoRebuyShips;
  /** The ships RSI sells CCUs to and their warbond editions, as stored, if known. */
  buyable?: readonly ShipSku[];
  warbonds?: readonly WarbondSku[];
}): DemoRebuyStore {
  const { catalog, ships } = input;
  const caseShips = new Set(rebuyShipIds(ships));
  const buyable =
    input.buyable ??
    catalog.ships.map((ship) => ({
      shipId: ship.id,
      skuId: SKU_BASE + ship.id,
      title: ship.name,
      price: ship.msrp,
    }));
  const warbonds = (input.buyable ? (input.warbonds ?? []) : []).filter(
    (warbond) => !caseShips.has(warbond.shipId),
  );
  const facts = demoRebuyFacts(ships);
  const bundled = bundledShipFacts();
  const lookup = bundled && createShipFactsLookup(bundled);
  return {
    catalog: {
      ships: catalog.ships,
      buyable,
      warbonds,
      items: [
        ...catalog.items.filter((item) => !STANDALONE.test(item.category)),
        ...demoRebuyShipItems(ships),
      ],
    },
    alwaysAvailable: (shipId) =>
      facts.has(shipId) ? facts.get(shipId) : lookup?.isAlwaysAvailable(shipId),
  };
}

/** Rounds of taking items off: another item of a ship may make a pledge rebuyable again. */
const MAX_ROUNDS = 5;

/**
 * The input of the rules in the demo: the demo's Pledge Store (`demoRebuyStore`, none for the own
 * pledges as source), and with `rebuyable` off a store without the items the rebuyable pledges
 * would be rebought as – their paint or ship out of stock, the target of their CCU not always
 * available –, so none is rebuyable.
 */
export function demoRebuyInput(
  input: RebuyInput,
  store: DemoRebuyStore | undefined,
  rebuyable: boolean,
): RebuyInput {
  let current: RebuyInput = store
    ? {
        ...input,
        context: {
          ...input.context,
          catalog: store.catalog,
          alwaysAvailable: store.alwaysAvailable,
        },
      }
    : input;
  if (rebuyable) return current;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const judge = createRebuyJudge(current.context);
    const offSale = new Set<number>();
    const limited = new Set<number>();
    for (const pledge of current.pledges) {
      const { rebuyable: can, item } = judge(pledge);
      if (!can || !item) continue;
      if (item.kind === 'storeCcu') limited.add(item.toShipId);
      else offSale.add(item.skuId);
    }
    if (!offSale.size && !limited.size) break;
    const { catalog, alwaysAvailable } = current.context;
    current = {
      ...current,
      context: {
        ...current.context,
        catalog: {
          ...catalog,
          ...(catalog.items && {
            items: catalog.items.map((item) =>
              offSale.has(item.id) ? { ...item, available: false } : item,
            ),
          }),
        },
        alwaysAvailable: (shipId) => (limited.has(shipId) ? false : alwaysAvailable(shipId)),
      },
    };
  }
  return current;
}
