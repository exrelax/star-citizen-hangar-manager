/*
 * The roadmap of the website, built from the repository's GitHub issues when the site is built
 * (see site/vite.config.ts). Visitors' browsers never contact GitHub: the roadmap is plain HTML.
 * Its layout is the design "Roadmap – Komponente" of the design file "Hangar Manager – Website"
 * (#347): the live version and up to two planned versions on one timeline, then "Later".
 *
 * - Live: the current version, the latest GitHub release (or the version of package.json if there
 *   is none); the hero shows it, too. With its milestone (titled like the version), it lists the
 *   main issues that went into it, those with the most sub-issues first. A patch version (e.g.
 *   1.1.1) is part of the card of its minor or major version: the card lists the finished patches
 *   (closed milestones up to the live version) with the description of their milestone, and the
 *   highlights stay those of the minor or major version.
 * - Planned: the next open milestones with issues – by due date, those without one after them –
 *   at most `PLANNED_SHOWN`. A patch version in development or planned is one of them, like any
 *   other version. Their issues are listed open first (the furthest on the project board first),
 *   then done.
 *   A version whose publish issue ("Publish 1.1.1", a parent issue) is "In review" on the board
 *   shows "In review" instead: it waits for the stores (#354).
 * - Later: open `enhancement` issues without a milestone, except the website's own (`website`)
 *   and internal ones (`internal`). With `PLANNED_SHOWN` planned versions the timeline is full and
 *   "Later" would wrap to a line of its own, so it is a section below the timeline instead of a
 *   step of it.
 *
 * Only the main features show: a sub-issue is left out when its parent issue is listed in the same
 * place (the same milestone, or "Later"), and doesn't count for the milestone's progress either.
 * That holds for a hidden parent too, so the sub-issues of an internal issue (e.g. the demo mode)
 * are hidden with it.
 */

export interface RoadmapIssue {
  number: number;
  title: string;
  url: string;
  /** Closed: shown as done. */
  done?: boolean;
}

export interface RoadmapMilestone {
  title: string;
  url: string;
  /** ISO date (YYYY-MM-DD); missing for a milestone without a due date. */
  dueOn?: string;
  description: string;
  open: number;
  done: number;
  /** Open issues first, the furthest on the board first, then the most recently done. */
  issues: RoadmapIssue[];
  /** Done issues that aren't listed. */
  moreDone: number;
  /**
   * Waiting for the stores (#354): its publish issue – a parent issue with "Publish" in its title,
   * e.g. "Publish 1.1.1" – is "In review" on the project board.
   */
  inReview?: boolean;
}

/** A finished patch version of the live version, e.g. 1.1.1 of 1.1.0. */
export interface RoadmapPatch {
  /** e.g. "1.1.1", without the "v". */
  version: string;
  /** The description of its milestone. */
  description: string;
}

/** The current, released version of the extension. */
export interface RoadmapRelease {
  /** e.g. "1.0.0", without the tag's "v". */
  version: string;
  /** The GitHub release (its notes); missing for the fallback from package.json. */
  url?: string;
  /** ISO date (YYYY-MM-DD) of the release; missing for the fallback. */
  publishedOn?: string;
  /** For a patch version: its minor or major version, e.g. "1.1.0" of "1.1.1". */
  baseVersion?: string;
  /** For a patch version: when its minor or major version was released. */
  basePublishedOn?: string;
  /** For a patch version: the finished patches, the newest first. */
  patches?: RoadmapPatch[];
  /** The main issues of its (minor or major version's) milestone, the biggest first. */
  highlights?: RoadmapIssue[];
  /** Main issues of that milestone that aren't listed. */
  moreHighlights?: number;
}

export interface Roadmap {
  release: RoadmapRelease;
  /** The planned versions, at most `PLANNED_SHOWN`, the next first. */
  milestones: RoadmapMilestone[];
  later: RoadmapIssue[];
  /** Whether the open issues are ordered by the project board. */
  fromBoard: boolean;
}

