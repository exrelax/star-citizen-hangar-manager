<script setup lang="ts">
import { i18n } from '@/i18n';
import { ref, watch } from 'vue';
import type { PledgeView } from '../pledge-view';
import { myGearHref } from '../route';
import ShipLinks from './ShipLinks.vue';

const props = defineProps<{
  pledge: PledgeView;
  /** Set while this is the only pledge in the list: it then opens on its own. */
  autoExpand?: boolean;
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

// The manager lives on the hangar page, so this is its path including the locale prefix.
const pathname = location.pathname;
const toggle = () => {
  expanded.value = !expanded.value;
  openedAutomatically = false;
};
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
        <span class="shm-title">
          {{ pledge.title }}
          <ShipLinks v-if="pledge.titleShip" :link="pledge.titleShip.link" />
        </span>
        <span v-if="pledge.originalName" class="shm-original">
          {{ i18n.t('pledge.originalName', [pledge.originalName]) }}
        </span>
        <span v-if="pledge.ships.length" class="shm-ships">
          {{ i18n.t('pledge.shipsLabel') }}
          <template v-for="(ship, index) in pledge.ships" :key="ship.name">
            <span class="shm-ship">{{ ship.name }}<ShipLinks :link="ship.link" /></span
            ><template v-if="index < pledge.ships.length - 1">, </template>
          </template>
        </span>
        <span class="shm-meta">
          <span>#{{ pledge.id }}</span>
          <span class="shm-value">{{ pledge.value }}</span>
          <span v-if="pledge.createdAt">{{ pledge.createdAt }}</span>
        </span>
      </span>

      <span class="shm-badges">
        <span v-if="pledge.hasLti" class="shm-badge is-lti">LTI</span>
        <span v-if="pledge.isUpgraded" class="shm-badge is-upgraded">
          {{ i18n.t('pledge.upgraded') }}
        </span>
        <span
          class="shm-badge"
          :class="{ 'is-off': !pledge.isGiftable }"
          :title="i18n.t(pledge.isGiftable ? 'pledge.giftable' : 'pledge.notGiftable')"
        >
          Gift
        </span>
        <span
          class="shm-badge"
          :class="{ 'is-off': !pledge.isMeltable }"
          :title="i18n.t(pledge.isMeltable ? 'pledge.meltable' : 'pledge.notMeltable')"
        >
          Melt
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
      <a class="shm-my-gear-link" :href="myGearHref(pathname, pledge.page, pledge.id)">
        {{ i18n.t('pledge.showInMyGear', [pledge.page]) }} →
      </a>
      <p v-if="pledge.upgrade" class="shm-upgrade">
        {{ pledge.upgrade.matchItems.map((item) => item.name).join(', ') }}
        →
        {{ pledge.upgrade.targetItems.map((item) => item.name).join(', ') }}
      </p>
      <ul v-if="pledge.items.length" class="shm-items">
        <li v-for="(item, index) in pledge.items" :key="index">
          <span class="shm-item-title">{{ item.title }}</span>
          <span v-if="item.kind" class="shm-item-kind">{{ item.kind }}</span>
          <span v-if="item.manufacturer" class="shm-item-manufacturer">
            {{ item.manufacturer }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style src="./row.css"></style>
