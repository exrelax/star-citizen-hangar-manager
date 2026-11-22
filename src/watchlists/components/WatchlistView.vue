<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import type { BuybackView } from '@/buyback/buyback-view';
import PledgeList from '@/hangar/components/PledgeList.vue';
import '@/hangar/components/list-controls.css';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale, type MessageKey } from '@/i18n';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, nextTick, provide, ref, useTemplateRef } from 'vue';
import { searchPlain, watchSections, WATCH_SOURCES, type WatchSource } from '../watchlist-view';
import { WATCHLIST_ROW } from '../watchlist-row';
import {
  itemKey,
  type PledgeLists,
  type WatchItem,
  type Watchlist,
  type WatchItemRef,
} from '../watchlists';
import WatchItemRow from './WatchItemRow.vue';
import WatchlistCartDialog from './WatchlistCartDialog.vue';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { paintTierPercent, storeCostOf } from '../store-cost';
import { storeStatus } from '../store-status';
import { useStoreCreditUsd } from '../use-store-credit';
import { formatUsd } from '@/hangar/discount-format';
import { useStoreCatalog } from '../use-store-catalog';
import WatchlistMeta from './WatchlistMeta.vue';

/*
 * One watchlist (#467): its name, description, date and reminder, and its items by where they come
 * from – the pledges of My Hangar and the Buy Back still there as the lists' own rows (also grouped,
 * #445), everything else as plain rows. Its search and filters stay hidden until the filter button
 * shows them. Each item can be removed; the watchlist can be edited and deleted (after a question).
 */

const props = defineProps<{
  list: Watchlist;
  pledges: PledgeView[];
  buyback: BuybackView[];
  settings: Settings;
  /** What the stored lists know, to tell pledges gone from those not read yet. */
  lists: PledgeLists;
  /** The tab is shown. */
  active: boolean;
}>();
const emit = defineEmits<{
  back: [];
  edit: [];
  delete: [];
  remove: [key: string];
  /** A store item's count changed (#470). */
  count: [key: string, count: number];
}>();

const catalog = useStoreCatalog();

/*
 * "Add to cart" (#529): all store items but CCUs, or one. A CCU opens RSI's ship upgrade dialog
 * with its target instead, until RSI's cart request for CCUs is known (#540).
 */
const cartFor = ref<{ title: string; items: readonly WatchItem[] }>();
/** Its store items for the cart, CCUs too: the dialog tells why they stay out. */
const cartItems = computed(() =>
  props.list.items.some((item) => item.kind === 'storePaint' || item.kind === 'storeShip')
    ? props.list.items.filter((item) => item.kind !== 'hangar' && item.kind !== 'buyback')
    : [],
);
function upgradeOf(shipId: number) {
  const ship = catalog.value.ships?.find((candidate) => candidate.id === shipId);
  const skuId = catalog.value.buyable?.find((sku) => sku.shipId === shipId)?.skuId;
  const warbondSkuId = catalog.value.warbonds?.find((sku) => sku.shipId === shipId)?.skuId;
  return {
    shipId,
    shipName: ship?.name ?? '',
    ...(skuId !== undefined && { skuId }),
    ...(warbondSkuId !== undefined && { warbondSkuId }),
  };
}

/*
 * What its store items cost now in all, against the store credit there is (#531, e.g. pledges to
 * rebuy), and how many can't be bought at the price they had when added any more.
 */
const cost = computed(() => storeCostOf(props.list.items, catalog.value));
const paintTier = computed(() => paintTierPercent(cost.value.paints));
const credit = useStoreCreditUsd();
const usd = (value: number) => formatUsd(value, locale.value);

// The rows of My Hangar and the Buy Back offer to remove their pledge from this watchlist.
provide(WATCHLIST_ROW, { remove: (ref: WatchItemRef) => emit('remove', itemKey(ref)) });

const sections = computed(() =>
  watchSections(props.list.items, props.pledges, props.buyback, props.lists),
);
const shownSources = computed(() => WATCH_SOURCES.filter((source) => sections.value[source]));

