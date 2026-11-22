<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import { packTitle, type PackShip } from '../ship-pack';

/*
 * The title of a ship pack (#515) in a row: all its ships, shortened with "…" when long, with a
 * tooltip that lists them, and the count of its ships next to them – a pill like a group's count
 * (#447), with the ship icon instead of the stack.
 */

const props = defineProps<{ ships: readonly PackShip[] }>();

const title = computed(() => packTitle(props.ships));
const tooltip = computed(() => `${i18n.t('pledge.shipsLabel')} ${title.value}`);
const countLabel = computed(() => i18n.n('pack.count', props.ships.length, [props.ships.length]));
</script>

<template>
  <span class="shm-title shm-pack-title">
    <span v-tooltip="tooltip" class="shm-pack-name">{{ title }}</span>
    <span v-tooltip="countLabel" class="shm-pack-count" :aria-label="countLabel">
      <SvgIcon name="shuttle-space" />×{{ ships.length }}
    </span>
  </span>
</template>

<style>
/* Not scoped: next to the rows' own title styles (row.css, the themes). */
.shm-pack-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.shm-pack-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* As the count of a group (GroupRow.vue), so both read alike. */
.shm-pack-count {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.6;
  text-transform: none;
  background: rgb(var(--shm-accent-rgb) / 0.14);
  border-radius: var(--shm-radius-pill);
}

.shm-pack-count .shm-icon {
  width: 11px;
  height: 11px;
}
</style>
