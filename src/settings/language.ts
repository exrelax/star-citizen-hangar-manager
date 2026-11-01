import { browserLocale, setLocale, type Locale } from '@/i18n';
import { settingsItem, withDefaults, type LanguageSetting } from './settings';

export function resolveLanguage(language: LanguageSetting): Locale {
  return language === 'auto' ? browserLocale() : language;
}

/**
 * Applies the language setting now and whenever it changes (also from other tabs).
 * Call before mounting a UI, so it renders in the right language from the start.
 */
export async function followLanguageSetting(): Promise<() => void> {
  const apply = (stored: Parameters<typeof withDefaults>[0]) =>
    setLocale(resolveLanguage(withDefaults(stored).language));
  apply(await settingsItem.getValue());
  return settingsItem.watch(apply);
}
