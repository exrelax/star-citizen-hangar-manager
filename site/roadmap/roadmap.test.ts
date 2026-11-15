// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  fetchRoadmap,
  renderRoadmap,
  renderVersion,
  type RoadmapMilestone,
  type RoadmapRelease,
} from './roadmap.ts';

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
  // Without issues (shown ones): not on the timeline.
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
    // The publish issue (#354), internal: never listed, its board status counts.
    issue(70, {
      title: 'Publish 1.1.0',
      labels: [{ name: 'internal' }],
      sub_issues_summary: { total: 2 },
    }),
    // "Publish" in the title, but no parent; a parent without "Publish".
    issue(71, { title: 'Publish the docs', labels: [{ name: 'internal' }] }),
    issue(72, {
      title: 'Release checks',
      labels: [{ name: 'internal' }],
      sub_issues_summary: { total: 3 },
    }),
  ],
  // A sub-issue whose parent is elsewhere (another milestone) shows on its own.
  2: [issue(20), sub(21, 1)],
  4: [issue(26, { labels: [{ name: 'website' }] })],
  5: [issue(27)],
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
  // A minor version with its patches, and a patch of another minor version.
  { number: 10, title: 'v1.1.0', html_url: '', description: null, due_on: null },
  {
    number: 11,
    title: 'v1.1.1',
    html_url: '',
    description: 'Error logs:\n- For connection errors to RSI',
    due_on: null,
  },
  { number: 12, title: 'v1.1.2', html_url: '', description: 'Fixes', due_on: null },
  { number: 13, title: 'v1.0.1', html_url: '', description: 'Old fixes', due_on: null },
];
const RELEASED_MINOR: unknown[] = [closed(60, '2026-11-13T10:00:00Z')];
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

/** A patch release: v1.1.1 of v1.1.0. */
const PATCH_RELEASE = {
  tag_name: 'v1.1.1',
  html_url: 'https://github.com/exrelax/star-citizen-hangar-manager/releases/tag/v1.1.1',
  published_at: '2026-11-15T09:00:00Z',
};
const MINOR_RELEASE = {
  ...PATCH_RELEASE,
  tag_name: 'v1.1.0',
  published_at: '2026-11-13T09:00:00Z',
};

/** A third open milestone, without a due date: after the dated ones, beyond the two shown. */
const UNDATED = {
  number: 5,
  title: 'v1.3.0',
  html_url: 'https://github.com/m/5',
  description: null,
  due_on: null,
};

/**
 * Fake GitHub: REST answers by URL, the GraphQL board by `board`, the latest release by `release`
 * ('none': there is no release yet, 'error': the request fails).
 */
function github(
  board?: { status: Record<number, string> } | 'denied',
  release: typeof RELEASE | 'none' | 'error' = RELEASE,
  open: unknown[] = [...MILESTONES, UNDATED],
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
    if (path === '/releases/tags/v1.1.0') return json(MINOR_RELEASE);
    if (path === '/milestones?state=open&sort=due_on') return json(open);
    if (path === '/milestones?state=closed&sort=due_on&direction=desc') {
      return json(CLOSED_MILESTONES);
    }
    if (path === '/issues?milestone=9&state=closed') return json(RELEASED);
    if (path === '/issues?milestone=10&state=closed') return json(RELEASED_MINOR);
    if (path === '/issues?state=open&milestone=none&labels=enhancement') return json(LATER);
    const milestone = /^\/issues\?milestone=(\d+)&state=all$/.exec(path)?.[1];
    if (milestone) return json(ISSUES[Number(milestone)] ?? []);
    return json({ message: 'Not Found' }, 404);
  });
}

describe('a version in review (#354)', () => {
  const inReview = async (status: Record<number, string> | undefined) =>
    (
      await fetchRoadmap({
        token: 'token',
        fetch: github(status && { status }) as typeof fetch,
        fallbackVersion: '1.1.0',
      })
    ).milestones.map((milestone) => milestone.inReview ?? false);

  it('is in review while its publish issue is "In review" on the board', async () => {
    expect(await inReview({ 70: 'In review' })).toEqual([true, false]);
  });

  it('is not before, nor for other parent issues or issues with "Publish" in the title', async () => {
    expect(await inReview({ 70: 'In progress' })).toEqual([false, false]);
    expect(await inReview({ 70: 'Done' })).toEqual([false, false]);
    expect(await inReview({ 71: 'In review', 72: 'In review' })).toEqual([false, false]);
  });

  it('is not without the board', async () => {
    expect(await inReview(undefined)).toEqual([false, false]);
  });
});

