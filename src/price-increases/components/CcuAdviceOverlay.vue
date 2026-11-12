<script setup lang="ts">
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { formatUsd } from '@/hangar/discount-format';
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { setMeltMarks } from '@/hangar/melt-marks';
import { useMarkedPledges } from '@/hangar/use-melt-marks';
import { useShipFacts } from '@/ships/use-ship-facts';
import { createShipLookup, holdingsByShip } from '@/store/warbond';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { createShipStatusLookup, shipStatusItem } from '@/ships/ship-status';
import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, reactive, useTemplateRef } from 'vue';
import { adviceEvents, type AdviceEvent, type AdviceRow } from '../advice-events';
import { ccuAdvice, type CcuAdviceGroup } from '../ccu-advice';
import { confirmationNote, formatExpectedTime } from '../price-increase-label';
import CcuShips from './CcuShips.vue';
import PriceIncreaseBadge from './PriceIncreaseBadge.vue';

/*
 * The advice for the CCUs of My Hangar whose base ship rises in price (#252, see `ccu-advice.ts`),
 * laid out per rising ship (#274, `advice-events.ts`): the price increase with its countdown, the
 * discount today, if kept and if swapped, the steps of the recommendation – melt them and buy CCUs
 * to the rising ship with the store credit –, and the CCUs per target, each opening its figures.
 * CCUs without a recommendation (the new price unknown, not sold, keeping is better) get a note of
 * their own. A suggestion only: nothing is melted or bought from here; the CCUs of the
 * recommendations can be marked to melt (#97).
 */

const props = defineProps<{
  pledges: readonly PledgeView[];
  buyback: readonly BuybackView[];
  pledgeId?: number;
}>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const dialog = useTemplateRef<HTMLElement>('dialog');

const ships = useStored(shipsItem);
const buyable = useStored(buyableShipsItem);
const warbonds = useStored(warbondsItem);
const shipStatus = useStored(shipStatusItem);
// The demo mode has a store credit of its own.
const storedCredit = useStored(storeCreditItem);
const demo = useDemoContext();
const storeCredit = computed(() => {
  const stored = storedCredit.value;
  const value =
    demo.value?.storeCredit ??
    (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
  return value?.currency === 'USD' ? value.amount : undefined;
});

/** The ships with an upcoming price increase in the lists: no base ship for new CCUs. */
const risingShipIds = computed(
  () =>
    new Set(
      props.pledges.flatMap((pledge) =>
        [
          pledge.priceIncrease?.increase,
          pledge.ccuPriceChange?.base,
          pledge.ccuPriceChange?.target,
        ].flatMap((increase) => (increase ? [increase.ship.id] : [])),
      ),
    ),
);

/** Whether a ship is always available, from the website's ship facts (#109, #263). */
const shipFacts = useShipFacts();
/** Marked in the alternatives, like the Pledge Store tab's base ship tables (#273). */
const alwaysAvailable = (id: number) => shipFacts.value?.isAlwaysAvailable(id) === true;

const groups = computed((): CcuAdviceGroup[] | undefined => {
  const shipList = current(ships.value ?? null)?.ships;
  if (!shipList) return undefined;
  // How many of each base ship, CCUs to it and buy back CCUs to it the user has.
  const holdings = holdingsByShip(createShipLookup(shipList), props.pledges, props.buyback);
  const facts = shipFacts.value;
  return ccuAdvice({
    pledges: props.pledges,
    ships: shipList,
    buyable: current(buyable.value ?? null)?.skus ?? [],
    warbonds: current(warbonds.value ?? null)?.warbonds ?? [],
    risingShipIds: risingShipIds.value,
    // The Ship Matrix first, the website's ship facts where it has no value (#265).
    statusOf: createShipStatusLookup(shipStatus.value, (id) => facts?.status(id)),
    storeCredit: storeCredit.value,
    isAlwaysAvailable: (id) => facts?.isAlwaysAvailable(id),
    holdingsOf: (id) => {
      const held = holdings.get(id);
      return {
        hangarShips: held?.hangarShips ?? 0,
        hangarCcus: held?.hangarCcus ?? 0,
        buybackCcus: held?.buybackCcus ?? 0,
      };
    },
  });
});

/** The image of a rising ship, from the ship list: the price increases name only its id. */
const shipImages = computed(
  () =>
    new Map(
      (current(ships.value ?? null)?.ships ?? []).flatMap((ship) =>
        ship.image ? [[ship.id, ship.image] as const] : [],
      ),
    ),
);

/** Per rising ship, the one of the CCU it was opened from first. */
const events = computed(() =>
  groups.value ? adviceEvents(groups.value, storeCredit.value, props.pledgeId) : undefined,
);

/** Whether the price increases shown are expected or confirmed by CIG (#275). */
const footerNote = computed(() =>
  confirmationNote((events.value ?? []).map((event) => event.increase)),
);

// "Hide sensitive information": the amounts are the account's, so none is shown.
const hidden = computed(() => settings.value.hideMeltValue);
const usd = (value: number) => (hidden.value ? '–' : formatUsd(value, locale.value));
/** "+$55", "−$145"; "$0" without a sign. */
const signed = (value: number) =>
  hidden.value
    ? '–'
    : value === 0
      ? formatUsd(0, locale.value)
      : `${value > 0 ? '+' : '−'}${formatUsd(Math.abs(value), locale.value)}`;
/** "−$145" for a negative amount, else "$620". */
const money = (value: number) =>
  hidden.value ? '–' : `${value < 0 ? '−' : ''}${formatUsd(Math.abs(value), locale.value)}`;
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);
/** A text with a count, in the singular or plural ("1 CCU", not "1 CCUs", #300). */
const plural = (
  key: 'outcomeTitle' | 'factMelt' | 'tableTotal' | 'mark' | 'marked',
  value: number,
) => i18n.n(`ccuAdvice.${key}`, value, [count(value)]);

