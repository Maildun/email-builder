/**
 * Display helpers for the Code view: an indenter for the rendered HTML and
 * small tokenizers for syntax colors. Display only: what users copy or export
 * is always the exact output, since whitespace between inline elements can
 * change how an email renders.
 */

export type TokenType =
  | 'punct'
  | 'tag'
  | 'attr'
  | 'value'
  | 'comment'
  | 'conditional'
  | 'doctype'
  | 'entity'
  | 'merge'
  | 'selector'
  | 'property'
  | 'keyword'
  | 'key'
  | 'string'
  | 'number'
  | 'literal'
  | 'text';

export type Token =
  | { type: TokenType; text: string }
  /** A long run of one entity sequence (the preheader filler), collapsed for display. */
  | { type: 'repeat'; text: string; unit: string; count: number };

/* -------------------------------------------------------------------------- */
/* HTML formatting                                                            */
/* -------------------------------------------------------------------------- */

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Elements that flow with text; everything else starts its own line. */
const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'del',
  'em',
  'font',
  'i',
  'img',
  'ins',
  'kbd',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'u',
  'wbr',
]);

/** Elements whose content is kept as raw text. */
const RAW = new Set(['style', 'script', 'title', 'textarea']);

type Node =
  | { kind: 'element'; name: string; open: string; close: string; children: Node[] }
  | { kind: 'text'; text: string }
  | { kind: 'comment'; text: string };

/** Index just past the tag starting at `start` (a `<`), respecting quoted attribute values. */
function tagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let i = start + 1; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i + 1;
    }
  }
  return html.length;
}

function parse(html: string): Node[] {
  const root: Node[] = [];
  const stack: Array<Extract<Node, { kind: 'element' }>> = [];
  const children = () => stack.at(-1)?.children ?? root;
  let i = 0;

  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      const stop = end === -1 ? html.length : end + 3;
      children().push({ kind: 'comment', text: html.slice(i, stop) });
      i = stop;
      continue;
    }

    const match = /^<(\/?)([a-zA-Z][\w:-]*|!doctype)/i.exec(html.slice(i, i + 64));
    if (!match) {
      const next = html.indexOf('<', i + 1);
      const stop = next === -1 ? html.length : next;
      children().push({ kind: 'text', text: html.slice(i, stop) });
      i = stop;
      continue;
    }

    const stop = tagEnd(html, i);
    const tag = html.slice(i, stop);
    const name = (match[2] ?? '').toLowerCase();
    i = stop;

    if (match[1]) {
      // A closing tag: close up to the matching element; ignore strays.
      const index = stack.findLastIndex((element) => element.name === name);
      if (index !== -1) {
        const [element] = stack.splice(index);
        if (element) element.close = tag;
      }
      continue;
    }

    const element: Extract<Node, { kind: 'element' }> = {
      kind: 'element',
      name,
      open: tag,
      close: '',
      children: [],
    };
    children().push(element);

    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, i);
      const contentEnd = end === -1 ? html.length : end;
      if (contentEnd > i) element.children.push({ kind: 'text', text: html.slice(i, contentEnd) });
      i = contentEnd;
      if (end !== -1) {
        const closeEnd = tagEnd(html, end);
        element.close = html.slice(end, closeEnd);
        i = closeEnd;
      }
    } else if (!VOID.has(name) && name !== '!doctype' && !tag.endsWith('/>')) {
      stack.push(element);
    }
  }

  return root;
}

function isInline(node: Node): boolean {
  if (node.kind === 'text') return true;
  if (node.kind === 'comment') return false;
  return INLINE.has(node.name) && node.children.every(isInline);
}

function serialize(node: Node): string {
  if (node.kind !== 'element') return node.text;
  return node.open + node.children.map(serialize).join('') + node.close;
}

