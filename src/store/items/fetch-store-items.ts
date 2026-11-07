import { ORDERS, STORE_ITEMS } from '@/config';
import { mapWithConcurrency } from '@/shared/lib/pool';
import { isThrottled, withRetry } from '@/shared/lib/retry';
import { postRsiJson } from '@/shared/rsi-api';
import { toStoreItem, type ApiStoreSku, type StoreItem } from './store-items';

/*
 * Reads the items of the Pledge Store with the store's own GraphQL search (the query its browse
 * pages use, with fewer fields): all SKUs of each product of `STORE_ITEMS.products`, page by page.
 * Works with the session of the RSI page, also without being signed in.
 */

const QUERY =
  'query StoreItems($query: SearchQuery) { store(browse: true, name: "pledge") {' +
  ' listing: search(query: $query) { totalCount resources { id name title url' +
  ' media { thumbnail { storeSmall } } nativePrice { amount discounted }' +
  ' stock { available } ... on TySku { isWarbond } } } } }';

interface SearchAnswer {
  data?: { store?: { listing?: { totalCount?: number; resources?: ApiStoreSku[] } | null } | null };
  errors?: { message: string }[];
}

/** One page of the SKUs of a product. */
async function fetchPage(product: number, page: number) {
  const [answer] = await withRetry(
    () =>
      postRsiJson<[SearchAnswer | undefined]>('/graphql', [
        {
          operationName: 'StoreItems',
          query: QUERY,
          variables: {
            query: {
              page,
              limit: STORE_ITEMS.pageSize,
              skus: {
                filtersFromTags: { tagIdentifiers: [], facetIdentifiers: [] },
                products: [String(product)],
              },
              sort: { field: 'weight', direction: 'desc' },
            },
          },
        },
      ]),
    ORDERS.retryDelaysMs,
    isThrottled,
  );
  return parseSearchAnswer(answer);
}

/** The SKUs and their total of an answer of the search. */
export function parseSearchAnswer(answer: SearchAnswer | undefined) {
  if (answer?.errors?.length) {
    throw new Error(`Loading the Pledge Store failed: ${answer.errors[0]!.message}`);
  }
  const listing = answer?.data?.store?.listing;
  if (!listing) throw new Error('Loading the Pledge Store failed: no items in the answer');
  return { total: listing.totalCount ?? 0, skus: listing.resources ?? [] };
}

export interface StoreItemsRead {
  items: StoreItem[];
  /** Requests made, for the status of the read. */
  requests: number;
}

/** All items of the configured products, each SKU once (some are listed in two products). */
export async function fetchStoreItems(
  fetch: (product: number, page: number) => ReturnType<typeof fetchPage> = fetchPage,
): Promise<StoreItemsRead> {
  let requests = 0;
  const read = (product: number, page: number) => {
    requests++;
    return fetch(product, page);
  };
  const firstPages = await mapWithConcurrency(STORE_ITEMS.products, STORE_ITEMS.concurrency, (p) =>
    read(p.id, 1),
  );
  const morePages = STORE_ITEMS.products.flatMap((product, index) => {
    const pages = Math.ceil(firstPages[index]!.total / STORE_ITEMS.pageSize);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, page) => ({
      product,
      page: page + 2,
    }));
  });
  const rest = await mapWithConcurrency(morePages, STORE_ITEMS.concurrency, ({ product, page }) =>
    read(product.id, page),
  );

  const items = new Map<number, StoreItem>();
  const add = (skus: ApiStoreSku[], category: string) => {
    for (const sku of skus) {
      const item = toStoreItem(sku, category);
      if (item && !items.has(item.id)) items.set(item.id, item);
    }
  };
  STORE_ITEMS.products.forEach((product, index) => add(firstPages[index]!.skus, product.name));
  morePages.forEach(({ product }, index) => add(rest[index]!.skus, product.name));
  if (!items.size) throw new Error('Loading the Pledge Store failed: no items in the answer');
  return { items: [...items.values()], requests };
}
