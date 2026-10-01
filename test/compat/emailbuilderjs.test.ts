import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderEmail, validateDocument } from '../../src';
import { escapeMarkdown, fromEmailBuilderJs, isEmailBuilderJsDocument } from '../../src/compat';

const fixtures = join(__dirname, '../fixtures/emailbuilderjs');
const samples = readdirSync(fixtures).filter((file) => file.endsWith('.json'));

describe('fromEmailBuilderJs', () => {
  it.each(samples)('imports, validates and renders %s', (file) => {
    const source = JSON.parse(readFileSync(join(fixtures, file), 'utf8'));
    expect(isEmailBuilderJsDocument(source)).toBe(true);
    const { document } = fromEmailBuilderJs(source);
    expect(validateDocument(document).ok).toBe(true);
    const { html } = renderEmail(document);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('keeps every reachable block and preserves ids', () => {
    const source = JSON.parse(readFileSync(join(fixtures, 'welcome.json'), 'utf8'));
    const { document } = fromEmailBuilderJs(source);
    expect(document.root).toEqual(source.root.data.childrenIds);
  });

  it('maps layout colors into the theme and props onto new names', () => {
    const { document } = fromEmailBuilderJs({
      root: {
        type: 'EmailLayout',
        data: {
          backdropColor: '#F2F5F7',
          canvasColor: '#FFFFFF',
          textColor: '#242424',
          fontFamily: 'BOOK_SERIF',
          childrenIds: ['b1', 'c1'],
        },
      },
      b1: {
        type: 'Button',
        data: {
          style: { textAlign: 'center' },
          props: {
            text: 'Go',
            url: 'https://x.test',
            size: 'large',
            buttonStyle: 'pill',
            buttonBackgroundColor: '#FF0000',
          },
        },
      },
      c1: {
        type: 'ColumnsContainer',
        data: {
          props: {
            columnsCount: 2,
            columns: [{ childrenIds: ['t1'] }, { childrenIds: [] }, { childrenIds: ['lost'] }],
          },
        },
      },
      t1: { type: 'Text', data: { props: { text: '*not italic*' } } },
      lost: { type: 'Text', data: { props: { text: 'hidden third column' } } },
    });
    expect(document.theme.colors.background).toBe('#F2F5F7');
    expect(document.theme.fonts.body).toBe('BOOK_SERIF');
    expect(document.blocks.b1).toMatchObject({
      type: 'button',
      props: { href: 'https://x.test', size: 'lg', shape: 'pill', buttonColor: '#FF0000' },
      style: { align: 'center' },
    });
    const columns = document.blocks.c1;
    expect(columns?.type === 'columns' && columns.children).toHaveLength(2);
    expect(document.blocks.lost).toBeUndefined();
    expect(document.blocks.t1).toMatchObject({ props: { markdown: '\\*not italic\\*' } });
  });

  it('reports dropped content and falls back to html for tables', () => {
    const { document, warnings } = fromEmailBuilderJs({
      root: { type: 'EmailLayout', data: { childrenIds: ['t', 'x'] } },
      t: {
        type: 'Text',
        data: { props: { markdown: true, text: '| a | b |\n|---|---|\n| 1 | 2 |' } },
      },
      x: { type: 'LoopContainer', data: {} },
      orphan: { type: 'Spacer', data: {} },
    });
    expect(document.blocks.t?.type).toBe('html');
    expect(warnings.join('\n')).toMatch(/html block/);
    expect(warnings.join('\n')).toMatch(/unsupported block type "LoopContainer"/);
    expect(warnings.join('\n')).toMatch(/1 unattached/);
  });

  it('rejects non EmailBuilder.js input', () => {
    expect(() => fromEmailBuilderJs({ version: 1 })).toThrow(/EmailLayout/);
  });
});

describe('escapeMarkdown', () => {
  it('escapes inline syntax and line-start markers only', () => {
    expect(escapeMarkdown('a-b *c*\n- d\n1. e')).toBe('a-b \\*c\\*\n\\- d\n1\\. e');
  });
});
