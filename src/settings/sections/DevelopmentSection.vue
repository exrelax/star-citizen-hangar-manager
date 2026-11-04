<script setup lang="ts">
import { REPOSITORY_URL } from '@/config';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { OPEN_STYLEGUIDE } from '@/shared/messages';

// Development builds only, and not on the styleguide itself (see wxt.config.ts).
const showStyleguideLink = import.meta.env.DEV && !location.pathname.endsWith('/styleguide.html');
const openStyleguide = () => void browser.runtime.sendMessage(OPEN_STYLEGUIDE);
</script>

<template>
  <section class="shm-setting">
    <span class="shm-label">{{ i18n.t('settings.development') }}</span>
    <ul class="shm-dev-links">
      <li v-if="showStyleguideLink">
        <a class="shm-dev-link" href="#" @click.prevent="openStyleguide">
          <SvgIcon name="paintbrush" />
          Styleguide
        </a>
        <p class="shm-hint">
          All building blocks of the manager with made-up pledges, in a new tab.
        </p>
      </li>
      <li>
        <a class="shm-dev-link" :href="REPOSITORY_URL" target="_blank" rel="noopener noreferrer">
          <SvgIcon name="github" />
          {{ i18n.t('popup.repository') }}
        </a>
        <p class="shm-hint">{{ i18n.t('settings.repositoryHint') }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.shm-dev-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-dev-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-dev-link:hover,
.shm-dev-link:focus-visible {
  text-decoration: underline;
  outline: none;
}
</style>
