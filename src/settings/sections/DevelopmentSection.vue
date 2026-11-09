<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { updateNotifications, withAdded } from '@/notifications/notifications';
import { storeItemsNote, warbondNote } from '@/store/store-change-notes';
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

/**
 * Sample notifications about changes in the Pledge Store (#164), as a read would add them: new and
 * gone warbond CCUs (also a browser notification, if allowed) and changed store items.
 */
async function addSampleStoreNotes() {
  const at = Date.now();
  const ships = [
    { id: 1, name: 'Zeus Mk II MR', msrp: 190 },
    { id: 2, name: 'Cutlass Black', msrp: 110 },
    { id: 3, name: 'Aurora Mk I CL', msrp: 45 },
  ];
  const warbond = (shipId: number, price: number) => ({ shipId, skuId: shipId, price });
  const item = (id: number, name: string, price: number, discountedPrice?: number) => ({
    id,
    name,
    category: 'Gear',
    price,
    ...(discountedPrice !== undefined && { discountedPrice }),
    isWarbond: false,
    available: true,
  });
  const notes = [
    warbondNote([warbond(3, 40)], [warbond(1, 170), warbond(2, 100)], ships, locale.value, at),
    storeItemsNote(
      [item(1, 'Morozov-SH Helmet', 10), item(2, 'Venture Armor', 20), item(3, 'Sabre Paint', 9)],
      [
        item(1, 'Morozov-SH Helmet', 12),
        item(2, 'Venture Armor', 20, 15),
        item(4, 'Flight Suit', 8),
      ],
      locale.value,
      at,
    ),
  ].filter((note) => note !== undefined);
  await updateNotifications((list) => withAdded(list, notes));
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
          data-shm-dev="sample-store-notes"
          @click.prevent="addSampleStoreNotes"
        >
          <SvgIcon name="bell" />
          Add sample Pledge Store notifications
        </a>
        <p class="shm-hint">
          New and gone warbond CCUs (also as a browser notification, if allowed) and changed store
          items, in the sidebar's notifications.
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
