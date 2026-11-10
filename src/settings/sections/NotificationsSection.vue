<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import {
  browserNotificationsHintDismissedItem,
  browserNotificationsItem,
  browserNotificationsRefusedItem,
  OPEN_NOTIFICATION_PERMISSION,
  REMOVE_NOTIFICATION_PERMISSION,
} from '@/notifications/browser-permission';
import { BROWSER_NOTIFICATIONS_SETTING_ID } from '../anchors';
import SettingCheck from '../SettingCheck.vue';
import { useStored } from '@/storage/use-stored';
import {
  demoDismissedPaintsItem,
  dismissedPaintsItem,
  isPaintNotificationShown,
  restorePaintNotifications,
} from '@/store/paint-consultant/paint-notification';
import { maybePaintConsultant } from '@/store/paint-consultant/use-paint-consultant';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import { notificationsItem, updateNotifications } from '@/notifications/notifications';
import { restorable, withRestored } from '@/notifications/restore';
import { current, warbondsItem } from '@/ships/ships-storage';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import { computed, ref } from 'vue';
import { useDemoContext } from '@/demo/use-demo';
import { isKindOn, withKind, type NotificationKind } from '@/notifications/kinds';
import type { Settings } from '../settings';
import { buybackSnapshot } from '@/buyback/buyback-storage';
import {
  demoDismissedPriceIncreasesItem,
  dismissedPriceIncreasesItem,
  isPriceIncreaseNoteShown,
  pledgesWithinDays,
  restorePriceIncreaseNotes,
  storedPriceIncreasePledges,
} from '@/price-increases/price-increase-notes';
import {
  priceIncreasesItem,
  storedPriceIncreases,
} from '@/price-increases/price-increases-storage';

/*
 * Notifications: browser notifications, an optional extra for when no RSI page is open (#152,
 * see `notifications/browser-permission.ts`), and the sidebar's "Notifications" box. Its
 * checked-off or dismissed notifications come back here as far as they still matter (#213, see
 * `notifications/restore.ts`): the stored ones, the Paint Discount Consultant's while paints can
 * be bought again (dismissed for its paints, #151, synced), the expected price increases' while
 * buy back pledges are in their period (#193) and the hint on browser notifications while they
 * are off.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** The kinds of notifications, each turned on and off on its own (#197). */
const kindOn = (kind: NotificationKind) => isKindOn(props.settings.notificationsOff, kind);
const setKind = (kind: NotificationKind, on: boolean) =>
  emit('update', { notificationsOff: withKind(props.settings.notificationsOff, kind, on) });

// Browser notifications: on while this browser allows them; the permission is the setting.
const allowed = useStored(browserNotificationsItem);
const refused = useStored(browserNotificationsRefusedItem);
/** Turned on here: the browser asks on the extension's page that opened. */
const asked = ref(false);
/** Re-renders the checkbox, which shows "on" after the click until the browser allowed it. */
const checkKey = ref(0);

function setBrowserNotifications(on: boolean) {
  if (on) {
    asked.value = true;
    checkKey.value++;
    void browser.runtime.sendMessage(OPEN_NOTIFICATION_PERMISSION);
  } else {
    asked.value = false;
    void browser.runtime.sendMessage(REMOVE_NOTIFICATION_PERMISSION);
  }
}

// ---- Checked-off notifications that still matter (#213) ----

const notesStored = useStored(notificationsItem);
const eventsStored = useStored(eventsItem);
const warbondsStored = useStored(warbondsItem);
const itemsStored = useStored(storeItemsItem);
const realDismissed = useStored(dismissedPaintsItem);
const demoDismissed = useStored(demoDismissedPaintsItem);
const hintDismissed = useStored(browserNotificationsHintDismissedItem);
const consultant = maybePaintConsultant();

/** The stored notifications to open again. */
const notesToRestore = computed(() =>
  restorable(notesStored.value ?? [], {
    events: eventsStored.value?.version === EVENTS_VERSION ? eventsStored.value.events : [],
    warbonds: current(warbondsStored.value ?? null)?.warbonds ?? [],
    items: itemsStored.value?.version === STORE_ITEMS_VERSION ? itemsStored.value.items : [],
    notificationsOff: props.settings.notificationsOff,
    now: Date.now(),
  }),
);
/** The consultant's notification, dismissed while paints can still be bought again. */
const paintToRestore = computed(() => {
  const paints = props.settings.hideMeltValue
    ? []
    : (consultant?.result.value?.plan?.own.map((paint) => paint.pledgeId) ?? []);
  const dismissed = [...(realDismissed.value ?? []), ...(demoDismissed.value ?? [])];
  return paints.length > 0 && dismissed.length > 0 && !isPaintNotificationShown(paints, dismissed);
});
/** The expected price increases' notification, dismissed while its pledges are in the period. */
const buybackStored = useStored(buybackSnapshot);
const priceIncreasesStored = useStored(priceIncreasesItem);
const realPriceDismissed = useStored(dismissedPriceIncreasesItem);
const demoPriceDismissed = useStored(demoDismissedPriceIncreasesItem);
const priceToRestore = computed(() => {
  if (!kindOn('priceIncreases')) return false;
  const now = Date.now();
  const pledges = storedPriceIncreasePledges(
    buybackStored.value,
    storedPriceIncreases(priceIncreasesStored.value ?? null),
    now,
  );
  const ids = pledgesWithinDays(pledges, now, props.settings.priceIncreaseDays);
  const dismissed = [...(realPriceDismissed.value ?? []), ...(demoPriceDismissed.value ?? [])];
  return ids.length > 0 && dismissed.length > 0 && !isPriceIncreaseNoteShown(ids, dismissed);
});
/** The hint on browser notifications, dismissed while they are off. */
const hintToRestore = computed(() => allowed.value === false && hintDismissed.value === true);

