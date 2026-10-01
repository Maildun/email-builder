import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  applyOps,
  type BlockInput,
  createDocument,
  type EmailDocument,
  renderEmail,
  renderInlineMarkdown,
  renderMarkdown,
  TEMPLATES,
} from '../../src';

function render(blocks: BlockInput[], settings = {}) {
  return renderEmail(createDocument({ blocks, settings })).html;
}

describe('renderEmail', () => {
  it('produces a full email document with head, preheader and responsive styles', () => {
    const { html, text, warnings } = renderEmail(
      createDocument({
        settings: { preheader: 'Peek inside', title: 'Hello' },
        blocks: [{ type: 'text', props: { markdown: 'Hi there' } }],
      }),
    );
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>Hello</title>');
    expect(html).toContain('Peek inside');
    expect(html).toContain('@media only screen and (max-width:620px)');
    expect(text).toBe('Hi there');
    expect(warnings).toEqual([]);
  });

  it('keeps style attributes well-formed with quoted font stacks', () => {
    const { html } = renderEmail(TEMPLATES.newsletter.create());
    expect(html).toContain("font-family:'Helvetica Neue'");
    for (const [, style] of html.matchAll(/style="([^"]*)"/g)) {
      expect(style).not.toMatch(/[<>]/);
    }
    expect(html).not.toMatch(/style="[^"]*"[a-z-]+=""/);
  });

  it('resolves theme tokens to hex colors', () => {
    const html = render([{ type: 'button', props: { buttonColor: '$primary' } }]);
    expect(html).toContain('fillcolor="#1f6feb"');
    expect(html).not.toMatch(/\$primary/);
  });

  it('renders Outlook VML for buttons with an HTML fallback', () => {
    const html = render([
      { type: 'button', props: { text: 'Go', href: 'https://a.test', shape: 'pill' } },
    ]);
    expect(html).toContain('<v:roundrect');
    expect(html).toContain('<!--[if !mso]><!--><a href="https://a.test"');
  });

  it('marks columns for stacking on mobile unless disabled', () => {
    const stacked = render([{ type: 'columns', children: [{ type: 'text' }, { type: 'text' }] }]);
    expect(stacked).toContain('class="meb-col"');
    expect(stacked).toContain('class="meb-col meb-col-next"');
    const fixed = render([
      { type: 'columns', props: { stackOnMobile: false }, children: [{ type: 'text' }] },
    ]);
    expect(fixed).not.toContain('class="meb-col');
  });

  it('splits column widths by percentage and gap', () => {
    const html = render([
      {
        type: 'columns',
        props: { gap: 20 },
        style: { padding: 0 },
        children: [{ type: 'column', props: { width: 25 } }, { type: 'column' }],
      },
    ]);
    // (600 - 20) * 25% = 145 (+10 gap) and 435 (+10 gap)
    expect(html).toContain('width="155"');
    expect(html).toContain('width="445"');
  });

  it('gives full-width images an explicit pixel width for Outlook', () => {
    const html = render([
      {
        type: 'image',
        props: { src: 'https://cdn.test/a.png', alt: 'A', width: 'full' },
        style: { padding: { left: 24, right: 24 } },
      },
    ]);
    expect(html).toContain('width="552"');
    expect(html).toContain('alt="A"');
  });

  it('keeps images without a width at their natural size', () => {
    const doc = createDocument({
      blocks: [
        { id: 'logo', type: 'image', props: { src: 'https://cdn.test/logo.png', alt: 'Logo' } },
      ],
    });
    const updated = applyOps(doc, { op: 'update', id: 'logo', props: { width: null } });
    if (!updated.ok) throw new Error('update failed');
    const { html } = renderEmail(updated.document);
    const img = /<img[^>]*>/.exec(html)?.[0] ?? '';
    expect(img).not.toContain('width="');
    expect(img).toContain('max-width:100%');
  });

  it('keeps merge tags verbatim, including as link targets', () => {
    const html = render([
      {
        type: 'text',
        props: { markdown: 'Hi {{ first_name }}, [Unsubscribe]({{unsubscribe_url}})' },
      },
      { type: 'button', props: { href: '{{ cta_url }}' } },
    ]);
    expect(html).toContain('Hi {{ first_name }}');
    expect(html).toContain('href="{{ unsubscribe_url }}"');
    expect(html).toContain('href="{{ cta_url }}"');
    expect(html).not.toContain('%7B');
  });

  it('renders every template without warnings', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(renderEmail(template.create()).warnings).toEqual([]);
    }
  });

  it('warns about Gmail clipping', () => {
    const doc = createDocument({
      blocks: [{ type: 'html', props: { html: 'x'.repeat(110_000) } }],
    });
    expect(renderEmail(doc).warnings[0]?.code).toBe('gmail-clipping');
  });
});

describe('markdown', () => {
  it('supports the restricted subset', () => {
    const html = renderMarkdown('**b** *i* ~~s~~ `c`\n\n- one\n- two\n\n1. first');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<em>i</em>');
    expect(html).toContain('<del>s</del>');
    expect(html).toContain('<code');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
  });

  it('escapes raw HTML and drops unsafe links', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=y>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    const link = renderMarkdown(
      'Click [x](javascript:alert(1)) or [y](data:text/html,1) <b>bold</b>',
    );
    expect(link).not.toContain('href');
    expect(link).toContain('&lt;b&gt;');
  });

  it('turns line breaks into <br> and paragraphs into spaced blocks', () => {
    const html = renderMarkdown('one\ntwo\n\nthree');
    expect(html).toContain('one<br>two');
    expect(html).toContain('margin:1em 0 0 0');
  });

  it('renders inline markdown for headings', () => {
    expect(renderInlineMarkdown('Hello **world**')).toBe('Hello <strong>world</strong>');
  });
});

describe('cli', () => {
  const doc: EmailDocument = TEMPLATES.announcement.create();

  it('renders a document from stdin', () => {
    const output = execFileSync('bun', ['src/render/cli.ts', 'render'], {
      input: JSON.stringify(doc),
      encoding: 'utf8',
    });
    const result = JSON.parse(output);
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.text).toContain('{{ first_name }}');
  });

  it('exits non-zero with issues for an invalid document', () => {
    let status = 0;
    let stdout = '';
    try {
      execFileSync('bun', ['src/render/cli.ts', 'validate'], {
        input: JSON.stringify({ ...doc, root: ['missing'] }),
        encoding: 'utf8',
      });
    } catch (error) {
      status = (error as { status: number }).status;
      stdout = (error as { stdout: string }).stdout;
    }
    expect(status).toBe(1);
    expect(JSON.parse(stdout).issues[0].message).toContain('does not exist');
  });
});
