import { LOCALES, type Locale } from '@/i18n';

/*
 * Checks for the data files of the project website (`site/public/data/`), e.g. the events (#69)
 * and the expected price increases (#195). The files are data only: they are checked here field
 * by field, entries that don't fit are left out silently, and their texts are shown as plain
 * text, never as HTML.
 *
 * A text is either one for every language or one per language of the extension, e.g.
 * `{ "en": "…", "de": "…" }`; English is required and stands in for a language not given.
 */

/** A text per language; English always. */
export type LocalizedText = Partial<Record<Locale, string>> & { en: string };

const MAX_TEXT = 500;

/** A trimmed text of at most `max` characters, else none. */
export const text = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined;

/** One text for every language, or one per language with English; else none. */
export function localizedText(value: unknown, max = MAX_TEXT): LocalizedText | undefined {
  const single = text(value, max);
  if (single) return { en: single };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const texts = value as Record<string, unknown>;
  const en = text(texts.en, max);
  if (!en) return undefined;
  const result: LocalizedText = { en };
  for (const locale of LOCALES) {
    const translated = text(texts[locale], max);
    if (translated) result[locale] = translated;
  }
  return result;
}

/** The text in the language, else in English. */
export const localized = (value: LocalizedText, locale: Locale): string =>
  value[locale] ?? value.en;

/** A link of the file: an https URL of at most `MAX_TEXT` characters, else none. */
export function httpsUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A point in time of the file (an ISO date), else none. */
export const time = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : undefined;
};

/** A plain object of the file, else none. */
export const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** The list of a file of the known `schemaVersion`; `undefined` for any other file. */
export function fileList(json: unknown, schemaVersion: number, key: string): unknown[] | undefined {
  const file = record(json);
  if (!file || file.schemaVersion !== schemaVersion || !Array.isArray(file[key])) return undefined;
  return file[key];
}
