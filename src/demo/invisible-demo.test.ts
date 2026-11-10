import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEMO } from '@/config';
import {
  invisibleDemoUntilItem,
  isInvisibleDemo,
  startInvisibleDemo,
  stopInvisibleDemo,
} from './invisible-demo';

const NOW = Date.parse('2026-11-10T12:00:00Z');

beforeEach(() => fakeBrowser.reset());

describe('the invisible demo mode (#133)', () => {
  it('lasts its minutes from the start, only with the demo mode on', async () => {
    await startInvisibleDemo(NOW);
    const until = await invisibleDemoUntilItem.getValue();
    expect(until).toBe(NOW + DEMO.invisibleMinutes * 60_000);
    expect(isInvisibleDemo(until, true, NOW + 60_000)).toBe(true);
    expect(isInvisibleDemo(until, false, NOW + 60_000)).toBe(false);
    // Back to the normal demo mode once the time is over.
    expect(isInvisibleDemo(until, true, until!)).toBe(false);
  });

  it('can be ended at once', async () => {
    await startInvisibleDemo(NOW);
    await stopInvisibleDemo();
    expect(isInvisibleDemo(await invisibleDemoUntilItem.getValue(), true, NOW)).toBe(false);
  });
});
