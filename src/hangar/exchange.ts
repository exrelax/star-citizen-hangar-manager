import { logError, reasonOf } from '@/errors/error-log';
import { refundWindow, type RefundWindow } from '@/orders/refund';
import { postRsiJson } from '@/shared/rsi-api';
import { recordUpdate } from '@/storage/meta';
import { hangarMeta, hangarSnapshot } from './hangar-storage';
import type { PledgeView } from './pledge-view';
import type { PledgeDiscount } from './ship-prices';
import type { PledgeMismatch, VerifyResult } from './verify-pledges';

/*
 * Exchanging ("melting") a pledge for store credit, as RSI's "Exchange" button in "My Gear" does
 * it: RSI's account script posts the pledge id and the account password to
 * `/api/account/reclaimPledge`, after two acknowledgements. The manager's dialog adds what the
 * exchange costs beyond the pledge itself (see `exchangeWarnings`).
 */

/** Something the exchange loses beyond the pledge itself. `danger`: lost for good. */
export type ExchangeWarning =
  | { kind: 'lastGameAccess'; danger: true }
  | { kind: 'notBuybackable'; danger: true }
  | { kind: 'upgraded'; danger: true }
  | { kind: 'discount'; danger: true; discount: PledgeDiscount }
  | { kind: 'giftable'; danger: false }
  | { kind: 'refundable'; danger: false; refund: RefundWindow };

/** The warnings for exchanging the pledge as of `today` (ISO date), most severe first. */
export function exchangeWarnings(pledge: PledgeView, today: string): ExchangeWarning[] {
  const warnings: ExchangeWarning[] = [];
  if (pledge.isLastAlpha) warnings.push({ kind: 'lastGameAccess', danger: true });
  if (!pledge.isBuybackable) warnings.push({ kind: 'notBuybackable', danger: true });
  if (pledge.isUpgraded) warnings.push({ kind: 'upgraded', danger: true });
  if (pledge.discount && pledge.discount.amount > 0) {
    warnings.push({ kind: 'discount', danger: true, discount: pledge.discount });
  }
  if (pledge.isGiftable) warnings.push({ kind: 'giftable', danger: false });
  const refund = pledge.order?.placedAt && refundWindow(pledge.order.placedAt, today);
  if (refund) warnings.push({ kind: 'refundable', danger: false, refund });
  return warnings;
}

interface ReclaimResponse {
  success: number | boolean;
  msg?: string;
}

/**
 * Exchanges the pledge for store credit – for good, unless it can be bought back. Resolves once
 * RSI confirmed it; throws with RSI's message (e.g. a wrong password) otherwise.
 */
export async function reclaimPledge(pledgeId: number, password: string): Promise<void> {
  const response = await postRsiJson<ReclaimResponse>('/api/account/reclaimPledge', {
    pledge_id: String(pledgeId),
    current_password: password,
  });
  if (!response.success) throw new Error(response.msg || 'Exchange failed');
}

/**
 * Removes exchanged pledges from the stored hangar right away, so the list doesn't show them
 * until the next update. The next smart update or refresh confirms it (and finds them in the buy
 * back).
 */
export async function removeFromStoredHangar(pledgeIds: number | readonly number[]): Promise<void> {
  const removed = new Set(typeof pledgeIds === 'number' ? [pledgeIds] : pledgeIds);
  if (!removed.size) return;
  const snapshot = await hangarSnapshot.getValue();
  if (!snapshot) return;
  await hangarSnapshot.setValue({
    ...snapshot,
    pledges: snapshot.pledges.filter((pledge) => !removed.has(pledge.id)),
    updatedAt: new Date().toISOString(),
  });
  await recordUpdate(hangarMeta);
}

// ---- Bulk melting (an experimental setting) ----

/**
 * What exchanging several pledges at once costs beyond the warnings of each one: all pledges with
 * game access together. `isLastAlpha` marks only the account's last one, so a selection of every
 * game package would otherwise pass without the warning.
 */
export function losesAllGameAccess(
  selected: readonly PledgeView[],
  hangar: readonly PledgeView[],
): boolean {
  if (selected.some((pledge) => pledge.isLastAlpha)) return true;
  const withAccess = hangar.filter((pledge) => pledge.hasGameAccess);
  if (!withAccess.length) return false;
  const ids = new Set(selected.map((pledge) => pledge.id));
  return withAccess.every((pledge) => ids.has(pledge.id));
}

export interface BulkExchangeResult {
  /** The pledges RSI exchanged, in the order they were sent. */
  exchanged: number[];
  /** The pledge RSI refused, and why; the ones after it were not sent. */
  failed?: { id: number; message: string };
  /** Pledges RSI lists differently than the dialog showed them (#415): nothing was sent. */
  mismatches?: PledgeMismatch[];
  /** The pledges couldn't be read again (#415), and why: nothing was sent. */
  unchecked?: string;
}

/**
 * Exchanges the pledges one after the other with the same password, `delayMs` apart. First reads
 * them from RSI again (`verify`, #415): if one changed, is gone or can't be read, nothing is sent.
 * Stops at the first one RSI refuses (e.g. a wrong password refuses the first one, before anything
 * is exchanged): the rest stay in the hangar. `onChecked` reports the end of the check,
 * `onExchanged` every confirmed exchange right away.
 */
export async function reclaimPledges(
  pledgeIds: readonly number[],
  password: string,
  {
    delayMs = 0,
    onChecked,
    onExchanged,
    verify,
    reclaim = reclaimPledge,
  }: {
    delayMs?: number;
    onChecked?: () => void;
    onExchanged?: (pledgeId: number) => void;
    /** Reads the pledges of these ids from RSI again; required, so no run skips it. */
    verify: (pledgeIds: readonly number[]) => Promise<VerifyResult>;
    reclaim?: (pledgeId: number, password: string) => Promise<void>;
  },
): Promise<BulkExchangeResult> {
  const ids = [...pledgeIds];
  const exchanged: number[] = [];
  let checked: VerifyResult;
  try {
    checked = await verify(ids);
  } catch (failure) {
    void logError(
      'HANGAR-EXCHANGE-CHECK-FAIL',
      `Bulk melting of ${ids.length}: ${reasonOf(failure)}`,
      {
        error: failure,
      },
    );
    return { exchanged, unchecked: failure instanceof Error ? failure.message : String(failure) };
  }
  if (checked.status !== 'match') return { exchanged, mismatches: checked.mismatches };
  onChecked?.();
  for (const [index, id] of ids.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await reclaim(id, password);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      void logError('HANGAR-EXCHANGE-FAIL', `Pledge #${id} (bulk melting): ${reasonOf(failure)}`, {
        error: failure,
      });
      return { exchanged, failed: { id, message } };
    }
    exchanged.push(id);
    onExchanged?.(id);
  }
  return { exchanged };
}
