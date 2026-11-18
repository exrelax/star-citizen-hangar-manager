import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { settingsItem } from '@/settings/settings';
import {
  checkShipRemovals,
  SHIP_REMOVALS_ALARM,
  shipRemovalMessage,
  shipRemovalSchedule,
} from './removal-browser-notification';
import { removalsByDate, type ShipRemoval } from './ship-removals';
import { SHIP_REMOVALS_VERSION, shipRemovalsItem } from './ship-removals-storage';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const JAN_27 = Date.parse('2027-01-27T00:00:00Z');
const DEC_10 = Date.parse('2026-12-10T16:00:00Z');
const SOURCE = 'https://robertsspaceindustries.com/en/comm-link/transmission/21350';

const removal = (id: number, name: string, at: number, dayOnly = true): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at, ...(dayOnly && { dayOnly: true as const }) },
  source: SOURCE,
});
const ANDROMEDA = removal(45, 'Constellation Mk IV Andromeda', JAN_27);
const AQUILA = removal(47, 'Constellation Mk IV Aquila', JAN_27);
const HORNET = removal(15, 'F7C-M Super Hornet Mk I', DEC_10, false);

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

async function store(removals: ShipRemoval[] = [ANDROMEDA, AQUILA, HORNET]) {
  await shipRemovalsItem.setValue({ version: SHIP_REMOVALS_VERSION, shipRemovals: removals });
  await browserNotificationsItem.setValue(true);
}

describe('shipRemovalSchedule', () => {
  it('is due a week before each date, and names when the next one is', () => {
    const list = [ANDROMEDA, AQUILA, HORNET];
    expect(shipRemovalSchedule(list, [], DEC_10 - 8 * DAY)).toEqual({
      due: [],
      next: DEC_10 - 7 * DAY,
    });
    const atHornet = shipRemovalSchedule(list, [], DEC_10 - 7 * DAY);
    expect(atHornet.due.map((date) => date.removals.map((r) => r.ship.id))).toEqual([[15]]);
    expect(atHornet.next).toBe(JAN_27 - 7 * DAY);
  });
});

describe('shipRemovalMessage', () => {
  it('names all ships of the date', () => {
    const [date] = removalsByDate([ANDROMEDA, AQUILA], JAN_27 - 7 * DAY);
    expect(shipRemovalMessage(date!, 'en')).toBe(
      'The Constellation Mk IV Andromeda and Constellation Mk IV Aquila leave the Pledge Store on Jan 27, 2027.',
    );
  });
});

describe('checkShipRemovals', () => {
  it('tells all ships of a date in one notification, once', async () => {
    const { create } = stubNotifications();
    await store();
    await checkShipRemovals(JAN_27 - 8 * DAY);
    // The Super Hornet's date is past by then, the Constellations' more than a week ahead.
    expect(create).not.toHaveBeenCalled();
    expect((await browser.alarms.get(SHIP_REMOVALS_ALARM))?.scheduledTime).toBe(JAN_27 - 7 * DAY);

    await checkShipRemovals(JAN_27 - 7 * DAY);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![1].message).toContain('Andromeda and Constellation Mk IV Aquila');

    await checkShipRemovals(JAN_27 - 7 * DAY + HOUR);
    expect(create).toHaveBeenCalledOnce();
  });

  it('tells a date again for a new ship on it', async () => {
    const { create } = stubNotifications();
    await store([ANDROMEDA]);
    await checkShipRemovals(JAN_27 - 3 * DAY);
    await store([ANDROMEDA, AQUILA]);
    await checkShipRemovals(JAN_27 - 3 * DAY + HOUR);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('goes away once its date has passed', async () => {
    const { clear } = stubNotifications();
    await store([HORNET]);
    await checkShipRemovals(DEC_10 - DAY);
    await checkShipRemovals(DEC_10 + HOUR);
    expect(clear).toHaveBeenCalledWith(expect.stringMatching(/^shm-ship-removals:/));
  });

  it('shows nothing with the kind off or in the demo, but counts the dates as told', async () => {
    const { create } = stubNotifications();
    await store([ANDROMEDA]);
    await settingsItem.setValue({ notificationsOff: ['shipRemovals'] } as never);
    await checkShipRemovals(JAN_27 - 3 * DAY);
    expect(await browser.alarms.get(SHIP_REMOVALS_ALARM)).toBeUndefined();
    await settingsItem.setValue({ demoMode: true } as never);
    await checkShipRemovals(JAN_27 - 3 * DAY + HOUR);
    await settingsItem.setValue({} as never);
    await checkShipRemovals(JAN_27 - 3 * DAY + 2 * HOUR);
    expect(create).not.toHaveBeenCalled();
  });
});
