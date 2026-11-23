<script setup lang="ts">
import { DEMO } from '@/config';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import {
  DEFAULT_DEMO_SETTINGS,
  DEMO_LIMITS,
  DEMO_SOURCES,
  PROTECTED_ACCESS,
  type ProtectedAccess,
  isKindCount,
  isListSize,
  isDemoCredit,
  isPercent,
  type DemoSettings,
  type DemoSource,
  type DemoStates,
} from '@/demo/demo-settings';
import { RUNNING_PLAN_STAGES, type RunningPlanStage } from '@/demo/demo-running-plan';
import { MELT_CHECK_OUTCOMES, type MeltCheckOutcome } from '@/demo/demo-melt-check';
import { TOKEN_RENEWAL_CASES, type TokenRenewalCase } from '@/demo/demo-token-renewal';
import type { DemoComposition } from '@/demo/generate-hangar';
import { newDemoHangar, resetDemoData } from '@/demo/use-demo';
import { CREDIT_CASES, creditForCases, type CreditCase } from '@/demo/demo-store-credit';
import { maybePaintConsultant } from '@/store/paint-consultant/use-paint-consultant';
import { formatUsd } from '@/hangar/discount-format';
import { locale } from '@/i18n';
import { computed, ref } from 'vue';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import type { Settings } from '../settings';

/*
 * The demo mode and its own settings (#178), dimmed while it is off: where the demo hangar comes
 * from, its size and composition, the states of its pledges, a new random hangar and a reset.
 * Changes apply at once.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const demo = () => props.settings.demo;
const off = computed(() => !props.settings.demoMode);
const set = (patch: Partial<DemoSettings>) => emit('update', { demo: { ...demo(), ...patch } });
const setStates = (patch: Partial<DemoStates>) => set({ states: { ...demo().states, ...patch } });

const KINDS = Object.keys(DEFAULT_DEMO_SETTINGS.composition) as (keyof DemoComposition)[];
const STATE_CHECKS = ['refund', 'upgraded', 'justBought', 'meltMarks', 'runningEvent'] as const;

/** A whole number in range is stored; anything else snaps back to the stored value. */
function number(event: Event, isValid: (value: unknown) => value is number, stored: number) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (isValid(value)) return value;
  input.value = String(stored);
  return undefined;
}
function setKind(event: Event, kind: keyof DemoComposition) {
  const value = number(event, isKindCount, demo().composition[kind]);
  if (value !== undefined) set({ composition: { ...demo().composition, [kind]: value } });
}
function setList(event: Event, key: 'buybackPledges' | 'ownHangarPledges') {
  const value = number(event, isListSize, demo()[key]);
  if (value !== undefined) set({ [key]: value });
}
function setPercent(event: Event, key: 'notGiftablePercent' | 'notMeltablePercent') {
  const value = number(event, isPercent, demo().states[key]);
  if (value !== undefined) setStates({ [key]: value });
}

// The store credit of the demo (#179), with a quick choice for each case of the consultant.
function setCredit(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Math.round(Number(input.value) * 100) / 100;
  if (isDemoCredit(value)) set({ storeCredit: value });
  else input.value = String(demo().storeCredit);
}
const consultant = maybePaintConsultant();
const creditCases = computed((): Partial<Record<CreditCase, number>> => {
  const items = consultant?.storeItems.value;
  if (!consultant || !items) return { none: 0 };
  const { useFillers, skipGiftable } = props.settings.paintConsultant;
  return creditForCases(consultant.pledges.value, items, { useFillers, skipGiftable });
});

/** What the last button did, shown below the buttons. */
const done = ref<'newHangar' | 'reset'>();
async function createNewHangar() {
  await newDemoHangar();
  done.value = 'newHangar';
}
async function reset() {
  set(structuredClone(DEFAULT_DEMO_SETTINGS));
  await resetDemoData();
  done.value = 'reset';
}
</script>

