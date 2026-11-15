/*
 * Moves the store issues on the project board from "In review" to "Done" once their store has
 * published the version (#350), run hourly by `.github/workflows/store-review.yml`.
 *
 * A store issue is an open issue with the label `store-review` whose body names its store and,
 * optionally, the version and the extension's id in the store, each on a line of its own:
 *
 *     Store: chrome
 *     Version: 1.1.1
 *     Id: <the store's id, only where it differs from `STORES`, e.g. Edge's>
 *
 * Without a version any listing counts (the first approval); with one, the store's version has
 * to be the same or newer. Only an issue in "In review" moves: it gets the status "Done", a
 * comment with the version seen, and is closed.
 *
 * Tokens: `GITHUB_TOKEN` reads, comments on and closes the issues; the board of a user can't be
 * reached with it, so `PROJECT_TOKEN` (a token with access to the project) reads and sets the
 * status. Without `PROJECT_TOKEN`, or with `--dry-run`, the run only reports what it would do.
 *
 * It also tells #333 once the Chrome Web Store reports that Enhanced Safe Browsing trusts the
 * extension, so the notes about the warning can be removed.
 *
 * A store that answers unexpectedly, or an issue without a known store, fails the run after the
 * other issues are done, so GitHub reports it by email; nothing moves on a guess.
 */

import { appendFile } from 'node:fs/promises';
import { isPublishIssue } from '../../site/roadmap/roadmap.ts';
import {
  deployedSteps,
  expectedInReview,
  outdatedSteps,
  SITE_URL,
  type MilestoneIssue,
} from './roadmap-sync.ts';
import {
  compareVersions,
  isStoreId,
  readListing,
  STORE_IDS,
  STORES,
  type Listing,
  type StoreId,
} from './stores.ts';

export const REPOSITORY = 'exrelax/star-citizen-hangar-manager';
export const PROJECT = { owner: 'exrelax', number: 1 } as const;
export const LABEL = 'store-review';
export const IN_REVIEW = 'In review';
export const DONE = 'Done';
/** The issue about Chrome's Enhanced Safe Browsing warning, and the mark of its comment. */
export const ESB_ISSUE = 333;
export const ESB_MARK = '<!-- store-review: esb-trusted -->';

export interface StoreIssue {
  store: StoreId;
  version?: string;
  id?: string;
}

/** The store, version and id named in an issue's body, or why they can't be read. */
export function parseStoreIssue(body: string): StoreIssue | string {
  const field = (name: string) =>
    new RegExp(`^\\s*${name}:[ \\t]*(\\S+)[ \\t]*$`, 'im').exec(body)?.[1];
  const store = field('Store')?.toLowerCase();
  if (!store) return 'no line "Store: …"';
  if (!isStoreId(store)) return `unknown store "${store}" (known: ${STORE_IDS.join(', ')})`;
  const version = field('Version')?.replace(/^v/i, '');
  if (version !== undefined && !/^\d+(?:\.\d+){0,3}$/.test(version)) {
    return `"${version}" is no version`;
  }
  const id = field('Id');
  if (!id && !STORES[store].defaultId) return `no line "Id: …" for ${STORES[store].name}`;
  return { store, ...(version && { version }), ...(id && { id }) };
}

/** Whether the listing has the version the issue waits for. */
export function isPublished(issue: StoreIssue, listing: Listing | undefined): boolean {
  if (!listing) return false;
  return issue.version === undefined || compareVersions(listing.version, issue.version) >= 0;
}

export function doneComment(issue: StoreIssue, listing: Listing, url: string, at: Date): string {
  const seen = at.toISOString().slice(0, 16).replace('T', ' ');
  return `${STORES[issue.store].name} lists version ${listing.version} (seen ${seen} UTC): ${url}\n\nMoved to "${DONE}" by the store review workflow (#350).`;
}

export const ESB_COMMENT = `${ESB_MARK}\nThe Chrome Web Store now reports that Enhanced Safe Browsing trusts the extension (\`_esbAllowlist="true"\` in its update check). Check the install with Enhanced Safe Browsing on, then remove the notes about the warning from the README and the website.\n\nNoticed by the store review workflow (#350).`;

// ---------------------------------------------------------------------------------------------
// GitHub

type Fetch = typeof fetch;

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  pull_request?: unknown;
}

interface BoardItem {
  itemId: string;
  status: string;
}

interface Board {
  projectId: string;
  statusFieldId: string;
  doneOptionId: string;
  /** The board's items of this repository, by issue number. */
  items: Map<number, BoardItem>;
}

export class GitHub {
  private readonly token: string | undefined;
  private readonly projectToken: string | undefined;
  private readonly fetchImpl: Fetch;

  constructor(token: string | undefined, projectToken: string | undefined, fetchImpl: Fetch) {
    this.token = token;
    this.projectToken = projectToken;
    this.fetchImpl = fetchImpl;
  }

