import { LOCAL_COPY } from '@/storage/registry';

/**
 * Deletes the extension's local copy of RSI's data – hangar, buy back, orders, ships, warbond
 * offers – and the state of the smart updates (see `storage/registry.ts`); not the settings. Only
 * the extension's copy: nothing is changed on RSI's website, and the next refresh reads
 * everything again. The open lists empty at once, as they follow the stored items.
 */
export async function clearLocalCache(): Promise<void> {
  await Promise.all(
    LOCAL_COPY.flatMap(({ item, meta }) => [item.removeValue(), meta?.removeValue()]),
  );
}
