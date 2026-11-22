<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import { standardSku, warbondSku, type Ship } from '@/ships/ships';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { buyableShipsItem, current } from '@/ships/ships-storage';
import type { WarbondTarget } from '@/store/warbond';
import { useStored } from '@/storage/use-stored';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { removalRowId, shipRemovalRequest } from '@/store/open-current-warbonds';
import { computed, ref, watch } from 'vue';
import type { RemovalCcus } from '../removal-ccus';
import RemovalCcuTable from './RemovalCcuTable.vue';
import { removalLabel } from '../removal-label';
import { limitedSaleNote } from '../removal-availability';
import { removalsByDate, type ShipRemoval } from '../ship-removals';
import { useProvidedRemovalCcus } from '../use-removal-ccus';

/*
 * The ships CIG takes out of the Pledge Store for good (#288, part of Ship Removals #285), in the
 * Pledge Store tab: grouped by date, each ship with the date, a countdown (as the price increases'
 * badges, #195) and the source of the announcement. Built from the rows of the manager's lists, so
 * it fits every theme. Opened, a ship shows the CCUs from and to it (#380). Notifications open the
 * tab at its title (`shm-store-removals-title`), a CCU of My Hangar at its base ship's row, expanded
 * (#381, `openShipRemoval`). A ship RSI sells CCUs to opens RSI's ship upgrade dialog with it as
 * target (#391), and with its warbond (#392), as the CCUs to secure do (SecureRow.vue).
 */

const props = defineProps<{
  removals: readonly ShipRemoval[];
  /** The upgrade tool's ships, for their images. */
  ships: readonly Ship[];
  /** The tab's current warbond offers, for "Warbond upgrade" (#392): the demo's in the demo. */
  warbonds?: readonly WarbondTarget[];
}>();

/**
 * The standard SKU of a ship RSI sells CCUs to, the upgrade dialog's target (#391): from the stored
 * upgrade tool, public data, as the CCUs to secure (`use-ccus-to-secure.ts`); the warbond SKUs of
 * the tab's offers (#392).
 */
const storedBuyable = useStored(buyableShipsItem);
const skus = computed(() => ({
  buyable: current(storedBuyable.value ?? null)?.skus ?? [],
  warbonds: (props.warbonds ?? []).map((offer) => ({
    shipId: offer.ship.id,
    skuId: offer.skuId,
    price: offer.price,
  })),
}));
const skuOf = (removal: ShipRemoval) => standardSku(skus.value, removal.ship.id)?.skuId;
/** Its cheapest warbond SKU, for "Warbond upgrade" (#392). */
const warbondSkuOf = (removal: ShipRemoval) =>
  warbondSku(skus.value.warbonds, removal.ship.id)?.skuId;

const now = useCountdownNow(() => props.removals.map((removal) => removal.removedAt));
const groups = computed(() => removalsByDate(props.removals, now.value));
const imageOf = computed(() => new Map(props.ships.map((ship) => [ship.id, ship.image])));

/** On sale now, but not always available (#293): it may be gone before the date. */
const removalState = useProvidedRemovalCcus();
const limited = (removal: ShipRemoval) =>
  limitedSaleNote([removal], removalState.value.limited, locale.value);

/** The ships opened (#380): each shows its CCUs from and to it. */
const expanded = ref(new Set<number>());
function toggle(id: number) {
  const next = new Set(expanded.value);
  if (!next.delete(id)) next.add(id);
  expanded.value = next;
}
/** A ship opened from My Hangar (#381): expanded, others stay as they are. */
watch(
  shipRemovalRequest,
  (request) => {
    if (!request) return;
    expanded.value = new Set(expanded.value).add(request.shipId);
    shipRemovalRequest.value = undefined;
  },
  { immediate: true },
);
/** Clicks on the row toggle it, except on its links and buttons (source, upgrade dialog). */
function toggleFrom(event: MouseEvent, id: number) {
  if ((event.target as Element).closest('a, button, .shm-upgrade-buttons')) return;
  toggle(id);
}
/** The CCUs from and to a ship, as #287 counts them; none outside the manager view. */
const entryOf = (removal: ShipRemoval): RemovalCcus =>
  removalState.value.list.find((entry) => entry.removal.ship.id === removal.ship.id) ?? {
    removal,
    from: [],
    to: [],
  };

const label = (removal: ShipRemoval) => removalLabel(removal, now.value, locale.value);
</script>