const when = (event: AdviceEvent) =>
  formatExpectedTime(event.increase.priceIncreaseAt, locale.value);
/** The day of the increase, e.g. "Nov 19, 2026": melt and buy before it. */
const day = (event: AdviceEvent) =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    ...(event.increase.priceIncreaseAt.dayOnly && { timeZone: 'UTC' }),
  }).format(event.increase.priceIncreaseAt.at);
const badge = (event: AdviceEvent) => ({ increase: event.increase, reason: 'ship' as const });

/** The bars of the discount: today, if kept, if swapped, on one scale with 0. */
function bars(event: AdviceEvent) {
  const outcome = event.outcome!;
  const values = [outcome.today, outcome.kept, outcome.swapped];
  const min = Math.min(0, ...values);
  const span = Math.max(0, ...values) - min || 1;
  const percent = (value: number) => `${((value - min) / span) * 100}%`;
  const bar = (key: string, value: number, tone: string) => ({
    key,
    label: i18n.t(`ccuAdvice.${key}` as 'ccuAdvice.barToday'),
    value,
    tone,
    left: percent(Math.min(0, value)),
    width: `${(Math.abs(value) / span) * 100}%`,
  });
  return {
    zero: percent(0),
    list: [
      bar('barToday', outcome.today, 'is-neutral'),
      bar('barKeep', outcome.kept, outcome.kept < 0 ? 'is-loss' : 'is-neutral'),
      bar('barSwap', outcome.swapped, 'is-gain'),
    ],
  };
}

/** That giftable CCUs lose it when melted: one, all, or some of them. */
function giftableText(giftable: number, total: number) {
  if (total === 1) return i18n.t('ccuAdvice.giftableSingle');
  if (giftable === total) return i18n.t('ccuAdvice.giftableAll', [total]);
  return i18n.n('ccuAdvice.giftable', giftable, [giftable, total]);
}

/** Why a group gets no recommendation, in one sentence. */
function noteOf(group: CcuAdviceGroup, event: AdviceEvent): string {
  const ship = event.increase.ship.name;
  const parts = [
    group.increase.price
      ? i18n.t(group.noSwitch === 'notSold' ? 'ccuAdvice.notSold' : 'ccuAdvice.keepIsBetter', [
          ship,
        ])
      : i18n.t('ccuAdvice.riseUnknown', [ship, when(event)]),
  ];
  if (group.targetInConcept) parts.push(i18n.t('ccuAdvice.targetInConcept', [group.target.name]));
  return parts.join(' ');
}
/** What a group without recommendation may lose: its discount today, if it has one. */
const atStake = (group: CcuAdviceGroup) =>
  !group.increase.price && group.discountNow !== undefined && group.discountNow > 0
    ? group.discountNow
    : undefined;

