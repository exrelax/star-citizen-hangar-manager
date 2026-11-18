<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import { computed } from 'vue';
import type { RemovalCcus } from '../removal-ccus';
// The shared, unscoped styles of the Pledge Store tab's tables.
import '@/store/components/store-table.css';

/**
 * The CCUs from and to a ship leaving the Pledge Store (#380), in the hangar and the buy back, as
 * #287 counts them: a CCU from the ship needs a ship to be applied to once the ship can't be bought
 * any more – one already owned, or one that a CCU to it gives. Below the table, whether there are
 * enough CCUs to the ship, or how many are missing and until when to secure them.
 */
const props = defineProps<{ entry: RemovalCcus }>();

const count = (list: RemovalCcus['from'], source?: 'hangar' | 'buyback') =>
  source ? list.filter((ccu) => ccu.source === source).length : list.length;
const rows = computed(() => [
  { key: 'from', label: i18n.t('shipRemovals.rowFrom'), list: props.entry.from },
  { key: 'to', label: i18n.t('shipRemovals.rowTo'), list: props.entry.to },
]);
/** A count; nothing for none, so the counts that matter stand out. */
const shown = (value: number) => (value ? String(value) : '–');

const ship = computed(() => props.entry.removal.ship.name);
const summary = computed(() => {
  const { from, to, level, removal } = props.entry;
  if (!from.length) return i18n.t('shipRemovals.summaryNoneFrom', [ship.value]);
  if (level === 'warning') return i18n.t('shipRemovals.summaryEnough', [ship.value]);
  const missing = from.length - to.length;
  return i18n.n('shipRemovals.summaryMissing', missing, [
    String(missing),
    ship.value,
    formatExpectedTime(removal.removedAt, locale.value),
  ]);
});
</script>

<template>
  <p v-if="!entry.from.length && !entry.to.length" class="shm-hint shm-removal-summary">
    {{ i18n.t('shipRemovals.summaryNone', [ship]) }}
  </p>
  <template v-else>
    <table class="shm-warbond-table shm-removal-table">
      <thead>
        <tr>
          <th scope="col" :aria-label="ship"></th>
          <th scope="col" class="is-number">{{ i18n.t('shipRemovals.colHangar') }}</th>
          <th scope="col" class="is-number">{{ i18n.t('shipRemovals.colBuyback') }}</th>
          <th scope="col" class="is-number is-group">{{ i18n.t('shipRemovals.colTogether') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td class="is-number" :class="{ 'is-none': !count(row.list, 'hangar') }">
            {{ shown(count(row.list, 'hangar')) }}
          </td>
          <td class="is-number" :class="{ 'is-none': !count(row.list, 'buyback') }">
            {{ shown(count(row.list, 'buyback')) }}
          </td>
          <td
            class="is-number is-group is-strong"
            :class="[
              { 'is-none': !count(row.list) },
              row.key === 'from' && entry.level ? `is-${entry.level}` : undefined,
            ]"
          >
            {{ shown(count(row.list)) }}
          </td>
        </tr>
      </tbody>
    </table>
    <!-- Red while CCUs to the ship are missing; "enough" is no warning. -->
    <p class="shm-hint shm-removal-summary" :class="{ 'is-critical': entry.level === 'critical' }">
      {{ summary }}
    </p>
  </template>
</template>

<style scoped>
/* The row labels like the table's other text, not like its column headings. */
.shm-removal-table tbody th {
  color: var(--shm-text);
  font-weight: normal;
}

.shm-removal-table td.is-warning {
  color: var(--shm-warning);
}

.shm-removal-table td.is-critical,
.shm-removal-summary.is-critical {
  color: var(--shm-danger);
}

.shm-removal-summary {
  margin: 4px 0 0;
}
</style>
