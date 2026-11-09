// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SMART_UPDATE } from '@/config';
import {
  isConfirmingSubmit,
  rememberOwnAction,
  takeOwnAction,
  watchOwnActions,
} from './own-actions';

beforeEach(() => {
  fakeBrowser.reset();
  vi.useRealTimers();
});

/** RSI's dialogs as of November 2026, reduced to their structure. */
const EXCHANGE = `
  <div class="js-overlay overlay modals lightbox js-lightbox"><a class="close js-close"></a>
    <form class="legacy-form">
      <div class="pane step1"><input type="checkbox"><input type="submit" value="CONTINUE"></div>
      <div class="pane step2"><input type="password"><input type="submit" value="SUBMIT"></div>
    </form>
  </div>`;
const APPLY_UPGRADE = `
  <div class="js-overlay overlay modals apply-upgrade lightbox js-lightbox">
    <form class="legacy-form">
      <div class="pane step1"><input type="radio"><input type="submit" value="NEXT"></div>
      <div class="pane step2"><input type="password">
        <input type="submit" value="BACK"><input type="submit" value="APPLY"></div>
    </form>
  </div>`;
const GIFT = `
  <div class="js-overlay overlay modals lightbox js-lightbox">
    <form class="legacy-form"><input type="password"><input id="gift_name">
      <input type="submit" value="Gift"></form>
  </div>`;

const submit = (value: string) =>
  document.querySelector<HTMLInputElement>(`input[type="submit"][value="${value}"]`)!;

describe('isConfirmingSubmit', () => {
  it.each([
    [EXCHANGE, 'CONTINUE', false],
    [EXCHANGE, 'SUBMIT', true],
    [APPLY_UPGRADE, 'NEXT', false],
    [APPLY_UPGRADE, 'BACK', false],
    [APPLY_UPGRADE, 'APPLY', true],
    [GIFT, 'Gift', true],
  ])('tells the confirming button apart (%#: %s)', (html, value, confirming) => {
    document.body.innerHTML = html;
    expect(isConfirmingSubmit(submit(value))).toBe(confirming);
  });

  it('ignores the close button and forms outside RSI dialogs', () => {
    document.body.innerHTML = `${EXCHANGE}
      <form><input type="password"><input type="submit" value="Sign in"></form>`;
    expect(isConfirmingSubmit(document.querySelector('.js-close')!)).toBe(false);
    expect(isConfirmingSubmit(submit('Sign in'))).toBe(false);
  });
});

describe('takeOwnAction', () => {
  it('takes a recent action once', async () => {
    await rememberOwnAction(1000);
    expect(await takeOwnAction(2000)).toBe(true);
    expect(await takeOwnAction(2000)).toBe(false);
  });

  it('drops an action too old to check for', async () => {
    await rememberOwnAction(0);
    expect(await takeOwnAction(SMART_UPDATE.ownAction.maxAgeMs + 1)).toBe(false);
  });
});

describe('watchOwnActions', () => {
  it('checks after a confirmed action only', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    document.body.innerHTML = EXCHANGE;
    const check = vi.fn();
    const controller = new AbortController();
    watchOwnActions(controller.signal, check);

    // Only trusted clicks count: the user's own.
    const click = (value: string) => {
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'isTrusted', { value: true });
      submit(value).dispatchEvent(event);
    };
    click('CONTINUE');
    await vi.runAllTimersAsync();
    expect(check).not.toHaveBeenCalled();

    click('SUBMIT');
    await vi.advanceTimersByTimeAsync(SMART_UPDATE.ownAction.checkAfterMs);
    expect(check).toHaveBeenCalledOnce();
    controller.abort();
  });
});