// The rows open and closed, by key; the one of the CCU it was opened from is open.
const opened = reactive(new Map<string, boolean>());
const isOpen = (row: AdviceRow) => opened.get(row.key) ?? row.origin;
const toggle = (row: AdviceRow) => opened.set(row.key, !isOpen(row));

// ---- Mark to melt (#97): all CCUs of the recommendations ----

const marked = useMarkedPledges();
const recommendedIds = computed(() =>
  (events.value ?? []).flatMap((event) =>
    event.rows.flatMap((row) => row.group.ccus.map((ccu) => ccu.id)),
  ),
);
const allMarked = computed(
  () => recommendedIds.value.length > 0 && recommendedIds.value.every((id) => marked.value.has(id)),
);
function toggleMarks() {
  void setMeltMarks(recommendedIds.value, !allMarked.value, !!demo.value);
}

onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <!-- Teleported out of the manager: it carries the theme class itself. -->
    <div
      class="shm-overlay"
      :class="themeClasses(settings)"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-ccu-advice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shm-ccu-advice-title"
        tabindex="-1"
      >
        <header class="shm-overlay-header shm-kd-header">
          <div>
            <h3 id="shm-ccu-advice-title">{{ i18n.t('ccuAdvice.title') }}</h3>
            <p class="shm-kd-intro">{{ i18n.t('ccuAdvice.intro') }}</p>
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

        <p v-if="!events" class="shm-overlay-note">{{ i18n.t('ccuAdvice.noShips') }}</p>
        <p v-else-if="!events.length" class="shm-overlay-note">{{ i18n.t('ccuAdvice.none') }}</p>

        <section
          v-for="event in events"
          :key="event.key"
          class="shm-kd-event"
          :aria-label="event.increase.ship.name"
        >
          <!-- The price increase, with its countdown. -->
          <div class="shm-kd-price">
            <span class="shm-kd-price-icon" aria-hidden="true">
              <SvgIcon name="arrow-up" />
            </span>
            <img
              v-if="shipImages.get(event.increase.ship.id)"
              class="shm-kd-price-ship"
              :src="shipImages.get(event.increase.ship.id)"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div class="shm-kd-price-text">
              <strong>{{
                event.increase.price
                  ? i18n.t('ccuAdvice.eventPrice', [
                      event.increase.ship.name,
                      usd(event.increase.price.from),
                      usd(event.increase.price.to),
                    ])
                  : i18n.t('ccuAdvice.eventUnknown', [event.increase.ship.name])
              }}</strong>
              <span>
                {{
                  i18n.t(
                    event.increase.confirmed
                      ? 'ccuAdvice.eventWhenConfirmed'
                      : 'ccuAdvice.eventWhen',
                    [when(event)],
                  )
                }}
                <!-- Where it comes from, if the file says (#275). -->
                <template v-if="event.increase.source">
                  ·
                  <a
                    class="shm-kd-source"
                    :href="event.increase.source"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ i18n.t('priceIncrease.source') }}
                    <SvgIcon name="square-up-right" />
                  </a>
                </template>
              </span>
            </div>
            <PriceIncreaseBadge :match="badge(event)" place="buyback" />
          </div>

          <template v-if="event.plan">
            <div class="shm-kd-cards">
              <!-- What the discount does: today, if kept, if swapped. -->
              <section v-if="event.outcome" class="shm-kd-card">
                <h4>{{ plural('outcomeTitle', event.outcome.ccus) }}</h4>
                <div
                  v-if="!hidden"
                  class="shm-kd-bars"
                  role="img"
                  :aria-label="
                    i18n.t('ccuAdvice.outcomeLabel', [
                      money(event.outcome.today),
                      money(event.outcome.kept),
                      money(event.outcome.swapped),
                    ])
                  "
                >
                  <div v-for="bar in bars(event).list" :key="bar.key" class="shm-kd-bar">
                    <span class="shm-kd-bar-label" :class="{ 'is-strong': bar.tone === 'is-gain' }">
                      {{ bar.label }}
                    </span>
                    <span class="shm-kd-bar-track" aria-hidden="true">
                      <span class="shm-kd-bar-zero" :style="{ left: bars(event).zero }"></span>
                      <span
                        class="shm-kd-bar-fill"
                        :class="bar.tone"
                        :style="{ left: bar.left, width: bar.width }"
                      ></span>
                    </span>
                    <span class="shm-kd-bar-value" :class="bar.tone">{{ money(bar.value) }}</span>
                  </div>
                </div>
                <div class="shm-kd-card-foot">
                  <span>
                    {{ i18n.t('ccuAdvice.outcomeGain') }}
                    <strong class="is-gain">{{
                      usd(event.outcome.swapped - event.outcome.kept)
                    }}</strong>
                    {{ i18n.t('ccuAdvice.outcomeGainRest') }}
                  </span>
                  <span>
                    {{ i18n.t('ccuAdvice.outcomeCredit') }}
                    <strong :class="event.outcome.credit >= 0 ? 'is-gain' : 'is-loss'">{{
                      signed(event.outcome.credit)
                    }}</strong>
                  </span>
                </div>
              </section>

              <!-- How to keep it: the steps of the recommendation. -->
              <section class="shm-kd-card">
                <h4>{{ i18n.t('ccuAdvice.howTitle') }}</h4>
                <ol class="shm-kd-steps">
                  <li>
                    <span class="shm-kd-step-number">1</span>
                    <span>
                      <strong>{{ i18n.t('ccuAdvice.stepMelt', [day(event)]) }}</strong>
                      <span>{{ i18n.t('ccuAdvice.stepMeltSub') }}</span>
                    </span>
                  </li>
                  <li>
                    <span class="shm-kd-step-number">2</span>
                    <span>
                      <strong>{{
                        i18n.t('ccuAdvice.stepBuy', [event.plan.from.name, event.plan.to.name])
                      }}</strong>
                      <span>
                        {{
                          i18n.t('ccuAdvice.stepBuySub', [
                            usd(event.plan.price),
                            usd(event.plan.total),
                          ])
                        }}
                        <template v-if="event.plan.choice !== 'any'">{{
                          i18n.t(
                            event.plan.choice === 'alwaysAvailable'
                              ? 'ccuAdvice.stepAlways'
                              : 'ccuAdvice.stepOnSale',
                          )
                        }}</template>
                        {{
                          i18n.t('ccuAdvice.holdings', [
                            event.plan.holdings.hangarShips,
                            event.plan.from.name,
                            event.plan.holdings.hangarCcus,
                            event.plan.holdings.buybackCcus,
                          ])
                        }}
                      </span>
                    </span>
                  </li>
                  <li>
                    <span class="shm-kd-step-number is-gain">3</span>
                    <span>
                      <strong>{{
                        i18n.t('ccuAdvice.stepGain', [usd(event.plan.discountAfter)])
                      }}</strong>
                      <span>{{ i18n.t('ccuAdvice.stepGainSub', [event.plan.to.name]) }}</span>
                    </span>
                  </li>
                </ol>
                <p
                  class="shm-kd-note"
                  :class="{ 'is-warning': event.plan.enoughStoreCredit === false }"
                  role="note"
                >
                  <SvgIcon
                    :name="
                      event.plan.enoughStoreCredit === false
                        ? 'triangle-exclamation'
                        : 'circle-info'
                    "
                  />
                  <span>{{
                    event.plan.storeCreditNeeded
                      ? storeCredit === undefined || hidden
                        ? i18n.t('ccuAdvice.creditNeeded', [usd(event.plan.storeCreditNeeded)])
                        : i18n.t('ccuAdvice.creditNeededHave', [
                            usd(event.plan.storeCreditNeeded),
                            usd(storeCredit),
                          ])
                      : i18n.t('ccuAdvice.creditCovered')
                  }}</span>
                </p>
                <p v-if="event.plan.giftable" class="shm-kd-note is-warning" role="note">
                  <SvgIcon name="gift" />
                  <span>{{ giftableText(event.plan.giftable, event.plan.ccus) }}</span>
                </p>
              </section>
            </div>

            <!-- The CCUs per target, each opening its figures. -->
            <section class="shm-kd-list">
              <div class="shm-kd-list-head">
                <h4>{{ i18n.t('ccuAdvice.tableTitle', [event.increase.ship.name]) }}</h4>
                <span>{{ i18n.t('ccuAdvice.tableSorted') }}</span>
              </div>
              <div class="shm-kd-table-scroll">
                <table class="shm-kd-table">
                  <thead>
                    <tr>
                      <th scope="col">{{ i18n.t('ccuAdvice.colCcu') }}</th>
                      <th scope="col" class="is-number">{{ i18n.t('ccuAdvice.colToday') }}</th>
                      <th scope="col" class="is-number">{{ i18n.t('ccuAdvice.colKept') }}</th>
                      <th scope="col" class="is-number">{{ i18n.t('ccuAdvice.colSwapped') }}</th>
                      <th scope="col" class="is-number">{{ i18n.t('ccuAdvice.colCredit') }}</th>
                      <th scope="col">
                        <span class="shm-kd-sr">{{ i18n.t('pledge.toggleDetails') }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    v-for="row in event.rows"
                    :key="row.key"
                    :class="{ 'is-origin': row.origin, 'is-open': isOpen(row) }"
                  >
                    <tr class="shm-kd-row" @click="toggle(row)">
                      <th scope="row">
                        <span class="shm-kd-ccu">
                          <CcuShips :from="row.group.base" :to="row.group.target" />
                          <span class="shm-kd-ccu-name">
                            <span
                              ><span class="shm-kd-muted"
                                >{{ count(row.group.ccus.length) }} ×</span
                              >
                              {{ row.group.target.name }}</span
                            >
                            <small v-if="row.origin">{{ i18n.t('ccuAdvice.origin') }}</small>
                          </span>
                        </span>
                      </th>
                      <td class="is-number">
                        {{ row.today === undefined ? '' : money(row.today) }}
                      </td>
                      <td class="is-number" :class="{ 'is-loss': (row.kept ?? 0) < 0 }">
                        {{ row.kept === undefined ? '' : money(row.kept) }}
                      </td>
                      <td class="is-number is-gain is-strong">{{ money(row.swapped) }}</td>
                      <td class="is-number" :class="{ 'is-gain': row.credit > 0 }">
                        {{ signed(row.credit) }}
                      </td>
                      <td class="shm-kd-chevron-cell">
                        <button
                          type="button"
                          class="shm-kd-chevron"
                          :aria-expanded="isOpen(row)"
                          :aria-label="i18n.t('pledge.toggleDetails')"
                          @click.stop="toggle(row)"
                        >
                          <SvgIcon name="chevron-down" />
                        </button>
                      </td>
                    </tr>
                    <tr v-if="isOpen(row)" class="shm-kd-facts-row">
                      <td colspan="6">
                        <div class="shm-kd-facts">
                          <span v-if="row.group.keep">
                            <small>{{ i18n.t('ccuAdvice.factValue') }}</small>
                            {{
                              i18n.t('ccuAdvice.factValueText', [
                                usd(row.group.keep.upgradeValueNow),
                                usd(row.group.keep.upgradeValueAfter),
                              ])
                            }}
                          </span>
                          <span>
                            <small>{{ plural('factMelt', row.group.ccus.length) }}</small>
                            <span class="is-gain">{{
                              i18n.t('ccuAdvice.factMeltText', [usd(row.group.meltValue)])
                            }}</span>
                          </span>
                          <span>
                            <small>{{
                              i18n.t('ccuAdvice.factBuy', [
                                count(row.group.ccus.length),
                                event.plan.from.name,
                                event.plan.to.name,
                              ])
                            }}</small>
                            {{
                              i18n.t('ccuAdvice.factBuyText', [
                                usd(event.plan.price * row.group.ccus.length),
                                usd(event.plan.price),
                              ])
                            }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">
                        {{ plural('tableTotal', event.plan.ccus) }}
                      </th>
                      <td class="is-number">
                        {{ event.outcome ? money(event.outcome.today) : '' }}
                      </td>
                      <td class="is-number" :class="{ 'is-loss': (event.outcome?.kept ?? 0) < 0 }">
                        {{ event.outcome ? money(event.outcome.kept) : '' }}
                      </td>
                      <td class="is-number is-gain">{{ money(event.plan.swapped) }}</td>
                      <td class="is-number" :class="event.plan.credit >= 0 ? 'is-gain' : 'is-loss'">
                        {{ signed(event.plan.credit) }}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- The recommended CCU and cheaper ones from ships between it and the rising ship
                   (#263, #273): only the recommended base ship can be always available. -->
              <details v-if="event.plan.alternatives.length" class="shm-kd-alternatives">
                <summary>{{ i18n.t('ccuAdvice.alternatives') }}</summary>
                <div class="shm-kd-table-scroll">
                  <table class="shm-kd-table is-plain">
                    <thead>
                      <tr>
                        <th scope="col">{{ i18n.t('ccuAdvice.colCcu') }}</th>
                        <th scope="col" class="is-number">{{ i18n.t('ccuAdvice.colPrice') }}</th>
                        <th
                          v-tooltip="i18n.t('store.colAlwaysAvailableHint')"
                          scope="col"
                          class="is-center"
                        >
                          {{ i18n.t('store.colAlwaysAvailable') }}
                        </th>
                        <th scope="col" class="is-number">
                          {{ i18n.t('ccuAdvice.colHangarShips') }}
                        </th>
                        <th scope="col" class="is-number">
                          {{ i18n.t('ccuAdvice.colHangarCcus') }}
                        </th>
                        <th scope="col" class="is-number">
                          {{ i18n.t('ccuAdvice.colBuybackCcus') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="alternative in [event.plan, ...event.plan.alternatives]"
                        :key="alternative.from.id"
                        :class="{ 'is-strong': alternative === event.plan }"
                      >
                        <th scope="row">
                          {{
                            i18n.t('ccuAdvice.ccuName', [alternative.from.name, event.plan.to.name])
                          }}
                        </th>
                        <td class="is-number">{{ usd(alternative.price) }}</td>
                        <td class="is-center">
                          <SvgIcon
                            v-if="alwaysAvailable(alternative.from.id)"
                            name="check"
                            class="is-gain"
                            :label="i18n.t('store.colAlwaysAvailable')"
                          />
                        </td>
                        <td class="is-number">{{ alternative.holdings.hangarShips }}</td>
                        <td class="is-number">{{ alternative.holdings.hangarCcus }}</td>
                        <td class="is-number">{{ alternative.holdings.buybackCcus }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          </template>

          <!-- CCUs without a recommendation: what may happen. -->
          <section v-for="group in event.others" :key="group.target.id" class="shm-kd-other">
            <CcuShips :from="group.base" :to="group.target" />
            <div class="shm-kd-other-text">
              <h5>
                <span class="shm-kd-muted">{{ count(group.ccus.length) }} ×</span>
                {{ i18n.t('ccuAdvice.ccuName', [event.increase.ship.name, group.target.name]) }}
              </h5>
              <span>{{ noteOf(group, event) }}</span>
            </div>
            <span v-if="atStake(group) !== undefined" class="shm-kd-other-amount">
              <strong>{{ usd(atStake(group)!) }}</strong>
              <small>{{ i18n.t('ccuAdvice.mayBeLost') }}</small>
            </span>
          </section>
        </section>

        <footer class="shm-kd-footer">
          <span class="shm-kd-footer-note">
            <SvgIcon name="circle-info" />
            {{ i18n.t('ccuAdvice.footer') }}
            <template v-if="footerNote">{{ i18n.t(footerNote) }}</template>
          </span>
          <button
            v-if="recommendedIds.length"
            v-tooltip="i18n.t(allMarked ? 'ccuAdvice.unmarkHint' : 'ccuAdvice.markHint')"
            type="button"
            class="shm-button shm-kd-mark"
            :aria-pressed="allMarked"
            @click="toggleMarks"
          >
            <SvgIcon :name="allMarked ? 'check' : 'recycle'" />
            {{
              allMarked
                ? plural('marked', recommendedIds.length)
                : plural('mark', recommendedIds.length)
            }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style>
/* Wider than the other dialogs: two cards side by side and a table of five columns. */
.shm-ccu-advice.shm-overlay-dialog {
  width: min(948px, 100%);
}

.shm-ccu-advice .is-gain {
  color: var(--shm-success);
}

.shm-ccu-advice .is-loss {
  color: var(--shm-danger);
}

.shm-ccu-advice .is-strong {
  font-weight: 600;
}

.shm-ccu-advice .shm-kd-muted {
  color: var(--shm-text-muted);
}

.shm-ccu-advice .shm-kd-header {
  align-items: flex-start;
  gap: 16px;
}

.shm-ccu-advice .shm-kd-intro {
  margin: 4px 0 0;
  color: var(--shm-text-muted);
}

/* ---- One rising ship ---- */

.shm-ccu-advice .shm-kd-event {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shm-ccu-advice .shm-kd-event + .shm-kd-event {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-ccu-advice .shm-kd-price {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--shm-warning) 10%, transparent);
  border-radius: var(--shm-radius-group);
}

.shm-ccu-advice .shm-kd-price-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--shm-warning);
  background: color-mix(in srgb, var(--shm-warning) 18%, transparent);
  border-radius: var(--shm-radius-control);
}

.shm-ccu-advice .shm-kd-price-ship {
  display: block;
  flex: none;
  width: 64px;
  height: 36px;
  object-fit: cover;
  border-radius: var(--shm-radius-small);
}

.shm-ccu-advice .shm-kd-price-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.shm-ccu-advice .shm-kd-price-text strong {
  color: var(--shm-text-strong);
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-ccu-advice .shm-kd-source {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-ccu-advice .shm-kd-source:hover,
.shm-ccu-advice .shm-kd-source:focus-visible {
  text-decoration: underline;
}

.shm-ccu-advice .shm-kd-price-text span {
  color: var(--shm-text-muted);
}

/* ---- The two cards ---- */

.shm-ccu-advice .shm-kd-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  /* Each card as tall as its content: the bars need less room than the steps. */
  align-items: start;
}

.shm-ccu-advice .shm-kd-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgb(var(--shm-accent-rgb) / 0.07);
  border-radius: var(--shm-radius-group);
}

.shm-ccu-advice .shm-kd-card h4,
.shm-ccu-advice .shm-kd-list h4 {
  margin: 0;
}

.shm-ccu-advice .shm-kd-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shm-ccu-advice .shm-kd-bar {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr) 70px;
  gap: 10px;
  align-items: center;
}

.shm-ccu-advice .shm-kd-bar-label {
  color: var(--shm-text-muted);
}

.shm-ccu-advice .shm-kd-bar-label.is-strong {
  color: var(--shm-text-strong);
}

.shm-ccu-advice .shm-kd-bar-track {
  position: relative;
  height: 20px;
}

.shm-ccu-advice .shm-kd-bar-zero {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: rgb(var(--shm-accent-rgb) / 0.35);
}

.shm-ccu-advice .shm-kd-bar-fill {
  position: absolute;
  top: 3px;
  height: 14px;
  background: var(--shm-text-muted);
  border-radius: var(--shm-radius-small);
}

.shm-ccu-advice .shm-kd-bar-fill.is-loss {
  background: var(--shm-danger);
}

.shm-ccu-advice .shm-kd-bar-fill.is-gain {
  background: var(--shm-success);
}

.shm-ccu-advice .shm-kd-bar-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.shm-ccu-advice .shm-kd-card-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  margin-top: auto;
  padding-top: 12px;
  color: var(--shm-text-muted);
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-ccu-advice .shm-kd-card-foot strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.shm-ccu-advice .shm-kd-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-ccu-advice .shm-kd-steps li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.shm-ccu-advice .shm-kd-steps li > span:last-child {
  display: flex;
  flex-direction: column;
}

.shm-ccu-advice .shm-kd-steps strong {
  color: var(--shm-text-strong);
  font-weight: 500;
}

.shm-ccu-advice .shm-kd-steps li > span:last-child > span {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-advice .shm-kd-step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: var(--shm-text-strong);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 700;
  background: rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-pill);
}

.shm-ccu-advice .shm-kd-step-number.is-gain {
  background: rgb(var(--shm-success-rgb) / 0.2);
}

.shm-ccu-advice .shm-kd-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  font-size: calc(12px * var(--shm-font-scale));
  background: rgb(var(--shm-accent-rgb) / 0.08);
  border-radius: var(--shm-radius-control);
}

.shm-ccu-advice .shm-kd-note .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-accent);
}

