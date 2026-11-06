// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fetchRoadmap, renderRoadmap, type Roadmap } from './roadmap.ts';

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
    // Pull requests and the website's own issues never show.
    issue(40, { pull_request: {} }),
    issue(25, { labels: [{ name: 'website' }] }),
  ],
  2: [issue(20)],
  4: [issue(26, { labels: [{ name: 'website' }] })],
};

const LATER = [
  issue(11),
  issue(5),
  issue(22, { labels: [{ name: 'enhancement' }, { name: 'website' }] }),
];

/** Fake GitHub: REST answers by URL, the GraphQL board by `board`. */
function github(board?: { status: Record<number, string> } | 'denied') {
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
    if (path === '/milestones?state=open&sort=due_on') return json(MILESTONES);
    if (path === '/issues?state=open&milestone=none&labels=enhancement') return json(LATER);
    const milestone = /^\/issues\?milestone=(\d+)&state=all$/.exec(path)?.[1];
    if (milestone) return json(ISSUES[Number(milestone)] ?? []);
    return json({ message: 'Not Found' }, 404);
  });
}

describe('fetchRoadmap', () => {
  it('groups into open and done without a token, and leaves out what is not planned', async () => {
    const warn = vi.fn();
    const roadmap = await fetchRoadmap({ fetch: github() as typeof fetch, warn });

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
  });

  it('groups by the columns of the project board when the token can read it', async () => {
    const roadmap = await fetchRoadmap({
      token: 'token',
      // Closed is done whatever the column says; unknown columns (e.g. Inbox) count as backlog.
      fetch: github({ status: { 1: 'In progress', 3: 'Inbox', 6: 'In review' } }) as typeof fetch,
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
    });

    expect(roadmap.fromBoard).toBe(false);
    expect(warn.mock.calls[0]![0]).toContain('Resource not accessible');
    expect(roadmap.milestones[0]!.groups.map((group) => group.status)).toEqual(['Open', 'Done']);
  });

  it('fails if GitHub answers with an error, instead of returning an empty roadmap', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(fetchRoadmap({ fetch: fetchImpl as typeof fetch })).rejects.toThrow('503');
  });
});

describe('renderRoadmap', () => {
  const roadmap: Roadmap = {
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
    ],
    later: [{ number: 5, title: 'Statistics "tab"', url: 'u5' }],
  };

  it('renders the milestones with progress, issues and the later ideas', () => {
    const html = renderRoadmap(roadmap);
    const page = new DOMParser().parseFromString(html, 'text/html');

    expect(page.querySelector('h3')?.textContent).toBe('Version 1.1.0');
    expect(page.querySelector('.roadmap-meta')?.textContent).toBe(
      'Due November 12, 2026 · 1 of 4 done',
    );
    expect(page.querySelector('.roadmap-description p')?.textContent).toBe('For the IAE:');
    expect(
      [...page.querySelectorAll('.roadmap-description li')].map((li) => li.textContent),
    ).toEqual(['Warbond CCUs', 'Discounts']);
    expect(page.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    // Titles are escaped, not markup.
    expect(page.querySelector('.roadmap-issue')?.textContent).toBe('Export <CSV> #1');
    expect(html).not.toContain('<CSV>');
    expect(page.querySelector('.roadmap-group .muted')?.textContent).toBe('+ 4 more done');
    expect(page.querySelector('.roadmap-chip')?.textContent).toBe('Statistics "tab" #5');
  });

  it('says so when nothing is planned', () => {
    expect(renderRoadmap({ fromBoard: false, milestones: [], later: [] })).toContain(
      'Nothing planned',
    );
  });
});
