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
    expect(result).toEqual({ moved: [353], errors: [] });
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
    expect(result).toEqual({ moved: [], errors: [] });
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
