import { toBuybackView, type BuybackView } from '@/buyback/buyback-view';
import type { BuybackPledge } from '@/buyback/buyback';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView, type PledgeView } from '@/hangar/pledge-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import { localToday } from '@/orders/refund';

/*
 * Made-up pledges for the styleguide: one of each kind the manager tells apart (upgraded ship,
 * ship, CCU, paint, game package, reward), with the states that change a row (insurance,
 * discount, refund period, giftable, meltable, protected game access). They go through the same
 * view functions as the stored hangar, so the rows look exactly like in the manager. No ids are
 * real.
 */

const priceOf = createPriceLookup([
  { name: 'Polaris', price: 975 },
  { name: 'A2 Hercules', price: 750 },
  { name: 'Fury', price: 55 },
  { name: 'Nomad', price: 80 },
]);

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localToday(date);
};

const pledge = (overrides: Partial<Pledge>): Pledge => ({
  id: 0,
  name: '',
  title: '',
  value: '$0.00 USD',
  valueUsd: 0,
  configurationValue: '$0.00 USD',
  currency: 'Store Credit',
  createdAt: '2025-01-01',
  availability: 'Attributed',
  contains: '',
  isLastAlpha: false,
  isBuybackable: true,
  isGiftable: true,
  isExchangeable: true,
  isUpgradeable: false,
  isUpgraded: false,
  nameReservations: null,
  nameableShips: null,
  items: [],
  ...overrides,
});

const PLEDGES: Pledge[] = [
  pledge({
    id: 90000001,
    name: 'Standalone Ships - Aurora Mk I ES',
    title: 'Standalone Ships - Aurora Mk I ES',
    value: '$270.00 USD',
    valueUsd: 270,
    createdAt: '2026-09-30',
    isUpgraded: true,
    items: [
      { title: 'Polaris', kind: 'Ship', manufacturer: 'Roberts Space Industries' },
      { title: '120 Month Insurance', kind: 'Insurance' },
      { title: 'Lifetime Insurance', kind: 'Insurance' },
      { title: 'Self-Land Hangar', kind: 'Hangar' },
    ],
  }),
  pledge({
    id: 90000002,
    name: 'Paints - Paladin - Shadowfall Paint',
    title: 'Paints - Paladin - Shadowfall Paint',
    value: '$7.50 USD',
    valueUsd: 7.5,
    createdAt: daysAgo(4),
    items: [{ title: 'Paladin - Shadowfall Paint', kind: 'Skin' }],
  }),
  pledge({
    id: 90000003,
    name: 'Upgrade - A2 Hercules to Polaris Warbond Edition',
    title: 'Upgrade - A2 Hercules to Polaris Warbond Edition',
    value: '$100.00 USD',
    valueUsd: 100,
    createdAt: '2024-12-05',
    upgrade: {
      matchItems: [{ id: 1, name: 'A2 Hercules' }],
      targetItems: [
        { id: 2, name: 'Polaris' },
        { id: 3, name: '120 Month Insurance' },
      ],
      type: 'R',
    },
  }),
  pledge({
    id: 90000004,
    name: 'Standalone Ships - Fury LTI',
    title: 'Standalone Ships - Fury LTI',
    value: '$50.00 USD',
    valueUsd: 50,
    createdAt: daysAgo(27),
    category: 'standalone_ship',
    items: [
      { title: 'Fury', kind: 'Ship', manufacturer: 'Mirai' },
      { title: 'Lifetime Insurance', kind: 'Insurance' },
    ],
  }),
  pledge({
    id: 90000005,
    name: 'Package - Nomad Star Citizen + Squadron 42 Combo',
    title: 'Package - Nomad Star Citizen + Squadron 42 Combo',
    value: '$115.00 USD',
    valueUsd: 115,
    createdAt: '2020-11-29',
    category: 'game_package',
    isLastAlpha: true,
    // RSI's game access lock: no Exchange or Gift, but still upgradeable.
    protectedGames: ['SC', 'SQ42'],
    isGiftable: false,
    isExchangeable: false,
    isUpgradeable: true,
    items: [
      { title: 'Nomad', kind: 'Ship', manufacturer: 'Consolidated Outland' },
      { title: 'Star Citizen Digital Download', kind: 'Downloadable' },
      { title: 'Squadron 42 Digital Download', kind: 'Downloadable' },
      { title: 'Lifetime Insurance', kind: 'Insurance' },
    ],
  }),
  pledge({
    id: 90000006,
    name: 'Phoenix Insignia Display',
    title: 'Phoenix Insignia Display',
    createdAt: '2026-10-14',
    isGiftable: false,
    isExchangeable: false,
    items: [{ title: 'Phoenix Insignia Display', kind: 'Hangar decoration' }],
  }),
];

/** Money-paid orders of the pledges bought with money (for the order line and refund tags). */
const ORDERS: Record<number, { id: string; amount: string; placedAt: string }> = {
  90000002: { id: 'XSTYLEGUIDE02', amount: '$8.93 USD', placedAt: daysAgo(4) },
  90000004: { id: 'XSTYLEGUIDE04', amount: '$59.50 USD', placedAt: daysAgo(27) },
};

export const hangarFixtures: PledgeView[] = PLEDGES.map((entry, index) => {
  const view = toPledgeView(entry, {}, index, priceOf);
  const order = ORDERS[entry.id];
  return order ? { ...view, order: { ...order, buyback: false } } : view;
});

const BUYBACK: BuybackPledge[] = [
  {
    id: 80000001,
    title: 'Upgrade - A2 Hercules to Polaris Standard Upgrade',
    reclaimedAt: '2026-03-02',
    contained: 'A2 Hercules to Polaris',
    isUpgrade: true,
    upgrade: { fromShipId: 1, toShipId: 2, toSkuId: 3 },
  },
  {
    id: 80000002,
    title: 'Paints - Polaris - Quasar Paint',
    reclaimedAt: '2026-02-11',
    contained: 'Polaris - Quasar Paint',
    isUpgrade: false,
  },
  {
    id: 80000003,
    title: 'Standalone Ships - Cutlass Black',
    reclaimedAt: '2025-06-20',
    contained: 'Cutlass Black and 2 items',
    isUpgrade: false,
    category: 'standalone_ship',
    items: ['Cutlass Black', 'Lifetime Insurance', 'Self-Land Hangar'],
  },
];

export const buybackFixtures: BuybackView[] = BUYBACK.map((entry, position) =>
  toBuybackView(entry, { position, idLimit: undefined }),
);
