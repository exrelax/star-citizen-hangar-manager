// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createPriceLookup } from './ship-prices';
import { ccuShips, loadUpgradeLog, parseLogDate, parseUpgradeLog, withPrices } from './upgrade-log';

// As rendered by RSI's `/api/account/upgradeLog`, newest first.
const row = (date: string, text: string) =>
  `<div class="row"> <label> ${date}<br/> <span>${text}</span> </label> </div>`;
const html = [
  row(
    'Nov 26 2023, 6:02 pm',
    'Upgrade applied: #34519320 Upgrade - 300i to Spartan Warbond Edition, new value: $60.00 USD',
  ),
  row(
    'Nov 26 2023, 5:44 am',
    'Upgrade applied: #62180268 Upgrade - Cutter Scout to 300i Standard Edition , new value: $55.00 USD',
  ),
].join('\n');

describe('parseUpgradeLog', () => {
  it('lists the applied CCUs oldest first, with the value they added', () => {
    expect(parseUpgradeLog(html)).toEqual([
      {
        appliedAt: '2023-11-26 05:44',
        ccuId: 62180268,
        name: 'Upgrade - Cutter Scout to 300i Standard Edition',
        valueAfter: 55,
      },
      {
        appliedAt: '2023-11-26 18:02',
        ccuId: 34519320,
        name: 'Upgrade - 300i to Spartan Warbond Edition',
        valueAfter: 60,
        added: 5,
      },
    ]);
  });

  it('keeps rows it cannot read as they are', () => {
    expect(parseUpgradeLog(row('Yesterday', 'Something else'))).toEqual([
      { appliedAt: 'Yesterday', ccuId: undefined, name: 'Something else', valueAfter: undefined },
    ]);
  });

  it('is empty for pledges without upgrades', () => {
    expect(parseUpgradeLog('')).toEqual([]);
  });
});

describe('parseLogDate', () => {
  it('reads RSI’s dates with a 12-hour clock', () => {
    expect(parseLogDate('Jan 3 2024, 12:05 am')).toBe('2024-01-03 00:05');
    expect(parseLogDate('Jan 3 2024, 12:05 pm')).toBe('2024-01-03 12:05');
    expect(parseLogDate('3.1.2024')).toBeUndefined();
  });
});

describe('loadUpgradeLog', () => {
  it('loads a log once and tries again after a failure', async () => {
    const fetchLog = vi.fn(async () => []);
    await loadUpgradeLog(1, fetchLog);
    await loadUpgradeLog(1, fetchLog);
    expect(fetchLog).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async () => Promise.reject(new Error('offline')));
    await expect(loadUpgradeLog(2, failing)).rejects.toThrow('offline');
    await expect(loadUpgradeLog(2, failing)).rejects.toThrow('offline');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('ccuShips', () => {
  it('reads the ships of a CCU name without its edition', () => {
    expect(ccuShips('Upgrade - Cutter Scout to 300i Standard Edition ')).toEqual({
      from: 'Cutter Scout',
      to: '300i',
    });
    expect(ccuShips('Upgrade - F7C-M Super Hornet to Zeus Mk II MR Standard Upgrade')).toEqual({
      from: 'F7C-M Super Hornet',
      to: 'Zeus Mk II MR',
    });
    expect(ccuShips('Upgrade - Prowler to 600i Explorer Warbond Edition')?.to).toBe(
      '600i Explorer',
    );
    expect(ccuShips('Something else')).toBeUndefined();
  });
});

describe('withPrices', () => {
  const priceOf = createPriceLookup([
    { name: 'Cutter Scout', price: 50 },
    { name: '300i', price: 60 },
    { name: 'Spartan', price: 80 },
  ]);

  it('adds the target ship price and the discount of each CCU after the first', () => {
    const [first, second] = withPrices(parseUpgradeLog(html), priceOf);
    // The first CCU's cost is unknown, so its discount is, too.
    expect(first).toMatchObject({ targetPrice: 60, discount: undefined });
    // 300i ($60) → Spartan ($80) would cost $20; it added $5 to the pledge.
    expect(second).toMatchObject({ targetPrice: 80, added: 5, discount: 15 });
  });

  it('leaves the prices out for ships it does not know', () => {
    const [, second] = withPrices(parseUpgradeLog(html), createPriceLookup([]));
    expect(second).toMatchObject({ targetPrice: undefined, discount: undefined });
  });
});
