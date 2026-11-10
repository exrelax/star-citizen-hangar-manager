<script setup lang="ts">
import { locale } from '@/i18n';
import { updateNotifications, withAdded } from '@/notifications/notifications';
import { storeItemsNote, warbondNote } from '@/store/store-change-notes';
import SvgIcon from '@/icons/SvgIcon.vue';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import {
  READ_PLEDGE_STORE_IN_BACKGROUND,
  type BackgroundReadResult,
} from '@/store/background-schedule';
import { computed, ref } from 'vue';
import { DEMO } from '@/config';
import {
  invisibleDemoUntilItem,
  startInvisibleDemo,
  stopInvisibleDemo,
} from '@/demo/invisible-demo';
import { useSettings } from '@/settings/use-settings';
import { useStored } from '@/storage/use-stored';
import { useNow } from '@/shared/use-now';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';

/*
 * Tools for developing the extension, shown as DEVELOPMENT_SHOWN says (development.ts). Its texts
 * are English only, like the styleguide.
 */
const openStyleguide = () => void browser.runtime.sendMessage(OPEN_STYLEGUIDE);

/**
 * The invisible demo mode for screenshots (#133): turns the demo mode on without its badge and
 * disabled look, for `DEMO.invisibleMinutes`; then the normal demo mode is back.
 */
const { update } = useSettings();
const invisibleUntil = useStored(invisibleDemoUntilItem);
const clock = useNow();
const invisibleLeft = computed(() => {
  const until = invisibleUntil.value;
  // The page's clock lags up to half a minute: rounded, at least one minute while it lasts.
  return until && until > clock.value ? Math.max(1, Math.round((until - clock.value) / 60_000)) : 0;
});
async function toggleInvisibleDemo() {
  if (invisibleLeft.value) return stopInvisibleDemo();
  update({ demoMode: true });
  await startInvisibleDemo();
}

/** A test read of the Pledge Store by the background script (#163), nothing stored. */
const backgroundRead = ref<BackgroundReadResult | 'reading'>();
const backgroundHint = computed(() => {
  const read = backgroundRead.value;
  if (read === 'reading') return 'Reading …';
  if (read?.status === 'read') {
    return `${read.ships} ships, ${read.warbonds} warbonds, ${read.items} store items in ${read.requests} requests, ${read.ms} ms. Nothing was stored.`;
  }
  if (read) return `${read.status}: ${read.message}`;
  return 'What the background script gets from RSI with no page: the upgrade tool and the store items, read once and not stored.';
});
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
  <p class="shm-settings-intro">Tools for working on the extension, in development builds only.</p>
  <SettingsGroup>
    <SettingRow
      label="Styleguide"
      hint="All building blocks of the manager with made-up pledges, in a new tab."
    >
      <button type="button" class="shm-button" @click="openStyleguide">
        <SvgIcon name="square-up-right" />
        Open
      </button>
    </SettingRow>
    <SettingRow
      label="Sample Pledge Store notifications"
      hint="New and gone warbond CCUs (also as a browser notification, if allowed) and changed store items, in the sidebar's notifications."
    >
      <button
        type="button"
        class="shm-button"
        data-shm-dev="sample-store-notes"
        @click="addSampleStoreNotes"
      >
        <SvgIcon name="bell" />
        Add
      </button>
    </SettingRow>
    <SettingRow
      :label="
        invisibleLeft ? `Invisible demo mode: ${invisibleLeft} min left` : 'Invisible demo mode'
      "
      :hint="`The demo mode without its badge and with every button looking enabled, for screenshots (${DEMO.invisibleMinutes} minutes, then the normal demo mode is back).`"
    >
      <button type="button" class="shm-button" @click="toggleInvisibleDemo">
        <SvgIcon name="lock-open" />
        {{ invisibleLeft ? 'End now' : 'Start' }}
      </button>
    </SettingRow>
    <SettingRow
      label="Read the Pledge Store in the background"
      :hint="backgroundHint"
      hint-id="shm-dev-background-read-result"
    >
      <button
        type="button"
        class="shm-button"
        data-shm-dev="background-read"
        :disabled="backgroundRead === 'reading'"
        @click="readInBackground"
      >
        <SvgIcon name="clock-rotate-left" />
        Run
      </button>
    </SettingRow>
  </SettingsGroup>
</template>
