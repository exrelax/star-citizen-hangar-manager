<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import {
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
  restorePaintNotifications,
} from '@/store/paint-consultant/paint-notification';
import { computed, ref } from 'vue';

/*
 * Notifications: browser notifications, an optional extra for when no RSI page is open (#152,
 * see `notifications/browser-permission.ts`), and the sidebar's "Notifications" box, where the
 * Paint Discount Consultant's one can be dismissed for its paints (#151) – here it is shown again
 * for all of them, on every browser, as the dismissed paints are synced.
 */

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

const real = useStored(dismissedPaintsItem);
const demo = useStored(demoDismissedPaintsItem);
const dismissed = computed(() => (real.value?.length ?? 0) + (demo.value?.length ?? 0) > 0);
/** Shown below the button once it restored them, until the next dismissal. */
const restored = ref(false);

async function restore() {
  await restorePaintNotifications();
  restored.value = true;
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

    <p class="shm-field-label">{{ i18n.t('settings.sidebarNotifications') }}</p>
    <button type="button" class="shm-button" :disabled="!dismissed" @click="restore">
      <SvgIcon name="rotate-left" />
      {{ i18n.t('settings.restorePaintNotifications') }}
    </button>
    <p class="shm-hint">{{ i18n.t('settings.restorePaintNotificationsHint') }}</p>
    <p v-if="restored && !dismissed" class="shm-hint is-done" role="status">
      {{ i18n.t('settings.restorePaintNotificationsDone') }}
    </p>
    <p v-else-if="!dismissed" class="shm-hint">
      {{ i18n.t('settings.restorePaintNotificationsNone') }}
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
