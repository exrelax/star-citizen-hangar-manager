import { useStored } from '@/storage/use-stored';
import { computed } from 'vue';
import { createShipFactsLookup, type ShipFactsLookup } from './ship-facts';
import { bundledShipFacts, shipFactsItem, storedShipFacts } from './sync-ship-facts';

/**
 * The ships' facts of the website (#109) for the UI: the stored ones, else the copy bundled with
 * the extension (first start, offline, or a stored file that couldn't be read). Updates when a new
 * file is stored.
 */
export function useShipFacts() {
  const stored = useStored(shipFactsItem);
  const bundled = bundledShipFacts();
  return computed((): ShipFactsLookup | undefined => {
    const facts = storedShipFacts(stored.value) ?? bundled;
    return facts && createShipFactsLookup(facts);
  });
}
