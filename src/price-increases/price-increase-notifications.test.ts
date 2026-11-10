import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from '@/buyback/buyback';
import { buybackSnapshot } from '@/buyback/buyback-storage';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { settingsItem } from '@/settings/settings';
import {
  checkPriceIncreases,
  PRICE_INCREASE_ALARM,
  priceIncreaseSchedule,
} from './price-increase-browser-notification';
import {
  isPriceIncreaseNoteShown,
  pledgesWithinDays,
  storedPriceIncreasePledges,
} from './price-increase-notes';
import type { ExpectedPriceIncrease } from './price-increases';
import { PRICE_INCREASES_VERSION, priceIncreasesItem } from './price-increases-storage';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const GALAXY_AT = Date.parse('2026-11-13T16:00:00Z');
const LIBERATOR_AT = Date.parse('2026-11-15T16:00:00Z');

const galaxy: ExpectedPriceIncrease = {
  ship: { id: 244, name: 'Galaxy' },
  priceIncreaseAt: { at: GALAXY_AT },
};
const liberator: ExpectedPriceIncrease = {
  ship: { id: 224, name: 'Liberator' },
  priceIncreaseAt: { at: LIBERATOR_AT },
};

const ccu = (id: number, toShipId: number, to: string) => ({
  id,
  title: `Upgrade - Valkyrie to ${to} Standard Edition`,
  contained: `Upgrade - Valkyrie to ${to} Standard Edition`,
  isUpgrade: true,
  upgrade: { fromShipId: 169, toShipId, toSkuId: 1 },
});
const buyback = (...pledges: ReturnType<typeof ccu>[]): BuybackSnapshot => ({
  version: BUYBACK_SNAPSHOT_VERSION,
  syncedAt: '2026-11-10T09:00:00.000Z',
  pledges,
});
const stored = buyback(ccu(1, 244, 'Galaxy'), ccu(2, 244, 'Galaxy'), ccu(3, 224, 'Liberator'));

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

function stubNotifications() {
  const create = vi.fn().mockResolvedValue('id');
  const clear = vi.fn();
  (fakeBrowser as unknown as { notifications: unknown }).notifications = {
    create,
    clear,
    onClicked: { addListener: vi.fn() },
  };
  return { create, clear };
}

async function store(increases = [galaxy, liberator]) {
  await buybackSnapshot.setValue(stored);
  await priceIncreasesItem.setValue({
    version: PRICE_INCREASES_VERSION,
    priceIncreases: increases,
  });
}

describe('the sidebar notification', () => {
  const now = GALAXY_AT - 3 * DAY;
  const pledges = storedPriceIncreasePledges(stored, [galaxy, liberator], now);

  it('counts the buy back pledges within the period', () => {
    expect(pledges.map((pledge) => pledge.id)).toEqual([1, 2, 3]);
    expect(pledgesWithinDays(pledges, now, 14)).toEqual([1, 2, 3]);
    expect(pledgesWithinDays(pledges, now, 4)).toEqual([1, 2]);
    expect(pledgesWithinDays(pledges, GALAXY_AT, 14)).toEqual([3]);
  });

  it('stays dismissed for its pledges and comes back for a new one', () => {
    expect(isPriceIncreaseNoteShown([1, 2], [])).toBe(true);
    expect(isPriceIncreaseNoteShown([1, 2], [1, 2])).toBe(false);
    expect(isPriceIncreaseNoteShown([1], [1, 2])).toBe(false);
    expect(isPriceIncreaseNoteShown([1, 2, 3], [1, 2])).toBe(true);
  });

  it('knows nothing without a current buy back or price increases', () => {
    expect(storedPriceIncreasePledges(null, [galaxy], now)).toEqual([]);
    expect(storedPriceIncreasePledges(stored, [], now)).toEqual([]);
  });
});

describe('priceIncreaseSchedule', () => {
  const pledges = storedPriceIncreasePledges(stored, [galaxy, liberator], GALAXY_AT - 3 * DAY);

  it('tells the pledges with less than two days left, and when the next one crosses', () => {
    const early = priceIncreaseSchedule(pledges, {}, GALAXY_AT - 3 * DAY);
    expect(early.due).toEqual([]);
    expect(early.next).toBe(GALAXY_AT - 2 * DAY);
    const galaxyDue = priceIncreaseSchedule(pledges, {}, GALAXY_AT - 2 * DAY);
    expect(galaxyDue.due.map((pledge) => pledge.id)).toEqual([1, 2]);
    expect(galaxyDue.next).toBe(LIBERATOR_AT - 2 * DAY);
  });

  it('tells each pledge once, and again for a moved price increase', () => {
    const told = { 1: GALAXY_AT, 2: GALAXY_AT };
    expect(priceIncreaseSchedule(pledges, told, GALAXY_AT - DAY).due).toEqual([]);
    expect(
      priceIncreaseSchedule(pledges, { 1: GALAXY_AT - DAY }, GALAXY_AT - DAY).due.map(
        (pledge) => pledge.id,
      ),
    ).toEqual([1, 2]);
  });
});

describe('checkPriceIncreases', () => {
  it('names all pledges crossing the limit in one notification', async () => {
    const { create } = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await store();
    await checkPriceIncreases(GALAXY_AT - 3 * DAY);
    expect(create).not.toHaveBeenCalled();
    expect((await browser.alarms.get(PRICE_INCREASE_ALARM))?.scheduledTime).toBe(
      GALAXY_AT - 2 * DAY,
    );

    await checkPriceIncreases(GALAXY_AT - 2 * DAY);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![1].message).toContain('2 buy back items');
    expect(create.mock.calls[0]![1].message).toContain('Galaxy');

    // Told once.
    await checkPriceIncreases(GALAXY_AT - 2 * DAY + HOUR);
    expect(create).toHaveBeenCalledOnce();
  });

  it('names the pledge when it is only one', async () => {
    const { create } = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await store([liberator]);
    await checkPriceIncreases(LIBERATOR_AT - DAY);
    expect(create.mock.calls[0]![1].message).toContain(
      '“Upgrade - Valkyrie to Liberator Standard Edition”',
    );
  });

  it('goes away once the price increases are over', async () => {
    const { clear } = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await store([galaxy]);
    await checkPriceIncreases(GALAXY_AT - HOUR);
    await checkPriceIncreases(GALAXY_AT + HOUR);
    expect(clear).toHaveBeenCalled();
  });

  it('shows nothing with the kind off or in the demo, but counts the pledges as told', async () => {
    const { create } = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await settingsItem.setValue({ notificationsOff: ['priceIncreases'] } as never);
    await store([galaxy]);
    await checkPriceIncreases(GALAXY_AT - DAY);
    expect(await browser.alarms.get(PRICE_INCREASE_ALARM)).toBeUndefined();
    await settingsItem.setValue({} as never);
    await checkPriceIncreases(GALAXY_AT - DAY + HOUR);
    expect(create).not.toHaveBeenCalled();
  });
});
