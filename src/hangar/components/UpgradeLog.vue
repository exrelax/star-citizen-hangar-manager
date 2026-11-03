<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n, locale } from '@/i18n';
import { ref } from 'vue';
import { formatUsd } from '../discount-format';
import { shipPricesItem } from '../hangar-storage';
import { createPriceLookup } from '../ship-prices';
import { loadUpgradeLog, withPrices, type PricedUpgradeLogEntry } from '../upgrade-log';

const props = defineProps<{ pledgeId: number }>();
/** In the demo, the ids of the applied CCUs are made up, too. */
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
    const [log, prices] = await Promise.all([
      loadUpgradeLog(props.pledgeId),
      shipPricesItem.getValue(),
    ]);
    entries.value = withPrices(log, createPriceLookup(prices?.ships ?? []));
  } catch (failure) {
    console.error('[sc-hangar-manager] Loading the upgrade log failed', failure);
    error.value = i18n.t('upgradeLog.failed', [
      failure instanceof Error ? failure.message : String(failure),
    ]);
  }
}

const money = (value: number) => formatUsd(value, locale.value);
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
            <th class="is-amount" :title="i18n.t('upgradeLog.targetPriceHint')">
              {{ i18n.t('upgradeLog.targetPrice') }}
            </th>
            <th class="is-amount shm-value" :title="i18n.t('upgradeLog.valueAfterHint')">
              {{ i18n.t('upgradeLog.valueAfter') }}
            </th>
            <th class="is-amount shm-value" :title="i18n.t('upgradeLog.paidHint')">
              {{ i18n.t('upgradeLog.paid') }}
            </th>
            <th class="is-amount shm-value" :title="i18n.t('upgradeLog.discountHint')">
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
              class="is-amount shm-value"
              :class="entry.discount! < 0 ? 'is-surcharge' : 'is-discount'"
            >
              <template v-if="entry.discount !== undefined">{{ signed(-entry.discount) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
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
  color: #62c4eb;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-upgrade-log-toggle:hover,
.shm-upgrade-log-toggle:focus-visible {
  color: #fff;
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
  color: #8a9ba8;
}

.shm-upgrade-log-note {
  margin: 4px 0 0;
  color: #8a9ba8;
}

.shm-upgrade-log-note.is-error {
  color: #ff8a80;
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
  border-top: 1px solid rgba(98, 196, 235, 0.08);
}

.shm-upgrade-log-entries :is(th, td):first-child {
  padding-left: 0;
  white-space: nowrap;
}

.shm-upgrade-log-entries th {
  color: #8a9ba8;
  font-weight: normal;
  border-top: 0;
}

.shm-upgrade-log-entries .is-amount {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.shm-upgrade-log-date {
  color: #8a9ba8;
  font-variant-numeric: tabular-nums;
}

.shm-upgrade-log-id {
  margin-left: 6px;
  color: #8a9ba8;
}

/* What was really spent in orange, the discount in green (like the discount in the row). */
td.is-paid {
  color: #f0b45a;
}

td.is-discount {
  color: #7fd88b;
}

td.is-surcharge {
  color: #f0b45a;
}

@media (prefers-reduced-motion: reduce) {
  .shm-upgrade-log-chevron {
    transition: none;
  }
}
</style>
