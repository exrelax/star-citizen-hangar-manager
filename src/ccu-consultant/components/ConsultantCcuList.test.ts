// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import type { PledgeView } from '@/hangar/pledge-view';
import ConsultantCcuList from './ConsultantCcuList.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

const ccu = (id: number, to: string, value: number, giftable = true): PledgeView =>
  ({
    id,
    title: `Upgrade - Cutlass Red to ${to} Standard Edition`,
    isCcu: true,
    upgrade: {
      matchItems: [{ id: 37, name: 'Cutlass Red' }],
      targetItems: [{ id: 90, name: to }],
      type: 'R',
    },
    items: [],
    valueUsd: value,
    discount: { original: 30, paid: value, amount: 30 - value, percent: 0, ships: [] },
    isGiftable: giftable,
    isMeltable: true,
    isUpgraded: false,
  }) as unknown as PledgeView;

const ccus = [ccu(1, 'Prowler', 20), ccu(2, 'Prowler', 25, false), ccu(3, 'Hammerhead', 40)];

let root: HTMLElement;
function render(grouped: boolean) {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () =>
      h(ConsultantCcuList, {
        ccus,
        grouped,
        hideValues: false,
        hideIds: false,
      }),
  });
  app.mount(root);
  return [...root.querySelectorAll('li')].map((item) =>
    item.textContent!.replace(/\s+/g, ' ').trim(),
  );
}

describe('the CCUs of a base ship in the CCU Consultant (#456)', () => {
  it('groups the same CCUs with their count, sums and labels, most first', () => {
    expect(render(true)).toEqual([
      'Upgrade - Cutlass Red to Prowler Standard Edition×2$45 −$15Some giftMelt',
      'Upgrade - Cutlass Red to Hammerhead Standard Edition#3$40GiftMelt',
    ]);
  });

  it('lists each CCU on its own without grouping', () => {
    expect(render(false)).toHaveLength(3);
    expect(render(false)[0]).toContain('#1');
  });
});
