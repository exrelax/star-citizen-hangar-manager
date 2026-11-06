import { marked, type Token, type Tokens } from 'marked';

/*
 * The privacy page of the website, made from PRIVACY.md while building (see site/vite.config.ts),
 * so the policy has a single source. Its layout follows the file:
 *
 * - the `#` heading is the page's title;
 * - the paragraphs before the first `##` section: all but the last form the line below the title
 *   (product and date), the last one is the highlighted summary;
 * - every `##` section becomes a section of the page, with a link to it at the top.
 */

export interface PrivacySection {
  id: string;
  title: string;
  html: string;
}

export interface PrivacyPage {
  title: string;
  /** Plain text, e.g. "Star Citizen Hangar Manager (browser extension …) · Last updated: …". */
  meta: string;
  /** The summary below the title, as HTML. */
  intro: string;
  sections: PrivacySection[];
}

export function parsePrivacy(markdown: string): PrivacyPage {
  const tokens = marked.lexer(markdown);
  let title = '';
  const before: Tokens.Paragraph[] = [];
  const sections: { title: string; tokens: Token[] }[] = [];
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1) {
      title = token.text;
    } else if (token.type === 'heading' && token.depth === 2) {
      sections.push({ title: token.text, tokens: [] });
    } else if (sections.length) {
      sections.at(-1)!.tokens.push(token);
    } else if (token.type === 'paragraph') {
      before.push(token as Tokens.Paragraph);
    }
  }
  const intro = before.length > 1 ? before.pop()! : undefined;
  const ids = new Set<string>();
  return {
    title: plainText(title),
    meta: before.map((paragraph) => plainText(paragraph.text)).join(' · '),
    intro: intro ? marked.parser([intro]) : '',
    sections: sections.map((section) => ({
      id: uniqueId(slug(plainText(section.title)), ids),
      title: plainText(section.title),
      html: marked.parser(section.tokens),
    })),
  };
}

/** The page's main content, for the `<!-- privacy -->` placeholder in privacy.html. */
export function renderPrivacy(page: PrivacyPage): string {
  const toc = page.sections
    .map((section) => `<li><a href="#${section.id}">${escape(section.title)}</a></li>`)
    .join('');
  const sections = page.sections
    .map(
      (
        section,
      ) => `<section id="${section.id}" class="privacy-section" aria-labelledby="${section.id}-title">
        <h2 id="${section.id}-title">${escape(section.title)}</h2>
        ${section.html}
      </section>`,
    )
    .join('');
  return `<h1>${escape(page.title)}</h1>
    ${page.meta ? `<p class="privacy-meta">${escape(page.meta)}</p>` : ''}
    ${page.intro ? `<div class="privacy-intro">${page.intro}</div>` : ''}
    <nav class="privacy-toc" aria-label="On this page"><ul>${toc}</ul></nav>
    <article class="privacy-body">${sections}</article>`;
}

/** Markdown of a heading or line as plain text: no `**`, links as their text. */
function plainText(markdown: string): string {
  return marked
    .parseInline(markdown, { async: false })
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

function uniqueId(id: string, used: Set<string>): string {
  let unique = id;
  for (let number = 2; used.has(unique); number++) unique = `${id}-${number}`;
  used.add(unique);
  return unique;
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
