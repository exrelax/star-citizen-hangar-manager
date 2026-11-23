<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { HIDDEN } from '@/orders/orders';
import { openCcuAdvice } from '@/price-increases/ccu-advice-request';
import CcuShips from '@/price-increases/components/CcuShips.vue';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { openCcusToSecure } from '@/store/open-current-warbonds';
import { computed } from 'vue';
import type { AtRiskRow, DiscountAtRisk } from '../discount-at-risk';

/*
 * The tab "Discount at risk" of the CCU Consultant (#455), in both views (#563): the CCUs whose base
 * ship rises in price, confirmed and expected apart, with the Price Increase Advisor's advice and
 * its "Keep the discount" dialog.
 */

const props = defineProps<{
  settings: Settings;
  atRisk: DiscountAtRisk;
  /** The store credit known, for the advice. */
  storeCredit?: number;
  /** The current time, for the countdowns. */
  clock: number;
}>();

const number = computed(() => new Intl.NumberFormat(locale.value));
const format = (value: number) => number.value.format(value);
const usd = (value: number) =>
  props.settings.hideMeltValue ? HIDDEN : formatUsd(value, locale.value);
/** "−$145" for a negative amount, else "$620". */
const money = (value: number) =>
  props.settings.hideMeltValue
    ? HIDDEN
    : `${value < 0 ? '−' : ''}${formatUsd(Math.abs(value), locale.value)}`;

const sections = computed(() =>
  [
    {
      id: 'confirmed' as const,
      rows: props.atRisk.confirmed,
      count: props.atRisk.confirmed.reduce((sum, row) => sum + row.group.ccus.length, 0),
    },
    {
      id: 'expected' as const,
      rows: props.atRisk.expected,
      count: props.atRisk.expected.reduce((sum, row) => sum + row.group.ccus.length, 0),
    },
  ].filter((section) => section.rows.length),
);

const baseName = (row: AtRiskRow) => row.group.base?.name ?? row.group.increase.ship.name;
const increaseText = (row: AtRiskRow) => {
  const { increase } = row.group;
  const when = formatExpectedTime(increase.priceIncreaseAt, locale.value);
  const price = increase.price
    ? i18n.t('ccuAdvice.eventPrice', [
        baseName(row),
        usd(increase.price.from),
        usd(increase.price.to),
      ])
    : i18n.t('ccuAdvice.eventUnknown', [baseName(row)]);
  return `${price} · ${i18n.t(
    increase.confirmed ? 'ccuAdvice.eventWhenConfirmed' : 'ccuAdvice.eventWhen',
    [when],
  )}`;
};
/** What the Price Increase Advisor recommends, in short (#252). */
const adviceText = (row: AtRiskRow) => {
  const { group } = row;
  if (group.switch) {
    const plan = group.switch;
    return i18n.t('ccuConsultant.atRisk.swap', [
      format(group.ccus.length),
      plan.from.name,
      plan.to.name,
      usd(plan.total),
      formatExpectedTime(group.increase.priceIncreaseAt, locale.value),
    ]);
  }
  if (group.noSwitch === 'notSold') return i18n.t('ccuAdvice.notSold', [baseName(row)]);
  if (group.noSwitch === 'keepIsBetter') return i18n.t('ccuAdvice.keepIsBetter', [baseName(row)]);
  return i18n.t('ccuAdvice.riseUnknown', [
    baseName(row),
    formatExpectedTime(group.increase.priceIncreaseAt, locale.value),
  ]);
};
const creditText = (row: AtRiskRow) => {
  const plan = row.group.switch;
  if (!plan) return undefined;
  if (!plan.storeCreditNeeded) return i18n.t('ccuAdvice.creditCovered');
  return props.storeCredit === undefined || props.settings.hideMeltValue
    ? i18n.t('ccuAdvice.creditNeeded', [usd(plan.storeCreditNeeded)])
    : i18n.t('ccuAdvice.creditNeededHave', [usd(plan.storeCreditNeeded), usd(props.storeCredit)]);
};
const giftableText = (row: AtRiskRow) => {
  const { giftable, ccus } = row.group;
  if (ccus.length === 1) return i18n.t('ccuAdvice.giftableSingle');
  if (giftable === ccus.length) return i18n.t('ccuAdvice.giftableAll', [format(giftable)]);
  return i18n.n('ccuAdvice.giftable', giftable, [format(giftable), format(ccus.length)]);
};
</script>

