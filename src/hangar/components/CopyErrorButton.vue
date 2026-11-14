<script setup lang="ts">
import { i18n } from '@/i18n';
import { extensionVersion } from '@/shared/extension-version';
import { onUnmounted, ref } from 'vue';
import { syncErrorReport } from '../sync-error';
import type { SyncError } from '../sync-state';

/*
 * "Copy details" of a failed sync (#334): puts the error, without account data, on the clipboard
 * for a bug report, and says "Copied" for a moment. Styled by its parent (`class`).
 */

const props = defineProps<{ error: SyncError }>();

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(timer));

async function copy() {
  const report = syncErrorReport(props.error, {
    version: extensionVersion(),
    userAgent: navigator.userAgent,
  });
  try {
    await navigator.clipboard.writeText(report);
  } catch (error) {
    console.warn('[star-citizen-hangar-manager] Copying the error failed', error);
    return;
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <button type="button" aria-live="polite" @click="copy">
    {{ copied ? i18n.t('status.copied') : i18n.t('status.copyDetails') }}
  </button>
</template>
