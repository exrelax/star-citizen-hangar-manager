<script setup lang="ts">
import { i18n } from '@/i18n';
import HangarStatus from '@/hangar/components/HangarStatus.vue';
import PledgeList from '@/hangar/components/PledgeList.vue';
import { startSync, syncState } from '@/hangar/sync-state';
import { useHangarPledges } from '@/hangar/use-hangar-pledges';
import SettingsPanel from '@/settings/SettingsPanel.vue';
import { useSettings } from '@/settings/use-settings';
import { ref } from 'vue';

const TABS = ['hangar', 'settings'] as const;
type Tab = (typeof TABS)[number];

const { pledges, loaded, syncedAt } = useHangarPledges();
const { settings, update: updateSettings } = useSettings();
const activeTab = ref<Tab>('hangar');
</script>

<!-- Reuses the markup classes of the original hangar page so the view inherits the site's look. -->
<template>
  <div class="top">
    <h2 class="title">{{ i18n.t('manager.title') }}</h2>
    <!--
      Only hidden (not removed) outside "My Hangar", so the header keeps its height and the tabs
      below don't jump. `visibility: hidden` also takes it out of the tab order.
    -->
    <button
      type="button"
      class="shadow-button trans-02s trans-color shm-refresh"
      :class="{ 'is-hidden': activeTab !== 'hangar' }"
      :disabled="syncState.running"
      :title="i18n.t('manager.refresh')"
      :aria-label="i18n.t('manager.refresh')"
      :aria-busy="syncState.running"
      @click="startSync"
    >
      <span class="label js-label trans-02s">
        <span class="shm-refresh-icon" :class="{ 'is-spinning': syncState.running }">🔁</span>
        <span v-if="syncState.progress" class="shm-refresh-progress">
          {{ syncState.progress.done }} / {{ syncState.progress.total }}
        </span>
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
      v-for="tab in TABS"
      :id="`shm-tab-${tab}`"
      :key="tab"
      type="button"
      role="tab"
      class="shm-tab"
      :class="{ 'is-active': activeTab === tab }"
      :aria-selected="activeTab === tab"
      :aria-controls="`shm-panel-${tab}`"
      @click="activeTab = tab"
    >
      {{ i18n.t(`tabs.${tab}`) }}
    </button>
  </div>

  <!-- v-show keeps the (large) list mounted while the settings are open. -->
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
      <PledgeList v-if="pledges.length" :pledges="pledges" :settings="settings" />
      <p v-else class="shm-empty">{{ i18n.t('manager.empty') }}</p>
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
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
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
}
</style>
