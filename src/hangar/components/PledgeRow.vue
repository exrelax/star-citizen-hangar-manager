<script setup lang="ts">
import { i18n } from '@/i18n';
import { ref } from 'vue';
import type { PledgeView } from '../pledge-view';
import { myGearHref } from '../route';
import ShipLinks from './ShipLinks.vue';

defineProps<{ pledge: PledgeView }>();

const expanded = ref(false);
// The manager lives on the hangar page, so this is its path including the locale prefix.
const pathname = location.pathname;
const toggle = () => (expanded.value = !expanded.value);
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

<style scoped>
.shm-row {
  margin-bottom: 6px;
  border: 1px solid rgba(98, 196, 235, 0.15);
  background: rgba(10, 20, 30, 0.6);
  /* Rows outside the viewport skip layout and paint – keeps long hangars smooth. */
  content-visibility: auto;
  contain-intrinsic-size: auto 77px;
}

.shm-row.is-expanded {
  border-color: rgba(98, 196, 235, 0.45);
}

.shm-row-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 6px 6px 6px;
  cursor: pointer;
}

.shm-row-summary:hover {
  background: rgba(98, 196, 235, 0.08);
}

.shm-thumb {
  flex: none;
  width: 112px;
  height: 63px;
  background: rgba(98, 196, 235, 0.08);
}

.shm-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shm-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.shm-title {
  overflow: hidden;
  color: #62c4eb;
  font-size: 14px;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-original,
.shm-ships {
  overflow: hidden;
  color: #8a9ba8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-ships {
  color: #dbe7ee;
  font-size: 12px;
}

.shm-meta {
  display: flex;
  gap: 14px;
  color: #b4c3cc;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.shm-badges {
  display: flex;
  flex: none;
  gap: 6px;
}

.shm-badge {
  padding: 2px 7px;
  color: #62c4eb;
  font-size: 11px;
  border: 1px solid rgba(98, 196, 235, 0.6);
}

.shm-badge.is-lti {
  color: #0b141c;
  background: #62c4eb;
}

.shm-badge.is-upgraded {
  color: #f0b232;
  border-color: rgba(240, 178, 50, 0.7);
}

.shm-badge.is-off {
  opacity: 0.35;
  text-decoration: line-through;
}

.shm-chevron {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #62c4eb;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  transition: transform 0.15s;
}

.shm-chevron:focus-visible {
  outline: 1px solid #62c4eb;
}

.is-expanded .shm-chevron {
  transform: rotate(90deg);
}

.shm-details {
  padding: 4px 16px 12px 132px;
  color: #b4c3cc;
  font-size: 12px;
}

.shm-my-gear-link {
  display: inline-block;
  margin-bottom: 8px;
  color: #62c4eb;
  text-decoration: none;
}

.shm-my-gear-link:hover,
.shm-my-gear-link:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-upgrade {
  margin: 0 0 6px;
  color: #f0b232;
}

.shm-items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-items li {
  display: flex;
  gap: 12px;
  padding: 3px 0;
  border-top: 1px solid rgba(98, 196, 235, 0.08);
}

.shm-item-title {
  flex: 1;
}

.shm-item-kind,
.shm-item-manufacturer {
  color: #8a9ba8;
}
</style>