  get canReadBoard(): boolean {
    return !!this.projectToken;
  }

  async rest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await this.fetchImpl(`https://api.github.com${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    });
    if (!response.ok) {
      throw new Error(
        `GitHub ${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`,
      );
    }
    return (await response.json()) as T;
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.projectToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const result = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (!response.ok || !result.data || result.errors?.length) {
      throw new Error(
        `GitHub GraphQL: ${result.errors?.[0]?.message ?? `${response.status} ${response.statusText}`}`,
      );
    }
    return result.data;
  }

  /** The open store issues. */
  async storeIssues(): Promise<GitHubIssue[]> {
    const issues = await this.rest<GitHubIssue[]>(
      `/repos/${REPOSITORY}/issues?labels=${LABEL}&state=open&per_page=100`,
    );
    return issues.filter((issue) => !issue.pull_request);
  }

  async board(): Promise<Board> {
    const query = `query($owner: String!, $number: Int!, $after: String) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          field(name: "Status") {
            ... on ProjectV2SingleSelectField { id options { id name } }
          }
          items(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
              content { ... on Issue { number repository { nameWithOwner } } }
            }
          }
        }
      }
    }`;
    interface Answer {
      user: {
        projectV2: {
          id: string;
          field: { id: string; options: { id: string; name: string }[] } | null;
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: {
              id: string;
              status: { name?: string } | null;
              content: { number?: number; repository?: { nameWithOwner: string } } | null;
            }[];
          };
        } | null;
      } | null;
    }
    const items = new Map<number, BoardItem>();
    for (let after: string | null = null; ;) {
      const data: Answer = await this.graphql<Answer>(query, { ...PROJECT, after });
      const project = data.user?.projectV2;
      if (!project) throw new Error(`Project ${PROJECT.owner}/${PROJECT.number} not found`);
      for (const node of project.items.nodes) {
        const issue = node.content;
        if (issue?.number && issue.repository?.nameWithOwner === REPOSITORY) {
          items.set(issue.number, { itemId: node.id, status: node.status?.name ?? '' });
        }
      }
      if (!project.items.pageInfo.hasNextPage) {
        const done = project.field?.options.find((option) => option.name === DONE);
        if (!project.field || !done) throw new Error(`The board has no status "${DONE}"`);
        return {
          projectId: project.id,
          statusFieldId: project.field.id,
          doneOptionId: done.id,
          items,
        };
      }
      after = project.items.pageInfo.endCursor;
    }
  }

  async setDone(board: Board, item: BoardItem): Promise<void> {
    await this.graphql(
      `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project, itemId: $item, fieldId: $field,
          value: { singleSelectOptionId: $option }
        }) { projectV2Item { id } }
      }`,
      {
        project: board.projectId,
        item: item.itemId,
        field: board.statusFieldId,
        option: board.doneOptionId,
      },
    );
  }

  async comment(issue: number, body: string): Promise<void> {
    await this.rest(`/repos/${REPOSITORY}/issues/${issue}/comments`, {
      method: 'POST',
      body: { body },
    });
  }

  async close(issue: number): Promise<void> {
    await this.rest(`/repos/${REPOSITORY}/issues/${issue}`, {
      method: 'PATCH',
      body: { state: 'closed', state_reason: 'completed' },
    });
  }

  /** The open issues with a milestone, for the publish issues (#354). */
  async openMilestoneIssues(): Promise<MilestoneIssue[]> {
    const all: MilestoneIssue[] = [];
    for (let page = 1; ; page++) {
      const issues = await this.rest<MilestoneIssue[]>(
        `/repos/${REPOSITORY}/issues?state=open&milestone=*&per_page=100&page=${page}`,
      );
      all.push(...issues.filter((issue) => !issue.pull_request));
      if (issues.length < 100) return all;
    }
  }

  /** Starts a build of the website on main. */
  async buildSite(): Promise<void> {
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${REPOSITORY}/actions/workflows/site.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    );
    if (!response.ok) {
      throw new Error(`Starting the website build: ${response.status} ${await response.text()}`);
    }
  }

  /** All pages of a list of the REST API. */
  async restAll<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page++) {
      const items = await this.rest<T[]>(`${path}${separator}per_page=100&page=${page}`);
      all.push(...items);
      if (items.length < 100) return all;
    }
  }

  async openMilestones(): Promise<Milestone[]> {
    return this.restAll<Milestone>(`/repos/${REPOSITORY}/milestones?state=open`);
  }

  async milestoneIssues(milestone: number): Promise<ReleaseIssue[]> {
    const issues = await this.restAll<ReleaseIssue>(
      `/repos/${REPOSITORY}/issues?milestone=${milestone}&state=all`,
    );
    return issues.filter((issue) => !issue.pull_request);
  }

  async subIssues(issue: number): Promise<ReleaseIssue[]> {
    return this.restAll<ReleaseIssue>(`/repos/${REPOSITORY}/issues/${issue}/sub_issues`);
  }

  async closeMilestone(milestone: number): Promise<void> {
    await this.rest(`/repos/${REPOSITORY}/milestones/${milestone}`, {
      method: 'PATCH',
      body: { state: 'closed' },
    });
  }

  async issue(number: number): Promise<GitHubIssue> {
    return this.rest<GitHubIssue>(`/repos/${REPOSITORY}/issues/${number}`);
  }

  async comments(issue: number): Promise<{ body: string }[]> {
    return this.rest<{ body: string }[]>(
      `/repos/${REPOSITORY}/issues/${issue}/comments?per_page=100`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// The run

export interface RunOptions {
  github: GitHub;
  /** Only report, change nothing. */
  dryRun: boolean;
  fetch?: Fetch;
  now?: () => Date;
  log?: (line: string) => void;
}

interface Milestone {
  number: number;
  title: string;
}

interface ReleaseIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  labels: { name?: string }[];
  pull_request?: unknown;
  sub_issues_summary?: { total: number; completed?: number } | null;
}

export interface RunResult {
  /** The issues moved to "Done" (or that would be, in a dry run), publish issues too. */
  moved: number[];
  /** The milestones closed (or that would be), by title (#365). */
  closedMilestones: string[];
  /** What failed; the run fails when it isn't empty. */
  errors: string[];
}

export async function run(options: RunOptions): Promise<RunResult> {
  const {
    github,
    dryRun,
    fetch: fetchImpl = fetch,
    now = () => new Date(),
    log = console.log,
  } = options;
  const writes = !dryRun && github.canReadBoard;
  if (!github.canReadBoard) log("No PROJECT_TOKEN: the board can't be read, only reporting.");
  else if (dryRun) log('Dry run: only reporting.');

  const result: RunResult = { moved: [], closedMilestones: [], errors: [] };
  const listings = new Map<string, Promise<Listing | undefined>>();
  const listing = (store: StoreId, id: string) => {
    const key = `${store}|${id}`;
    if (!listings.has(key)) listings.set(key, readListing(STORES[store], id, fetchImpl));
    return listings.get(key)!;
  };

  const issues = await github.storeIssues();
  const board = github.canReadBoard ? await github.board() : undefined;
  log(`${issues.length} open store issue(s).`);

  for (const issue of issues) {
    const label = `#${issue.number} ${issue.title}`;
    const item = board?.items.get(issue.number);
    if (board && !item) {
      log(`${label}: not on the board, skipped.`);
      continue;
    }
    if (item && item.status !== IN_REVIEW) {
      log(`${label}: "${item.status || 'no status'}", not "${IN_REVIEW}", skipped.`);
      continue;
    }
    // Before its review, an issue may still lack a line (Edge's id is known only then).
    const parsed = parseStoreIssue(issue.body ?? '');
    if (typeof parsed === 'string') {
      // Without the board its status is unknown: it may well not be in review yet.
      if (board) result.errors.push(`${label}: ${parsed}`);
      else log(`${label}: ${parsed}, skipped.`);
      continue;
    }
    const store = STORES[parsed.store];
    const id = parsed.id ?? store.defaultId!;
    let listed: Listing | undefined;
    try {
      listed = await listing(parsed.store, id);
    } catch (error) {
      result.errors.push(`${label}: ${(error as Error).message}`);
      continue;
    }
    const wanted = parsed.version ?? 'any version';
    if (!listed || !isPublished(parsed, listed)) {
      log(`${label}: ${store.name} lists ${listed?.version ?? 'nothing'}, waiting for ${wanted}.`);
      continue;
    }
    log(`${label}: ${store.name} lists ${listed.version} (${wanted}) → ${DONE}.`);
    result.moved.push(issue.number);
    if (!writes) continue;
    try {
      await github.setDone(board!, item!);
      await github.comment(issue.number, doneComment(parsed, listed, store.listingUrl(id), now()));
      await github.close(issue.number);
    } catch (error) {
      result.errors.push(`${label}: ${(error as Error).message}`);
    }
  }

  if (board) {
    let released = false;
    try {
      released = await closeReleases(github, board, writes, result, log);
    } catch (error) {
      result.errors.push(`Releases: ${(error as Error).message}`);
    }
    try {
      // The board read at the start is outdated now: the roadmap has to be built again anyway.
      if (released) {
        log('A publish issue or milestone was closed: starting a website build.');
        if (writes) await github.buildSite();
      } else {
        await syncRoadmap(github, board, writes, fetchImpl, log);
      }
    } catch (error) {
      result.errors.push(`Roadmap: ${(error as Error).message}`);
    }
  }

  try {
    await tellEsbTrusted(github, await listing('chrome', STORES.chrome.defaultId!), writes, log);
  } catch (error) {
    result.errors.push(`#${ESB_ISSUE}: ${(error as Error).message}`);
  }
  return result;
}

