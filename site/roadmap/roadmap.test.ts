// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fetchRoadmap, renderRoadmap, renderVersion, type Roadmap } from './roadmap.ts';

const REPO = 'https://api.github.com/repos/exrelax/star-citizen-hangar-manager';

const issue = (number: number, overrides: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/exrelax/star-citizen-hangar-manager/issues/${number}`,
  state: 'open',
  closed_at: null,
  labels: [],
  ...overrides,
});

const closed = (number: number, closedAt: string) =>
  issue(number, { state: 'closed', closed_at: closedAt });

/** A sub-issue of `parent`, as GitHub's API names its parent. */
const sub = (number: number, parent: number, overrides: Record<string, unknown> = {}) =>
  issue(number, { parent_issue_url: `${REPO}/issues/${parent}`, ...overrides });

const MILESTONES = [
  {
    number: 2,
    title: 'v1.2.0',
    html_url: 'https://github.com/m/2',
    description: null,
    due_on: '2027-01-15T08:00:00Z',
  },
  {
    number: 1,
    title: 'v1.1.0',
    html_url: 'https://github.com/m/1',
    description: 'For the IAE',
    due_on: '2026-11-12T08:00:00Z',
  },
  // Without a due date, or without issues: not on the timeline.
  { number: 3, title: 'Someday', html_url: '', description: null, due_on: null },
  {
    number: 4,
    title: 'v2.0.0',
    html_url: '',
    description: null,
    due_on: '2027-06-01T08:00:00Z',
  },
];

const ISSUES: Record<number, unknown[]> = {
  1: [
    issue(3),
    issue(1),
    closed(6, '2026-11-06T10:00:00Z'),
    closed(13, '2026-11-06T12:00:00Z'),
    // Pull requests, the website's own issues and internal ones never show.
    issue(40, { pull_request: {} }),
    issue(25, { labels: [{ name: 'website' }] }),
    issue(41, { labels: [{ name: 'internal' }] }),
    // The sub-issues of a hidden issue go with it (the demo mode's).
    sub(42, 41),
    // Sub-issues of an issue of the same milestone: only their parent shows.
    sub(30, 3),
    sub(31, 6, { state: 'closed', closed_at: '2026-11-07T10:00:00Z' }),
  ],
  // A sub-issue whose parent is elsewhere (another milestone) shows on its own.
  2: [issue(20), sub(21, 1)],
  4: [issue(26, { labels: [{ name: 'website' }] })],
};

const LATER = [
  issue(11),
  issue(5),
  sub(12, 11),
  issue(22, { labels: [{ name: 'enhancement' }, { name: 'website' }] }),
  issue(23, { labels: [{ name: 'enhancement' }, { name: 'internal' }] }),
  sub(24, 23, { labels: [{ name: 'enhancement' }] }),
];

/** The milestone of the released version (closed), and the issues that went into it. */
const CLOSED_MILESTONES = [
  {
    number: 9,
    title: 'v1.0.0',
    html_url: 'https://github.com/m/9',
    description: null,
    due_on: null,
  },
  { number: 8, title: 'v0.9.0', html_url: '', description: null, due_on: null },
];
const RELEASED: unknown[] = [
  closed(50, '2026-11-01T10:00:00Z'),
  { ...closed(51, '2026-11-01T10:00:00Z'), sub_issues_summary: { total: 7 } },
  { ...closed(52, '2026-11-01T10:00:00Z'), sub_issues_summary: { total: 3 } },
  sub(53, 51, { state: 'closed' }),
  closed(54, '2026-11-01T10:00:00Z'),
  closed(55, '2026-11-01T10:00:00Z'),
  closed(56, '2026-11-01T10:00:00Z'),
  closed(57, '2026-11-01T10:00:00Z'),
  closed(58, '2026-11-01T10:00:00Z'),
  { ...closed(59, '2026-11-01T10:00:00Z'), labels: [{ name: 'internal' }] },
];

const RELEASE = {
  tag_name: 'v1.0.0',
  html_url: 'https://github.com/exrelax/star-citizen-hangar-manager/releases/tag/v1.0.0',
  published_at: '2026-11-05T00:28:43Z',
};

/**
 * Fake GitHub: REST answers by URL, the GraphQL board by `board`, the latest release by `release`
 * ('none': there is no release yet, 'error': the request fails).
 */
function github(
  board?: { status: Record<number, string> } | 'denied',
  release: typeof RELEASE | 'none' | 'error' = RELEASE,
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, statusText: status === 200 ? 'OK' : 'Error' });
    if (url === 'https://api.github.com/graphql') {
      if (board === 'denied' || !board) {
        return json({ errors: [{ message: 'Resource not accessible by integration' }] });
      }
      expect(JSON.parse(String(init?.body)).variables).toMatchObject({ owner: 'exrelax' });
      return json({
        data: {
          user: {
            projectV2: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: Object.entries(board.status).map(([number, name]) => ({
                  status: { name },
                  content: {
                    number: Number(number),
                    repository: { nameWithOwner: 'exrelax/star-citizen-hangar-manager' },
                  },
                })),
              },
            },
          },
        },
      });
    }
    const path = url.replace(REPO, '').replace(/[?&]per_page=100&page=\d+$/, '');
    if (path === '/releases/latest') {
      if (release === 'none') return json({ message: 'Not Found' }, 404);
      if (release === 'error') return json({ message: 'Server Error' }, 500);
      return json(release);
    }
    if (path === '/milestones?state=open&sort=due_on') return json(MILESTONES);
    if (path === '/milestones?state=closed&sort=due_on&direction=desc') {
      return json(CLOSED_MILESTONES);
    }
    if (path === '/issues?milestone=9&state=closed') return json(RELEASED);
    if (path === '/issues?state=open&milestone=none&labels=enhancement') return json(LATER);
    const milestone = /^\/issues\?milestone=(\d+)&state=all$/.exec(path)?.[1];
    if (milestone) return json(ISSUES[Number(milestone)] ?? []);
    return json({ message: 'Not Found' }, 404);
  });
}

describe('fetchRoadmap', () => {
  it('groups into open and done without a token, and leaves out what is not planned', async () => {
    const warn = vi.fn();
    const roadmap = await fetchRoadmap({
      fetch: github() as typeof fetch,
      warn,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    // By due date; without a due date or without (visible) issues, a milestone isn't shown.
    expect(roadmap.milestones.map((milestone) => milestone.title)).toEqual(['v1.1.0', 'v1.2.0']);
    const [next] = roadmap.milestones;
    expect(next).toMatchObject({ dueOn: '2026-11-12', description: 'For the IAE', open: 2 });
    expect(next!.groups.map((group) => [group.status, group.issues.map((i) => i.number)])).toEqual([
      ['Open', [1, 3]],
      // The most recently closed first.
      ['Done', [13, 6]],
    ]);
    expect(roadmap.later.map((entry) => entry.number)).toEqual([5, 11]);
    expect(roadmap.milestones[1]!.groups[0]!.issues.map((i) => i.number)).toEqual([20, 21]);
  });

  it('groups by the columns of the project board when the token can read it', async () => {
    const roadmap = await fetchRoadmap({
      token: 'token',
      // Closed is done whatever the column says; unknown columns (e.g. Inbox) count as backlog.
      fetch: github({ status: { 1: 'In progress', 3: 'Inbox', 6: 'In review' } }) as typeof fetch,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(true);
    expect(
      roadmap.milestones[0]!.groups.map((group) => [
        group.status,
        group.issues.map((i) => i.number),
      ]),
    ).toEqual([
      ['Backlog', [3]],
      ['In progress', [1]],
      ['Done', [13, 6]],
    ]);
  });

  it('falls back to open and done if the board can not be read', async () => {
    const warn = vi.fn();
    const roadmap = await fetchRoadmap({
      token: 'token',
      fetch: github('denied') as typeof fetch,
      warn,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(false);
    expect(warn.mock.calls[0]![0]).toContain('Resource not accessible');
    expect(roadmap.milestones[0]!.groups.map((group) => group.status)).toEqual(['Open', 'Done']);
  });

  it('fails if GitHub answers with an error, instead of returning an empty roadmap', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(
      fetchRoadmap({ fetch: fetchImpl as typeof fetch, fallbackVersion: '1.1.0' }),
    ).rejects.toThrow('503');
  });

  it('takes the current version from the latest release', async () => {
    const roadmap = await fetchRoadmap({
      fetch: github() as typeof fetch,
      fallbackVersion: '1.1.0',
    });
    expect(roadmap.release).toMatchObject({
      version: '1.0.0',
      url: RELEASE.html_url,
      publishedOn: '2026-11-05',
    });
  });

  it('lists the main issues of the released version, those with the most sub-issues first', async () => {
    const { release } = await fetchRoadmap({
      fetch: github() as typeof fetch,
      fallbackVersion: '1.1.0',
    });
    // Without its sub-issues and the hidden ones; five listed, the rest counted.
    expect(release.highlights?.map((entry) => entry.number)).toEqual([51, 52, 50, 54, 55]);
    expect(release.moreHighlights).toBe(3);
  });

  it("falls back to package.json's version without a release, or if it can't be read", async () => {
    const none = await fetchRoadmap({
      fetch: github(undefined, 'none') as typeof fetch,
      fallbackVersion: '1.1.0',
    });
    expect(none.release).toEqual({ version: '1.1.0' });

    const warn = vi.fn();
    const failed = await fetchRoadmap({
      fetch: github(undefined, 'error') as typeof fetch,
      warn,
      fallbackVersion: '1.1.0',
    });
    expect(failed.release).toEqual({ version: '1.1.0' });
    expect(warn.mock.calls.some(([message]) => String(message).includes('release'))).toBe(true);
  });
});

describe('renderRoadmap', () => {
  const roadmap: Roadmap = {
    release: {
      version: '1.0.0',
      url: 'https://github.com/r/1.0.0',
      publishedOn: '2026-11-05',
      highlights: [{ number: 3, title: 'Pledge Store tab', url: 'u3' }],
      moreHighlights: 2,
    },
    fromBoard: false,
    milestones: [
      {
        title: 'v1.1.0',
        url: 'https://github.com/m/1',
        dueOn: '2026-11-12',
        description: 'For the IAE:\n- Warbond CCUs\n- Discounts',
        open: 3,
        done: 1,
        groups: [
          { status: 'Open', issues: [{ number: 1, title: 'Export <CSV>', url: 'u1' }], more: 0 },
          { status: 'Done', issues: [{ number: 6, title: 'Locks', url: 'u6' }], more: 4 },
        ],
      },
      {
        title: 'v1.2.0',
        url: 'https://github.com/m/2',
        dueOn: '2027-01-15',
        description: '',
        open: 1,
        done: 0,
        groups: [{ status: 'Open', issues: [{ number: 7, title: 'Later', url: 'u7' }], more: 0 }],
      },
    ],
    later: [{ number: 5, title: 'Statistics "tab"', url: 'u5' }],
  };

  it('renders the released version, the milestones with progress and the later ideas', () => {
    const html = renderRoadmap(roadmap);
    const page = new DOMParser().parseFromString(html, 'text/html');
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/\s+/g, ' ').trim();

    // One step per card, in order: released, next, planned, later.
    const steps = [...page.querySelectorAll('.roadmap-step')];
    expect(steps.map((step) => step.className)).toEqual([
      'roadmap-step is-released',
      'roadmap-step is-next',
      'roadmap-step is-planned',
      'roadmap-step is-later',
    ]);
    const [released, next, planned, later] = steps;
    expect(text(released!.querySelector('h3'))).toBe('v1.0.0');
    expect(text(released!.querySelector('.roadmap-badge'))).toBe('Released');
    expect(text(released!.querySelector('.roadmap-meta'))).toBe('November 5, 2026');
    expect(text(released!.querySelector('.roadmap-issue'))).toBe('Pledge Store tab #3');
    expect(text(released!.querySelector('.roadmap-more'))).toBe('+ 2 more');
    expect(released!.querySelector('.roadmap-link')?.getAttribute('href')).toBe(
      'https://github.com/r/1.0.0',
    );

    expect(text(next!.querySelector('h3'))).toBe('v1.1.0');
    expect(text(next!.querySelector('.roadmap-badge'))).toBe('Next');
    expect(text(next!.querySelector('.roadmap-meta'))).toBe('Due November 12, 2026 · 1 of 4 done');
    expect(text(next!.querySelector('.roadmap-description p'))).toBe('For the IAE:');
    expect(
      [...next!.querySelectorAll('.roadmap-description li')].map((li) => li.textContent),
    ).toEqual(['Warbond CCUs', 'Discounts']);
    expect(next!.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    // Grouped by status; titles are escaped, not markup.
    const groups = [...next!.querySelectorAll('.roadmap-group')];
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['Open', 'Done']);
    expect(groups.map((group) => text(group.querySelector('.roadmap-count')))).toEqual(['1', '5']);
    expect(text(next!.querySelector('.roadmap-issue'))).toBe('Export <CSV> #1');
    expect(html).not.toContain('<CSV>');
    expect(text(next!.querySelector('.roadmap-more'))).toBe('+ 4 more done');
    expect(text(planned!.querySelector('.roadmap-badge'))).toBe('Planned');

    expect(text(later!.querySelector('h3'))).toBe('Later');
    expect(text(later!.querySelector('.roadmap-issue'))).toBe('Statistics "tab" #5');
    expect(later!.querySelector('.roadmap-link')?.getAttribute('href')).toContain(
      '/discussions/categories/ideas',
    );
    // Icons of the page's sprite, hidden from screen readers.
    expect(page.querySelector('.roadmap-issue use')?.getAttribute('href')).toBe('#icon-check');
    expect(page.querySelector('.roadmap-issue svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says so when nothing is planned', () => {
    const html = renderRoadmap({
      release: { version: '1.0.0' },
      fromBoard: false,
      milestones: [],
      later: [],
    });
    expect(html).toContain('Nothing planned');
    // The fallback from package.json: no date, no link.
    expect(html).toContain('v1.0.0');
    expect(html).not.toContain('Release notes');
  });
});

describe('renderVersion', () => {
  it('shows the version and date, linked to the release notes', () => {
    const html = renderVersion({
      version: '1.0.0',
      url: 'https://github.com/r/1.0.0',
      publishedOn: '2026-11-05',
    });
    const badge = new DOMParser().parseFromString(html, 'text/html').querySelector('a');
    expect(badge?.textContent).toBe('v1.0.0 · November 5, 2026');
    expect(badge?.getAttribute('href')).toBe('https://github.com/r/1.0.0');
  });

  it('shows only the version for the fallback from package.json', () => {
    expect(renderVersion({ version: '1.1.0' })).toBe('<span class="version-badge">v1.1.0</span>');
  });
});
