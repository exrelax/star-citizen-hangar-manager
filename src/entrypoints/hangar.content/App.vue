<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import { useBuybackPledges } from '@/buyback/use-buyback-pledges';
import HangarStatus from '@/hangar/components/HangarStatus.vue';
import PledgeList from '@/hangar/components/PledgeList.vue';
import RefreshIcon from '@/hangar/components/RefreshIcon.vue';
import { DEMO_CONTEXT, useDemo } from '@/demo/use-demo';
import { hashOfTab, MANAGER_TABS, tabFromHash, type ManagerTab } from '@/hangar/route';
import { startSync, syncState } from '@/hangar/sync-state';
import { useHangarPledges } from '@/hangar/use-hangar-pledges';
import type { IconName } from '@/icons/icon-names';
import TabBar from '@/shared/components/TabBar.vue';
import { i18n, locale } from '@/i18n';
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

/** Progress of a running sync: pages for the counter, weighted work for the bar and percentage. */
const syncProgress = computed(() => {
  const { progress } = syncState;
  if (!progress) return null;
  // Rounded down, so 100 % only shows once everything is read.
  const fraction = Math.floor(progress.fraction * 100) / 100;
  const percent = new Intl.NumberFormat(locale.value, { style: 'percent' }).format(fraction);
  return {
    ...progress,
    fraction,
    percent,
    text: i18n.t('manager.syncProgress', [progress.done, progress.total, percent]),
  };
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
    <h2 class="title">
      {{ i18n.t('manager.title') }}
      <!-- In the header, so every tab shows that the lists are a demo selection. -->
      <span v-if="demo" class="shm-demo-badge" :title="i18n.t('manager.demoBadgeHint')">
        {{ i18n.t('manager.demoBadge') }}
      </span>
    </h2>
    <!--
      Only hidden (not removed) in the settings, so the header keeps its height and the tabs below
      don't jump. `visibility: hidden` also takes it out of the tab order. It refreshes hangar and
      buy back together.
    -->
    <button
      type="button"
      class="shadow-button trans-02s trans-color shm-refresh"
      :class="{ 'is-hidden': activeTab === 'settings', 'is-syncing': syncProgress }"
      :disabled="syncState.running"
      :title="syncProgress?.text ?? i18n.t('manager.refresh')"
      :aria-label="i18n.t('manager.refresh')"
      :aria-busy="syncState.running"
      @click="startSync"
    >
      <span class="label js-label trans-02s">
        <RefreshIcon :spinning="syncState.running" />
        <span v-if="syncProgress" class="shm-refresh-progress">
          {{ syncProgress.done }} / {{ syncProgress.total }} · {{ syncProgress.percent }}
        </span>
      </span>
      <!-- The bar follows the estimated work, not the pages: buy back pages take much longer. -->
      <span
        v-if="syncProgress"
        class="shm-refresh-bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(syncProgress.fraction * 100)"
        :aria-valuetext="syncProgress.text"
      >
        <span
          class="shm-refresh-bar-fill"
          :style="{ transform: `scaleX(${syncProgress.fraction})` }"
        ></span>
      </span>
      <span class="left-section"></span>
      <span class="right-section"></span>
    </button>
    <p>{{ i18n.t('manager.intro') }}</p>
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
      <HangarStatus
        v-if="pledges.length"
        :synced-at="syncedAt"
        :smart-updates="settings.smartUpdates"
      />
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
      <HangarStatus
        v-if="buybackPledges.length"
        source="buyback"
        :synced-at="buyback.syncedAt.value"
        :smart-updates="settings.smartUpdates"
      />
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
.shm-refresh {
  float: right !important;
  display: block !important;
  /*
   * RSI's background has a 30 px button face with a reflection below (40 px in all). The bottom
   * padding keeps the content on the face; a <button> centres it vertically in what's left.
   */
  padding: 0 12px 10px !important;
  font-family: Electrolize, sans-serif !important;
  font-size: 11px !important;
  line-height: 30px !important;
  position: relative !important;
  box-sizing: border-box;
  /* RSI's `.shadow-button` background (the middle part between the two end sections) stays. */
  border: 0;
  cursor: pointer;
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

.shm-refresh.is-hidden {
  visibility: hidden;
}

.shm-refresh:disabled {
  cursor: progress;
}

/* Icon and progress text side by side, centred on the button face. */
.shm-refresh .label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
}

/* Room for icon and "1234 / 1234 · 100 %": the button keeps its width while counting. */
.shm-refresh.is-syncing .label {
  min-width: 11.5ch;
}

.shm-refresh-progress {
  font-variant-numeric: tabular-nums;
}

/* Along the lower edge of the button face (RSI's background shows a reflection below it). */
.shm-refresh-bar {
  position: absolute;
  top: 27px;
  right: 12px;
  left: 12px;
  height: 2px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.2);
}

/* Scaled instead of resized: smooth steps between the pages without re-layout. */
.shm-refresh-bar-fill {
  display: block;
  height: 100%;
  background: var(--shm-accent);
  transform-origin: left;
  transition: transform 0.4s ease-out;
}

.shm-manager-tabs {
  margin-top: 18px;
}

.shm-empty {
  margin-top: 20px;
  color: var(--shm-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .shm-refresh-bar-fill {
    transition: none;
  }
}
</style>
