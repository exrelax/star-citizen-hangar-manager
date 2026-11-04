import { i18n, translate, type MessageKey } from '@/i18n';
import { useSettings } from '@/settings/use-settings';

/*
 * RSI's own texts in the exchange and gift dialogs (the dialogs' introductions, buy back notes,
 * acknowledgements, RSI's field labels and confirmations). They are shown as RSI writes them, in
 * English: RSI's wording is what counts, and the translations follow changes to it only later.
 * The setting `translateRsiTexts` shows them translated instead. The manager's own additions
 * (warnings, summary, buttons) are always translated.
 */
export function rsiText(
  translated: boolean,
  key: MessageKey,
  substitutions?: readonly (string | number)[],
): string {
  return translated ? i18n.t(key, substitutions) : translate('en', key, substitutions);
}

/** `rsiText` following the setting. */
export function useRsiText() {
  const { settings } = useSettings();
  return (key: MessageKey, substitutions?: readonly (string | number)[]) =>
    rsiText(settings.value.translateRsiTexts, key, substitutions);
}
