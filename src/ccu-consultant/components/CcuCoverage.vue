<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { buybackHref, myGearHref } from '@/hangar/route';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import type { CcuCoverage, CoverageMatch, CoverageSource } from '../coverage';

/*
 * What gives a CCU's base ship (#111), a section of the expanded CCU row like "Applied upgrades":
 * collapsed the counts in the hangar and the buy back, expanded the pledges – ships and CCUs to the
 * base ship – each with a link to it in "My Gear" or the buy back. On every CCU, covered or not
 * (#108). In the demo the links stay inert: they would reveal the real ids.
 */

const props = defineProps<{ coverage: CcuCoverage }>();

const { settings } = useSettings();
const demo = useDemoContext();
const open = ref(false);
const pathname = location.pathname;

const number = computed(() => new Intl.NumberFormat(locale.value));
const groups = computed(() =>
  (['hangar', 'buyback'] as const).map((source) => ({
    source,
    matches: [...props.coverage[source].ships, ...props.coverage[source].ccus],
  })),
);
const count = (source: CoverageSource) =>
  groups.value.find((group) => group.source === source)!.matches.length;
const summary = computed(() =>
  props.coverage.covered
    ? i18n.t('ccuCoverage.summary', [
        number.value.format(count('hangar')),
        number.value.format(count('buyback')),
      ])
    : i18n.t('ccuCoverage.none'),
);

const idOf = (match: CoverageMatch) =>
  settings.value.hidePledgeIds ? HIDDEN : (match.displayId ?? match.id);
/** The pledge in "My Gear" or the buy back, as the rows link to it; none in the demo. */
function hrefOf(match: CoverageMatch): string | undefined {
  if (demo.value || match.page === undefined) return undefined;
  if (match.source === 'hangar') return myGearHref(pathname, match.page, match.id);
  return settings.value.buybackLinkMode === 'single' && match.position !== undefined
    ? buybackHref(pathname, match.position + 1, match.id, 1)
    : buybackHref(pathname, match.page, match.id);
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
      <span class="shm-upgrade-log-count" :class="{ 'is-missing': !coverage.covered }">{{
        summary
      }}</span>
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
            <li v-for="match in group.matches" :key="`${match.kind}-${match.id}`">
              <span class="shm-ccu-coverage-kind" :class="`is-${match.kind}`">
                {{ i18n.t(`ccuCoverage.kinds.${match.kind}`) }}
              </span>
              <a
                v-if="hrefOf(match)"
                v-tooltip="i18n.t(`ccuCoverage.show.${match.source}`)"
                class="shm-ccu-coverage-title"
                :href="hrefOf(match)"
                >{{ match.title }}</a
              >
              <span v-else class="shm-ccu-coverage-title">{{ match.title }}</span>
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