<template>
  <p class="shm-settings-intro">{{ i18n.t('settings.demo.hint') }}</p>
  <SettingsGroup>
    <SettingCheck
      :checked="settings.demoMode"
      :hint="i18n.t('settings.demoModeHint')"
      @change="(demoMode) => emit('update', { demoMode })"
    >
      {{ i18n.t('settings.demoMode') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The demo's own settings (#178), dimmed while it is off. -->
  <SettingsGroup :title="i18n.t('settings.demo.hangar')" :disabled="off">
    <template v-if="settings.demo.source === 'generated'" #action>
      <button type="button" class="shm-link-button" :disabled="off" @click="createNewHangar">
        {{ i18n.t('settings.demo.newHangar') }}
      </button>
    </template>
    <SettingRow :label="i18n.t('settings.demo.source')" for="shm-demo-source">
      <select
        id="shm-demo-source"
        class="shm-select"
        :value="settings.demo.source"
        :disabled="off"
        @change="set({ source: ($event.target as HTMLSelectElement).value as DemoSource })"
      >
        <option v-for="source in DEMO_SOURCES" :key="source" :value="source">
          {{ i18n.t(`settings.demo.sources.${source}`) }}
        </option>
      </select>
    </SettingRow>
    <SettingRow
      v-if="settings.demo.source === 'generated'"
      :label="i18n.t('settings.demo.composition')"
    >
      <template #below>
        <div class="shm-demo-grid">
          <label v-for="kind in KINDS" :key="kind" class="shm-demo-number">
            <span>{{ i18n.t(`settings.demo.kinds.${kind}`) }}</span>
            <input
              class="shm-input shm-number"
              type="number"
              inputmode="numeric"
              :min="DEMO_LIMITS.kind.min"
              :max="DEMO_LIMITS.kind.max"
              step="1"
              :value="settings.demo.composition[kind]"
              :disabled="off"
              @change="setKind($event, kind)"
            />
          </label>
        </div>
      </template>
    </SettingRow>
    <SettingRow
      v-if="settings.demo.source === 'own'"
      :label="i18n.t('settings.demo.ownHangarPledges')"
      for="shm-demo-own"
    >
      <input
        id="shm-demo-own"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="DEMO_LIMITS.list.min"
        :max="DEMO_LIMITS.list.max"
        step="1"
        :value="settings.demo.ownHangarPledges"
        :disabled="off"
        @change="setList($event, 'ownHangarPledges')"
      />
    </SettingRow>
    <SettingRow :label="i18n.t('settings.demo.buybackPledges')" for="shm-demo-buyback">
      <input
        id="shm-demo-buyback"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="DEMO_LIMITS.list.min"
        :max="DEMO_LIMITS.list.max"
        step="1"
        :value="settings.demo.buybackPledges"
        :disabled="off"
        @change="setList($event, 'buybackPledges')"
      />
    </SettingRow>
  </SettingsGroup>

  <SettingsGroup
    v-if="settings.demo.source === 'generated'"
    :title="i18n.t('settings.demo.states')"
    :disabled="off"
  >
    <SettingRow
      :label="i18n.t('settings.demo.stateChecks.protectedAccess')"
      for="shm-demo-protected"
    >
      <select
        id="shm-demo-protected"
        class="shm-select"
        :value="settings.demo.states.protectedAccess"
        :disabled="off"
        @change="
          setStates({
            protectedAccess: ($event.target as HTMLSelectElement).value as ProtectedAccess,
          })
        "
      >
        <option v-for="access in PROTECTED_ACCESS" :key="access" :value="access">
          {{ i18n.t(`settings.demo.protectedAccessOptions.${access}`) }}
        </option>
      </select>
    </SettingRow>
    <SettingCheck
      v-for="state in STATE_CHECKS"
      :key="state"
      :checked="settings.demo.states[state]"
      :disabled="off"
      @change="(on) => setStates({ [state]: on })"
    >
      {{ i18n.t(`settings.demo.stateChecks.${state}`) }}
    </SettingCheck>
    <SettingRow
      v-for="key in ['notGiftablePercent', 'notMeltablePercent'] as const"
      :key="key"
      :label="i18n.t(`settings.demo.${key}`)"
      :for="`shm-demo-${key}`"
    >
      <span class="shm-number-field">
        <input
          :id="`shm-demo-${key}`"
          class="shm-input shm-number"
          type="number"
          inputmode="numeric"
          :min="DEMO_LIMITS.percent.min"
          :max="DEMO_LIMITS.percent.max"
          step="1"
          :value="settings.demo.states[key]"
          :disabled="off"
          @change="setPercent($event, key)"
        />
        %
      </span>
    </SettingRow>
  </SettingsGroup>

  <!-- The Pledge Store tab with the real, public offers (#310). -->
  <SettingsGroup :disabled="off">
    <SettingCheck
      :checked="settings.demo.realStoreData"
      :disabled="off"
      :hint="i18n.t('settings.demo.realStoreDataHint')"
      @change="(on) => set({ realStoreData: on })"
    >
      {{ i18n.t('settings.demo.realStoreData') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The CCU Consultant's cases (#425): its box and tabs with and without CCUs. -->
  <SettingsGroup :disabled="off">
    <SettingCheck
      v-for="key in ['ccuCoverageGaps', 'ccuDiscountAtRisk'] as const"
      :key="key"
      :checked="settings.demo[key]"
      :disabled="off"
      :hint="i18n.t(`settings.demo.${key}Hint`)"
      @change="(on) => set({ [key]: on })"
    >
      {{ i18n.t(`settings.demo.${key}`) }}
    </SettingCheck>
  </SettingsGroup>

  <!-- Melt and Rebuy (#532): its List Shortcut with pledges and empty. -->
  <SettingsGroup :disabled="off">
    <SettingCheck
      :checked="settings.demo.rebuyable"
      :disabled="off"
      :hint="i18n.t('settings.demo.rebuyableHint')"
      @change="(on) => set({ rebuyable: on })"
    >
      {{ i18n.t('settings.demo.rebuyable') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The watchlists (#474): what a watchlist's dialog says of browser notifications (#469). -->
  <SettingsGroup :disabled="off">
    <SettingCheck
      :checked="settings.demo.browserNotifications"
      :disabled="off"
      :hint="i18n.t('settings.demo.browserNotificationsHint')"
      @change="(on) => set({ browserNotifications: on })"
    >
      {{ i18n.t('settings.demo.browserNotifications') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The synced storage of the stored data almost full, with its warning (#560). -->
  <SettingsGroup :disabled="off">
    <SettingCheck
      :checked="settings.demo.syncedNearLimit"
      :disabled="off"
      :hint="i18n.t('settings.demo.syncedNearLimitHint')"
      @change="(on) => set({ syncedNearLimit: on })"
    >
      {{ i18n.t('settings.demo.syncedNearLimit') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The buy back tokens at the top right, also none (#433). -->
  <SettingsGroup :disabled="off">
    <SettingRow
      :label="i18n.t('settings.demo.buybackTokens')"
      :hint="i18n.t('settings.demo.buybackTokensHint')"
      for="shm-demo-tokens"
      hint-id="shm-demo-tokens-hint"
    >
      <select
        id="shm-demo-tokens"
        class="shm-select"
        :value="settings.demo.buybackTokens"
        :disabled="off"
        aria-describedby="shm-demo-tokens-hint"
        @change="set({ buybackTokens: Number(($event.target as HTMLSelectElement).value) })"
      >
        <option v-for="count in DEMO.maxBuybackTokens + 1" :key="count" :value="count - 1">
          {{ count - 1 }}
        </option>
      </select>
    </SettingRow>
    <!-- The next renewal of the tokens in their tooltip (#434). -->
    <SettingRow
      :label="i18n.t('settings.demo.tokenRenewal')"
      :hint="i18n.t('settings.demo.tokenRenewalHint')"
      for="shm-demo-token-renewal"
      hint-id="shm-demo-token-renewal-hint"
    >
      <select
        id="shm-demo-token-renewal"
        class="shm-select"
        :value="settings.demo.tokenRenewal"
        :disabled="off"
        aria-describedby="shm-demo-token-renewal-hint"
        @change="
          set({ tokenRenewal: ($event.target as HTMLSelectElement).value as TokenRenewalCase })
        "
      >
        <option v-for="kind in TOKEN_RENEWAL_CASES" :key="kind" :value="kind">
          {{ i18n.t(`settings.demo.tokenRenewalCases.${kind}`) }}
        </option>
      </select>
    </SettingRow>
  </SettingsGroup>

  <!-- The paint discount note in RSI's cart (#458, #459): the demo's own cart. -->
  <SettingsGroup :disabled="off">
    <SettingRow
      :label="i18n.t('settings.demo.cartPaints')"
      :hint="i18n.t('settings.demo.cartPaintsHint')"
      for="shm-demo-cart-paints"
      hint-id="shm-demo-cart-paints-hint"
    >
      <select
        id="shm-demo-cart-paints"
        class="shm-select"
        :value="settings.demo.cartPaints"
        :disabled="off"
        aria-describedby="shm-demo-cart-paints-hint"
        @change="set({ cartPaints: Number(($event.target as HTMLSelectElement).value) })"
      >
        <option v-for="count in 10" :key="count" :value="count">{{ count }}</option>
      </select>
    </SettingRow>
  </SettingsGroup>

  <!-- The check right before bulk melting (#415, #416). -->
  <SettingsGroup :disabled="off">
    <SettingRow
      :label="i18n.t('settings.demo.meltCheck')"
      :hint="i18n.t('settings.demo.meltCheckHint')"
      for="shm-demo-melt-check"
      hint-id="shm-demo-melt-check-hint"
    >
      <select
        id="shm-demo-melt-check"
        class="shm-select"
        :value="settings.demo.meltCheck"
        :disabled="off"
        aria-describedby="shm-demo-melt-check-hint"
        @change="set({ meltCheck: ($event.target as HTMLSelectElement).value as MeltCheckOutcome })"
      >
        <option v-for="outcome in MELT_CHECK_OUTCOMES" :key="outcome" :value="outcome">
          {{ i18n.t(`settings.demo.meltCheckOutcomes.${outcome}`) }}
        </option>
      </select>
    </SettingRow>
  </SettingsGroup>

  <SettingsGroup :disabled="off">
    <SettingRow :label="i18n.t('settings.demo.runningPlanStage')" for="shm-demo-plan-stage">
      <select
        id="shm-demo-plan-stage"
        class="shm-select"
        :value="settings.demo.runningPlanStage"
        :disabled="off"
        @change="
          set({ runningPlanStage: ($event.target as HTMLSelectElement).value as RunningPlanStage })
        "
      >
        <option v-for="stage in RUNNING_PLAN_STAGES" :key="stage" :value="stage">
          {{ i18n.t(`settings.demo.runningPlanStages.${stage}`) }}
        </option>
      </select>
    </SettingRow>
    <!-- With the stage: each set of the consultant's tabs (#306). -->
    <SettingCheck
      v-for="key in ['newPlan', 'completedPlans'] as const"
      :key="key"
      :checked="settings.demo[key]"
      :disabled="off"
      @change="(on) => set({ [key]: on })"
    >
      {{ i18n.t(`settings.demo.${key}`) }}
    </SettingCheck>
    <SettingRow
      :label="i18n.t('settings.demo.storeCredit')"
      :hint="i18n.t('settings.demo.storeCreditHint')"
      for="shm-demo-credit"
      hint-id="shm-demo-credit-hint"
    >
      <span class="shm-number-field">
        <input
          id="shm-demo-credit"
          class="shm-input shm-number"
          type="number"
          inputmode="decimal"
          min="0"
          :max="DEMO_LIMITS.storeCredit"
          step="0.01"
          :value="settings.demo.storeCredit"
          :disabled="off"
          aria-describedby="shm-demo-credit-hint"
          @change="setCredit"
        />
        USD
      </span>
      <template #below>
        <div
          class="shm-setting-actions"
          role="group"
          :aria-label="i18n.t('settings.demo.creditCases')"
        >
          <button
            v-for="kind in CREDIT_CASES"
            :key="kind"
            type="button"
            class="shm-button"
            :aria-pressed="creditCases[kind] === settings.demo.storeCredit"
            :disabled="off || creditCases[kind] === undefined"
            @click="set({ storeCredit: creditCases[kind]! })"
          >
            {{ i18n.t(`settings.demo.creditCase.${kind}`) }}
            <template v-if="creditCases[kind] !== undefined">
              ({{ formatUsd(creditCases[kind]!, locale) }})
            </template>
          </button>
        </div>
      </template>
    </SettingRow>
  </SettingsGroup>

  <SettingsGroup :disabled="off">
    <SettingRow :label="i18n.t('settings.demo.reset')" :hint="i18n.t('settings.demo.resetHint')">
      <button type="button" class="shm-button" :disabled="off" @click="reset">
        <SvgIcon name="rotate-left" />
        {{ i18n.t('settings.demo.reset') }}
      </button>
    </SettingRow>
    <template #after>
      <p v-if="done" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t(`settings.demo.done.${done}`) }}
      </p>
    </template>
  </SettingsGroup>
</template>

<style scoped>
.shm-demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px 16px;
}

.shm-demo-number {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--shm-text-secondary);
}

.shm-setting-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