<template>
  <div class="shm-ccu-consultant-view">
    <div v-if="!atRisk.count" class="shm-ccu-consultant-empty is-missing">
      <SvgIcon name="circle-check" />
      <span>
        <strong>{{ i18n.t('ccuConsultant.atRisk.empty') }}</strong>
        {{
          i18n.n('ccuConsultant.atRisk.emptyText', settings.priceIncreaseDays, [
            format(settings.priceIncreaseDays),
          ])
        }}
      </span>
    </div>
    <template v-for="section in sections" :key="section.id">
      <h5 :id="`shm-ccu-consultant-atRisk-${section.id}`" class="shm-ccu-consultant-soon-title">
        {{ i18n.t(`ccuConsultant.atRisk.${section.id}`) }}
        <span class="shm-ccu-consultant-soon-count">{{ format(section.count) }}</span>
      </h5>
      <div class="shm-ccu-consultant-table">
        <table
          class="shm-warbond-table"
          :aria-labelledby="`shm-ccu-consultant-atRisk-${section.id}`"
        >
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('ccuAdvice.colCcu') }}</th>
              <th scope="col">{{ i18n.t('ccuConsultant.atRisk.colIncrease') }}</th>
              <th scope="col">{{ i18n.t('ccuConsultant.atRisk.colDiscount') }}</th>
              <th scope="col">{{ i18n.t('ccuAdvice.howTitle') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in section.rows"
              :key="`${row.group.increase.ship.id}>${row.group.target.id}`"
            >
              <td>
                <span class="shm-ccu-consultant-atrisk-ccu">
                  <CcuShips :from="row.group.base" :to="row.group.target" />
                  <span>
                    <span class="shm-ccu-consultant-ship">
                      {{ i18n.t('ccuAdvice.ccuName', [baseName(row), row.group.target.name]) }}
                    </span>
                    <span class="shm-ccu-consultant-meta">
                      {{
                        i18n.n('ccuConsultant.atRisk.ccus', row.group.ccus.length, [
                          format(row.group.ccus.length),
                          usd(row.group.meltValue),
                        ])
                      }}
                    </span>
                  </span>
                </span>
              </td>
              <td>
                <span
                  v-tooltip="formatExpectedTime(row.group.increase.priceIncreaseAt, locale)"
                  class="shm-badge is-price-increase is-warning"
                  tabindex="0"
                >
                  {{ countdown(row.group.increase.priceIncreaseAt, clock, locale) }}
                </span>
                <span class="shm-ccu-consultant-meta">{{ increaseText(row) }}</span>
                <a
                  v-if="row.group.increase.source"
                  class="shm-ccu-consultant-store"
                  :href="row.group.increase.source"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ i18n.t('priceIncrease.source') }}
                  <SvgIcon name="square-up-right" />
                </a>
              </td>
              <td>
                <template v-if="row.group.keep">
                  <span class="shm-ccu-consultant-meta">
                    {{
                      i18n.t('ccuConsultant.atRisk.discount', [
                        money(row.group.keep.discountNow),
                        money(row.group.keep.discountAfter),
                      ])
                    }}
                  </span>
                  <span class="shm-ccu-consultant-cover is-missing is-short">
                    <SvgIcon name="triangle-exclamation" />
                    {{ i18n.t('ccuConsultant.atRisk.loss', [usd(row.loss ?? 0)]) }}
                  </span>
                </template>
                <template v-else>
                  <span v-if="row.group.discountNow !== undefined" class="shm-ccu-consultant-meta">
                    {{ i18n.t('ccuConsultant.atRisk.discountNow', [money(row.group.discountNow)]) }}
                  </span>
                  <span class="shm-ccu-consultant-cover is-buyback">
                    {{ i18n.t('ccuAdvice.mayBeLost') }}
                  </span>
                </template>
              </td>
              <td>
                <span class="shm-ccu-consultant-advice">{{ adviceText(row) }}</span>
                <span v-if="creditText(row)" class="shm-ccu-consultant-meta">{{
                  creditText(row)
                }}</span>
                <span v-if="row.group.giftable" class="shm-ccu-consultant-meta">
                  {{ giftableText(row) }}
                </span>
                <span class="shm-ccu-consultant-actions">
                  <button
                    v-tooltip="i18n.t('ccuAdvice.buttonHint')"
                    type="button"
                    class="shm-ccu-consultant-more"
                    @click="openCcuAdvice(row.group.ccus[0]!.id)"
                  >
                    {{ i18n.t('ccuAdvice.button') }}
                  </button>
                  <button
                    v-if="row.group.switch"
                    v-tooltip="i18n.t('ccuConsultant.atRisk.secureHint')"
                    type="button"
                    class="shm-ccu-consultant-more"
                    @click="openCcusToSecure()"
                  >
                    {{ i18n.t('ccuConsultant.atRisk.secure') }}
                  </button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
