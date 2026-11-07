import { getCurrentScope, onScopeDispose, shallowRef, type ShallowRef } from 'vue';

/*
 * One reactive copy of a stored value for the whole page: every component that uses the same item
 * shares it, with a single storage watcher. The watcher is removed again once the last of them is
 * gone.
 */

interface StorageItem<T> {
  getValue(): Promise<T>;
  watch(callback: (value: T) => void): () => void;
}

interface Shared<T> {
  value: ShallowRef<T | undefined>;
  users: number;
  unwatch: () => void;
}

const shared = new Map<StorageItem<unknown>, Shared<unknown>>();

/** The stored value of `item`, kept up to date; `undefined` until it was read. */
export function useStored<T>(item: StorageItem<T>): Readonly<ShallowRef<T | undefined>> {
  let entry = shared.get(item) as Shared<T> | undefined;
  if (!entry) {
    const value = shallowRef<T>();
    const created: Shared<T> = {
      value,
      users: 0,
      unwatch: item.watch((next) => (value.value = next)),
    };
    void item.getValue().then((stored) => {
      // A change seen by the watcher in the meantime is newer.
      if (value.value === undefined) value.value = stored;
    });
    shared.set(item, created as Shared<unknown>);
    entry = created;
  }
  entry.users++;
  const current = entry;
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (--current.users > 0) return;
      current.unwatch();
      shared.delete(item);
    });
  }
  return current.value;
}
