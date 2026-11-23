import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SMART_UPDATE } from '@/config';
import { resetBackoff, recordCheckResult, currentIntervalMinutes } from './backoff';
import {
  endPurchaseWindow,
  isPurchaseCheckDue,
  orderOfConfirmationPath,
  purchaseWindowStart,
  rememberCartOpened,
  rememberPurchase,
  takeCartOpened,
} from './purchase';

/* Checks after a purchase (#328). */

beforeEach(async () => {
  fakeBrowser.reset();
  await resetBackoff();
});

const { intervalMs, windowMs, cartMaxAgeMs } = SMART_UPDATE.afterPurchase;

describe('the order confirmation page', () => {
  it('is recognized with and without a locale, with its order', () => {
    expect(orderOfConfirmationPath('/store/pledge/cart/confirm/ABC123/hangar')).toBe('ABC123');
    expect(orderOfConfirmationPath('/en/store/pledge/cart/confirm/ABC123/hangar')).toBe('ABC123');
    expect(orderOfConfirmationPath('/de-de/store/pledge/cart/confirm/ABC123')).toBe('ABC123');
  });

  it('is not the cart or another page', () => {
    expect(orderOfConfirmationPath('/store/pledge/cart')).toBeUndefined();
    expect(orderOfConfirmationPath('/store/pledge/cart/confirm')).toBeUndefined();
    expect(orderOfConfirmationPath('/account/pledges')).toBeUndefined();
  });
});

describe('the window after a purchase', () => {
  it('opens with the confirmation and closes after its time', async () => {
    expect(await purchaseWindowStart(1_000)).toBeUndefined();
    await rememberPurchase('A', 1_000);
    expect(await purchaseWindowStart(1_000 + windowMs - 1)).toBe(1_000);
    expect(await purchaseWindowStart(1_000 + windowMs)).toBeUndefined();
  });

  it('closes early once a check found the change', async () => {
    await rememberPurchase('A', 1_000);
    await endPurchaseWindow();
    expect(await purchaseWindowStart(2_000)).toBeUndefined();
  });

  it("doesn't open again for a reload of the same confirmation, but for a new order", async () => {
    await rememberPurchase('A', 1_000);
    await endPurchaseWindow();
    await rememberPurchase('A', 5_000);
    expect(await purchaseWindowStart(5_000)).toBeUndefined();
    await rememberPurchase('B', 6_000);
    expect(await purchaseWindowStart(6_000)).toBe(6_000);
  });

  it('goes back to the set interval', async () => {
    await recordCheckResult(false);
    expect(await currentIntervalMinutes(5)).toBe(10);
    await rememberPurchase('A');
    expect(await currentIntervalMinutes(5)).toBe(5);
  });

  it('checks at once and then at its short interval', () => {
    const purchaseAt = 100_000;
    const due = (checkedAt: number, now: number) =>
      isPurchaseCheckDue({ checkedAt, purchaseAt, now });
    // The last check ran before the purchase.
    expect(due(purchaseAt - 1, purchaseAt)).toBe(true);
    expect(due(purchaseAt + 1_000, purchaseAt + intervalMs)).toBe(false);
    expect(due(purchaseAt + 1_000, purchaseAt + 1_000 + intervalMs)).toBe(true);
  });
});

describe('the cart opened from the Hangar Manager', () => {
  it('is checked for once', async () => {
    await rememberCartOpened(1_000);
    expect(await takeCartOpened(2_000)).toBe(true);
    expect(await takeCartOpened(3_000)).toBe(false);
  });

  it('is too old after a while', async () => {
    await rememberCartOpened(1_000);
    expect(await takeCartOpened(1_000 + cartMaxAgeMs + 1)).toBe(false);
  });

  it('is left to the window once the confirmation was seen', async () => {
    await rememberCartOpened(1_000);
    await rememberPurchase('A', 2_000);
    expect(await takeCartOpened(3_000)).toBe(false);
  });
});
