<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { openListShortcut } from '@/hangar/list-shortcut';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { HIDDEN } from '@/orders/orders';
import type { Settings } from '@/settings/settings';
import { rsiUrl } from '@/shared/rsi-api';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { limitedSaleNote } from '@/ship-removals/removal-availability';
import { removalLabel } from '@/ship-removals/removal-label';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { openShipRemoval } from '@/store/open-current-warbonds';
import { computed } from 'vue';
import { useProvidedAlwaysAvailable } from '../always-available';
import type { BaseShipGroup, BaseShipList } from '../base-ship-list';
import type {
  BlockedBuyback,
  ChainCoverage,
  ChainRoute,
  ChainShip,
  ChainUse,
} from '../chain-coverage';
import { ccuBaseShipShortcut, ccuBuybackShortcut } from '../consultant-shortcuts';
import { useProvidedCoverageSources } from '../coverage';
import {
  deepOthers,
  deepRows,
  deepShips,
  secureSummary,
  type DeepRow,
  type SecureOption,
  type SegmentKind,
} from '../deep-view';

/*
 * The deep view of the CCU Consultant (#563, `deep-view.ts`): a row per base ship of the chosen
 * group with the chains followed (`chain-coverage.ts`) – its image and price, whether RSI sells it
 * now, a bar of one segment per CCU from it (ship or chain in the hangar, buy back, too few), the
 * chains that lead to it and those that don't count (also CCUs in the buy back whose base ship has
 * too few ways, #651), and on the right what securing the missing CCUs costs now with "Ship
 * upgrade", and what makes those of the buy back count. In "Too few ways" the totals of the base
 * ships on sale come first ("Secure now"); a legend of the bar ends the list. A row opens its CCUs in My Hangar, its
 * buy back count the buy back's pledges (List Shortcuts), as the simple view's cards do.
 */

const props = defineProps<{
  settings: Settings;
  list: BaseShipList;
  chains: ChainCoverage;
  group: BaseShipGroup;
  /** The standard SKU of a ship on sale, for RSI's ship upgrade dialog. */
  skuOf: (shipId: number) => number | undefined;
  /** The account's store credit in USD, if known. */
  storeCredit?: number;
}>();

const sources = useProvidedCoverageSources();
const alwaysAvailable = useProvidedAlwaysAvailable();
const removals = useProvidedRemovalCcus();
const number = computed(() => new Intl.NumberFormat(locale.value));
const format = (value: number) => number.value.format(value);
const usd = (value: number) =>
  props.settings.hideMeltValue ? HIDDEN : formatUsd(value, locale.value);

const shipsById = computed(() => new Map(sources.value.ships.map((ship) => [ship.id, ship])));
const rows = computed(() =>
  deepRows(deepShips(props.chains, props.list, props.group), props.group, {
    ships: sources.value.ships,
    skuOf: props.skuOf,
    ...(alwaysAvailable.value && { isAlways: alwaysAvailable.value.has }),
    leaving: removals.value.obtainable,
    nodes: props.chains.nodes,
  }),
);
const summary = computed(() => (props.group === 'missing' ? secureSummary(rows.value) : undefined));
const others = computed(() => deepOthers(props.chains, props.list, props.group));

const nameOf = (ship: Pick<ChainShip, 'name'>) => ship.name ?? i18n.t('ccuConsultant.unknownShip');
/** A ship of a chain by its key: its name, image and whether it is always available. */
const nodeOf = (key: string) => {
  const ship = props.chains.nodes.get(key);
  const info = ship?.shipId !== undefined ? shipsById.value.get(ship.shipId) : undefined;
  return {
    key,
    name: ship ? nameOf(ship) : i18n.t('ccuConsultant.unknownShip'),
    ...(info?.image && { image: info.image }),
    always: ship?.always === true,
  };
};
/**
 * Why CCUs in the buy back don't count (#651): their base ship has no way, or all its ways serve
 * other CCUs from it – those in the hangar and the buy back's to other ships, named.
 */
