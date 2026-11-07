import { postRsiJson } from '@/shared/rsi-api';
import type { StoreData, StoreShip, WarbondTarget } from './warbond';

/*
 * Reads the pledge store's offers from RSI's ship upgrade tool – the same GraphQL API its
 * "Ship upgrades" overlay uses (see also ship-prices.ts). Works with the session of the RSI page.
 */

const UPGRADE_GRAPHQL = '/pledge-store/api/upgrade/v2/graphql';

/** All ships to start from ("from"), and the ships offered as upgrade targets with their SKUs. */
const QUERY =
  'query pledgeStore { from(filters: []) { ships { id name msrp medias { productThumbMediumAndSmall } } }' +
  ' to(filters: []) { ships { id name msrp medias { productThumbMediumAndSmall } skus { id title price available } } } }';

interface ApiSku {
  id: number;
  title?: string | null;
  price: number;
  available?: boolean | null;
}

interface ApiShip {
  id: number;
  name: string;
  msrp: number;
  medias?: { productThumbMediumAndSmall?: string | null } | null;
  skus?: ApiSku[] | null;
}

export interface StoreResponse {
  data?: { from?: { ships?: ApiShip[] | null } | null; to?: { ships?: ApiShip[] | null } | null };
  errors?: { message: string }[];
}

export async function fetchStoreData(): Promise<StoreData> {
  // Same order as RSI's upgrade dialog: the session, then the context of the upgrade API (none
  // here). Without them the API can't tell the account and fails for the targets ("to").
  await postRsiJson('/api/account/v2/setAuthToken');
  await postRsiJson('/api/ship-upgrades/setContextToken', {});
  const [result] = await postRsiJson<[StoreResponse | undefined]>(UPGRADE_GRAPHQL, [
    { operationName: 'pledgeStore', variables: {}, query: QUERY },
  ]);
  return parseStoreResponse(result);
}

/** The ships and warbond targets of an answer of the upgrade tool (prices there are in cents). */
export function parseStoreResponse(result: StoreResponse | undefined): StoreData {
  if (result?.errors?.length) {
    throw new Error(`Loading the pledge store failed: ${result.errors[0]!.message}`);
  }
  const ships = (result?.data?.from?.ships ?? []).map(toStoreShip);
  if (!ships.length) throw new Error('Loading the pledge store failed: no ships in the answer');

  const warbonds: WarbondTarget[] = [];
  for (const ship of result?.data?.to?.ships ?? []) {
    const sku = ship.skus?.find(
      (candidate) =>
        /warbond/i.test(candidate.title ?? '') &&
        candidate.available !== false &&
        candidate.price > 0 &&
        candidate.price < ship.msrp,
    );
    if (sku) warbonds.push({ ship: toStoreShip(ship), skuId: sku.id, price: sku.price / 100 });
  }
  return { ships, warbonds };
}

function toStoreShip({ id, name, msrp, medias }: ApiShip): StoreShip {
  // Some names end with a space ("Ares Inferno ").
  const image = medias?.productThumbMediumAndSmall ?? undefined;
  return { id, name: name.trim(), msrp: msrp / 100, image };
}
