import { STORE_CREDIT_VERSION, storeCreditItem } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { useStored } from '@/storage/use-stored';
import { computed } from 'vue';

/**
 * The store credit there is in USD, for what a watchlist's store items cost (#529, #531): the
 * account's, the demo's in the demo (#179); none while not known or in another currency.
 */
export function useStoreCreditUsd() {
  const demo = useDemoContext();
  const stored = useStored(storeCreditItem);
  return computed(() => {
    const value =
      demo.value?.storeCredit ??
      (stored.value?.version === STORE_CREDIT_VERSION ? stored.value.credit : undefined);
    return value?.currency === 'USD' ? value.amount : undefined;
  });
}
