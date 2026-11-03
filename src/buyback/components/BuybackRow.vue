<script setup lang="ts">
import ExternalLinks from '@/hangar/components/ExternalLinks.vue';
import OrderInfo from '@/orders/OrderInfo.vue';
import { insuranceLabel } from '@/hangar/insurance';
import { kindIcon } from '@/hangar/pledge-kind';
import { isRewardTitle } from '@/hangar/rewards';
import SvgIcon from '@/icons/SvgIcon.vue';
import { buybackHref } from '@/hangar/route';
import { useDemoContext } from '@/demo/use-demo';
import { i18n } from '@/i18n';
import type { BuybackLinkMode } from '@/settings/settings';
import { computed, ref, watch } from 'vue';
import type { BuybackView } from '../buyback-view';
import { addBuybackToCart, CartError, RSI_CART_PATH } from '../cart';
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
const demo = useDemoContext();
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

const addingToCart = ref(false);
const cartError = ref<string>();
async function addToCart() {
  // The demo is for screenshots: nothing goes into the real cart.
  if (addingToCart.value || demo.value) return;
  addingToCart.value = true;
  cartError.value = undefined;
  try {
    await addBuybackToCart(props.pledge);
    // Still within the click's user activation for the popup blocker; if blocked, open it here.
    if (!window.open(RSI_CART_PATH, '_blank')) location.assign(RSI_CART_PATH);
  } catch (error) {
    console.error('[sc-hangar-manager] Adding to cart failed', error);
    cartError.value =
      error instanceof CartError && error.reason === 'notFound'
        ? i18n.t('buyback.cartNotFound')
        : i18n.t('buyback.cartFailed', [error instanceof Error ? error.message : String(error)]);
  } finally {
    addingToCart.value = false;
  }
}

/** The icon of the pledge's kind, on the row's image; the buy back recognizes rewards by name. */
const kind = computed(() =>
  kindIcon({ ...props.pledge, isReward: isRewardTitle(props.pledge.title) }),
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
        <!-- The kind of item (ship, CCU, paint, …) as a badge on the image. -->
        <span v-if="kind" class="shm-row-kind"><SvgIcon :name="kind" /></span>
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ pledge.title }}</span>
        <span v-if="pledge.ships.length" class="shm-ships">
          {{ i18n.t('pledge.shipsLabel') }}
          <template v-for="(ship, index) in pledge.ships" :key="ship.name">
            <span class="shm-ship">{{ ship.name }}</span
            ><template v-if="index < pledge.ships.length - 1">, </template>
          </template>
        </span>
        <span v-else-if="pledge.contained" class="shm-original">
          {{ i18n.t('buyback.contains', [pledge.contained]) }}
        </span>
        <span class="shm-meta">
          <span class="shm-pledge-id">#{{ pledge.displayId ?? pledge.id }}</span>
          <span v-if="pledge.reclaimedAt">
            {{ i18n.t('buyback.reclaimed', [pledge.reclaimedAt]) }}
          </span>
        </span>
        <span v-if="cartError" class="shm-cart-error" role="alert">{{ cartError }}</span>
      </span>

      <span class="shm-badges">
        <button
          type="button"
          class="shm-cart"
          :class="{ 'is-busy': addingToCart }"
          :disabled="addingToCart"
          :title="i18n.t('buyback.addToCart')"
          :aria-label="i18n.t('buyback.addToCart')"
          @click.stop="addToCart"
        >
          🛒
        </button>
        <span
          v-if="pledge.insurance"
          class="shm-badge"
          :class="{ 'is-lti': pledge.insurance.lifetime }"
          :title="i18n.t('insurance.badgeTitle')"
        >
          {{ insuranceLabel(pledge.insurance) }}
        </span>
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

    <!-- Two columns like the row above: the way to RSI's original under the image, then the rest. -->
    <div v-if="expanded" class="shm-details">
      <!-- In the demo the link would reveal the real pledge id: it stays inert. -->
      <a
        class="shm-button shm-origin-button"
        :href="demo ? '#' : buybackLink.href"
        @click="demo && $event.preventDefault()"
      >
        {{ buybackLink.text }}
      </a>
      <div class="shm-details-main">
        <OrderInfo v-if="pledge.order" :order="pledge.order" />
        <p v-if="pledge.isProbablyGiftable" class="shm-hint">{{ giftableHint }}</p>
        <ul v-if="pledge.items.length" class="shm-items">
          <li v-for="(item, index) in pledge.items" :key="index">
            <span class="shm-item-title">{{ item }}</span>
          </li>
        </ul>
        <p v-else class="shm-hint">{{ i18n.t('buyback.contains', [pledge.contained]) }}</p>
        <ExternalLinks :ships="pledge.ships" />
      </div>
    </div>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>
