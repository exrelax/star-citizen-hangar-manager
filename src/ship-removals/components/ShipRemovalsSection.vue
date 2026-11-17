<script setup lang="ts">
import { i18n, locale, translate } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';
import type { Ship } from '@/ships/ships';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import { removalsByDate, type ShipRemoval } from '../ship-removals';

/*
 * The ships CIG takes out of the Pledge Store for good (#288, part of Ship Removals #285), in the
 * Pledge Store tab: grouped by date, each ship with the date, a countdown (as the price increases'
 * badges, #195) and the source of the announcement. Built from the rows of the manager's lists, so
 * it fits every theme; nothing to expand. Notifications open the tab at its title
 * (`shm-store-removals-title`).
 */

const props = defineProps<{
  removals: readonly ShipRemoval[];
  /** The upgrade tool's ships, for their images. */
  ships: readonly Ship[];
}>();

const now = useCountdownNow(() => props.removals.map((removal) => removal.removedAt));
const groups = computed(() => removalsByDate(props.removals, now.value));
const imageOf = computed(() => new Map(props.ships.map((ship) => [ship.id, ship.image])));

const when = (removal: ShipRemoval) => formatExpectedTime(removal.removedAt, locale.value);
const label = (removal: ShipRemoval) =>
  translate(locale.value, 'shipRemovals.label', [
    countdown(removal.removedAt, now.value, locale.value),
  ]);
const hint = (removal: ShipRemoval) =>
  `${translate(locale.value, 'shipRemovals.hint', [removal.ship.name, when(removal)])}\n${translate(
    locale.value,
    'shipRemovals.announced',
  )}`;
</script>

<template>
  <section
    v-if="groups.length"
    class="shm-store-removals"
    aria-labelledby="shm-store-removals-title"
  >
    <h3 id="shm-store-removals-title" class="shm-store-title">
      {{ i18n.t('shipRemovals.title') }}
    </h3>
    <p class="shm-store-intro">{{ i18n.t('shipRemovals.intro') }}</p>

    <section
      v-for="group in groups"
      :key="`${group.removedAt.at}${group.removedAt.dayOnly ? 'd' : ''}`"
      class="shm-removal-date"
    >
      <h4 class="shm-warbond-heading">
        {{
          i18n.n('shipRemovals.date', group.removals.length, [
            formatExpectedTime(group.removedAt, locale),
            group.removals.length,
          ])
        }}
      </h4>
      <div class="shm-rows">
        <article
          v-for="removal in group.removals"
          :key="removal.ship.id"
          class="shm-row shm-removal"
        >
          <div class="shm-row-summary">
            <span class="shm-thumb">
              <img
                v-if="imageOf.get(removal.ship.id)"
                :src="imageOf.get(removal.ship.id)"
                alt=""
                loading="lazy"
                decoding="async"
                width="128"
                height="72"
              />
            </span>
            <span class="shm-main">
              <span class="shm-title">{{ removal.ship.name }}</span>
              <span class="shm-removal-note">
                {{ i18n.t('shipRemovals.announcedBy') }} ·
                <a
                  class="shm-removal-source"
                  :href="removal.source"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ i18n.t('priceIncrease.source') }} <SvgIcon name="square-up-right"
                /></a>
              </span>
            </span>
            <span class="shm-badges">
              <span
                v-tooltip="hint(removal)"
                class="shm-badge is-price-increase is-warning"
                tabindex="0"
              >
                {{ label(removal) }}
              </span>
            </span>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
/* Clearly apart from the sections above, like the CCUs to secure. */
.shm-store-removals {
  margin-top: 32px;
}

.shm-store-removals .shm-store-intro {
  margin-bottom: 4px;
}

/* Nothing to open: no pointer, no hover. */
.shm-removal .shm-row-summary {
  cursor: default;
}

.shm-removal .shm-row-summary:hover {
  background: none;
}

/* Plain text, not the monospace of the meta lines (IDs, prices, dates). */
.shm-removal-note {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-removal-source {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-removal-source:hover,
.shm-removal-source:focus-visible {
  text-decoration: underline;
}

/* As the warbond CCUs' heading (WarbondRow.vue); Modern Hangar adjusts it in modern.css. */
.shm-warbond-heading {
  margin: 14px 0 6px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}
</style>
