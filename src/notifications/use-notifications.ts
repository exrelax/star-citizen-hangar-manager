import type { MarkedPledge } from '@/hangar/use-melt-marks';
import { useNow } from '@/shared/use-now';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import {
  notificationsItem,
  openNotifications,
  syncMeltable,
  updateNotifications,
  type AppNotification,
} from './notifications';

/**
 * Keeps the notifications in line with their sources while the manager is open – for now the
 * pledges marked to melt (#97) – and gives the open ones, newest first.
 */
export function useNotifications(
  marks: Readonly<Ref<ReadonlyMap<number, MarkedPledge>>>,
  marksReady: Readonly<Ref<boolean>>,
) {
  const stored = useStored(notificationsItem);
  const now = useNow();
  // Only once the marks and the stored list are read, so nothing is checked off by mistake.
  watch(
    [marks, now, () => stored.value !== undefined && marksReady.value],
    ([current, time, ready]) => {
      if (ready) void updateNotifications((list) => syncMeltable(list, current, time));
    },
    { immediate: true },
  );
  return computed(() => openNotifications(stored.value ?? []));
}

export const NOTIFICATIONS: InjectionKey<Readonly<Ref<readonly AppNotification[]>>> =
  Symbol('shm-notifications');

/** The open notifications provided by the manager view (see `App.vue`); none outside of it. */
export function useOpenNotifications(): Readonly<Ref<readonly AppNotification[]>> {
  return inject(NOTIFICATIONS, shallowRef<readonly AppNotification[]>([]));
}
