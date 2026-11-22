<script setup lang="ts">
import { hangarFilterStates } from '@/hangar/hangar-filter-request';
import { listViewRequest, openPledgeInList, takeExpand, urlOfView } from '@/hangar/list-jump';
import { searchFromUrl } from '@/hangar/route';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref, watch } from 'vue';
import {
  useProvidedCoverageSources,
  type CcuCoverage,
  type CoverageMatch,
  type CoverageSource,
} from '../coverage';
import { coverageCard, type CardPledge } from '../coverage-card';
import CoverageCardView from './CoverageCardView.vue';

/*
 * What gives a CCU's base ship (#111), a section of the expanded CCU row like "Applied upgrades":
 * collapsed the counts in the hangar and the buy back, expanded the pledges – ships and CCUs to the
 * base ship – each opening it in "My Hangar" or "Buy Back", searched by its id (#436; in the demo
 * its made-up one). On every CCU, covered or not (#108). On a group of CCUs (#574) for all of
 * them: how many of the group get the base ship (`ofGroup`, see `group-coverage.ts`).
 */

const props = defineProps<{
  coverage: CcuCoverage;
  /** A group of CCUs (#574): how many of them are covered. */
  ofGroup?: { covered: number; total: number };
}>();

const { settings } = useSettings();
const open = ref(false);
// Back to the list it was opened from (#436): open again.
watch(listViewRequest, () => takeExpand(props.coverage.id, 'coverage') && (open.value = true), {
  immediate: true,
});

const number = computed(() => new Intl.NumberFormat(locale.value));
const groups = computed(() =>
  (['hangar', 'buyback'] as const).map((source) => ({
    source,
    matches: [...props.coverage[source].ships, ...props.coverage[source].ccus],
  })),
);
const count = (source: CoverageSource) =>
  groups.value.find((group) => group.source === source)!.matches.length;
const summary = computed(() => {
  if (!props.coverage.covered) return i18n.t('ccuCoverage.none');
  const counts = i18n.t('ccuCoverage.summary', [
    number.value.format(count('hangar')),
    number.value.format(count('buyback')),
  ]);
  return props.ofGroup
    ? i18n.t('ccuCoverage.groupSummary', [
        number.value.format(props.ofGroup.covered),
        number.value.format(props.ofGroup.total),
        counts,
      ])
    : counts;
});
/** Not every CCU gets the base ship: none, or not all of a group. */
const short = computed(
  () => !props.coverage.covered || (!!props.ofGroup && props.ofGroup.covered < props.ofGroup.total),
);

const sources = useProvidedCoverageSources();
/** The card of an entry on hover and focus (#426), its title and id as the description. */
function tooltipOf(match: CoverageMatch) {
  const text = `${match.title} #${idOf(match)}`;
  const pledge =
    match.source === 'hangar'
      ? sources.value.hangar.get(match.id)
      : sources.value.buyback.get(match.id);
  if (!pledge) return text;
  const entry = { source: match.source, pledge } as CardPledge;
  return {
    text,
    card: {
      component: CoverageCardView,
      props: { match, card: coverageCard(match, entry, sources.value.ships) },
    },
  };
}

const idOf = (match: CoverageMatch) =>
  settings.value.hidePledgeIds ? HIDDEN : (match.displayId ?? match.id);
/** What the list finds the pledge by: its id, in the demo its made-up one. */
const termOf = (match: CoverageMatch) => String(match.displayId ?? match.id);
/** The pledge in "My Hangar" or "Buy Back", searched by its id (#436). */
const hrefOf = (match: CoverageMatch) =>
  urlOfView(location.href, { tab: match.source, search: termOf(match) });

/**
 * Opens the pledge in its list; Back returns to this CCU row as it is now (the list's search and
 * filters, the row expanded with this section open). A new tab or window opens the link itself.
 */
function openMatch(event: MouseEvent, match: CoverageMatch) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  openPledgeInList(match.source, termOf(match), {
    tab: 'hangar',
    search: searchFromUrl(location.search),
    filters: [...hangarFilterStates.value],
    expand: props.coverage.id,
  });
}
</script>

<template>
  <section class="shm-upgrade-log shm-ccu-coverage">
    <button
      type="button"
      class="shm-upgrade-log-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="shm-upgrade-log-chevron" aria-hidden="true">▸</span>
      {{ i18n.t('ccuCoverage.title') }}
      <span class="shm-upgrade-log-count" :class="{ 'is-missing': short }">{{ summary }}</span>
    </button>
    <template v-if="open">
      <p v-if="!coverage.covered" class="shm-upgrade-log-note">
        {{
          i18n.t('ccuCoverage.empty', [coverage.baseShip?.name ?? i18n.t('ccuCoverage.baseShip')])
        }}
      </p>
      <template v-for="group in groups" :key="group.source">
        <div v-if="group.matches.length" class="shm-ccu-coverage-group">
          <h4>{{ i18n.t(`ccuCoverage.${group.source}`) }}</h4>
          <ul>
            <li
              v-for="match in group.matches"
              :key="`${match.kind}-${match.id}`"
              v-tooltip="tooltipOf(match)"
            >
              <span class="shm-ccu-coverage-kind" :class="`is-${match.kind}`">
                {{ i18n.t(`ccuCoverage.kinds.${match.kind}`) }}
              </span>
              <a
                class="shm-ccu-coverage-title"
                :href="hrefOf(match)"
                @click="openMatch($event, match)"
                >{{ match.title }}</a
              >
              <span class="shm-upgrade-log-id shm-pledge-id">#{{ idOf(match) }}</span>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
/* Laid out like "Applied upgrades" (UpgradeLog.vue), whose classes it shares. */
.shm-upgrade-log {
  margin-top: 8px;
}

.shm-upgrade-log-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  color: var(--shm-accent);
  font: inherit;
  text-align: left;
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

.shm-upgrade-log-count.is-missing {
  color: var(--shm-warning);
}

.shm-upgrade-log-note {
  margin: 4px 0 0;
  color: var(--shm-text-muted);
}

.shm-upgrade-log-id {
  margin-left: 6px;
  color: var(--shm-text-muted);
}

.shm-ccu-coverage-group {
  margin-top: 6px;
}

.shm-ccu-coverage-group h4 {
  margin: 0 0 2px;
  color: var(--shm-text-muted);
  font-size: inherit;
  font-weight: normal;
}

.shm-ccu-coverage-group ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-ccu-coverage-group li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  padding: 3px 0;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-ccu-coverage-kind {
  flex: none;
  min-width: 3.5em;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-ccu-coverage-title {
  min-width: 0;
  color: var(--shm-text);
  text-decoration: none;
}

a.shm-ccu-coverage-title:hover,
a.shm-ccu-coverage-title:focus-visible {
  color: var(--shm-accent);
  text-decoration: underline;
}

@media (prefers-reduced-motion: reduce) {
  .shm-upgrade-log-chevron {
    transition: none;
  }
}
</style>
