/*
 * A lease in the extension's storage, so that RSI's tabs and the background script don't read the
 * same data at the same time (#163). The tabs share a Web Lock (`withSmartUpdateLock`), but the
 * background script runs on the extension's origin and can't take it. Reading and writing the
 * lease isn't atomic: two runs starting within the same few milliseconds may both run, which only
 * costs a duplicate read.
 */

export interface Lease {
  /** Epoch milliseconds until which the lease is held. */
  until: number;
}

/**
 * Runs `run` unless another context holds the lease of `key`; then it gives `undefined`. The
 * lease lasts at most `ms` (in case the holder ends without giving it back, e.g. a closed tab).
 */
export async function withLease<T>(
  key: `local:${string}`,
  ms: number,
  run: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T | undefined> {
  const item = storage.defineItem<Lease | null>(key, { fallback: null });
  const held = await item.getValue();
  if (held && held.until > now()) return undefined;
  const lease = { until: now() + ms };
  await item.setValue(lease);
  try {
    return await run();
  } finally {
    // Only our own lease: another one may have been taken after ours ran out.
    if ((await item.getValue())?.until === lease.until) await item.removeValue();
  }
}
