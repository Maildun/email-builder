import { describe, expect, it } from 'vitest';
import {
  applyOps,
  type BlockInput,
  createDocument,
  type EmailDocument,
  lintDocument,
  renderEmail,
  resolveThemeStyles,
} from '../../src';

type Styles = NonNullable<EmailDocument['theme']['styles']>;

function render(blocks: BlockInput[], styles?: Styles) {
  return renderEmail(createDocument({ theme: styles ? { styles } : {}, blocks })).html;
}

const button: BlockInput = { type: 'button', props: { text: 'Go', href: 'https://maildun.com' } };

describe('theme styles', () => {
  it('fill gaps from the defaults', () => {
    const styles = resolveThemeStyles({
      ...createDocument().theme,
      styles: { button: { variant: 'outline' } },
    });
    expect(styles.button).toMatchObject({ variant: 'outline', shape: 'rounded', radius: 6 });
    expect(styles.image.radius).toBe(0);
  });

  it('render buttons as before when the theme has no styles', () => {
    const html = render([button]);
    expect(html).toContain('background-color:#1f6feb');
    expect(html).toContain('border-radius:6px');
    expect(html).toContain('fillcolor="#1f6feb"');
  });

  it('style every button that does not set its own variant and shape', () => {
    const html = render([button], {
      button: { variant: 'outline', shape: 'pill', uppercase: true },
    });
    expect(html).toContain('border:2px solid #1f6feb');
    expect(html).toContain('filled="f"');
    expect(html).toContain('strokecolor="#1f6feb"');
    expect(html).toContain('>GO</a>');
    expect(html).not.toContain('background-color:#1f6feb');
  });

  it('let a block override the theme', () => {
    const html = render(
      [{ ...button, props: { ...button.props, variant: 'solid', shape: 'rectangle' } }],
      { button: { variant: 'outline', shape: 'pill' } },
    );
    expect(html).toContain('background-color:#1f6feb');
    expect(html).toContain('border-radius:0');
  });

  it('tint soft buttons and underline link buttons', () => {
    expect(render([button], { button: { variant: 'soft' } })).toMatch(
      /background-color:#[0-9a-f]{6};/,
    );
    const link = render([button], { button: { variant: 'link' } });
    expect(link).toContain('text-decoration:underline');
    expect(link).not.toContain('v:roundrect');
  });

  it('round images and cards', () => {
    const html = render(
      [
        { type: 'image', props: { src: 'https://maildun.com/a.png', alt: 'A' } },
        {
          type: 'container',
          props: { card: true },
          style: { backgroundColor: '$background' },
          children: [{ type: 'text', props: { markdown: 'Hi' } }],
        },
      ],
      { image: { radius: 12 }, card: { radius: 16, border: true, shadow: 'md' } },
    );
    expect(html).toContain('border-radius:12px');
    expect(html).toContain('border-radius:16px');
    expect(html).toContain('border:1px solid #d8dee4');
    expect(html).toContain('box-shadow:0 4px 12px');
  });

  it('draw dashed dividers with a border', () => {
    const html = render([{ type: 'divider' }], { divider: { style: 'dashed', thickness: 2 } });
    expect(html).toContain('border-top:2px dashed');
  });

  it('merge field by field through updateTheme, and null removes', () => {
    let document = createDocument({
      theme: { styles: { button: { variant: 'soft', size: 'lg' } } },
    });
    const first = applyOps(document, {
      op: 'updateTheme',
      styles: { button: { size: null }, image: { radius: 8 } },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    document = first.document;
    expect(document.theme.styles).toEqual({ button: { variant: 'soft' }, image: { radius: 8 } });
    const invalid = applyOps(document, {
      op: 'updateTheme',
      styles: { button: { variant: 'fancy' } },
    });
    expect(invalid.ok).toBe(false);
  });

  it('check the label of outline buttons against the canvas', () => {
    const document = createDocument({
      theme: { colors: { primary: '#f0f0f0' }, styles: { button: { variant: 'outline' } } },
      blocks: [button],
    });
    expect(lintDocument(document).some((warning) => warning.code === 'low-contrast')).toBe(true);
  });
});
