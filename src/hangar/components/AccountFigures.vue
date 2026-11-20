<script setup lang="ts">
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useStored } from '@/storage/use-stored';
import { useNow } from '@/shared/use-now';
import TokensCard from '@/buyback-tokens/components/TokensCard.vue';
import { nextTokenRenewal } from '@/buyback-tokens/token-renewals';
import { renewalText } from '@/buyback-tokens/renewal-text';
import { storedTokenRenewals, tokenRenewalsItem } from '@/buyback-tokens/token-renewals-storage';
import { computed } from 'vue';

/*
 * The account's figures at the top right of the manager, above the refresh button, on every tab
 * (#156): the store credit and the buy back tokens left. Each is an icon and its value; the
 * tooltip names it and explains it – the tokens' also when RSI renews them next, with a link to the
 * source of that date (#434), so it is a tooltip to act in, reachable with the keyboard.
 */

const props = defineProps<{
  /** Buy back tokens left; unset if unknown (left out then). */
  tokens?: number;
  /** "Hide melt value": the store credit is a dollar amount, so it is hidden, too. */
  hideAmounts: boolean;
}>();

// The demo mode shows a made-up store credit instead of the account's.
const storedCredit = useStored(storeCreditItem);
const demo = useDemoContext();
const credit = computed(() => {
  const stored = storedCredit.value;
  const value =
    demo.value?.storeCredit ??
    (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
  if (!value) return undefined;
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amount);
});

const tokenCount = computed(() =>
  props.tokens === undefined ? undefined : new Intl.NumberFormat(locale.value).format(props.tokens),
);

const tip = (label: string, hint: string) => `${label}\n${hint}`;

/** The next renewal of the tokens: the website's, in the demo the one of its settings. */
const storedRenewals = useStored(tokenRenewalsItem);
const now = useNow();
const renewal = computed(() => {
  const own = demo.value?.tokenRenewal;
  if (own !== undefined) return own ?? undefined;
  return nextTokenRenewal(storedTokenRenewals(storedRenewals.value ?? null), now.value);
});
const tokensTip = computed(() => {
  const label = i18n.t('buyback.tokens', [tokenCount.value ?? '']);
  const hint = i18n.t('buyback.tokensHint');
  if (!renewal.value) return tip(label, hint);
  return {
    text: `${tip(label, hint)}\n${renewalText(renewal.value, locale.value)}`,
    card: { component: TokensCard, props: { label, hint, renewal: renewal.value } },
    interactive: true,
  };
});
</script>

<template>
  <dl v-if="!hideAmounts || tokenCount !== undefined" class="shm-account-figures">
    <div
      v-if="!hideAmounts"
      v-tooltip="
        tip(`${i18n.t('summary.storeCredit')}: ${credit ?? '–'}`, i18n.t('manager.storeCreditHint'))
      "
      class="shm-account-figure"
    >
      <dt>
        <SvgIcon name="money-check-dollar" />
        <span class="shm-visually-hidden">{{ i18n.t('summary.storeCredit') }}</span>
      </dt>
      <dd>{{ credit ?? '–' }}</dd>
    </div>
    <div
      v-if="tokenCount !== undefined"
      v-tooltip="tokensTip"
      class="shm-account-figure"
      :tabindex="renewal ? 0 : undefined"
    >
      <dt>
        <SvgIcon name="buyback-token" set="custom" />
        <span class="shm-visually-hidden">{{ i18n.t('buyback.tokensLabel') }}</span>
      </dt>
      <dd>{{ tokenCount }}</dd>
    </div>
  </dl>
</template>

<style scoped>
/* One line of figures, right-aligned above the refresh button; wraps on narrow widths. */
.shm-account-figures {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 16px;
  margin: 0;
  font-size: calc(13px * var(--shm-font-scale));
  line-height: calc(18px * var(--shm-font-scale));
}

.shm-account-figure {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: help;
}

.shm-account-figure dt,
.shm-account-figure dd {
  display: inline-flex;
  align-items: center;
  margin: 0;
}

.shm-account-figure dd {
  color: var(--shm-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.shm-account-figure .shm-icon {
  color: var(--shm-accent);
  font-size: 1.3em;
}

.shm-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
