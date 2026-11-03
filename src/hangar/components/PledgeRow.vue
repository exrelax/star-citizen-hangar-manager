<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n, locale } from '@/i18n';
import { computed, ref, watch } from 'vue';
import { REFUND_DAYS, REFUND_URGENT_DAYS } from '@/config';
import { refundWindow, today } from '@/orders/refund';
import { formatDiscount } from '../discount-format';
import { insuranceLabel, supersededInsurances } from '../insurance';
import type { PledgeView } from '../pledge-view';
import { myGearHref } from '../route';
import OrderInfo from '@/orders/OrderInfo.vue';
import ExternalLinks from './ExternalLinks.vue';
import UpgradeLog from './UpgradeLog.vue';

const props = defineProps<{
  pledge: PledgeView;
  /** Set while this is the only pledge in the list: it then opens on its own. */
  autoExpand?: boolean;
}>();

/** The current ship of an upgraded pledge first, then the other ships. */
const linkedShips = computed(() =>
  props.pledge.titleShip ? [props.pledge.titleShip, ...props.pledge.ships] : props.pledge.ships,
);

/** Days left to refund a purchase paid with money (CIG: 30 days), while there are any. */
const refund = computed(() =>
  props.pledge.order?.placedAt ? refundWindow(props.pledge.order.placedAt, today.value) : undefined,
);

/** Insurances of an upgraded ship replaced by a better one (hidden by a setting, see row.css). */
const superseded = computed(() =>
  props.pledge.isUpgraded
    ? supersededInsurances(
        props.pledge.items.map((item) => (item.kind === 'Insurance' ? item.title : '')),
      )
    : new Set<number>(),
);

const discount = computed(
  () => props.pledge.discount && formatDiscount(props.pledge.discount, locale.value),
);

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
const demo = useDemoContext();
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
        <span class="shm-title">{{ pledge.title }}</span>
        <span v-if="pledge.originalName" class="shm-original">
          {{ i18n.t('pledge.originalName', [pledge.originalName]) }}
        </span>
        <span v-if="pledge.ships.length" class="shm-ships">
          {{ i18n.t('pledge.shipsLabel') }}
          <template v-for="(ship, index) in pledge.ships" :key="ship.name">
            <span class="shm-ship">{{ ship.name }}</span
            ><template v-if="index < pledge.ships.length - 1">, </template>
          </template>
        </span>
        <span class="shm-meta">
          <span class="shm-pledge-id">#{{ pledge.displayId ?? pledge.id }}</span>
          <span class="shm-value">{{ pledge.value }}</span>
          <span
            v-if="discount"
            class="shm-discount"
            :class="{ 'is-surcharge': discount.isSurcharge }"
            :title="discount.title"
          >
            {{ discount.text }}
          </span>
          <span v-if="pledge.createdAt">{{ pledge.createdAt }}</span>
        </span>
      </span>

      <span class="shm-badges">
        <span
          v-if="refund"
          class="shm-badge is-refund"
          :class="{ 'is-urgent': refund.daysLeft < REFUND_URGENT_DAYS }"
          :title="i18n.t('refund.hint', [pledge.order!.placedAt!, REFUND_DAYS, refund.until])"
        >
          {{
            refund.daysLeft === 0
              ? i18n.t('refund.lastDay')
              : i18n.t(refund.daysLeft === 1 ? 'refund.day' : 'refund.days', [refund.daysLeft])
          }}
        </span>
        <span
          v-if="pledge.insurance"
          class="shm-badge"
          :class="{ 'is-lti': pledge.insurance.lifetime }"
          :title="i18n.t('insurance.badgeTitle')"
        >
          {{ insuranceLabel(pledge.insurance) }}
        </span>
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

    <!-- Two columns like the row above: the way to RSI's original under the image, then the rest. -->
    <div v-if="expanded" class="shm-details">
      <div class="shm-details-side">
        <!-- In the demo the link would reveal the real pledge id (and page): it stays inert. -->
        <a
          class="shm-button shm-origin-button"
          :href="demo ? '#' : myGearHref(pathname, pledge.page, pledge.id)"
          @click="demo && $event.preventDefault()"
        >
          {{ i18n.t('pledge.showInMyGear', [pledge.page]) }}
        </a>
      </div>
      <div class="shm-details-main">
        <OrderInfo v-if="pledge.order" :order="pledge.order" :base="pledge.isUpgraded" refundable />
        <p v-if="pledge.upgrade" class="shm-upgrade">
          {{ pledge.upgrade.matchItems.map((item) => item.name).join(', ') }}
          →
          {{ pledge.upgrade.targetItems.map((item) => item.name).join(', ') }}
        </p>
        <ul v-if="pledge.items.length" class="shm-items">
          <li
            v-for="(item, index) in pledge.items"
            :key="index"
            :class="{ 'is-superseded-insurance': superseded.has(index) }"
          >
            <span class="shm-item-title">{{ item.title }}</span>
            <span v-if="item.kind" class="shm-item-kind">{{ item.kind }}</span>
            <span v-if="item.manufacturer" class="shm-item-manufacturer">
              {{ item.manufacturer }}
            </span>
          </li>
        </ul>
        <UpgradeLog v-if="pledge.isUpgraded" :pledge-id="pledge.id" />
        <ExternalLinks :ships="linkedShips" />
      </div>
    </div>
  </div>
</template>

<style src="./row.css"></style>
