<script setup lang="ts">
import DevelopmentSection from './sections/DevelopmentSection.vue';
import FilterSection from './sections/FilterSection.vue';
import GeneralSection from './sections/GeneralSection.vue';
import LanguageSection from './sections/LanguageSection.vue';
import PrivacySection from './sections/PrivacySection.vue';
import ResetSection from './sections/ResetSection.vue';
import ShipLinkSection from './sections/ShipLinkSection.vue';
import ThemeSection from './sections/ThemeSection.vue';
import type { Settings } from './settings';

/*
 * The settings tab: one section per group (src/settings/sections). Each gets the settings and
 * reports a change as a patch, which the manager stores.
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
const update = (patch: Partial<Settings>) => emit('update', patch);
</script>

<template>
  <div class="shm-settings">
    <LanguageSection :settings="settings" @update="update" />
    <ThemeSection :settings="settings" @update="update" />
    <PrivacySection :settings="settings" @update="update" />
    <GeneralSection :settings="settings" @update="update" />
    <FilterSection :settings="settings" @update="update" />
    <ShipLinkSection :settings="settings" @update="update" />
    <ResetSection />
    <DevelopmentSection />
  </div>
</template>

<style src="./settings.css"></style>
