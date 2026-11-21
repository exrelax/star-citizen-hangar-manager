<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import '@/shared/styles/switch.css';
import '../watchlists.css';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import {
  browserNotificationsItem,
  OPEN_NOTIFICATION_PERMISSION,
} from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { useStored } from '@/storage/use-stored';
import { fromLocalInput, toLocalInput } from '../watchlist-view';
import { WATCHLIST_LIMITS, type Watchlist } from '../watchlists';

/*
 * Creating a watchlist or editing one (#467): its name, description and optional date with time,
 * and whether a reminder comes at that date (#469). Saving is the parent's: a write that doesn't
 * fit into the synced storage comes back as `error`, and the dialog stays open.
 */

const props = defineProps<{
  /** The watchlist to edit; a new one without. */
  list?: Watchlist;
  /** Why saving failed, e.g. the synced storage is full. */
  error?: string;
  /** While saving. */
  busy?: boolean;
}>();
const emit = defineEmits<{
  save: [fields: { name: string; description: string; dueAt: number | null; reminder: boolean }];
  close: [];
}>();

const { settings } = useSettings();
const id = useId();

const name = ref(props.list?.name ?? '');
const description = ref(props.list?.description ?? '');
const due = ref(props.list?.dueAt !== undefined ? toLocalInput(props.list.dueAt) : '');
// A new list with a date reminds by default, as `createWatchlist` does.
const reminder = ref(props.list?.reminder ?? true);
const dueAt = computed(() => fromLocalInput(due.value));
const canSave = computed(() => !!name.value.trim() && !props.busy);

/*
 * Where the reminder goes (#469): the sidebar always, the browser only with its permission, which
 * the browser asks for on the extension's page (`browser-permission.ts`); nowhere with the kind
 * turned off in the settings (#197).
 */
const allowed = useStored(browserNotificationsItem);
const kindOn = computed(() => isKindOn(settings.value.notificationsOff, 'watchlistReminders'));
const asked = ref(false);
function allowBrowser() {
  asked.value = true;
  void browser.runtime.sendMessage(OPEN_NOTIFICATION_PERMISSION);
}

function save() {
  if (!canSave.value) return;
  emit('save', {
    name: name.value,
    description: description.value,
    dueAt: dueAt.value ?? null,
    reminder: dueAt.value !== undefined && reminder.value,
  });
}

const nameInput = useTemplateRef<HTMLInputElement>('nameInput');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => {
  addEventListener('keydown', onKeydown);
  nameInput.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="shm-overlay"
      :class="themeClasses(settings)"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        class="shm-overlay-dialog shm-watchlist-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3 :id="`${id}-title`">
            {{ i18n.t(list ? 'watchlists.editTitle' : 'watchlists.newTitle') }}
          </h3>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <form class="shm-watchlist-form" @submit.prevent="save">
          <label class="shm-watchlist-field">
            <span class="shm-watchlist-label">{{ i18n.t('watchlists.name') }}</span>
            <input
              ref="nameInput"
              v-model="name"
              class="shm-watchlist-input"
              type="text"
              required
              :maxlength="WATCHLIST_LIMITS.name"
              :placeholder="i18n.t('watchlists.namePlaceholder')"
              autocomplete="off"
              data-1p-ignore
            />
          </label>
          <label class="shm-watchlist-field">
            <span class="shm-watchlist-label">{{ i18n.t('watchlists.description') }}</span>
            <textarea
              v-model="description"
              class="shm-watchlist-input shm-watchlist-textarea"
              rows="3"
              :maxlength="WATCHLIST_LIMITS.description"
              :placeholder="i18n.t('watchlists.descriptionPlaceholder')"
            ></textarea>
          </label>
          <div class="shm-watchlist-field">
            <label class="shm-watchlist-label" :for="`${id}-due`">
              {{ i18n.t('watchlists.date') }}
            </label>
            <span class="shm-watchlist-date">
              <input
                :id="`${id}-due`"
                v-model="due"
                class="shm-watchlist-input"
                type="datetime-local"
                :aria-describedby="`${id}-due-hint`"
              />
              <button
                v-if="due"
                v-tooltip="i18n.t('watchlists.clearDate')"
                type="button"
                class="shm-watchlist-clear"
                :aria-label="i18n.t('watchlists.clearDate')"
                @click="due = ''"
              >
                <SvgIcon name="circle-xmark" />
              </button>
            </span>
            <span :id="`${id}-due-hint`" class="shm-hint">{{ i18n.t('watchlists.dateHint') }}</span>
          </div>
          <label class="shm-watchlist-reminder" :class="{ 'is-disabled': dueAt === undefined }">
            <span class="shm-watchlist-reminder-text">
              <span>{{ i18n.t('watchlists.reminder') }}</span>
              <span class="shm-hint">{{ i18n.t('watchlists.reminderHint') }}</span>
            </span>
            <input
              v-model="reminder"
              type="checkbox"
              role="switch"
              class="shm-switch"
              :disabled="dueAt === undefined"
            />
          </label>
          <div
            v-if="dueAt !== undefined && reminder"
            class="shm-watchlist-reminder-status"
            role="status"
          >
            <template v-if="!kindOn">{{ i18n.t('watchlists.reminderKindOff') }}</template>
            <template v-else-if="allowed">{{ i18n.t('watchlists.reminderBrowserOn') }}</template>
            <template v-else>
              <span>
                {{
                  i18n.t(
                    asked ? 'watchlists.reminderBrowserAsked' : 'watchlists.reminderBrowserOff',
                  )
                }}
              </span>
              <button type="button" class="shm-button" @click="allowBrowser">
                <SvgIcon name="bell" />
                {{ i18n.t('watchlists.reminderBrowserAllow') }}
              </button>
            </template>
          </div>
          <p v-if="error" class="shm-overlay-note is-error" role="alert">{{ error }}</p>
          <div class="shm-watchlist-actions">
            <button type="button" class="shm-button" @click="emit('close')">
              {{ i18n.t('watchlists.cancel') }}
            </button>
            <button type="submit" class="shm-button is-prominent" :disabled="!canSave">
              {{ i18n.t(list ? 'watchlists.save' : 'watchlists.create') }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>
<style src="@/hangar/components/row.css"></style>

<style>
.shm-watchlist-dialog.shm-overlay-dialog {
  width: min(calc(480px * var(--shm-font-scale)), 100%);
}

.shm-watchlist-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shm-watchlist-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shm-watchlist-label {
  color: var(--shm-text);
}

.shm-watchlist-textarea {
  resize: vertical;
}

.shm-watchlist-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shm-watchlist-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-watchlist-clear:hover,
.shm-watchlist-clear:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-watchlist-reminder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.shm-watchlist-reminder.is-disabled {
  opacity: 0.5;
  cursor: default;
}

.shm-watchlist-reminder-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: -6px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-watchlist-reminder-status .shm-button {
  min-height: 28px;
}

.shm-watchlist-reminder-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--shm-text);
}

/* As in an alert: the button that goes ahead on the right, "Cancel" left of it. */
.shm-watchlist-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.shm-watchlist-actions .shm-button {
  min-height: 32px;
  padding: 6px 14px;
}
</style>
