<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import { PLEDGE_STORE } from '@/config';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { formatRelativeTime } from '@/shared/lib/relative-time';
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  maybeRefreshUpgradeTool,
  refreshUpgradeTool,
  upgradeToolState,
} from '@/ships/sync-upgrade-tool';
import { useStoreData } from '../use-store-data';
import { buildWarbondOffers } from '../warbond';
import { useCcusToSecure } from '@/price-increases/use-ccus-to-secure';
import { confirmationNote } from '@/price-increases/price-increase-label';
import SecureRow from '@/price-increases/components/SecureRow.vue';
import RefreshIcon from '@/hangar/components/RefreshIcon.vue';
import WarbondRow from './WarbondRow.vue';
import PaintConsultant from './PaintConsultant.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import EventList from '@/events/components/EventList.vue';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import { useStored } from '@/storage/use-stored';
import { useDemoContext } from '@/demo/use-demo';

/*
 * The "Pledge Store" tab: the warbond CCUs RSI currently offers, each with the cheapest ships to
 * start from and the hangar's CCUs that can't be chained with it. The offers are stored; while the
 * tab is shown they are read again once due (see ships/sync-upgrade-tool.ts and the smart update settings).
 */

const props = defineProps<{
  /** The hangar's pledges (in the demo mode the demo selection), for the CCUs it already has. */
  pledges: PledgeView[];
  /** The buy back's pledges (in the demo mode the demo selection), for the ships it has. */
  buyback: BuybackView[];
  settings: Settings;
  active: boolean;
}>();

const { data, fetchedAt, loaded } = useStoreData();

/** The events of the project website (#69): shown above the warbond CCUs while they last. */
const storedEvents = useStored(eventsItem);
// The demo shows events of its own (#210), never the website's.
const demoContext = useDemoContext();
const events = computed(() =>
  demoContext.value
    ? demoContext.value.events
    : storedEvents.value?.version === EVENTS_VERSION
      ? storedEvents.value.events
      : [],
);

// While the tab is shown: right away, then now and then, whether the offers are due.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
const stopTimer = () => clearInterval(timer);
watch(
  () => props.active,
  (active) => {
    stopTimer();
    if (!active) return;
    void maybeRefreshUpgradeTool();
    timer = setInterval(() => {
      now.value = Date.now();
      if (document.visibilityState === 'visible') void maybeRefreshUpgradeTool();
    }, PLEDGE_STORE.dueCheckMs);
  },
  { immediate: true },
);
onUnmounted(stopTimer);

// The demo has warbond offers of its own (#130), shown on any account.
const storeData = computed(() => demoContext.value?.storeData ?? data.value);
const offers = computed(() =>
  storeData.value ? buildWarbondOffers(storeData.value, props.pledges, props.buyback) : [],
);

/** The CCUs to secure before a price increase (#253). */
const secure = useCcusToSecure(
  () => props.pledges,
  () => props.buyback,
  now,
);
/** Whether their price increases are expected or confirmed by CIG (#275). */
const secureNote = computed(() => confirmationNote(secure.value.map((offer) => offer.increase)));

const updated = computed(
  () =>
    fetchedAt.value !== undefined &&
    i18n.t('store.fetchedAt', [formatRelativeTime(fetchedAt.value, now.value, locale.value)]),
);

const displayClasses = computed(() => ({
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-values': props.settings.hideMeltValue,
}));
</script>

<template>
  <section class="shm-store" :class="displayClasses" aria-labelledby="shm-store-title">
    <EventList :events="events" />
    <h3 id="shm-store-title" class="shm-store-title">{{ i18n.t('store.warbondTitle') }}</h3>
    <p class="shm-store-intro">{{ i18n.t('store.warbondIntro') }}</p>

    <p v-if="!data && (!loaded || upgradeToolState.loading)" class="shm-store-state" role="status">
      {{ i18n.t('store.loading') }}
    </p>
    <div v-else-if="upgradeToolState.error" class="shm-store-state is-error" role="alert">
      <p>{{ i18n.t('store.failed', [upgradeToolState.error]) }}</p>
      <button
        type="button"
        class="shm-button"
        :disabled="upgradeToolState.loading"
        @click="refreshUpgradeTool()"
      >
        {{ i18n.t('store.retry') }}
      </button>
    </div>
    <template v-if="data">
      <p class="shm-count">
        <span>{{ i18n.t('store.count', [offers.length]) }}</span>
        <span class="shm-store-updated">
          <span v-if="upgradeToolState.loading">{{ i18n.t('store.updating') }}</span>
          <span v-else-if="updated">{{ updated }}</span>
          <!-- Reads only the Pledge Store again, not hangar and buy back. -->
          <button
            v-tooltip="i18n.t('store.refresh')"
            type="button"
            class="shm-store-refresh"
            :disabled="upgradeToolState.loading"
            :aria-label="i18n.t('store.refresh')"
            @click="refreshUpgradeTool()"
          >
            <RefreshIcon :spinning="upgradeToolState.loading" />
          </button>
        </span>
      </p>
      <!-- The container of the manager's lists: their gaps and compact view (row.css, modern.css). -->
      <div v-if="offers.length" class="shm-rows">
        <WarbondRow v-for="offer in offers" :key="offer.target.skuId" :offer="offer" />
      </div>
      <p v-if="!offers.length" class="shm-store-state">{{ i18n.t('store.empty') }}</p>
    </template>

    <!-- The CCUs to secure before a price increase (#253), set apart below the warbond CCUs. -->
    <section v-if="secure.length" class="shm-store-secure" aria-labelledby="shm-store-secure-title">
      <h3 id="shm-store-secure-title" class="shm-store-title">
        {{ i18n.t('ccusToSecure.title') }}
      </h3>
      <p class="shm-store-intro">
        {{ i18n.t('ccusToSecure.intro') }}
        <template v-if="secureNote">{{ i18n.t(secureNote) }}</template>
      </p>
      <div class="shm-rows">
        <SecureRow v-for="offer in secure" :key="offer.ship.id" :offer="offer" />
      </div>
    </section>

    <PaintConsultant :settings="settings" />
  </section>
</template>

<style scoped>
.shm-store {
  margin-top: 20px;
}

.shm-count {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  margin: 10px 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-store-updated {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Icon only, in the accent color; it spins while the offers are read. */
.shm-store-refresh {
  display: inline-flex;
  padding: 2px;
  color: var(--shm-accent);
  font: inherit;
  background: none;
  border: 0;
  border-radius: var(--shm-radius-small);
  cursor: pointer;
}

.shm-store-refresh:hover:not(:disabled),
.shm-store-refresh:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
  background: rgb(var(--shm-accent-rgb) / 0.14);
}

.shm-store-refresh:disabled {
  cursor: progress;
}

/* Clearly apart from the warbond CCUs above. */
.shm-store-secure {
  margin-top: 32px;
}

.shm-store-state {
  margin: 20px 0;
  color: var(--shm-text-muted);
}

.shm-store-state.is-error p {
  margin: 0 0 8px;
  color: var(--shm-danger);
}
</style>

<!-- Shared with the events above the warbond CCUs (EventList.vue): not scoped. -->
<style>
.shm-store-title {
  /* Below RSI's fixed top bar when a notification scrolls to it. */
  scroll-margin-top: 90px;
  margin: 0 0 4px;
  color: var(--shm-text-strong);
  font-size: calc(16px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-store-intro {
  margin: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}
</style>
