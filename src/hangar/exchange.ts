import { refundWindow, type RefundWindow } from '@/orders/refund';
import { postRsiJson } from '@/shared/rsi-api';
import { hangarSnapshot } from './hangar-storage';
import type { PledgeView } from './pledge-view';
import type { PledgeDiscount } from './ship-prices';

/*
 * Exchanging ("melting") a pledge for store credit, as RSI's "Exchange" button in "My Gear" does
 * it: RSI's account script posts the pledge id and the account password to
 * `/api/account/reclaimPledge`, after two acknowledgements. The manager's dialog adds what the
 * exchange costs beyond the pledge itself (see `exchangeWarnings`).
 */

/** What kind of pledge is exchanged, shown prominently in the dialog. */
export type ExchangeKind =
  'upgradedShip' | 'ship' | 'ships' | 'gamePackage' | 'ccu' | 'paint' | 'reward' | 'other';

export function exchangeKind(pledge: PledgeView): ExchangeKind {
  if (pledge.isCcu) return 'ccu';
  if (pledge.isUpgraded) return 'upgradedShip';
  if (pledge.hasGameAccess) return 'gamePackage';
  if (pledge.isPaint) return 'paint';
  const ships = pledge.ships.length + (pledge.titleShip ? 1 : 0);
  if (ships > 1) return 'ships';
  if (ships === 1) return 'ship';
  return pledge.reward ? 'reward' : 'other';
}

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
 * Removes an exchanged pledge from the stored hangar right away, so the list doesn't show it
 * until the next update. The next smart update or refresh confirms it (and finds it in the buy
 * back).
 */
export async function removeFromStoredHangar(pledgeId: number): Promise<void> {
  const snapshot = await hangarSnapshot.getValue();
  if (!snapshot) return;
  await hangarSnapshot.setValue({
    ...snapshot,
    pledges: snapshot.pledges.filter((pledge) => pledge.id !== pledgeId),
    updatedAt: new Date().toISOString(),
  });
}