<template>
  <section
    v-if="groups.length"
    class="shm-store-removals"
    aria-labelledby="shm-store-removals-title"
  >
    <h3 id="shm-store-removals-title" class="shm-store-title">
      {{ i18n.t('shipRemovals.title') }}
    </h3>
    <p class="shm-store-intro">{{ i18n.t('shipRemovals.intro') }}</p>

    <section
      v-for="group in groups"
      :key="`${group.removedAt.at}${group.removedAt.dayOnly ? 'd' : ''}`"
      class="shm-removal-date"
    >
      <h4 class="shm-warbond-heading">
        {{
          i18n.n('shipRemovals.date', group.removals.length, [
            formatExpectedTime(group.removedAt, locale),
            group.removals.length,
          ])
        }}
      </h4>
      <div class="shm-rows">
        <article
          v-for="removal in group.removals"
          :id="removalRowId(removal.ship.id)"
          :key="removal.ship.id"
          class="shm-row shm-warbond shm-removal"
          :class="{ 'is-expanded': expanded.has(removal.ship.id) }"
        >
          <div class="shm-row-summary" @click="toggleFrom($event, removal.ship.id)">
            <span class="shm-thumb">
              <img
                v-if="imageOf.get(removal.ship.id)"
                :src="imageOf.get(removal.ship.id)"
                alt=""
                loading="lazy"
                decoding="async"
                width="128"
                height="72"
              />
            </span>
            <span class="shm-main">
              <span class="shm-title">{{ removal.ship.name }}</span>
              <span class="shm-removal-note">
                {{ i18n.t('shipRemovals.announcedBy') }} ·
                <a
                  class="shm-removal-source"
                  :href="removal.source"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ i18n.t('priceIncrease.source') }} <SvgIcon name="square-up-right"
                /></a>
              </span>
              <span v-if="limited(removal)" class="shm-removal-note shm-removal-limited">
                <SvgIcon name="circle-info" />
                {{ limited(removal) }}
              </span>
            </span>
            <span class="shm-badges">
              <span
                v-tooltip="label(removal).hint"
                class="shm-badge is-price-increase is-warning"
                tabindex="0"
              >
                {{ label(removal).text }}
              </span>
            </span>
            <!-- RSI's dialog with this ship as target: its warbond (#392) and its standard edition. -->
            <ShipUpgradeButtons
              :ship-id="removal.ship.id"
              :ship-name="removal.ship.name"
              :sku-id="skuOf(removal)"
              :warbond-sku-id="warbondSkuOf(removal)"
            />
            <button
              v-tooltip="i18n.t('pledge.toggleDetails')"
              type="button"
              class="shm-chevron"
              :aria-expanded="expanded.has(removal.ship.id)"
              :aria-label="i18n.t('pledge.toggleDetails')"
              @click.stop="toggle(removal.ship.id)"
            >
              <SvgIcon name="chevron-right" />
            </button>
          </div>
          <!-- The CCUs from and to the ship (#380): whether to secure CCUs to it before. -->
          <div v-if="expanded.has(removal.ship.id)" class="shm-details shm-removal-details">
            <div class="shm-details-main">
              <h4 class="shm-warbond-heading">
                {{ i18n.t('shipRemovals.tableTitle', [removal.ship.name]) }}
              </h4>
              <RemovalCcuTable :entry="entryOf(removal)" />
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
/* Clearly apart from the sections above, like the CCUs to secure. */
.shm-store-removals {
  margin-top: 32px;
}

.shm-store-removals .shm-store-intro {
  margin-bottom: 4px;
}

/* Opened from My Hangar (#381): below RSI's fixed top bar, marked for a moment (open-tab-at.ts). */
.shm-removal {
  scroll-margin-top: 90px;
}

.shm-removal.is-flashed {
  animation: shm-removal-flash 1.6s ease-out;
}

@keyframes shm-removal-flash {
  0%,
  40% {
    background: rgb(var(--shm-accent-rgb) / 0.2);
  }

  100% {
    background: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shm-removal.is-flashed {
    animation: none;
    outline: 1px solid var(--shm-accent);
    outline-offset: -1px;
  }
}

/* Plain text, not the monospace of the meta lines (IDs, prices, dates). */
.shm-removal-note {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

/* On sale now, but not always available (#293): it wraps, unlike the other lines of a row. */
.shm-removal-limited {
  display: flex;
  gap: 6px;
  align-items: baseline;
  white-space: normal;
}

.shm-removal-limited .shm-icon {
  flex: none;
  color: var(--shm-accent);
}

/*
 * "Classic RSI" puts the badge beside the text (row.css): the long note's width would squeeze the
 * badges below the badge, which then overflows onto the note (#579). The badge keeps its width and
 * the note wraps before it; with a single badge, the text needs no minimum width of its own.
 */
html .shm-theme-rsi .shm-removal .shm-badges {
  min-width: min-content;
}

html .shm-theme-rsi .shm-removal .shm-main {
  min-width: 0;
}

.shm-removal-source {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-removal-source:hover,
.shm-removal-source:focus-visible {
  text-decoration: underline;
}

/* No buttons under the image here: the content spans both columns, as in SecureRow.vue. */
.shm-removal-details .shm-details-main {
  grid-column: 1 / -1;
}

/* As the warbond CCUs' heading (WarbondRow.vue); Modern Hangar adjusts it in modern.css. */
.shm-warbond-heading {
  margin: 14px 0 6px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}
</style>