export const ROADMAP_SOURCE = {
  repository: 'exrelax/star-citizen-hangar-manager',
  /** The public project board (users/exrelax/projects/1) whose columns group the issues. */
  projectOwner: 'exrelax',
  projectNumber: 1,
  /** Open issues with this label and no milestone are listed under "Later" … */
  laterLabel: 'enhancement',
  /**
   * … except those with one of these labels. Issues with them never show anywhere on the roadmap:
   * the website's own issues and work for the project itself (release, demo mode).
   */
  excludedLabels: ['website', 'internal'],
};

/** The board's columns, the furthest last; issues in other columns count as "Backlog". */
const BOARD_COLUMNS = ['Backlog', 'Ready', 'In progress', 'In review'];
const IN_REVIEW = 'In review';
/** Planned versions shown on the timeline. */
export const PLANNED_SHOWN = 2;
/** Done issues listed per milestone, the most recently closed first. */
const DONE_LISTED = 20;
/** Main issues listed for the released version. */
const HIGHLIGHTS_LISTED = 5;

export interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  closed_at: string | null;
  labels: { name?: string }[];
  pull_request?: unknown;
  /** API URL of the parent issue, for a sub-issue. */
  parent_issue_url?: string | null;
  /** How many sub-issues it has, for a parent. */
  sub_issues_summary?: { total: number } | null;
}

interface GitHubMilestone {
  number: number;
  title: string;
  html_url: string;
  description: string | null;
  due_on: string | null;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
}

type Fetch = typeof fetch;

export interface FetchRoadmapOptions {
  /** `GITHUB_TOKEN` of the workflow; without it, only public data and no board columns. */
  token?: string;
  fetch?: Fetch;
  /** Called when something optional can't be read: the board, a release. */
  warn?: (message: string) => void;
  /** The version of package.json, shown if there is no GitHub release (or it can't be read). */
  fallbackVersion: string;
}

