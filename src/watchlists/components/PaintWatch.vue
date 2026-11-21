<script setup lang="ts">
import { i18n } from '@/i18n';
import { computed, ref } from 'vue';
import { watchlistsByItem } from '../use-watchlists';
import { itemKey } from '../watchlists';
import StoreWatchDialog from './StoreWatchDialog.vue';
import WatchButton from './WatchButton.vue';

/*
 * A paint of the Pledge Store on watchlists (#470), e.g. in the Paint Discount Consultant: its
 * notepad button, tinted while it is on one, and the choice of watchlists.
 */

const props = defineProps<{ paint: { skuId: number; name: string; price?: number } }>();

const open = ref(false);
const item = computed(() => ({
  kind: 'storePaint' as const,
  skuId: props.paint.skuId,
  name: props.paint.name,
  ...(props.paint.price !== undefined && { value: props.paint.price }),
}));
const hint = computed(() => i18n.t('watchlists.putOn', [props.paint.name]));
</script>

<template>
  <WatchButton
    class="shm-paint-watch"
    :hint="hint"
    :on="watchlistsByItem.has(itemKey(item))"
    @open="open = true"
  />
  <StoreWatchDialog v-if="open" :title="hint" :item="item" @close="open = false" />
</template>
