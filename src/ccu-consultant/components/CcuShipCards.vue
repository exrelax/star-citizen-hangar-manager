<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { openListShortcut } from '@/hangar/list-shortcut';
import { ccuShips } from '@/hangar/upgrade-log';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { HIDDEN } from '@/orders/orders';
import type { Settings } from '@/settings/settings';
import { rsiUrl } from '@/shared/rsi-api';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { removalLabel } from '@/ship-removals/removal-label';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { openShipRemoval } from '@/store/open-current-warbonds';
import { createShipLookup } from '@/store/warbond';
import { computed } from 'vue';
import type { BaseShipGroup, BaseShipList, BaseShipRow } from '../base-ship-list';
import { ccuBaseShipShortcut, ccuBuybackShortcut } from '../consultant-shortcuts';
import { useProvidedCoverageSources, type CoverageMatch } from '../coverage';
import { cardSections, shipCards, type ShipCard } from '../ship-cards';

/*
 * The simple view of the CCU Consultant (#563): the base ships of a group as cards (`ship-cards.ts`)
 * – the image with the ship's price and how many CCUs start from it, whether RSI sells it now, the
 * pledges that lead to it and one action. A card opens its CCUs in My Hangar (a List Shortcut), with
 * the rows, the grouped view and "Keep the discount" there. In the group "Without base ship" the
 * base ships soon without one and with too few ways to them follow, each part with its heading.
 */

const props = defineProps<{
  settings: Settings;
  list: BaseShipList;
  group: BaseShipGroup;
  /** The standard SKU of a base ship on sale, for RSI's ship upgrade dialog. */
  skuOf: (row: BaseShipRow) => number | undefined;
}>();

const sources = useProvidedCoverageSources();
const number = computed(() => new Intl.NumberFormat(locale.value));
const format = (value: number) => number.value.format(value);
const usd = (value: number) =>
  props.settings.hideMeltValue ? HIDDEN : formatUsd(value, locale.value);

const shipsById = computed(() => new Map(sources.value.ships.map((ship) => [ship.id, ship])));
const lookup = computed(() => createShipLookup(sources.value.ships));
/** A ship's own image; a CCU's base ship, the ship it starts from on the way. */
function thumbOf(match: CoverageMatch): string | undefined {
  if (match.kind === 'ccu') {
    const from = ccuShips(match.title)?.from;
    const image = from ? lookup.value.shipOf(from)?.image : undefined;
    if (image) return image;
  }
  const pledge =
    match.source === 'buyback'
      ? sources.value.buyback.get(match.id)
      : sources.value.hangar.get(match.id);
  return pledge?.image;
}

const sections = computed(() =>
  cardSections(props.list, props.group)
    .filter((part) => part.rows.length)
    .map((part) => ({
      ...part,
      count:
        part.section === 'soon'
          ? props.list.soonCount
          : part.section === 'tooFew'
            ? props.list.tooFewCount
            : undefined,
      cards: shipCards(part.rows, part.section, {
        imageOf: (id) => shipsById.value.get(id)?.image,
        skuOf: props.skuOf,
        thumbOf,
      }),
    })),
);

/** The thumbnails shown; the rest as "+N". */
const THUMBS = 3;
const nameOf = (row: BaseShipRow) => row.name ?? i18n.t('ccuConsultant.unknownShip');
const waysOf = (card: ShipCard) =>
  card.row.ways ? card.row.ways.hangar + card.row.ways.buyback : card.thumbs.length;
const thumbsHint = (card: ShipCard) => card.thumbs.map((thumb) => thumb.title).join('\n');

const now = useCountdownNow(() => props.list.soon.flatMap((row) => row.removal?.removedAt ?? []));
const removalOf = (row: BaseShipRow) =>
  row.removal ? removalLabel(row.removal, now.value, locale.value) : undefined;

const showCcus = (row: BaseShipRow) =>
  openListShortcut(ccuBaseShipShortcut(row.key, nameOf(row), row.ccus));
const showBuyback = (row: BaseShipRow, ids: number[]) =>
  openListShortcut(ccuBuybackShortcut(row.key, nameOf(row), ids));
</script>

