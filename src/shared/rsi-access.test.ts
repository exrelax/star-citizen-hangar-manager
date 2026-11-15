import { describe, expect, it } from 'vitest';
import { grantsRsiAccess, hasRsiAccess, RSI_ORIGIN } from './rsi-access';

describe("the access to RSI's website", () => {
  it('asks the browser for the RSI origin', async () => {
    const asked: string[][] = [];
    const contains = async (permissions: { origins: string[] }) => {
      asked.push(permissions.origins);
      return false;
    };
    expect(await hasRsiAccess(contains)).toBe(false);
    expect(asked).toEqual([[RSI_ORIGIN]]);
    expect(await hasRsiAccess(async () => true)).toBe(true);
  });

  it('shows no hint when the browser fails to answer', async () => {
    expect(
      await hasRsiAccess(async () => {
        throw new Error('not supported');
      }),
    ).toBe(true);
  });

  it("knows newly granted permissions that include RSI's website", () => {
    expect(grantsRsiAccess({ origins: [RSI_ORIGIN] })).toBe(true);
    expect(grantsRsiAccess({ origins: ['https://ccugame.app/*'] })).toBe(false);
    expect(grantsRsiAccess({})).toBe(false);
  });
});
