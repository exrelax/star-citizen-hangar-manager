import { REFUND_DAYS, REFUND_REQUEST_FORM } from '@/config';
import { ref } from 'vue';

/** How long a purchase can still be refunded. */
export interface RefundWindow {
  /** Whole days left after today: 0 on the last day. */
  daysLeft: number;
  /** Last day of the refund window (ISO date). */
  until: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const utcDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * The refund window of a purchase from `placedAt` (ISO date), as of `today` (ISO date) – or
 * undefined once it is over. RSI only lists the day of the purchase, so days are counted from it.
 */
export function refundWindow(
  placedAt: string,
  today: string,
  days = REFUND_DAYS,
): RefundWindow | undefined {
  const start = utcDay(placedAt);
  if (Number.isNaN(start)) return undefined;
  const until = start + days * DAY_MS;
  const daysLeft = Math.round((until - utcDay(today)) / DAY_MS);
  return daysLeft >= 0 ? { daysLeft, until: isoDate(new Date(until)) } : undefined;
}

/** The local date as ISO date (YYYY-MM-DD). */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today's date, updated hourly so open lists count the days down. Shared by all rows. */
export const today = ref(localToday());
setInterval(() => (today.value = localToday()), 60 * 60 * 1000);

/**
 * RSI's support form, prefilled for a refund request of the order – always in English, as
 * support works in English. Zendesk fills form fields from `tf_<field>` parameters; the
 * description takes HTML (lines separated by `<br>`, as paragraphs would add blank lines).
 */
export function refundRequestUrl(orderId: string): string {
  const { url, ticketFormId, problemFieldId, problemValue } = REFUND_REQUEST_FORM;
  const description = [
    'Hello Support Team,',
    `I am submitting a refund request for order ${orderId}.`,
    'Please let me know when I can expect to receive the refund.',
    'Thank you very much and best regards',
  ];
  const params = new URLSearchParams({
    ticket_form_id: ticketFormId,
    [`tf_${problemFieldId}`]: problemValue,
    tf_subject: `Refund Request for Order ${orderId}`,
    tf_description: `<p>${description.join('<br>')}</p>`,
  });
  return `${url}?${params}`;
}
