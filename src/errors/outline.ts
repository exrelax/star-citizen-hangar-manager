import { OUTLINE_MAX } from './error-log';

/*
 * The outline of an entry of RSI's page that couldn't be read (#342), for the error log: one line
 * per element, indented by its nesting, with its tag, its classes and the names of its `data-*`,
 * `name`, `href` and `type` attributes – never a text or an attribute's value, so it holds no data
 * of the account, but shows what RSI rebuilt.
 */

const KEPT_ATTRIBUTES = /^(?:data-.+|name|href|type)$/;

export function outlineOf(element: Element, max = OUTLINE_MAX): string {
  const lines: string[] = [];
  let length = 0;
  const walk = (current: Element, depth: number) => {
    if (length > max) return;
    const classes = [...current.classList].map((name) => `.${name}`).join('');
    const attributes = [...current.attributes]
      .map((attribute) => attribute.name)
      .filter((name) => KEPT_ATTRIBUTES.test(name))
      .map((name) => `[${name}]`)
      .join('');
    const line = `${'  '.repeat(depth)}${current.tagName.toLowerCase()}${classes}${attributes}`;
    lines.push(line);
    length += line.length + 1;
    for (const child of current.children) walk(child, depth + 1);
  };
  walk(element, 0);
  const text = lines.join('\n');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
