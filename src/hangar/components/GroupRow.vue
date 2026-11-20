<script setup lang="ts" generic="T extends { id: number; title: string; image?: string }">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import { formatUsd } from '../discount-format';
import type { GroupShare, GroupSum, ItemGroup } from '../grouping';
import { selection } from '../selection';

/*
 * A group of the same items in the grouped view (#447), laid out like a single row (row.css): the
 * first item's image and name, the count, the sums of value and discount, whether its items are
 * giftable and meltable. Selecting it selects all its items (My Hangar). A click shows its items
 * below as normal rows, by the `item` slot; the group dialog (#449) and the full group row (#448)
 * follow.
 */

const props = defineProps<{
  group: ItemGroup<T>;
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
const badge = (share: GroupShare | undefined, all: string, some: string) =>
  share === undefined ? undefined : { text: share === 'some' ? some : all, off: share === 'none' };
const gift = computed(() => badge(props.group.giftable, 'Gift', i18n.t('group.someGift')));
const melt = computed(() => badge(props.group.meltable, 'Melt', i18n.t('group.someMelt')));
const extras = computed(() =>
  props.group.extras.map((extra) => i18n.t(`group.extras.${extra}`)).join(', '),
);
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
        <span class="shm-thumb">
          <img
            v-if="first.image"
            :src="first.image"
            alt=""
            loading="lazy"
            decoding="async"
            width="128"
            height="72"
          />
          <span class="shm-row-kind"><SvgIcon name="layer-group" /></span>
        </span>
        <span class="shm-main">
          <span class="shm-title">
            {{ first.title }}
            <span class="shm-group-count">×{{ group.count }}</span>
          </span>
          <span v-if="extras" class="shm-original">{{ i18n.t('group.differ', [extras]) }}</span>
          <span class="shm-meta">
            <span class="shm-value">{{ value }}</span>
            <span v-if="discount" class="shm-discount">−{{ discount }}</span>
          </span>
        </span>
        <span class="shm-badges">
          <span
            v-for="entry in [gift, melt].filter((b) => b !== undefined)"
            :key="entry!.text"
            class="shm-badge"
            :class="{ 'is-off': entry!.off }"
          >
            {{ entry!.text }}
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
.shm-group-count {
  margin-left: 6px;
  color: var(--shm-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.shm-group-items {
  display: flex;
  flex-direction: column;
  gap: inherit;
  margin: 4px 0 8px 24px;
  padding-left: 12px;
  border-left: 2px solid rgb(var(--shm-accent-rgb) / 0.3);
}
</style>
