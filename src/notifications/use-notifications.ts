import { useStored } from '@/storage/use-stored';
import { computed, type ComputedRef } from 'vue';
import { notificationsItem, openNotifications, type AppNotification } from './notifications';

/** The open notifications, newest first, kept up to date. */
export function useOpenNotifications(): ComputedRef<readonly AppNotification[]> {
  const stored = useStored(notificationsItem);
  return computed(() => openNotifications(stored.value ?? []));
}
