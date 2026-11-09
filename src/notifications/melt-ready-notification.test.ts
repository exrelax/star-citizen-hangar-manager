import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { MELT_COOLDOWN_MS } from '@/config';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { meltMarksItem } from '@/hangar/melt-marks';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot, type Pledge } from '@/hangar/pledge';
import { settingsItem } from '@/settings/settings';
import { browserNotificationsItem } from './browser-permission';
import {
  checkMeltReady,
  MELT_READY_ALARM,
  meltCandidates,
  meltSchedule,
} from './melt-ready-notification';

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

const MARKED = Date.UTC(2026, 10, 9, 10, 0);
const READY = MARKED + MELT_COOLDOWN_MS;

/** Pledges without a known purchase time: they can be melted 24 hours after their mark. */
const hangar = (...ids: number[]): HangarSnapshot => ({
  version: HANGAR_SNAPSHOT_VERSION,
  syncedAt: '2026-11-09T09:00:00.000Z',
  pledges: ids.map((id) => ({ id, title: `Paints - Paint ${id}` }) as Pledge),
});

const clear = vi.fn();
function stubNotifications() {
  const create = vi.fn().mockResolvedValue('id');
  clear.mockClear();
  (fakeBrowser as unknown as { notifications: unknown }).notifications = {
    create,
    clear,
    onClicked: { addListener: vi.fn() },
  };
  return create;
}

describe('meltCandidates', () => {
  it('takes the marks of pledges in this hangar, without those left out', () => {
    const marks = { 1: MARKED, 2: MARKED, 3: MARKED };
    const candidates = meltCandidates(marks, hangar(1, 2), null, new Set([2]));
    // 3 isn't in this device's hangar (marked elsewhere), 2 is a filler paint.
    expect(candidates).toEqual([{ pledgeId: 1, title: 'Paints - Paint 1', meltableAt: READY }]);
  });
});

describe('meltCandidates of pledges meltable already', () => {
  it('leaves out a pledge that could be melted when it was marked', () => {
    const old = hangar(1);
    old.pledges[0]!.createdAt = '2024-09-30';
    expect(meltCandidates({ 1: MARKED }, old, null)).toEqual([]);
  });
});

describe('meltSchedule', () => {
  const candidates = [
    { pledgeId: 1, title: 'A', meltableAt: READY },
    { pledgeId: 2, title: 'B', meltableAt: READY + 60_000 },
  ];

  it('announces the due ones and looks again at the next', () => {
    expect(meltSchedule(candidates, {}, READY)).toEqual({
      due: [candidates[0]],
      next: READY + 60_000,
    });
  });

  it('leaves out those already announced', () => {
    expect(meltSchedule(candidates, { 1: READY }, READY + 60_000)).toEqual({
      due: [candidates[1]],
    });
  });
});

describe('checkMeltReady', () => {
  it('sets the alarm for the earliest pledge, only while notifications can be shown', async () => {
    await meltMarksItem.setValue({ 1: MARKED });
    await hangarSnapshot.setValue(hangar(1));
    await checkMeltReady(MARKED);
    expect(await browser.alarms.get(MELT_READY_ALARM)).toBeUndefined();
    await browserNotificationsItem.setValue(true);
    await hangarSnapshot.setValue(hangar(1));
    await checkMeltReady(MARKED);
    expect((await browser.alarms.get(MELT_READY_ALARM))?.scheduledTime).toBe(READY);
  });

  it('announces a pledge once, when the browser allows it', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await meltMarksItem.setValue({ 1: MARKED, 2: MARKED });
    await hangarSnapshot.setValue(hangar(1, 2));
    await checkMeltReady(READY);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![1].message).toContain('2 marked pledges');

    await checkMeltReady(READY + 1000);
    expect(create).toHaveBeenCalledOnce();
    expect(await browser.alarms.get(MELT_READY_ALARM)).toBeUndefined();
  });

  it('names the pledge when it is only one', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await meltMarksItem.setValue({ 1: MARKED });
    await hangarSnapshot.setValue(hangar(1));
    await checkMeltReady(READY);
    expect(create.mock.calls[0]![1].message).toContain('Paints - Paint 1');
  });

  it('shows nothing without the permission or in the demo, but counts them as told', async () => {
    const create = stubNotifications();
    await meltMarksItem.setValue({ 1: MARKED });
    await hangarSnapshot.setValue(hangar(1));
    await checkMeltReady(READY);
    await browserNotificationsItem.setValue(true);
    await checkMeltReady(READY + 1000);
    expect(create).not.toHaveBeenCalled();

    await settingsItem.setValue({ demoMode: true });
    await meltMarksItem.setValue({ 1: MARKED, 2: MARKED });
    await hangarSnapshot.setValue(hangar(1, 2));
    await checkMeltReady(READY + 2000);
    expect(create).not.toHaveBeenCalled();
  });

  it('announces a pledge marked again after it was unmarked', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await hangarSnapshot.setValue(hangar(1));
    await meltMarksItem.setValue({ 1: MARKED });
    await checkMeltReady(READY);
    await meltMarksItem.setValue({});
    await checkMeltReady(READY + 1000);
    await meltMarksItem.setValue({ 1: MARKED });
    await checkMeltReady(READY + 2000);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('takes the notification away once its pledges are melted', async () => {
    stubNotifications();
    await browserNotificationsItem.setValue(true);
    await meltMarksItem.setValue({ 1: MARKED, 2: MARKED });
    await hangarSnapshot.setValue(hangar(1, 2));
    await checkMeltReady(READY);
    // One melted: the notification stays for the other.
    await hangarSnapshot.setValue(hangar(2));
    await checkMeltReady(READY + 1000);
    expect(clear).not.toHaveBeenCalled();
    // Both melted.
    await hangarSnapshot.setValue(hangar());
    await checkMeltReady(READY + 2000);
    expect(clear).toHaveBeenCalledWith('shm-melt-ready');
  });

  it('names all pledges still to melt when another one is due', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await hangarSnapshot.setValue(hangar(1, 2));
    await meltMarksItem.setValue({ 1: MARKED });
    await checkMeltReady(READY);
    await meltMarksItem.setValue({ 1: MARKED, 2: MARKED + 60_000 });
    await checkMeltReady(READY + 60_000);
    expect(create.mock.calls[1]![1].message).toContain('2 marked pledges');
  });

  it('shows nothing while the kind is turned off, and takes a shown one away', async () => {
    const create = stubNotifications();
    await browserNotificationsItem.setValue(true);
    await meltMarksItem.setValue({ 1: MARKED });
    await hangarSnapshot.setValue(hangar(1));
    await checkMeltReady(READY);
    expect(create).toHaveBeenCalledOnce();
    await settingsItem.setValue({ notificationsOff: ['meltReady'] });
    await checkMeltReady(READY + 1000);
    expect(clear).toHaveBeenCalledWith('shm-melt-ready');
    await meltMarksItem.setValue({ 1: MARKED, 2: MARKED });
    await hangarSnapshot.setValue(hangar(1, 2));
    await checkMeltReady(READY + 2000);
    expect(create).toHaveBeenCalledOnce();
  });
});
