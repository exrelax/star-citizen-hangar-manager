/*
 * The roadmap of the website, built from the repository's GitHub issues when the site is built
 * (see site/vite.config.ts). Visitors' browsers never contact GitHub: the roadmap is plain HTML.
 *
 * - Released: the current version, the latest GitHub release (or the version of package.json if
 *   there is none), above the timeline; the hero shows it, too.
 * - Timeline: the open milestones with a due date and issues, by date, with their issues grouped
 *   by the column of the project board (or into "Open" and "Done" if the board can't be read).
 * - Later: open `enhancement` issues without a milestone, except the website's own
 *   (`website`) and internal ones (`internal`).
 *
 * Only the main features show: a sub-issue is left out when its parent issue is listed in the same
 * place (the same milestone, or "Later"), and doesn't count for the milestone's progress either.
 */

export interface RoadmapIssue {
  number: number;
  title: string;
  url: string;
}

export interface RoadmapGroup {
  /** The board column ("Backlog", "In progress", …), or "Open" / "Done" without the board. */
  status: string;
  issues: RoadmapIssue[];
  /** Issues of the group that aren't listed (only "Done" is shortened). */
  more: number;
}

export interface RoadmapMilestone {
  title: string;
  url: string;
  /** ISO date (YYYY-MM-DD). */
  dueOn: string;
  description: string;
  open: number;
  done: number;
  groups: RoadmapGroup[];
}

/** The current, released version of the extension. */
export interface RoadmapRelease {
  /** e.g. "1.0.0", without the tag's "v". */
  version: string;
  /** The GitHub release (its notes); missing for the fallback from package.json. */
  url?: string;
  /** ISO date (YYYY-MM-DD) of the release; missing for the fallback. */
  publishedOn?: string;
}

export interface Roadmap {
  release: RoadmapRelease;
  milestones: RoadmapMilestone[];
  later: RoadmapIssue[];
  /** Whether the groups come from the project board. */
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

/** The board's columns in their order; issues in other columns count as "Backlog". */
const BOARD_COLUMNS = ['Backlog', 'Ready', 'In progress', 'In review', 'Done'];
/** Done issues listed per milestone, the most recently closed first. */
const DONE_LISTED = 20;

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  closed_at: string | null;
  labels: { name?: string }[];
  pull_request?: unknown;
  /** API URL of the parent issue, for a sub-issue. */
  parent_issue_url?: string | null;
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
  /** Called when the board can't be read and the issues are grouped into open and done. */
  warn?: (message: string) => void;
  /** The version of package.json, shown if there is no GitHub release (or it can't be read). */
  fallbackVersion: string;
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

  const visible = (issue: GitHubIssue) =>
    !issue.pull_request &&
    !issue.labels.some((label) => ROADMAP_SOURCE.excludedLabels.includes(label.name ?? ''));

  /** Without the sub-issues whose parent is among `issues`: the parent stands for them. */
  const mainIssues = (issues: GitHubIssue[]) => {
    const listed = new Set(issues.map((issue) => `${api}/issues/${issue.number}`));
    return issues.filter((issue) => !issue.parent_issue_url || !listed.has(issue.parent_issue_url));
  };

  const milestones = (await getAll<GitHubMilestone>('/milestones?state=open&sort=due_on'))
    .filter((milestone) => milestone.due_on)
    .sort((a, b) => a.due_on!.localeCompare(b.due_on!));
  const issuesByMilestone = await Promise.all(
    milestones.map((milestone) =>
      getAll<GitHubIssue>(`/issues?milestone=${milestone.number}&state=all`),
    ),
  );
  const later = (
    await getAll<GitHubIssue>(
      `/issues?state=open&milestone=none&labels=${ROADMAP_SOURCE.laterLabel}`,
    )
  ).filter(visible);

  let columns: Map<number, string> | undefined;
  try {
    columns = token ? await fetchBoardColumns(token, fetchImpl) : undefined;
    if (!columns) warn('No token: the roadmap groups the issues into open and done.');
  } catch (error) {
    warn(`The project board can't be read (${String(error)}): grouped into open and done.`);
  }

  return {
    release: await getRelease(),
    fromBoard: columns !== undefined,
    milestones: milestones
      .map((milestone, index) =>
        toMilestone(milestone, mainIssues(issuesByMilestone[index]!.filter(visible)), columns),
      )
      .filter((milestone) => milestone.open + milestone.done > 0),
    later: mainIssues(later)
      .sort((a, b) => a.number - b.number)
      .map(toIssue),
  };
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
  // A closed issue is done, whatever its column says; an open one is never "Done".
  const statusOf = (issue: GitHubIssue) => {
    if (issue.state === 'closed') return 'Done';
    if (!columns) return 'Open';
    const column = columns.get(issue.number) ?? '';
    return BOARD_COLUMNS.includes(column) && column !== 'Done' ? column : 'Backlog';
  };
  const order = columns ? BOARD_COLUMNS : ['Open', 'Done'];
  const groups = order
    .map((status): RoadmapGroup => {
      const inGroup = issues.filter((issue) => statusOf(issue) === status);
      if (status === 'Done') {
        inGroup.sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));
        return {
          status,
          issues: inGroup.slice(0, DONE_LISTED).map(toIssue),
          more: Math.max(0, inGroup.length - DONE_LISTED),
        };
      }
      return { status, issues: inGroup.sort((a, b) => a.number - b.number).map(toIssue), more: 0 };
    })
    .filter((group) => group.issues.length > 0);
  const done = issues.filter((issue) => issue.state === 'closed').length;
  return {
    title: milestone.title,
    url: milestone.html_url,
    dueOn: milestone.due_on!.slice(0, 10),
    description: milestone.description?.trim() ?? '',
    open: issues.length - done,
    done,
    groups,
  };
}

