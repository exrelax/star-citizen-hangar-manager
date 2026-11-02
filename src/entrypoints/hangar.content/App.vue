<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import { useBuybackPledges } from '@/buyback/use-buyback-pledges';
import HangarStatus from '@/hangar/components/HangarStatus.vue';
import PledgeList from '@/hangar/components/PledgeList.vue';
import { hashOfTab, MANAGER_TABS, tabFromHash, type ManagerTab } from '@/hangar/route';
import { startSync, syncState } from '@/hangar/sync-state';
import { useHangarPledges } from '@/hangar/use-hangar-pledges';
import { i18n, locale } from '@/i18n';
import SettingsPanel from '@/settings/SettingsPanel.vue';
import { useSettings } from '@/settings/use-settings';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

const { pledges, loaded, syncedAt } = useHangarPledges();
const buyback = useBuybackPledges();
const { settings, update: updateSettings } = useSettings();

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
    <h2 class="title">{{ i18n.t('manager.title') }}</h2>
    <!--
      Only hidden (not removed) in the settings, so the header keeps its height and the tabs below
      don't jump. `visibility: hidden` also takes it out of the tab order. It refreshes hangar and
      buy back together.
    -->
    <button
      type="button"
      class="shadow-button trans-02s trans-color shm-refresh"
      :class="{ 'is-hidden': activeTab === 'settings' }"
      :disabled="syncState.running"
      :title="syncProgress?.text ?? i18n.t('manager.refresh')"
      :aria-label="i18n.t('manager.refresh')"
      :aria-busy="syncState.running"
      @click="startSync"
    >
      <span class="label js-label trans-02s">
        <span class="shm-refresh-icon" :class="{ 'is-spinning': syncState.running }">🔁</span>
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

  <div class="shm-tabs" role="tablist">
    <button
      v-for="tab in MANAGER_TABS"
      :id="`shm-tab-${tab}`"
      :key="tab"
      type="button"
      role="tab"
      class="shm-tab"
      :class="{ 'is-active': activeTab === tab }"
      :aria-selected="activeTab === tab"
      :aria-controls="`shm-panel-${tab}`"
      @click="showTab(tab)"
    >
      {{ i18n.t(`tabs.${tab}`) }}
    </button>
  </div>

  <!-- The lists stay mounted once opened (v-show), so switching tabs is instant. -->
  <div
    v-show="activeTab === 'hangar'"
    id="shm-panel-hangar"
    role="tabpanel"
    aria-labelledby="shm-tab-hangar"
  >
    <template v-if="loaded">
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
      <p v-else class="shm-empty">{{ i18n.t('manager.empty') }}</p>
    </template>
  </div>
  <div
    v-if="opened.has('buyback')"
    v-show="activeTab === 'buyback'"
    id="shm-panel-buyback"
    role="tabpanel"
    aria-labelledby="shm-tab-buyback"
  >
    <template v-if="buyback.loaded.value">
      <HangarStatus
        v-if="buyback.pledges.value.length"
        source="buyback"
        :synced-at="buyback.syncedAt.value"
        :smart-updates="settings.smartUpdates"
      />
      <BuybackList
        v-if="buyback.pledges.value.length"
        :pledges="buyback.pledges.value"
        :settings="settings"
        :active="activeTab === 'buyback'"
      />
      <p v-else class="shm-empty">{{ i18n.t('buyback.empty') }}</p>
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
  padding: 0 12px !important;
  font-family: Electrolize, sans-serif !important;
  font-size: 11px !important;
  line-height: 30px !important;
  position: relative !important;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-refresh.is-hidden {
  visibility: hidden;
}

.shm-refresh:disabled {
  cursor: progress;
}

.shm-refresh-icon {
  display: inline-block;
}

.shm-refresh-icon.is-spinning {
  animation: shm-spin 1s linear infinite;
}

.shm-refresh-progress {
  display: inline-block;
  /* Room for "123 / 456 · 100 %", so the button doesn't change its width while counting. */
  min-width: 15ch;
  margin-left: 6px;
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.shm-refresh-bar {
  position: absolute;
  right: 12px;
  bottom: 3px;
  left: 12px;
  height: 3px;
  overflow: hidden;
  background: rgba(98, 196, 235, 0.2);
}

/* Scaled instead of resized: smooth steps between the pages without re-layout. */
.shm-refresh-bar-fill {
  display: block;
  height: 100%;
  background: #62c4eb;
  transform-origin: left;
  transition: transform 0.4s ease-out;
}

.shm-tabs {
  display: flex;
  gap: 4px;
  margin-top: 18px;
  border-bottom: 1px solid rgba(98, 196, 235, 0.25);
}

.shm-tab {
  padding: 8px 16px;
  color: #8a9ba8;
  font: inherit;
  font-size: 13px;
  text-transform: uppercase;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}

.shm-tab:hover,
.shm-tab:focus-visible {
  color: #dbe7ee;
  outline: none;
}

.shm-tab.is-active {
  color: #62c4eb;
  border-bottom-color: #62c4eb;
}

.shm-empty {
  margin-top: 20px;
  color: #8a9ba8;
}

@keyframes shm-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shm-refresh-icon.is-spinning {
    animation: none;
  }

  .shm-refresh-bar-fill {
    transition: none;
  }
}
</style>
