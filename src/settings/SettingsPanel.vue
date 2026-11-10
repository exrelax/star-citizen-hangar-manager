<script setup lang="ts">
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
 * The settings tab: one section per group (src/settings/sections). Each gets the settings and
 * reports a change as a patch, which the manager stores.
 *
 * The order (#117): first what changes how the manager looks and what it hides, then the lists,
 * the sidebar and the notifications, then the Paint Discount Consultant, and last what is rarely
 * needed – the timing of the updates, experimental features, the stored data, about.
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
const update = (patch: Partial<Settings>) => emit('update', patch);
</script>

<template>
  <div class="shm-settings">
    <AppearanceSection :settings="settings" @update="update" />
    <PrivacySection :settings="settings" @update="update" />
    <DemoSection :settings="settings" @update="update" />
    <ListsSection :settings="settings" @update="update" />
    <FilterSection :settings="settings" @update="update" />
    <SidebarSection :settings="settings" @update="update" />
    <NotificationsSection :settings="settings" @update="update" />
    <PaintConsultantSection :settings="settings" @update="update" />
    <SmartUpdateSection :settings="settings" @update="update" />
    <ExperimentalSection :settings="settings" @update="update" />
    <StorageSection />
    <AboutSection />
    <DevelopmentSection />
  </div>
</template>

<style src="./settings.css"></style>
