<script setup lang="ts">
import { REPOSITORY_LINKS, REPOSITORY_URL } from '@/config';
import { i18n, type MessageKey } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { extensionVersion } from '@/shared/extension-version';

/** The extension's version and pages on GitHub, for everyone (unlike the development section). */

const LINKS: { label: MessageKey; hint: MessageKey; icon: IconName; url: string }[] = [
  {
    label: 'popup.repository',
    hint: 'settings.repositoryHint',
    icon: 'github',
    url: REPOSITORY_URL,
  },
  {
    label: 'settings.reportIssue',
    hint: 'settings.reportIssueHint',
    icon: 'bug',
    url: REPOSITORY_LINKS.issues,
  },
  {
    label: 'settings.privacyPolicy',
    hint: 'settings.privacyPolicyHint',
    icon: 'shield-halved',
    url: REPOSITORY_LINKS.privacy,
  },
  {
    label: 'settings.changelog',
    hint: 'settings.changelogHint',
    icon: 'clock-rotate-left',
    url: REPOSITORY_LINKS.changelog,
  },
  {
    label: 'settings.license',
    hint: 'settings.licenseHint',
    icon: 'scale-balanced',
    url: REPOSITORY_LINKS.license,
  },
];

const version = extensionVersion();
</script>

<template>
  <section class="shm-setting">
    <span class="shm-label">{{ i18n.t('settings.about') }}</span>
    <p class="shm-about-name">
      {{ i18n.t('extName') }}
      <span class="shm-about-version">{{ i18n.t('settings.version', [version]) }}</span>
    </p>
    <ul class="shm-link-list is-grid">
      <li v-for="link in LINKS" :key="link.url">
        <a class="shm-link" :href="link.url" target="_blank" rel="noopener noreferrer">
          <SvgIcon :name="link.icon" />
          {{ i18n.t(link.label) }}
        </a>
        <p class="shm-hint">{{ i18n.t(link.hint) }}</p>
      </li>
    </ul>
    <p class="shm-hint shm-about-disclaimer">{{ i18n.t('settings.disclaimer') }}</p>
  </section>
</template>

<style scoped>
.shm-about-name {
  margin: 0 0 14px;
  color: var(--shm-text-strong);
}

.shm-about-version {
  margin-left: 6px;
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}

.shm-about-disclaimer {
  margin-top: 16px;
}
</style>