/** "v1.1.1" or "1.1.1" → [1, 1, 1]; undefined for a title that isn't a version. */
export function parseVersion(title: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(title.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** Orders versions, a title that isn't one after them. */
function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  if (!x || !y) return (x ? -1 : y ? 1 : 0) || a.localeCompare(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Loads milestones, issues and board columns from GitHub. Throws if GitHub can't be reached. */
export async function fetchRoadmap(options: FetchRoadmapOptions): Promise<Roadmap> {
  const { token, fetch: fetchImpl = fetch, warn = () => {}, fallbackVersion } = options;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  const api = `https://api.github.com/repos/${ROADMAP_SOURCE.repository}`;

  async function getAll<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const response = await fetchImpl(`${api}${path}${separator}per_page=100&page=${page}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(`GitHub API ${path}: ${response.status} ${response.statusText}`);
      }
      const items = (await response.json()) as T[];
      all.push(...items);
      if (items.length < 100) return all;
    }
  }

  // The latest release, i.e. the newest published one that is no draft and no pre-release.
  async function getRelease(): Promise<RoadmapRelease> {
    try {
      const response = await fetchImpl(`${api}/releases/latest`, { headers });
      if (response.status === 404) return { version: fallbackVersion };
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const release = (await response.json()) as GitHubRelease;
      return {
        version: release.tag_name.replace(/^v/, ''),
        url: release.html_url,
        publishedOn: release.published_at?.slice(0, 10),
      };
    } catch (error) {
      warn(`The latest release can't be read (${String(error)}): showing ${fallbackVersion}.`);
      return { version: fallbackVersion };
    }
  }

  // The day a version was released, for the minor or major version of a patch.
  async function getReleaseDate(version: string): Promise<string | undefined> {
    try {
      const response = await fetchImpl(`${api}/releases/tags/v${version}`, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return ((await response.json()) as GitHubRelease).published_at?.slice(0, 10);
    } catch (error) {
      warn(`The release of ${version} can't be read (${String(error)}): shown without its date.`);
      return undefined;
    }
  }

  const visible = (issue: GitHubIssue) =>
    !issue.pull_request &&
    !issue.labels.some((label) => ROADMAP_SOURCE.excludedLabels.includes(label.name ?? ''));

  /** Without the sub-issues whose parent is among `issues`: the parent stands for them. */
  const mainIssues = (issues: GitHubIssue[]) => {
    const listed = new Set(issues.map((issue) => `${api}/issues/${issue.number}`));
    return issues.filter((issue) => !issue.parent_issue_url || !listed.has(issue.parent_issue_url));
  };

  /**
   * The issues to show: first without the sub-issues of a parent in the same place, then without
   * the hidden ones – in this order, so a hidden parent takes its sub-issues along.
   */
  const shown = (issues: GitHubIssue[]) =>
    mainIssues(issues.filter((issue) => !issue.pull_request)).filter(visible);

  // The open milestones with issues: by due date, those without one by version after them.
  const open = await getAll<GitHubMilestone>('/milestones?state=open&sort=due_on');
  const issuesByMilestone = await Promise.all(
    open.map((milestone) => getAll<GitHubIssue>(`/issues?milestone=${milestone.number}&state=all`)),
  );
  const planned = open
    .map((milestone, index) => ({
      milestone,
      issues: shown(issuesByMilestone[index]!),
      // All of them: the publish issue is internal and never listed.
      all: issuesByMilestone[index]!,
    }))
    .filter(({ issues }) => issues.length > 0)
    .sort(
      ({ milestone: a }, { milestone: b }) =>
        (a.due_on && b.due_on ? a.due_on.localeCompare(b.due_on) : 0) ||
        (a.due_on ? -1 : b.due_on ? 1 : 0) ||
        compareVersions(a.title, b.title),
    )
    .slice(0, PLANNED_SHOWN);
  const later = await getAll<GitHubIssue>(
    `/issues?state=open&milestone=none&labels=${ROADMAP_SOURCE.laterLabel}`,
  );

  // The released version: for a patch, with its minor or major version and the finished patches.
  const release = await getRelease();
  const closed = await getAll<GitHubMilestone>(
    '/milestones?state=closed&sort=due_on&direction=desc',
  );
  const current = parseVersion(release.version);
  let highlightsOf = release.version;
  if (current && current[2] > 0) {
    const base = `${current[0]}.${current[1]}.0`;
    highlightsOf = base;
    release.baseVersion = base;
    release.basePublishedOn = await getReleaseDate(base);
    const patches = closed
      .map((milestone) => ({ milestone, version: parseVersion(milestone.title) }))
      .filter(
        ({ version }) =>
          version &&
          version[0] === current[0] &&
          version[1] === current[1] &&
          version[2] > 0 &&
          version[2] <= current[2],
      )
      .sort((a, b) => b.version![2] - a.version![2])
      .map(({ milestone }) => ({
        version: milestone.title.replace(/^v/, ''),
        description: milestone.description?.trim() ?? '',
      }));
    // The live patch is listed even if its milestone is missing.
    if (!patches.some((patch) => patch.version === release.version)) {
      patches.unshift({ version: release.version, description: '' });
    }
    release.patches = patches;
  }
  const releasedMilestone = closed.find(
    (milestone) => milestone.title.replace(/^v/, '') === highlightsOf,
  );
  if (releasedMilestone) {
    const released = shown(
      await getAll<GitHubIssue>(`/issues?milestone=${releasedMilestone.number}&state=closed`),
    ).sort(
      (a, b) =>
        (b.sub_issues_summary?.total ?? 0) - (a.sub_issues_summary?.total ?? 0) ||
        a.number - b.number,
    );
    release.highlights = released
      .slice(0, HIGHLIGHTS_LISTED)
      .map((issue) => ({ ...toIssue(issue), done: true }));
    release.moreHighlights = Math.max(0, released.length - HIGHLIGHTS_LISTED);
  }

  let columns: Map<number, string> | undefined;
  try {
    columns = token ? await fetchBoardColumns(token, fetchImpl) : undefined;
    if (!columns) warn('No token: the open issues are listed by number.');
  } catch (error) {
    warn(`The project board can't be read (${String(error)}): open issues listed by number.`);
  }

  return {
    release,
    fromBoard: columns !== undefined,
    milestones: planned.map(({ milestone, issues, all }) => ({
      ...toMilestone(milestone, issues, columns),
      ...(isInReview(all, columns) && { inReview: true }),
    })),
    later: shown(later)
      .sort((a, b) => a.number - b.number)
      .map(toIssue),
  };
}

/** A parent issue whose title says "Publish", e.g. "Publish 1.1.1" (#351). */
export const isPublishIssue = (issue: GitHubIssue) =>
  !issue.pull_request &&
  /\bpublish\b/i.test(issue.title) &&
  (issue.sub_issues_summary?.total ?? 0) > 0;

/** Whether a milestone's publish issue is "In review" on the board; never without the board. */
export function isInReview(
  issues: GitHubIssue[],
  columns: Map<number, string> | undefined,
): boolean {
  return issues.some((issue) => isPublishIssue(issue) && columns?.get(issue.number) === IN_REVIEW);
}

/** The board column of every issue of the repository on the project board, by issue number. */
async function fetchBoardColumns(token: string, fetchImpl: Fetch): Promise<Map<number, string>> {
  const query = `query($owner: String!, $number: Int!, $after: String) {
    user(login: $owner) {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
            content { ... on Issue { number repository { nameWithOwner } } }
          }
        }
      }
    }
  }`;
  const columns = new Map<number, string>();
  for (let after: string | null = null; ;) {
    const response = await fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          owner: ROADMAP_SOURCE.projectOwner,
          number: ROADMAP_SOURCE.projectNumber,
          after,
        },
      }),
    });
    const result = (await response.json()) as BoardResponse;
    const items = result.data?.user?.projectV2?.items;
    if (!response.ok || !items) {
      throw new Error(result.errors?.[0]?.message ?? `${response.status} ${response.statusText}`);
    }
    for (const node of items.nodes) {
      const issue = node.content;
      if (issue?.number && issue.repository?.nameWithOwner === ROADMAP_SOURCE.repository) {
        columns.set(issue.number, node.status?.name ?? '');
      }
    }
    if (!items.pageInfo.hasNextPage) return columns;
    after = items.pageInfo.endCursor;
  }
}

