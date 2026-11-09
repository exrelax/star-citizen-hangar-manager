<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import {
  READ_PLEDGE_STORE_IN_BACKGROUND,
  type BackgroundReadResult,
} from '@/store/background-schedule';
import { ref } from 'vue';

/*
 * Tools for developing the extension: development builds only, and not on the styleguide itself
 * (see wxt.config.ts). Its texts are English only, like the styleguide.
 */
const shown = import.meta.env.DEV && !location.pathname.endsWith('/styleguide.html');
const openStyleguide = () => void browser.runtime.sendMessage(OPEN_STYLEGUIDE);

/** A test read of the Pledge Store by the background script (#163), nothing stored. */
const backgroundRead = ref<BackgroundReadResult | 'reading'>();
async function readInBackground() {
  backgroundRead.value = 'reading';
  backgroundRead.value = (await browser.runtime.sendMessage(READ_PLEDGE_STORE_IN_BACKGROUND)) as
    BackgroundReadResult | undefined;
}
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
      <li>
        <a
          class="shm-link"
          href="#"
          data-shm-dev="background-read"
          @click.prevent="readInBackground"
        >
          <SvgIcon name="clock-rotate-left" />
          Read the Pledge Store in the background
        </a>
        <p class="shm-hint" data-shm-dev="background-read-result" aria-live="polite">
          <template v-if="backgroundRead === 'reading'">Reading …</template>
          <template v-else-if="backgroundRead?.status === 'read'">
            {{ backgroundRead.ships }} ships, {{ backgroundRead.warbonds }} warbonds,
            {{ backgroundRead.items }} store items in {{ backgroundRead.requests }} requests,
            {{ backgroundRead.ms }} ms. Nothing was stored.
          </template>
          <template v-else-if="backgroundRead">
            {{ backgroundRead.status }}: {{ backgroundRead.message }}
          </template>
          <template v-else>
            What the background script gets from RSI with no page: the upgrade tool and the store
            items, read once and not stored.
          </template>
        </p>
      </li>
    </ul>
  </section>
</template>
