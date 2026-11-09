<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import {
  mirrorNotificationPermission,
  requestNotificationPermission,
} from '@/notifications/browser-permission';
import { useSettings } from '@/settings/use-settings';
import { themeClass } from '@/themes/theme';
import { onMounted, ref } from 'vue';

/*
 * The extension's page that asks for the permission of browser notifications (#152): the browser
 * asks only on an extension page, in reply to a click there – the settings on RSI's page open it.
 */

const { settings } = useSettings();
/** `asking` until the answer is known; `already` if it was allowed before this page opened. */
const state = ref<'ready' | 'asking' | 'granted' | 'already' | 'refused'>('ready');

onMounted(async () => {
  if (await mirrorNotificationPermission()) state.value = 'already';
});

async function allow() {
  state.value = 'asking';
  const granted = await requestNotificationPermission();
  state.value = granted ? 'granted' : 'refused';
  // One notification right away, so it is clear they reach the screen (the system may block
  // the browser's notifications).
  if (granted) {
    await browser.notifications.create('shm-notifications-on', {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: i18n.t('extName'),
      message: i18n.t('browserNotifications.testMessage'),
    });
  }
}
</script>

<template>
  <main class="shm-permission" :class="themeClass(settings.theme)">
    <h1>
      <SvgIcon name="bell" />
      {{ i18n.t('browserNotifications.title') }}
    </h1>
    <p>{{ i18n.t('browserNotifications.intro') }}</p>
    <p class="shm-permission-note">{{ i18n.t('browserNotifications.privacy') }}</p>

    <template v-if="state === 'ready' || state === 'asking' || state === 'refused'">
      <button type="button" :disabled="state === 'asking'" @click="allow">
        {{ i18n.t('browserNotifications.allow') }}
      </button>
      <p v-if="state === 'refused'" class="shm-permission-status is-warning" role="status">
        {{ i18n.t('browserNotifications.refused') }}
      </p>
    </template>
    <p v-else class="shm-permission-status is-done" role="status">
      {{
        i18n.t(
          state === 'already' ? 'browserNotifications.already' : 'browserNotifications.granted',
        )
      }}
    </p>
  </main>
</template>

<style scoped>
.shm-permission {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 48px 24px;
  color: var(--shm-text);
  font-size: 15px;
  line-height: 1.5;
  background: var(--shm-surface-elevated);
}

.shm-permission.shm-theme-modern {
  background: var(--shm-background);
}

.shm-permission > * {
  max-width: 560px;
  margin-right: auto;
  margin-left: auto;
}

h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 0;
  font-size: 22px;
}

h1 .shm-icon {
  color: var(--shm-accent);
}

.shm-permission-note {
  color: var(--shm-text-muted);
  font-size: 13px;
}

button {
  display: block;
  margin-top: 24px;
  padding: 10px 18px;
  color: var(--shm-text-on-accent);
  font: inherit;
  font-weight: 600;
  background: var(--shm-accent);
  border: 0;
  border-radius: var(--shm-radius-control);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.shm-permission-status {
  margin-top: 16px;
}

.shm-permission-status.is-done {
  color: var(--shm-success);
}

.shm-permission-status.is-warning {
  color: var(--shm-warning);
}
</style>
