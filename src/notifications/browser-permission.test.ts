import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  browserNotificationsItem,
  browserNotificationsRefusedItem,
  mirrorNotificationPermission,
  requestNotificationPermission,
} from './browser-permission';

beforeEach(() => fakeBrowser.reset());

describe('mirrorNotificationPermission', () => {
  it('stores whether the browser allows notifications now', async () => {
    expect(await mirrorNotificationPermission(async () => true)).toBe(true);
    expect(await browserNotificationsItem.getValue()).toBe(true);

    // Taken back in the browser's settings: the setting goes off.
    expect(await mirrorNotificationPermission(async () => false)).toBe(false);
    expect(await browserNotificationsItem.getValue()).toBe(false);
  });

  it('forgets an earlier refusal once allowed', async () => {
    await browserNotificationsRefusedItem.setValue(true);
    await mirrorNotificationPermission(async () => true);
    expect(await browserNotificationsRefusedItem.getValue()).toBe(false);
  });
});

describe('requestNotificationPermission', () => {
  it('turns the setting on when the browser allows it', async () => {
    expect(await requestNotificationPermission(async () => true)).toBe(true);
    expect(await browserNotificationsItem.getValue()).toBe(true);
    expect(await browserNotificationsRefusedItem.getValue()).toBe(false);
  });

  it('keeps it off and remembers why when refused', async () => {
    expect(await requestNotificationPermission(async () => false)).toBe(false);
    expect(await browserNotificationsItem.getValue()).toBe(false);
    expect(await browserNotificationsRefusedItem.getValue()).toBe(true);
  });

  it('counts a failed request as refused', async () => {
    const failing = () => Promise.reject(new Error('needs a user gesture'));
    expect(await requestNotificationPermission(failing)).toBe(false);
    expect(await browserNotificationsRefusedItem.getValue()).toBe(true);
  });
});