// Not in the demo mode (#132): the count would tell the account's notifications.
const demo = useDemoContext();
const restoreCount = computed(() =>
  demo.value
    ? 0
    : notesToRestore.value.length +
      Number(paintToRestore.value) +
      Number(priceToRestore.value) +
      Number(hintToRestore.value),
);
/** How many came back with the last click, shown below the button. */
const restored = ref<number>();

async function restore() {
  const count = restoreCount.value;
  const ids = new Set(notesToRestore.value.map((note) => note.id));
  await Promise.all([
    updateNotifications((list) => withRestored(list, ids)),
    paintToRestore.value ? restorePaintNotifications() : undefined,
    priceToRestore.value ? restorePriceIncreaseNotes() : undefined,
    hintToRestore.value ? browserNotificationsHintDismissedItem.setValue(false) : undefined,
  ]);
  restored.value = count;
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('notifications.title') }}</legend>
    <!-- Linked from the sidebar's hint about browser notifications. -->
    <SettingCheck
      :id="BROWSER_NOTIFICATIONS_SETTING_ID"
      :key="checkKey"
      class="shm-setting-anchor"
      :checked="!!allowed"
      :hint="i18n.t('settings.browserNotificationsHint')"
      @change="setBrowserNotifications"
    >
      {{ i18n.t('settings.browserNotifications') }}
    </SettingCheck>
    <p v-if="!allowed && refused" class="shm-hint is-indented is-warning" role="status">
      {{ i18n.t('settings.browserNotificationsRefused') }}
    </p>
    <p v-else-if="!allowed && asked" class="shm-hint is-indented" role="status">
      {{ i18n.t('settings.browserNotificationsAsked') }}
    </p>
    <!-- The kinds only the browser shows, below the switch they depend on (#197). -->
    <div class="shm-setting-subgroup" role="group" :aria-disabled="!allowed">
      <SettingCheck
        :checked="kindOn('meltReady')"
        :disabled="!allowed"
        :hint="i18n.t('settings.notificationKindMeltReadyHint')"
        @change="(on) => setKind('meltReady', on)"
      >
        {{ i18n.t('settings.notificationKindMeltReady') }}
      </SettingCheck>
    </div>

    <!-- The Pledge Store: its changes (#164), in the sidebar, new warbond CCUs also in the browser;
         its events (#69), in the sidebar. -->
    <p class="shm-field-label">{{ i18n.t('settings.storeChangeNotifications') }}</p>
    <SettingCheck
      :checked="kindOn('warbonds')"
      :hint="i18n.t('settings.notificationKindWarbondsHint')"
      @change="(on) => setKind('warbonds', on)"
    >
      {{ i18n.t('settings.notificationKindWarbonds') }}
    </SettingCheck>
    <SettingCheck
      :checked="kindOn('storeItems')"
      :hint="i18n.t('settings.notificationKindStoreItemsHint')"
      @change="(on) => setKind('storeItems', on)"
    >
      {{ i18n.t('settings.notificationKindStoreItems') }}
    </SettingCheck>
    <SettingCheck
      :checked="kindOn('events')"
      :hint="i18n.t('settings.notificationKindEventsHint')"
      @change="(on) => setKind('events', on)"
    >
      {{ i18n.t('settings.notificationKindEvents') }}
    </SettingCheck>

    <!-- The buy back: its pledges whose price is expected to rise (#193), in the sidebar and,
         shortly before, in the browser. -->
    <p class="shm-field-label">{{ i18n.t('settings.buybackNotifications') }}</p>
    <SettingCheck
      :checked="kindOn('priceIncreases')"
      :hint="i18n.t('settings.notificationKindPriceIncreasesHint')"
      @change="(on) => setKind('priceIncreases', on)"
    >
      {{ i18n.t('settings.notificationKindPriceIncreases') }}
    </SettingCheck>

    <p class="shm-field-label">{{ i18n.t('settings.sidebarNotifications') }}</p>
    <button type="button" class="shm-button" :disabled="!restoreCount" @click="restore">
      <SvgIcon name="rotate-left" />
      {{ i18n.t('settings.restoreNotifications') }}
    </button>
    <p class="shm-hint">{{ i18n.t('settings.restoreNotificationsHint') }}</p>
    <p v-if="restored && !restoreCount" class="shm-hint is-done" role="status">
      {{ i18n.t('settings.restoreNotificationsDone', [restored]) }}
    </p>
    <p v-else-if="!restoreCount" class="shm-hint">
      {{ i18n.t('settings.restoreNotificationsNone') }}
    </p>
  </fieldset>
</template>

<style scoped>
.shm-hint.is-done {
  color: var(--shm-success);
}

.shm-hint.is-warning {
  color: var(--shm-warning);
}
</style>