interface BoardResponse {
  data?: {
    user?: {
      projectV2?: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            status: { name?: string } | null;
            content: { number?: number; repository?: { nameWithOwner: string } } | null;
          }[];
        };
      } | null;
    } | null;
  };
  errors?: { message: string }[];
}

function toMilestone(
  milestone: GitHubMilestone,
  issues: GitHubIssue[],
  columns: Map<number, string> | undefined,
): RoadmapMilestone {
  // The furthest column first; a column that isn't one of the board's counts as "Backlog".
  const rank = (issue: GitHubIssue) =>
    Math.max(0, BOARD_COLUMNS.indexOf(columns?.get(issue.number) ?? ''));
  const open = issues
    .filter((issue) => issue.state !== 'closed')
    .sort((a, b) => rank(b) - rank(a) || a.number - b.number);
  const done = issues
    .filter((issue) => issue.state === 'closed')
    .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));
  return {
    title: milestone.title,
    url: milestone.html_url,
    ...(milestone.due_on && { dueOn: milestone.due_on.slice(0, 10) }),
    description: milestone.description?.trim() ?? '',
    open: open.length,
    done: done.length,
    issues: [
      ...open.map(toIssue),
      ...done.slice(0, DONE_LISTED).map((issue) => ({ ...toIssue(issue), done: true })),
    ],
    moreDone: Math.max(0, done.length - DONE_LISTED),
  };
}

function toIssue(issue: GitHubIssue): RoadmapIssue {
  return { number: issue.number, title: issue.title, url: issue.html_url };
}

