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
    valueUsd: 30,
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
    expect(view.searchText).toBe(' polaris 1');
  });

  it('lists contained ships and makes them searchable', () => {
    const view = toPledgeView(
      pledge({
        title: 'VIP Wing Commander',
        items: [
          { title: 'F8C Lightning', kind: 'Ship' },
          { title: 'F8C - Shockwave Paint', kind: 'Skin' },
          { title: 'Lifetime Insurance', kind: 'Insurance' },
        ],
      }),
    );
    expect(view.ships).toEqual([{ name: 'F8C Lightning', link: undefined }]);
    expect(view.searchText).toBe(' vip wing commander f8c lightning 1');
  });

  it('lists each ship once and skips the one shown as title', () => {
    const view = toPledgeView(
      pledge({
        isUpgraded: true,
        items: [
          { title: 'Polaris', kind: 'Ship' },
          { title: 'Pisces', kind: 'Ship' },
          { title: 'Pisces', kind: 'Ship' },
        ],
      }),
    );
    expect(view.title).toBe('Polaris');
    expect(view.ships.map((ship) => ship.name)).toEqual(['Pisces']);
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
    expect(toPledgeView(pledge({ category: 'game_package' })).hasGameAccess).toBe(true);
  });

  it('grants game access for pledges containing the game download', () => {
    const vip = toPledgeView(
      pledge({
        title: 'VIP High Admiral',
        items: [
          { title: 'Top Hat' },
          { title: 'Star Citizen Digital Download' },
          { title: 'Squadron 42 Digital Download' },
        ],
      }),
    );
    const s42Only = toPledgeView(pledge({ items: [{ title: 'Squadron 42 Digital Download' }] }));
    const smg = toPledgeView(
      pledge({ items: [{ title: "Behring P8-SC 'Echo' SMG", kind: 'FPS Equipment' }] }),
    );

    expect(vip.hasGameAccess).toBe(true);
    expect(s42Only.hasGameAccess).toBe(true);
    expect(smg.hasGameAccess).toBe(false);
  });

  it('attaches ship links to contained ships and the title ship', () => {
    const links = {
      Polaris: { fleetyards: 'rsi-polaris', erkul: 'rsi_polaris' },
      Pisces: { fleetyards: 'anvl-c8-pisces' },
    };
    const view = toPledgeView(
      pledge({
        isUpgraded: true,
        items: [
          { title: 'Polaris', kind: 'Ship' },
          { title: 'Pisces', kind: 'Ship' },
        ],
      }),
      links,
    );
    expect(view.titleShip).toEqual({ name: 'Polaris', link: links.Polaris });
    expect(view.ships).toEqual([{ name: 'Pisces', link: links.Pisces }]);
  });

  it('classifies rewards by value and name', () => {
    expect(
      toPledgeView(pledge({ value: '$0.00 USD', valueUsd: 0, title: 'VIP Space Marshal' })).reward,
    ).toBe('concierge');
    expect(toPledgeView(pledge({ value: '$30.00 USD', valueUsd: 30 })).reward).toBeUndefined();
  });

  it('derives the My Gear page from the position', () => {
    expect(toPledgeView(pledge({}), {}, 0).page).toBe(1);
    expect(toPledgeView(pledge({}), {}, 9).page).toBe(1);
    expect(toPledgeView(pledge({}), {}, 10).page).toBe(2);
    expect(toPledgeView(pledge({}), {}, 985).page).toBe(99);
  });

  it('maps gift and melt state', () => {
    expect(toPledgeView(pledge({ isGiftable: false, isExchangeable: true }))).toMatchObject({
      isGiftable: false,
      isMeltable: true,
    });
  });

  it('never lets a protected pledge be melted or gifted', () => {
    const locked = pledge({ protectedGames: ['SC', 'SQ42'], isExchangeable: true });
    expect(toPledgeView(locked)).toMatchObject({
      protectedGames: ['SC', 'SQ42'],
      isGiftable: false,
      isMeltable: false,
    });
    // Stored before the locks were read, or not protected.
    expect(toPledgeView(pledge({ isExchangeable: true }))).toMatchObject({
      protectedGames: [],
      isGiftable: true,
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

describe('insurance', () => {
  it('takes the best insurance of the items, or the one a CCU brings', () => {
    const ship = toPledgeView(
      pledge({
        items: [
          { title: 'Dragonfly Star Kitten Edition', kind: 'Ship' },
          { title: '120 Month Insurance', kind: 'Insurance' },
          { title: '6 Month Insurance', kind: 'Insurance' },
        ],
      }),
    );
    expect(ship.insurance).toEqual({ lifetime: false, months: 120 });

    const ccu = toPledgeView(
      pledge({
        upgrade: {
          type: 'R',
          matchItems: [{ id: 1, name: '600i Exploration Module' }],
          targetItems: [
            { id: 2, name: 'Hercules Starlifter M2' },
            { id: 3, name: '120 Month Insurance' },
          ],
        },
      }),
    );
    expect(ccu.insurance).toEqual({ lifetime: false, months: 120 });
  });
});
