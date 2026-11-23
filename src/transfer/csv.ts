/*
 * CSV for spreadsheets (#227): quoted where needed, lines ended by CRLF, UTF-8 with a BOM so Excel
 * shows umlauts and other letters right. Safe against CSV injection: a text cell starting with
 * `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`, so no spreadsheet runs it as a
 * formula. Numbers stay numbers.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** The byte order mark of UTF-8. */
export const BOM = '﻿';

const FORMULA = /^[=+\-@\t\r]/;

/** One cell: a formula-like text defused, quoted if it holds a comma, quote or line break. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The file: a header line and a line per row. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