const VERSION_TITLE = /^v?\d+\.\d+\.\d+$/;

/**
 * Closes the releases that are done (#365): a publish issue ("Publish v1.1.1") once all its
 * sub-issues are closed – status "Done", a comment – and then its milestone once all of its issues
 * are closed. A milestone without a publish issue stays open. Issues this run closed (or would, in a
 * dry run) count as closed. Returns whether it closed anything.
 */
async function closeReleases(
  github: GitHub,
  board: Board,
  writes: boolean,
  result: RunResult,
  log: (line: string) => void,
): Promise<boolean> {
  const closedNow = new Set(result.moved);
  const isClosed = (issue: { number: number; state: string }) =>
    issue.state === 'closed' || closedNow.has(issue.number);
  let changed = false;
  for (const milestone of await github.openMilestones()) {
    if (!VERSION_TITLE.test(milestone.title.trim())) continue;
    const issues = await github.milestoneIssues(milestone.number);
    const publish = issues.find((issue) => isPublishIssue(issue, milestone.title));
    if (!publish) continue;
    const label = `#${publish.number} ${publish.title}`;

    if (!isClosed(publish)) {
      const subIssues = await github.subIssues(publish.number);
      const open = subIssues.filter((issue) => !isClosed(issue));
      if (open.length) {
        log(`${label}: ${open.length} of ${subIssues.length} sub-issue(s) still open.`);
        continue;
      }
      log(`${label}: all sub-issues are closed → ${DONE}.`);
      result.moved.push(publish.number);
      closedNow.add(publish.number);
      changed = true;
      if (writes) {
        const item = board.items.get(publish.number);
        if (item) await github.setDone(board, item);
        await github.comment(publish.number, PUBLISH_DONE_COMMENT);
        await github.close(publish.number);
      }
    }

    const open = issues.filter((issue) => !isClosed(issue));
    if (open.length) {
      log(`Milestone ${milestone.title}: ${open.length} issue(s) still open.`);
      continue;
    }
    log(`Milestone ${milestone.title}: all issues are closed → closed.`);
    result.closedMilestones.push(milestone.title);
    changed = true;
    if (writes) await github.closeMilestone(milestone.number);
  }
  return changed;
}

