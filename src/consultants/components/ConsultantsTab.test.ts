// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { withDefaults } from '@/settings/settings';
import { consultantRequest } from '../consultants';
import ConsultantsTab from './ConsultantsTab.vue';

const state = vi.hoisted(() => ({
  ccus: 5,
  missing: 3,
  buyback: 2,
  paint: { available: true, count: 4 },
}));

vi.mock('@/ccu-consultant/use-base-ship-list', async () => {
  const { computed } = await import('vue');
  return {
    useBaseShipList: () =>
      computed(() => ({ total: state.ccus, counts: { buyback: state.buyback } })),
    missingCounts: () => ({ total: state.missing }),
  };
});
// The consultants stand for themselves: only which one shows counts here.
vi.mock('@/ccu-consultant/components/CcuConsultant.vue', () => ({
  default: { render: () => h('p', { class: 'ccu' }, 'CCU') },
}));
vi.mock('@/store/components/PaintConsultant.vue', () => ({
  default: {
    emits: ['offer'],
    mounted(this: { $emit: (event: string, value: unknown) => void }) {
      this.$emit('offer', state.paint);
    },
    render: () => h('p', { class: 'paint' }, 'Paint'),
  },
}));

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  consultantRequest.value = undefined;
});

async function render() {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(ConsultantsTab, {
    settings: withDefaults({}),
    pledges: [],
    buyback: [],
    active: true,
  });
  app.mount(root);
  await nextTick();
  await nextTick();
  const visible = (selector: string) =>
    (root.querySelector(selector)?.parentElement as HTMLElement).style.display !== 'none';
  return { root, visible };
}

const tabs = (root: HTMLElement) =>
  [...root.querySelectorAll('[role="tab"]')].map((tab) =>
    tab.textContent!.replace(/\s+/g, ' ').trim(),
  );

describe('the tab "Consultants" (#453)', () => {
  it('has a sub tab for each consultant with its count, the CCU Consultant first', async () => {
    Object.assign(state, { ccus: 5, missing: 3, paint: { available: true, count: 4 } });
    const { root, visible } = await render();
    expect(tabs(root)).toEqual(['CCU Consultant 3', 'Paint Discount 4']);
    expect(root.querySelector('.shm-tab-count.is-danger')).not.toBeNull();
    expect(visible('.ccu')).toBe(true);
    expect(visible('.paint')).toBe(false);
    root.querySelectorAll<HTMLElement>('[role="tab"]')[1]!.click();
    await nextTick();
    expect(visible('.paint')).toBe(true);
  });

  it('counts the CCUs only via buy back in orange while none is without base ship', async () => {
    Object.assign(state, { ccus: 5, missing: 0, buyback: 2, paint: { available: true, count: 4 } });
    const { root } = await render();
    expect(tabs(root)[0]).toBe('CCU Consultant 2');
    expect(root.querySelector('.shm-tab-count.is-warning')).not.toBeNull();
  });

  it('shows the name of a single consultant as the heading, without sub tabs', async () => {
    Object.assign(state, { ccus: 5, missing: 3, paint: { available: false, count: 0 } });
    let { root } = await render();
    expect(tabs(root)).toEqual([]);
    expect(root.querySelector('h3')!.textContent!.trim()).toBe('CCU Consultant');
    app!.unmount();
    Object.assign(state, { ccus: 0, paint: { available: true, count: 4 } });
    ({ root } = await render());
    expect(tabs(root)).toEqual([]);
    expect(root.querySelector('h3')!.textContent!.trim()).toBe('Paint Discount');
  });

  it('shows the consultant a link asks for', async () => {
    Object.assign(state, { ccus: 5, missing: 3, paint: { available: true, count: 4 } });
    consultantRequest.value = { id: 'paint', at: 1 };
    const { visible } = await render();
    expect(visible('.paint')).toBe(true);
  });
});
