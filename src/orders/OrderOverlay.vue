<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n } from '@/i18n';
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { anonymizeOrderDetails, type Order, type OrderDetails } from './orders';
import { fetchOrderDetails } from './sync-orders';

const props = defineProps<{ order: Order }>();
const emit = defineEmits<{ close: [] }>();

const details = ref<OrderDetails>();
const error = ref<string>();
const dialog = useTemplateRef<HTMLElement>('dialog');
/**
 * In the demo, `order` has a made-up id: the real order is loaded, and its details are
 * anonymized before they are shown, so no real order id, address or payment provider appears.
 */
const demo = useDemoContext();

onMounted(async () => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
  try {
    const context = demo.value;
    if (context) {
      const real = context.realOrder(props.order.id);
      if (!real) throw new Error(i18n.t('order.notFound'));
      details.value = anonymizeOrderDetails(await fetchOrderDetails(real), context.fakeId);
    } else {
      details.value = await fetchOrderDetails(props.order);
    }
  } catch (failure) {
    console.error('[sc-hangar-manager] Loading the order failed', failure);
    error.value = i18n.t('order.failed', [
      failure instanceof Error ? failure.message : String(failure),
    ]);
  }
});
onUnmounted(() => removeEventListener('keydown', onKeydown));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

/** The same popup as RSI's "Retrieve invoice" in the billing list. */
function openInvoice() {
  if (demo.value) return;
  const slug = details.value?.slug || props.order.id.toLowerCase();
  window.open(
    `${location.origin}/account/billing/order/${slug}`,
    `Order #${slug}`,
    'width=1000,height=600',
  );
}
</script>

<!-- An order of RSI's billing list with its expanded details, over the manager view. -->
<template>
  <Teleport to="body">
    <div class="shm-overlay" @click.self="emit('close')">
      <section
        ref="dialog"
        class="shm-overlay-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="i18n.t('order.title', [order.id])"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3>{{ i18n.t('order.title', [order.id]) }}</h3>
          <button
            type="button"
            class="shm-overlay-close"
            :title="i18n.t('order.close')"
            :aria-label="i18n.t('order.close')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <p v-if="error" class="shm-overlay-note is-error" role="alert">{{ error }}</p>
        <p v-else-if="!details" class="shm-overlay-note">{{ i18n.t('order.loading') }}</p>
        <template v-else>
          <dl class="shm-order-header">
            <div v-for="field in details.header" :key="field.label">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>

          <div class="shm-order-section-title">
            <h4>{{ i18n.t('order.summary') }}</h4>
            <!-- Disabled in the demo: RSI's invoice shows the real order. -->
            <button
              type="button"
              class="shm-button"
              :disabled="!!demo"
              :title="demo ? i18n.t('order.invoiceDemo') : undefined"
              @click="openInvoice"
            >
              {{ i18n.t('order.invoice') }}
            </button>
          </div>
          <table class="shm-order-table">
            <thead>
              <tr>
                <th v-for="(column, index) in details.items.columns" :key="index">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in details.items.rows" :key="index">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </tbody>
          </table>

          <div class="shm-order-billing">
            <div v-if="details.billTo.length">
              <h4>{{ i18n.t('order.billTo') }}</h4>
              <p v-for="(line, index) in details.billTo" :key="index">{{ line }}</p>
            </div>
            <dl class="shm-order-totals">
              <div v-for="total in details.totals" :key="total.label">
                <dt>{{ total.label }}</dt>
                <dd>{{ total.value }}</dd>
              </div>
            </dl>
          </div>

          <template v-if="details.payments.rows.length">
            <h4>{{ i18n.t('order.paymentInfo') }}</h4>
            <table class="shm-order-table">
              <thead>
                <tr>
                  <th v-for="(column, index) in details.payments.columns" :key="index">
                    {{ column }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in details.payments.rows" :key="index">
                  <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
/* Above RSI's header and navigation. */
.shm-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 60px 16px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.7);
}

.shm-overlay-dialog {
  width: min(900px, 100%);
  padding: 20px 24px 24px;
  color: #b4c3cc;
  font-family: Electrolize, sans-serif;
  font-size: 13px;
  background: #0b141c;
  border: 1px solid rgba(98, 196, 235, 0.45);
  box-shadow: 0 0 40px rgba(98, 196, 235, 0.15);
  outline: none;
}

.shm-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

h3 {
  margin: 0;
  color: #62c4eb;
  font-size: 16px;
  text-transform: uppercase;
}

h4 {
  margin: 18px 0 8px;
  color: #62c4eb;
  font-size: 13px;
  font-weight: normal;
  text-transform: uppercase;
}

.shm-overlay-close {
  padding: 0 6px;
  color: #8a9ba8;
  font-size: 24px;
  line-height: 1;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-overlay-close:hover,
.shm-overlay-close:focus-visible {
  color: #fff;
  outline: none;
}

.shm-overlay-note {
  margin: 0;
}

.shm-overlay-note.is-error {
  color: #ff8a80;
}

/* The order's header as a row of labelled values, like RSI's columns. */
.shm-order-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin: 0;
  padding: 12px 14px;
  background: rgba(98, 196, 235, 0.06);
  border: 1px solid rgba(98, 196, 235, 0.15);
}

dt {
  color: #8a9ba8;
  font-size: 11px;
  text-transform: uppercase;
}

dd {
  margin: 2px 0 0;
  color: #dbe7ee;
}

.shm-order-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shm-order-table {
  width: 100%;
  border-collapse: collapse;
}

.shm-order-table th,
.shm-order-table td {
  padding: 5px 0 5px 12px;
  text-align: right;
  border-top: 1px solid rgba(98, 196, 235, 0.1);
}

.shm-order-table :is(th, td):first-child {
  padding-left: 0;
  text-align: left;
}

.shm-order-table th {
  color: #8a9ba8;
  font-weight: normal;
  border-top: 0;
}

.shm-order-table td {
  color: #dbe7ee;
  font-variant-numeric: tabular-nums;
}

.shm-order-billing {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px 40px;
  margin-top: 6px;
}

.shm-order-billing p {
  margin: 0;
  color: #dbe7ee;
}

.shm-order-totals {
  min-width: 260px;
  margin: 18px 0 0;
}

.shm-order-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 3px 0;
}

.shm-order-totals > div:last-child {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(98, 196, 235, 0.25);
}

.shm-order-totals > div:last-child :is(dt, dd) {
  color: #62c4eb;
}

.shm-order-totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