const blockedBuybackNote = (blocked: BlockedBuyback) => {
  const name = nodeOf(blocked.from).name;
  const use = props.chains.nodes.get(blocked.from)?.use;
  if (!use?.ways) {
    return i18n.n('ccuConsultant.deep.blockedBuyback', blocked.count, [
      format(blocked.total),
      name,
    ]);
  }
  return i18n.n('ccuConsultant.deep.blockedBuybackUsed', blocked.count, [
    format(blocked.total),
    i18n.n('ccuConsultant.deep.waysOf', use.ways, [format(use.ways), name]),
    usedText(use),
  ]);
};
/** Where the ways to a ship go: its CCUs in the hangar, the buy back's by target. */
const usedText = (use: ChainUse) =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format([
    ...(use.hangar ? [i18n.t('ccuConsultant.deep.usedHangar', [format(use.hangar)])] : []),
    ...use.buyback.map((entry) =>
      i18n.t('ccuConsultant.deep.usedBuyback', [format(entry.count), nodeOf(entry.to).name]),
    ),
  ]);
/**
 * The hangar's CCUs to the link of blocked CCUs that carry no way: why their base ship gives the
 * link none – it has no way, or all its ways are taken.
 */
const idleNotes = (blocked: BlockedBuyback) =>
  (props.chains.nodes.get(blocked.from)?.use?.idle ?? []).map((idle) => {
    const from = nodeOf(idle.from).name;
    const use = props.chains.nodes.get(idle.from)?.use;
    const why = use?.ways
      ? i18n.t('ccuConsultant.deep.takenBy', [
          i18n.n('ccuConsultant.deep.waysOf', use.ways, [format(use.ways), from]),
          usedText(use),
        ])
      : i18n.t('ccuConsultant.deep.noWay', [from]);
    return {
      key: idle.from,
      text: i18n.n('ccuConsultant.deep.idleHangar', idle.count, [
        format(idle.count),
        from,
        nodeOf(blocked.from).name,
        why,
      ]),
    };
  });
/** The ships of a chain shown: the start, the one before the base ship and those between as "…". */
const PATH_SHOWN = 3;
const pathOf = (route: ChainRoute) => {
  const nodes = route.path.map(nodeOf);
  if (nodes.length <= PATH_SHOWN) return { nodes, skipped: [] };
  return { nodes: [nodes[0]!, nodes.at(-1)!], skipped: nodes.slice(1, -1) };
};

/** One segment per CCU; a bar of very many CCUs in parts as wide as their counts. */
const SEGMENTS_MAX = 40;
const segmentsOf = (row: DeepRow) =>
  row.ship.ccus.length > SEGMENTS_MAX
    ? row.segments.map((segment, index) => ({
        key: index,
        kind: segment.kind,
        grow: segment.count,
      }))
    : row.segments.flatMap((segment, index) =>
        Array.from({ length: segment.count }, (_, offset) => ({
          key: `${index}:${offset}`,
          kind: segment.kind,
          grow: 1,
        })),
      );
const ownWays = (row: DeepRow) => Math.min(row.ship.ccus.length, row.ship.total);
const barLabel = (row: DeepRow) =>
  i18n.n('ccuConsultant.deep.barLabel', row.ship.ccus.length, [
    format(ownWays(row)),
    format(row.ship.ccus.length),
    nameOf(row.ship),
    format(row.ship.short),
  ]);
/** The kinds of the legend: those the bars show. */
const LEGEND: readonly SegmentKind[] = ['ship', 'chain', 'buyback', 'short', 'always'];
const legend = computed(() =>
  LEGEND.filter((kind) =>
    rows.value.some((row) => row.segments.some((segment) => segment.kind === kind)),
  ),
);
const hasStar = computed(() =>
  rows.value.some(
    (row) =>
      row.options.always || row.ship.routes.some((route) => nodeOf(route.path[0] ?? '').always),
  ),
);

const saleOf = (row: DeepRow) =>
  row.ship.always
    ? { tone: 'is-always', text: i18n.t('ccuConsultant.card.always') }
    : row.onSale
      ? { tone: 'is-on', text: i18n.t('ccuConsultant.card.onSale') }
      : { tone: 'is-off', text: i18n.t('ccuConsultant.tooFew.notOnSale') };

/** The secure options of a row: the always available ship's first, as the safe one. */
const optionsOf = (row: DeepRow) => {
  const { always, cheapest, considered } = row.options;
  const list: { key: string; option?: SecureOption; also: boolean }[] = [];
  if (always || (considered && cheapest)) {
    list.push({ key: 'always', ...(always && { option: always }), also: !cheapest && !!always });
  }
  if (cheapest) list.push({ key: 'cheapest', option: cheapest, also: false });
  return list;
};
const eachText = (each: number, also: boolean) =>
  i18n.t(also ? 'ccuConsultant.deep.eachCheapest' : 'ccuConsultant.deep.each', [usd(each)]);