/** One rule per line; rules inside at-rules (media queries) are indented. */
export function formatCss(css: string, indent: string): string {
  const lines: string[] = [];
  let line = '';
  let depth = 0;
  let previous = '';
  const push = () => {
    if (line.trim()) lines.push(indent + '  '.repeat(depth) + line.trim());
    line = '';
  };

  for (const char of css) {
    if (char === '{' && line.trim().startsWith('@')) {
      line += char;
      push();
      depth++;
    } else if (char === '}' && previous === '}' && depth > 0) {
      push();
      depth--;
      line = char;
      push();
    } else if (char === '}') {
      line += char;
      push();
    } else {
      line += char;
    }
    if (char.trim()) previous = char;
  }
  push();
  return lines.join('\n');
}

function print(nodes: Node[], depth: number, out: string[]): void {
  const indent = '  '.repeat(depth);
  let inline = '';
  const flush = () => {
    const text = inline.replace(/\s+/g, ' ').trim();
    if (text) out.push(indent + text);
    inline = '';
  };

  for (const node of nodes) {
    if (isInline(node)) {
      inline += serialize(node);
      continue;
    }
    flush();

    if (node.kind === 'comment') {
      out.push(indent + node.text.trim());
      continue;
    }
    if (node.kind !== 'element') continue;

    const content = node.children;
    if (node.name === 'style' && content[0]?.kind === 'text') {
      out.push(indent + node.open);
      out.push(formatCss(content[0].text, `${indent}  `));
      out.push(indent + node.close);
    } else if (content.length === 0 || content.every(isInline)) {
      // Short elements and ones holding only text stay on one line.
      const text = content.map(serialize).join('').replace(/\s+/g, ' ').trim();
      out.push(indent + node.open + text + node.close);
    } else {
      out.push(indent + node.open);
      print(content, depth + 1, out);
      if (node.close) out.push(indent + node.close);
    }
  }
  flush();
}

