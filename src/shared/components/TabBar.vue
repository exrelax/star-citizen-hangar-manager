<script setup lang="ts" generic="T extends string">
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';

/*
 * The manager's tabs, also used for other choices of a few options (the styleguide's theme). Each
 * theme styles it its own way: RSI's underlined tabs (below) or a segmented control (modern.css).
 */

defineProps<{
  /** `iconSet`: the sprite of `icon`, Font Awesome unless set. */
  items: readonly { id: T; label: string; icon?: IconName; iconSet?: IconSet }[];
  selected: T;
  /** Accessible name of the group. */
  label: string;
  /**
   * Set for real tabs: the id prefix of the tabs and their panels (`<prefix>-tab-<id>`,
   * `<prefix>-panel-<id>`). Without it the items are toggle buttons.
   */
  panels?: string;
}>();
const emit = defineEmits<{ select: [id: T] }>();
</script>

<template>
  <div class="shm-tabs" :role="panels ? 'tablist' : 'group'" :aria-label="label">
    <button
      v-for="item in items"
      :id="panels && `${panels}-tab-${item.id}`"
      :key="item.id"
      type="button"
      :role="panels ? 'tab' : undefined"
      class="shm-tab"
      :class="{ 'is-active': selected === item.id }"
      :aria-selected="panels ? selected === item.id : undefined"
      :aria-pressed="panels ? undefined : selected === item.id"
      :aria-controls="panels && `${panels}-panel-${item.id}`"
      @click="emit('select', item.id)"
    >
      <SvgIcon v-if="item.icon" :name="item.icon" :set="item.iconSet" />
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.shm-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.25);
}

.shm-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  color: var(--shm-text-muted);
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
  color: var(--shm-text);
  outline: none;
}

.shm-tab.is-active {
  color: var(--shm-accent);
  border-bottom-color: var(--shm-accent);
}
</style>
