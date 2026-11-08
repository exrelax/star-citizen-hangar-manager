<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import { useBuybackPledges } from '@/buyback/use-buyback-pledges';
import AccountFigures from '@/hangar/components/AccountFigures.vue';
import HangarStatus from '@/hangar/components/HangarStatus.vue';
import HangarSidebar from '@/hangar/components/HangarSidebar.vue';
import { canSelectPledges } from '@/hangar/sidebar';
import { stickWhileFits } from '@/hangar/stick-while-fits';
import { findAccountNav } from '@/hangar/account-nav';
import { selection } from '@/hangar/selection';
import PledgeList from '@/hangar/components/PledgeList.vue';
import InitialLoad from '@/hangar/components/InitialLoad.vue';
import RefreshButton from '@/hangar/components/RefreshButton.vue';
import { DEMO_CONTEXT, useDemo } from '@/demo/use-demo';
import { hashOfTab, MANAGER_TABS, tabFromHash, type ManagerTab } from '@/hangar/route';
import { syncState } from '@/hangar/sync-state';
import { useHangarPledges } from '@/hangar/use-hangar-pledges';
import { pruneMeltMarks } from '@/hangar/melt-marks';
import {
  hangarPurchases,
  MELT_MARKS,
  meltReadyIds,
  readyToMelt,
  useMeltMarks,
} from '@/hangar/use-melt-marks';
import { ordersSnapshot } from '@/orders/orders-storage';
import { useStored } from '@/storage/use-stored';
import { useNow } from '@/shared/use-now';
import type { IconName, IconSet } from '@/icons/icon-names';
import TabBar from '@/shared/components/TabBar.vue';
import { i18n } from '@/i18n';
import SettingsPanel from '@/settings/SettingsPanel.vue';
import StoreTab from '@/store/components/StoreTab.vue';
import { providePaintConsultant } from '@/store/paint-consultant/use-paint-consultant';
import { useSettings } from '@/settings/use-settings';
import { MANAGER_CONTAINER, useThemeClass } from '@/themes/theme';
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  watch,
  watchEffect,
} from 'vue';
import { vTooltip } from '@/shared/tooltip/tooltip';

/** Icon of each tab, before its label. */
const TAB_ICONS: Record<ManagerTab, { icon: IconName; iconSet?: IconSet }> = {
  hangar: { icon: 'hangar', iconSet: 'custom' },
  buyback: { icon: 'recycle' },
  store: { icon: 'basket-shopping' },
  settings: { icon: 'gear' },
};

const tabItems = computed(() =>
  MANAGER_TABS.map((tab) => ({ id: tab, label: i18n.t(`tabs.${tab}`), ...TAB_ICONS[tab] })),
);

const hangar = useHangarPledges();
const buyback = useBuybackPledges();
const { loaded, syncedAt } = hangar;

/**
 * Nothing stored yet (first visit, deleted data, or a snapshot of an older version): the lists
 * offer the initial load instead. The extension never reads the hangar from RSI on its own.
 */
const neverLoaded = computed(() => loaded.value && !syncedAt.value);

const { settings, loaded: settingsLoaded, update: updateSettings } = useSettings();
useThemeClass(inject(MANAGER_CONTAINER, undefined), settings);

// The demo mode (a setting) shows a selection of anonymized pledges (see src/demo).
const demo = computed(() => settings.value.demoMode);
const demoView = useDemo(demo, hangar.pledges, buyback.pledges);
/**
 * The lists wait for the settings: until they are read the demo mode counts as off, and the real
 * pledges would show for a moment.
 */
const listsReady = computed(() => settingsLoaded.value && demoView.ready.value);
provide(DEMO_CONTEXT, demoView.context);
const pledges = demoView.pledges;
const buybackPledges = demoView.buyback;
// Pledges marked to melt (#97): when each can be melted, for the rows and the sidebar. The demo
// has marks of its own, with its made-up purchases (one of them a few hours ago).
const orders = useStored(ordersSnapshot);
const meltMarks = useMeltMarks(
  () => demo.value,
  () => {
    if (!demo.value) return hangarPurchases(hangar.pledges.value, orders.value);
    const justBought = demoView.context.value?.justBought;
    return new Map(
      pledges.value.map((pledge) => [
        pledge.id,
        {
          on: pledge.createdAt,
          at: justBought?.pledgeId === pledge.id ? justBought.at : undefined,
        },
      ]),
    );
  },
);
provide(MELT_MARKS, meltMarks);
// The ones that can be melted now, for the sidebar's notification and its "Show" and "Select".
const now = useNow();
watchEffect(() => {
  const ids = new Set(pledges.value.map((pledge) => pledge.id));
  const ready = readyToMelt(meltMarks.value, ids, now.value);
  const current = meltReadyIds.value;
  if (ready.size !== current.size || [...ready].some((id) => !current.has(id))) {
    meltReadyIds.value = ready;
  }
});
// A mark goes once its pledge is gone from the stored hangar (melted, gifted, …).
watch(
  () => (syncedAt.value ? hangar.pledges.value : undefined),
  (current) => current && void pruneMeltMarks(),
);

