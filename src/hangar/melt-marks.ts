import { MELT_COOLDOWN_MS } from '@/config';
import { hangarSnapshot } from './hangar-storage';
import { HANGAR_SNAPSHOT_VERSION } from './pledge';

/*
 * Pledges marked "to melt" in My Hangar (#97): RSI lets a pledge be melted only 24 hours after it
 * was bought, so a pledge bought just now (e.g. a filler paint of the Paint Discount Consultant)
 * is marked and the manager tells when it can be melted – in its row and in the sidebar's
 * notifications. The marks are kept in the sync storage, so they follow the browser profile to
 * other devices: only the pledge id and when it was marked, so many fit into its per-item quota.
 * A mark goes once its pledge is gone from the hangar.
 */

/** When each pledge was marked (ms), by pledge id. */
export type MeltMarks = Readonly<Record<string, number>>;

export const meltMarksItem = storage.defineItem<MeltMarks>('sync:hangar.meltMarks', {
  fallback: {},
});

/**
 * The marks of the demo mode, apart from the real ones: the demo's pledges have the real ids, and
 * trying marks out there shouldn't mark real pledges on every device. Kept in this browser only.
 */
export const demoMeltMarksItem = storage.defineItem<MeltMarks>('local:demo.meltMarks', {
  fallback: {},
});

/**
 * A time without a time zone ("2026-10-30T19:55") in ms, read both as UTC and as local time:
 * RSI doesn't say which one its lists use, and the later reading counts, so a pledge is never
 * shown as meltable too early.
 */
function latestReading(naive: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(naive);
  if (!match) return undefined;
  const [year, month, day, hours, minutes] = match.slice(1).map((part) => Number(part ?? 0));
  const parts = [year!, month! - 1, day!, hours!, minutes!] as const;
  return Math.max(Date.UTC(...parts), new Date(...parts).getTime());
}

/**
 * When the pledge can be melted, in ms: 24 hours after it was bought. The time of the purchase
 * comes from the pledge log (`createdAt` of its order link); with only the purchase date, the end
 * of that day counts; without either, the time it was marked.
 */
export function meltableAt({
  boughtAt,
  boughtOn,
  markedAt,
}: {
  /** "2026-10-30T19:55" from the pledge log. */
  boughtAt?: string;
  /** "2026-10-30" from the list. */
  boughtOn?: string;
  markedAt: number;
}): number {
  const bought =
    (boughtAt && latestReading(boughtAt)) ||
    (boughtOn && latestReading(`${boughtOn}T23:59`)) ||
    markedAt;
  return bought + MELT_COOLDOWN_MS;
}

/** The marks with the pledge marked or unmarked. */
export function toggledMarks(marks: MeltMarks, pledgeId: number, now: number): MeltMarks {
  const { [pledgeId]: existing, ...rest } = marks;
  return existing === undefined ? { ...marks, [pledgeId]: now } : rest;
}

/**
 * The marks without those of pledges gone from the hangar; `marks` itself when none is gone. Only
 * marks set before the hangar was last updated (`hangarUpdatedAt`) can be gone: the marks follow
 * the browser profile, and another device may have marked a pledge this one's hangar doesn't
 * know yet.
 */
export function marksInHangar(
  marks: MeltMarks,
  hangarIds: ReadonlySet<number>,
  hangarUpdatedAt: number,
): MeltMarks {
  const kept = Object.entries(marks).filter(
    ([id, markedAt]) => hangarIds.has(Number(id)) || markedAt >= hangarUpdatedAt,
  );
  return kept.length === Object.keys(marks).length ? marks : Object.fromEntries(kept);
}

/** Marks or unmarks the pledge, in the demo's own marks while it is on. */
export async function toggleMeltMark(pledgeId: number, demo = false): Promise<void> {
  const item = demo ? demoMeltMarksItem : meltMarksItem;
  await item.setValue(toggledMarks(await item.getValue(), pledgeId, Date.now()));
}

/** Drops the marks of pledges that are gone from the stored hangar (melted, gifted, …). */
export async function pruneMeltMarks(): Promise<void> {
  const [marks, snapshot] = await Promise.all([
    meltMarksItem.getValue(),
    hangarSnapshot.getValue(),
  ]);
  if (snapshot?.version !== HANGAR_SNAPSHOT_VERSION) return;
  const updatedAt = Date.parse(snapshot.updatedAt ?? snapshot.syncedAt);
  if (Number.isNaN(updatedAt)) return;
  const ids = new Set(snapshot.pledges.map((pledge) => pledge.id));
  const kept = marksInHangar(marks, ids, updatedAt);
  if (kept !== marks) await meltMarksItem.setValue(kept);
}

/** "5 h 12 min", "12 min" or "< 1 min" until `ms` have passed. */
export function formatTimeLeft(ms: number, locale: string): string {
  const minutes = Math.ceil(ms / 60_000);
  const unit = (value: number, unit: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(value);
  if (minutes < 1) return `< ${unit(1, 'minute')}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return unit(rest, 'minute');
  return rest ? `${unit(hours, 'hour')} ${unit(rest, 'minute')}` : unit(hours, 'hour');
}
