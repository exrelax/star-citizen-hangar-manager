import { postRsiJson } from '@/shared/rsi-api';
import type { Ship, ShipSku, UpgradeToolData, WarbondSku } from './ships';

/*
 * Reads RSI's ship upgrade tool – the same GraphQL API its "Ship upgrades" overlay uses. Works
 * with the session of the RSI page, also without being signed in.
 */

const UPGRADE_GRAPHQL = '/pledge-store/api/upgrade/v2/graphql';

const SHIP_FIELDS = 'id name msrp link medias { productThumbMediumAndSmall }';

/** All ships to start from ("from"), and the ships offered as upgrade targets with their SKUs. */
const QUERY =
  `query upgradeTool { from(filters: []) { ships { ${SHIP_FIELDS} } }` +
  ` to(filters: []) { ships { ${SHIP_FIELDS} skus { id title price available } } } }`;

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
  link?: string | null;
  medias?: { productThumbMediumAndSmall?: string | null } | null;
  skus?: ApiSku[] | null;
}

export interface UpgradeToolResponse {
  data?: { from?: { ships?: ApiShip[] | null } | null; to?: { ships?: ApiShip[] | null } | null };
  errors?: { message: string }[];
}

export async function fetchUpgradeTool(): Promise<UpgradeToolData> {
  // Same order as RSI's upgrade dialog: the session, then the context of the upgrade API (none
  // here). Without them the API can't tell the account and fails for the targets ("to").
  await postRsiJson('/api/account/v2/setAuthToken');
  await postRsiJson('/api/ship-upgrades/setContextToken', {});
  const [result] = await postRsiJson<[UpgradeToolResponse | undefined]>(UPGRADE_GRAPHQL, [
    { operationName: 'upgradeTool', variables: {}, query: QUERY },
  ]);
  return parseUpgradeTool(result);
}

/** Ships, SKUs on sale and warbond editions of an answer (prices there are in cents). */
export function parseUpgradeTool(result: UpgradeToolResponse | undefined): UpgradeToolData {
  if (result?.errors?.length) {
    throw new Error(`Loading the ship upgrade tool failed: ${result.errors[0]!.message}`);
  }
  const from = result?.data?.from?.ships ?? [];
  const to = result?.data?.to?.ships ?? [];
  if (!from.length) throw new Error('Loading the ship upgrade tool failed: no ships in the answer');

  // Every ship once; the targets fill in what the list to start from may lack.
  const ships = new Map<number, Ship>();
  for (const ship of [...from, ...to])
    ships.set(ship.id, { ...toShip(ship), ...ships.get(ship.id) });

  const buyable: ShipSku[] = [];
  const warbonds: WarbondSku[] = [];
  for (const ship of to) {
    for (const sku of ship.skus ?? []) {
      if (sku.available === false || sku.price <= 0) continue;
      const price = sku.price / 100;
      buyable.push({ shipId: ship.id, skuId: sku.id, title: sku.title?.trim() ?? '', price });
      if (/warbond/i.test(sku.title ?? '') && sku.price < ship.msrp) {
        warbonds.push({ shipId: ship.id, skuId: sku.id, price });
      }
    }
  }
  return { ships: [...ships.values()], buyable, warbonds };
}

function toShip({ id, name, msrp, link, medias }: ApiShip): Ship {
  // Some names end with a space ("Ares Inferno ").
  const ship: Ship = { id, name: name.trim(), msrp: msrp / 100 };
  const image = medias?.productThumbMediumAndSmall;
  if (image) ship.image = image;
  if (link) ship.link = link;
  return ship;
}
