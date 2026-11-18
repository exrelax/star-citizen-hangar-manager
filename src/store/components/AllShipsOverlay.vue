<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import { formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import type { Ship } from '@/ships/ships';
import { buyableShipsItem, current } from '@/ships/ships-storage';
import { useShipFacts } from '@/ships/use-ship-facts';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { allShips } from '../all-ships';
import type { WarbondTarget } from '../warbond';
import ShipUpgradeButtons from './ShipUpgradeButtons.vue';

/*
 * The table of all ships by value (#385), opened from the Pledge Store tab: what each ship is
 * worth, whether and how it can be bought, and what the hangar and the buy back have of it
 * (`all-ships.ts`). The head and the ship's name stay in view while the table scrolls; it scrolls
 * on its own, also sideways on narrow windows. Teleported out of the manager like its other
 * dialogs, so it carries the theme itself.
 */

const props = defineProps<{
  /** The upgrade tool's ships (the demo's in the demo). */
  ships: readonly Ship[];
  /** The tab's current warbond offers (the demo's in the demo). */
  warbonds: readonly WarbondTarget[];
  pledges: readonly PledgeView[];
  buyback: readonly BuybackView[];
  /** Whether the hangar and the buy back were read: else their columns say so. */
  hangarRead: boolean;
  buybackRead: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const facts = useShipFacts();
const storedBuyable = useStored(buyableShipsItem);

const rows = computed(() =>
  allShips({
    ships: props.ships,
    buyable: current(storedBuyable.value ?? null)?.skus ?? [],
    warbonds: props.warbonds.map((offer) => ({
      shipId: offer.ship.id,
      skuId: offer.skuId,
      price: offer.price,
    })),
    facts: facts.value,
    hangar: props.pledges,
    buyback: props.buyback,
  }),
);

const usd = (value: number) => formatUsd(value, locale.value);

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
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
      class="shm-overlay"
      :class="[themeClasses(settings), { 'shm-hide-values': settings.hideMeltValue }]"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-all-ships"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shm-all-ships-title"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <div>
            <h3 id="shm-all-ships-title">{{ i18n.t('allShips.title') }}</h3>
            <p class="shm-all-ships-intro">
              {{ i18n.t('allShips.intro') }} {{ i18n.n('allShips.count', rows.length) }}
            </p>
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

        <p v-if="!rows.length" class="shm-overlay-note">{{ i18n.t('allShips.noShips') }}</p>
        <div v-else class="shm-all-ships-scroll" tabindex="0">
          <table class="shm-warbond-table shm-all-ships-table">
            <thead>
              <tr>
                <th scope="col" rowspan="2" class="shm-all-ships-name">
                  {{ i18n.t('allShips.colShip') }}
                </th>
                <th scope="col" rowspan="2" class="is-number shm-value">
                  {{ i18n.t('allShips.colValue') }}
                </th>
                <th
                  v-tooltip="i18n.t('allShips.colWarbondHint')"
                  scope="col"
                  rowspan="2"
                  class="is-number shm-value"
                >
                  {{ i18n.t('allShips.colWarbond') }}
                </th>
                <th
                  v-tooltip="i18n.t('store.colAlwaysAvailableHint')"
                  scope="col"
                  rowspan="2"
                  class="is-center"
                >
                  {{ i18n.t('store.colAlwaysAvailable') }}
                </th>
                <th
                  v-tooltip="i18n.t('allShips.colPurchasableHint')"
                  scope="col"
                  rowspan="2"
                  class="is-center"
                >
                  {{ i18n.t('allShips.colPurchasable') }}
                </th>
                <th scope="colgroup" colspan="3" class="is-group is-center">
                  {{ i18n.t('allShips.groupHangar') }}
                </th>
                <th scope="colgroup" colspan="3" class="is-group is-center">
                  {{ i18n.t('allShips.groupBuyback') }}
                </th>
                <th scope="col" rowspan="2">{{ i18n.t('allShips.colOnSale') }}</th>
              </tr>
              <tr>
                <template v-for="group in ['hangar', 'buyback']" :key="group">
                  <th
                    v-tooltip="i18n.t('allShips.colCcusFromHint')"
                    scope="col"
                    class="is-number is-group"
                  >
                    {{ i18n.t('allShips.colCcusFrom') }}
                  </th>
                  <th v-tooltip="i18n.t('allShips.colCcusToHint')" scope="col" class="is-number">
                    {{ i18n.t('allShips.colCcusTo') }}
                  </th>
                  <th v-tooltip="i18n.t('allShips.colShipsHint')" scope="col" class="is-number">
                    {{ i18n.t('allShips.colShips') }}
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.ship.id">
                <th scope="row" class="shm-all-ships-name">
                  <span class="is-strong">{{ row.ship.name }}</span>
                  <span v-if="row.manufacturer" class="shm-all-ships-maker">
                    {{ row.manufacturer }}
                  </span>
                </th>
                <td class="is-number shm-value">{{ usd(row.ship.msrp) }}</td>
                <td class="is-number shm-value">
                  <template v-if="row.warbondPrice !== undefined">{{
                    usd(row.warbondPrice)
                  }}</template>
                </td>
                <td class="is-center">
                  <SvgIcon
                    v-if="row.alwaysAvailable"
                    class="shm-always-available"
                    name="check"
                    :label="i18n.t('store.colAlwaysAvailable')"
                  />
                </td>
                <td class="is-center">
                  <SvgIcon
                    v-if="row.purchasable"
                    class="shm-always-available"
                    name="check"
                    :label="i18n.t('allShips.colPurchasable')"
                  />
                  <span v-else-if="row.purchasable === false" class="is-none">–</span>
                </td>
                <template v-if="hangarRead">
                  <td
                    v-for="(count, index) in [row.hangarFrom, row.hangarTo, row.hangarShips]"
                    :key="`h${index}`"
                    class="is-number"
                    :class="{ 'is-group': index === 0, 'is-none': !count }"
                  >
                    {{ count || '–' }}
                  </td>
                </template>
                <td v-else colspan="3" class="is-group is-none is-center">
                  {{ i18n.t('allShips.notRead') }}
                </td>
                <template v-if="buybackRead">
                  <td
                    v-for="(count, index) in [row.buybackFrom, row.buybackTo, row.buybackShips]"
                    :key="`b${index}`"
                    class="is-number"
                    :class="{ 'is-group': index === 0, 'is-none': !count }"
                  >
                    {{ count || '–' }}
                  </td>
                </template>
                <td v-else colspan="3" class="is-group is-none is-center">
                  {{ i18n.t('allShips.notRead') }}
                </td>
                <td>
                  <ShipUpgradeButtons
                    v-if="row.skuId !== undefined || row.warbondSkuId !== undefined"
                    :ship-id="row.ship.id"
                    :ship-name="row.ship.name"
                    :sku-id="row.skuId"
                    :warbond-sku-id="row.warbondSkuId"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>

<style>
/* As wide as the window allows: twelve columns. */
.shm-all-ships.shm-overlay-dialog {
  width: min(1240px, 100%);
}

.shm-all-ships-intro {
  margin: 4px 0 0;
}

/*
 * The table scrolls on its own, in both directions, so its head (top) and the ship's name (left)
 * stay in view.
 */
.shm-all-ships-scroll {
  max-height: calc(100vh - 220px);
  overflow: auto;
  outline: none;
}

.shm-all-ships-table thead th {
  position: sticky;
  z-index: 2;
  line-height: calc(16px * var(--shm-font-scale));
  background: var(--shm-surface-elevated);
  white-space: nowrap;
  vertical-align: bottom;
}

.shm-all-ships-table thead tr:first-child th {
  top: 0;
}

/* The second row of the head right below the first: its line and padding (store-table.css). */
.shm-all-ships-table thead tr:nth-child(2) th {
  top: calc(16px * var(--shm-font-scale) + 6px);
}

/* The first column of the second row is no first column of the table: it keeps its gap. */
.shm-all-ships-table thead tr:nth-child(2) th.is-group {
  padding-left: 24px;
}

.shm-all-ships-table .shm-all-ships-name {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 160px;
  padding-right: 12px;
  font-weight: normal;
  text-align: left;
  background: var(--shm-surface-elevated);
}

.shm-all-ships-table thead .shm-all-ships-name {
  z-index: 3;
}

.shm-all-ships-maker {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-all-ships-table td {
  vertical-align: middle;
}

.shm-all-ships-table .shm-icon {
  width: 1.1em;
  height: 1.1em;
}

/* The upgrade buttons in a table row: no wider than their labels. */
.shm-all-ships-table .shm-upgrade-buttons {
  flex-wrap: nowrap;
  justify-content: flex-start;
}
</style>
