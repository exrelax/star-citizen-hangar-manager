<script setup lang="ts">
import { i18n } from '#i18n';
</script>

<!-- Reuses the markup classes of the original hangar page so the view inherits the site's look. -->
<template>
  <div class="top">
    <h2 class="title">{{ i18n.t('manager.title') }}</h2>
    <p>{{ i18n.t('manager.intro') }}</p>
    <div class="separator"></div>
    <div class="cboth"></div>
  </div>
</template>
