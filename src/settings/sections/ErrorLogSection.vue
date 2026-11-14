<script setup lang="ts">
import {
  clearErrorLog,
  errorLogItem,
  formatErrorLog,
  ERROR_LOG_MAX,
  ERROR_LOG_VERSION,
} from '@/errors/error-log';
import { REPOSITORY_LINKS } from '@/config';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useStored } from '@/storage/use-stored';
import { computed, onUnmounted, ref } from 'vue';
import type { Settings } from '../settings';
import SettingsGroup from '../SettingsGroup.vue';

/*
 * The error log (#340): the errors the Hangar Manager handled, newest first, read-only, to copy
 * into a bug report. The copy never holds pledge or order ids; the demo mode doesn't show them
 * either (#132).
 */

const props = defineProps<{ settings: Settings }>();

const log = useStored(errorLogItem);
const count = computed(() =>
  log.value?.version === ERROR_LOG_VERSION ? log.value.entries.length : 0,
);
const text = computed(() => formatErrorLog(log.value ?? null, props.settings.demoMode));

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(timer));

async function copy() {
  try {
    await navigator.clipboard.writeText(formatErrorLog(log.value ?? null, true));
  } catch (error) {
    console.warn('[star-citizen-hangar-manager] Copying the error log failed', error);
    return;
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 2000);
}

function clear() {
  if (confirm(i18n.t('errorLog.clearConfirm'))) void clearErrorLog();
}
</script>

<template>
  <p class="shm-settings-intro">
    {{ i18n.t('errorLog.intro', [ERROR_LOG_MAX]) }}
    <a :href="REPOSITORY_LINKS.errorCodes" target="_blank" rel="noopener noreferrer">{{
      i18n.t('errorLog.codesLink')
    }}</a>
  </p>
  <SettingsGroup :footer="i18n.n('errorLog.count', count)">
    <template #action>
      <span class="shm-error-log-actions">
        <button type="button" class="shm-button" :disabled="!count" @click="copy">
          {{ copied ? i18n.t('status.copied') : i18n.t('errorLog.copy') }}
        </button>
        <button
          v-tooltip="i18n.t('errorLog.clear')"
          type="button"
          class="shm-button is-danger is-icon"
          :disabled="!count"
          :aria-label="i18n.t('errorLog.clear')"
          @click="clear"
        >
          <SvgIcon name="trash" />
        </button>
      </span>
    </template>
    <textarea
      class="shm-error-log"
      readonly
      rows="14"
      wrap="off"
      spellcheck="false"
      :aria-label="i18n.t('settings.errorLog')"
      :value="text || i18n.t('errorLog.empty')"
    ></textarea>
  </SettingsGroup>
</template>

<style scoped>
.shm-error-log-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.shm-error-log {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 160px;
  margin: 0;
  padding: 10px 12px;
  color: var(--shm-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(11px * var(--shm-font-scale));
  line-height: 1.5;
  background: transparent;
  border: 0;
  resize: vertical;
}

.shm-error-log:focus-visible {
  outline: 2px solid rgb(var(--shm-accent-rgb) / 0.6);
  outline-offset: -2px;
}
</style>
