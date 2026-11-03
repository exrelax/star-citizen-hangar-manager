<script setup lang="ts">
import { RSI_HANGAR_URL, REPOSITORY_URL } from '@/config';
import { hashOfTab } from '@/hangar/route';
import { i18n, type MessageKey } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { themeClass } from '@/themes/theme';

/** The popup of the toolbar icon: where to go from it. */
const LINKS: { label: MessageKey; icon: IconName; url: string }[] = [
  { label: 'popup.manager', icon: 'box', url: RSI_HANGAR_URL + hashOfTab('hangar') },
  { label: 'popup.settings', icon: 'gear', url: RSI_HANGAR_URL + hashOfTab('settings') },
  { label: 'popup.repository', icon: 'github', url: REPOSITORY_URL },
];

const { settings } = useSettings();

/** Opens the link in a new tab and closes the popup, which would otherwise stay open. */
async function open(url: string) {
  await browser.tabs.create({ url });
  window.close();
}
</script>

<template>
  <nav class="shm-popup" :class="themeClass(settings.theme)" :aria-label="i18n.t('extName')">
    <p class="shm-popup-title">{{ i18n.t('extName') }}</p>
    <ul>
      <li v-for="link in LINKS" :key="link.url">
        <a class="shm-popup-link" :href="link.url" @click.prevent="open(link.url)">
          <SvgIcon :name="link.icon" />
          {{ i18n.t(link.label) }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.shm-popup {
  width: 220px;
  padding: 10px;
  color: var(--shm-text);
  font-size: 13px;
  background: var(--shm-surface-elevated);
}

/* "Modern Hangar" has its own ground (src/themes/modern.css). */
.shm-popup.shm-theme-modern {
  background: var(--shm-background);
}

.shm-popup-title {
  margin: 2px 8px 8px;
  color: var(--shm-text-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-popup-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  color: var(--shm-text);
  text-decoration: none;
  border-radius: 6px;
}

.shm-popup-link .shm-icon {
  color: var(--shm-accent);
  font-size: 15px;
}

.shm-popup-link:hover,
.shm-popup-link:focus-visible {
  background: rgb(var(--shm-accent-rgb) / 0.14);
  outline: none;
}
</style>
