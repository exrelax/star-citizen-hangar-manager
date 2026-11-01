import { describe, expect, it } from 'vitest';
import type { Pledge } from './pledge';
import { toPledgeView } from './pledge-view';

const PLACEHOLDER = 'https://robertsspaceindustries.com/static/images/Temp/default-image.png';

const pledge = (overrides: Partial<Pledge>): Pledge =>
  ({
    id: 1,
    name: 'Standalone Ships - Aurora Mk I ES',
    title: 'Standalone Ships - Aurora Mk I ES',
    value: '$30.00 USD',
    createdAt: '2020-01-01',
    image: 'pledge.jpg',
    isGiftable: true,
    isExchangeable: false,
    isUpgraded: false,
    items: [],
    ...overrides,
  }) as Pledge;

describe('toPledgeView', () => {
  it('shows the current ship of an upgraded pledge', () => {
    const view = toPledgeView(
      pledge({
        title: 'Standalone Ships - Aurora Mk I ES Upgrades',
        isUpgraded: true,
        items: [
          { title: 'Polaris', kind: 'Ship', image: 'polaris.jpg' },
          { title: 'Lifetime Insurance', kind: 'Insurance' },
        ],
      }),
    );

    expect(view).toMatchObject({
      title: 'Polaris',
      originalName: 'Standalone Ships - Aurora Mk I ES',
      image: 'polaris.jpg',
      isUpgraded: true,
      hasLti: true,
    });
  });

  it('keeps title and image of pledges without an applied CCU', () => {
    const view = toPledgeView(
      pledge({ items: [{ title: 'Aurora', kind: 'Ship', image: 'a.jpg' }] }),
    );
    expect(view).toMatchObject({
      title: 'Standalone Ships - Aurora Mk I ES',
      originalName: undefined,
      image: 'pledge.jpg',
      isUpgraded: false,
      hasLti: false,
    });
  });

  it('uses the target ship image for CCUs', () => {
    const view = toPledgeView(
      pledge({
        image: PLACEHOLDER,
        upgrade: { matchItems: [], targetItems: [], type: 'R', targetImage: 'target.jpg' },
      }),
    );
    expect(view.image).toBe('target.jpg');
  });

  it('skips the RSI placeholder in favor of an item image', () => {
    const view = toPledgeView(
      pledge({ image: PLACEHOLDER, items: [{ title: 'Paint', kind: 'Skin', image: 'paint.jpg' }] }),
    );
    expect(view.image).toBe('paint.jpg');
  });

  it('prepares the displayed title for the search', () => {
    const view = toPledgeView(
      pledge({ isUpgraded: true, items: [{ title: 'Polaris', kind: 'Ship', image: 'p.jpg' }] }),
    );
    expect(view.searchText).toBe(' polaris');
  });

  it('maps gift and melt state', () => {
    expect(toPledgeView(pledge({ isGiftable: false, isExchangeable: true }))).toMatchObject({
      isGiftable: false,
      isMeltable: true,
    });
  });

  it('does not treat fixed-term insurance as LTI', () => {
    const view = toPledgeView(
      pledge({ items: [{ title: '120 Month Insurance', kind: 'Insurance' }] }),
    );
    expect(view.hasLti).toBe(false);
  });
});
