<script setup lang="ts" generic="T extends { id: number; title: string; image?: string }">
import { i18n, locale } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import WatchlistBadge from '@/watchlists/components/WatchlistBadge.vue';
import { itemKey } from '@/watchlists/watchlists';
import { computed, ref, watch } from 'vue';
import GroupDialog from './GroupDialog.vue';
import { formatUsd } from '../discount-format';
import type { GroupBadge } from '../group-badges';
import type { GroupSum, ItemGroup } from '../grouping';
import { selection } from '../selection';

/*
 * The row of a group in the grouped view (#447, #448), built like a single row (row.css) so both
 * look alike: the first item's image with its kind, name and ships, and – as what tells a group at
 * once – a stack with the count beside the name. The sums of value and discount instead of an id
 * and a date, the items' badges by all, some or none (`group-badges.ts`) and the extras that
 * differ. Selecting it selects all its items (My Hangar). Two ways to its items (#488), both as the
 * list's rows (the `item` slot): a click expands the group in place and a second collapses it; a
 * button of its own opens the group dialog (#449), as a jump to one of its pledges (`open`) does.
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
  /** The list's display classes, for the rows in the dialog. */
  listClasses?: Record<string, boolean>;
  /** A jump to a pledge (#436): the dialog opens if it is one of this group's. */
  open?: { id: number; at: number } | null;
  /** Where its pledges are, for the watchlists any of them is on (#468). */
  watchKind?: 'hangar' | 'buyback';
}>();
defineSlots<{
  item(props: { entry: T; autoExpand: boolean }): unknown;
  /**
   * What the whole group has, inside its box when expanded (#615) and in its dialog's header, e.g.
   * the base ship of a CCU group (#574).
   */
  head?(): unknown;
}>();

const first = computed(() => props.group.items[0]!);
/** Its items shown below it in the list. */
const expanded = ref(false);
/** Its dialog. */
const dialogOpen = ref(false);
/** The pledge the dialog was opened for by a jump, highlighted there. */
const highlight = ref<number>();
watch(
  () => props.open,
  (request) => {
    if (!request) return;
    // A jump to a pledge of another group closes this one's dialog: one dialog at a time.
    if (!props.group.items.some((item) => item.id === request.id)) return close();
    highlight.value = request.id;
    dialogOpen.value = true;
  },
  { immediate: true },
);
function close() {
  dialogOpen.value = false;
  highlight.value = undefined;
}

const ids = computed(() => props.group.items.map((item) => item.id));
const watchKeys = computed(() =>
  props.watchKind ? ids.value.map((pledgeId) => itemKey({ kind: props.watchKind!, pledgeId })) : [],
);
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
          <WatchlistBadge v-if="watchKind" :item-keys="watchKeys" />
          <span
            v-for="badge in badges"
            :key="badge.key"
            v-tooltip="badge.hint"
            class="shm-badge"
            :class="[badge.className, { 'is-off': badge.off, 'has-count': badge.count }]"
          >
            <SvgIcon v-if="badge.icon" :name="badge.icon" />
            {{ badge.text }}
            <span v-if="badge.count" class="shm-badge-count" aria-hidden="true">{{
              badge.count
            }}</span>
          </span>
        </span>
        <button
          v-tooltip="i18n.t('group.openDialog')"
          type="button"
          class="shm-chevron shm-group-open"
          aria-haspopup="dialog"
          :aria-label="i18n.t('group.openDialog')"
          @click.stop="dialogOpen = true"
        >
          <SvgIcon name="up-right-and-down-left-from-center" />
        </button>
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
      <!-- What the whole group has (#574), inside its own box like a row's details (#615). -->
      <div v-if="expanded && $slots.head" class="shm-details shm-group-head">
        <div class="shm-group-head-main"><slot name="head" /></div>
      </div>
    </div>
    <div v-if="expanded" class="shm-group-items">
      <template v-for="entry in group.items" :key="entry.id">
        <slot name="item" :entry="entry" :auto-expand="false" />
      </template>
    </div>
    <GroupDialog
      v-if="dialogOpen"
      :group="group"
      :value="value"
      :discount="discount"
      :badges="badges"
      :note="note"
      :selectable="selectable"
      :list-classes="listClasses"
      :highlight="highlight"
      @close="close"
    >
      <template #item="{ entry, autoExpand }">
        <slot name="item" :entry="entry" :auto-expand="autoExpand" />
      </template>
      <template v-if="$slots.head" #head><slot name="head" /></template>
    </GroupDialog>
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

/* The items of an expanded group below it, as rows of their own. */
.shm-group-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 8px 24px;
  padding-left: 12px;
  border-left: 2px solid rgb(var(--shm-accent-rgb) / 0.3);
}

/*
 * What the whole group has (#574), inside the group's box below its title (#615): laid out like a
 * row's details, under the name and in their smaller font, so it reads as a detail of the group.
 */
.shm-group-head {
  padding-top: 0;
}

.shm-group-head-main {
  grid-column: 2;
  min-width: 0;
}

.shm-group-head .shm-upgrade-log {
  margin-top: 0;
}

/* "Modern Hangar" lays the row out as a grid: the dialog's button gets a column of its own. */
html .shm-theme-modern .shm-group-row .shm-row-summary {
  grid-template-areas:
    'thumb main open chevron'
    'thumb badges open chevron';
  grid-template-columns: 128px minmax(0, 1fr) auto auto;
}

html .shm-theme-modern .shm-group-row .shm-group-open {
  grid-area: open;
}

.shm-group-open .shm-icon {
  width: 12px;
  height: 12px;
}

/* A stack of cards behind the image: a group at a glance, also without reading. */
.shm-group-thumb {
  box-shadow:
    3px -3px 0 -1px rgb(var(--shm-accent-rgb) / 0.35),
    6px -6px 0 -2px rgb(var(--shm-accent-rgb) / 0.18);
}
</style>
