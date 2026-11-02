import type { BuybackUpgrade } from './buyback';
import { fetchBuybackPage, type FetchBuybackPage } from './sync-buyback';

/*
 * Puts buy back pledges into the RSI cart with the requests RSI's own buttons send – no RSI page
 * needs to be opened for it. Regular pledges use the "Add to cart" of their buy back page, CCUs
 * the "Ship Upgrade" dialog of the buy back list. For buy back pledges RSI empties the cart first.
 */

/** RSI's cart, opened after a pledge was added. */
export const RSI_CART_PATH = '/store/pledge/cart';

/** Cookie with the session token RSI expects in the `X-Rsi-Token` header. */
const TOKEN_COOKIE = 'Rsi-Token';

/** RSI refused a request, with RSI's reason (or the pledge was not found). */
export class CartError extends Error {
  constructor(
    message: string,
    readonly reason: 'rsi' | 'notFound' = 'rsi',
  ) {
    super(message);
  }
}

/** What the cart needs of a buy back pledge. */
export interface CartPledge {
  id: number;
  /** Index in RSI's buy back list, to look up the CCU ids if they weren't stored yet. */
  position: number;
  isCcu: boolean;
  upgrade?: BuybackUpgrade;
}

/** Puts a buy back pledge into the RSI cart. Throws a `CartError` if that fails. */
export async function addBuybackToCart(
  pledge: CartPledge,
  fetchPage: FetchBuybackPage = fetchBuybackPage,
): Promise<void> {
  if (!pledge.isCcu) {
    await postRsi('/api/store/buyBackPledge', { id: pledge.id });
    return;
  }

  const upgrade = pledge.upgrade ?? (await loadUpgrade(pledge, fetchPage));
  // Same order as RSI's upgrade dialog: session, then the CCU as context of the upgrade API.
  await postRsi('/api/account/v2/setAuthToken');
  await postRsi('/api/ship-upgrades/setContextToken', { ...upgrade, pledgeId: pledge.id });
  const [result] = await postJson<UpgradeCartResponse>('/pledge-store/api/upgrade/graphql', [
    {
      operationName: 'addToCart',
      variables: { from: upgrade.fromShipId, to: upgrade.toSkuId },
      query: 'mutation addToCart($from: Int, $to: Int) { addToCart(from: $from, to: $to) { jwt } }',
    },
  ]);
  const jwt = result?.data?.addToCart?.jwt;
  if (!jwt) throw new CartError(result?.errors?.[0]?.message ?? 'No cart token received');
  await postRsi('/api/store/v2/cart/token', { jwt });
}

/** Answer of the upgrade API's `addToCart`: a token for the cart API. */
type UpgradeCartResponse = [
  { data?: { addToCart?: { jwt?: string } }; errors?: { message: string }[] } | undefined,
];

/** CCU ids of pledges stored before they were parsed: from RSI's list with only this pledge. */
async function loadUpgrade(pledge: CartPledge, fetchPage: FetchBuybackPage) {
  const { pledges } = await fetchPage(pledge.position + 1, undefined, 1);
  const upgrade = pledges.find(({ id }) => id === pledge.id)?.upgrade;
  if (!upgrade) throw new CartError(`Pledge #${pledge.id} not found`, 'notFound');
  return upgrade;
}

interface RsiResponse {
  success: number;
  msg?: string;
  /** On errors, the reasons by field. */
  data?: unknown;
}

/** A request to RSI's platform API, which answers with `success: 1` or a reason. */
async function postRsi(path: string, body?: unknown): Promise<void> {
  const response = await postJson<RsiResponse>(path, body);
  if (response.success === 1) return;
  const details =
    response.data && typeof response.data === 'object' ? Object.values(response.data) : [];
  throw new CartError(details.length ? details.join('\n') : (response.msg ?? 'Request failed'));
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const token = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${TOKEN_COOKIE}=`))
    ?.slice(TOKEN_COOKIE.length + 1);
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // RSI's messages are shown as they are; the extension asks for English like for the pages.
      'Accept-Language': 'en',
      ...(token && { 'X-Rsi-Token': token }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new CartError(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}
