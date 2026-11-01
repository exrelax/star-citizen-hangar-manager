<script setup lang="ts">
import { i18n } from '#i18n';
import { ref } from 'vue';
import type { PledgeView } from '../pledge-view';

defineProps<{ pledge: PledgeView }>();

const expanded = ref(false);
</script>

<template>
  <div class="shm-row" :class="{ 'is-expanded': expanded }">
    <button
      type="button"
      class="shm-row-summary"
      :aria-expanded="expanded"
      :title="i18n.t('pledge.toggleDetails')"
      @click="expanded = !expanded"
    >
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
        <span v-if="pledge.originalName" class="shm-original">
          {{ i18n.t('pledge.originalName', [pledge.originalName]) }}
        </span>
        <span class="shm-meta">
          <span>#{{ pledge.id }}</span>
          <span>{{ pledge.value }}</span>
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

      <span class="shm-chevron" aria-hidden="true">▸</span>
    </button>

    <div v-if="expanded" class="shm-details">
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
  width: 100%;
  padding: 6px 12px 6px 6px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-row-summary:hover,
.shm-row-summary:focus-visible {
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

.shm-original {
  overflow: hidden;
  color: #8a9ba8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #62c4eb;
  transition: transform 0.15s;
}

.is-expanded .shm-chevron {
  transform: rotate(90deg);
}

.shm-details {
  padding: 4px 16px 12px 132px;
  color: #b4c3cc;
  font-size: 12px;
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
