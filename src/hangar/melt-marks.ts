import { MELT_COOLDOWN_MS } from '@/config';

/*
 * Pledges marked "to melt" in My Hangar (#97): RSI lets a pledge be melted only 24 hours after it
 * was bought, so a pledge bought just now (e.g. a filler paint of the Paint Discount Consultant)
 * is marked and the manager tells when it can be melted – in its row and in the sidebar's
 * notifications. The marks are kept in this browser only; a mark goes once its pledge is gone
 * from the hangar.
 */

export interface MeltMark {
  /** When it was marked, in ms. */
  markedAt: number;
  /** The pledge's title, for the notification after it is gone from the list. */
  title: string;
}

/** The marks by pledge id. */
export type MeltMarks = Readonly<Record<string, MeltMark>>;

export const meltMarksItem = storage.defineItem<MeltMarks>('local:hangar.meltMarks', {
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

/** The marks with `pledgeId` marked or unmarked. */
export function toggledMarks(
  marks: MeltMarks,
  pledge: { id: number; title: string },
  now: number,
): MeltMarks {
  const { [pledge.id]: existing, ...rest } = marks;
  return existing ? rest : { ...marks, [pledge.id]: { markedAt: now, title: pledge.title } };
}

/** The marks of pledges still in the hangar; `marks` itself when none is gone. */
export function marksInHangar(marks: MeltMarks, hangarIds: ReadonlySet<number>): MeltMarks {
  const kept = Object.entries(marks).filter(([id]) => hangarIds.has(Number(id)));
  return kept.length === Object.keys(marks).length ? marks : Object.fromEntries(kept);
}

/** Marks or unmarks the pledge. */
export async function toggleMeltMark(pledge: { id: number; title: string }): Promise<void> {
  await meltMarksItem.setValue(toggledMarks(await meltMarksItem.getValue(), pledge, Date.now()));
}

/** Drops the marks of pledges that are gone from the hangar (melted, gifted, …). */
export async function pruneMeltMarks(hangarIds: ReadonlySet<number>): Promise<void> {
  const marks = await meltMarksItem.getValue();
  const kept = marksInHangar(marks, hangarIds);
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
