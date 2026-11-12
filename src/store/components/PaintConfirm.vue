<script setup lang="ts">
import { i18n } from '@/i18n';
import { onMounted, useTemplateRef } from 'vue';

/*
 * A question right where it was asked, before something that can't be undone in the Paint
 * Discount Consultant (#245): discarding the running plan, or a new cart that replaces it. Laid out
 * like `PaintCartButton`'s question about an occupied cart; "Cancel" has the focus, so Return
 * never confirms by accident.
 */

defineProps<{
  message: string;
  /** The button that goes ahead. */
  confirm: string;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton');
onMounted(() => cancelButton.value?.focus({ preventScroll: false }));
</script>

<template>
  <div class="shm-consultant-note shm-consultant-confirm" role="alert">
    <p>{{ message }}</p>
    <div class="shm-consultant-cart-actions">
      <button type="button" class="shm-button is-danger" @click="emit('confirm')">
        {{ confirm }}
      </button>
      <button ref="cancelButton" type="button" class="shm-button" @click="emit('cancel')">
        {{ i18n.t('consultant.cancel') }}
      </button>
    </div>
  </div>
</template>

<style>
.shm-consultant-confirm p {
  margin: 0 0 8px;
}
</style>
