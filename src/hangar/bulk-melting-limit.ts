/*
 * The limit of bulk melting in My Hangar (#622, the setting `bulkMeltingMax`): the "Selected" box's
 * button and the dialog melt only up to that many pledges at once.
 */

/** Whether `count` pledges are more than bulk melting may melt at once. */
export const isOverBulkLimit = (count: number, max: number): boolean => count > max;
