<script setup lang="ts">
import { HANGAR_PAGE_SIZE, PLEDGE_STORE, SMART_UPDATE, STORE_ITEMS } from '@/config';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { useDemoContext } from '@/demo/use-demo';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { spotCheckCoverage } from '@/hangar/smart-update/check';
import { i18n, locale } from '@/i18n';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import SettingCheck from '../SettingCheck.vue';
import {
  isRefreshMinutes,
  isSmartUpdateMinutes,
  isSpotCheckPages,
  type Settings,
} from '../settings';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const storeRange = PLEDGE_STORE.refreshMinutes;
const checkRange = SMART_UPDATE.checkMinutes;
const spotRange = SMART_UPDATE.spotCheckPages;

/** The schedule of the Pledge Store around the full hour, e.g. "xx:59", "xx:00, xx:05 and xx:10". */
const atMinute = (minute: number) => `xx:${String(minute).padStart(2, '0')}`;
const storeHint = computed(() =>
  i18n.t('settings.storeRefreshHint', [
    storeRange.min,
    storeRange.max,
    atMinute(PLEDGE_STORE.fastWindow.from),
    atMinute(PLEDGE_STORE.fastWindow.to),
    PLEDGE_STORE.fastWindow.everyMs / 1000,
    new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
      STORE_ITEMS.readAtMinutes.map(atMinute),
    ),
  ]),
);

type NumberKey = 'storeRefreshMinutes' | 'smartUpdateMinutes' | 'spotCheckPages';
const VALID: Record<NumberKey, (value: unknown) => value is number> = {
  storeRefreshMinutes: isRefreshMinutes,
  smartUpdateMinutes: isSmartUpdateMinutes,
  spotCheckPages: isSpotCheckPages,
};

/** Stores whole numbers in range; anything else snaps back to the stored value. */
function changeNumber(event: Event, key: NumberKey) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (VALID[key](value)) emit('update', { [key]: value });
  else input.value = String(props.settings[key]);
}

// The number of hangar pages, for the chance to find a change in the next check.
const hangarPages = ref<number>();
const applySnapshot = (snapshot: HangarSnapshot | null) => {
  hangarPages.value =
    snapshot?.version === HANGAR_SNAPSHOT_VERSION
      ? Math.max(1, Math.ceil(snapshot.pledges.length / HANGAR_PAGE_SIZE))
      : undefined;
};
const unwatch = hangarSnapshot.watch(applySnapshot);
onMounted(async () => applySnapshot(await hangarSnapshot.getValue()));
onUnmounted(unwatch);

/** e.g. "45 minutes", "4 hours", "2 days", in the language of the manager. */
function formatDuration(minutes: number) {
  const [value, unit] =
    minutes < 120
      ? [minutes, 'minute']
      : minutes < 48 * 60
        ? [Math.round(minutes / 60), 'hour']
        : [Math.round(minutes / (24 * 60)), 'day'];
  return new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit,
    unitDisplay: 'long',
  }).format(value);
}

// The demo mode counts the demo hangar's pages (#132), not the real one's.
const demo = useDemoContext();
const spotHint = computed(() => {
  const pages = demo.value?.storage.hangarPages ?? hangarPages.value;
  if (pages === undefined) return i18n.t('settings.spotChecksHintNoData');
  const { settings } = props;
  const coverage = spotCheckCoverage(pages, settings.spotCheckPages);
  const percent = new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: coverage.share < 0.1 ? 1 : 0,
  }).format(coverage.share);
  return i18n.t('settings.spotChecksHint', [
    coverage.checked,
    coverage.pages,
    percent,
    coverage.checksToCoverAll,
    formatDuration(coverage.checksToCoverAll * settings.smartUpdateMinutes),
  ]);
});
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.smartUpdates') }}</legend>
    <SettingCheck
      :checked="settings.smartUpdates"
      :hint="i18n.t('settings.smartUpdatesHint')"
      @change="(smartUpdates) => emit('update', { smartUpdates })"
    >
      {{ i18n.t('settings.smartUpdatesLists') }}
    </SettingCheck>

    <label class="shm-field-label" for="shm-smart-update-interval">
      {{ i18n.t('settings.smartUpdateInterval') }}
    </label>
    <span class="shm-number-field">
      <input
        id="shm-smart-update-interval"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="checkRange.min"
        :max="checkRange.max"
        step="1"
        :value="settings.smartUpdateMinutes"
        :disabled="!settings.smartUpdates"
        aria-describedby="shm-smart-update-interval-hint"
        @change="changeNumber($event, 'smartUpdateMinutes')"
      />
      {{ i18n.t('settings.minutes') }}
    </span>
    <p id="shm-smart-update-interval-hint" class="shm-hint">
      {{
        i18n.t('settings.smartUpdateIntervalHint', [
          checkRange.min,
          checkRange.max,
          SMART_UPDATE.backoff.maxFactor,
        ])
      }}
    </p>

    <label class="shm-field-label" for="shm-spot-checks">
      {{ i18n.t('settings.spotChecks') }}
    </label>
    <span class="shm-number-field">
      <input
        id="shm-spot-checks"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="spotRange.min"
        :max="spotRange.max"
        step="1"
        :value="settings.spotCheckPages"
        :disabled="!settings.smartUpdates"
        aria-describedby="shm-spot-checks-hint"
        @change="changeNumber($event, 'spotCheckPages')"
      />
      {{ i18n.t('settings.pages') }}
    </span>
    <p id="shm-spot-checks-hint" class="shm-hint">
      {{ spotHint }} {{ i18n.t('settings.spotChecksRange', [spotRange.min, spotRange.max]) }}
    </p>

    <label class="shm-field-label" for="shm-store-refresh">
      {{ i18n.t('settings.storeRefresh') }}
    </label>
    <span class="shm-number-field">
      <input
        id="shm-store-refresh"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="storeRange.min"
        :max="storeRange.max"
        step="1"
        :value="settings.storeRefreshMinutes"
        :disabled="!settings.smartUpdates"
        aria-describedby="shm-store-refresh-hint"
        @change="changeNumber($event, 'storeRefreshMinutes')"
      />
      {{ i18n.t('settings.minutes') }}
    </span>
    <p id="shm-store-refresh-hint" class="shm-hint">
      {{ storeHint }}
    </p>
  </fieldset>
</template>