<template>
  <div class="shm-ccu-consultant-view">
    <template v-for="part in sections" :key="part.section">
      <template v-if="part.section === 'soon' || part.section === 'tooFew'">
        <h5 :id="`shm-ccu-consultant-${part.section}`" class="shm-ccu-consultant-soon-title">
          {{ i18n.t(`ccuConsultant.${part.section}.title`) }}
          <span class="shm-ccu-consultant-soon-count">{{ format(part.count ?? 0) }}</span>
        </h5>
        <p class="shm-ccu-consultant-hint">{{ i18n.t(`ccuConsultant.${part.section}.hint`) }}</p>
      </template>
      <ul
        class="shm-ccu-cards"
        :aria-label="
          part.section === 'soon' || part.section === 'tooFew'
            ? i18n.t(`ccuConsultant.${part.section}.title`)
            : i18n.t('ccuConsultant.card.list')
        "
      >
        <li
          v-for="card in part.cards"
          :key="card.row.key"
          class="shm-ccu-card"
          :class="`is-${card.section}`"
        >
          <button
            v-tooltip="i18n.t('ccuConsultant.card.showCcus', [nameOf(card.row)])"
            type="button"
            class="shm-ccu-card-main"
            @click="showCcus(card.row)"
          >
            <span class="shm-ccu-card-image">
              <img
                v-if="card.image"
                :src="card.image"
                alt=""
                loading="lazy"
                decoding="async"
                width="320"
                height="168"
              />
              <SvgIcon v-else name="shuttle-space" />
              <span class="shm-ccu-card-count">
                <strong>{{ format(card.row.ccus.length) }}</strong>
                {{ i18n.n('ccuConsultant.card.fromIt', card.row.ccus.length) }}
              </span>
              <span v-if="card.row.price !== undefined" class="shm-ccu-card-price">
                {{ usd(card.row.price) }}
              </span>
            </span>
            <span class="shm-ccu-card-text">
              <span class="shm-ccu-card-name">{{ nameOf(card.row) }}</span>
              <span
                class="shm-ccu-card-sale"
                :class="card.section === 'always' ? 'is-always' : card.onSale ? 'is-on' : 'is-off'"
              >
                {{
                  card.section === 'always'
                    ? i18n.t('ccuConsultant.card.always')
                    : card.onSale
                      ? i18n.t('ccuConsultant.card.onSale')
                      : i18n.t('ccuConsultant.tooFew.notOnSale')
                }}
              </span>
            </span>
          </button>

          <span
            v-if="card.row.removal"
            v-tooltip="removalOf(card.row)?.hint"
            class="shm-badge is-price-increase is-warning shm-ccu-card-removal"
            tabindex="0"
          >
            {{ removalOf(card.row)?.text }}
          </span>

          <!-- What leads to the base ship: the hangar's and the buy back's ships and CCUs to it. -->
          <span v-if="card.section === 'missing'" class="shm-ccu-card-ways is-missing">
            {{ i18n.t('ccuConsultant.card.nothing') }}
          </span>
          <span v-else-if="card.section !== 'always'" class="shm-ccu-card-ways">
            <span
              v-if="card.thumbs.length"
              v-tooltip="thumbsHint(card)"
              class="shm-ccu-card-thumbs"
              tabindex="0"
            >
              <template v-for="thumb in card.thumbs.slice(0, THUMBS)" :key="thumb.id">
                <img v-if="thumb.image" :src="thumb.image" alt="" loading="lazy" />
                <span v-else class="shm-ccu-card-thumb"></span>
              </template>
              <span v-if="card.thumbs.length > THUMBS" class="shm-ccu-card-more">
                +{{ format(card.thumbs.length - THUMBS) }}
              </span>
            </span>
            <span :class="card.section === 'buyback' ? 'is-buyback' : 'is-ways'">
              {{ i18n.n('ccuConsultant.card.ways', waysOf(card), [format(waysOf(card))]) }}
            </span>
            <span v-if="card.row.short" class="is-missing">
              {{ i18n.n('ccuConsultant.soon.short', card.row.short, [format(card.row.short)]) }}
            </span>
          </span>

          <span v-if="card.action" class="shm-ccu-card-action">
            <button
              v-if="card.action.kind === 'buyback'"
              v-tooltip="i18n.t('ccuConsultant.card.buybackHint', [nameOf(card.row)])"
              type="button"
              class="shm-button"
              @click="showBuyback(card.row, card.action.ids)"
            >
              <SvgIcon name="clock-rotate-left" />
              {{ i18n.t('tabs.buyback') }}
            </button>
            <ShipUpgradeButtons
              v-else-if="card.action.kind === 'upgrade'"
              :ship-id="card.row.shipId"
              :ship-name="nameOf(card.row)"
              :sku-id="card.action.skuId"
            />
            <button
              v-else-if="card.action.kind === 'removal'"
              v-tooltip="i18n.t('shipRemovals.showShipHint', [nameOf(card.row)])"
              type="button"
              class="shm-button"
              @click="openShipRemoval(card.action.shipId)"
            >
              <SvgIcon name="triangle-exclamation" />
              {{ i18n.t('notifications.showInStore') }}
            </button>
            <a
              v-else
              v-tooltip="i18n.t('ccuConsultant.pledgeStoreHint', [nameOf(card.row)])"
              class="shm-button"
              :href="rsiUrl(card.action.link)"
              target="_blank"
              rel="noopener"
            >
              <SvgIcon name="square-up-right" />
              {{ i18n.t('ccuConsultant.pledgeStore') }}
            </a>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style>
