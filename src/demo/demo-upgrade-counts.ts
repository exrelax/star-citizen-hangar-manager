import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import type { StoreItem } from '@/store/items/store-items';
import type { Ship } from '@/ships/ships';
import { createBaseShipCounts, type BaseShipCounts } from '@/ships/upgrade-dialog-counts';
import type { UpgradeTarget } from '@/ships/upgrade-dialog-labels';
import { demoCatalog } from './catalog';
import { generatedDemo } from './demo';
import type { DemoSettings } from './demo-settings';

/*
 * The counts on the base ships of RSI's ship upgrade dialog (#506) in the demo (#578): from the
 * generated demo hangar and buy back, the same ones My Hangar and Buy Back show, counted as
 * outside the demo – never from the stored real ones. With the own pledges as demo source, or
 * before the manager made the demo's key, no counts at all.
 */

export interface DemoCountsInput {
  /** The demo's key (`demoKeyItem`); none before the manager opened in the demo. */
  key: string | null | undefined;
  settings: DemoSettings;
  /** The upgrade tool's ships: the catalog of the demo and the dialog's ids. */
  ships: readonly Ship[] | undefined;
  /** The Pledge Store's items, for the catalog of the demo. */
  storeItems: readonly StoreItem[] | undefined;
  /** The ships RSI sells CCUs to, if known (#255). */
  buyable: ReadonlySet<number> | undefined;
  /** The website's price increases, used with the real Pledge Store data (#310). */
  realIncreases: readonly ExpectedPriceIncrease[];
  today: string;
  now: number;
}

export function demoBaseShipCounts(
  input: DemoCountsInput,
): (target: UpgradeTarget) => BaseShipCounts | undefined {
  const { key, settings } = input;
  if (!key || settings.source !== 'generated') return () => undefined;
  const catalog = demoCatalog(input.ships, input.storeItems);
  const { account, generatedBuyback } = generatedDemo(
    catalog,
    key,
    input.today,
    input.now,
    settings,
    input.buyable,
    settings.realStoreData ? input.realIncreases : [],
  );
  return createBaseShipCounts({
    ships: input.ships?.length ? input.ships : catalog.ships,
    hangar: account.pledges,
    buyback: generatedBuyback.pledges,
  });
}
