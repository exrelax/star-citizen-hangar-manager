import { DEMO } from '@/config';

/*
 * The invisible demo mode for screenshots (#133), development builds only: the demo's data
 * without its badge and with every button looking enabled (clicks still do nothing in the demo).
 * It ends on its own after `DEMO.invisibleMinutes` and the normal demo mode with its badge is back,
 * so it can't be left on by accident. The end time is stored, not a timer: a reload or a second
 * tab keeps it.
 */

/** When the invisible demo mode ends, in ms; none while it is off. */
export const invisibleDemoUntilItem = storage.defineItem<number | null>(
  'local:demo.invisibleUntil',
  { fallback: null },
);

/** Whether it is on at `now`: a development build, the demo mode on and the time not over. */
export const isInvisibleDemo = (until: number | null | undefined, demo: boolean, now: number) =>
  import.meta.env.DEV && demo && !!until && until > now;

/** Turns it on for `DEMO.invisibleMinutes` from now. */
export const startInvisibleDemo = (now = Date.now()) =>
  invisibleDemoUntilItem.setValue(now + DEMO.invisibleMinutes * 60 * 1000);

/** Turns it off at once. */
export const stopInvisibleDemo = () => invisibleDemoUntilItem.setValue(null);
