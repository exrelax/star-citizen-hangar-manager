/*
 * RSI's pledge log (`/api/account/pledgeLog`, see `sync-orders.ts`) lists every action on the
 * account, newest first and by the time of the action – also actions on old pledges. Each entry
 * names the pledges it is about, e.g.:
 *
 * - "… Paint #114816820 - Created by … - Buy-Back order #4OLB2S5WUG6PX" (a new pledge)
 * - "… Paint #80478064 - Buy-back by … - order #4OLB2S5WUG6PX" (bought back: gone from the buy back)
 * - "… Paint #67709890 - Reclaimed by … for $5.00 USD" (melted: from the hangar to the buy back)
 * - "… HoverQuad #38580456 - Upgrade applied: #107978978 Upgrade - …, new value: $90.00 USD"
 * - "… Upgrade - Starfarer Gemini to Glaive … #112668851 - Consumed by … on pledge #68746466, …"
 * - "… Upgrade - Centurion to Nova … #89637231 - Claimed as a gift by … value: $10.00 USD"
 *
 * The smart update loads the pages of these pledges in the hangar and the buy back, so a change
 * that keeps the number of pledges in a part of the list is found as well.
 */

/** Pledge ids of a log entry; order numbers ("order #4OLB…") are left out. */
export function pledgeIdsOfLogEntry(entry: string): number[] {
  return [...entry.matchAll(/(?<!order )#(\d+)\b/gi)].map((match) => Number(match[1]));
}

/** All pledge ids named by the given log entries, each once. */
export function pledgeIdsOfLogEntries(entries: readonly string[]): number[] {
  return [...new Set(entries.flatMap(pledgeIdsOfLogEntry))];
}
