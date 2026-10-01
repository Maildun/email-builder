import { describe, expect, it } from 'vitest';
import {
  applyOps,
  type BlockInput,
  buildSection,
  createDocument,
  DEFAULT_ASSETS_URL,
  detectNetwork,
  emptyDocument,
  lintDocument,
  renderEmail,
  SECTION_NAMES,
  videoThumbnail,
  youtubeId,
} from '../../src';

function render(blocks: BlockInput[], assetsUrl?: string) {
  return renderEmail(createDocument({ blocks }), assetsUrl ? { assetsUrl } : {});
}

describe('social block', () => {
  const social: BlockInput = {
    type: 'social',
    props: {
      links: [
        { network: 'x', href: 'https://x.com/maildun' },
        { network: 'email', href: 'mailto:hi@maildun.com', label: 'Write to us' },
      ],
      variant: 'brand',
      shape: 'rounded',
      size: 24,
    },
  };

  it('links each icon to its profile with the network as alt text', () => {
    const { html, text } = render([social]);
    expect(html).toContain(`src="${DEFAULT_ASSETS_URL}/social/brand/x.png"`);
    expect(html).toContain('href="https://x.com/maildun"');
    expect(html).toContain('alt="X"');
    expect(html).toContain('alt="Write to us"');
    expect(html).toContain('border-radius:6px');
    expect(text).toBe('X: https://x.com/maildun\nWrite to us: mailto:hi@maildun.com');
  });

  it('loads icons from a self-hosted assets URL', () => {
    const { html } = render([social], 'https://cdn.example.org/mail/');
    expect(html).toContain('src="https://cdn.example.org/mail/social/brand/x.png"');
  });

  it("uses a link's own icon image instead of the built-in one", () => {
    const { html } = render([
      {
        type: 'social',
        props: {
          links: [
            { network: 'x', href: 'https://x.com/maildun', icon: 'https://cdn.maildun.com/x.png' },
            { network: 'github', href: 'https://github.com/maildun' },
          ],
        },
      },
    ]);
    expect(html).toContain('src="https://cdn.maildun.com/x.png"');
    expect(html).not.toContain('/social/dark/x.png');
    expect(html).toContain('/social/dark/github.png');
  });

  it('pins the default icons to this package version on jsDelivr', () => {
    expect(DEFAULT_ASSETS_URL).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@maildun\/email-builder@\d+\.\d+\.\d+.*\/assets$/,
    );
  });

  it('flags links that still point at a network home page', () => {
    const doc = createDocument({
      blocks: [
        {
          type: 'social',
          props: {
            links: [
              { network: 'x', href: 'https://x.com' },
              { network: 'website', href: 'https://maildun.com' },
            ],
          },
        },
      ],
    });
    const warnings = lintDocument(doc).filter((warning) => warning.code === 'placeholder-content');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('x');
    expect(warnings[0]?.message).not.toContain('website');
  });

  it('detects the network from a profile URL', () => {
    expect(detectNetwork('https://www.linkedin.com/company/maildun')).toBe('linkedin');
    expect(detectNetwork('https://twitter.com/maildun')).toBe('x');
    expect(detectNetwork('https://youtu.be/abc')).toBe('youtube');
    expect(detectNetwork('mailto:hi@maildun.com')).toBe('email');
    expect(detectNetwork('https://maildun.com')).toBe('website');
  });
});

describe('video block', () => {
  it('uses the YouTube thumbnail and links the whole poster to the video', () => {
    const { html, text } = render([
      { type: 'video', props: { url: 'https://youtu.be/dQw4w9WgXcQ', alt: 'Watch the launch' } },
    ]);
    expect(html).toContain(
      "background-image:url('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')",
    );
    expect(html).toContain(
      '<v:fill type="frame" src="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"',
    );
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ"');
    expect(html).toContain('aria-label="Watch the launch"');
    // 552px content width at 16:9.
    expect(html).toContain('height="311"');
    expect(text).toBe('Watch the launch: https://youtu.be/dQw4w9WgXcQ');
  });

  it('reads YouTube ids from the common link shapes', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(youtubeId(url)).toBe('dQw4w9WgXcQ');
    }
    expect(youtubeId('https://vimeo.com/76979871')).toBeUndefined();
  });

  it('prefers its own thumbnail and asks for one when it cannot guess', () => {
    expect(
      videoThumbnail({ url: 'https://youtu.be/dQw4w9WgXcQ', thumbnail: 'https://cdn.x/p.jpg' }),
    ).toBe('https://cdn.x/p.jpg');
    const doc = createDocument({
      blocks: [{ type: 'video', props: { url: 'https://vimeo.com/76979871', alt: 'Tour' } }],
    });
    expect(lintDocument(doc).map((warning) => warning.code)).toContain('missing-src');
    expect(
      render([{ type: 'video', props: { url: 'https://vimeo.com/76979871' } }]).html,
    ).not.toContain('v:fill');
  });
});

describe('image block', () => {
  it('rounds the picture itself, not just its cell', () => {
    const { html } = render([
      {
        type: 'image',
        props: { src: 'https://cdn.maildun.com/a.png', alt: 'A', width: 'full' },
        style: { padding: 0, borderRadius: 20 },
      },
    ]);
    expect(html).toMatch(/<img [^>]*style="[^"]*border-radius:20px/);
  });
});

describe('sections', () => {
  it.each(SECTION_NAMES)('%s builds a valid block tree that renders cleanly', (name) => {
    const result = applyOps(emptyDocument(), { op: 'insert', blocks: [buildSection(name)] });
    expect(result.ok ? [] : result.issues).toEqual([]);
    if (!result.ok) return;
    expect(renderEmail(result.document).warnings).toEqual([]);
  });

  it('puts the image on the requested side', () => {
    const left = buildSection('imageText');
    const right = buildSection('imageText', { imageSide: 'right' });
    const firstChild = (input: BlockInput) =>
      'children' in input ? (input.children?.[0] as BlockInput | undefined) : undefined;
    const firstLeaf = (input: BlockInput | undefined) =>
      input && 'children' in input
        ? (input.children?.[0] as BlockInput | undefined)?.type
        : undefined;
    expect(firstLeaf(firstChild(left))).toBe('image');
    expect(firstLeaf(firstChild(right))).toBe('heading');
  });

  it('builds footer social links from profile URLs, or none', () => {
    const footer = buildSection('footer', {
      socialLinks: 'https://github.com/maildun https://bsky.app/profile/maildun.com',
    });
    expect(JSON.stringify(footer)).toContain('"network":"github"');
    expect(JSON.stringify(footer)).toContain('"network":"bluesky"');
    expect(JSON.stringify(buildSection('footer', { socialLinks: '' }))).not.toContain('social');
  });
});