.shm-ccu-advice .shm-kd-note.is-warning {
  background: color-mix(in srgb, var(--shm-warning) 10%, transparent);
}

.shm-ccu-advice .shm-kd-note.is-warning .shm-icon {
  color: var(--shm-warning);
}

/* ---- The CCUs per target ---- */

.shm-ccu-advice .shm-kd-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shm-ccu-advice .shm-kd-list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}

.shm-ccu-advice .shm-kd-list-head > span {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-advice .shm-kd-table-scroll {
  overflow-x: auto;
  background: rgb(var(--shm-accent-rgb) / 0.07);
  border-radius: var(--shm-radius-group);
}

.shm-ccu-advice .shm-kd-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.shm-ccu-advice .shm-kd-table :is(th, td) {
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
}

.shm-ccu-advice .shm-kd-table :is(th, td):first-child {
  padding-left: 16px;
}

.shm-ccu-advice .shm-kd-table thead th {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-ccu-advice .shm-kd-table tbody th {
  color: var(--shm-text);
  font-weight: 500;
}

.shm-ccu-advice .shm-kd-table tbody :is(th, td) {
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
}

.shm-ccu-advice .shm-kd-table .is-number {
  text-align: right;
}

.shm-ccu-advice .shm-kd-table .is-center {
  text-align: center;
}

.shm-ccu-advice .shm-kd-row {
  cursor: pointer;
}

.shm-ccu-advice tbody.is-origin {
  background: rgb(var(--shm-accent-rgb) / 0.08);
}

@media (hover: hover) and (pointer: fine) {
  .shm-ccu-advice .shm-kd-row:hover {
    background: rgb(var(--shm-accent-rgb) / 0.07);
  }
}

.shm-ccu-advice .shm-kd-ccu {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shm-ccu-advice .shm-kd-ccu .shm-ccu-ship {
  width: 34px;
  height: 22px;
}

.shm-ccu-advice .shm-kd-ccu-name {
  display: flex;
  flex-direction: column;
}

.shm-ccu-advice .shm-kd-ccu-name small {
  color: var(--shm-accent);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 400;
}

.shm-ccu-advice .shm-kd-chevron-cell {
  width: 28px;
  padding-left: 0;
}

.shm-ccu-advice .shm-kd-chevron {
  display: flex;
  padding: 4px;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  border-radius: var(--shm-radius-small);
  cursor: pointer;
}

.shm-ccu-advice .shm-kd-chevron .shm-icon {
  transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}

.shm-ccu-advice .shm-kd-chevron[aria-expanded='true'] .shm-icon {
  transform: rotate(180deg);
}

.shm-ccu-advice .shm-kd-chevron:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-ccu-advice .shm-kd-table tbody .shm-kd-facts-row td {
  padding-top: 0;
  border-top: 0;
}

.shm-ccu-advice .shm-kd-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  padding-left: 88px;
  white-space: normal;
  animation: shm-kd-in 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}

.shm-ccu-advice .shm-kd-facts > span {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  background: rgb(0 0 0 / 0.25);
  border-radius: var(--shm-radius-control);
}

.shm-ccu-advice .shm-kd-facts small {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

@keyframes shm-kd-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.shm-ccu-advice .shm-kd-table tfoot :is(th, td) {
  font-weight: 600;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.22);
}

.shm-ccu-advice .shm-kd-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

/* The alternatives (#273): on demand, below the CCUs. */
.shm-ccu-advice .shm-kd-alternatives summary {
  padding: 4px;
  color: var(--shm-accent);
  cursor: pointer;
}

.shm-ccu-advice .shm-kd-alternatives .shm-kd-table-scroll {
  margin-top: 6px;
}

.shm-ccu-advice .shm-kd-table.is-plain tbody th {
  font-weight: 400;
}

/* ---- Without a recommendation ---- */

.shm-ccu-advice .shm-kd-other {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.18);
  border-radius: var(--shm-radius-group);
}

.shm-ccu-advice .shm-kd-other .shm-ccu-ship {
  width: 34px;
  height: 22px;
}

.shm-ccu-advice .shm-kd-other-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-advice .shm-kd-other-text h5 {
  margin: 0;
  color: var(--shm-text-strong);
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 500;
}

.shm-ccu-advice .shm-kd-other-amount {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
}

.shm-ccu-advice .shm-kd-other-amount small {
  color: var(--shm-warning);
}

/* ---- Footer ---- */

.shm-ccu-advice .shm-kd-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-ccu-advice .shm-kd-footer-note {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 8px;
  min-width: 240px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-advice .shm-kd-footer-note .shm-icon {
  flex: none;
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .shm-ccu-advice .shm-kd-chevron .shm-icon {
    transition: none;
  }

  .shm-ccu-advice .shm-kd-facts {
    animation: none;
  }
}
</style>
