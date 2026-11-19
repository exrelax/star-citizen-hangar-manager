import type { Pledge } from '@/hangar/pledge';
import type { PledgeView } from '@/hangar/pledge-view';
import type { PledgeChange, VerifyResult } from '@/hangar/verify-pledges';

/*
 * The check right before bulk melting (#415) in the demo (#416): the outcome comes from the demo
 * settings, after a pause as long as reading a few pages takes, so "Checking the pledges …" shows.
 * With "all match", the run goes on as a real one would, pledge by pledge – but nothing is read
 * from RSI and nothing is exchanged: neither function ever sends a request.
 */

export const MELT_CHECK_OUTCOMES = [
  'match',
  'changed',
  'gone',
  'notMeltable',
  'unreadable',
] as const;
export type MeltCheckOutcome = (typeof MELT_CHECK_OUTCOMES)[number];

/** How long the demo's check and each of its exchanges take. */
export const DEMO_MELT_TIMING = { checkMs: 1500, exchangeMs: 600 } as const;

/** What changed of the first pledge, by outcome. */
const CHANGES: Record<Exclude<MeltCheckOutcome, 'match' | 'unreadable'>, PledgeChange[]> = {
  changed: ['value', 'items'],
  gone: ['gone'],
  notMeltable: ['notMeltable'],
};

/** The message of a page that can't be read, as a real check shows it. */
export const DEMO_UNREADABLE = 'Hangar page 1 is no account page – are you still logged in?';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The check and the exchange of the demo's bulk melting dialog, for its pledges: the first one
 * changed, gone or no longer meltable, all matching, or RSI not readable.
 */
export function demoMeltRun(
  outcome: MeltCheckOutcome,
  pledges: readonly PledgeView[],
  timing: { checkMs: number; exchangeMs: number } = DEMO_MELT_TIMING,
) {
  const verify = async (): Promise<VerifyResult> => {
    await wait(timing.checkMs);
    if (outcome === 'unreadable') throw new Error(DEMO_UNREADABLE);
    const first = pledges[0];
    if (outcome === 'match' || !first) return { status: 'match', requests: 0 };
    // Only what the dialog shows of it: its title, when it isn't in the list.
    const stored = { id: first.id, title: first.title } as Pledge;
    return {
      status: 'mismatch',
      mismatches: [{ id: first.id, stored, changes: CHANGES[outcome] }],
      requests: 0,
    };
  };
  const reclaim = async () => {
    await wait(timing.exchangeMs);
  };
  return { verify, reclaim };
}
