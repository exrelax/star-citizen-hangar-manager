<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n, locale } from '@/i18n';
import { computed, ref } from 'vue';
import { formatUsd } from '../discount-format';
import { shipsItem } from '@/ships/ships-storage';
import { createPriceLookup, shipPricesOf } from '../ship-prices';
import {
  ccuShips,
  loadUpgradeLog,
  totalDiscount,
  withPrices,
  type PricedUpgradeLogEntry,
} from '../upgrade-log';
import { vTooltip } from '@/shared/tooltip/tooltip';

const props = defineProps<{
  pledgeId: number;
  /** Purchase date as shown in the row: in the demo, the made-up CCU dates come after it. */
  createdAt?: string;
}>();
/** In the demo, the ids and dates of the applied CCUs are made up, too. */
const demo = useDemoContext();

const open = ref(false);
const entries = ref<PricedUpgradeLogEntry[]>();
const error = ref<string>();

/** Loads RSI's log on first opening (see `upgrade-log.ts`), with the original ship prices. */
async function toggle() {
  open.value = !open.value;
  if (!open.value || entries.value) return;
  error.value = undefined;
  try {
    // A generated demo pledge has a made-up log of its own (#176), never RSI's.
    const generated = demo.value?.generatedUpgradeLog?.(props.pledgeId);
    const [log, ships] = await Promise.all([
      generated ?? loadUpgradeLog(props.pledgeId),
      shipsItem.getValue(),
    ]);
    const shown = demo.value ? demo.value.upgradeLog(props.pledgeId, props.createdAt, log) : log;
    entries.value = withPrices(shown, createPriceLookup(shipPricesOf(ships)));
  } catch (failure) {
    console.error('[star-citizen-hangar-manager] Loading the upgrade log failed', failure);
    error.value = i18n.t('upgradeLog.failed', [
      failure instanceof Error ? failure.message : String(failure),
    ]);
  }
}

/** The discounts together: the pledge's discount against its current ship's price (#241). */
const total = computed(() => entries.value && totalDiscount(entries.value));
/** The first CCU's ships, for the note that its discount includes the base pledge. */
const firstShips = computed(() => entries.value?.[0] && ccuShips(entries.value[0].name));

const money = (value: number) => formatUsd(value, locale.value);
/** Green for a discount, orange for a surcharge; $0 is neither, so it stays plain. */
const discountClass = (value: number | undefined) =>
  !value ? undefined : value < 0 ? 'is-surcharge' : 'is-discount';
/** "+$5", "−$15": paid amounts are added, discounts taken off; nothing is just "$0". */
const signed = (value: number) =>
  value === 0 ? money(0) : `${value < 0 ? '−' : '+'}${money(Math.abs(value))}`;
// "Upgrade - Prowler to 600i Explorer Warbond Edition" → "Prowler to 600i Explorer Warbond Edition"
const shortName = (name: string) => name.replace(/^upgrade\s*-\s*/i, '');
</script>

