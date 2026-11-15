/*
 * Keeps the website's roadmap in step with the publish issues (#354): the roadmap shows a version
 * as "In review" while its publish issue ("Publish 1.1.1", a parent issue) is "In review" on the
 * board, but a change on the board starts no workflow, so the website would show it only with its
 * daily build. The hourly store review compares the deployed roadmap with the board and starts a
 * website build when they differ.
 */

import { idOf, isInReview, type GitHubIssue } from '../../site/roadmap/roadmap.ts';

export const SITE_URL = 'https://exrelax.github.io/star-citizen-hangar-manager/';
const STATES: Record<string, StepState> = {
  'is-live': 'live',
  'is-next': 'planned',
  'is-planned': 'planned',
  'is-review': 'review',
};

export interface MilestoneIssue extends GitHubIssue {
  milestone: { title: string } | null;
}

/** The state each card of the deployed roadmap shows. */
export type StepState = 'live' | 'review' | 'planned';

/** The cards of the deployed roadmap: the id of each card's title, and the state it shows. */
export function deployedSteps(html: string): Map<string, StepState> {
  const steps = new Map<string, StepState>();
  const step =
    /<li class="roadmap-step ([\w-]+)">[\s\S]*?<article class="roadmap-card" aria-labelledby="([\w-]+)">/g;
  for (const match of html.matchAll(step)) {
    const state = STATES[match[1]!];
    // "Later" is never a version.
    if (state) steps.set(match[2]!, state);
  }
  return steps;
}

/** The ids of the roadmap cards that should be in review, by the board (as the roadmap decides). */
export function expectedInReview(
  issues: readonly MilestoneIssue[],
  status: (issue: number) => string | undefined,
): Set<string> {
  const byMilestone = Map.groupBy(
    issues.filter((issue) => issue.milestone),
    (issue) => issue.milestone!.title,
  );
  const columns = new Map(
    issues.flatMap((issue) => {
      const column = status(issue.number);
      return column === undefined ? [] : [[issue.number, column] as const];
    }),
  );
  return new Set(
    [...byMilestone]
      .filter(([, milestoneIssues]) => isInReview(milestoneIssues, columns))
      .map(([title]) => idOf(title)),
  );
}

/**
 * The versions whose card shows the wrong state, e.g. "v1.1.1 should be in review". Only versions
 * the deployed roadmap shows count: one beyond its planned versions never will. A version shown as
 * live while it is in review is wrong too: its release was published before the stores did (#354).
 */
export function outdatedSteps(deployed: Map<string, StepState>, expected: Set<string>): string[] {
  return [...deployed]
    .filter(([id, state]) => (state === 'review') !== expected.has(id))
    .map(([id, state]) =>
      state === 'review' ? `${id} is no longer in review` : `${id} should be in review`,
    );
}
