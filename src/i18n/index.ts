import de from '@/locales/de.json';
import en from '@/locales/en.json';
import { readonly, ref } from 'vue';

/*
 * Translations at runtime. `browser.i18n` always follows the browser's UI language, so it can't
 * honor the language chosen in the settings; the messages are bundled and looked up here instead.
 * The same locale files also feed WXT's `_locales` (manifest name and description).
 */

const MESSAGES = { en, de };

export type Locale = keyof typeof MESSAGES;
export const LOCALES = Object.keys(MESSAGES) as Locale[];
export const FALLBACK_LOCALE: Locale = 'en';

type Messages = { [key: string]: string | Messages };
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Dotted path of a message, e.g. "manager.title". */
export type MessageKey = Leaves<typeof en>;

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** The supported locale for a browser language like "de-DE", or English if there is none. */
export function matchLocale(language: string | undefined): Locale {
  const base = language?.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : FALLBACK_LOCALE;
}

/**
 * Locale for the user's preferred browser language (the one websites see), among the supported
 * ones. Not `browser.i18n.getUILanguage()`: that is the language of the browser's own interface,
 * which often stays English even when German is the preferred language.
 */
export function browserLocale(): Locale {
  return matchLocale(navigator.language);
}

/**
 * Message in the given locale (falling back to English, then to the key). Placeholders follow
 * the browser's i18n format: `$1` … `$9` are substitutions, `$$` is a literal dollar sign.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  substitutions: readonly (string | number)[] = [],
): string {
  const message = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[FALLBACK_LOCALE], key) ?? key;
  return message.replace(/\$(\$|[1-9])/g, (_, token: string) =>
    token === '$' ? '$' : String(substitutions[Number(token) - 1] ?? ''),
  );
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

const current = ref<Locale>(FALLBACK_LOCALE);

/** Active locale; reading it in templates or computeds makes them follow a language change. */
export const locale = readonly(current);

export function setLocale(next: Locale) {
  current.value = next;
}

/** Same call style as WXT's i18n, but in the active locale. */
export const i18n = {
  t: (key: MessageKey, substitutions?: readonly (string | number)[]) =>
    translate(current.value, key, substitutions),
};