/** Indents email HTML for reading: one block element per line, inline content kept together. */
export function formatHtml(html: string): string {
  const out: string[] = [];
  print(parse(html), 0, out);
  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Tokenizers                                                                 */
/* -------------------------------------------------------------------------- */

/** The preheader filler (`&#847;&zwnj;&nbsp;` …): one entity sequence repeated 8 times or more. */
const REPEAT = /((?:&#?\w+;){1,4}?)\1{7,}/g;
const INLINE_TEXT = /(&#?\w+;)|(\{\{[^}]*\}\})/g;

function textTokens(text: string, out: Token[]): void {
  let last = 0;
  for (const match of text.matchAll(REPEAT)) {
    inlineTextTokens(text.slice(last, match.index), out);
    const unit = match[1] ?? '';
    out.push({ type: 'repeat', text: match[0], unit, count: match[0].length / unit.length });
    last = match.index + match[0].length;
  }
  inlineTextTokens(text.slice(last), out);
}

function inlineTextTokens(text: string, out: Token[]): void {
  let last = 0;
  for (const match of text.matchAll(INLINE_TEXT)) {
    if (match.index > last) out.push({ type: 'text', text: text.slice(last, match.index) });
    out.push({ type: match[1] ? 'entity' : 'merge', text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
}

function cssTokens(css: string, out: Token[]): void {
  // Outside braces: selectors and at-rules; inside a rule: `property: value;`.
  let inRule = false;
  let afterColon = false;
  let lastText = '';
  for (const match of css.matchAll(/(\s+)|(@[^{;]+)|([{};:])|([^{};:\s](?:[^{};:]*[^{};:\s])?)/g)) {
    const [text, space, atRule, punct] = match;
    if (space) {
      out.push({ type: 'text', text });
      continue;
    }
    if (atRule) {
      const keyword = /^@[\w-]+/.exec(atRule)?.[0] ?? atRule;
      out.push({ type: 'keyword', text: keyword });
      if (atRule.length > keyword.length) {
        out.push({ type: 'selector', text: atRule.slice(keyword.length) });
      }
    } else if (punct) {
      if (punct === '{') inRule = !lastText.startsWith('@');
      else if (punct === '}') inRule = false;
      afterColon = punct === ':' ? inRule : punct === ';' || punct === '{' ? false : afterColon;
      out.push({ type: 'punct', text });
    } else {
      out.push({ type: !inRule ? 'selector' : afterColon ? 'value' : 'property', text });
    }
    lastText = text;
  }
}

function tagTokens(tag: string, out: Token[]): void {
  const match = /^(<\/?)([^\s/>]+)/.exec(tag);
  if (!match) {
    out.push({ type: 'text', text: tag });
    return;
  }
  out.push({ type: 'punct', text: match[1] ?? '<' });
  const name = match[2] ?? '';
  out.push({ type: name.startsWith('!') ? 'doctype' : 'tag', text: name });
  const rest = tag.slice(match[0].length);
  for (const part of rest.matchAll(
    /(\s+)|([^\s=/>"']+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+))?|(\/?>)|(.)/g,
  )) {
    const [text, space, attr, equals, value, end] = part;
    if (space) out.push({ type: 'text', text });
    else if (attr) {
      out.push({ type: name.startsWith('!') ? 'doctype' : 'attr', text: attr });
      if (equals) out.push({ type: 'punct', text: equals });
      if (value) out.push({ type: 'value', text: value });
    } else if (end) out.push({ type: 'punct', text });
    else out.push({ type: 'text', text });
  }
}

/** Tokens for (formatted or raw) HTML, including the CSS in `<style>`. */
export function tokenizeHtml(html: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let rawUntil: string | null = null;

  while (i < html.length) {
    if (rawUntil) {
      const end = html.toLowerCase().indexOf(rawUntil, i);
      const stop = end === -1 ? html.length : end;
      cssTokens(html.slice(i, stop), out);
      i = stop;
      rawUntil = null;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      const stop = end === -1 ? html.length : end + 3;
      const text = html.slice(i, stop);
      out.push({ type: /^<!--\[if|<!\[endif\]-->$/.test(text) ? 'conditional' : 'comment', text });
      i = stop;
      continue;
    }
    if (html.startsWith('<![endif]', i)) {
      const stop = html.indexOf('>', i) + 1 || html.length;
      out.push({ type: 'conditional', text: html.slice(i, stop) });
      i = stop;
      continue;
    }
    if (/^<\/?[a-zA-Z!]/.test(html.slice(i, i + 3))) {
      const stop = tagEnd(html, i);
      const tag = html.slice(i, stop);
      tagTokens(tag, out);
      if (/^<style[\s>]/i.test(tag)) rawUntil = '</style';
      i = stop;
      continue;
    }
    const next = html.indexOf('<', i + 1);
    const stop = next === -1 ? html.length : next;
    textTokens(html.slice(i, stop), out);
    i = stop;
  }
  return out;
}

/** Tokens for JSON: keys, strings, numbers, true/false/null. */
export function tokenizeJson(json: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const match of json.matchAll(
    /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g,
  )) {
    if (match.index > last) out.push({ type: 'text', text: json.slice(last, match.index) });
    const [text, string, colon, number, literal] = match;
    if (string) {
      if (colon) {
        out.push({ type: 'key', text: string });
        out.push({ type: 'punct', text: colon });
      } else {
        out.push({ type: string.includes('{{') ? 'merge' : 'string', text: string });
      }
    } else if (number) out.push({ type: 'number', text });
    else if (literal) out.push({ type: 'literal', text });
    else out.push({ type: 'punct', text });
    last = match.index + text.length;
  }
  if (last < json.length) out.push({ type: 'text', text: json.slice(last) });
  return out;
}

/** Tokens for plain text: only merge tags stand out. */
export function tokenizeText(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(/\{\{[^}]*\}\}/g)) {
    if (match.index > last) out.push({ type: 'text', text: text.slice(last, match.index) });
    out.push({ type: 'merge', text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

/** Splits tokens into lines, breaking tokens that contain newlines. */
export function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    if (token.type === 'repeat' || !token.text.includes('\n')) {
      lines.at(-1)?.push(token);
      continue;
    }
    token.text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines.at(-1)?.push({ type: token.type, text: part });
    });
  }
  return lines;
}
