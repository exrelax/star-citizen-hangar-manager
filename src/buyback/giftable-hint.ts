import { BUYBACK_GIFTABLE_PURCHASED_BEFORE } from '@/config';
import { i18n, locale } from '@/i18n';
import { computed } from 'vue';

/**
 * Explanation of "probably giftable", shared by all rows: formatting the date is costly, and the
 * text only changes with the language.
 */
export const giftableHint = computed(() =>
  i18n.t('buyback.probablyGiftableHint', [giftingRulesDate.value]),
);

/** The date RSI's gifting rules changed (`BUYBACK_GIFTABLE_PURCHASED_BEFORE`), in the language. */
export const giftingRulesDate = computed(() =>
  new Date(BUYBACK_GIFTABLE_PURCHASED_BEFORE).toLocaleDateString(locale.value, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }),
);
