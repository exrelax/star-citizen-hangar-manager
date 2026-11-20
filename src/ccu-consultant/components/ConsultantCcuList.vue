<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { pledgeGroupBadges } from '@/hangar/group-badges';
import { groupItems, pledgeFacts, type GroupSum, type ItemGroup } from '@/hangar/grouping';
import { openPledgeInList, urlOfView } from '@/hangar/list-jump';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';

/*
 * The CCUs from a base ship in the CCU Consultant (#456), below its row once opened: grouped
 * (#446) – the same CCUs as one entry with their count, the sums of value and discount and the
 * labels of all, some or none of them (#448) – or each on its own. An entry opens My Hangar: a
 * single CCU by its id (#436), a group searched by its ships, where the grouped view shows it as
 * one row.
 */

const props = defineProps<{
  /** The CCUs' pledges, in the hangar's order. */
  ccus: readonly PledgeView[];
  grouped: boolean;
  hideValues: boolean;
  hideIds: boolean;
}>();

const groups = computed((): ItemGroup<PledgeView>[] =>
  props.grouped
    ? groupItems(props.ccus, pledgeFacts).sort(
        (a, b) => b.count - a.count || a.items[0]!.title.localeCompare(b.items[0]!.title),
      )
    : props.ccus.map((ccu) => groupItems([ccu], pledgeFacts)[0]!),
);

const usd = (value: number) => (props.hideValues ? HIDDEN : formatUsd(value, locale.value));
const sumText = (sum: GroupSum) =>
  sum.unknown && !props.hideValues
    ? i18n.n('group.sumUnknown', sum.unknown, [usd(sum.total), sum.unknown])
    : usd(sum.total);

/** What My Hangar finds the entry by: a CCU's id, a group's ships ("Cutlass Red to Prowler"). */
function termOf(group: ItemGroup<PledgeView>): string {
  const first = group.items[0]!;
  if (group.count === 1) return String(first.displayId ?? first.id);
  const from = first.upgrade?.matchItems[0]?.name;
  const to = first.upgrade?.targetItems[0]?.name;
  return from && to ? `${from} to ${to}` : first.title;
}
const hrefOf = (group: ItemGroup<PledgeView>) =>
  urlOfView(location.href, { tab: 'hangar', search: termOf(group) });
function open(event: MouseEvent, group: ItemGroup<PledgeView>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  openPledgeInList('hangar', termOf(group));
}
const idOf = (ccu: PledgeView) => (props.hideIds ? HIDDEN : (ccu.displayId ?? ccu.id));
</script>

<template>
  <ul class="shm-consultant-ccus">
    <li v-for="group in groups" :key="group.count === 1 ? group.items[0]!.id : group.key">
      <a
        v-tooltip="
          group.count === 1 ? i18n.t('ccuConsultant.openHangar') : i18n.t('ccuConsultant.openGroup')
        "
        class="shm-consultant-ccu-name"
        :href="hrefOf(group)"
        @click="open($event, group)"
        >{{ group.items[0]!.title }}</a
      >
      <span v-if="group.count > 1" class="shm-group-count">×{{ group.count }}</span>
      <span v-else class="shm-pledge-id">#{{ idOf(group.items[0]!) }}</span>
      <span class="shm-consultant-ccu-meta">
        <span class="shm-value">{{ sumText(group.value) }}</span>
        <span v-if="group.discount.total > 0" class="shm-discount">
          −{{ sumText(group.discount) }}
        </span>
      </span>
      <span class="shm-badges">
        <span
          v-for="badge in pledgeGroupBadges(group)"
          :key="badge.key"
          v-tooltip="badge.hint"
          class="shm-badge"
          :class="[badge.className, { 'is-off': badge.off }]"
        >
          {{ badge.text }}
        </span>
      </span>
    </li>
  </ul>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
.shm-consultant-ccus {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-consultant-ccus li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: calc(13px * var(--shm-font-scale));
}

.shm-consultant-ccu-name {
  color: var(--shm-text);
  text-decoration: none;
}

.shm-consultant-ccu-name:hover,
.shm-consultant-ccu-name:focus-visible {
  color: var(--shm-accent);
  text-decoration: underline;
}

.shm-consultant-ccus .shm-pledge-id,
.shm-consultant-ccu-meta {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-consultant-ccu-meta {
  display: inline-flex;
  gap: 8px;
}

.shm-consultant-ccus .shm-badges {
  gap: 4px;
}
</style>
