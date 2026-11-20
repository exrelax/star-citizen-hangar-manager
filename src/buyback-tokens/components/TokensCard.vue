<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { localized } from '@/site-data/site-data';
import { computed } from 'vue';
import { renewalSentence } from '../renewal-text';
import type { TokenRenewal } from '../token-renewals';

/*
 * The tooltip of the buy back tokens at the top right (#434), as an interactive card: the count
 * and its explanation as before, and the next date RSI renews the tokens – announced or estimated
 * – with the note and a link to its source.
 */

const props = defineProps<{ label: string; hint: string; renewal?: TokenRenewal }>();

const sentence = computed(() =>
  props.renewal ? renewalSentence(props.renewal, locale.value) : undefined,
);
const note = computed(() =>
  props.renewal?.note ? localized(props.renewal.note, locale.value) : undefined,
);
</script>

<template>
  <div class="shm-tokens-card">
    <strong>{{ label }}</strong>
    <span>{{ hint }}</span>
    <p v-if="renewal" class="shm-tokens-card-renewal">
      {{ sentence }}
      <span v-if="note" class="shm-tokens-card-note">{{ note }}</span>
      <span class="shm-tokens-card-source">
        {{ i18n.t('buyback.renewalSource') }}
        <a :href="renewal.source.url" target="_blank" rel="noopener"
          >{{ renewal.source.name }} <SvgIcon name="square-up-right"
        /></a>
      </span>
    </p>
  </div>
</template>

<style>
/* Shown in the tooltip overlay, outside the manager: not scoped, prefixed instead. */
.shm-tokens-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shm-tooltip .shm-tokens-card strong {
  margin-bottom: 0;
}

.shm-tokens-card-renewal {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 8px 0 0;
  padding-top: 8px;
  color: var(--shm-text);
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-tokens-card-note,
.shm-tokens-card-source {
  color: var(--shm-text-muted);
}

.shm-tokens-card-source a {
  color: var(--shm-accent);
}

.shm-tokens-card-source a:hover,
.shm-tokens-card-source a:focus-visible {
  text-decoration: underline;
}

.shm-tokens-card-source .shm-icon {
  width: 10px;
  height: 10px;
}
</style>