/** The search and filters, hidden by default. */
const showControls = ref(false);
const query = ref('');
const searchInput = useTemplateRef<HTMLInputElement>('search');
async function toggleControls() {
  showControls.value = !showControls.value;
  // Hidden, they no longer narrow down the items.
  if (!showControls.value) query.value = '';
  else {
    await nextTick();
    searchInput.value?.focus();
  }
}
const embedded = computed(() => ({ search: query.value, hideControls: !showControls.value }));

const HEADINGS: Record<WatchSource, { icon: IconName; set?: IconSet; title: MessageKey }> = {
  hangar: { icon: 'hangar', set: 'custom', title: 'tabs.hangar' },
  buyback: { icon: 'recycle', title: 'tabs.buyback' },
  store: { icon: 'basket-shopping', title: 'tabs.store' },
};
const plainOf = (source: WatchSource) =>
  searchPlain(sections.value[source]?.plain ?? [], query.value);

/** Deleting asks first, in place (as the question before bulk melting, #331). */
const asking = ref(false);
const cancelButton = useTemplateRef<HTMLButtonElement>('cancel');
async function askDelete() {
  asking.value = true;
  await nextTick();
  cancelButton.value?.focus();
}
</script>

<template>
  <section class="shm-watchlist" :aria-labelledby="`shm-watchlist-${list.id}`">
    <button type="button" class="shm-watchlist-back" @click="emit('back')">
      <SvgIcon name="chevron-left" />
      {{ i18n.t('tabs.watchlists') }}
    </button>

    <header class="shm-watchlist-header">
      <div class="shm-watchlist-heading">
        <h3 :id="`shm-watchlist-${list.id}`" class="shm-store-title shm-watchlists-title">
          {{ list.name }}
        </h3>
        <WatchlistMeta :list="list" />
        <p v-if="list.description" class="shm-watchlist-description">{{ list.description }}</p>
      </div>
      <div class="shm-watchlist-actions-bar">
        <button
          v-if="list.items.length"
          v-tooltip="i18n.t(showControls ? 'watchlists.hideFilters' : 'watchlists.showFilters')"
          type="button"
          class="shm-watchlist-icon-button"
          :aria-pressed="showControls"
          :aria-label="i18n.t('watchlists.filters')"
          @click="toggleControls"
        >
          <SvgIcon name="filter" />
        </button>
        <button
          v-tooltip="i18n.t('watchlists.edit')"
          type="button"
          class="shm-watchlist-icon-button"
          :aria-label="i18n.t('watchlists.edit')"
          @click="emit('edit')"
        >
          <SvgIcon name="pen" />
        </button>
        <button
          v-tooltip="i18n.t('watchlists.delete')"
          type="button"
          class="shm-watchlist-icon-button is-danger"
          :aria-label="i18n.t('watchlists.delete')"
          @click="askDelete"
        >
          <SvgIcon name="trash" />
        </button>
      </div>
    </header>

    <div v-if="asking" class="shm-watchlist-confirm" role="alert">
      <p>
        {{
          list.items.length
            ? i18n.n('watchlists.deleteConfirm', list.items.length, [list.name, list.items.length])
            : i18n.t('watchlists.deleteConfirmEmpty', [list.name])
        }}
      </p>
      <div class="shm-watchlist-confirm-actions">
        <button ref="cancel" type="button" class="shm-button" @click="asking = false">
          {{ i18n.t('watchlists.cancel') }}
        </button>
        <button type="button" class="shm-button is-danger" @click="emit('delete')">
          {{ i18n.t('watchlists.delete') }}
        </button>
      </div>
    </div>

    <!-- One search for all its items; each list adds its own filters below its heading. -->
    <div v-if="showControls" class="shm-controls shm-watchlist-search">
      <span class="shm-search-field">
        <SvgIcon class="shm-search-icon" name="magnifying-glass" />
        <input
          ref="search"
          v-model="query"
          type="search"
          class="shm-search"
          :placeholder="i18n.t('watchlists.searchPlaceholder')"
          :aria-label="i18n.t('watchlists.searchPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="query"
          v-tooltip="i18n.t('manager.clearSearch')"
          type="button"
          class="shm-search-clear"
          :aria-label="i18n.t('manager.clearSearch')"
          @click="query = ''"
        >
          <SvgIcon name="circle-xmark" />
        </button>
      </span>
    </div>

    <p v-if="!list.items.length" class="shm-watchlists-empty">{{ i18n.t('watchlists.noItems') }}</p>

    <section
      v-for="source in shownSources"
      :key="source"
      class="shm-watchlist-section"
      :aria-labelledby="`shm-watchlist-${list.id}-${source}`"
    >
      <div class="shm-watchlist-section-head">
        <h4 :id="`shm-watchlist-${list.id}-${source}`" class="shm-watchlist-section-title">
          <SvgIcon :name="HEADINGS[source].icon" :set="HEADINGS[source].set" />
          {{ i18n.t(HEADINGS[source].title) }}
          <span class="shm-watchlist-section-count">{{ sections[source]!.count }}</span>
        </h4>
        <!-- All its paints and standalone ships into RSI's cart (#529). -->
        <button
          v-if="source === 'store' && cartItems.length"
          type="button"
          class="shm-button shm-watchlist-cart-all"
          @click="
            cartFor = { title: i18n.t('watchlists.cartTitleAll', [list.name]), items: cartItems }
          "
        >
          <SvgIcon name="basket-shopping" />
          {{ i18n.t('watchlists.cartAll') }}
        </button>
      </div>
      <PledgeList
        v-if="source === 'hangar' && sections.hangar!.pledges.length"
        :pledges="sections.hangar!.pledges"
        :settings="settings"
        :active="false"
        :embedded="embedded"
      />
      <BuybackList
        v-if="source === 'buyback' && sections.buyback!.pledges.length"
        :pledges="sections.buyback!.pledges"
        :settings="settings"
        :active="false"
        :embedded="embedded"
      />
      <div
        v-if="plainOf(source).length"
        class="shm-rows shm-watchlist-plain"
        :class="{ 'shm-hide-values': settings.hideMeltValue }"
      >
        <WatchItemRow
          v-for="entry in plainOf(source)"
          :key="entry.key"
          :entry="entry"
          :status="source === 'store' ? storeStatus(entry.item, catalog) : undefined"
          @remove="emit('remove', entry.key)"
          @count="emit('count', entry.key, $event)"
        >
          <template v-if="source === 'store'" #actions>
            <!-- A CCU: RSI's ship upgrade dialog with its target (#529, the cart follows #540). -->
            <ShipUpgradeButtons
              v-if="entry.item.kind === 'storeCcu'"
              short
              v-bind="upgradeOf(entry.item.toShipId)"
            />
            <button
              v-else
              v-tooltip="i18n.t('watchlists.cartOne', [entry.item.name])"
              type="button"
              class="shm-watch-item-cart"
              :aria-label="i18n.t('watchlists.cartOne', [entry.item.name])"
              @click="
                cartFor = {
                  title: i18n.t('watchlists.cartOne', [entry.item.name]),
                  items: [entry.item],
                }
              "
            >
              <SvgIcon name="basket-shopping" />
            </button>
          </template>
        </WatchItemRow>
      </div>
      <div v-if="source === 'store' && cost.items" class="shm-watchlist-cost">
        <dl :class="{ 'shm-hide-values': settings.hideMeltValue }">
          <div>
            <dt>{{ i18n.t('watchlists.costTotal') }}</dt>
            <dd class="shm-value">{{ usd(cost.total) }}</dd>
          </div>
          <div v-if="credit !== undefined">
            <dt>{{ i18n.t('summary.storeCredit') }}</dt>
            <dd class="shm-value" :class="{ 'is-short': credit < cost.total }">
              {{ usd(credit) }}
            </dd>
          </div>
        </dl>
        <p v-if="cost.changed" class="shm-watchlist-cost-note is-warning">
          {{ i18n.n('watchlists.costChanged', cost.changed, [cost.changed]) }}
        </p>
        <!-- Its paints in one cart get a volume discount (#593), e.g. paints to rebuy. -->
        <p v-if="paintTier" class="shm-watchlist-cost-note">
          {{ i18n.t('watchlists.paintTier', [cost.paints, paintTier]) }}
        </p>
        <p v-if="cost.unknown" class="shm-watchlist-cost-note">
          {{ i18n.n('watchlists.costUnknown', cost.unknown, [cost.unknown]) }}
        </p>
      </div>
    </section>
    <WatchlistCartDialog
      v-if="cartFor"
      :title="cartFor.title"
      :items="cartFor.items"
      :catalog="catalog"
      @close="cartFor = undefined"
    />
  </section>
</template>

<style>
.shm-watchlist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.shm-watchlist-back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  min-height: 32px;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-watchlist-back:hover,
.shm-watchlist-back:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-watchlist-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-watchlist-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/*
 * Heavier than RSI's `#billing .content h3`, which adds a line under every h3 (an ID by
 * `:not(#shm-none)`, two classes).
 */
.shm-watchlist-heading .shm-watchlists-title:not(#shm-none) {
  margin: 0;
  padding: 0;
  border: 0;
}

.shm-watchlist-heading h3 {
  overflow-wrap: anywhere;
}

.shm-watchlist-description {
  margin: 4px 0 0;
  color: var(--shm-text-secondary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.shm-watchlist-actions-bar {
  display: flex;
  flex: none;
  gap: 2px;
}

/* Icon buttons with a hit area of 44 × 44 px (Apple Human Interface Guidelines). */
.shm-watchlist-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--shm-accent);
  font-size: calc(15px * var(--shm-font-scale));
  background: none;
  border: 0;
  border-radius: var(--shm-radius-control);
  cursor: pointer;
}

.shm-watchlist-icon-button:hover,
.shm-watchlist-icon-button:focus-visible {
  background: rgb(var(--shm-accent-rgb) / 0.14);
  outline: none;
}

.shm-watchlist-icon-button[aria-pressed='true'] {
  background: rgb(var(--shm-accent-rgb) / 0.22);
}

.shm-watchlist-icon-button.is-danger {
  color: var(--shm-danger);
}

.shm-watchlist-icon-button.is-danger:hover,
.shm-watchlist-icon-button.is-danger:focus-visible {
  background: color-mix(in srgb, var(--shm-danger) 15%, transparent);
}

.shm-watchlist-confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--shm-danger) 50%, transparent);
  border-radius: var(--shm-radius-control);
  background: color-mix(in srgb, var(--shm-danger) 8%, transparent);
}

