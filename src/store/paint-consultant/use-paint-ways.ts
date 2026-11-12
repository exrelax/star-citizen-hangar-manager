import { PAINT_DISCOUNT_TIERS } from '@/config';
import { useDemoContext } from '@/demo/use-demo';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import { openTabAt } from '@/hangar/open-tab-at';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import { BULK_MELTING_SETTING_ID } from '@/settings/anchors';
import { useStored } from '@/storage/use-stored';
import { computed, ref } from 'vue';
import type { MissingCredit, PaintRebuyPlan } from './calculation';
import { cartLinesOf } from './cart';
import {
  currentPlanOf,
  rebuyPlanItem,
  demoRebuyPlanItem,
  rebuyPlanItemOf,
  storedPlanOf,
  type PlanWay,
} from './rebuy-plan-storage';
import { usePaintConsultant } from './use-paint-consultant';
import { cartCardsOf, waysOf, type PaintWay, type WayKind, type WayStep } from './ways';

/*
 * What both card layouts of the Paint Discount Consultant show of its two ways (`ways.ts`): the
 * "ways" layout side by side, the "choose" layout one at a time (#246). "Buy first" pays the whole
 * cart from the store credit before any paint is melted – safe, at the tier the store credit pays
 * alone; "melt first" fills the cart and keeps the plan, melts the own paints and pays with their
 * melt value. With the result of each way, the discount tiers, the cart, why the ways differ,
 * their steps with the store credit after each one and a chart of it.
 */

export interface PaintWaysProps {
  /** The best cart with the melt value ("melt first"). */
  plan: PaintRebuyPlan;
  /** The best cart the store credit pays alone ("buy first"), if any. */
  buyFirst?: PaintRebuyPlan;
  /** The store credit the plan may use. */
  credit: number;
  next?: MissingCredit;
}

/** RSI's article on the 24-hour cooldown before a pledge can be melted. */
export const COOLDOWN_SOURCE =
  'https://support.robertsspaceindustries.com/hc/en-us/articles/115013193627-Reclaim-a-Pledge';

export const CHART = { width: 720, height: 200, left: 80, right: 660, top: 28, bottom: 168 };

