<script setup lang="ts" generic="T extends { id: number; title: string; image?: string }">
import { i18n, locale } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import { formatUsd } from '../discount-format';
import type { GroupBadge } from '../group-badges';
import type { GroupSum, ItemGroup } from '../grouping';
import { selection } from '../selection';

/*
 * The row of a group in the grouped view (#447, #448), built like a single row (row.css) so both
 * look alike: the first item's image with its kind, name and ships, and – as what tells a group at
 * once – a stack with the count beside the name. The sums of value and discount instead of an id
 * and a date, the items' badges by all, some or none (`group-badges.ts`) and the extras that
 * differ. Selecting it selects all its items (My Hangar). A click shows its items below as normal
 * rows, by the `item` slot, until the group dialog (#449).
 */

const props = defineProps<{
  group: ItemGroup<T>;
  /** The kind icon of its first item, as a single row shows it. */
  kind?: IconName;
  /** The ships of its first item besides the one in its name. */
  ships?: readonly string[];
  badges: readonly GroupBadge[];
  /** The extras that differ among its items (`extrasNote`). */
  note?: string;
  /** Its items can be selected (My Hangar). */
  selectable?: boolean;
}>();
defineSlots<{ item(props: { entry: T }): unknown }>();

const first = computed(() => props.group.items[0]!);
const expanded = ref(false);

const ids = computed(() => props.group.items.map((item) => item.id));
const selectedCount = computed(() => ids.value.filter((id) => selection.has(id)).length);
const checked = computed(() =>
  selectedCount.value === ids.value.length ? 'true' : selectedCount.value ? 'mixed' : 'false',
);
/** All its items selected, or none once all were. */
function toggleSelection() {
  const others = [...selection.ids.value].filter((id) => !ids.value.includes(id));
  selection.replace(checked.value === 'true' ? others : [...others, ...ids.value]);
}

const sumText = (sum: GroupSum) => {
  const total = formatUsd(sum.total, locale.value);
  return sum.unknown ? i18n.n('group.sumUnknown', sum.unknown, [total, sum.unknown]) : total;
};
const value = computed(() => sumText(props.group.value));
const discount = computed(() =>
  props.group.discount.total > 0 ? sumText(props.group.discount) : undefined,
);
const countLabel = computed(() => i18n.n('group.items', props.group.count, [props.group.count]));
</script>

<template>
  <div class="shm-group" :class="{ 'is-expanded': expanded }">
    <div
      class="shm-row shm-group-row"
      :class="{ 'is-selected': checked === 'true', 'is-expanded': expanded }"
    >
      <button
        v-if="selectable"
        type="button"
        role="checkbox"
        class="shm-select-toggle"
        :aria-checked="checked"
        :aria-label="i18n.t('group.select', [group.count, first.title])"
        @click="toggleSelection"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path v-if="checked === 'mixed'" d="M4.5 8h7" />
          <path v-else d="M4.5 8.2l2.3 2.3 4.7-4.9" />
        </svg>
      </button>
      <div class="shm-row-summary" @click="expanded = !expanded">
        <span class="shm-thumb shm-group-thumb">
          <img
            v-if="first.image"
            :src="first.image"
            alt=""
            loading="lazy"
            decoding="async"
            width="128"
            height="72"
          />
          <span v-if="kind" class="shm-row-kind"><SvgIcon :name="kind" /></span>
        </span>
        <span class="shm-main">
          <span class="shm-title shm-group-title">
            <span>{{ first.title }}</span>
            <span v-tooltip="countLabel" class="shm-group-count" :aria-label="countLabel">
              <SvgIcon name="layer-group" />×{{ group.count }}
            </span>
          </span>
          <span v-if="ships?.length" class="shm-ships">
            {{ i18n.t('pledge.shipsLabel') }} {{ ships.join(', ') }}
          </span>
          <span v-if="note" class="shm-original">{{ note }}</span>
          <span class="shm-meta">
            <span class="shm-value">{{ value }}</span>
            <span v-if="discount" class="shm-discount">−{{ discount }}</span>
          </span>
        </span>
        <span class="shm-badges">
          <span
            v-for="badge in badges"
            :key="badge.key"
            v-tooltip="badge.hint"
            class="shm-badge"
            :class="[badge.className, { 'is-off': badge.off }]"
          >
            {{ badge.text }}
          </span>
        </span>
        <button
          v-tooltip="i18n.t('group.toggle')"
          type="button"
          class="shm-chevron"
          :aria-expanded="expanded"
          :aria-label="i18n.t('group.toggle')"
          @click.stop="expanded = !expanded"
        >
          <SvgIcon name="chevron-right" />
        </button>
      </div>
    </div>
    <div v-if="expanded" class="shm-group-items">
      <template v-for="entry in group.items" :key="entry.id">
        <slot name="item" :entry="entry" />
      </template>
    </div>
  </div>
</template>

<style>
/* Not scoped: the rows inside are the lists' own (row.css). */
.shm-group-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

/* The stack with the count: what tells a group from a single row at once. */
.shm-group-count {
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
  background: rgb(var(--shm-accent-rgb) / 0.14);
  border-radius: var(--shm-radius-pill);
}

.shm-group-count .shm-icon {
  width: 11px;
  height: 11px;
}

/* A stack of cards behind the image: a group at a glance, also without reading. */
.shm-group-thumb {
  box-shadow:
    3px -3px 0 -1px rgb(var(--shm-accent-rgb) / 0.35),
    6px -6px 0 -2px rgb(var(--shm-accent-rgb) / 0.18);
}

.shm-group-items {
  display: flex;
  flex-direction: column;
  /* Rows of their own, with rounded corners in "Modern Hangar": a little room between them. */
  gap: 6px;
  margin: 4px 0 8px 24px;
  padding-left: 12px;
  border-left: 2px solid rgb(var(--shm-accent-rgb) / 0.3);
}
</style>
