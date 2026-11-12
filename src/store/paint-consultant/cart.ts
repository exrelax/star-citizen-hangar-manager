import { postRsiJson } from '@/shared/rsi-api';
import type { FillerPaint, StorePaint } from './calculation';

/*
 * Puts the paints of the Paint Discount Consultant's plan into RSI's cart (#103): the own paints
 * to buy again and the filler paints, with the requests RSI's own store sends – `add` of the
 * Pledge Store's GraphQL cart, as its paint pages' "Add to cart" (a SKU and a quantity, up to 5 of
 * one SKU), with the page's CSRF token as they send it. The cart is read first: other items in it
 * change the volume discount tier. Nothing is ever checked out; the user checks the cart and pays
 * there.
 */

/** A line of the cart the plan needs: a SKU and how many of it. */
export interface PaintCartLine {
  skuId: number;
  name: string;
  qty: number;
}

/** A line of RSI's cart. */
export interface CartLine {
  skuId: number;
  qty: number;
}

/** The plan's paints as cart lines: own paints of the same SKU together, then the fillers. */
export function cartLinesOf(plan: {
  own: readonly { storePaint: StorePaint }[];
  fillers: readonly FillerPaint[];
}): PaintCartLine[] {
  const lines = new Map<number, PaintCartLine>();
  const add = (skuId: number, name: string, qty: number) => {
    const line = lines.get(skuId);
    if (line) line.qty += qty;
    else lines.set(skuId, { skuId, name, qty });
  };
  for (const paint of plan.own) add(paint.storePaint.id, paint.storePaint.name, 1);
  for (const filler of plan.fillers) add(filler.paint.id, filler.paint.name, filler.quantity);
  return [...lines.values()];
}

/** How RSI's cart compares with the lines a plan needs (#245). */
export interface CartCheck {
  /** Each line of the plan with how many of it are in the cart (at most as many as it needs). */
  lines: { line: PaintCartLine; inCart: number }[];
  /** What is missing of the plan's lines, to put into the cart. */
  missing: PaintCartLine[];
  /** Items in the cart beyond the plan – other SKUs or more of one: they change the tier. */
  others: number;
  /** Paints of the plan in the cart, and how many it needs. */
  inCart: number;
  total: number;
  /** Every paint of the plan is in the cart. */
  complete: boolean;
  /** The cart holds exactly the plan. */
  matches: boolean;
}

/** Compares RSI's cart with the plan's lines; RSI's cart can't tell an item's kind. */
export function cartCheckOf(
  planLines: readonly PaintCartLine[],
  cart: readonly CartLine[],
): CartCheck {
  const inCart = new Map<number, number>();
  for (const line of cart) inCart.set(line.skuId, (inCart.get(line.skuId) ?? 0) + line.qty);
  const lines = planLines.map((line) => {
    const count = Math.min(line.qty, inCart.get(line.skuId) ?? 0);
    inCart.set(line.skuId, (inCart.get(line.skuId) ?? 0) - count);
    return { line, inCart: count };
  });
  const missing = lines
    .filter(({ line, inCart: count }) => count < line.qty)
    .map(({ line, inCart: count }) => ({ ...line, qty: line.qty - count }));
  const others = [...inCart.values()].reduce((sum, qty) => sum + Math.max(0, qty), 0);
  const total = planLines.reduce((sum, line) => sum + line.qty, 0);
  const found = lines.reduce((sum, { inCart: count }) => sum + count, 0);
  return {
    lines,
    missing,
    others,
    inCart: found,
    total,
    complete: !missing.length,
    matches: !missing.length && !others,
  };
}

interface GraphqlAnswer<T> {
  data?: T;
  errors?: { message: string; extensions?: { details?: unknown } }[];
}

/** RSI's reason of a failed request: its details (e.g. "You do not have access to this item."). */
function reasonOf(error: NonNullable<GraphqlAnswer<unknown>['errors']>[number]): string {
  const details = error.extensions?.details;
  const texts =
    details && typeof details === 'object'
      ? Object.values(details).filter((text): text is string => typeof text === 'string')
      : [];
  return texts.length ? `${error.message}: ${texts.join(' ')}` : error.message;
}

/** The CSRF token of RSI's page, which the store's cart mutations require. */
const csrfToken = () =>
  document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

type CartAnswer = GraphqlAnswer<{
  store?: { cart?: { lineItems?: { skuId: string | number; qty: number }[] | null } | null };
}>;

const CART_QUERY =
  'query PaintConsultantCart { store(name: "pledge") { cart { lineItems { skuId qty } } } }';

/** The lines of RSI's cart now. */
export async function readCart(
  post: <T>(path: string, body: unknown) => Promise<T> = postRsiJson,
): Promise<CartLine[]> {
  const answer = await post<CartAnswer>('/graphql', { query: CART_QUERY });
  if (answer.errors?.length) throw new Error(reasonOf(answer.errors[0]!));
  return (answer.data?.store?.cart?.lineItems ?? []).map((line) => ({
    skuId: Number(line.skuId),
    qty: line.qty,
  }));
}

/** Adds `qty` of a SKU to RSI's cart, as the "Add to cart" of RSI's paint pages. */
export async function addToCart(
  line: Pick<PaintCartLine, 'skuId' | 'qty'>,
  post: <T>(
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ) => Promise<T> = postRsiJson,
): Promise<void> {
  // Whole numbers only: they go into the query as RSI's own page puts them.
  if (!Number.isInteger(line.skuId) || !Number.isInteger(line.qty) || line.qty < 1) {
    throw new Error(`Invalid cart line ${line.skuId} × ${line.qty}`);
  }
  const answer = await post<GraphqlAnswer<unknown>>(
    '/graphql',
    {
      query:
        'mutation AddCartItemMutation { store(name: "pledge") { cart { mutations {' +
        ` add(skuId: ${line.skuId}, qty: ${line.qty}) } } } }`,
    },
    { 'x-csrf-token': csrfToken() },
  );
  if (answer.errors?.length) throw new Error(reasonOf(answer.errors[0]!));
}

/** What adding the lines did: the lines added, and those RSI refused with its reason. */
export interface CartResult {
  added: PaintCartLine[];
  failed: { line: PaintCartLine; reason: string }[];
}

/** Adds the lines one after the other; a refused line doesn't stop the others. */
export async function addLinesToCart(
  lines: readonly PaintCartLine[],
  add: (line: PaintCartLine) => Promise<void> = addToCart,
): Promise<CartResult> {
  const result: CartResult = { added: [], failed: [] };
  for (const line of lines) {
    try {
      await add(line);
      result.added.push(line);
    } catch (error) {
      result.failed.push({ line, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