export function usePaintWays(props: PaintWaysProps) {
  const { pledges, storeItems, accountCredit } = usePaintConsultant();
  const demo = useDemoContext();

  const usd = (value: number) => formatUsd(value, locale.value);
  const percent = (value: number) => formatPercent(value, locale.value);
  /** "+$32" or "−$34.45"; nothing for 0. */
  const signed = (value: number) =>
    value > 0 ? `+${usd(value)}` : value < 0 ? `−${usd(-value)}` : '';
  /** The factor the volume discount leaves, e.g. 0.65 for 35 %. */
  const factor = (tierPercent: number) =>
    new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(
      (100 - tierPercent) / 100,
    );

  const ways = computed(() => waysOf(props.plan, props.buyFirst, props.credit));
  const comparison = computed(() => ways.value.comparison);
  const cards = computed(() => cartCardsOf(ways.value));
  /** Both carts are shown: buying first takes a lower tier. */
  const dual = computed(() => comparison.value === 'lowerTier');

  const images = computed(
    () => new Map((storeItems.value ?? []).map((item) => [item.id, item.image] as const)),
  );

  const countOf = (plan: PaintRebuyPlan) =>
    plan.own.length + plan.fillers.reduce((sum, filler) => sum + filler.quantity, 0);
  const meltAfterOf = (plan: PaintRebuyPlan) =>
    Math.round((plan.meltValue - plan.storeCreditFreed) * 100) / 100;
  const wayTitle = (kind: WayKind) =>
    i18n.t(kind === 'buy' ? 'consultant.ways.buyTitle' : 'consultant.ways.meltTitle');
  const wayNumber = (kind: WayKind) => (kind === 'buy' ? '1' : '2');

  // ---- The result ----

  const results = computed(() => {
    const resultSub = (plan: PaintRebuyPlan) =>
      i18n.t('consultant.ways.resultSub', [
        percent(plan.tier.percent),
        countOf(plan),
        usd(plan.meltValue),
        usd(meltAfterOf(plan)),
      ]);
    if (comparison.value === 'same') {
      return [
        {
          kind: 'both' as const,
          num: '1 = 2',
          title: i18n.t('consultant.ways.sameResult'),
          sub: resultSub(props.plan),
          value: signed(props.plan.storeCreditFreed),
        },
      ];
    }
    const buy = ways.value.buy;
    return [
      {
        kind: 'buy' as const,
        num: '1',
        title: wayTitle('buy'),
        sub: buy.plan
          ? resultSub(buy.plan)
          : i18n.t('consultant.ways.notPossible', [usd(buy.missing)]),
        value: buy.plan ? signed(buy.plan.storeCreditFreed) : '–',
      },
      {
        kind: 'melt' as const,
        num: '2',
        title: wayTitle('melt'),
        sub: resultSub(props.plan),
        value: signed(props.plan.storeCreditFreed),
      },
    ];
  });

  // ---- The discount tiers ----

  const tiers = computed(() => {
    const buyTier = ways.value.buy.plan?.tier.percent;
    const meltTier = props.plan.tier.percent;
    return PAINT_DISCOUNT_TIERS.tiers.map((tier, i) => ({
      ...tier,
      height: `${18 + i * 5.5}px`,
      // The same tier for both: highlighted without marks.
      reached: comparison.value === 'same' && tier.percent === meltTier,
      marks:
        comparison.value === 'same'
          ? []
          : ([] as WayKind[])
              .concat(tier.percent === buyTier ? ['buy'] : [])
              .concat(tier.percent === meltTier ? ['melt'] : []),
    }));
  });
  const tierHead = computed(() => {
    if (comparison.value === 'same') {
      return [
        {
          kind: 'both' as const,
          text: i18n.t('consultant.ways.tierHead', [
            percent(props.plan.tier.percent),
            props.plan.tier.paints,
          ]),
        },
      ];
    }
    const buy = ways.value.buy.plan;
    return [
      {
        kind: 'buy' as const,
        text: `1 · ${buy ? percent(buy.tier.percent) : i18n.t('consultant.ways.tierNone')}`,
      },
      { kind: 'melt' as const, text: `2 · ${percent(props.plan.tier.percent)}` },
    ];
  });
  const tierAria = computed(() =>
    [
      i18n.t('consultant.ways.tiersAria', [
        PAINT_DISCOUNT_TIERS.tiers
          .map((tier) => i18n.t('consultant.ways.tierAria', [percent(tier.percent), tier.paints]))
          .join(', '),
      ]),
      ...tierHead.value.map((head) => head.text),
    ].join(' '),
  );

  // ---- The cart ----

  const formulas = computed(() => {
    const formula = (plan: PaintRebuyPlan) => {
      const own = plan.own.reduce((sum, paint) => sum + paint.storePaint.price, 0);
      const fillers = plan.fillers.reduce((sum, f) => sum + f.paint.price * f.quantity, 0);
      const prices = fillers ? `(${usd(own)} + ${usd(fillers)})` : usd(own);
      return `${prices} × ${factor(plan.tier.percent)} = `;
    };
    const buy = ways.value.buy.plan;
    if (dual.value && buy) {
      return [buy, props.plan].map((plan, i) => ({
        kind: (i ? 'melt' : 'buy') as WayKind,
        num: String(i + 1),
        text: ` · ${i18n.t('consultant.ways.paints', [countOf(plan)])} · ${formula(plan)}`,
        total: usd(plan.cartCost),
      }));
    }
    return [
      {
        kind: 'melt' as WayKind,
        num: '',
        text: formula(props.plan),
        total: usd(props.plan.cartCost),
      },
    ];
  });

  // ---- Why they differ ----

  const why = computed(() => {
    if (comparison.value === 'same') return undefined;
    // Scaled to the cart of melting first: what buying first would need for the same tier.
    const scale = props.plan.cartCost || 1;
    const share = (value: number) => `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;
    const buy = ways.value.buy;
    const melt = ways.value.melt;
    const buyCost = buy.plan?.cartCost ?? Math.min(props.credit, scale);
    return {
      marker: share(props.credit),
      rows: [
        {
          kind: 'buy' as WayKind,
          aria: buy.plan
            ? i18n.t('consultant.ways.whyBuyLowerAria', [
                usd(props.credit),
                usd(props.plan.cartCost),
                usd(buy.plan.cartCost),
              ])
            : i18n.t('consultant.ways.whyNeedsAria', [usd(buy.upfront), usd(props.credit)]),
          solid: share(buyCost),
          rest: buy.plan ? 'is-tier' : 'is-missing',
          value: usd(buy.upfront),
          missing: !buy.plan,
        },
        {
          kind: 'melt' as WayKind,
          aria: i18n.t('consultant.ways.whyNeedsAria', [usd(melt.upfront), usd(props.credit)]),
          solid: share(melt.upfront),
          rest: '',
          value: usd(melt.upfront),
          missing: false,
        },
      ],
      buy: buy.plan
        ? i18n.t('consultant.ways.whyBuyLower', [
            usd(props.credit),
            percent(props.plan.tier.percent),
            usd(props.plan.cartCost),
            percent(buy.plan.tier.percent),
            countOf(buy.plan),
          ])
        : i18n.t('consultant.ways.whyBuyImpossible', [usd(props.plan.meltValue), usd(buy.missing)]),
      melt: melt.upfront
        ? i18n.t('consultant.ways.whyMelt', [usd(props.plan.meltValue), usd(melt.upfront)])
        : i18n.t('consultant.ways.whyMeltAll', [usd(props.plan.meltValue)]),
    };
  });

  const waysTitle = computed(() =>
    comparison.value === 'same'
      ? i18n.t('consultant.ways.titleSame', [signed(props.plan.storeCreditFreed)])
      : comparison.value === 'lowerTier'
        ? i18n.t('consultant.ways.titleLower', [usd(props.credit)])
        : i18n.t('consultant.ways.titleImpossible', [usd(props.credit)]),
  );

  // ---- The ways ----

  const STEP_ICONS: Record<WayStep['kind'], IconName> = {
    cart: 'basket-shopping',
    pay: 'money-check-dollar',
    melt: 'recycle',
    fillers: 'clock-rotate-left',
  };

  function stepTexts(way: PaintWay, step: WayStep): { title: string; sub: string } {
    const plan = way.plan ?? props.plan;
    const own = plan.own.length;
    switch (step.kind) {
      case 'cart':
        return way.kind === 'buy'
          ? {
              title: i18n.t('consultant.ways.stepCartCheck'),
              sub: i18n.t('consultant.ways.stepCartSub', [
                countOf(plan),
                percent(plan.tier.percent),
              ]),
            }
          : {
              title: i18n.t('consultant.ways.stepCartPlan'),
              sub: i18n.t('consultant.ways.stepCartPlanSub'),
            };
      case 'pay':
        return way.kind === 'buy'
          ? {
              title: i18n.t('consultant.ways.stepPay'),
              sub: step.blocked
                ? i18n.t('consultant.ways.stepPayBlockedSub', [
                    usd(ways.value.credit),
                    usd(plan.cartCost),
                  ])
                : i18n.t('consultant.ways.stepPaySub'),
            }
          : {
              title: i18n.t('consultant.ways.stepBuy', [countOf(plan)]),
              sub: i18n.t('consultant.ways.stepBuySub', [percent(plan.tier.percent)]),
            };
      case 'melt':
        return {
          title:
            own === 1
              ? i18n.t('consultant.ways.stepMeltOne')
              : i18n.t('consultant.ways.stepMelt', [own]),
          sub: i18n.t(
            way.kind === 'melt'
              ? 'consultant.ways.stepMeltFreesSub'
              : step.faded
                ? 'consultant.ways.stepMeltAfterSub'
                : 'consultant.ways.stepMeltTwiceSub',
          ),
        };
      case 'fillers':
        return {
          title:
            way.fillerCount === 1
              ? i18n.t('consultant.ways.stepFillersOne')
              : i18n.t('consultant.ways.stepFillers', [way.fillerCount]),
          sub: i18n.t('consultant.ways.stepFillersSub'),
        };
    }
  }

  const wayCards = computed(() => {
    const { buy, melt } = ways.value;
    const c = comparison.value;
    return [buy, melt].map((way) => {
      const impossible = way.kind === 'buy' && !way.plan;
      const badge =
        way.kind === 'buy'
          ? c === 'same'
            ? { text: i18n.t('consultant.ways.badgeRecommended'), tone: 'way' }
            : c === 'lowerTier'
              ? { text: i18n.t('consultant.ways.badgeSafe'), tone: 'way' }
              : { text: i18n.t('consultant.ways.badgeNotPossible'), tone: 'danger' }
          : c === 'same'
            ? { text: i18n.t('consultant.ways.badgeNoAdvantage'), tone: 'way' }
            : c === 'lowerTier'
              ? { text: i18n.t('consultant.ways.badgeMoreCredit'), tone: 'way' }
              : {
                  text: ways.value.credit
                    ? i18n.t('consultant.ways.badgeWorks', [usd(ways.value.credit)])
                    : i18n.t('consultant.ways.badgeWorksAlone'),
                  tone: 'way',
                };
      const hint =
        way.kind === 'buy'
          ? impossible
            ? i18n.t('consultant.ways.hintImpossible', [
                usd(props.plan.meltValue),
                usd(way.missing),
              ])
            : c === 'lowerTier'
              ? i18n.t('consultant.ways.hintSafeLower', [
                  usd(ways.value.credit),
                  percent(way.plan!.tier.percent),
                ])
              : i18n.t('consultant.ways.hintSafe')
          : c === 'same'
            ? i18n.t('consultant.ways.hintSame')
            : i18n.t('consultant.ways.hintMelt');
      return {
        way,
        impossible,
        num: wayNumber(way.kind),
        title: wayTitle(way.kind),
        badge,
        tier: way.plan ? percent(way.plan.tier.percent) : '–',
        freed: way.plan ? signed(way.plan.storeCreditFreed) : '–',
        upfront: usd(way.upfront),
        hint,
        safe: way.kind === 'buy' && !impossible,
        steps: way.steps.map((step) => ({
          ...step,
          ...stepTexts(way, step),
          icon: step.blocked ? ('circle-xmark' as IconName) : STEP_ICONS[step.kind],
          amountText: signed(step.amount),
          balanceText: step.blocked
            ? i18n.t('consultant.ways.missingBalance', [usd(way.missing)])
            : Number.isNaN(step.balance)
              ? ''
              : usd(step.balance),
        })),
        lines: way.plan ? cartLinesOf(way.plan) : [],
      };
    });
  });

  // ---- Into the cart, then melting (way 2) ----

  /**
   * Keeps the plan of the way whose paints were put into the cart (#103, #105, #139, #168), with
   * the way and the store credit it starts from (#245).
   */
  async function keepPlan(plan: PaintRebuyPlan | undefined, way: PlanWay) {
    if (plan) {
      await planItem().setValue(storedPlanOf(plan, Date.now(), way, accountCredit.value));
    }
  }

  // The demo has a kept plan of its own (#131), never the account's.
  const realPlan = useStored(rebuyPlanItem);
  const demoPlan = useStored(demoRebuyPlanItem);
  const storedPlan = computed(() => currentPlanOf(demo.value ? demoPlan.value : realPlan.value));
  const planItem = () => rebuyPlanItemOf(!!demo.value);
  /** The cart of melting first was filled: only then its own paints may be melted. */
  const cartFilled = computed(() => {
    const stored = storedPlan.value;
    if (!stored || stored.tier.percent !== props.plan.tier.percent) {
      return false;
    }
    const inCart = new Set(stored.own.map((paint) => paint.pledgeId));
    return props.plan.own.every((paint) => inCart.has(paint.pledgeId));
  });
  const ownPledges = computed(() => {
    const byId = new Map(pledges.value.map((pledge) => [pledge.id, pledge]));
    return props.plan.own
      .map((paint) => byId.get(paint.pledgeId))
      .filter((pledge): pledge is PledgeView => !!pledge && pledge.isMeltable);
  });
  const melting = ref(false);
  const openBulkMeltingSetting = () =>
    openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });

  // ---- The store credit along the way ----

  const chart = computed(() => {
    const { buy, melt } = ways.value;
    const series = [buy, melt].map((way) => ({
      kind: way.kind,
      blocked: way.kind === 'buy' && !way.plan,
      // Today, then after each step but filling the cart; a blocked way stops at its payment.
      values: [ways.value.credit, ...way.steps.slice(1).map((step) => step.balance)].filter(
        (value) => !Number.isNaN(value),
      ),
    }));
    const all = series.flatMap((s) => s.values);
    // Scaled to the balances (with $0 once a way would drop below it), with some room around them.
    const low = Math.min(...all);
    const high = Math.max(...all);
    const room = Math.max((high - low) * 0.1, 1);
    const min = low < 0 ? Math.min(low, 0) - room : low - room;
    const max = high + room;
    const count = Math.max(...series.map((s) => s.values.length), 2);
    const x = (i: number) => CHART.left + ((CHART.right - CHART.left) * i) / (count - 1);
    const y = (value: number) =>
      CHART.top + ((max - value) / (max - min)) * (CHART.bottom - CHART.top);
    const lines = series.map((s) => ({
      ...s,
      points: s.values.map((value, i) => ({ x: x(i), y: y(value), value })),
    }));
    // Labels: one for both ways where they meet, otherwise above the higher, below the lower one.
    const labels: { key: string; x: number; y: number; text: string; kind: WayKind | 'both' }[] =
      [];
    for (let i = 1; i < count; i++) {
      const [a, b] = lines.map((line) => line.points[i]);
      if (a && b && Math.abs(a.value - b.value) < 0.005) {
        labels.push({ key: `both-${i}`, x: a.x, y: a.y - 10, text: usd(a.value), kind: 'both' });
        continue;
      }
      for (const line of lines) {
        const point = line.points[i];
        if (!point) continue;
        const other = lines.find((l) => l !== line)?.points[i];
        const above = !other || point.value >= other.value;
        labels.push({
          key: `${line.kind}-${i}`,
          x: point.x,
          y: above ? point.y - 10 : point.y + 18,
          text: usd(point.value),
          kind: line.kind,
        });
      }
    }
    const aria = [
      i18n.t('consultant.ways.chartAria', [usd(ways.value.credit)]),
      ...lines.map(
        (line) =>
          `${wayTitle(line.kind)}: ${line.points
            .slice(1)
            .map((point) => usd(point.value))
            .join(', ')}${line.blocked ? ` – ${i18n.t('consultant.ways.chartNotEnough')}` : ''}.`,
      ),
    ].join(' ');
    return {
      lines,
      labels,
      aria,
      zero: y(0),
      today: y(ways.value.credit),
      negative: min < 0,
      last: x(count - 1),
    };
  });
  return {
    pledges,
    usd,
    factor,
    percent,
    signed,
    ways,
    comparison,
    cards,
    dual,
    images,
    countOf,
    wayTitle,
    wayNumber,
    results,
    tiers,
    tierHead,
    tierAria,
    formulas,
    why,
    waysTitle,
    wayCards,
    keepPlan,
    cartFilled,
    ownPledges,
    melting,
    openBulkMeltingSetting,
    chart,
  };
}
