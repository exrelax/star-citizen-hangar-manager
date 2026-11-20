<script setup lang="ts">
import { STORE_CREDIT_VERSION, storeCreditItem } from '@/account/store-credit-storage';
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { STORE_ITEMS_VERSION, storeItemsItem } from '../items/store-items-storage';
import {
  cartPaintDiscount,
  fillerLinesOf,
  type CartTierOption,
} from '../paint-consultant/cart-discount';
import { addLinesToCart, cartCheckOf, readCart, type CartLine } from '../paint-consultant/cart';
import { currentPlanOf, rebuyPlanItem, storedPlanOf } from '../paint-consultant/rebuy-plan-storage';
import PaintConfirm from './PaintConfirm.vue';

/*
 * The note on RSI's cart page (#458) while its paints don't get the best volume discount: the
 * tiers with where the cart stands, and the filler paints – the Paint Discount Consultant's
 * cheapest paints – that reach the best tier the store credit pays, with what that saves. Its
 * button puts them into the cart (at most 5 of one SKU, the cart read before and after) and starts
 * a plan of the consultant with them, so they are marked to melt once bought (#105, #97). Nothing
 * is ever checked out. Off by the setting under "RSI website".
 */

const emit = defineEmits<{
  /** The cart changed by the button: RSI's page shows it after a reload. */
  added: [];
}>();

const { settings } = useSettings();
const storeItems = useStored(storeItemsItem);
const storedCredit = useStored(storeCreditItem);
const storedPlan = useStored(rebuyPlanItem);

const items = computed(() =>
  storeItems.value?.version === STORE_ITEMS_VERSION ? storeItems.value.items : [],
);
/** The store credit in USD, as the Hangar Manager read it last; unknown otherwise. */
const credit = computed(() => {
  const stored = storedCredit.value;
  const value = stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined;
  return value && value.currency === 'USD' ? value.amount : undefined;
});

const cart = ref<CartLine[]>();
const failed = ref(false);
async function refreshCart() {
  try {
    cart.value = await readCart();
    failed.value = false;
  } catch {
    failed.value = true;
  }
}
defineExpose({ refreshCart });

const result = computed(() =>
  cart.value && items.value.length
    ? cartPaintDiscount(cart.value, items.value, credit.value)
    : undefined,
);
/** The option shown: the best one the store credit pays, else the next tier. */
const shown = computed(
  (): CartTierOption | undefined => result.value?.best ?? result.value?.options[0],
);

const usd = (value: number) => formatUsd(value, locale.value);
const percent = (value: number) =>
  new Intl.NumberFormat(locale.value, { style: 'percent' }).format(value / 100);

const tiers = computed(() =>
  (result.value?.tiers ?? []).map((tier, index) => ({
    ...tier,
    height: `${14 + index * 6}px`,
    reached: !!result.value?.current && tier.paints <= result.value.current.paints,
    target: tier.percent === shown.value?.tier.percent,
  })),
);
const tierAria = computed(() =>
  tiers.value
    .map((tier) => i18n.t('cartPaints.tierAria', [percent(tier.percent), tier.paints]))
    .join(', '),
);
const fillerText = computed(() =>
  (shown.value?.fillers ?? [])
    .map((filler) => `${filler.quantity} × ${filler.paint.name}`)
    .join(', '),
);

// ---- The button ----

const busy = ref(false);
const asking = ref(false);
const outcome = ref<'added' | 'partly' | 'none'>();
const runningPlan = computed(() => !!currentPlanOf(storedPlan.value));

async function addFillers({ replace = false } = {}) {
  const option = result.value?.best;
  if (!option || busy.value) return;
  if (!replace && runningPlan.value) {
    asking.value = true;
    return;
  }
  asking.value = false;
  busy.value = true;
  try {
    // The cart again first: only what is still missing goes in.
    const before = await readCart();
    const missing = cartCheckOf(fillerLinesOf(option), before).missing;
    const added = await addLinesToCart(missing);
    await refreshCart();
    outcome.value = added.failed.length ? (added.added.length ? 'partly' : 'none') : 'added';
    if (added.added.length) {
      // The plan of the consultant: the fillers are marked to melt once bought (#105).
      await rebuyPlanItem.setValue(
        storedPlanOf(
          {
            tier: option.tier,
            own: [],
            fillers: option.fillers,
            cartPrice: option.cost,
            cartCost: option.cost,
            meltValue: 0,
            storeCreditNeeded: option.cost,
            storeCreditFreed: 0,
          },
          Date.now(),
          'buy',
          credit.value,
        ),
      );
      emit('added');
    }
  } finally {
    busy.value = false;
  }
}

// RSI's cart changes on its page (quantities, items removed): read it again a moment later.
let observer: MutationObserver | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  void refreshCart();
  const root = document.querySelector('.c-cartStepper') ?? document.body;
  observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void refreshCart(), 800);
  });
  observer.observe(root, { childList: true, subtree: true });
});
onUnmounted(() => {
  observer?.disconnect();
  clearTimeout(timer);
});
</script>