const now = useCountdownNow(() => rows.value.flatMap((row) => row.removal?.removedAt ?? []));
const removalOf = (row: DeepRow) =>
  row.removal ? removalLabel(row.removal, now.value, locale.value) : undefined;
const limitedOf = (row: DeepRow) =>
  row.removal ? limitedSaleNote([row.removal], removals.value.limited, locale.value) : undefined;

const showCcus = (ship: ChainShip) =>
  openListShortcut(ccuBaseShipShortcut(ship.key, nameOf(ship), [...ship.ccus, ...ship.others]));
const showBuyback = (ship: ChainShip) =>
  openListShortcut(
    ccuBuybackShortcut(
      ship.key,
      nameOf(ship),
      ship.buyback.map((match) => match.id),
    ),
  );
</script>

<template>
  <div class="shm-ccu-consultant-view shm-ccu-deep">
    <!-- "Secure now": the CCUs short of a way whose base ship RSI sells now, and the costs. -->
    <div v-if="summary?.ccus" class="shm-ccu-deep-summary">
      <div class="shm-ccu-deep-stat is-primary">
        <span class="shm-ccu-deep-stat-label">
          <SvgIcon name="basket-shopping" />
          {{ i18n.t('ccuConsultant.deep.secureNow') }}
        </span>
        <span class="shm-ccu-deep-stat-text">
          <strong>{{
            i18n.n('ccuConsultant.deep.secureCcus', summary.ccus, [format(summary.ccus)])
          }}</strong>
          {{ i18n.n('ccuConsultant.deep.secureShips', summary.ships, [format(summary.ships)]) }}
        </span>
        <span class="shm-ccu-deep-stat-note">
          {{
            storeCredit !== undefined
              ? i18n.t('ccuConsultant.deep.creditYours', [usd(storeCredit)])
              : i18n.t('ccuConsultant.deep.credit')
          }}
        </span>
      </div>
      <div v-if="summary.always" class="shm-ccu-deep-stat">
        <span class="shm-ccu-deep-stat-label">
          <span class="shm-ccu-deep-dot is-always"></span>
          {{ i18n.t('ccuConsultant.deep.fromAlways') }}
        </span>
        <strong class="shm-ccu-deep-stat-value">{{ usd(summary.always.total) }}</strong>
        <span class="shm-ccu-deep-stat-note">
          {{
            i18n.n('ccuConsultant.deep.fromAlwaysNote', summary.always.ships, [
              format(summary.always.ships),
            ])
          }}
        </span>
      </div>
      <div v-if="summary.cheapest" class="shm-ccu-deep-stat">
        <span class="shm-ccu-deep-stat-label">
          <span class="shm-ccu-deep-dot"></span>
          {{ i18n.t('ccuConsultant.deep.fromCheapest') }}
        </span>
        <strong class="shm-ccu-deep-stat-value">{{ usd(summary.cheapest.total) }}</strong>
        <span class="shm-ccu-deep-stat-note">{{
          i18n.t('ccuConsultant.deep.fromCheapestNote')
        }}</span>
      </div>
    </div>

    <ol
      v-if="rows.length"
      class="shm-ccu-deep-rows"
      :aria-label="i18n.t('ccuConsultant.card.list')"
    >
      <li
        v-for="row in rows"
        :key="row.ship.key"
        class="shm-ccu-deep-row"
        :class="{
          'is-found': row.ship.deepOnly,
          'is-off': !row.onSale && !row.ship.always,
        }"
      >
        <!-- The image opens the CCUs from it, as the name does (for the mouse only). -->
        <button
          type="button"
          class="shm-ccu-deep-image"
          tabindex="-1"
          aria-hidden="true"
          @click="showCcus(row.ship)"
        >
          <img
            v-if="row.info?.image"
            :src="row.info.image"
            alt=""
            loading="lazy"
            decoding="async"
            width="224"
            height="118"
          />
          <SvgIcon v-else name="shuttle-space" />
          <span v-if="row.info" class="shm-ccu-deep-price">{{ usd(row.info.msrp) }}</span>
        </button>

        <div class="shm-ccu-deep-main">
          <div class="shm-ccu-deep-title">
            <button
              v-tooltip="i18n.t('ccuConsultant.card.showCcus', [nameOf(row.ship)])"
              type="button"
              class="shm-ccu-deep-name"
              @click="showCcus(row.ship)"
            >
              {{ nameOf(row.ship) }}
            </button>
            <span class="shm-ccu-card-sale" :class="saleOf(row).tone">{{ saleOf(row).text }}</span>
            <span
              v-if="row.ship.deepOnly"
              v-tooltip="i18n.t('ccuConsultant.deep.foundHint')"
              class="shm-ccu-deep-found"
              tabindex="0"
            >
              {{ i18n.t('ccuConsultant.deep.found') }}
            </span>
            <span
              v-if="row.removal"
              v-tooltip="removalOf(row)?.hint"
              class="shm-badge is-price-increase is-warning"
              tabindex="0"
            >
              {{ removalOf(row)?.text }}
            </span>
          </div>

          <!-- One segment per CCU from it: how it gets its base ship, or that it is short of one. -->
          <div class="shm-ccu-deep-bar" role="img" :aria-label="barLabel(row)">
            <span
              v-for="segment in segmentsOf(row)"
              :key="segment.key"
              :class="`is-${segment.kind}`"
              :style="{ flexGrow: segment.grow }"
            ></span>
          </div>
          <span class="shm-ccu-deep-count">
            <template v-if="row.ship.always">
              {{ i18n.n('ccuConsultant.card.fromIt', row.ship.ccus.length) }}:
              <strong>{{ format(row.ship.ccus.length) }}</strong>
            </template>
            <template v-else>
              <strong>{{ format(ownWays(row)) }}</strong>
              {{
                i18n.n('ccuConsultant.deep.ofWays', row.ship.ccus.length, [
                  format(row.ship.ccus.length),
                ])
              }}
              <template v-if="row.ship.short">
                ·
                <strong class="is-short">
                  {{ i18n.n('ccuConsultant.soon.short', row.ship.short, [format(row.ship.short)]) }}
                </strong>
              </template>
            </template>
            <span v-if="row.ship.others.length" class="shm-ccu-deep-others">
              ·
              {{
                i18n.n('ccuConsultant.deep.othersRow', row.ship.others.length, [
                  format(row.ship.others.length),
                ])
              }}
            </span>
          </span>

          <!-- Where the ways come from: the chains of the hangar's CCUs, and those that don't count. -->
          <ul
            v-if="
              row.ship.routes.length || row.ship.blocked.length || row.ship.blockedBuyback.length
            "
            class="shm-ccu-deep-routes"
            :aria-label="i18n.t('ccuConsultant.deep.routes', [nameOf(row.ship)])"
          >
            <li
              v-for="route in row.ship.routes"
              :key="`${route.root}:${route.buyback ? 'b' : ''}:${route.path.join('>')}`"
              :class="{ 'is-buyback': route.root === 'buyback' || route.buyback }"
            >
              <template v-for="(node, index) in pathOf(route).nodes" :key="node.key">
                <span
                  v-if="index === 1 && pathOf(route).skipped.length"
                  v-tooltip="
                    pathOf(route)
                      .skipped.map((skipped) => skipped.name)
                      .join(' → ')
                  "
                  class="shm-ccu-deep-chip is-more"
                  tabindex="0"
                >
                  +{{ format(pathOf(route).skipped.length) }}
                </span>
                <span
                  v-if="index === 1 && pathOf(route).skipped.length"
                  class="shm-ccu-deep-arrow"
                  aria-hidden="true"
                  >→</span
                >
                <span class="shm-ccu-deep-chip" :class="{ 'is-always': node.always }">
                  <img v-if="node.image" :src="node.image" alt="" loading="lazy" />
                  {{ node.name }}
                  <SvgIcon
                    v-if="node.always"
                    v-tooltip="i18n.t('ccuConsultant.deep.legend.always')"
                    name="star"
                    class="shm-ccu-deep-star"
                  />
                </span>
                <span class="shm-ccu-deep-arrow" aria-hidden="true">→</span>
              </template>
              <strong class="shm-ccu-deep-times">×{{ format(route.count) }}</strong>
              <span v-if="route.root === 'buyback'" class="shm-ccu-deep-note">
                {{ i18n.t('ccuConsultant.deep.viaBuyback', [nodeOf(route.path[0] ?? '').name]) }}
              </span>
              <span v-else-if="route.buyback" class="shm-ccu-deep-note">
                {{ i18n.t('ccuConsultant.deep.viaBuybackCcu') }}
              </span>
            </li>
            <li
              v-for="blocked in row.ship.blocked"
              :key="`blocked:${blocked.from}`"
              class="is-blocked"
            >
              <span class="shm-ccu-deep-chip">
                <img
                  v-if="nodeOf(blocked.from).image"
                  :src="nodeOf(blocked.from).image"
                  alt=""
                  loading="lazy"
                />
                {{ nodeOf(blocked.from).name }}
              </span>
              <span class="shm-ccu-deep-arrow" aria-hidden="true">→</span>
              <strong class="shm-ccu-deep-times">×{{ format(blocked.count) }}</strong>
              <span class="shm-ccu-deep-note">
                {{ i18n.t('ccuConsultant.deep.blocked', [nodeOf(blocked.from).name]) }}
              </span>
            </li>
            <li
              v-for="blocked in row.ship.blockedBuyback"
              :key="`blocked-buyback:${blocked.from}`"
              class="is-blocked is-buyback"
            >
              <span class="shm-ccu-deep-chip">
                <img
                  v-if="nodeOf(blocked.from).image"
                  :src="nodeOf(blocked.from).image"
                  alt=""
                  loading="lazy"
                />
                {{ nodeOf(blocked.from).name }}
              </span>
              <span class="shm-ccu-deep-arrow" aria-hidden="true">→</span>
              <strong class="shm-ccu-deep-times">×{{ format(blocked.count) }}</strong>
              <span class="shm-ccu-deep-note">
                {{ blockedBuybackNote(blocked) }}
              </span>
              <span
                v-for="idle in idleNotes(blocked)"
                :key="idle.key"
                class="shm-ccu-deep-note is-idle"
              >
                {{ idle.text }}
              </span>
            </li>
          </ul>
          <span v-if="row.ship.hangarShips.length" class="shm-ccu-deep-own is-hangar">
            {{
              i18n.n('ccuConsultant.deep.inHangar', row.ship.hangarShips.length, [
                format(row.ship.hangarShips.length),
              ])
            }}
          </span>
          <button
            v-if="row.ship.buyback.length"
            v-tooltip="i18n.t('ccuConsultant.card.buybackHint', [nameOf(row.ship)])"
            type="button"
            class="shm-ccu-deep-own is-buyback"
            @click="showBuyback(row.ship)"
          >
            {{
              i18n.n('ccuConsultant.deep.inBuyback', row.ship.buyback.length, [
                format(row.ship.buyback.length),
              ])
            }}
          </button>
          <span v-if="limitedOf(row)" class="shm-ccu-deep-note">{{ limitedOf(row) }}</span>
        </div>

        <!-- What to buy: CCUs to it from a cheaper ship while RSI sells it. -->
        <div class="shm-ccu-deep-secure" :class="{ 'is-off': !row.onSale || !row.need }">
          <span class="shm-ccu-deep-secure-title">
            {{
              row.ship.always
                ? i18n.t('ccuConsultant.deep.alwaysTitle')
                : !row.need
                  ? i18n.t('ccuConsultant.deep.nothingTitle')
                  : row.onSale
                    ? i18n.n('ccuConsultant.deep.secureTitle', row.need, [format(row.need)])
                    : i18n.t('ccuConsultant.deep.notOnSaleTitle')
            }}
          </span>
          <ul v-if="!row.ship.always && row.need" class="shm-ccu-deep-options">
            <li v-for="entry in optionsOf(row)" :key="entry.key">
              <span
                class="shm-ccu-deep-dot"
                :class="{ 'is-always': entry.key === 'always' }"
              ></span>
              <span v-if="entry.option" class="shm-ccu-deep-option">
                {{ entry.option.from.name }}
                <SvgIcon
                  v-if="entry.option.always"
                  v-tooltip="i18n.t('ccuConsultant.deep.legend.always')"
                  name="star"
                  class="shm-ccu-deep-star"
                />
                →
                <span class="shm-ccu-deep-each">{{ eachText(entry.option.each, entry.also) }}</span>
              </span>
              <span v-else class="shm-ccu-deep-option">{{
                i18n.t('ccuConsultant.deep.noAlways')
              }}</span>
              <strong v-if="entry.option && row.onSale">{{
                usd(entry.option.each * row.need)
              }}</strong>
              <strong v-else-if="!entry.option">–</strong>
            </li>
            <li v-if="!optionsOf(row).length" class="is-none">
              {{ i18n.t('ccuConsultant.deep.noCheaper') }}
            </li>
          </ul>
          <!-- CCUs to a link of the buy back's CCUs make that many of them count (#651). -->
          <template v-if="row.links.length">
            <span class="shm-ccu-deep-secure-title is-links">
              {{ i18n.t('ccuConsultant.deep.linksTitle') }}
              <span v-if="row.links.length > 1" class="shm-ccu-deep-links-hint">
                · {{ i18n.t('ccuConsultant.deep.linksHint') }}
              </span>
            </span>
            <ul class="shm-ccu-deep-options">
              <li v-for="link in row.links" :key="link.key">
                <span class="shm-ccu-deep-dot is-buyback"></span>
                <span class="shm-ccu-deep-option">
                  <template v-if="link.option">
                    {{ link.option.from.name }}
                    <SvgIcon
                      v-if="link.option.always"
                      v-tooltip="i18n.t('ccuConsultant.deep.legend.always')"
                      name="star"
                      class="shm-ccu-deep-star"
                    />
                    →
                  </template>
                  {{ nodeOf(link.key).name }}
                  <span v-if="link.option" class="shm-ccu-deep-each">
                    · {{ eachText(link.option.each, false) }}</span
                  >
                  <span class="shm-ccu-deep-each shm-ccu-deep-link-note">{{
                    link.onSale
                      ? i18n.n('ccuConsultant.deep.linkNote', link.need, [
                          format(link.need),
                          nodeOf(link.key).name,
                        ])
                      : i18n.t('ccuConsultant.deep.linkOffSale', [nodeOf(link.key).name])
                  }}</span>
                </span>
                <span class="shm-ccu-deep-link-end">
                  <strong v-if="link.option && link.onSale">{{
                    usd(link.option.each * link.need)
                  }}</strong>
                  <ShipUpgradeButtons
                    v-if="link.skuId !== undefined"
                    :ship-id="link.shipId"
                    :ship-name="nodeOf(link.key).name"
                    :sku-id="link.skuId"
                    icon-only
                  />
                </span>
              </li>
            </ul>
          </template>
          <span class="shm-ccu-deep-actions">
            <ShipUpgradeButtons
              v-if="row.skuId !== undefined && !row.ship.always && row.need"
              :ship-id="row.ship.shipId"
              :ship-name="nameOf(row.ship)"
              :sku-id="row.skuId"
            />
            <button
              v-if="row.removal && row.ship.shipId !== undefined"
              v-tooltip="i18n.t('shipRemovals.showShipHint', [nameOf(row.ship)])"
              type="button"
              class="shm-button"
              @click="openShipRemoval(row.ship.shipId)"
            >
              <SvgIcon name="triangle-exclamation" />
              {{ i18n.t('notifications.showInStore') }}
            </button>
            <a
              v-else-if="row.info?.link && (row.skuId === undefined || row.ship.always)"
              v-tooltip="i18n.t('ccuConsultant.pledgeStoreHint', [nameOf(row.ship)])"
              class="shm-button"
              :href="rsiUrl(row.info.link)"
              target="_blank"
              rel="noopener"
            >
              <SvgIcon name="square-up-right" />
              {{ i18n.t('ccuConsultant.pledgeStore') }}
            </a>
          </span>
        </div>
      </li>
    </ol>

    <p v-if="others" class="shm-ccu-deep-others-note">
      {{ i18n.n('ccuConsultant.deep.othersGroup', others, [format(others)]) }}
    </p>

    <ul v-if="rows.length" class="shm-ccu-deep-legend">
      <li v-for="kind in legend" :key="kind">
        <span class="shm-ccu-deep-swatch" :class="`is-${kind}`"></span>
        <SvgIcon v-if="kind === 'always'" name="star" class="shm-ccu-deep-star" />
        {{ i18n.t(`ccuConsultant.deep.legend.${kind}`) }}
      </li>
      <li v-if="hasStar && !legend.includes('always')">
        <SvgIcon name="star" class="shm-ccu-deep-star" />
        {{ i18n.t('ccuConsultant.deep.legend.always') }}
      </li>
    </ul>
  </div>
</template>

<style src="./ccu-deep-view.css"></style>
