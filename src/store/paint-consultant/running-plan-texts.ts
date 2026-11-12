import { formatTimeLeft } from '@/hangar/melt-marks';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import { i18n, type Locale } from '@/i18n';
import type {
  RunAction,
  RunCheck,
  RunNote,
  RunPaintRow,
  RunStatus,
  RunStep,
  RunningPlanView,
} from './running-plan';

/*
 * The texts of the running plan's card (#245): every kind of the step model (`running-plan.ts`)
 * turned into words, in the language shown. Each switch covers its whole union, so a new kind
 * fails to compile until it has a text.
 */

export interface RunFormat {
  locale: Locale;
  now: number;
}

const usdOf = (value: number, f: RunFormat) => formatUsd(value, f.locale);
/** "+$8", "−$20.80" (a real minus); "$0" without a sign. */
export const signedUsd = (value: number, f: RunFormat) =>
  value > 0 ? `+${usdOf(value, f)}` : value < 0 ? `−${usdOf(-value, f)}` : usdOf(0, f);
const percentOf = (value: number, f: RunFormat) => formatPercent(value, f.locale);
const num = (value: number | string | undefined) => Number(value ?? 0);
const str = (value: number | string | undefined) => String(value ?? '');

/** "Nov 12, 10:30 AM". */
export const dateTimeOf = (at: number, f: RunFormat) =>
  new Intl.DateTimeFormat(f.locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
/** "Nov 12". */
export const shortDateOf = (at: number, f: RunFormat) =>
  new Intl.DateTimeFormat(f.locale, { month: 'short', day: 'numeric' }).format(at);
/** A day as RSI gives it ("2026-11-12"), as "Nov 12". */
export const dayOf = (day: string, f: RunFormat) => {
  const at = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(at)
    ? day
    : new Intl.DateTimeFormat(f.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        at,
      );
};

export const wayTitleOf = (way: RunningPlanView['way']) =>
  way === 'buy' ? i18n.t('consultant.ways.buyTitle') : i18n.t('consultant.ways.meltTitle');

/** "10 paints at 35%". */
export const paintsAtOf = (count: number, percent: number, f: RunFormat) =>
  i18n.t('consultant.ways.stepCartSub', [count, percentOf(percent, f)]);

export function stepTitleOf(step: RunStep): string {
  switch (step.kind) {
    case 'buy':
      return i18n.n('consultant.ways.stepBuy', step.count);
    case 'meltOld':
      return i18n.n('consultant.ways.stepMelt', step.count);
    case 'meltOwn':
      return i18n.n('consultant.run.stepMeltOwn', step.count);
    case 'cart':
      return i18n.t('consultant.ways.stepCartCheck');
    case 'pay':
      return i18n.t('consultant.ways.stepPay');
    case 'fillers':
      return i18n.n('consultant.fillers.melt', step.count);
  }
}

export function stepSubOf(step: RunStep, view: RunningPlanView, f: RunFormat): string {
  const paints = paintsAtOf(step.count, view.tier.percent, f);
  const names = step.names.join(', ');
  switch (step.kind) {
    case 'buy':
      return step.state === 'done'
        ? i18n.t('consultant.run.buyDoneSub', [percentOf(view.tier.percent, f)])
        : paints;
    case 'meltOld':
      return step.state === 'current' ? i18n.t('consultant.run.meltOldSub') : names;
    case 'meltOwn':
      return names;
    case 'cart':
      return step.state === 'done' ? i18n.t('consultant.run.cartMatchesSub', [paints]) : paints;
    case 'pay':
      if (step.state === 'done') {
        const when = paidWhen(step.status, f);
        return when ? i18n.t('consultant.run.boughtOn', [when]) : i18n.t('consultant.run.paySub');
      }
      return step.state === 'current'
        ? i18n.t('consultant.run.payNowSub', [percentOf(view.tier.percent, f)])
        : i18n.t('consultant.run.paySub');
    case 'fillers':
      return step.state === 'wait' && step.status.at !== undefined
        ? i18n.t('consultant.run.fillersWaitSub', [
            names,
            formatTimeLeft(step.status.at - f.now, f.locale),
          ])
        : i18n.t('consultant.run.fillersSub');
  }
}

/** When it was paid: the time, or the day of the new copies. */
function paidWhen(status: RunStatus, f: RunFormat): string | undefined {
  if (status.at !== undefined) return dateTimeOf(status.at, f);
  return status.day ? dayOf(status.day, f) : undefined;
}

export function statusOf(status: RunStatus, f: RunFormat): string {
  switch (status.kind) {
    case 'now':
      return i18n.t('consultant.run.statusNow');
    case 'next':
      return i18n.t('consultant.run.statusNext');
    case 'checked':
      return i18n.t('consultant.run.statusChecked');
    case 'checking':
      return i18n.t('consultant.run.statusChecking');
    case 'paid':
      return paidWhen(status, f) ?? i18n.t('consultant.run.statusPaid');
    case 'melted':
      return status.at !== undefined
        ? dateTimeOf(status.at, f)
        : i18n.t('consultant.run.statusMelted');
    case 'readyAt':
      return status.at !== undefined
        ? dateTimeOf(status.at, f)
        : i18n.t('consultant.run.statusNext');
    case 'afterPurchase':
      return i18n.t('consultant.run.statusAfterPurchase');
    case 'after24h':
      return i18n.t('consultant.run.statusAfter24h');
  }
}

/** The step's amount: signed store credit, or the cart's total; with what is done of it. */
export function amountOf(step: RunStep, f: RunFormat): string {
  const amount = step.signed ? signedUsd(step.amount, f) : usdOf(step.amount, f);
  return step.amountDone !== undefined
    ? i18n.t('consultant.run.amountDone', [signedUsd(step.amountDone, f), amount])
    : amount;
}

export function checkOf(
  check: RunCheck,
  step: RunStep,
  f: RunFormat,
): { title: string; sub: string } {
  const v = check.values;
  const paying = step.kind === 'pay' || step.kind === 'buy';
  switch (check.kind) {
    case 'cart':
      if (check.ok) {
        return {
          title: i18n.t('consultant.run.checkCartOk', [num(v.total)]),
          sub: paying
            ? i18n.t('consultant.run.checkCartTotalSub', [
                usdOf(num(v.cost), f),
                percentOf(num(v.percent), f),
              ])
            : i18n.t('consultant.run.checkCartOkSub'),
        };
      }
      return {
        title: i18n.n('consultant.run.checkCartMissing', num(v.missing)),
        sub: i18n.t('consultant.run.checkCartMissingSub', [num(v.inCart), num(v.total)]),
      };
    case 'cartUnknown':
      return {
        title: i18n.t('consultant.run.checkCartUnknown'),
        sub: i18n.t('consultant.run.checkCartUnknownSub'),
      };
    case 'cartUnread':
      return { title: i18n.t('consultant.run.checkCartUnread'), sub: str(v.reason) };
    case 'otherItems':
      return {
        title: i18n.n('consultant.run.checkOtherItems', num(v.count)),
        sub: i18n.t('consultant.run.checkOtherItemsSub'),
      };
    case 'credit':
      if (check.ok) {
        return {
          title: i18n.t('consultant.run.checkCreditOk'),
          sub:
            paying && v.left !== undefined
              ? i18n.t('consultant.run.checkCreditLeftSub', [
                  usdOf(num(v.credit), f),
                  usdOf(num(v.left), f),
                ])
              : i18n.t('consultant.run.checkCreditOkSub', [
                  usdOf(num(v.credit), f),
                  usdOf(num(v.cost), f),
                ]),
        };
      }
      return {
        title: i18n.t('consultant.run.checkCreditShort'),
        sub: i18n.t('consultant.run.checkCreditShortSub', [
          usdOf(num(v.credit), f),
          usdOf(num(v.cost), f),
          usdOf(num(v.missing), f),
        ]),
      };
    case 'creditUnknown':
      return {
        title: i18n.t('consultant.run.checkCreditUnknown'),
        sub: i18n.t('consultant.run.checkCreditUnknownSub', [usdOf(num(v.cost), f)]),
      };
    case 'price':
      return {
        title: i18n.t('consultant.run.checkPrice'),
        sub: i18n.t('consultant.run.checkPriceSub', [
          usdOf(num(v.cost), f),
          usdOf(num(v.planned), f),
        ]),
      };
    case 'unavailable':
      return {
        title: i18n.n('consultant.run.checkUnavailable', num(v.count)),
        sub: str(v.names),
      };
    case 'cooldownOver':
      return {
        title: i18n.t('consultant.run.checkCooldownOver'),
        sub: i18n.t('consultant.run.checkCooldownOverSub', [dateTimeOf(num(v.since), f)]),
      };
    case 'notMeltable':
      return {
        title: i18n.n('consultant.run.checkNotMeltable', num(v.count)),
        sub: str(v.names),
      };
  }
}

export function noteOf(
  note: RunNote,
  f: RunFormat,
): { text: string; icon: 'circle-info' | 'shield-halved' | 'triangle-exclamation' } {
  const v = note.values;
  switch (note.kind) {
    case 'afterPay':
      return { text: i18n.t('consultant.run.noteAfterPay'), icon: 'circle-info' };
    case 'purchaseNextRefresh':
      return { text: i18n.t('consultant.run.notePurchaseNextRefresh'), icon: 'circle-info' };
    case 'creditSpent':
      return { text: i18n.t('consultant.run.noteCreditSpent'), icon: 'circle-info' };
    case 'onlyOldCopies':
      return {
        text: i18n.t('consultant.run.noteOnlyOld', [dayOf(str(v.day), f)]),
        icon: 'shield-halved',
      };
    case 'notFound':
      return {
        text: i18n.t('consultant.run.noteNotFound', [num(v.days)]),
        icon: 'triangle-exclamation',
      };
    case 'priceChanged':
      return {
        text: i18n.t('consultant.run.notePriceChanged', [
          usdOf(num(v.cost), f),
          usdOf(num(v.planned), f),
        ]),
        icon: 'circle-info',
      };
    case 'unavailable':
      return {
        text: i18n.t('consultant.run.noteUnavailable', [str(v.names)]),
        icon: 'triangle-exclamation',
      };
    case 'cartUnread':
      return {
        text: i18n.t('consultant.run.noteCartUnread', [str(v.reason)]),
        icon: 'triangle-exclamation',
      };
  }
}

/** Why a paint row is shown as it is, for its tooltip and screen readers. */
export function reasonOf(reason: NonNullable<RunPaintRow['reason']>): string {
  switch (reason) {
    case 'notInCart':
      return i18n.t('consultant.run.reasonNotInCart');
    case 'unavailable':
      return i18n.t('consultant.run.reasonUnavailable');
    case 'notMeltable':
      return i18n.t('consultant.run.reasonNotMeltable');
    case 'cartUnknown':
      return i18n.t('consultant.run.reasonCartUnknown');
  }
}

/** The button text of an action. `total` is all paints of the plan, for a whole cart. */
export function actionLabelOf(action: RunAction, total: number, f: RunFormat): string {
  switch (action.kind) {
    case 'fillCart':
      if (action.count === total) return i18n.t('consultant.toCart', [action.count]);
      return i18n.n('consultant.run.putMissing', action.count);
    case 'pay':
      return action.enabled
        ? i18n.t('consultant.run.goPay', [usdOf(action.amount, f)])
        : i18n.t('consultant.run.pay', [usdOf(action.amount, f)]);
    case 'openCart':
      return i18n.t('consultant.openCart');
    case 'melt': {
      const count = action.pledgeIds.length;
      const label = i18n.n(
        action.target === 'fillers'
          ? 'consultant.fillers.melt'
          : action.target === 'old'
            ? 'consultant.meltOld'
            : 'consultant.meltOwn',
        count,
      );
      return action.amount > 0
        ? i18n.t('consultant.run.withAmount', [label, signedUsd(action.amount, f)])
        : label;
    }
    case 'readCart':
      return i18n.t('consultant.run.readCart');
    case 'readCredit':
      return i18n.t('consultant.run.readCredit');
    case 'recalculate':
      return i18n.t('consultant.run.recalculate');
    case 'discard':
      return i18n.t('consultant.run.discard');
  }
}
