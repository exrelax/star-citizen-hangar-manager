<script setup lang="ts">
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { ccuAdvice, type CcuAdviceGroup, type CcuAdviceOption } from '../ccu-advice';
import { formatExpectedTime } from '../price-increase-label';

/*
 * The advice for the CCUs of My Hangar that lose upgrade value with a price increase (#252, see
 * `ccu-advice.ts`): per target ship, keeping them compared with melting them and buying CCUs to
 * the same ship from another base ship – with the cost, the store credit, the discount gained and
 * what is lost in giftable CCUs. A suggestion only: nothing is melted or bought from here.
 */

const props = defineProps<{ pledges: readonly PledgeView[]; pledgeId?: number }>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const dialog = useTemplateRef<HTMLElement>('dialog');

const ships = useStored(shipsItem);
const buyable = useStored(buyableShipsItem);
const warbonds = useStored(warbondsItem);
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

/** The ships with an upcoming price increase in the lists: no base ship for the advice. */
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
    storeCredit: storeCredit.value,
  });
  // The group of the CCU it was opened from first.
  const focus = all.findIndex((group) => group.ccus.some((ccu) => ccu.id === props.pledgeId));
  return focus > 0 ? [all[focus]!, ...all.slice(0, focus), ...all.slice(focus + 1)] : all;
});

// "Hide sensitive information": the amounts are the account's, so none is shown.
const usd = (value: number) =>
  settings.value.hideMeltValue ? '–' : formatUsd(value, locale.value);
const signed = (value: number) =>
  settings.value.hideMeltValue ? '–' : `${value > 0 ? '+' : ''}${formatUsd(value, locale.value)}`;

const baseName = (group: CcuAdviceGroup) => group.increase.ship.name;
const when = (group: CcuAdviceGroup) =>
  formatExpectedTime(group.increase.priceIncreaseAt, locale.value);

function optionTitle(group: CcuAdviceGroup, option: CcuAdviceOption) {
  return i18n.t(option.kind === 'standard' ? 'ccuAdvice.standardTitle' : 'ccuAdvice.warbondTitle', [
    group.ccus.length,
    option.base.name,
    group.target.name,
  ]);
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
          <h4>
            {{
              i18n.t('ccuAdvice.groupTitle', [
                group.ccus.length,
                baseName(group),
                group.target.name,
              ])
            }}
          </h4>
          <p class="shm-ccu-advice-increase">
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
          </p>

          <dl class="shm-ccu-advice-figures">
            <div>
              <dt>{{ i18n.t('ccuAdvice.keep') }}</dt>
              <dd v-if="group.keep">
                {{
                  i18n.t('ccuAdvice.keepFigures', [
                    usd(group.keep.upgradeValueNow),
                    usd(group.keep.upgradeValueAfter),
                    signed(group.keep.discountNow),
                    signed(group.keep.discountAfter),
                  ])
                }}
              </dd>
              <dd v-else>{{ i18n.t('ccuAdvice.keepUnknown') }}</dd>
            </div>
            <div v-for="option in group.options" :key="option.kind">
              <dt>{{ optionTitle(group, option) }}</dt>
              <dd>
                {{
                  i18n.t(
                    option.kind === 'standard'
                      ? 'ccuAdvice.standardFigures'
                      : 'ccuAdvice.warbondFigures',
                    [usd(option.price), usd(option.total), signed(option.discount)],
                  )
                }}
                <template v-if="option.kind === 'standard'">
                  {{ i18n.t('ccuAdvice.meltGivesBack', [usd(group.meltValue)]) }}
                  <span
                    :class="{
                      'is-warning': option.enoughStoreCredit === false,
                    }"
                  >
                    {{
                      option.storeCreditNeeded
                        ? storeCredit === undefined || settings.hideMeltValue
                          ? i18n.t('ccuAdvice.creditNeeded', [usd(option.storeCreditNeeded)])
                          : i18n.t('ccuAdvice.creditNeededHave', [
                              usd(option.storeCreditNeeded),
                              usd(storeCredit),
                            ])
                        : i18n.t('ccuAdvice.creditCovered')
                    }}
                  </span>
                </template>
                <!-- The space before it: line breaks between elements are dropped. -->
                <template v-if="option.gain !== undefined">
                  {{ ' '
                  }}<strong class="shm-ccu-advice-gain">{{
                    i18n.t('ccuAdvice.gain', [signed(option.gain)])
                  }}</strong>
                </template>
              </dd>
            </div>
          </dl>
          <p v-if="!group.options.length" class="shm-overlay-note">
            {{ i18n.t('ccuAdvice.noOptions', [group.target.name]) }}
          </p>
          <p
            v-if="group.giftable && group.options.length"
            class="shm-ccu-advice-warning"
            role="note"
          >
            <SvgIcon name="triangle-exclamation" />
            <span>{{
              i18n.t(group.giftable === 1 ? 'ccuAdvice.giftableOne' : 'ccuAdvice.giftable', [
                group.giftable,
                group.ccus.length,
              ])
            }}</span>
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
  padding-top: 2px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-ccu-advice .shm-ccu-advice-increase {
  margin: 0 0 10px;
}

.shm-ccu-advice .shm-ccu-advice-figures {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}

.shm-ccu-advice .shm-ccu-advice-figures dt {
  color: var(--shm-text-strong);
}

.shm-ccu-advice .shm-ccu-advice-figures dd {
  margin: 2px 0 0;
}

.shm-ccu-advice .shm-ccu-advice-gain {
  color: var(--shm-success);
  font-weight: inherit;
}

.shm-ccu-advice .is-warning {
  color: var(--shm-warning);
}

.shm-ccu-advice .shm-ccu-advice-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--shm-text);
}

.shm-ccu-advice .shm-ccu-advice-warning .shm-icon {
  flex: none;
  margin-top: 2px;
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
