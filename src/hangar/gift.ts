import { postRsiJson } from '@/shared/rsi-api';
import type { PledgeView } from './pledge-view';

/*
 * Gifting a pledge by email, as RSI's "Gift" button in "My Gear" does it: RSI's account script
 * posts the pledge id, the account password and the recipient's name and email to
 * `/api/account/giftPledgeV2` (the variant RSI's buttons use). The pledge moves to the recipient
 * once they accept; until then the gift can be cancelled in "My Gear".
 */

export interface GiftRecipient {
  name: string;
  email: string;
}

/** Something to know before gifting the pledge, beyond RSI's own texts. */
export type GiftWarning =
  { kind: 'lastGameAccess'; danger: true } | { kind: 'upgraded'; danger: false };

export function giftWarnings(pledge: PledgeView): GiftWarning[] {
  const warnings: GiftWarning[] = [];
  if (pledge.isLastAlpha) warnings.push({ kind: 'lastGameAccess', danger: true });
  if (pledge.isUpgraded) warnings.push({ kind: 'upgraded', danger: false });
  return warnings;
}

/** A plausible email address: something@domain.tld, without spaces. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

interface GiftResponse {
  success: number | boolean;
  msg?: string;
}

/** Sends the gift. Resolves once RSI confirmed it; throws with RSI's message otherwise. */
export async function giftPledge(
  pledgeId: number,
  recipient: GiftRecipient,
  password: string,
): Promise<void> {
  const response = await postRsiJson<GiftResponse>('/api/account/giftPledgeV2', {
    pledge_id: String(pledgeId),
    current_password: password,
    name: recipient.name.trim(),
    email: recipient.email.trim(),
  });
  if (!response.success) throw new Error(response.msg || 'Gift failed');
}
