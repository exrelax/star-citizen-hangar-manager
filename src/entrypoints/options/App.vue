<script setup lang="ts">
import { i18n } from '@/i18n';
</script>

<template>
  <main class="manager">
    <h1>{{ i18n.t('manager.title') }}</h1>
    <p>{{ i18n.t('manager.intro') }}</p>
  </main>
</template>

<style scoped>
.manager {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}
</style>