describe('fetchRoadmap', () => {
  const numbers = (issues: { number: number; done?: boolean }[]) =>
    issues.map((entry) => (entry.done ? `${entry.number} done` : String(entry.number)));

  it('lists the next two planned versions, open issues first, and leaves out what is not planned', async () => {
    const warn = vi.fn();
    const roadmap = await fetchRoadmap({
      fetch: github() as typeof fetch,
      warn,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    // By due date, at most two; without (shown) issues a milestone isn't planned.
    expect(roadmap.milestones.map((milestone) => milestone.title)).toEqual(['v1.1.0', 'v1.2.0']);
    const [next] = roadmap.milestones;
    expect(next).toMatchObject({
      dueOn: '2026-11-12',
      description: 'For the IAE',
      open: 2,
      done: 2,
    });
    // Open by number, then done, the most recently closed first.
    expect(numbers(next!.issues)).toEqual(['1', '3', '13 done', '6 done']);
    expect(roadmap.later.map((entry) => entry.number)).toEqual([5, 11]);
    expect(numbers(roadmap.milestones[1]!.issues)).toEqual(['20', '21']);
  });

  it('plans a milestone without a due date after the dated ones', async () => {
    const roadmap = await fetchRoadmap({
      fetch: github(undefined, RELEASE, [UNDATED, MILESTONES[0]]) as typeof fetch,
      fallbackVersion: '1.1.0',
    });
    expect(roadmap.milestones.map((milestone) => [milestone.title, milestone.dueOn])).toEqual([
      ['v1.2.0', '2027-01-15'],
      ['v1.3.0', undefined],
    ]);
  });

  it('lists the open issues the furthest on the project board first, if the token can read it', async () => {
    const roadmap = await fetchRoadmap({
      token: 'token',
      // Unknown columns (e.g. Inbox) count as backlog.
      fetch: github({ status: { 1: 'Ready', 3: 'In review', 6: 'In progress' } }) as typeof fetch,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(true);
    expect(numbers(roadmap.milestones[0]!.issues)).toEqual(['3', '1', '13 done', '6 done']);
  });

  it('lists the open issues by number if the board can not be read', async () => {
    const warn = vi.fn();
    const roadmap = await fetchRoadmap({
      token: 'token',
      fetch: github('denied') as typeof fetch,
      warn,
      fallbackVersion: '1.1.0',
    });

    expect(roadmap.fromBoard).toBe(false);
    expect(warn.mock.calls[0]![0]).toContain('Resource not accessible');
    expect(numbers(roadmap.milestones[0]!.issues)).toEqual(['1', '3', '13 done', '6 done']);
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
    expect(release.highlights?.every((entry) => entry.done)).toBe(true);
    expect(release.moreHighlights).toBe(3);
    expect(release.patches).toBeUndefined();
  });

  it('shows a patch version with its finished patches and the highlights of its minor version', async () => {
    const { release } = await fetchRoadmap({
      fetch: github(undefined, PATCH_RELEASE) as typeof fetch,
      fallbackVersion: '1.1.0',
    });
    expect(release).toMatchObject({
      version: '1.1.1',
      publishedOn: '2026-11-15',
      baseVersion: '1.1.0',
      basePublishedOn: '2026-11-13',
      // Up to the live version, of its minor version only.
      patches: [{ version: '1.1.1', description: 'Error logs:\n- For connection errors to RSI' }],
    });
    expect(release.highlights?.map((entry) => entry.number)).toEqual([60]);
  });

  it("falls back to package.json's version without a release, or if it can't be read", async () => {
    const none = await fetchRoadmap({
      fetch: github(undefined, 'none') as typeof fetch,
      fallbackVersion: '0.5.0',
    });
    expect(none.release).toEqual({ version: '0.5.0' });

    const warn = vi.fn();
    const failed = await fetchRoadmap({
      fetch: github(undefined, 'error') as typeof fetch,
      warn,
      fallbackVersion: '0.5.0',
    });
    expect(failed.release).toEqual({ version: '0.5.0' });
    expect(warn.mock.calls.some(([message]) => String(message).includes('release'))).toBe(true);
  });
});

describe('renderRoadmap', () => {
  const live: RoadmapRelease = {
    version: '1.1.1',
    url: 'https://github.com/r/1.1.1',
    publishedOn: '2026-11-15',
    baseVersion: '1.1.0',
    basePublishedOn: '2026-11-13',
    patches: [{ version: '1.1.1', description: 'Error logs:\n- For RSI' }],
    highlights: [{ number: 3, title: 'Pledge Store tab', url: 'u3', done: true }],
    moreHighlights: 2,
  };
  const next: RoadmapMilestone = {
    title: 'v1.2.0',
    url: 'https://github.com/m/2',
    dueOn: '2026-11-20',
    description: 'Not shown',
    open: 3,
    done: 1,
    issues: [
      { number: 1, title: 'Export <CSV>', url: 'u1' },
      { number: 6, title: 'Locks', url: 'u6', done: true },
    ],
    moreDone: 0,
  };
  const planned: RoadmapMilestone = {
    title: 'v1.3.0',
    url: 'https://github.com/m/3',
    description: '',
    open: 1,
    done: 0,
    issues: [{ number: 7, title: 'Statistics', url: 'u7' }],
    moreDone: 0,
  };
  const later = [{ number: 5, title: 'Paint packs "soon"', url: 'u5' }];

  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
  const text = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim();
  const steps = (page: Document) =>
    [...page.querySelectorAll('.roadmap-steps > .roadmap-step')].map((step) => step.className);

  it('shows a patch version inside the live card, with the highlights of its minor version', () => {
    const page = parse(renderRoadmap({ release: live, fromBoard: false, milestones: [], later }));
    const card = page.querySelector('.is-live')!;
    expect(text(card.querySelector('h3'))).toBe('v1.1.1');
    expect(text(card.querySelector('.roadmap-badge'))).toBe('Live');
    expect(text(card.querySelector('.roadmap-meta'))).toBe('v1.1.0 released November 13, 2026');
    // The patch: only its version and its milestone's description.
    expect(text(card.querySelector('.roadmap-patches li'))).toBe('v1.1.1Error logs: For RSI');
    expect([...card.querySelectorAll('.roadmap-label')].map((label) => label.textContent)).toEqual([
      'Patches',
      'Highlights of v1.1.0',
    ]);
    expect(text(card.querySelector('.roadmap-issue'))).toBe('Pledge Store tab#3');
    expect(card.querySelector('.roadmap-issue use')?.getAttribute('href')).toBe(
      '#icon-circle-check',
    );
    expect(text(card.querySelector('.roadmap-more'))).toBe('and more in the release notes');
    expect(card.querySelector('.roadmap-link')?.getAttribute('href')).toBe(
      'https://github.com/r/1.1.1',
    );
  });

  it('shows a minor version without patches', () => {
    const page = parse(
      renderRoadmap({
        release: { version: '1.1.0', url: 'r', publishedOn: '2026-11-13' },
        fromBoard: false,
        milestones: [],
        later,
      }),
    );
    const card = page.querySelector('.is-live')!;
    expect(text(card.querySelector('.roadmap-meta'))).toBe('Released November 13, 2026');
    expect(card.querySelector('.roadmap-patches, .roadmap-label')).toBeNull();
  });

  it('shows the planned versions with their progress and issues', () => {
    const html = renderRoadmap({
      release: live,
      fromBoard: false,
      milestones: [next, planned],
      later,
    });
    const page = parse(html);
    const [, first, second] = [...page.querySelectorAll('.roadmap-step')];
    expect(text(first!.querySelector('.roadmap-badge'))).toBe('Next');
    expect(text(first!.querySelector('.roadmap-meta'))).toBe('Due November 20, 2026');
    const progress = first!.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('1');
    expect(progress?.getAttribute('aria-valuemax')).toBe('4');
    expect(text(first!.querySelector('.roadmap-progress-text'))).toBe('1 of 4 done');
    // Open as a circle, done checked; titles are escaped, not markup.
    expect(
      [...first!.querySelectorAll('.roadmap-issue use')].map((use) => use.getAttribute('href')),
    ).toEqual(['#icon-circle', '#icon-circle-check']);
    expect(text(first!.querySelector('.roadmap-issue'))).toBe('Export <CSV>#1');
    expect(html).not.toContain('<CSV>');
    expect(html).not.toContain('Not shown');
    expect(text(second!.querySelector('.roadmap-badge'))).toBe('Planned');
    expect(text(second!.querySelector('.roadmap-meta'))).toBe('No date yet');
  });

  it('puts "Later" apart from a full timeline of two planned versions', () => {
    const page = parse(
      renderRoadmap({ release: live, fromBoard: false, milestones: [next, planned], later }),
    );
    expect(steps(page)).toEqual([
      'roadmap-step is-live',
      'roadmap-step is-next',
      'roadmap-step is-planned',
    ]);
    expect(page.querySelector('.roadmap-steps')?.getAttribute('style')).toContain(
      '--roadmap-columns: 3',
    );
    const section = page.querySelector('section.roadmap-later')!;
    expect(text(section.querySelector('h3'))).toBe('Later');
    expect(text(section.querySelector('.roadmap-chip'))).toBe('Paint packs "soon"#5');
    expect(section.querySelector('.roadmap-link')?.getAttribute('href')).toContain(
      '/discussions/categories/ideas',
    );
  });

  it('shows a version in review instead of "Next" (#354)', () => {
    const page = parse(
      renderRoadmap({
        release: live,
        fromBoard: true,
        milestones: [{ ...next, inReview: true }, planned],
        later,
      }),
    );
    expect(steps(page)).toEqual([
      'roadmap-step is-live',
      'roadmap-step is-review',
      'roadmap-step is-planned',
    ]);
    expect(text(page.querySelector('.is-review .roadmap-badge'))).toBe('In review');
  });

  it('keeps "Later" on the timeline next to one planned version', () => {
    const page = parse(
      renderRoadmap({ release: live, fromBoard: false, milestones: [next], later }),
    );
    expect(steps(page)).toEqual([
      'roadmap-step is-live',
      'roadmap-step is-next',
      'roadmap-step is-later',
    ]);
    expect(page.querySelector('section.roadmap-later')).toBeNull();
    const card = page.querySelector('.is-later')!;
    expect(text(card.querySelector('.roadmap-badge'))).toBe('Ideas');
    expect(card.querySelector('.roadmap-issue use')?.getAttribute('href')).toBe('#icon-lightbulb');
    // Icons of the page's sprite, hidden from screen readers.
    expect(card.querySelector('.roadmap-issue svg')?.getAttribute('aria-hidden')).toBe('true');
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
