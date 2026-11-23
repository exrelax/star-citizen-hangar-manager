import type { HangarSnapshot, Pledge, PledgeItem } from '@/hangar/pledge';
import type { Ship } from '@/ships/ships';
import { toCsv } from './csv';
import type { ExportFile } from './export-file';

/*
 * The hangar export in the format of HangarXPLOR (#228), which FleetYards imports: like its
 * `shiplist.json` and `shiplist.csv`, one entry per ship, not per pledge. FleetYards finds a ship
 * by `name` (the ship's name without its manufacturer); `ship_code` is built like HangarXPLOR
 * builds it (`RSI_Aurora_Mk_I_ES`, the manufacturer code and the name), without taking over its
 * list. A ship whose name isn't one of the ships the extension knows (RSI's upgrade tool) is
 * named after the export, so the user can check it in FleetYards. Made from the JSON export's
 * file (#226): the same pledges, the ids and amounts left out the same way.
 */

export interface HangarXplorShip {
  ship_code: string;
  ship_name: string;
  manufacturer_code: string;
  manufacturer_name: string;
  name: string;
  lti: boolean;
  warbond: boolean;
  entity_type: 'ship';
  pledge_id: string;
  pledge_name: string;
  pledge_date: string;
  pledge_cost: string;
}

export interface HangarXplorExport {
  ships: HangarXplorShip[];
  /** Ships whose names the extension doesn't know: FleetYards may not find them. */
  unmatched: string[];
}

const normalized = (name: string) =>
  name.toLowerCase().replaceAll('.', '').replace(/\s+/g, ' ').trim();

/** The ship's name without its manufacturer in front ("Drake Cutlass Black" → "Cutlass Black"). */
export function shipNameOf(item: PledgeItem): string {
  const title = item.title.trim();
  const prefixes = [item.manufacturerCode, item.manufacturer, item.manufacturer?.split(/\s+/)[0]]
    .filter((prefix): prefix is string => !!prefix)
    .sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (title.toLowerCase().startsWith(`${prefix.toLowerCase()} `)) {
      return title
        .slice(prefix.length)
        .replace(/^[^a-z0-9]+/i, '')
        .trim();
    }
  }
  return title;
}

/** "RSI_Aurora_Mk_I_ES", as HangarXPLOR builds the code of a ship. */
export const shipCodeOf = (manufacturerCode: string, name: string) =>
  `${manufacturerCode}_${name}`.replace(/[^a-z0-9]/gi, '_').replace(/__+/g, '_');

/** "2026-11-03" → "November 3, 2026", as RSI's hangar shows the date. */
function rsiDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

const isShip = (item: PledgeItem) => /^ship$/i.test(item.kind ?? '');

export function buildHangarXplorExport(
  file: ExportFile,
  knownShips: readonly Pick<Ship, 'name'>[] = [],
): HangarXplorExport {
  const hangar = file.storages.hangar?.value as HangarSnapshot | undefined;
  const amounts = !file.redacted?.includes('amounts');
  const known = new Set(knownShips.map((ship) => normalized(ship.name)));
  const unmatched = new Set<string>();
  const ships = (hangar?.pledges ?? []).flatMap((pledge: Pledge) => {
    const lti = pledge.items.some((item) => /lifetime insurance/i.test(item.title));
    return pledge.items.filter(isShip).map((item): HangarXplorShip => {
      const name = shipNameOf(item);
      if (known.size && !known.has(normalized(name)) && !known.has(normalized(item.title))) {
        unmatched.add(name);
      }
      const manufacturerCode = item.manufacturerCode ?? '';
      return {
        ship_code: shipCodeOf(manufacturerCode, name),
        ship_name: name,
        manufacturer_code: manufacturerCode,
        manufacturer_name: item.manufacturer ?? '',
        name,
        lti,
        warbond: /warbond/i.test(pledge.name),
        entity_type: 'ship',
        pledge_id: String(pledge.id),
        pledge_name: pledge.name,
        pledge_date: rsiDate(pledge.createdAt),
        pledge_cost: amounts ? pledge.value : '',
      };
    });
  });
  ships.sort(
    (a, b) =>
      a.manufacturer_name.localeCompare(b.manufacturer_name, 'en') ||
      a.name.localeCompare(b.name, 'en'),
  );
  return { ships, unmatched: [...unmatched].sort((a, b) => a.localeCompare(b, 'en')) };
}

/** `shiplist.csv`: HangarXPLOR's columns, safe against CSV injection like our own CSV. */
export const hangarXplorCsv = (ships: readonly HangarXplorShip[]) =>
  toCsv(
    ['Manufacturer', 'Ship', 'Lti', 'Warbond', 'ID', 'Pledge', 'Cost', 'Date'],
    ships.map((ship) => [
      ship.manufacturer_name,
      ship.ship_name,
      String(ship.lti),
      String(ship.warbond),
      ship.pledge_id,
      ship.pledge_name,
      ship.pledge_cost,
      ship.pledge_date,
    ]),
  );
