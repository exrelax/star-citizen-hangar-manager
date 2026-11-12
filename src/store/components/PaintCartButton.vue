<script setup lang="ts">
import { RSI_CART_PATH } from '@/buyback/cart';
import { useDemoContext } from '@/demo/use-demo';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, inject, ref } from 'vue';
import {
  addLinesToCart,
  readCart,
  type CartLine,
  type CartResult,
  cartCheckOf,
  type PaintCartLine,
} from '../paint-consultant/cart';
import { REPLACES_RUNNING_PLAN } from '../paint-consultant/use-running-plan';
import PaintConfirm from './PaintConfirm.vue';

/*
 * Puts paints of the Paint Discount Consultant into RSI's cart (#103) – the plan's, or those left
 * to buy after melting first (#168) – with what it says on the way: a cart that isn't empty (other
 * items change the tier), paints RSI refuses, errors. The parent keeps the plan once something was
 * added (`filled`). While a plan runs, a new plan's button asks first: its cart replaces it (#245).
 * Nothing is ever checked out.
 */

const props = defineProps<{
  lines: readonly PaintCartLine[];
  /** The button's text; "Put the N paints into the cart" without it. */
  label?: string;
  /**
   * The whole plan when `lines` are only what is missing of it (the running plan, #245): its
   * paints in the cart already don't count as other items.
   */
  expected?: readonly PaintCartLine[];
}>();
const emit = defineEmits<{ filled: [result: CartResult] }>();

// The demo is for screenshots: nothing goes into the real cart.
const demo = useDemoContext();
const count = computed(() => props.lines.reduce((sum, line) => sum + line.qty, 0));
/**
 * `busy` while reading or filling the cart; `occupied` when the cart already holds items;
 * `replacing` while it asks whether the running plan may be replaced.
 */
const state = ref<'idle' | 'busy' | 'occupied' | 'replacing' | 'done'>('idle');
/** The cart's items before adding, while it isn't empty. */
const before = ref<CartLine[]>([]);
/** Items in the cart other than the plan's. */
const othersOf = (lines: readonly CartLine[]) =>
  props.expected
    ? cartCheckOf(props.expected, lines).others
    : lines.reduce((sum, line) => sum + line.qty, 0);
const itemsBefore = computed(() => othersOf(before.value));
const replacesPlan = inject(REPLACES_RUNNING_PLAN, () => false);
const result = ref<CartResult>();
const error = ref<string>();

function openCart() {
  if (!window.open(RSI_CART_PATH, '_blank')) location.assign(RSI_CART_PATH);
}

/** Reads the cart first: other items in it change the volume discount tier. */
async function toCart({ replace = false } = {}) {
  if (!props.lines.length || demo.value || state.value === 'busy') return;
  if (!replace && replacesPlan()) {
    state.value = 'replacing';
    return;
  }
  state.value = 'busy';
  error.value = undefined;
  result.value = undefined;
  try {
    before.value = await readCart();
    if (othersOf(before.value)) {
      state.value = 'occupied';
      return;
    }
    await fill();
  } catch (failure) {
    report(failure);
  }
}

/** Adds the paints and opens the cart. */
async function fill() {
  state.value = 'busy';
  try {
    const added = await addLinesToCart(props.lines);
    result.value = added;
    if (added.added.length) emit('filled', added);
    state.value = 'done';
    // With a refused paint the cart isn't what the plan needs: the user reads why first.
    if (!added.failed.length) openCart();
  } catch (failure) {
    report(failure);
  }
}

function report(failure: unknown) {
  console.error('[star-citizen-hangar-manager] Filling the cart failed', failure);
  error.value = failure instanceof Error ? failure.message : String(failure);
  state.value = 'idle';
}
</script>

<template>
  <button
    v-tooltip="demo ? i18n.t('exchange.demo') : i18n.t('consultant.toCartHint')"
    type="button"
    class="shm-button"
    :class="{ 'is-busy': state === 'busy' }"
    :disabled="
      !!demo || !lines.length || state === 'busy' || state === 'occupied' || state === 'replacing'
    "
    @click="toCart()"
  >
    <SvgIcon name="basket-shopping" />
    {{ label ?? i18n.t('consultant.toCart', [count]) }}
  </button>

  <PaintConfirm
    v-if="state === 'replacing'"
    :message="i18n.t('consultant.run.replaceConfirm')"
    :confirm="i18n.t('consultant.run.replace')"
    @confirm="toCart({ replace: true })"
    @cancel="state = 'idle'"
  />

  <div v-if="state === 'occupied'" class="shm-consultant-note" role="alert">
    <p>{{ i18n.n('consultant.cartOccupied', itemsBefore) }}</p>
    <div class="shm-consultant-cart-actions">
      <button type="button" class="shm-button" @click="openCart">
        <SvgIcon name="square-up-right" />
        {{ i18n.t('consultant.openCart') }}
      </button>
      <button type="button" class="shm-button" @click="fill">
        {{ i18n.t('consultant.addAnyway') }}
      </button>
      <button type="button" class="shm-button" @click="state = 'idle'">
        {{ i18n.t('consultant.cancel') }}
      </button>
    </div>
  </div>

  <div v-if="result?.failed.length" class="shm-consultant-note" role="alert">
    <p>{{ i18n.t('consultant.cartFailed') }}</p>
    <ul>
      <li v-for="failure in result.failed" :key="failure.line.skuId">
        {{ failure.line.name }} × {{ failure.line.qty }}: {{ failure.reason }}
      </li>
    </ul>
    <button type="button" class="shm-button" @click="openCart">
      <SvgIcon name="square-up-right" />
      {{ i18n.t('consultant.openCart') }}
    </button>
  </div>
  <p v-else-if="state === 'done'" class="shm-consultant-note is-info" role="status">
    {{ i18n.t('consultant.cartDone') }}
    <button type="button" class="shm-link-button" @click="openCart">
      {{ i18n.t('consultant.openCart') }}
    </button>
  </p>
  <p v-if="error" class="shm-consultant-note" role="alert">
    {{ i18n.t('consultant.cartError', [error]) }}
  </p>
</template>
