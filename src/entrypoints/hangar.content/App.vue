<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import { useBuybackPledges } from '@/buyback/use-buyback-pledges';
import HangarStatus from '@/hangar/components/HangarStatus.vue';
import PledgeList from '@/hangar/components/PledgeList.vue';
import RefreshButton from '@/hangar/components/RefreshButton.vue';
import { DEMO_CONTEXT, useDemo } from '@/demo/use-demo';
import { hashOfTab, MANAGER_TABS, tabFromHash, type ManagerTab } from '@/hangar/route';
import { startSync, syncState } from '@/hangar/sync-state';
import { useHangarPledges } from '@/hangar/use-hangar-pledges';
import type { IconName } from '@/icons/icon-names';
import TabBar from '@/shared/components/TabBar.vue';
import { i18n } from '@/i18n';
import SettingsPanel from '@/settings/SettingsPanel.vue';
import { useSettings } from '@/settings/use-settings';
import { MANAGER_CONTAINER, useThemeClass } from '@/themes/theme';
import { computed, inject, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';

/** Icon of each tab, before its label. */
const TAB_ICONS: Record<ManagerTab, IconName> = {
  hangar: 'box',
  buyback: 'recycle',
  settings: 'gear',
};

const tabItems = computed(() =>
  MANAGER_TABS.map((tab) => ({ id: tab, label: i18n.t(`tabs.${tab}`), icon: TAB_ICONS[tab] })),
);

const hangar = useHangarPledges();
const buyback = useBuybackPledges();
const { loaded, syncedAt } = hangar;

// First visit, nothing stored yet: read hangar, buy back and orders from RSI right away.
watch(
  loaded,
  () => {
    if (!hangar.pledges.value.length) void startSync();
  },
  { once: true },
);

const { settings, loaded: settingsLoaded, update: updateSettings } = useSettings();
useThemeClass(
  inject(MANAGER_CONTAINER, undefined),
  computed(() => settings.value.theme),
);

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

/** The status line of the list shown: its last refresh and check. None in the settings. */
const status = computed(() => {
  if (!listsReady.value) return undefined;
  if (activeTab.value === 'hangar' && loaded.value && pledges.value.length) {
    return { source: 'hangar' as const, syncedAt: syncedAt.value };
  }
  if (activeTab.value === 'buyback' && buyback.loaded.value && buybackPledges.value.length) {
    return { source: 'buyback' as const, syncedAt: buyback.syncedAt.value };
  }
  return undefined;
});

// The tab is part of the URL (`#hangar-manager`, `#hangar-manager-bb`, `#hangar-manager-settings`),
// so it can be linked to and survives a reload.
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
</script>

<!-- Reuses the markup classes of the original hangar page so the view inherits the site's look. -->
<template>
  <div class="top">
    <!--
      The refresh button with the state of the list (none in the settings). Before the title, so
      it floats into the top right corner.
    -->
    <div class="shm-header-side">
      <!--
        Only hidden (not removed) in the settings, so the header keeps its height and the tabs below
        don't jump. It refreshes hangar and buy back together.
      -->
      <RefreshButton :hidden="activeTab === 'settings'" />
      <HangarStatus
        v-if="status"
        :key="status.source"
        class="shm-header-status"
        :source="status.source"
        :synced-at="status.syncedAt"
        :smart-updates="settings.smartUpdates"
      />
    </div>
    <h2 class="title">
      {{ i18n.t('manager.title') }}
      <!-- In the header, so every tab shows that the lists are a demo selection. -->
      <span v-if="demo" class="shm-demo-badge" :title="i18n.t('manager.demoBadgeHint')">
        {{ i18n.t('manager.demoBadge') }}
      </span>
    </h2>
    <p class="shm-intro">{{ i18n.t('manager.intro') }}</p>
    <div class="separator"></div>
    <div class="cboth"></div>
  </div>

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
      <p v-else class="shm-empty">
        {{ i18n.t(syncState.running ? 'manager.firstSync' : 'manager.empty') }}
      </p>
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
      <p v-else class="shm-empty">
        {{ i18n.t(syncState.running ? 'manager.firstSync' : 'buyback.empty') }}
      </p>
    </template>
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
/* Refresh button and status line, on the right of the title. */
.shm-header-side {
  float: right;
  display: flex;
  /* RSI's header has no room below the button: the status goes to its left. Modern Hangar puts
   * it below (modern.css). */
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 14px;
}

/* In the type of the intro below the title (RSI's 11px), centred on the 30px face of the button. */
.shm-header-side .shm-header-status {
  justify-content: flex-end;
  margin: 7px 0 0;
  font-size: 11px;
  line-height: 16px;
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
  font-size: 11px;
  line-height: 18px;
  letter-spacing: 0.08em;
  vertical-align: 3px;
  background: var(--shm-warning);
  border-radius: 3px;
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
