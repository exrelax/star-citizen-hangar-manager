import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { checkOff, notificationsItem } from './notifications';
import { browserNotificationsItem } from './browser-permission';
import {
  browserIdOf,
  noteIdOf,
  openForNote,
  showNewNotesInBrowser,
  watchNotesInStep,
} from './note-sync';
import { openHangarManager } from '@/background/dispatch';

vi.mock('@/background/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/background/dispatch')>()),
  openHangarManager: vi.fn(async () => {}),
}));

const clear = vi.fn();
let closed: ((id: string, byUser: boolean) => void) | undefined;

beforeEach(() => {
  fakeBrowser.reset();
  clear.mockClear();
  (fakeBrowser as unknown as { notifications: unknown }).notifications = {
    clear,
    onClicked: { addListener: vi.fn() },
    onClosed: { addListener: (listener: typeof closed) => (closed = listener) },
  };
});

const note = { id: 'store:42', text: 'A new warbond CCU', at: 1 };
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('note ids', () => {
  it('match the sidebar notification and the browser one', () => {
    expect(browserIdOf(note)).toBe('note:store:42');
    expect(noteIdOf('note:store:42')).toBe('store:42');
    expect(noteIdOf('shm-melt-ready')).toBeUndefined();
  });
});

describe('watchNotesInStep', () => {
  it('clears the browser notification of one checked off in the sidebar', async () => {
    await notificationsItem.setValue([note]);
    watchNotesInStep();
    await settle();
    await checkOff([note.id]);
    await settle();
    expect(clear).toHaveBeenCalledWith('note:store:42');
  });

  it('checks off the sidebar one closed in the browser, not one closed by itself', async () => {
    await notificationsItem.setValue([note]);
    watchNotesInStep();
    closed?.('note:store:42', false);
    await settle();
    expect((await notificationsItem.getValue())[0]?.doneAt).toBeUndefined();
    closed?.('note:store:42', true);
    await settle();
    expect((await notificationsItem.getValue())[0]?.doneAt).toBeTypeOf('number');
  });
});

describe('showNewNotesInBrowser', () => {
  const warbonds = {
    id: 'warbonds:1',
    kind: 'warbonds' as const,
    text: 'New warbond CCUs: Zeus MR ($170)',
    at: 1_000_000,
    browser: { title: 'New warbond CCUs in the Pledge Store', text: 'Zeus MR ($170)' },
  };
  let create: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    create = vi.fn().mockResolvedValue('id');
    (fakeBrowser as unknown as { notifications: { create: unknown } }).notifications.create =
      create;
  });

  it('shows a new one once, while the browser allows it', async () => {
    await browserNotificationsItem.setValue(true);
    await showNewNotesInBrowser([warbonds], warbonds.at + 1000);
    await showNewNotesInBrowser([warbonds], warbonds.at + 2000);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0]).toBe('note:warbonds:1');
  });

  it('leaves out old ones, those without a browser text and those without the permission', async () => {
    await browserNotificationsItem.setValue(true);
    await showNewNotesInBrowser([warbonds], warbonds.at + 60 * 60 * 1000);
    await showNewNotesInBrowser(
      [{ ...warbonds, id: 'storeItems:1', browser: undefined }],
      warbonds.at,
    );
    await browserNotificationsItem.setValue(false);
    await showNewNotesInBrowser([{ ...warbonds, id: 'warbonds:2' }], warbonds.at);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('the link to the Pledge Store (#276)', () => {
  const warbonds = {
    id: 'warbonds:1',
    kind: 'warbonds' as const,
    text: 'New warbond CCUs',
    at: 1_000_000,
    browser: { title: 'New warbond CCUs', text: 'Zeus MR ($170)' },
  };
  const items = { ...warbonds, id: 'storeItems:1', kind: 'storeItems' as const };
  let create: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    create = vi.fn().mockResolvedValue('id');
    (fakeBrowser as unknown as { notifications: { create: unknown } }).notifications.create =
      create;
    await browserNotificationsItem.setValue(true);
    vi.mocked(openHangarManager).mockClear();
  });

  it('gives the browser notification its button only where the tab shows the change', async () => {
    await showNewNotesInBrowser([warbonds, items], warbonds.at);
    const options = (id: string) => create.mock.calls.find((call) => call[0] === id)?.[1];
    // Firefox shows no buttons at all.
    expect(options('note:warbonds:1')?.buttons).toEqual(
      import.meta.env.FIREFOX ? undefined : [{ title: expect.any(String) }],
    );
    expect(options('note:storeItems:1')).not.toHaveProperty('buttons');
  });

  it('opens the warbond CCUs for theirs, else just the manager', async () => {
    await notificationsItem.setValue([warbonds, items]);
    await openForNote('note:warbonds:1');
    await openForNote('note:storeItems:1');
    expect(vi.mocked(openHangarManager).mock.calls).toEqual([['showWarbonds'], ['open']]);
  });
});
