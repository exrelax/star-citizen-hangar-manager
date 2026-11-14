import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, syncFailCode } from './codes';

const docs = readFileSync(new URL('../../docs/ERROR_CODES.md', import.meta.url), 'utf8');
/** The codes of the tables' first column, as Prettier aligns them. */
const documented = [...docs.matchAll(/^\| `([A-Z-]+)` +\|/gm)].map((match) => match[1]);

describe('ERROR_CODES (#341)', () => {
  const codes = Object.keys(ERROR_CODES);

  it('are AREA-WHAT in capitals', () => {
    for (const code of codes) expect(code).toMatch(/^[A-Z]+(?:-[A-Z]+)+$/);
  });

  it('are each documented in docs/ERROR_CODES.md', () => {
    for (const code of codes) expect(documented, code).toContain(code);
  });

  it('documents no code that is gone', () => {
    expect([...documented].sort()).toEqual([...codes].sort());
  });

  it('names the failed refresh of each storage', () => {
    expect(syncFailCode('hangar')).toBe('SYNC-HANGAR-FAIL');
    expect(syncFailCode('buyback')).toBe('SYNC-BUYBACK-FAIL');
    expect(syncFailCode('orders')).toBe('SYNC-ORDERS-FAIL');
    expect(syncFailCode('storeItems')).toBe('SYNC-DATA-FAIL');
  });
});
