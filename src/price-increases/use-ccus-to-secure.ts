import type { BuybackView } from '@/buyback/buyback-view';
import { useDemoContext } from '@/demo/use-demo';
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
 * public data –, with the counts of the shown hangar and buy back. The generated demo has price
 * increases of its own (#255).
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
  const demo = useDemoContext();
  return computed(() => {
    const ships = current(storedShips.value ?? null)?.ships;
    if (!ships) return [];
    return ccusToSecure({
      increases: demo.value?.priceIncreases ?? storedPriceIncreases(storedIncreases.value ?? null),
      ships,
      buyable: current(storedBuyable.value ?? null)?.skus ?? [],
      warbonds: current(storedWarbonds.value ?? null)?.warbonds ?? [],
      holdings: holdingsByShip(createShipLookup(ships), pledges(), buyback()),
      buyback: buyback(),
      now: now.value,
    });
  });
}
