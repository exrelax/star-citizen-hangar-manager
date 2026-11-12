<script setup lang="ts">
import { formatPercent } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { ReboughtPaint } from '../paint-consultant/calculation';

/*
 * Paints that look bought again without a kept plan of the Paint Discount Consultant (setting
 * "Paints bought again": also guess, #139): only shown to check, nothing is done with them. Above
 * the plan in the "ways" and table layouts; at the end, below the plan, with a warning icon when
 * choosing a way (`end`, #246).
 */

defineProps<{ pairs: readonly ReboughtPaint[]; end?: boolean }>();

const percent = (value: number) => formatPercent(value, locale.value);
</script>

<template>
  <div
    class="shm-consultant-note is-info shm-probably-rebought"
    :class="{ 'is-end': end }"
    role="note"
  >
    <SvgIcon v-if="end" name="triangle-exclamation" />
    <div>
      <p>
        {{
          pairs.length === 1
            ? i18n.t('consultant.probablyReboughtOne')
            : i18n.t('consultant.probablyRebought', [pairs.length])
        }}
      </p>
      <ul>
        <li v-for="{ old, copy } in pairs" :key="old.pledgeId">
          {{
            i18n.t('consultant.probablyReboughtItem', [
              old.storePaint.name,
              percent(old.discount),
              percent(copy.discount),
              copy.boughtOn ?? '–',
            ])
          }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
/* At the end: one quiet line with its icon, as the last thing of the consultant. */
.shm-probably-rebought.is-end {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 20px;
}

.shm-probably-rebought.is-end .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-warning);
}

/* Quiet as the rest of the line: RSI's own styles color and space paragraphs and lists. */
.shm-consultant .shm-probably-rebought.is-end p,
.shm-consultant .shm-probably-rebought.is-end ul,
.shm-consultant .shm-probably-rebought.is-end li {
  margin: 0;
  padding: 0;
  color: inherit;
  font-size: inherit;
  line-height: 1.5;
  list-style: none;
}
</style>
