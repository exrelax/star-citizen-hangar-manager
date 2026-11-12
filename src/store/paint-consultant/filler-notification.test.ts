import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { HANGAR_SNAPSHOT_VERSION, type Pledge } from '@/hangar/pledge';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import {
  clearMeltedFillers,
  FILLER_ALARM,
  notifyFillers,
  scheduleFillerNotification,
} from './filler-notification';
import { REBUY_PLAN_VERSION, rebuyPlanItem, type StoredRebuyPlan } from './rebuy-plan-storage';

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

const BOUGHT = new Date(2026, 10, 9, 11, 30).getTime();
const plan: StoredRebuyPlan = {
  version: REBUY_PLAN_VERSION,
  way: 'buy',
  at: BOUGHT - 60_000,
  tier: { paints: 5, percent: 25 },
  own: [],
  fillers: [{ skuId: 20, name: 'Cheap', quantity: 2, price: 3 }],
  cartCost: 6,
  purchase: { orderId: 'ORDER1', boughtAt: '2026-11-09T11:30', pledgeIds: [1, 2], foundAt: BOUGHT },
};

function stubNotifications() {
  const create = vi.fn().mockResolvedValue('id');
  (fakeBrowser as unknown as { notifications: unknown }).notifications = {
    create,
    clear: vi.fn(),
    onClicked: { addListener: vi.fn() },
  };
  return create;
}

describe('scheduleFillerNotification', () => {
  it('sets the alarm 24 hours after the order', async () => {
    await rebuyPlanItem.setValue(plan);
    await scheduleFillerNotification(BOUGHT);
    const alarm = await browser.alarms.get(FILLER_ALARM);
    // The time without a time zone counts in the later reading (UTC or local).
    expect(alarm?.scheduledTime).toBeGreaterThanOrEqual(BOUGHT + 24 * 60 * 60 * 1000);
  });

  it('sets none once told', async () => {
    await rebuyPlanItem.setValue({ ...plan, purchase: { ...plan.purchase!, notifiedAt: 1 } });
    await scheduleFillerNotification(BOUGHT);
    expect(await browser.alarms.get(FILLER_ALARM)).toBeUndefined();
  });
});

describe('notifyFillers', () => {
  it('shows the notification once, when the browser allows it', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await rebuyPlanItem.setValue(plan);
    await notifyFillers();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1].message).toContain('The 2 filler paints');
    expect((await rebuyPlanItem.getValue())?.purchase?.notifiedAt).toBeTypeOf('number');

    await notifyFillers();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('only remembers it without the permission (the sidebar tells it)', async () => {
    const create = stubNotifications();
    await rebuyPlanItem.setValue(plan);
    await notifyFillers();
    expect(create).not.toHaveBeenCalled();
    expect((await rebuyPlanItem.getValue())?.purchase?.notifiedAt).toBeTypeOf('number');
  });
});

describe('clearMeltedFillers', () => {
  it('takes the notification away once the filler paints are melted', async () => {
    stubNotifications();
    const clear = (fakeBrowser as unknown as { notifications: { clear: ReturnType<typeof vi.fn> } })
      .notifications.clear;
    await rebuyPlanItem.setValue({ ...plan, purchase: { ...plan.purchase!, notifiedAt: 1 } });
    const hangar = (...ids: number[]) =>
      hangarSnapshot.setValue({
        version: HANGAR_SNAPSHOT_VERSION,
        syncedAt: '2026-11-09T12:00:00.000Z',
        pledges: ids.map((id) => ({ id }) as Pledge),
      });
    await hangar(2);
    await clearMeltedFillers();
    expect(clear).not.toHaveBeenCalled();
    await hangar();
    await clearMeltedFillers();
    expect(clear).toHaveBeenCalledWith('shm-consultant-fillers');
  });
});
