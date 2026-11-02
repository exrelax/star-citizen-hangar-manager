<script setup lang="ts">
import ShipLinks from '@/hangar/components/ShipLinks.vue';
import { buybackHref } from '@/hangar/route';
import { i18n } from '@/i18n';
import type { BuybackLinkMode } from '@/settings/settings';
import { computed, ref, watch } from 'vue';
import type { BuybackView } from '../buyback-view';
import { giftableHint } from '../giftable-hint';

const props = defineProps<{
  pledge: BuybackView;
  /** Set while this is the only pledge in the list: it then opens on its own. */
  autoExpand?: boolean;
  /** What "Show in Buy Back" opens (see the settings). */
  linkMode: BuybackLinkMode;
}>();

const expanded = ref(!!props.autoExpand);
// Only rows opened automatically close again automatically; a manual toggle is kept.
let openedAutomatically = expanded.value;
watch(
  () => props.autoExpand,
  (autoExpand) => {
    if (autoExpand && !expanded.value) {
      expanded.value = true;
      openedAutomatically = true;
    } else if (!autoExpand && openedAutomatically) {
      expanded.value = false;
      openedAutomatically = false;
    }
  },
);
const toggle = () => {
  expanded.value = !expanded.value;
  openedAutomatically = false;
};

// The manager lives on the hangar page; buyback links keep its locale prefix.
const pathname = location.pathname;
const buybackLink = computed(() =>
  props.linkMode === 'single'
    ? {
        // One pledge per page: its page number is its position in the list.
        href: buybackHref(pathname, props.pledge.position + 1, props.pledge.id, 1),
        text: i18n.t('buyback.showSingleInBuyback'),
      }
    : {
        href: buybackHref(pathname, props.pledge.page, props.pledge.id),
        text: i18n.t('buyback.showInBuyback', [props.pledge.page]),
      },
);
</script>

<template>
  <div class="shm-row" :class="{ 'is-expanded': expanded }">
    <!-- Clicking anywhere toggles the details; the chevron button makes it keyboard accessible. -->
    <div class="shm-row-summary" @click="toggle">
      <span class="shm-thumb">
        <img
          v-if="pledge.image"
          :src="pledge.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="112"
          height="63"
        />
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ pledge.title }}</span>
        <span v-if="pledge.ships.length" class="shm-ships">
          {{ i18n.t('pledge.shipsLabel') }}
          <template v-for="(ship, index) in pledge.ships" :key="ship.name">
            <span class="shm-ship">{{ ship.name }}<ShipLinks :link="ship.link" /></span
            ><template v-if="index < pledge.ships.length - 1">, </template>
          </template>
        </span>
        <span v-else-if="pledge.contained" class="shm-original">
          {{ i18n.t('buyback.contains', [pledge.contained]) }}
        </span>
        <span class="shm-meta">
          <span>#{{ pledge.id }}</span>
          <span v-if="pledge.reclaimedAt">
            {{ i18n.t('buyback.reclaimed', [pledge.reclaimedAt]) }}
          </span>
        </span>
      </span>

      <span class="shm-badges">
        <span v-if="pledge.hasLti" class="shm-badge is-lti">LTI</span>
        <span v-if="pledge.isProbablyGiftable" class="shm-badge is-giftable" :title="giftableHint">
          {{ i18n.t('filter.probablyGiftable') }}
        </span>
      </span>

      <button
        type="button"
        class="shm-chevron"
        :aria-expanded="expanded"
        :aria-label="i18n.t('pledge.toggleDetails')"
        :title="i18n.t('pledge.toggleDetails')"
        @click.stop="toggle"
      >
        ▸
      </button>
    </div>

    <div v-if="expanded" class="shm-details">
      <a class="shm-my-gear-link" :href="buybackLink.href">{{ buybackLink.text }} →</a>
      <p v-if="pledge.isProbablyGiftable" class="shm-hint">{{ giftableHint }}</p>
      <ul v-if="pledge.items.length" class="shm-items">
        <li v-for="(item, index) in pledge.items" :key="index">
          <span class="shm-item-title">{{ item }}</span>
        </li>
      </ul>
      <p v-else class="shm-hint">{{ i18n.t('buyback.contains', [pledge.contained]) }}</p>
    </div>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>
