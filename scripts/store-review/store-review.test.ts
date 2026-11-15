import { describe, expect, it } from 'vitest';
import { ESB_ISSUE, ESB_MARK, GitHub, isPublished, parseStoreIssue, run } from './store-review.ts';

describe('the store issue (#350)', () => {
  it('reads the store, the version and the id', () => {
    expect(parseStoreIssue('Upload it.\n\nStore: chrome\nVersion: 1.1.1\n\n## To do')).toEqual({
      store: 'chrome',
      version: '1.1.1',
    });
    expect(parseStoreIssue('Store: Edge\r\nId: abcdef\r\nVersion: v1.2.0')).toEqual({
      store: 'edge',
      version: '1.2.0',
      id: 'abcdef',
    });
    expect(parseStoreIssue('Store: opera')).toEqual({ store: 'opera' });
  });

  it('tells what is missing or wrong', () => {
    expect(parseStoreIssue('Publish it.')).toMatch(/no line "Store/);
    expect(parseStoreIssue('Store: safari')).toMatch(/unknown store "safari"/);
    expect(parseStoreIssue('Store: firefox\nVersion: soon')).toMatch(/no version/);
    expect(parseStoreIssue('Store: edge')).toMatch(/no line "Id/);
  });

  it('counts as published with the version or a newer one, or any listing without a version', () => {
    expect(isPublished({ store: 'chrome', version: '1.1.1' }, { version: '1.1.0' })).toBe(false);
    expect(isPublished({ store: 'chrome', version: '1.1.1' }, { version: '1.1.1' })).toBe(true);
    expect(isPublished({ store: 'chrome', version: '1.1.1' }, { version: '1.2.0' })).toBe(true);
    expect(isPublished({ store: 'opera' }, { version: '1.0.0' })).toBe(true);
    expect(isPublished({ store: 'opera' }, undefined)).toBe(false);
  });
});

// A fake GitHub and stores: the requests the run makes, and the answers it gets.
function fakeWorld(options: {
  issues: { number: number; body: string }[];
  statuses: Record<number, string>;
  chromeVersion?: string;
  firefox?: 'listed' | 'broken';
  esbTrusted?: boolean;
  esbComments?: string[];
  projectToken?: string;
  /** The deployed website, and the open issues with a milestone (#354). */
  site?: string;
  milestoneIssues?: unknown[];
  /** The open milestones, their issues and the sub-issues of a publish issue (#365). */
  milestones?: { number: number; title: string }[];
  milestoneContent?: Record<number, unknown[]>;
  subIssues?: Record<number, unknown[]>;
}) {
  const calls: string[] = [];
  const chrome = `<gupdate><app appid="x" status="ok"><updatecheck _esbAllowlist="${options.esbTrusted ? 'true' : 'false'}" status="ok" version="${options.chromeVersion ?? '1.1.0'}"/></app></gupdate>`;
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.startsWith('https://clients2.google.com/')) return new Response(chrome);
    if (url.startsWith('https://addons.mozilla.org/')) {
      return options.firefox === 'broken'
        ? new Response('<html>maintenance</html>', { status: 200 })
        : json({ status: 'public', current_version: { version: '1.1.1' } });
    }
    if (url.startsWith('https://addons.opera.com/')) return new Response('', { status: 404 });
    if (url === 'https://exrelax.github.io/star-citizen-hangar-manager/') {
      return new Response(options.site ?? '<html></html>');
    }
    if (url.endsWith('/graphql')) {
      const body = JSON.parse(String(init?.body)) as { query: string };
      if (body.query.includes('mutation')) {
        calls.push('setDone');
        return json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i' } } } });
      }
      return json({
        data: {
          user: {
            projectV2: {
              id: 'P',
              field: {
                id: 'F',
                options: [
                  { id: 'o-review', name: 'In review' },
                  { id: 'o-done', name: 'Done' },
                ],
              },
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: Object.entries(options.statuses).map(([number, status]) => ({
                  id: `item-${number}`,
                  status: { name: status },
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
    const path = url.replace(
      'https://api.github.com/repos/exrelax/star-citizen-hangar-manager',
      '',
    );
    calls.push(`${method} ${path.replace(/\?.*/, '')}`);
    if (path.startsWith('/milestones?state=open')) {
      calls.pop();
      return json(options.milestones ?? []);
    }
    const ofMilestone = /^\/issues\?milestone=(\d+)&state=all/.exec(path)?.[1];
    if (ofMilestone) {
      calls.pop();
      return json(options.milestoneContent?.[Number(ofMilestone)] ?? []);
    }
    const subsOf = /^\/issues\/(\d+)\/sub_issues/.exec(path)?.[1];
    if (subsOf) {
      calls.pop();
      return json(options.subIssues?.[Number(subsOf)] ?? []);
    }
    if (path.startsWith('/issues?state=open&milestone=*')) {
      calls.pop();
      return json(options.milestoneIssues ?? []);
    }
    if (path.startsWith('/actions/workflows/site.yml/dispatches'))
      return new Response(null, { status: 204 });
    if (path.startsWith('/issues?')) {
      return json(
        options.issues.map((issue) => ({
          ...issue,
          title: `Issue ${issue.number}`,
          html_url: '',
          state: 'open',
        })),
      );
    }
    if (path === `/issues/${ESB_ISSUE}` && method === 'GET')
      return json({ number: ESB_ISSUE, state: 'open' });
    if (path.startsWith(`/issues/${ESB_ISSUE}/comments`) && method === 'GET') {
      return json((options.esbComments ?? []).map((body) => ({ body })));
    }
    return json({});
  }) as typeof fetch;
  const github = new GitHub(
    'token',
    'projectToken' in options ? options.projectToken : 'pt',
    fetchImpl,
  );
  return { calls, fetchImpl, github };
}

const CHROME_111 = { number: 352, body: 'Store: chrome\nVersion: 1.1.1' };
const FIREFOX_111 = { number: 353, body: 'Store: firefox\nVersion: 1.1.1' };
const OPERA = { number: 7, body: 'Store: opera' };

describe('the store review run (#350)', () => {
  const quiet = () => {};

  it('moves an issue in review whose store published the version, and leaves the others', async () => {
    const world = fakeWorld({
      issues: [CHROME_111, FIREFOX_111, OPERA],
      statuses: { 352: 'In review', 353: 'In review', 7: 'In review' },
    });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result).toEqual({ moved: [353], closedMilestones: [], errors: [] });
    expect(world.calls).toEqual([
      'GET /issues',
      'setDone',
      'POST /issues/353/comments',
      'PATCH /issues/353',
    ]);
  });

  it('moves only issues in review', async () => {
    const world = fakeWorld({ issues: [FIREFOX_111], statuses: { 353: 'Ready' } });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result.moved).toEqual([]);
    expect(world.calls).toEqual(['GET /issues']);
  });

  it("doesn't read an issue before its review", async () => {
    const world = fakeWorld({
      issues: [{ number: 8, body: 'Store: edge' }],
      statuses: { 8: 'Ready' },
    });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result).toEqual({ moved: [], closedMilestones: [], errors: [] });
  });

  it('only reports in a dry run and without the project token', async () => {
    for (const setup of [{ dryRun: true }, { dryRun: false, projectToken: undefined }]) {
      const world = fakeWorld({
        issues: [FIREFOX_111],
        statuses: { 353: 'In review' },
        ...('projectToken' in setup && { projectToken: setup.projectToken }),
      });
      const result = await run({
        github: world.github,
        dryRun: setup.dryRun,
        fetch: world.fetchImpl,
        log: quiet,
      });
      expect(result.moved).toEqual([353]);
      expect(world.calls).toEqual(['GET /issues']);
    }
  });

  it('fails on an unexpected answer or an unreadable issue, without moving anything for it', async () => {
    const world = fakeWorld({
      issues: [FIREFOX_111, { number: 9, body: 'No store here' }],
      statuses: { 353: 'In review', 9: 'In review' },
      firefox: 'broken',
    });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result.moved).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatch(/#353.*Firefox Add-ons: unexpected answer/);
    expect(result.errors[1]).toMatch(/#9.*no line "Store/);
    expect(world.calls).toEqual(['GET /issues']);
  });

  it('tells #333 once that Enhanced Safe Browsing trusts the extension', async () => {
    const first = fakeWorld({ issues: [], statuses: {}, esbTrusted: true });
    await run({ github: first.github, dryRun: false, fetch: first.fetchImpl, log: quiet });
    expect(first.calls).toContain(`POST /issues/${ESB_ISSUE}/comments`);

    const again = fakeWorld({
      issues: [],
      statuses: {},
      esbTrusted: true,
      esbComments: [`${ESB_MARK}\nDone.`],
    });
    await run({ github: again.github, dryRun: false, fetch: again.fetchImpl, log: quiet });
    expect(again.calls).not.toContain(`POST /issues/${ESB_ISSUE}/comments`);

    const untrusted = fakeWorld({ issues: [], statuses: {} });
    await run({ github: untrusted.github, dryRun: false, fetch: untrusted.fetchImpl, log: quiet });
    expect(untrusted.calls).toEqual(['GET /issues']);
  });
});

describe('the roadmap of the website (#354)', () => {
  const quiet = () => {};
  const step = (kind: string, title: string) =>
    `<li class="roadmap-step ${kind}">\n<div class="roadmap-rail"></div>\n<article class="roadmap-card" aria-labelledby="roadmap-${title}">`;
  const SITE = [
    step('is-live', 'v1-1-0'),
    step('is-next', 'v1-1-1'),
    step('is-planned', 'v1-2-0'),
  ].join('');
  const PUBLISH = {
    number: 351,
    title: 'Publish v1.1.1',
    milestone: { title: 'v1.1.1' },
    sub_issues_summary: { total: 2 },
  };

  it('starts a website build once the publish issue is in review', async () => {
    const world = fakeWorld({
      issues: [],
      statuses: { 351: 'In review' },
      site: SITE,
      milestoneIssues: [PUBLISH],
    });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result.errors).toEqual([]);
    expect(world.calls).toContain('POST /actions/workflows/site.yml/dispatches');
  });

  it('starts none while the roadmap shows it', async () => {
    for (const [status, site] of [
      ['In review', SITE.replace('is-next', 'is-review')],
      ['In progress', SITE],
    ] as const) {
      const world = fakeWorld({
        issues: [],
        statuses: { 351: status },
        site,
        milestoneIssues: [PUBLISH],
      });
      await run({ github: world.github, dryRun: false, fetch: world.fetchImpl, log: quiet });
      expect(world.calls).not.toContain('POST /actions/workflows/site.yml/dispatches');
    }
  });

  it('starts one once the review is over, and none in a dry run', async () => {
    const world = fakeWorld({
      issues: [],
      statuses: { 351: 'Done' },
      site: SITE.replace('is-next', 'is-review'),
      milestoneIssues: [PUBLISH],
    });
    await run({ github: world.github, dryRun: false, fetch: world.fetchImpl, log: quiet });
    expect(world.calls).toContain('POST /actions/workflows/site.yml/dispatches');

    const dry = fakeWorld({
      issues: [],
      statuses: { 351: 'In review' },
      site: SITE,
      milestoneIssues: [PUBLISH],
    });
    await run({ github: dry.github, dryRun: true, fetch: dry.fetchImpl, log: quiet });
    expect(dry.calls).not.toContain('POST /actions/workflows/site.yml/dispatches');
  });

  it('starts one when a version in review shows as live (its release published first)', async () => {
    const world = fakeWorld({
      issues: [],
      statuses: { 351: 'In review' },
      site: step('is-live', 'v1-1-1') + step('is-next', 'v1-2-0'),
      milestoneIssues: [PUBLISH],
    });
    await run({ github: world.github, dryRun: false, fetch: world.fetchImpl, log: quiet });
    expect(world.calls).toContain('POST /actions/workflows/site.yml/dispatches');
  });

  it("ignores versions the roadmap doesn't show", async () => {
    const world = fakeWorld({
      issues: [],
      statuses: { 351: 'In review' },
      // v1.1.1 beyond the planned versions shown.
      site: step('is-live', 'v1-0-0') + step('is-next', 'v1-0-1'),
      milestoneIssues: [PUBLISH],
    });
    await run({ github: world.github, dryRun: false, fetch: world.fetchImpl, log: quiet });
    expect(world.calls).not.toContain('POST /actions/workflows/site.yml/dispatches');
  });
});

describe('closing a release (#365)', () => {
  const quiet = () => {};
  const MILESTONE = { number: 3, title: 'v1.1.1' };
  const publish = (state = 'open') => ({
    number: 351,
    title: 'Publish v1.1.1',
    state,
    html_url: '',
    labels: [],
    sub_issues_summary: { total: 2 },
  });
  const done = (number: number, state = 'closed') => ({
    number,
    title: `Issue ${number}`,
    state,
    html_url: '',
    labels: [],
  });
  const world = (options: { chrome: string; publishState?: string; others?: unknown[] }) =>
    fakeWorld({
      issues: [CHROME_111],
      statuses: { 352: 'In review', 351: 'In review' },
      chromeVersion: options.chrome,
      milestones: [MILESTONE, { number: 4, title: 'v1.2.0' }],
      milestoneContent: {
        3: [
          publish(options.publishState),
          done(352, 'open'),
          done(353),
          ...(options.others ?? [done(340)]),
        ],
        4: [done(400, 'open')],
      },
      subIssues: { 351: [done(352, 'open'), done(353)] },
    });

  it('closes the publish issue and the milestone once the last store published it', async () => {
    const w = world({ chrome: '1.1.1' });
    const result = await run({ github: w.github, dryRun: false, fetch: w.fetchImpl, log: quiet });
    expect(result).toEqual({ moved: [352, 351], closedMilestones: ['v1.1.1'], errors: [] });
    expect(w.calls).toEqual([
      'GET /issues',
      'setDone',
      'POST /issues/352/comments',
      'PATCH /issues/352',
      'setDone',
      'POST /issues/351/comments',
      'PATCH /issues/351',
      'PATCH /milestones/3',
      'POST /actions/workflows/site.yml/dispatches',
    ]);
  });

  it('leaves both open while a store issue is open', async () => {
    const w = world({ chrome: '1.1.0' });
    const result = await run({ github: w.github, dryRun: false, fetch: w.fetchImpl, log: quiet });
    expect(result.closedMilestones).toEqual([]);
    expect(w.calls).not.toContain('PATCH /issues/351');
    expect(w.calls).not.toContain('PATCH /milestones/3');
  });

  it('leaves the milestone open while another of its issues is', async () => {
    const w = world({ chrome: '1.1.1', others: [done(340, 'open')] });
    const result = await run({ github: w.github, dryRun: false, fetch: w.fetchImpl, log: quiet });
    expect(result.moved).toEqual([352, 351]);
    expect(result.closedMilestones).toEqual([]);
    expect(w.calls).not.toContain('PATCH /milestones/3');
  });

  it('closes the milestone of a publish issue closed by hand', async () => {
    const content = { 3: [publish('closed'), done(352), done(353)] };
    const closedByHand = fakeWorld({
      issues: [],
      statuses: {},
      milestones: [MILESTONE],
      milestoneContent: content,
    });
    const result = await run({
      github: closedByHand.github,
      dryRun: false,
      fetch: closedByHand.fetchImpl,
      log: quiet,
    });
    expect(result.closedMilestones).toEqual(['v1.1.1']);
    expect(closedByHand.calls).toContain('PATCH /milestones/3');
  });

  it('only reports in a dry run', async () => {
    const w = world({ chrome: '1.1.1' });
    const result = await run({ github: w.github, dryRun: true, fetch: w.fetchImpl, log: quiet });
    expect(result.closedMilestones).toEqual(['v1.1.1']);
    expect(w.calls).toEqual(['GET /issues']);
  });
});

describe('the store versions on the website (#368)', () => {
  const quiet = () => {};
  const line = (store: string, version: string) =>
    `<span class="install-version" data-store-version="${store}">Version ${version}</span>`;
  const BUILD = 'POST /actions/workflows/site.yml/dispatches';

  it('starts a website build once a store lists another version', async () => {
    const world = fakeWorld({
      issues: [],
      statuses: {},
      chromeVersion: '1.1.1',
      site: line('chrome', '1.1.0') + line('firefox', '1.1.1'),
    });
    const result = await run({
      github: world.github,
      dryRun: false,
      fetch: world.fetchImpl,
      log: quiet,
    });
    expect(result.errors).toEqual([]);
    expect(world.calls).toContain(BUILD);
  });

  it('starts none while the website shows the versions, or a store fails', async () => {
    for (const [site, firefox] of [
      [line('chrome', '1.1.0') + line('firefox', '1.1.1'), 'listed'],
      [line('chrome', '1.1.0') + line('firefox', '1.0.0'), 'broken'],
      // A line the build left out waits for the next build.
      [line('chrome', '1.1.0'), 'listed'],
    ] as const) {
      const world = fakeWorld({ issues: [], statuses: {}, site, firefox });
      await run({ github: world.github, dryRun: false, fetch: world.fetchImpl, log: quiet });
      expect(world.calls).not.toContain(BUILD);
    }
  });

  it('only reports in a dry run', async () => {
    const world = fakeWorld({ issues: [], statuses: {}, site: line('chrome', '1.0.0') });
    await run({ github: world.github, dryRun: true, fetch: world.fetchImpl, log: quiet });
    expect(world.calls).not.toContain(BUILD);
  });
});
