<script setup lang="ts">
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { currentShipStatus, shipStatusItem } from '@/ships/ship-status';
import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { ccuAdvice, type CcuAdviceGroup } from '../ccu-advice';
import { formatExpectedTime } from '../price-increase-label';
import CcuShips from './CcuShips.vue';

/*
 * The advice for the CCUs of My Hangar whose base ship rises in price (#252, see `ccu-advice.ts`),
 * per pair of base and target ship: what keeping them means, and – with the new price known – the
 * recommendation to melt them and buy CCUs to the rising ship with the store credit, with the cost
 * and the discount after the increase. Without the new price only a warning and an information.
 * A suggestion only: nothing is melted or bought from here.
 */

const props = defineProps<{ pledges: readonly PledgeView[]; pledgeId?: number }>();
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

const groups = computed((): CcuAdviceGroup[] | undefined => {
  const shipList = current(ships.value ?? null)?.ships;
  if (!shipList) return undefined;
  const all = ccuAdvice({
    pledges: props.pledges,
    ships: shipList,
    buyable: current(buyable.value ?? null)?.skus ?? [],
    warbonds: current(warbonds.value ?? null)?.warbonds ?? [],
    risingShipIds: risingShipIds.value,
    inConceptShipIds: new Set(currentShipStatus(shipStatus.value)?.inConcept ?? []),
    storeCredit: storeCredit.value,
  });
  // The group of the CCU it was opened from first, then the recommendations.
  const rank = (group: CcuAdviceGroup) =>
    group.ccus.some((ccu) => ccu.id === props.pledgeId) ? 0 : group.switch ? 1 : 2;
  return all
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index)
    .map(({ group }) => group);
});

// "Hide sensitive information": the amounts are the account's, so none is shown.
const usd = (value: number) =>
  settings.value.hideMeltValue ? '–' : formatUsd(value, locale.value);

const baseName = (group: CcuAdviceGroup) => group.increase.ship.name;
const when = (group: CcuAdviceGroup) =>
  formatExpectedTime(group.increase.priceIncreaseAt, locale.value);
