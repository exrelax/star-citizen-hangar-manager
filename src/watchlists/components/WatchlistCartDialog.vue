<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/shared/overlay.css';
import '@/hangar/components/row.css';
import { STORE_CREDIT_VERSION, storeCreditItem } from '@/account/store-credit-storage';
import { RSI_CART_PATH } from '@/buyback/cart';
import { useDemoContext } from '@/demo/use-demo';
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { useStored } from '@/storage/use-stored';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { addLinesToCart, type CartResult } from '@/store/paint-consultant/cart';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import { cartChunksOf, watchCartOf, type WatchCartSkip } from '../watch-cart';
import type { StoreCatalog } from '../store-status';
import type { WatchItem } from '../watchlists';

/*
 * "Add to cart" of a watchlist (#529), for all its Pledge Store items or one: first what goes in –
 * the items on sale with their counts and prices now, the total and the store credit there is –
 * and what doesn't, with why; the user confirms. Then what went in and what RSI refused with its
 * reason, and a link to the cart. The cart isn't emptied: items already in it stay. Nothing is
 * ever checked out. In the demo nothing goes into the real cart.
 */

const props = defineProps<{
  title: string;
  items: readonly WatchItem[];
  catalog: StoreCatalog;
}>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const demo = useDemoContext();
const id = useId();

const cart = computed(() => watchCartOf(props.items, props.catalog));
const usd = (value: number) => formatUsd(value, locale.value);
const count = computed(() => cart.value.lines.reduce((sum, line) => sum + line.qty, 0));

/** The store credit there is: the account's, the demo's in the demo. */
const storedCredit = useStored(storeCreditItem);
const credit = computed(() => {
  const value =
    demo.value?.storeCredit ??
    (storedCredit.value?.version === STORE_CREDIT_VERSION ? storedCredit.value.credit : undefined);
  return value?.currency === 'USD' ? value.amount : undefined;
});

const SKIPS: Record<
  WatchCartSkip,
  'watchlists.cartSkipCcu' | 'watchlists.cartSkipOff' | 'watchlists.cartSkipUnknown'
> = {
  ccu: 'watchlists.cartSkipCcu',
  notOnSale: 'watchlists.cartSkipOff',
  unknown: 'watchlists.cartSkipUnknown',
};

