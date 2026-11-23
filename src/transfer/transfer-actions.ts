import type { DemoContext } from '@/demo/use-demo';
import { shipsItem } from '@/ships/ships-storage';
import { demoHangarData, loadDemoSettingsData } from './demo-transfer';
import { exportFileName, saveFile, saveJson, type ExportFile } from './export-file';
import { buybackCsv, hangarCsv } from './hangar-csv';
import { buildHangarExport, loadHangarData, type HangarExportOptions } from './hangar-export';
import { buildHangarXplorExport, hangarXplorCsv } from './hangarxplor-export';
import {
  buildSettingsExport,
  loadSettingsData,
  SETTINGS_PARTS,
  type SettingsPart,
} from './settings-export';

/*
 * The actions of Export & Import (#232) for the settings and My Hangar: each export made and
 * saved as a file in the browser, nothing sent anywhere.
 */

/** The formats of the hangar export: our JSON (#226), CSV (#227), HangarXPLOR's (#228). */
export const HANGAR_FORMATS = ['json', 'csv', 'hangarXplorJson', 'hangarXplorCsv'] as const;
export type HangarFormat = (typeof HANGAR_FORMATS)[number];

const CSV = 'text/csv;charset=utf-8';

/** Saves the hangar file in a format; returns the ships FleetYards may not find (#228). */
export async function saveHangarFile(
  file: ExportFile,
  format: HangarFormat,
  now = new Date(),
): Promise<{ unmatched: string[] }> {
  switch (format) {
    case 'json':
      saveJson(exportFileName('hangar', 'json', now), file);
      return { unmatched: [] };
    case 'csv': {
      saveFile(exportFileName('hangar', 'csv', now), hangarCsv(file), CSV);
      const buyback = buybackCsv(file);
      if (buyback) saveFile(exportFileName('buyback', 'csv', now), buyback, CSV);
      return { unmatched: [] };
    }
    case 'hangarXplorJson':
    case 'hangarXplorCsv': {
      const ships = (await shipsItem.getValue())?.ships ?? [];
      const { ships: entries, unmatched } = buildHangarXplorExport(file, ships);
      if (format === 'hangarXplorJson') {
        saveFile('shiplist.json', `${JSON.stringify(entries, null, 2)}\n`, 'application/json');
      } else {
        saveFile('shiplist.csv', hangarXplorCsv(entries), CSV);
      }
      return { unmatched };
    }
  }
}

/**
 * Exports the stored hangar (or the pledges given) in a format; in the demo mode the demo's
 * (#233), whose ids are made up, so the pledges given are its lists' own ids.
 */
export async function exportHangar(
  format: HangarFormat,
  options: HangarExportOptions = {},
  demo?: DemoContext | null,
) {
  if (demo) {
    const { pledgeIds, ...rest } = options;
    const hangar = demo.lists.hangar.filter((pledge) => !pledgeIds || pledgeIds.has(pledge.id));
    const data = demoHangarData(
      { hangar, buyback: pledgeIds ? [] : demo.lists.buyback },
      demo.storeCredit,
    );
    const file = buildHangarExport(
      pledgeIds ? { ...data, buyback: null, storeCredit: null } : data,
      rest,
    );
    return saveHangarFile({ ...file, demo: true, ...(pledgeIds && { partial: true }) }, format);
  }
  const file = buildHangarExport(await loadHangarData(), options);
  return saveHangarFile(file, format);
}

/** Exports the settings and your data; in the demo mode the demo's own (#233). */
export async function exportSettings(
  parts: readonly SettingsPart[] = SETTINGS_PARTS,
  demo = false,
) {
  const values = demo ? await loadDemoSettingsData(parts) : await loadSettingsData(parts);
  const file = { ...buildSettingsExport(values, parts), ...(demo && { demo: true }) };
  saveJson(exportFileName(parts.length === 1 ? parts[0]! : 'settings', 'json'), file);
}

/** The text of a file the user chose. */
export const readChosenFile = (file: File): Promise<string> => file.text();