function toIssue(issue: GitHubIssue): RoadmapIssue {
  return { number: issue.number, title: issue.title, url: issue.html_url };
}

/** Colors of the groups' dots, by status. */
const STATUS_COLORS: Record<string, string> = {
  Backlog: 'var(--site-text-faint)',
  Open: 'var(--site-text-faint)',
  Ready: 'var(--site-success)',
  'In progress': 'var(--site-warning)',
  'In review': 'var(--site-accent)',
  Done: 'var(--site-success)',
};

/** The roadmap as HTML, for the `<!-- roadmap -->` placeholder in index.html. */
export function renderRoadmap(roadmap: Roadmap): string {
  const released = renderRelease(roadmap.release);
  const milestones = roadmap.milestones.map(renderMilestone).join('');
  const later = roadmap.later.length
    ? `<div class="roadmap-step is-later">
        <span class="roadmap-dot" aria-hidden="true"></span>
        <div class="roadmap-body">
          <h3>Later</h3>
          <p class="muted">Ideas from the backlog, not planned for a version yet.</p>
          <ul class="roadmap-chips">${roadmap.later
            .map((issue) => `<li>${renderIssueLink(issue, 'roadmap-chip')}</li>`)
            .join('')}</ul>
        </div>
      </div>`
    : '';
  const nothingPlanned =
    milestones || later ? '' : '<p class="muted">Nothing planned at the moment.</p>';
  return `<div class="roadmap-timeline">${released}${milestones}${later}</div>${nothingPlanned}`;
}

/** The current version as the first step of the timeline, marked as released. */
function renderRelease(release: RoadmapRelease): string {
  const title = `Version ${escape(release.version)}`;
  const meta = [
    release.publishedOn && `Released ${escape(formatDate(release.publishedOn))}`,
    release.url && `<a href="${escape(release.url)}">Release notes</a>`,
  ].filter(Boolean);
  return `<div class="roadmap-step is-released">
    <span class="roadmap-dot" aria-hidden="true"></span>
    <div class="roadmap-body">
      <div class="roadmap-heading">
        <h3>${release.url ? `<a href="${escape(release.url)}">${title}</a>` : title}<span class="roadmap-released">Released</span></h3>
        ${meta.length ? `<span class="roadmap-meta">${meta.join(' · ')}</span>` : ''}
      </div>
    </div>
  </div>`;
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

function renderMilestone(milestone: RoadmapMilestone): string {
  const total = milestone.open + milestone.done;
  const percent = total ? Math.round((milestone.done / total) * 100) : 0;
  const due = formatDate(milestone.dueOn);
  // "v1.1.0" reads "Version 1.1.0"; other titles stay as they are.
  const title = milestone.title.replace(/^v(?=\d)/, 'Version ');
  return `<div class="roadmap-step">
    <span class="roadmap-dot" aria-hidden="true"></span>
    <div class="roadmap-body">
      <div class="roadmap-heading">
        <h3><a href="${escape(milestone.url)}">${escape(title)}</a></h3>
        <span class="roadmap-meta">Due ${escape(due)} · ${milestone.done} of ${total} done</span>
      </div>
      ${renderDescription(milestone.description)}
      <div class="roadmap-progress" role="progressbar" aria-label="${escape(title)} progress"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <span style="width: ${percent}%"></span>
      </div>
      <div class="roadmap-groups">${milestone.groups.map(renderGroup).join('')}</div>
    </div>
  </div>`;
}

/**
 * A milestone's description, written in Markdown on GitHub: its paragraphs and its lists
 * (lines starting with "- " or "* "); any other Markdown stays plain text.
 */
function renderDescription(description: string): string {
  if (!description) return '';
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${escape(paragraph.join(' '))}</p>`);
    if (list.length)
      blocks.push(`<ul>${list.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`);
    paragraph = [];
    list = [];
  };
  for (const line of description.split(/\r?\n/).map((text) => text.trim())) {
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (paragraph.length) flush();
      list.push(item[1]!);
    } else if (line) {
      if (list.length) flush();
      paragraph.push(line);
    } else {
      flush();
    }
  }
  flush();
  return `<div class="roadmap-description">${blocks.join('')}</div>`;
}

function renderGroup(group: RoadmapGroup): string {
  const color = STATUS_COLORS[group.status] ?? STATUS_COLORS.Backlog;
  const count = group.issues.length + group.more;
  return `<section class="roadmap-group card" aria-label="${escape(group.status)}">
    <h4><span class="roadmap-status" style="background: ${color}" aria-hidden="true"></span>${escape(group.status)}<span class="roadmap-count">${count}</span></h4>
    <ul>${group.issues.map((issue) => `<li>${renderIssueLink(issue, 'roadmap-issue')}</li>`).join('')}</ul>
    ${group.more ? `<p class="muted">+ ${group.more} more done</p>` : ''}
  </section>`;
}

function renderIssueLink(issue: RoadmapIssue, className: string): string {
  return `<a class="${className}" href="${escape(issue.url)}"><span>${escape(issue.title)}</span> <span class="roadmap-number">#${issue.number}</span></a>`;
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
