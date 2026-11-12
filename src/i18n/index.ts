import { AUTO_LANGUAGE_SOURCE } from '@/config';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import { readonly, ref } from 'vue';

/*
 * Translations at runtime. `browser.i18n` always follows the browser's UI language, so it can't
 * honor the language chosen in the settings; the messages are bundled and looked up here instead.
 * The same locale files also feed WXT's `_locales` (manifest name and description).
 */

const MESSAGES = { en, de, fr, es };

export type Locale = keyof typeof MESSAGES;
export const LOCALES = Object.keys(MESSAGES) as Locale[];
export const FALLBACK_LOCALE: Locale = 'en';

type Messages = { [key: string]: string | Messages };
/**
 * A message with a count (#300): one text per plural category of `Intl.PluralRules` – `one` and
 * `other` always, the others where a language needs them.
 */
type PluralForms = { one: string; other: string };
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends PluralForms
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
type Plurals<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends PluralForms
      ? `${Prefix}${K}`
      : Plurals<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Dotted path of a message, e.g. "manager.title". */
export type MessageKey = Leaves<typeof en>;
/** Dotted path of a message with plural forms, e.g. "manager.count" (#300). */
export type PluralKey = Plurals<typeof en>;

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** The supported locale for a browser language like "de-DE", or English if there is none. */
export function matchLocale(language: string | undefined): Locale {
  const base = language?.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : FALLBACK_LOCALE;
}

/** Locale for the browser language set by `AUTO_LANGUAGE_SOURCE`, among the supported ones. */
export function browserLocale(source: typeof AUTO_LANGUAGE_SOURCE = AUTO_LANGUAGE_SOURCE): Locale {
  return matchLocale(source === 'ui' ? browser.i18n.getUILanguage() : navigator.language);
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
  return fill(message, substitutions);
}

/**
 * The form of a message with a count (#300) by the plural rules of the locale (`Intl.PluralRules`),
 * e.g. "1 pledge" and "2 pledges"; a form the locale doesn't have falls back to `other`, a
 * message missing in the locale to English. The substitutions are the count unless given.
 */
export function translatePlural(
  locale: Locale,
  key: PluralKey,
  count: number,
  substitutions: readonly (string | number)[] = [count],
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const formsOf = (messages: Messages) => {
    const forms = lookupNode(messages, key);
    return typeof forms === 'object' ? forms : undefined;
  };
  const forms = formsOf(MESSAGES[locale]) ?? formsOf(MESSAGES[FALLBACK_LOCALE]);
  const message = forms?.[category] ?? forms?.other;
  return typeof message === 'string' ? fill(message, substitutions) : key;
}

function fill(message: string, substitutions: readonly (string | number)[]): string {
  return message.replace(/\$(\$|[1-9])/g, (_, token: string) =>
    token === '$' ? '$' : String(substitutions[Number(token) - 1] ?? ''),
  );
}

function lookupNode(messages: Messages, key: string): string | Messages | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return node;
}

function lookup(messages: Messages, key: string): string | undefined {
  const node = lookupNode(messages, key);
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
  /** A message with a count (#300): its singular or plural form; the count is `$1` unless given. */
  n: (key: PluralKey, count: number, substitutions?: readonly (string | number)[]) =>
    translatePlural(current.value, key, count, substitutions),
};
