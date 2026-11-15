<script setup lang="ts">
import { RSI_HANGAR_URL, REPOSITORY_URL } from '@/config';
import { hashOfTab } from '@/hangar/route';
import { i18n, type MessageKey } from '@/i18n';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { extensionVersion } from '@/shared/extension-version';
import { useSettings } from '@/settings/use-settings';
import { hasRsiAccess, requestRsiAccess } from '@/shared/rsi-access';
import { themeClass } from '@/themes/theme';
import { onMounted, ref } from 'vue';

/** The popup of the toolbar icon: where to go from it. */
const LINKS: { label: MessageKey; icon: IconName; iconSet?: IconSet; url: string }[] = [
  {
    label: 'popup.manager',
    icon: 'hangar',
    iconSet: 'custom',
    url: RSI_HANGAR_URL + hashOfTab('hangar'),
  },
  { label: 'popup.settings', icon: 'gear', url: RSI_HANGAR_URL + hashOfTab('settings') },
  { label: 'popup.repository', icon: 'github', url: REPOSITORY_URL },
];

const { settings } = useSettings();
const version = extensionVersion();

/**
 * Without access to RSI's website the Hangar Manager can't show up there – in Firefox, e.g., when
 * the access was never granted or taken back (see `shared/rsi-access.ts`).
 */
const missingAccess = ref(false);
onMounted(async () => {
  missingAccess.value = !(await hasRsiAccess());
});

/**
 * Asks the browser right in the click. Firefox may close the popup for its question; the
 * background script then loads the open RSI tabs again.
 */
async function allowAccess() {
  try {
    if (await requestRsiAccess()) missingAccess.value = false;
  } catch {
    missingAccess.value = !(await hasRsiAccess());
  }
}

/** Opens the link in a new tab and closes the popup, which would otherwise stay open. */
async function open(url: string) {
  await browser.tabs.create({ url });
  window.close();
}
</script>

<template>
  <nav class="shm-popup" :class="themeClass(settings.theme)" :aria-label="i18n.t('extName')">
    <p class="shm-popup-title">
      {{ i18n.t('extName') }}
      <span class="shm-popup-version">{{ i18n.t('settings.version', [version]) }}</span>
    </p>
    <section v-if="missingAccess" class="shm-popup-access" role="alert">
      <p class="shm-popup-access-title">
        <SvgIcon name="triangle-exclamation" />
        {{ i18n.t('popup.accessTitle') }}
      </p>
      <p class="shm-popup-access-text">{{ i18n.t('popup.accessText') }}</p>
      <button type="button" class="shm-popup-access-button" @click="allowAccess">
        {{ i18n.t('popup.accessAllow') }}
      </button>
    </section>
    <ul>
      <li v-for="link in LINKS" :key="link.url">
        <a class="shm-popup-link" :href="link.url" @click.prevent="open(link.url)">
          <SvgIcon :name="link.icon" :set="link.iconSet" />
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

/* Below the name, without the uppercase of the title. */
.shm-popup-version {
  display: block;
  margin-top: 2px;
  letter-spacing: 0;
  text-transform: none;
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
  border-radius: var(--shm-radius-item);
}

.shm-popup-link .shm-icon {
  color: var(--shm-accent);
  font-size: 15px;
}

.shm-popup-access {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 8px;
  padding: 10px;
  background: color-mix(in srgb, var(--shm-warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--shm-warning) 45%, transparent);
  border-radius: var(--shm-radius-item);
}

.shm-popup-access p {
  margin: 0;
}

.shm-popup-access-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--shm-text-strong);
  font-weight: 600;
}

.shm-popup-access-title .shm-icon {
  color: var(--shm-warning);
}

.shm-popup-access-text {
  color: var(--shm-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.shm-popup-access-button {
  align-self: flex-start;
  padding: 5px 12px;
  color: var(--shm-text-strong);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  background: rgb(var(--shm-accent-rgb) / 0.2);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.6);
  border-radius: var(--shm-radius-small);
  cursor: pointer;
}

.shm-popup-access-button:hover,
.shm-popup-access-button:focus-visible {
  background: rgb(var(--shm-accent-rgb) / 0.35);
  border-color: var(--shm-accent);
  outline: none;
}

.shm-popup-link:hover,
.shm-popup-link:focus-visible {
  background: rgb(var(--shm-accent-rgb) / 0.14);
  outline: none;
}
</style>
