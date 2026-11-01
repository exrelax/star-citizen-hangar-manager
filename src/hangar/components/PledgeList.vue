<script setup lang="ts">
import { i18n } from '#i18n';
import type { PledgeView } from '../pledge-view';
import PledgeRow from './PledgeRow.vue';

defineProps<{ pledges: PledgeView[] }>();
</script>

<template>
  <div class="shm-list">
    <p class="shm-count">{{ i18n.t('manager.count', [pledges.length]) }}</p>
    <PledgeRow v-for="pledge in pledges" :key="pledge.id" :pledge="pledge" />
  </div>
</template>

<style scoped>
.shm-list {
  margin-top: 20px;
}

.shm-count {
  margin: 0 0 10px;
  color: #8a9ba8;
  font-size: 12px;
}
</style>
