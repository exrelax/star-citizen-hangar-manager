import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import { createShipLookup, holdingsByShip } from '@/store/warbond';
import { computed, type Ref } from 'vue';
import { ccusToSecure } from './ccus-to-secure';
import { priceIncreasesItem, storedPriceIncreases } from './price-increases-storage';

/**
 * The CCUs to secure before a price increase (#253), for the Pledge Store tab and the sidebar's
 * notification (#254): from the stored upgrade tool and the website's expected price increases –
 * public data, also in the demo mode –, with the counts of the shown hangar and buy back.
 */
export function useCcusToSecure(
  pledges: () => readonly PledgeView[],
  buyback: () => readonly BuybackView[],
  now: Readonly<Ref<number>>,
) {
  const storedShips = useStored(shipsItem);
  const storedBuyable = useStored(buyableShipsItem);
  const storedWarbonds = useStored(warbondsItem);
  const storedIncreases = useStored(priceIncreasesItem);
  return computed(() => {
    const ships = current(storedShips.value ?? null)?.ships;
    if (!ships) return [];
    return ccusToSecure({
      increases: storedPriceIncreases(storedIncreases.value ?? null),
      ships,
      buyable: current(storedBuyable.value ?? null)?.skus ?? [],
      warbonds: current(storedWarbonds.value ?? null)?.warbonds ?? [],
      holdings: holdingsByShip(createShipLookup(ships), pledges(), buyback()),
      now: now.value,
    });
  });
}
