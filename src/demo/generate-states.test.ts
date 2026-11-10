import { describe, expect, it } from 'vitest';
import { REFUND_URGENT_DAYS } from '@/config';
import { isPaidWithMoney, isPaidWithMoneyOnly } from '@/orders/orders';
import { refundWindow } from '@/orders/refund';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo, justBoughtOf } from './demo';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe.each(['key-a', 'key-b', 'key-c', 'a much longer demo key'])(
  'the states of the generated hangar of %s (#176)',
  (key) => {
    const { pledges, account } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);
    const some = (test: (pledge: (typeof pledges)[number]) => boolean) =>
      expect(pledges.some(test)).toBe(true);

    it('has meltable and not meltable, giftable and not giftable pledges', () => {
      some((pledge) => pledge.isMeltable);
      some((pledge) => !pledge.isMeltable);
      some((pledge) => pledge.isGiftable);
      some((pledge) => !pledge.isGiftable && pledge.valueUsd > 0);
    });

    it('has LTI, insurances in years and in months, and several at once', () => {
      some((pledge) => pledge.insurance?.lifetime === true);
      const months = (pledge: (typeof pledges)[number]) =>
        pledge.insurance && !pledge.insurance.lifetime ? pledge.insurance.months : 0;
      some((pledge) => months(pledge) > 0 && months(pledge) % 12 === 0);
      some((pledge) => months(pledge) > 0 && months(pledge) % 12 !== 0);
      some((pledge) => pledge.items.filter((item) => item.kind === 'Insurance').length > 1);
      some((pledge) => pledge.isCcu && !!pledge.insurance);
    });

    it('has upgraded pledges with their applied CCUs', () => {
      const upgraded = pledges.filter((pledge) => pledge.isUpgraded);
      expect(upgraded.length).toBeGreaterThan(0);
      for (const pledge of upgraded) {
        expect(account.upgradeLogs.get(pledge.id)?.length).toBeGreaterThan(0);
        expect(pledge.originalName).toMatch(/^Standalone Ships - /);
      }
    });

    it('has protected game access for SC, SQ42 and both, also a reward without a ship', () => {
      const games = pledges.map((pledge) => pledge.protectedGames.join(' · '));
      expect(games).toEqual(expect.arrayContaining(['SC', 'SQ42', 'SC · SQ42']));
      some(
        (pledge) =>
          pledge.protectedGames.length > 0 && !pledge.items.some((item) => item.kind === 'Ship'),
      );
    });

    it('has orders paid with money, in part with store credit, and with store credit only', () => {
      const { orders, pledgeOrders } = account.orders;
      const raw = account.pledges.flatMap((pledge) => {
        const order = orders[pledgeOrders[pledge.id]?.orderId ?? ''];
        return order ? [order] : [];
      });
      expect(raw.some(isPaidWithMoneyOnly)).toBe(true);
      expect(raw.some((order) => isPaidWithMoney(order) && !isPaidWithMoneyOnly(order))).toBe(true);
      expect(raw.some((order) => !isPaidWithMoney(order))).toBe(true);
      some((pledge) => pledge.order !== undefined);
    });

    it('has the refund countdown, normal and in its last days, and a pledge just bought', () => {
      const windows = pledges.flatMap((pledge) => {
        const window = pledge.order?.placedAt && refundWindow(pledge.order.placedAt, TODAY);
        return window ? [window.daysLeft] : [];
      });
      expect(windows.some((days) => days >= REFUND_URGENT_DAYS)).toBe(true);
      expect(windows.some((days) => days < REFUND_URGENT_DAYS)).toBe(true);
      expect(justBoughtOf(pledges)).toBe(pledges[0]!.id);
    });

    it('has discounts, a pledge above its price, valuable pledges and rewards', () => {
      some((pledge) => (pledge.discount?.amount ?? 0) > 0);
      some((pledge) => (pledge.discount?.amount ?? 0) < 0);
      some((pledge) => pledge.valueUsd > 0);
      some((pledge) => pledge.reward !== undefined);
    });
  },
);
