<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import { useDemoContext } from '@/demo/use-demo';
import type { PledgeView } from '@/hangar/pledge-view';
import RefreshIcon from '@/hangar/components/RefreshIcon.vue';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import {
  priceIncreasesItem,
  storedPriceIncreases,
} from '@/price-increases/price-increases-storage';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { shipRemovalsItem, storedShipRemovals } from '@/ship-removals/ship-removals-storage';
import { refreshUpgradeTool, upgradeToolState } from '@/ships/sync-upgrade-tool';
import { useStored } from '@/storage/use-stored';
import { computed, ref } from 'vue';
import { useStoreData } from '../use-store-data';
import AllShipsOverlay from './AllShipsOverlay.vue';

/*
 * "All ships" above the manager, left of "Ship upgrade" (#452): opens the table of all ships by
 * value (#385) from every tab. Without the Pledge Store data yet – the tab wasn't opened, or its
 * read failed – it reads it first, spinning while it does, and says so if that fails. The demo
 * counts the demo hangar and buy back, with its own price increases and ship removals unless it
 * shows the real Pledge Store data (#310), as the Pledge Store tab does.
 */

const props = defineProps<{
  /** The hangar's pledges (in the demo mode the demo selection). */
  pledges: readonly PledgeView[];
  /** The buy back's pledges (in the demo mode the demo selection). */
  buyback: readonly BuybackView[];
  settings: Settings;
  /** Whether the hangar and the buy back were read. */
  hangarRead: boolean;
  buybackRead: boolean;
}>();

const { data } = useStoreData();
const demo = useDemoContext();
const realInDemo = computed(() => !!demo.value && props.settings.demo.realStoreData);
const storeData = computed(() =>
  realInDemo.value ? data.value : (demo.value?.storeData ?? data.value),
);

const storedRemovals = useStored(shipRemovalsItem);
const removals = computed(() =>
  demo.value && !realInDemo.value
    ? demo.value.shipRemovals.removals
    : storedShipRemovals(storedRemovals.value ?? null),
);
const storedIncreases = useStored(priceIncreasesItem);
const increases = computed(
  () =>
    (realInDemo.value ? undefined : demo.value?.priceIncreases) ??
    storedPriceIncreases(storedIncreases.value ?? null),
);

const open = ref(false);
/** This button asked for the read: it spins and shows its outcome. */
const reading = ref(false);
const failed = ref<string>();
const hasShips = () => !!storeData.value?.ships.length;

async function show() {
  failed.value = undefined;
  if (hasShips()) {
    open.value = true;
    return;
  }
  reading.value = true;
  try {
    const result = await refreshUpgradeTool();
    if (hasShips()) open.value = true;
    else
      failed.value =
        result === 'signedOut'
          ? i18n.t('allShips.signedOut')
          : i18n.t('allShips.failed', [upgradeToolState.error ?? '']);
  } finally {
    reading.value = false;
  }
}
</script>

<template>
  <span class="shm-all-ships-action">
    <button
      v-tooltip="i18n.t('allShips.buttonHint')"
      type="button"
      class="shm-button"
      :aria-busy="reading"
      :disabled="reading"
      @click="show"
    >
      <RefreshIcon v-if="reading" spinning />
      <SvgIcon v-else name="list" />
      {{ i18n.t('allShips.button') }}
    </button>
    <span v-if="reading" class="shm-visually-hidden" role="status">
      {{ i18n.t('allShips.loading') }}
    </span>
    <span v-if="failed" class="shm-all-ships-error" role="alert">{{ failed }}</span>
  </span>
  <AllShipsOverlay
    v-if="open && storeData"
    :ships="storeData.ships"
    :warbonds="storeData.warbonds"
    :pledges="pledges"
    :buyback="buyback"
    :increases="increases"
    :removals="removals"
    :hangar-read="hangarRead"
    :buyback-read="buybackRead"
    @close="open = false"
  />
</template>

<style scoped>
.shm-all-ships-action {
  position: relative;
  display: inline-flex;
}

.shm-all-ships-action .shm-button {
  white-space: nowrap;
}

/* Below the button, right-aligned with the actions, without moving them. */
.shm-all-ships-error {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 3;
  width: max-content;
  max-width: min(360px, 80vw);
  padding: 6px 10px;
  color: var(--shm-danger);
  font-size: calc(12px * var(--shm-font-scale));
  background: var(--shm-surface-elevated);
  border: 1px solid currentcolor;
  border-radius: var(--shm-radius-small);
}
</style>