// The Paint Discount Consultant: in the Pledge Store tab and as marks in My Hangar.
providePaintConsultant({
  pledges: () => pledges.value,
  settings: () => settings.value,
  demoStoreCredit: () => demoView.context.value?.storeCredit,
});

/** The status line of the list shown (in the settings the hangar's): its last refresh and check. */
const status = computed(() => {
  if (!listsReady.value) return undefined;
  if (activeTab.value !== 'buyback' && loaded.value && pledges.value.length) {
    return { source: 'hangar' as const, syncedAt: syncedAt.value };
  }
  if (activeTab.value === 'buyback' && buyback.loaded.value && buybackPledges.value.length) {
    return { source: 'buyback' as const, syncedAt: buyback.syncedAt.value };
  }
  // Also during the initial load, when the lists are still empty: it then says "Refreshing".
  if (syncState.running) {
    const source = activeTab.value === 'buyback' ? ('buyback' as const) : ('hangar' as const);
    return { source, syncedAt: undefined };
  }
  return undefined;
});

// The tab is part of the URL (`#hangar-manager`, `#hangar-manager-bb`, `#hangar-manager-store`,
// `#hangar-manager-settings`), so it can be linked to and survives a reload.
const activeTab = ref<ManagerTab>(tabFromHash(location.hash) ?? 'hangar');
/** Tabs opened so far: the big lists are built on first use and then kept. */
const opened = reactive(new Set<ManagerTab>([activeTab.value]));

function showTab(tab: ManagerTab) {
  activeTab.value = tab;
  opened.add(tab);
  const url = new URL(location.href);
  url.hash = hashOfTab(tab);
  if (url.href !== location.href) history.replaceState(history.state, '', url.href);
}

// Follows hash changes from outside, e.g. a link or an edited address bar.
const followHash = () => {
  const tab = tabFromHash(location.hash);
  if (tab && tab !== activeTab.value) showTab(tab);
};
onMounted(() => addEventListener('hashchange', followHash));
onUnmounted(() => removeEventListener('hashchange', followHash));

/*
 * The sidebar lives below RSI's page navigation on the left, outside the manager: an element of
 * its own after the navigation's list, where it sticks while scrolling as long as it fits into
 * the window (otherwise its lower boxes couldn't be reached). It stays on every tab and keeps
 * showing the hangar's figures (its search and filters too), so it neither jumps nor loses its
 * place when the tab changes.
 */
const summaryAnchor = ref<HTMLElement>();
let stopSticking: (() => void) | undefined;
onMounted(() => {
  const nav = findAccountNav(document);
  if (!nav) return;
  const anchor = document.createElement('div');
  anchor.className = 'shm-summary-anchor';
  nav.after(anchor);
  summaryAnchor.value = anchor;
  stopSticking = stickWhileFits(anchor);
});
onUnmounted(() => {
  stopSticking?.();
  summaryAnchor.value?.remove();
});
const showSummary = computed(
  () => settings.value.sidebar && listsReady.value && pledges.value.length > 0,
);
// Without the "Selected" box, a selection would be invisible.
watch(
  () => canSelectPledges(settings.value),
  (can) => can || selection.clear(),
);
// Pledges gone from the hangar (melted, gifted, …) leave the selection.
watch(pledges, (current) => selection.keepOnly(new Set(current.map((pledge) => pledge.id))));
</script>

