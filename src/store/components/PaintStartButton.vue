<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { inject, ref } from 'vue';
import { REPLACES_RUNNING_PLAN } from '../paint-consultant/use-running-plan';
import PaintConfirm from './PaintConfirm.vue';

/*
 * Starts a plan of the Paint Discount Consultant (#317): a plan runs only from here on, never by
 * trying its cart. Nothing goes into the cart and nothing is melted; the running plan offers that
 * step by step. While another plan runs, it asks first, since the new one replaces it (#245). The
 * parent keeps the plan (`start`) – in the demo its own (#131).
 */

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ start: [] }>();

const replacesPlan = inject(REPLACES_RUNNING_PLAN, () => false);
const asking = ref(false);

function start({ replace = false } = {}) {
  if (!replace && replacesPlan()) {
    asking.value = true;
    return;
  }
  asking.value = false;
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

  <PaintConfirm
    v-if="asking"
    :message="i18n.t('consultant.run.replaceConfirm')"
    :confirm="i18n.t('consultant.run.replace')"
    @confirm="start({ replace: true })"
    @cancel="asking = false"
  />
</template>
