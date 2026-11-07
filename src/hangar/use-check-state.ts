import { buybackMeta } from '@/buyback/buyback-storage';
import { useStored } from '@/storage/use-stored';
import { hangarMeta } from './hangar-storage';

const ITEMS = { hangar: hangarMeta, buyback: buybackMeta };

/** When the hangar or the buy back was last checked, and how; kept up to date. */
export function useCheckState(source: keyof typeof ITEMS = 'hangar') {
  return useStored(ITEMS[source]);
}