/** The day of the increase, e.g. "Nov 19, 2026": melt and buy before it. */
const day = (group: CcuAdviceGroup) =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    ...(group.increase.priceIncreaseAt.dayOnly && { timeZone: 'UTC' }),
  }).format(group.increase.priceIncreaseAt.at);

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
        <header class="shm-overlay-header">
          <h3 id="shm-ccu-advice-title">{{ i18n.t('ccuAdvice.title') }}</h3>
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
        <p class="shm-overlay-note">{{ i18n.t('ccuAdvice.intro') }}</p>

        <p v-if="!groups" class="shm-overlay-note shm-ccu-advice-empty">
          {{ i18n.t('ccuAdvice.noShips') }}
        </p>
        <p v-else-if="!groups.length" class="shm-overlay-note shm-ccu-advice-empty">
          {{ i18n.t('ccuAdvice.none') }}
        </p>

        <section
          v-for="group in groups"
          :key="`${group.increase.ship.id}>${group.target.id}`"
          class="shm-ccu-advice-group"
        >
          <div class="shm-ccu-advice-head">
            <CcuShips :from="group.base" :to="group.target" />
            <h4>
              {{
                i18n.t('ccuAdvice.groupTitle', [
                  group.ccus.length,
                  baseName(group),
                  group.target.name,
                ])
              }}
            </h4>
          </div>
          <p class="shm-ccu-advice-text">
            {{
              group.increase.price
                ? i18n.t('ccuAdvice.increasePrice', [
                    baseName(group),
                    usd(group.increase.price.from),
                    usd(group.increase.price.to),
                    when(group),
                  ])
                : i18n.t('ccuAdvice.increase', [baseName(group), when(group)])
            }}
            <template v-if="group.keep">
              {{
                i18n.t('ccuAdvice.keepFigures', [
                  usd(group.keep.upgradeValueNow),
                  usd(group.keep.upgradeValueAfter),
                  usd(group.keep.discountNow),
                  usd(group.keep.discountAfter),
                ])
              }}
            </template>
          </p>

          <!-- With the new price: the recommendation, or why there is none. -->
          <div v-if="group.switch" class="shm-ccu-advice-switch">
            <div class="shm-ccu-advice-head">
              <CcuShips :from="group.switch.from" :to="group.switch.to" />
              <strong>{{
                i18n.t('ccuAdvice.switchTitle', [
                  day(group),
                  group.ccus.length,
                  group.switch.from.name,
                  group.switch.to.name,
                ])
              }}</strong>
            </div>
            <p class="shm-ccu-advice-text">
              {{
                i18n.t('ccuAdvice.switchFigures', [
                  usd(group.switch.price),
                  usd(group.switch.total),
                  usd(group.switch.upgradeValueAfter),
                  usd(group.switch.discountAfter),
                ])
              }}
              {{ i18n.t('ccuAdvice.meltGivesBack', [usd(group.meltValue)]) }}
              <span :class="{ 'is-warning': group.switch.enoughStoreCredit === false }">{{
                group.switch.storeCreditNeeded
                  ? storeCredit === undefined || settings.hideMeltValue
                    ? i18n.t('ccuAdvice.creditNeeded', [usd(group.switch.storeCreditNeeded)])
                    : i18n.t('ccuAdvice.creditNeededHave', [
                        usd(group.switch.storeCreditNeeded),
                        usd(storeCredit),
                      ])
                  : i18n.t('ccuAdvice.creditCovered')
              }}</span>
            </p>
            <p v-if="group.keep" class="shm-ccu-advice-gain">
              {{
                i18n.t('ccuAdvice.switchGain', [
                  usd(group.switch.discountAfter * group.ccus.length),
                  usd(group.keep.discountAfter),
                ])
              }}
            </p>
            <p v-if="group.giftable" class="shm-ccu-advice-note is-warning-note" role="note">
              <SvgIcon name="triangle-exclamation" />
              <span>{{
                i18n.t(group.giftable === 1 ? 'ccuAdvice.giftableOne' : 'ccuAdvice.giftable', [
                  group.giftable,
                  group.ccus.length,
                ])
              }}</span>
            </p>
          </div>
          <p v-else-if="group.noSwitch" class="shm-ccu-advice-note">
            <SvgIcon name="circle-info" />
            <span>{{
              i18n.t(
                group.noSwitch === 'notSold' ? 'ccuAdvice.notSold' : 'ccuAdvice.keepIsBetter',
                [baseName(group)],
              )
            }}</span>
          </p>

          <!-- Without the new price: nothing to recommend, only what may happen. -->
          <template v-if="!group.increase.price">
            <p
              v-if="group.discountNow !== undefined && group.discountNow > 0"
              class="shm-ccu-advice-note is-warning-note"
              role="note"
            >
              <SvgIcon name="triangle-exclamation" />
              <span>{{ i18n.t('ccuAdvice.mayLoseDiscount', [usd(group.discountNow)]) }}</span>
            </p>
            <p v-else class="shm-ccu-advice-note">
              <SvgIcon name="circle-info" />
              <span>{{ i18n.t('ccuAdvice.unknownAmount') }}</span>
            </p>
          </template>
          <p v-if="group.targetInConcept" class="shm-ccu-advice-note">
            <SvgIcon name="circle-info" />
            <span>{{ i18n.t('ccuAdvice.targetInConcept', [group.target.name]) }}</span>
          </p>
        </section>

        <p class="shm-overlay-note shm-ccu-advice-footer">{{ i18n.t('ccuAdvice.footer') }}</p>
      </section>
    </div>
  </Teleport>
</template>

<style>
.shm-ccu-advice .shm-ccu-advice-group {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-ccu-advice .shm-ccu-advice-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.shm-ccu-advice .shm-ccu-advice-head h4 {
  margin: 0;
}

.shm-ccu-advice .shm-ccu-advice-text {
  margin: 8px 0 0;
}

/* The recommendation: set apart from what keeping them means. */
.shm-ccu-advice .shm-ccu-advice-switch {
  margin-top: 12px;
  padding: 12px 14px;
  background: rgb(var(--shm-accent-rgb) / 0.06);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-control);
}

.shm-ccu-advice .shm-ccu-advice-switch strong {
  color: var(--shm-text-strong);
  font-weight: 600;
}

.shm-ccu-advice .shm-ccu-advice-gain {
  margin: 6px 0 0;
  color: var(--shm-success);
}

.shm-ccu-advice .is-warning {
  color: var(--shm-warning);
}

.shm-ccu-advice .shm-ccu-advice-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 0;
  color: var(--shm-text);
}

.shm-ccu-advice .shm-ccu-advice-note .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-accent);
}

.shm-ccu-advice .shm-ccu-advice-note.is-warning-note .shm-icon {
  color: var(--shm-warning);
}

.shm-ccu-advice .shm-ccu-advice-empty {
  margin-top: 14px;
}

.shm-ccu-advice .shm-ccu-advice-footer {
  margin-top: 20px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}
</style>
