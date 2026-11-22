<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/shared/overlay.css';
import '@/hangar/components/row.css';
import { i18n } from '@/i18n';
import type { Ship } from '@/ships/ships';
import TabBar from '@/shared/components/TabBar.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import StoreCcuPicker from './StoreCcuPicker.vue';
import WatchlistPicker from './WatchlistPicker.vue';
import type { NewWatchItem } from '../use-watchlists';

/*
 * An item of the Pledge Store on watchlists (#470): a paint (`item`), or a ship of the table of all
 * ships – the ship itself as standalone ship, or a CCU to it from a cheaper ship (the most
 * expensive one first: its CCU costs least).
 */

const props = defineProps<{
  title: string;
  /** The item, e.g. a paint; or a ship with the choice of ship and CCU. */
  item?: NewWatchItem;
  ship?: Ship;
  /** All ships, to start a CCU from. */
  ships?: readonly Ship[];
}>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const id = useId();

const bases = computed(() => {
  const target = props.ship;
  if (!target) return [];
  return (props.ships ?? [])
    .filter((other) => other.id !== target.id && other.msrp > 0 && other.msrp < target.msrp)
    .sort((a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name))
    .map((other) => ({ ship: other, price: Math.round((target.msrp - other.msrp) * 100) / 100 }));
});
type Kind = 'ship' | 'ccu';
const kind = ref<Kind>('ship');
const kinds = computed(() => [
  { id: 'ship' as const, label: i18n.t('watchlists.kindShip'), icon: 'shuttle-space' as const },
  ...(bases.value.length
    ? [
        {
          id: 'ccu' as const,
          label: i18n.t('watchlists.kindCcu'),
          icon: 'square-up-right' as const,
        },
      ]
    : []),
]);
const shipItem = computed(
  (): NewWatchItem | undefined =>
    props.item ??
    (props.ship && {
      kind: 'storeShip',
      shipId: props.ship.id,
      name: props.ship.name,
      ...(props.ship.msrp > 0 && { value: props.ship.msrp }),
    }),
);

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A list of a menu inside closes first.
  if ((event.target as Element | null)?.closest?.('.shm-select-menu-list')) return;
  emit('close');
}
onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="shm-overlay shm-store-watch-overlay"
      :class="themeClasses(settings)"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-store-watch-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3 :id="`${id}-title`">{{ title }}</h3>
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
        <TabBar
          v-if="kinds.length > 1"
          :items="kinds"
          :selected="kind"
          :label="i18n.t('watchlists.kindLabel')"
          @select="kind = $event"
        />
        <StoreCcuPicker v-if="kind === 'ccu' && ship" :target="ship" :bases="bases" />
        <WatchlistPicker v-else-if="shipItem" :item="shipItem" />
      </section>
    </div>
  </Teleport>
</template>

<style>
/* Above the table of all ships, itself a dialog, and above RSI's own dialogs (#471). */
.shm-overlay.shm-store-watch-overlay {
  z-index: 2147483000;
}

.shm-store-watch-dialog.shm-overlay-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(calc(520px * var(--shm-font-scale)), 100%);
}

.shm-store-watch-dialog .shm-overlay-header {
  margin-bottom: 0;
}

.shm-store-watch-dialog .shm-watchlist-picker {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
</style>