/** Where an idea for "Later" is shared. */
const IDEAS_URL = `https://github.com/${ROADMAP_SOURCE.repository}/discussions/categories/ideas`;
/** What "Later" is. */
const LATER_TEXT = 'Ideas from the backlog – not planned for a version yet.';

/** An icon of the page's sprite (see site/icons.ts). */
const icon = (name: string) =>
  `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

/**
 * The roadmap as HTML, for the `<!-- roadmap -->` placeholder in index.html: the live version and
 * the planned ones as steps of one timeline, then "Later" – as a step too while the timeline has
 * room for it, else as a section of its own below it.
 */
export function renderRoadmap(roadmap: Roadmap): string {
  const laterApart = roadmap.milestones.length >= PLANNED_SHOWN;
  const steps = [
    renderLive(roadmap.release),
    ...roadmap.milestones.map((milestone, index) => renderMilestone(milestone, index === 0)),
    ...(roadmap.later.length && !laterApart ? [renderLaterStep(roadmap.later)] : []),
  ];
  const timeline = `<ol class="roadmap-steps" aria-label="Versions" style="--roadmap-columns: ${steps.length}">${steps.join('')}</ol>`;
  const later = roadmap.later.length && laterApart ? renderLaterSection(roadmap.later) : '';
  const nothingPlanned =
    roadmap.milestones.length || roadmap.later.length
      ? ''
      : '<p class="muted roadmap-empty">Nothing planned at the moment.</p>';
  return `${timeline}${later}${nothingPlanned}`;
}

/** One step of the timeline: its dot and its line to the next one, and its card. */
function renderStep(className: string, id: string, body: string): string {
  return `<li class="roadmap-step ${className}">
    <div class="roadmap-rail" aria-hidden="true"><span class="roadmap-line"></span><span class="roadmap-dot"></span></div>
    <article class="roadmap-card" aria-labelledby="${id}">${body}</article>
  </li>`;
}

/** A card's title with its badge, and the line below it. */
function renderHead(id: string, title: string, badge: string, meta?: string): string {
  return `<div class="roadmap-head">
    <div class="roadmap-heading"><h3 id="${id}">${escape(title)}</h3><span class="roadmap-badge">${escape(badge)}</span></div>
    ${meta ? `<p class="roadmap-meta">${escape(meta)}</p>` : ''}
  </div>`;
}

function renderCardLink(url: string, text: string): string {
  return `<a class="roadmap-link" href="${escape(url)}">${escape(text)} ${icon('arrow-right')}</a>`;
}

/** The id of a card's title, e.g. "roadmap-v1-1-0". */
export const idOf = (name: string) => `roadmap-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/**
 * The live version as the first step, with the issues that went into it. A patch version shows
 * its finished patches, and the highlights of its minor or major version.
 */
function renderLive(release: RoadmapRelease): string {
  const title = `v${release.version}`;
  const id = idOf(title);
  const base = release.baseVersion;
  const meta = base
    ? `v${base} released${release.basePublishedOn ? ` ${formatDate(release.basePublishedOn)}` : ''}`
    : release.publishedOn && `Released ${formatDate(release.publishedOn)}`;
  const patches = release.patches ?? [];
  const highlights = release.highlights ?? [];
  const more = release.moreHighlights
    ? release.url
      ? 'and more in the release notes'
      : `+ ${release.moreHighlights} more`
    : '';
  return renderStep(
    'is-live',
    id,
    `${renderHead(id, title, 'Live', meta || undefined)}
    ${patches.length ? renderPatches(patches) : ''}
    ${base && highlights.length ? `<p class="roadmap-label">Highlights of v${escape(base)}</p>` : ''}
    ${highlights.length ? renderIssues(highlights) : ''}
    ${more ? `<p class="roadmap-more">${escape(more)}</p>` : ''}
    ${release.url ? renderCardLink(release.url, 'Release notes') : ''}`,
  );
}