<template>
  <section
    v-if="settings.cartPaintDiscount && result && shown"
    class="shm-cart-paints"
    :class="themeClasses(settings)"
    :style="fontScaleStyle(settings)"
    aria-labelledby="shm-cart-paints-title"
  >
    <div class="shm-cart-paints-head">
      <SvgIcon name="fill-drip" />
      <div>
        <h2 id="shm-cart-paints-title">{{ i18n.t('cartPaints.title') }}</h2>
        <p>
          {{
            result.current
              ? i18n.n('cartPaints.now', result.paints, [
                  result.paints,
                  percent(result.current.percent),
                ])
              : i18n.n('cartPaints.nowNone', result.paints, [result.paints])
          }}
        </p>
      </div>
    </div>

    <div class="shm-cart-paints-tiers" role="img" :aria-label="tierAria">
      <span
        v-for="tier in tiers"
        :key="tier.percent"
        class="shm-cart-paints-tier"
        :class="{ 'is-reached': tier.reached, 'is-target': tier.target }"
      >
        <span class="shm-cart-paints-tier-percent">{{ percent(tier.percent) }}</span>
        <span class="shm-cart-paints-tier-bar" :style="{ height: tier.height }"></span>
        <span class="shm-cart-paints-tier-count">×{{ tier.paints }}</span>
      </span>
    </div>

    <p class="shm-cart-paints-offer">
      {{
        i18n.n('cartPaints.offer', shown.fillerCount, [
          shown.fillerCount,
          percent(shown.tier.percent),
          usd(shown.saves),
        ])
      }}
      <span class="shm-cart-paints-fillers">{{ fillerText }}</span>
    </p>

    <p v-if="credit === undefined" class="shm-cart-paints-note">
      {{ i18n.t('cartPaints.creditUnknown') }}
    </p>
    <p v-else-if="!result.best" class="shm-cart-paints-note">
      {{
        i18n.t('cartPaints.creditMissing', [usd(shown.missing ?? 0), percent(shown.tier.percent)])
      }}
    </p>
    <template v-else>
      <p class="shm-cart-paints-note">
        {{ i18n.t('cartPaints.creditPays', [usd(shown.cost), usd(credit)]) }}
      </p>
      <div class="shm-cart-paints-actions">
        <button
          type="button"
          class="shm-button is-primary"
          :disabled="busy || asking"
          @click="addFillers()"
        >
          <SvgIcon name="plus" />
          {{ i18n.t(busy ? 'cartPaints.adding' : 'cartPaints.add') }}
        </button>
      </div>
      <PaintConfirm
        v-if="asking"
        :message="i18n.t('consultant.run.replaceConfirm')"
        :confirm="i18n.t('consultant.run.replace')"
        @confirm="addFillers({ replace: true })"
        @cancel="asking = false"
      />
    </template>

    <p v-if="outcome" class="shm-cart-paints-note" role="status">
      {{ i18n.t(`cartPaints.outcome.${outcome}`) }}
    </p>
    <p v-if="failed" class="shm-cart-paints-note" role="status">
      {{ i18n.t('cartPaints.readFailed') }}
    </p>
  </section>
</template>

<style>
/*
 * On RSI's cart page, outside the manager: not scoped, prefixed instead, and under the host, as
 * RSI's own rules for sections, headings and paragraphs would win otherwise.
 */
.shm-cart-paints-host .shm-cart-paints {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 0 16px;
  padding: 16px;
  color: var(--shm-text);
  font-family: var(--shm-font, inherit);
  font-size: calc(14px * var(--shm-font-scale, 1));
  line-height: 1.45;
  background: var(--shm-surface-elevated);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
}

.shm-cart-paints-host .shm-cart-paints-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.shm-cart-paints-host .shm-cart-paints-head > .shm-icon {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  color: var(--shm-accent);
}

.shm-cart-paints-host .shm-cart-paints h2 {
  margin: 0;
  color: var(--shm-text-strong);
  font-size: calc(16px * var(--shm-font-scale, 1));
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
}

.shm-cart-paints-host .shm-cart-paints p {
  margin: 0;
}

.shm-cart-paints-host .shm-cart-paints-tiers {
  display: grid;
  grid-template-columns: repeat(5, 44px);
  align-items: end;
  gap: 4px;
}

.shm-cart-paints-host .shm-cart-paints-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale, 1));
  font-variant-numeric: tabular-nums;
}

.shm-cart-paints-host .shm-cart-paints-tier-bar {
  width: 100%;
  background: rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-cart-paints-host .shm-cart-paints-tier.is-reached .shm-cart-paints-tier-bar {
  background: var(--shm-accent);
}

.shm-cart-paints-host .shm-cart-paints-tier.is-target .shm-cart-paints-tier-bar {
  background: rgb(var(--shm-success-rgb) / 0.35);
  box-shadow: inset 0 0 0 1px var(--shm-success);
}

.shm-cart-paints-host .shm-cart-paints-tier.is-target .shm-cart-paints-tier-percent {
  color: var(--shm-success);
  font-weight: 600;
}

.shm-cart-paints-host .shm-cart-paints-fillers,
.shm-cart-paints-host .shm-cart-paints-note {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale, 1));
}

.shm-cart-paints-host .shm-cart-paints-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shm-cart-paints-host .shm-theme-modern.shm-cart-paints {
  border: 0;
  border-radius: var(--shm-radius-cell);
  box-shadow: inset 0 0 0 1px var(--shm-fill);
}

.shm-cart-paints-host .shm-theme-modern .shm-cart-paints-tier-bar {
  border-radius: 3px;
}
</style>