const state = ref<'confirm' | 'busy' | 'done'>('confirm');
const result = ref<CartResult>();
async function add() {
  if (demo.value || !cart.value.lines.length || state.value !== 'confirm') return;
  state.value = 'busy';
  result.value = await addLinesToCart(
    cartChunksOf(cart.value.lines),
    undefined,
    'WATCHLIST-CART-FAIL',
  );
  state.value = 'done';
}
function openCart() {
  if (!window.open(RSI_CART_PATH, '_blank')) location.assign(RSI_CART_PATH);
}

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && state.value !== 'busy') emit('close');
}
onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="shm-overlay"
      :class="[themeClasses(settings), { 'shm-hide-values': settings.hideMeltValue }]"
      :style="fontScaleStyle(settings)"
      @click.self="state !== 'busy' && emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-watchlist-cart"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3 :id="`${id}-title`">{{ title }}</h3>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            :disabled="state === 'busy'"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <template v-if="state !== 'done'">
          <ul v-if="cart.lines.length" class="shm-watchlist-cart-lines">
            <li v-for="line in cart.lines" :key="line.skuId">
              <span class="shm-watchlist-cart-name">{{ line.name }}</span>
              <span class="shm-watchlist-cart-qty">×{{ line.qty }}</span>
              <span class="shm-value">{{ usd(line.price * line.qty) }}</span>
            </li>
          </ul>
          <p v-else class="shm-overlay-note">{{ i18n.t('watchlists.cartNothing') }}</p>
          <ul v-if="cart.skipped.length" class="shm-watchlist-cart-skipped">
            <li v-for="skip in cart.skipped" :key="skip.item.name + skip.reason">
              <span class="shm-watchlist-cart-name">{{ skip.item.name }}</span>
              <span>{{ i18n.t(SKIPS[skip.reason]) }}</span>
            </li>
          </ul>
          <dl v-if="cart.lines.length" class="shm-watchlist-cart-sums">
            <dt>{{ i18n.t('watchlists.cartTotal') }}</dt>
            <dd class="shm-value">{{ usd(cart.total) }}</dd>
            <template v-if="credit !== undefined">
              <dt>{{ i18n.t('summary.storeCredit') }}</dt>
              <dd class="shm-value" :class="{ 'is-short': credit < cart.total }">
                {{ usd(credit) }}
              </dd>
            </template>
          </dl>
          <p class="shm-overlay-note shm-watchlist-cart-note">
            {{ i18n.t('watchlists.cartNote') }}
          </p>
          <div class="shm-watchlist-actions">
            <button
              type="button"
              class="shm-button"
              :disabled="state === 'busy'"
              @click="emit('close')"
            >
              {{ i18n.t('watchlists.cancel') }}
            </button>
            <button
              v-tooltip="demo ? i18n.t('exchange.demo') : undefined"
              type="button"
              class="shm-button is-prominent"
              :class="{ 'is-busy': state === 'busy' }"
              :disabled="!!demo || !cart.lines.length || state === 'busy'"
              @click="add"
            >
              <SvgIcon name="basket-shopping" />
              {{ i18n.n('watchlists.cartAdd', count, [count]) }}
            </button>
          </div>
        </template>

        <template v-else-if="result">
          <p v-if="result.added.length" class="shm-overlay-note" role="status">
            {{
              i18n.n(
                'watchlists.cartAdded',
                result.added.reduce((sum, line) => sum + line.qty, 0),
                [result.added.reduce((sum, line) => sum + line.qty, 0)],
              )
            }}
          </p>
          <ul v-if="result.failed.length" class="shm-watchlist-cart-skipped is-error" role="alert">
            <li v-for="failure in result.failed" :key="failure.line.skuId + failure.reason">
              <span class="shm-watchlist-cart-name">{{ failure.line.name }}</span>
              <span>{{ failure.reason }}</span>
            </li>
          </ul>
          <div class="shm-watchlist-actions">
            <button type="button" class="shm-button" @click="emit('close')">
              {{ i18n.t('order.close') }}
            </button>
            <button type="button" class="shm-button is-prominent" @click="openCart">
              <SvgIcon name="square-up-right" />
              {{ i18n.t('watchlists.cartOpen') }}
            </button>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style>
.shm-watchlist-cart.shm-overlay-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(calc(560px * var(--shm-font-scale)), 100%);
}

.shm-watchlist-cart .shm-overlay-header {
  margin-bottom: 0;
}

/* RSI's `#billing .content ul` resets lists only inside its page; these are teleported. */
.shm-watchlist-cart-lines,
.shm-watchlist-cart-skipped {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-watchlist-cart-lines li,
.shm-watchlist-cart-skipped li {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.shm-watchlist-cart-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--shm-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-watchlist-cart-qty {
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}

.shm-watchlist-cart-skipped li {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-watchlist-cart-skipped.is-error li {
  color: var(--shm-danger);
}

.shm-watchlist-cart-sums {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
  font-variant-numeric: tabular-nums;
}

.shm-watchlist-cart-sums dt {
  color: var(--shm-text-secondary);
}

.shm-watchlist-cart-sums dd {
  margin: 0;
  color: var(--shm-text);
  text-align: right;
}

.shm-watchlist-cart-sums dd.is-short {
  color: var(--shm-warning);
}

.shm-watchlist-cart-note {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

/* As in an alert: the button that goes ahead on the right, "Cancel" left of it. */
.shm-watchlist-cart .shm-watchlist-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.shm-watchlist-cart .shm-watchlist-actions .shm-button {
  min-height: 32px;
  padding: 6px 14px;
}
</style>
