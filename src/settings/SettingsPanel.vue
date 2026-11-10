<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { computed, type Component } from 'vue';
import {
  CATEGORY_GROUPS,
  CATEGORY_INFO,
  currentCategory,
  REVEAL_EVENT,
  SETTINGS_CATEGORIES,
  type SettingsCategory,
} from './categories';
import { DEVELOPMENT_SHOWN } from './development';
import AboutSection from './sections/AboutSection.vue';
import AppearanceSection from './sections/AppearanceSection.vue';
import DemoSection from './sections/DemoSection.vue';
import DevelopmentSection from './sections/DevelopmentSection.vue';
import ExperimentalSection from './sections/ExperimentalSection.vue';
import FilterSection from './sections/FilterSection.vue';
import ListsSection from './sections/ListsSection.vue';
import NotificationsSection from './sections/NotificationsSection.vue';
import PaintConsultantSection from './sections/PaintConsultantSection.vue';
import PrivacySection from './sections/PrivacySection.vue';
import SidebarSection from './sections/SidebarSection.vue';
import SmartUpdateSection from './sections/SmartUpdateSection.vue';
import StorageSection from './sections/StorageSection.vue';
import type { Settings } from './settings';

/*
 * The settings tab (#117): the categories as a list on the left, one category at a time on the
 * right (src/settings/sections), each with its heading. A section gets the settings and reports
 * a change as a patch, which the manager stores. All sections stay rendered, only the current
 * one is shown: a link to a setting (`openTabAt`) finds it and shows its category first.
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
const update = (patch: Partial<Settings>) => emit('update', patch);

const SECTIONS: Record<SettingsCategory, Component> = {
  appearance: AppearanceSection,
  privacy: PrivacySection,
  demo: DemoSection,
  lists: ListsSection,
  filters: FilterSection,
  sidebar: SidebarSection,
  notifications: NotificationsSection,
  paintConsultant: PaintConsultantSection,
  smartUpdates: SmartUpdateSection,
  experimental: ExperimentalSection,
  storage: StorageSection,
  about: AboutSection,
  development: DevelopmentSection,
};

const shown = (category: SettingsCategory) => category !== 'development' || DEVELOPMENT_SHOWN;
const categories = SETTINGS_CATEGORIES.filter(shown);
const groups = computed(() =>
  CATEGORY_GROUPS.map((group) => ({ ...group, categories: group.categories.filter(shown) })),
);
</script>

<template>
  <div class="shm-settings">
    <nav class="shm-settings-nav" :aria-label="i18n.t('settings.categoriesLabel')">
      <div v-for="group in groups" :key="group.title" class="shm-settings-nav-group">
        <span class="shm-settings-nav-title">{{ i18n.t(group.title) }}</span>
        <button
          v-for="category in group.categories"
          :key="category"
          type="button"
          class="shm-settings-nav-item"
          :aria-current="category === currentCategory ? 'page' : undefined"
          :aria-controls="`shm-settings-${category}`"
          @click="currentCategory = category"
        >
          <SvgIcon :name="CATEGORY_INFO[category].icon" />
          <span class="shm-settings-nav-label">{{ i18n.t(CATEGORY_INFO[category].title) }}</span>
          <!-- The demo mode shows a hangar that isn't yours: on, it says so here too. -->
          <span v-if="category === 'demo' && settings.demoMode" class="shm-settings-nav-badge">
            {{ i18n.t('settings.on') }}
          </span>
        </button>
      </div>
    </nav>

    <section
      v-for="category in categories"
      v-show="category === currentCategory"
      :id="`shm-settings-${category}`"
      :key="category"
      class="shm-settings-category"
      data-shm-reveal
      :aria-labelledby="`shm-settings-${category}-title`"
      @[REVEAL_EVENT]="currentCategory = category"
    >
      <h3 :id="`shm-settings-${category}-title`" class="shm-settings-title">
        {{ i18n.t(CATEGORY_INFO[category].title) }}
      </h3>
      <component :is="SECTIONS[category]" :settings="settings" @update="update" />
    </section>
  </div>
</template>

<style src="./settings.css"></style>