/* Not scoped: ShipUpgradeButtons' buttons fill the card's action. */
.shm-ccu-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 172px), 1fr));
  gap: 12px;
  margin-top: 4px;
  margin-bottom: 0;
  padding: 0;
  list-style: none;
}

.shm-ccu-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-bottom: 10px;
  overflow: hidden;
  background: rgb(var(--shm-surface-rgb) / 0.6);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-cell);
  transition:
    border-color 0.2s,
    transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}

.shm-ccu-card-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-ccu-card-main:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: -2px;
}

.shm-ccu-card-image {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1.9;
  overflow: hidden;
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-ccu-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

/* The count over the image's lower part, readable on any picture. */
.shm-ccu-card-image::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgb(var(--shm-surface-rgb) / 0.85));
  content: '';
}

.shm-ccu-card-count {
  position: absolute;
  bottom: 6px;
  left: 8px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: rgb(255 255 255 / 0.85);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
}

.shm-ccu-card-count strong {
  color: #fff;
  font-size: calc(22px * var(--shm-font-scale));
  line-height: 1.1;
  font-weight: 700;
}

.shm-ccu-card-price {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  padding: 1px 7px;
  color: rgb(255 255 255 / 0.9);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: rgb(var(--shm-surface-rgb) / 0.75);
  border-radius: var(--shm-radius-pill);
  backdrop-filter: blur(4px);
}

.shm-ccu-card-text,
.shm-ccu-card > :not(.shm-ccu-card-main) {
  margin-right: 10px;
  margin-left: 10px;
}

.shm-ccu-card-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.shm-ccu-card-name {
  overflow: hidden;
  color: var(--shm-text-strong);
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-ccu-card-sale {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-ccu-card-sale::before {
  flex: none;
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 999px;
  content: '';
}

.shm-ccu-card-sale.is-on,
.shm-ccu-card-sale.is-always {
  color: var(--shm-accent);
}

.shm-ccu-card-removal {
  align-self: flex-start;
}

.shm-ccu-card-ways {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-height: 22px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 600;
  line-height: 1.2;
}

.shm-ccu-card-ways .is-buyback {
  color: var(--shm-warning);
}

.shm-ccu-card-ways .is-ways {
  color: var(--shm-text);
}

.shm-ccu-card-ways.is-missing,
.shm-ccu-card-ways .is-missing {
  color: var(--shm-danger);
}

/* Overlapping thumbnails of the pledges leading to it. */
.shm-ccu-card-thumbs {
  display: flex;
  align-items: center;
  padding-right: 8px;
}

.shm-ccu-card-thumbs img,
.shm-ccu-card-thumb {
  display: block;
  flex: none;
  width: 34px;
  height: 20px;
  margin-right: -8px;
  object-fit: cover;
  background: rgb(var(--shm-accent-rgb) / 0.15);
  border-radius: var(--shm-radius-small);
  box-shadow: 0 0 0 2px var(--shm-surface-elevated);
}

.shm-ccu-card-more {
  margin-left: 12px;
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}

.shm-ccu-card-thumbs:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: 2px;
}

/* One action, as wide as the card. */
.shm-ccu-card-action {
  display: flex;
  margin-top: auto;
}

/* Stronger than ShipUpgradeButtons' own (scoped) rules, which keep its buttons on the right. */
.shm-ccu-card-action > .shm-button,
.shm-ccu-card .shm-ccu-card-action .shm-upgrade-buttons {
  flex: 1;
}

.shm-ccu-card .shm-ccu-card-action .shm-upgrade-buttons .shm-button {
  flex: 1;
}

.shm-ccu-card-action .shm-button {
  min-height: 28px;
}

@media (hover: hover) and (pointer: fine) {
  .shm-ccu-card:has(.shm-ccu-card-main:hover) {
    border-color: rgb(var(--shm-accent-rgb) / 0.5);
  }

  .shm-ccu-card-main:hover .shm-ccu-card-image img {
    transform: scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shm-ccu-card,
  .shm-ccu-card-image img {
    transition: none;
  }

  .shm-ccu-card-main:hover .shm-ccu-card-image img {
    transform: none;
  }
}

/* "Modern Hangar": a raised surface without outline, as the design's cards. */
html .shm-theme-modern .shm-ccu-card {
  background: rgb(var(--shm-surface-rgb) / 0.55);
  border-color: transparent;
  box-shadow: inset 0 0 0 1px var(--shm-fill);
}

html .shm-theme-modern .shm-ccu-card:has(.shm-ccu-card-main:hover) {
  box-shadow:
    inset 0 0 0 1px rgb(var(--shm-accent-rgb) / 0.35),
    0 10px 24px rgb(0 0 0 / 0.35);
}
</style>