<!-- Reuses the markup classes of the original hangar page so the view inherits the site's look. -->
<template>
  <div class="top">
    <!--
      The refresh button with the state of the list (the hangar's in the settings). Before the title, so
      it floats into the top right corner.
    -->
    <div class="shm-header-side">
      <!-- The account's figures, on every tab: store credit and buy back tokens (#156). -->
      <AccountFigures
        v-if="listsReady"
        :tokens="buyback.tokens.value"
        :hide-amounts="settings.hideMeltValue"
      />
      <div class="shm-header-actions">
        <!-- On every tab, the settings too: it refreshes hangar and buy back together. -->
        <RefreshButton />
        <HangarStatus
          v-if="status"
          :key="status.source"
          class="shm-header-status"
          :source="status.source"
          :synced-at="status.syncedAt"
          :smart-updates="settings.smartUpdates"
        />
      </div>
    </div>
    <h2 class="title">
      {{ i18n.t('manager.title') }}
      <!-- In the header, so every tab shows that the lists are a demo selection. -->
      <span v-if="demo" v-tooltip="i18n.t('manager.demoBadgeHint')" class="shm-demo-badge">
        {{ i18n.t('manager.demoBadge') }}
      </span>
    </h2>
    <p class="shm-intro">{{ i18n.t('manager.intro') }}</p>
    <div class="separator"></div>
    <div class="cboth"></div>
  </div>

  <Teleport v-if="summaryAnchor" :to="summaryAnchor">
    <HangarSidebar v-if="showSummary" :pledges="pledges" :settings="settings" />
  </Teleport>

  <TabBar
    class="shm-manager-tabs"
    :items="tabItems"
    :selected="activeTab"
    :label="i18n.t('manager.title')"
    panels="shm"
    @select="showTab"
  />

  <!-- The lists stay mounted once opened (v-show), so switching tabs is instant. -->
  <div
    v-show="activeTab === 'hangar'"
    id="shm-panel-hangar"
    role="tabpanel"
    aria-labelledby="shm-tab-hangar"
  >
    <template v-if="loaded && listsReady">
      <PledgeList
        v-if="pledges.length"
        :pledges="pledges"
        :settings="settings"
        :active="activeTab === 'hangar'"
      />
      <!-- While the initial load runs, its progress shows on the refresh button. -->
      <template v-else-if="neverLoaded">
        <InitialLoad v-if="!syncState.running" />
      </template>
      <p v-else-if="!syncState.running" class="shm-empty">{{ i18n.t('manager.empty') }}</p>
    </template>
  </div>
  <div
    v-if="opened.has('buyback')"
    v-show="activeTab === 'buyback'"
    id="shm-panel-buyback"
    role="tabpanel"
    aria-labelledby="shm-tab-buyback"
  >
    <template v-if="buyback.loaded.value && listsReady">
      <BuybackList
        v-if="buybackPledges.length"
        :pledges="buybackPledges"
        :settings="settings"
        :active="activeTab === 'buyback'"
      />
      <template v-else-if="neverLoaded">
        <InitialLoad v-if="!syncState.running" />
      </template>
      <p v-else-if="!syncState.running" class="shm-empty">{{ i18n.t('buyback.empty') }}</p>
    </template>
  </div>
  <div
    v-if="opened.has('store')"
    v-show="activeTab === 'store'"
    id="shm-panel-store"
    role="tabpanel"
    aria-labelledby="shm-tab-store"
  >
    <StoreTab
      v-if="listsReady"
      :pledges="pledges"
      :buyback="buybackPledges"
      :settings="settings"
      :active="activeTab === 'store'"
    />
  </div>
  <div
    v-if="activeTab === 'settings'"
    id="shm-panel-settings"
    role="tabpanel"
    aria-labelledby="shm-tab-settings"
  >
    <SettingsPanel :settings="settings" @update="updateSettings" />
  </div>
</template>

<style scoped>
/*
 * RSI styles the header buttons as `a.shadow-button`; mirror their layout for a real <button>.
 * More specific RSI rules (from stylesheets on their CDN) override layout and font otherwise,
 * hence `!important` on those properties.
 */
/* Account figures above refresh button and status line, on the right of the title. */
.shm-header-side {
  float: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: 40%;
}

.shm-header-actions {
  display: flex;
  /* RSI's header has no room below the button: the status goes to its left. Modern Hangar puts
   * it below (modern.css). */
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 14px;
}

/* In the type of the intro below the title (RSI's 11px), centred on the 30px face of the button. */
.shm-header-actions .shm-header-status {
  justify-content: flex-end;
  margin: 7px 0 0;
  font-size: calc(11px * var(--shm-font-scale));
  line-height: calc(16px * var(--shm-font-scale));
}

/* Clear of the refresh button and the status beside it. */
.shm-intro {
  max-width: 60%;
}

.shm-demo-badge {
  display: inline-block;
  margin-left: 10px;
  padding: 0 8px;
  color: var(--shm-text-on-accent);
  font-size: calc(11px * var(--shm-font-scale));
  line-height: calc(18px * var(--shm-font-scale));
  letter-spacing: 0.08em;
  vertical-align: 3px;
  background: var(--shm-warning);
  border-radius: var(--shm-radius-small);
  cursor: help;
}

.shm-manager-tabs {
  margin-top: 18px;
}

.shm-empty {
  margin-top: 20px;
  color: var(--shm-text-muted);
}
</style>