<!-- The CCUs applied to an upgraded ship, a section of the expanded row that opens on its own. -->
<template>
  <section class="shm-upgrade-log">
    <button type="button" class="shm-upgrade-log-toggle" :aria-expanded="open" @click="toggle">
      <span class="shm-upgrade-log-chevron" aria-hidden="true">▸</span>
      {{ i18n.t('upgradeLog.title') }}
      <span v-if="entries" class="shm-upgrade-log-count">({{ entries.length }})</span>
    </button>
    <template v-if="open">
      <p v-if="error" class="shm-upgrade-log-note is-error" role="alert">{{ error }}</p>
      <p v-else-if="!entries" class="shm-upgrade-log-note">{{ i18n.t('upgradeLog.loading') }}</p>
      <p v-else-if="!entries.length" class="shm-upgrade-log-note">
        {{ i18n.t('upgradeLog.empty') }}
      </p>
      <table v-else class="shm-upgrade-log-entries">
        <thead>
          <tr>
            <th>{{ i18n.t('upgradeLog.date') }}</th>
            <th>{{ i18n.t('upgradeLog.upgrade') }}</th>
            <th v-tooltip="i18n.t('upgradeLog.targetPriceHint')" class="is-amount">
              {{ i18n.t('upgradeLog.targetPrice') }}
            </th>
            <th v-tooltip="i18n.t('upgradeLog.valueAfterHint')" class="is-amount shm-value">
              {{ i18n.t('upgradeLog.valueAfter') }}
            </th>
            <th v-tooltip="i18n.t('upgradeLog.paidHint')" class="is-amount shm-value">
              {{ i18n.t('upgradeLog.paid') }}
            </th>
            <th v-tooltip="i18n.t('upgradeLog.discountHint')" class="is-amount shm-value">
              {{ i18n.t('upgradeLog.discount') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in entries" :key="index">
            <td class="shm-upgrade-log-date">{{ entry.appliedAt }}</td>
            <td>
              {{ shortName(entry.name) }}
              <span v-if="entry.ccuId" class="shm-upgrade-log-id shm-pledge-id"
                >#{{ demo ? demo.fakeId(entry.ccuId) : entry.ccuId }}</span
              >
            </td>
            <td class="is-amount">
              <template v-if="entry.targetPrice !== undefined">
                {{ money(entry.targetPrice) }}
              </template>
            </td>
            <td class="is-amount shm-value">
              <template v-if="entry.valueAfter !== undefined">{{
                money(entry.valueAfter)
              }}</template>
            </td>
            <td class="is-amount is-paid shm-value">
              <template v-if="entry.added !== undefined">{{ signed(entry.added) }}</template>
            </td>
            <td
              v-tooltip="entry.withBase && i18n.t('upgradeLog.withBaseHint')"
              class="is-amount shm-value"
              :class="discountClass(entry.discount)"
            >
              <template v-if="entry.discount !== undefined"
                >{{ signed(-entry.discount) }}<sup v-if="entry.withBase">*</sup></template
              >
            </td>
          </tr>
        </tbody>
        <!-- The discounts together: the row's discount (#241). -->
        <tfoot v-if="total !== undefined" class="shm-value">
          <tr>
            <th colspan="5">{{ i18n.t('upgradeLog.total') }}</th>
            <td class="is-amount" :class="discountClass(total)">
              {{ signed(-total) }}
            </td>
          </tr>
        </tfoot>
      </table>
      <p
        v-if="entries?.length && entries[0]!.discount !== undefined"
        class="shm-upgrade-log-note shm-value"
      >
        *
        {{ i18n.t('upgradeLog.withBase', [firstShips?.to ?? '', firstShips?.from ?? '']) }}
      </p>
      <p v-else-if="entries?.length" class="shm-upgrade-log-note shm-value">
        {{ i18n.t('upgradeLog.withBaseUnknown') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.shm-upgrade-log {
  margin-top: 8px;
}

.shm-upgrade-log-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  color: var(--shm-accent);
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-upgrade-log-toggle:hover,
.shm-upgrade-log-toggle:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-upgrade-log-chevron {
  display: inline-block;
  transition: transform 0.15s;
}

[aria-expanded='true'] > .shm-upgrade-log-chevron {
  transform: rotate(90deg);
}

.shm-upgrade-log-count {
  color: var(--shm-text-muted);
}

.shm-upgrade-log-note {
  margin: 4px 0 0;
  color: var(--shm-text-muted);
}

.shm-upgrade-log-note.is-error {
  color: var(--shm-danger);
}

.shm-upgrade-log-entries {
  width: 100%;
  margin-top: 4px;
  border-collapse: collapse;
}

.shm-upgrade-log-entries th,
.shm-upgrade-log-entries td {
  padding: 3px 0 3px 12px;
  text-align: left;
  vertical-align: top;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-upgrade-log-entries :is(th, td):first-child {
  padding-left: 0;
  white-space: nowrap;
}

.shm-upgrade-log-entries th {
  color: var(--shm-text-muted);
  font-weight: normal;
  border-top: 0;
}

.shm-upgrade-log-entries tfoot th {
  color: var(--shm-text);
  text-align: right;
}

.shm-upgrade-log-entries tfoot :is(th, td) {
  border-top-color: rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-upgrade-log-entries .is-amount {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.shm-upgrade-log-date {
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}

.shm-upgrade-log-id {
  margin-left: 6px;
  color: var(--shm-text-muted);
}

/* What was really spent in orange, the discount in green (like the discount in the row). */
td.is-paid {
  color: var(--shm-warning);
}

td.is-discount {
  color: var(--shm-success);
}

td.is-surcharge {
  color: var(--shm-warning);
}

@media (prefers-reduced-motion: reduce) {
  .shm-upgrade-log-chevron {
    transition: none;
  }
}
</style>