.shm-watchlist-confirm p {
  margin: 0;
  color: var(--shm-text);
}

.shm-watchlist-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.shm-watchlist-confirm-actions .shm-button {
  min-height: 32px;
  padding: 6px 14px;
}

.shm-watchlist-section {
  display: flex;
  flex-direction: column;
}

.shm-watchlist-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-top: 12px;
}

.shm-watchlist-section-head .shm-watchlist-section-title {
  margin: 0;
}

.shm-watchlist-cart-all.shm-button {
  min-height: 28px;
}

/* What the store items cost in all, below them, against the store credit (#531). */
.shm-watchlist-cost {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  margin-top: 8px;
  padding-right: 12px;
  text-align: right;
}

.shm-watchlist-cost dl {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 20px;
  margin: 0;
}

.shm-watchlist-cost dl > div {
  display: flex;
  gap: 8px;
}

.shm-watchlist-cost dt {
  color: var(--shm-text-secondary);
}

.shm-watchlist-cost dd {
  margin: 0;
  color: var(--shm-text);
  font-variant-numeric: tabular-nums;
}

.shm-watchlist-cost dd.is-short,
.shm-watchlist-cost-note.is-warning {
  color: var(--shm-warning);
}

.shm-watchlist-cost-note {
  margin: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

/* A store item into the cart: as its × to remove it, 44 × 44 px to hit. */
.shm-watch-item-cart {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: -10px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-watch-item-cart:hover,
.shm-watch-item-cart:focus-visible {
  color: var(--shm-accent);
  outline: none;
}

.shm-watchlist-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--shm-text);
  font-size: calc(14px * var(--shm-font-scale));
}

.shm-watchlist-section-title .shm-icon {
  color: var(--shm-accent);
}

.shm-watchlist-section-count {
  color: var(--shm-text-muted);
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}

/* The lists of a section: closer to its heading than on their own tabs. */
.shm-watchlist-section .shm-list {
  margin-top: 8px;
}

.shm-watchlist-plain {
  margin-top: 8px;
}
</style>
