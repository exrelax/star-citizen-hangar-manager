/*
 * Keeps the website's roadmap in step with the publish issues (#354): the roadmap shows a version
 * as "In review" while its publish issue ("Publish 1.1.1", a parent issue) is "In review" on the
 * board, but a change on the board starts no workflow, so the website would show it only with its
 * daily build. The hourly store review compares the deployed roadmap with the board and starts a
 * website build when they differ.
 */

import { idOf, isPublishIssue, type GitHubIssue } from '../../site/roadmap/roadmap.ts';

export const SITE_URL = 'https://exrelax.github.io/star-citizen-hangar-manager/';
export const IN_REVIEW = 'In review';
const PLANNED_STEPS = ['is-next', 'is-planned', 'is-review'];

export interface MilestoneIssue extends GitHubIssue {
  milestone: { title: string } | null;
}

/** The steps of the deployed roadmap: the id of each card's title, and whether it's in review. */
export function deployedSteps(html: string): Map<string, boolean> {
  const steps = new Map<string, boolean>();
  const step =
    /<li class="roadmap-step ([\w-]+)">[\s\S]*?<article class="roadmap-card" aria-labelledby="([\w-]+)">/g;
  for (const match of html.matchAll(step)) {
    // The live version and "Later" are never in review.
    if (PLANNED_STEPS.includes(match[1]!)) steps.set(match[2]!, match[1] === 'is-review');
  }
  return steps;
}

/** The ids of the roadmap cards that should be in review, by the board. */
export function expectedInReview(
  issues: readonly MilestoneIssue[],
  status: (issue: number) => string | undefined,
): Set<string> {
  return new Set(
    issues
      .filter((issue) => issue.milestone && isPublishIssue(issue))
      .filter((issue) => status(issue.number) === IN_REVIEW)
      .map((issue) => idOf(issue.milestone!.title)),
  );
}

/**
 * The versions whose card shows the wrong state, e.g. "v1.1.1 should be in review". Only versions
 * the deployed roadmap shows count: one beyond its planned versions never will.
 */
export function outdatedSteps(deployed: Map<string, boolean>, expected: Set<string>): string[] {
  return [...deployed]
    .filter(([id, inReview]) => inReview !== expected.has(id))
    .map(([id, inReview]) => `${id} ${inReview ? 'is no longer' : 'should be'} in review`);
}
