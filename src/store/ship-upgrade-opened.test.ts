// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import { notifyShipUpgradeOpened, useCloseOnShipUpgrade } from './ship-upgrade-opened';

/* An overlay closes once RSI's ship upgrade dialog opens from it (#564). */

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  app = undefined;
  vi.useRealTimers();
});

function mountOverlay(close: () => void) {
  app = createApp({
    setup() {
      useCloseOnShipUpgrade(close);
      return () => h('div');
    },
  });
  app.mount(document.createElement('div'));
}

describe('closing on the ship upgrade dialog (#564)', () => {
  it('closes an open overlay a task after the click, once RSI’s handler has had it', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    mountOverlay(close);
    notifyShipUpgradeOpened();
    // Not at once: RSI's click handler on the page still needs the button.
    expect(close).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves an overlay alone once it is closed', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    mountOverlay(close);
    app!.unmount();
    app = undefined;
    notifyShipUpgradeOpened();
    vi.runAllTimers();
    expect(close).not.toHaveBeenCalled();
  });
});