/** The finished patches of the live version: their version and their milestone's description. */
function renderPatches(patches: RoadmapPatch[]): string {
  const items = patches
    .map(
      (patch) =>
        `<li><span class="roadmap-patch-version">v${escape(patch.version)}</span><span class="roadmap-patch-text">${escape(plainText(patch.description))}</span></li>`,
    )
    .join('');
  return `<div class="roadmap-patches"><p class="roadmap-label">Patches</p><ol>${items}</ol></div>`;
}

function renderMilestone(milestone: RoadmapMilestone, next: boolean): string {
  const id = idOf(milestone.title);
  const total = milestone.open + milestone.done;
  const percent = total ? Math.round((milestone.done / total) * 100) : 0;
  const meta = milestone.dueOn ? `Due ${formatDate(milestone.dueOn)}` : 'No date yet';
  const [step, badge] = milestone.inReview
    ? ['is-review', 'In review']
    : next
      ? ['is-next', 'Next']
      : ['is-planned', 'Planned'];
  return renderStep(
    step,
    id,
    `${renderHead(id, milestone.title, badge, meta)}
    <div class="roadmap-progress-block">
      <span class="roadmap-progress" role="progressbar" aria-label="${escape(milestone.title)}: ${milestone.done} of ${total} done"
        aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${milestone.done}"><span style="width: ${percent}%"></span></span>
      <span class="roadmap-progress-text">${milestone.done} of ${total} done</span>
    </div>
    ${renderIssues(milestone.issues)}
    ${milestone.moreDone ? `<p class="roadmap-more">+ ${milestone.moreDone} more done</p>` : ''}
    ${renderCardLink(milestone.url, 'Milestone on GitHub')}`,
  );
}

/** "Later" as the last step of the timeline. */
function renderLaterStep(later: RoadmapIssue[]): string {
  const id = 'roadmap-later';
  return renderStep(
    'is-later',
    id,
    `${renderHead(id, 'Later', 'Ideas', LATER_TEXT)}
    ${renderIssues(later, 'lightbulb')}
    ${renderCardLink(IDEAS_URL, 'Share an idea')}`,
  );
}

/** "Later" below a full timeline, apart from it: its ideas as chips. */
function renderLaterSection(later: RoadmapIssue[]): string {
  const chips = later
    .map(
      (issue) =>
        `<li><a class="roadmap-chip" href="${escape(issue.url)}">${escape(issue.title)}<span class="roadmap-number">#${issue.number}</span></a></li>`,
    )
    .join('');
  return `<section class="roadmap-later" aria-labelledby="roadmap-later">
    <div class="roadmap-later-intro">
      <h3 id="roadmap-later">${icon('lightbulb')}Later</h3>
      <p>${escape(LATER_TEXT)}</p>
      ${renderCardLink(IDEAS_URL, 'Share an idea')}
    </div>
    <ul class="roadmap-chips">${chips}</ul>
  </section>`;
}

/** A list of issues: done ones checked, open ones as a circle, or all with `symbol`. */
function renderIssues(issues: RoadmapIssue[], symbol?: string): string {
  const items = issues
    .map((issue) => {
      const name = symbol ?? (issue.done ? 'circle-check' : 'circle');
      return `<li><a class="roadmap-issue${issue.done ? ' is-done' : ''}" href="${escape(issue.url)}">${icon(name)}<span class="roadmap-title">${escape(issue.title)}</span><span class="roadmap-number">#${issue.number}</span></a></li>`;
    })
    .join('');
  return `<ul class="roadmap-list">${items}</ul>`;
}

/** The current version for the hero, e.g. "v1.0.0", linked to its release notes. */
export function renderVersion(release: RoadmapRelease): string {
  const text = `v${escape(release.version)}`;
  const date = release.publishedOn ? ` · ${escape(formatDate(release.publishedOn))}` : '';
  return release.url
    ? `<a class="version-badge" href="${escape(release.url)}" title="Release notes of version ${escape(release.version)}">${text}${date}</a>`
    : `<span class="version-badge">${text}</span>`;
}

/** "2026-11-12" → "November 12, 2026". */
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** A milestone's description, written in Markdown on GitHub, as one line of text. */
function plainText(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .join(' ');
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
