<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, inject, ref, useId } from 'vue';
import { planStartError, planStartedBy } from '../paint-consultant/start-plan';
import { REPLACES_RUNNING_PLAN } from '../paint-consultant/use-running-plan';
import PaintConfirm from './PaintConfirm.vue';

/*
 * Starts a plan of the Paint Discount Consultant (#317): a plan runs only from here on, never by
 * trying its cart. Nothing goes into the cart and nothing is melted; the running plan offers that
 * step by step. While another plan runs, it asks first, since the new one replaces it (#245). The
 * parent keeps the plan (`start`) – in the demo its own (#131); a plan that doesn't fit into the
 * synced storage (#635) isn't started, and the message shows below this button.
 */

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ start: [] }>();

const replacesPlan = inject(REPLACES_RUNNING_PLAN, () => false);
const asking = ref(false);
const id = useId();
const error = computed(() =>
  planStartError.value?.by === id ? planStartError.value.message : undefined,
);

function start({ replace = false } = {}) {
  if (!replace && replacesPlan()) {
    asking.value = true;
    return;
  }
  asking.value = false;
  planStartedBy.value = id;
  emit('start');
}
</script>

<template>
  <button
    v-tooltip="i18n.t('consultant.startHint')"
    type="button"
    class="shm-button"
    :disabled="disabled || asking"
    @click="start()"
  >
    <SvgIcon name="route" />
    {{ i18n.t('consultant.start') }}
  </button>

  <p v-if="error" class="shm-hint is-error shm-start-error" role="alert">{{ error }}</p>

  <PaintConfirm
    v-if="asking"
    :message="i18n.t('consultant.run.replaceConfirm')"
    :confirm="i18n.t('consultant.run.replace')"
    @confirm="start({ replace: true })"
    @cancel="asking = false"
  />
</template>

<style>
/* Why the plan didn't start (#635): below the button, across the line. */
.shm-start-error {
  flex-basis: 100%;
  margin: 6px 0 0;
  color: var(--shm-danger);
}
</style>