export const PUBLISH_DONE_COMMENT =
  'All store issues are done: every store has published the version. Moved to "Done" by the store review workflow (#365).';

/** Starts a website build when the roadmap shows a version's review state wrongly (#354). */
async function syncRoadmap(
  github: GitHub,
  board: Board,
  writes: boolean,
  fetchImpl: Fetch,
  log: (line: string) => void,
): Promise<void> {
  const response = await fetchImpl(SITE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${SITE_URL}: ${response.status}`);
  const outdated = outdatedSteps(
    deployedSteps(await response.text()),
    expectedInReview(await github.openMilestoneIssues(), (issue) => board.items.get(issue)?.status),
  );
  if (!outdated.length) {
    log('The roadmap shows the review state of each version.');
    return;
  }
  log(`The roadmap is outdated (${outdated.join(', ')}): starting a website build.`);
  if (writes) await github.buildSite();
}

/** Comments on #333 once Chrome trusts the extension, while the issue is open. */
async function tellEsbTrusted(
  github: GitHub,
  chrome: Listing | undefined,
  writes: boolean,
  log: (line: string) => void,
): Promise<void> {
  if (!chrome?.esbTrusted) {
    log(`Enhanced Safe Browsing doesn't trust the extension yet (#${ESB_ISSUE}).`);
    return;
  }
  const issue = await github.issue(ESB_ISSUE);
  if (issue.state !== 'open') return;
  const comments = await github.comments(ESB_ISSUE);
  if (comments.some((comment) => comment.body.includes(ESB_MARK))) return;
  log(`Enhanced Safe Browsing trusts the extension: telling #${ESB_ISSUE}.`);
  if (writes) await github.comment(ESB_ISSUE, ESB_COMMENT);
}

async function main() {
  const github = new GitHub(
    process.env.GITHUB_TOKEN || undefined,
    process.env.PROJECT_TOKEN || undefined,
    fetch,
  );
  const lines: string[] = [];
  const log = (line: string) => {
    console.log(line);
    lines.push(`- ${line}`);
  };
  const { errors } = await run({ github, dryRun: process.argv.includes('--dry-run'), log });
  for (const error of errors) {
    console.error(`::error::${error}`);
    lines.push(`- **Error:** ${error}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Store review\n\n${lines.join('\n')}\n`);
  }
  if (errors.length) process.exitCode = 1;
}

if (import.meta.main) await main();
