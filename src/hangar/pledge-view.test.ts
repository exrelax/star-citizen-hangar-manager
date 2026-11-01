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

  it('recognizes pure paint pledges only', () => {
    const paint = toPledgeView(
      pledge({ items: [{ title: 'Ursa - Respite Paint', kind: 'Skin' }] }),
    );
    const paintPack = toPledgeView(
      pledge({
        items: [
          { title: 'Apollo Red Livery', kind: 'Skin' },
          { title: 'Apollo Gold Livery', kind: 'Skin' },
        ],
      }),
    );
    const rewardWithPaint = toPledgeView(
      pledge({
        items: [
          { title: 'Reclaimer - Best In Show Paint', kind: 'Skin' },
          { title: 'Reclaimer Ship Showdown Poster', kind: 'Hangar decoration' },
        ],
      }),
    );
    const paintWithUntypedItem = toPledgeView(
      pledge({ items: [{ title: 'Paint', kind: 'Skin' }, { title: 'Bonus' }] }),
    );

    expect(paint.isPaint).toBe(true);
    expect(paintPack.isPaint).toBe(true);
    expect(rewardWithPaint.isPaint).toBe(false);
    expect(paintWithUntypedItem.isPaint).toBe(false);
    expect(toPledgeView(pledge({ items: [{ title: '400i - Meridian Paint' }] })).isPaint).toBe(
      true,
    );
    expect(toPledgeView(pledge({ items: [] })).isPaint).toBe(false);
  });

  it('maps CCUs and RSI categories', () => {
    const ccu = toPledgeView(
      pledge({
        items: [{ title: 'Paint', kind: 'Skin' }],
        upgrade: { matchItems: [], targetItems: [], type: 'R' },
      }),
    );
    expect(ccu).toMatchObject({ isCcu: true, isPaint: false });
    expect(toPledgeView(pledge({ category: 'standalone_ship' })).isStandaloneShip).toBe(true);
    expect(toPledgeView(pledge({ category: 'game_package' })).isGamePackage).toBe(true);
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
