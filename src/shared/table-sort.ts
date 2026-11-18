/*
 * Sorting a table by its columns (#395): a click on a column head sorts by it, a second click
 * reverses the order. Numbers start with the highest, names with A. Rows without a value sort last
 * in both directions. Without a chosen column the rows keep the order they come in.
 */

export type SortDirection = 'asc' | 'desc';

export interface TableSort<C extends string = string> {
  column: C;
  direction: SortDirection;
}

/** A column's sort key; `undefined` for a row without a value. */
export type SortKey = number | string | undefined;

export interface SortColumn<T> {
  /** One key, or several to break ties (e.g. the base ship, then the target ship). */
  key: (row: T) => SortKey | readonly SortKey[];
  /** The direction of the first click: `desc` for numbers, `asc` for names. */
  first: SortDirection;
}

/** The sort after a click on `column`: its first direction, or the other one if it was chosen. */
export function nextSort<C extends string>(
  current: TableSort<C> | null | undefined,
  column: C,
  first: SortDirection,
): TableSort<C> {
  if (current?.column !== column) return { column, direction: first };
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** The rows in the order of `sort`; stable, and as they come without a sort. */
export function sortRows<T, C extends string>(
  rows: readonly T[],
  sort: TableSort<C> | null | undefined,
  columns: Record<C, SortColumn<T>>,
): T[] {
  const column = sort && columns[sort.column];
  if (!column) return [...rows];
  const sign = sort.direction === 'asc' ? 1 : -1;
  const keysOf = (row: T) => {
    const key = column.key(row);
    return Array.isArray(key) ? (key as readonly SortKey[]) : [key as SortKey];
  };
  return rows
    .map((row, index) => ({ row, index, keys: keysOf(row) }))
    .sort((a, b) => {
      for (let i = 0; i < Math.max(a.keys.length, b.keys.length); i++) {
        const [x, y] = [a.keys[i], b.keys[i]];
        // Without a value: last in both directions.
        if (x === undefined || y === undefined) {
          if (x !== y) return x === undefined ? 1 : -1;
          continue;
        }
        const order = compareKeys(x, y);
        if (order) return order * sign;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Whether a stored value is a sort of one of `columns`. */
export function isTableSort<C extends string>(
  value: unknown,
  columns: readonly C[],
): value is TableSort<C> {
  const sort = value as Partial<TableSort<C>> | null;
  return (
    !!sort &&
    typeof sort === 'object' &&
    columns.includes(sort.column as C) &&
    (sort.direction === 'asc' || sort.direction === 'desc')
  );
}
