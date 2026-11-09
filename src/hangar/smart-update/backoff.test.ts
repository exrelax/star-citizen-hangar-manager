// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  backoffMinutes,
  currentIntervalMinutes,
  recordCheckResult,
  resetBackoff,
  watchInput,
} from './backoff';

beforeEach(() => fakeBrowser.reset());

describe('backoffMinutes', () => {
  it('doubles after each quiet check, up to four times the set interval', () => {
    expect([0, 1, 2, 3, 10].map((quiet) => backoffMinutes(5, quiet))).toEqual([5, 10, 20, 20, 20]);
  });
});

describe('recordCheckResult', () => {
  it('lengthens the interval while checks find nothing', async () => {
    await recordCheckResult(false);
    expect(await currentIntervalMinutes(5)).toBe(10);
    await recordCheckResult(false);
    await recordCheckResult(false);
    expect(await currentIntervalMinutes(5)).toBe(20);
  });

  it('goes back to the set interval after a change', async () => {
    await recordCheckResult(false);
    await recordCheckResult(true);
    expect(await currentIntervalMinutes(5)).toBe(5);
  });
});

describe('watchInput', () => {
  it('goes back to the set interval on input in the tab', async () => {
    await recordCheckResult(false);
    const controller = new AbortController();
    watchInput(controller.signal);
    const event = new KeyboardEvent('keydown');
    Object.defineProperty(event, 'isTrusted', { value: true });
    document.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve));
    expect(await currentIntervalMinutes(5)).toBe(5);
    controller.abort();
  });

  it('ignores events made by scripts', async () => {
    await recordCheckResult(false);
    const controller = new AbortController();
    watchInput(controller.signal);
    document.dispatchEvent(new KeyboardEvent('keydown'));
    await new Promise((resolve) => setTimeout(resolve));
    expect(await currentIntervalMinutes(5)).toBe(10);
    controller.abort();
  });
});

describe('resetBackoff', () => {
  it('writes only when there is something to reset', async () => {
    await resetBackoff();
    expect(await storage.getItem('local:smartUpdate.quietChecks')).toBeNull();
  });
});
