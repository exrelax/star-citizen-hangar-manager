<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { OPEN_STYLEGUIDE } from '@/shared/messages';

/*
 * Tools for developing the extension: development builds only, and not on the styleguide itself
 * (see wxt.config.ts). Its texts are English only, like the styleguide.
 */
const shown = import.meta.env.DEV && !location.pathname.endsWith('/styleguide.html');
const openStyleguide = () => void browser.runtime.sendMessage(OPEN_STYLEGUIDE);
</script>

<template>
  <section v-if="shown" class="shm-setting">
    <span class="shm-label">{{ i18n.t('settings.development') }}</span>
    <ul class="shm-link-list">
      <li>
        <a class="shm-link" href="#" @click.prevent="openStyleguide">
          <SvgIcon name="paintbrush" />
          Styleguide
        </a>
        <p class="shm-hint">
          All building blocks of the manager with made-up pledges, in a new tab.
        </p>
      </li>
    </ul>
  </section>
</template>
