import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { checkOff, notificationsItem } from './notifications';
import { browserIdOf, noteIdOf, watchNotesInStep } from './note-sync';

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
