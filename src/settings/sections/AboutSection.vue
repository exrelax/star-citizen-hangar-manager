<script setup lang="ts">
import { REPOSITORY_LINKS, REPOSITORY_URL } from '@/config';
import { i18n, type MessageKey } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import SettingsGroup from '../SettingsGroup.vue';
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
  <p class="shm-settings-intro">
    {{ i18n.t('extName') }}
    <span class="shm-about-version">{{ i18n.t('settings.version', [version]) }}</span>
  </p>
  <SettingsGroup :footer="i18n.t('settings.disclaimer')">
    <a
      v-for="link in LINKS"
      :key="link.url"
      class="shm-setting-row shm-setting-link"
      :href="link.url"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="shm-setting-row-main">
        <span class="shm-setting-link-icon"><SvgIcon :name="link.icon" /></span>
        <span class="shm-setting-row-text">
          <span class="shm-setting-row-label">{{ i18n.t(link.label) }}</span>
          <span class="shm-hint">{{ i18n.t(link.hint) }}</span>
        </span>
        <SvgIcon class="shm-setting-link-external" name="square-up-right" />
      </span>
    </a>
  </SettingsGroup>
</template>

<style scoped>
.shm-about-version {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}
</style>
