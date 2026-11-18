<script setup lang="ts" generic="C extends string">
import SvgIcon from '@/icons/SvgIcon.vue';
import { computed } from 'vue';
import type { SortDirection, TableSort } from '../table-sort';

/*
 * A column head that sorts its table (#395): a button with the label and, while the table is
 * sorted by it, an arrow for the direction and `aria-sort`. Shared by the tables of the manager;
 * the table keeps its own head styles, so it fits every theme.
 */

const props = defineProps<{
  column: C;
  sort: TableSort<C> | null | undefined;
  /** Right-aligned, as the column's numbers. */
  numeric?: boolean;
}>();

const emit = defineEmits<{ sort: [column: C] }>();

const direction = computed<SortDirection | undefined>(() =>
  props.sort?.column === props.column ? props.sort.direction : undefined,
);
const ariaSort = computed(() =>
  direction.value === 'asc' ? 'ascending' : direction.value === 'desc' ? 'descending' : 'none',
);
</script>

<template>
  <th scope="col" :class="{ 'is-number': numeric, 'is-sorted': direction }" :aria-sort="ariaSort">
    <button type="button" class="shm-sort-head" @click="emit('sort', column)">
      <slot />
      <SvgIcon
        v-if="direction"
        class="shm-sort-arrow"
        :name="direction === 'asc' ? 'arrow-up' : 'arrow-down'"
      />
    </button>
  </th>
</template>

<style>
/* Only the label, in the head's own color and font: the table's theme styles stay. */
.shm-sort-head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.is-number > .shm-sort-head {
  flex-direction: row-reverse;
}

.shm-sort-head:hover,
.shm-sort-head:focus-visible,
.is-sorted > .shm-sort-head {
  color: var(--shm-text-strong);
}

.shm-sort-head:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-sort-arrow {
  flex: none;
  width: 0.9em;
  height: 0.9em;
}
</style>
