<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useStored } from '@/storage/use-stored';
import {
  demoDismissedPaintsItem,
  dismissedPaintsItem,
  restorePaintNotifications,
} from '@/store/paint-consultant/paint-notification';
import { computed, ref } from 'vue';

/*
 * The notifications of the sidebar's "Notifications" box: the Paint Discount Consultant's one can
 * be dismissed for its paints (#151); here it is shown again for all of them – on every browser,
 * as the dismissed paints are synced.
 */

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
</style>
