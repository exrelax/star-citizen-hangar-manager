<script setup lang="ts" generic="T extends { id: number; title: string }">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue';
import type { GroupBadge } from '../group-badges';
import type { ItemGroup } from '../grouping';
import { selection } from '../selection';

/*
 * The dialog of a group of the grouped view (#449): its name, count, sums, badges and the note on
 * differing extras, and below all its items as the list's own rows (the `item` slot) – each with
 * its id, value, badges, details and buttons, sorted like the list. Selecting items there selects
 * them in the list; it tells how many are. It follows the group: an item melted or gifted leaves
 * it, and the dialog closes with the group (its row unmounts). A jump to one pledge opens it with
 * that pledge highlighted (`highlight`).
 */

const props = defineProps<{
  group: ItemGroup<T>;
  /** Its value and discount, as the group row shows them. */
  value: string;
  discount?: string;
  badges: readonly GroupBadge[];
  note?: string;
  /** Its items can be selected (My Hangar): the dialog counts the selected ones. */
  selectable?: boolean;
  /** The list's display classes (hidden values, ids, …), as the rows inside need them. */
  listClasses?: Record<string, boolean>;
  /** The pledge a jump opened the dialog for (#436): highlighted and scrolled to. */
  highlight?: number;
}>();
const emit = defineEmits<{ close: [] }>();
defineSlots<{ item(props: { entry: T; autoExpand: boolean }): unknown }>();

const { settings } = useSettings();
const first = computed(() => props.group.items[0]!);
const selected = computed(() => props.group.items.filter((item) => selection.has(item.id)).length);

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(async () => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
  if (props.highlight === undefined) return;
  await nextTick();
  dialog.value
    ?.querySelector(`[data-group-item="${props.highlight}"]`)
    ?.scrollIntoView({ block: 'center' });
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="shm-overlay"
      :class="[themeClasses(settings), listClasses]"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-group-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shm-group-dialog-title"
        tabindex="-1"
      >
        <header class="shm-overlay-header shm-group-dialog-header">
          <div class="shm-group-dialog-heading">
            <h3 id="shm-group-dialog-title">
              {{ first.title }}
              <span class="shm-group-count">
                <SvgIcon name="layer-group" />×{{ group.count }}
              </span>
            </h3>
            <p class="shm-group-dialog-meta">
              <span class="shm-value">{{ value }}</span>
              <span v-if="discount" class="shm-discount">−{{ discount }}</span>
              <span v-if="selectable && selected" class="shm-group-dialog-selected">
                {{ i18n.t('group.selected', [selected, group.count]) }}
              </span>
            </p>
            <p v-if="note" class="shm-group-dialog-note">{{ note }}</p>
            <span v-if="badges.length" class="shm-badges">
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
          </div>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="shm-rows shm-group-dialog-items">
          <div
            v-for="entry in group.items"
            :key="entry.id"
            :data-group-item="entry.id"
            class="shm-group-dialog-item"
            :class="{ 'is-highlighted': entry.id === highlight }"
          >
            <slot name="item" :entry="entry" :auto-expand="entry.id === highlight" />
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>

<style>
.shm-group-dialog.shm-overlay-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(calc(900px * var(--shm-font-scale)), 100%);
}

.shm-group-dialog .shm-group-dialog-header {
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 0;
}

.shm-group-dialog-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.shm-group-dialog h3 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.shm-group-dialog-meta,
.shm-group-dialog-note {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.shm-group-dialog-note,
.shm-group-dialog-selected {
  color: var(--shm-text-muted);
}

.shm-group-dialog-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/*
 * In "Modern Hangar" a row is a card in the dialog's own color: here each gets a tinted surface and
 * a fine ring, so the items stand apart without hovering.
 */
html .shm-theme-modern .shm-group-dialog-items .shm-row {
  background: rgb(var(--shm-accent-rgb) / 0.06);
  box-shadow: inset 0 0 0 1px var(--shm-separator);
}

html .shm-theme-modern .shm-group-dialog-items .shm-row.is-expanded {
  box-shadow: inset 0 0 0 1px rgb(var(--shm-accent-rgb) / 0.45);
}

/* The pledge a jump opened the dialog for. */
html .shm-group-dialog-item.is-highlighted > .shm-row {
  box-shadow: inset 0 0 0 2px var(--shm-accent);
}
</style>
