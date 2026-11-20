<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import CcuConsultant from '@/ccu-consultant/components/CcuConsultant.vue';
import { missingCounts, useBaseShipList } from '@/ccu-consultant/use-base-ship-list';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import TabBar from '@/shared/components/TabBar.vue';
import PaintConsultant from '@/store/components/PaintConsultant.vue';
import { computed, ref, watch } from 'vue';
import {
  CONSULTANTS_TOP_ID,
  consultantRequest,
  consultantsOf,
  shownConsultantOf,
  type ConsultantId,
} from '../consultants';

/*
 * The tab "Consultants" (#113, #453), as the layout "Tab „Consultants“ – CCU Consultant (dein
 * Hangar)": the CCU Consultant and the Paint Discount Consultant, each only while it has something
 * to offer (`consultants.ts`). With both, underline tabs with their counts choose one – the CCU
 * Consultant's CCUs without base ship in red, else those only via buy back in orange, the paints of
 * the Paint Discount Consultant's plan; with one, its name is the heading. The Paint Discount
 * Consultant stays mounted while hidden: it tells whether it has something to offer.
 */

defineProps<{
  settings: Settings;
  pledges: PledgeView[];
  buyback: BuybackView[];
  /** The tab is shown: only then the Paint Discount Consultant reads RSI's cart. */
  active: boolean;
}>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const list = useBaseShipList();
const paint = ref({ available: false, count: 0 });

const shown = computed(() =>
  consultantsOf({ ccu: list.value.total > 0, paint: paint.value.available }),
);
const chosen = ref<ConsultantId>();
const current = computed(() => shownConsultantOf(shown.value, chosen.value));
// A link to a consultant (a sidebar box, a mark in My Hangar, a notification).
watch(
  consultantRequest,
  (request) => {
    if (!request) return;
    chosen.value = request.id;
    consultantRequest.value = undefined;
  },
  { immediate: true },
);

const number = computed(() => new Intl.NumberFormat(locale.value));
const ICONS: Record<ConsultantId, IconName> = { ccu: 'link', paint: 'fill-drip' };
const labelOf = (id: ConsultantId) =>
  i18n.t(id === 'ccu' ? 'ccuConsultant.title' : 'consultant.boxTitle');
/** The count of a sub tab, tinted by what it counts; none while there is nothing to count. */
function countOf(id: ConsultantId) {
  if (id === 'paint') {
    return paint.value.count
      ? { count: number.value.format(paint.value.count), countTone: 'neutral' as const }
      : {};
  }
  const missing = missingCounts(list.value).total;
  if (missing) return { count: number.value.format(missing), countTone: 'danger' as const };
  const buyback = list.value.counts.buyback;
  return buyback ? { count: number.value.format(buyback), countTone: 'warning' as const } : {};
}
const items = computed(() =>
  shown.value.map((id) => ({ id, label: labelOf(id), icon: ICONS[id], ...countOf(id) })),
);
const tabs = computed(() => shown.value.length > 1);
/** The panel's tab semantics, only while there are tabs. */
const panelOf = (id: ConsultantId) =>
  tabs.value
    ? {
        id: `shm-consultants-panel-${id}`,
        role: 'tabpanel',
        'aria-labelledby': `shm-consultants-tab-${id}`,
      }
    : {};
</script>

<template>
  <div :id="CONSULTANTS_TOP_ID" class="shm-consultants-top">
    <TabBar
      v-if="tabs"
      class="shm-consultants-tabs"
      :items="items"
      :selected="current"
      :label="i18n.t('tabs.consultants')"
      panels="shm-consultants"
      underline
      @select="chosen = $event"
    />
    <div v-else class="shm-consultants-heading">
      <h3 class="shm-store-title">
        <SvgIcon :name="ICONS[current]" />
        {{ labelOf(current) }}
      </h3>
      <!-- Where the other consultant comes once it has something to offer. -->
      <span v-if="current === 'ccu' && !settings.hideMeltValue" class="shm-consultants-hint">
        {{ i18n.t('consultants.paintLater') }}
      </span>
    </div>
  </div>
  <div v-show="current === 'ccu'" v-bind="panelOf('ccu')">
    <CcuConsultant
      :settings="settings"
      :pledges="pledges"
      :buyback="buyback"
      @update="emit('update', $event)"
    />
  </div>
  <div v-show="current === 'paint'" v-bind="panelOf('paint')">
    <PaintConsultant
      :settings="settings"
      :active="active && current === 'paint'"
      @offer="paint = $event"
    />
  </div>
</template>

<style scoped>
.shm-consultants-top {
  /* Below RSI's fixed top bar when scrolled to from a link. */
  scroll-margin-top: 90px;
  margin-top: 20px;
}

/* With one consultant: its name over a hairline, like the sub tabs it replaces. */
.shm-consultants-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-consultants-heading h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.shm-consultants-heading .shm-icon {
  color: var(--shm-accent);
}

.shm-consultants-hint {
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
}
</style>
