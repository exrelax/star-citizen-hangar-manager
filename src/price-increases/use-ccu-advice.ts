import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { BuybackView } from '@/buyback/buyback-view';
import { useDemoContext } from '@/demo/use-demo';
import type { PledgeView } from '@/hangar/pledge-view';
import { createShipStatusLookup, shipStatusItem } from '@/ships/ship-status';
import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useShipFacts } from '@/ships/use-ship-facts';
import { useStored } from '@/storage/use-stored';
import { createShipLookup, holdingsByShip } from '@/store/warbond';
import { computed, type ComputedRef } from 'vue';
import { ccuAdvice, type CcuAdviceGroup } from './ccu-advice';

/*
 * The advice for the CCUs of My Hangar whose base ship rises in price (#252, `ccu-advice.ts`), from
 * the stored upgrade tool, ship status, ship facts and store credit – the demo's store credit in the
 * demo mode. Shared by the "Keep the discount" dialog and the CCU Consultant's tab "Discount at
 * risk" (#455).
 */

export interface CcuAdviceState {
  /** The advice per rising base ship and target; none while the upgrade tool isn't stored. */
  groups: ComputedRef<CcuAdviceGroup[] | undefined>;
  /** The account's store credit in USD, if known. */
  storeCredit: ComputedRef<number | undefined>;
}

export function useCcuAdvice(
  pledges: () => readonly PledgeView[],
  buyback: () => readonly BuybackView[],
): CcuAdviceState {
  const ships = useStored(shipsItem);
  const buyable = useStored(buyableShipsItem);
  const warbonds = useStored(warbondsItem);
  const shipStatus = useStored(shipStatusItem);
  const storedCredit = useStored(storeCreditItem);
  const demo = useDemoContext();
  const shipFacts = useShipFacts();

  const storeCredit = computed(() => {
    const stored = storedCredit.value;
    const value =
      demo.value?.storeCredit ??
      (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
    return value?.currency === 'USD' ? value.amount : undefined;
  });

  /** The ships with an upcoming price increase in the lists: no base ship for new CCUs. */
  const risingShipIds = computed(
    () =>
      new Set(
        pledges().flatMap((pledge) =>
          [
            pledge.priceIncrease?.increase,
            pledge.ccuPriceChange?.base,
            pledge.ccuPriceChange?.target,
          ].flatMap((increase) => (increase ? [increase.ship.id] : [])),
        ),
      ),
  );

  const groups = computed((): CcuAdviceGroup[] | undefined => {
    const shipList = current(ships.value ?? null)?.ships;
    if (!shipList) return undefined;
    // How many of each base ship, CCUs to it and buy back CCUs to it the user has.
    const holdings = holdingsByShip(createShipLookup(shipList), pledges(), buyback());
    const facts = shipFacts.value;
    return ccuAdvice({
      pledges: pledges(),
      ships: shipList,
      buyable: current(buyable.value ?? null)?.skus ?? [],
      warbonds: current(warbonds.value ?? null)?.warbonds ?? [],
      risingShipIds: risingShipIds.value,
      // The Ship Matrix first, the website's ship facts where it has no value (#265).
      statusOf: createShipStatusLookup(shipStatus.value, (id) => facts?.status(id)),
      storeCredit: storeCredit.value,
      isAlwaysAvailable: (id) => facts?.isAlwaysAvailable(id),
      holdingsOf: (id) => {
        const held = holdings.get(id);
        return {
          hangarShips: held?.hangarShips ?? 0,
          hangarCcus: held?.hangarCcus ?? 0,
          buybackCcus: held?.buybackCcus ?? 0,
        };
      },
    });
  });

  return { groups, storeCredit };
}
