import { describe, expect, it } from 'vitest';
import { renderEmail, TEMPLATES } from '../../src';
import {
  formatCss,
  formatHtml,
  type Token,
  tokenizeHtml,
  tokenizeJson,
  tokenizeText,
  toLines,
} from '../../src/editor/panels/code';

const strip = (value: string) => value.replace(/\s+/g, '');
const of = (tokens: Token[], type: Token['type']) =>
  tokens.filter((token) => token.type === type).map((token) => token.text);

describe('formatHtml', () => {
  const html = renderEmail(TEMPLATES.newsletter.create()).html;
  const formatted = formatHtml(html);

  it('only adds whitespace, never content', () => {
    expect(strip(formatted)).toBe(strip(html));
  });

  it('indents block elements and keeps inline content on one line', () => {
    const lines = formatted.split('\n');
    expect(lines[0]).toBe('<!DOCTYPE html>');
    expect(lines).toContain('  <head>');
    expect(lines.some((line) => /^ {4}<meta charset="utf-8">$/.test(line))).toBe(true);
    expect(lines.length).toBeGreaterThan(100);
    // A cell holding only an image stays on one line.
    expect(lines.some((line) => /^\s+<td[^>]*><img [^>]*><\/td>$/.test(line))).toBe(true);
  });

  it('formats the style sheet one rule per line, media queries nested', () => {
    expect(formatted).toMatch(
      /\n {6}@media only screen and \(max-width:620px\)\{\n {8}\.meb-canvas\{/,
    );
  });

  it('keeps Outlook conditional comments whole', () => {
    expect(formatted).toMatch(/\n\s+<!--\[if mso\]><table [^\n]*<!\[endif\]-->\n/);
  });

  it('copes with stray and unclosed tags without inventing closing tags', () => {
    expect(formatHtml('<div><p>Hi <b>there</div></span>tail')).toBe(
      '<div>\n  <p>Hi <b>there\n</div>\ntail',
    );
    expect(formatHtml('a < b')).toBe('a < b');
  });
});

describe('formatCss', () => {
  it('breaks rules and indents at-rule blocks', () => {
    expect(formatCss('a{color:red}@media (max-width:600px){.x{y:1}.z{w:2}}p{m:0}', '')).toBe(
      'a{color:red}\n@media (max-width:600px){\n  .x{y:1}\n  .z{w:2}\n}\np{m:0}',
    );
  });
});

describe('tokenizeHtml', () => {
  it('colors tags, attributes, values, entities, merge tags and comments', () => {
    const tokens = tokenizeHtml(
      '<a href="{{ unsubscribe_url }}" class=x>Hi&nbsp;{{ first_name }}</a><!-- note --><!--[if mso]><table><![endif]-->',
    );
    expect(of(tokens, 'tag')).toEqual(['a', 'a']);
    expect(of(tokens, 'attr')).toEqual(['href', 'class']);
    expect(of(tokens, 'value')).toEqual(['"{{ unsubscribe_url }}"', 'x']);
    expect(of(tokens, 'entity')).toEqual(['&nbsp;']);
    expect(of(tokens, 'merge')).toEqual(['{{ first_name }}']);
    expect(of(tokens, 'comment')).toEqual(['<!-- note -->']);
    expect(of(tokens, 'conditional')).toEqual(['<!--[if mso]><table><![endif]-->']);
  });

  it('tokenizes the style sheet as CSS', () => {
    const tokens = tokenizeHtml(
      '<style>a{color:red}@media (max-width:620px){.x{width:100%!important}}</style>',
    );
    expect(of(tokens, 'keyword')).toEqual(['@media']);
    expect(of(tokens, 'selector')).toEqual(['a', ' (max-width:620px)', '.x']);
    expect(of(tokens, 'property')).toEqual(['color', 'width']);
    expect(of(tokens, 'value')).toEqual(['red', '100%!important']);
  });

  it('collapses the preheader filler and keeps the text intact', () => {
    const html = renderEmail(TEMPLATES.newsletter.create()).html;
    const tokens = tokenizeHtml(html);
    const repeat = tokens.find((token) => token.type === 'repeat');
    expect(repeat).toMatchObject({ unit: '&#847;&zwnj;&nbsp;', count: 80 });
    expect(tokens.map((token) => token.text).join('')).toBe(html);
    // Short runs stay as they are.
    expect(tokenizeHtml('a&nbsp;&nbsp;b').some((token) => token.type === 'repeat')).toBe(false);
  });
});

describe('tokenizeJson and tokenizeText', () => {
  it('separates keys from values', () => {
    const tokens = tokenizeJson('{"a": "x", "n": -1.5, "ok": true, "z": null, "t": "{{ name }}"}');
    expect(of(tokens, 'key')).toEqual(['"a"', '"n"', '"ok"', '"z"', '"t"']);
    expect(of(tokens, 'string')).toEqual(['"x"']);
    expect(of(tokens, 'number')).toEqual(['-1.5']);
    expect(of(tokens, 'literal')).toEqual(['true', 'null']);
    expect(of(tokens, 'merge')).toEqual(['"{{ name }}"']);
  });

  it('highlights merge tags in plain text', () => {
    expect(of(tokenizeText('Hi {{ first_name }},\nbye'), 'merge')).toEqual(['{{ first_name }}']);
  });
});

describe('toLines', () => {
  it('splits tokens across newlines, keeping empty lines', () => {
    const lines = toLines([
      { type: 'text', text: 'a\n\nb' },
      { type: 'tag', text: 'p' },
    ]);
    expect(lines.map((line) => line.map((token) => token.text).join(''))).toEqual(['a', '', 'bp']);
    expect(lines[2]?.[1]).toEqual({ type: 'tag', text: 'p' });
  });
});
