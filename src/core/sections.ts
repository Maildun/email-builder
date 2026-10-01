import type { BlockInput } from './schema/document';
import { detectNetwork, SOCIAL_STARTER_URLS } from './social';

/** Footer social links from space-separated profile URLs. */
function socialLinks(urls: string | undefined) {
  const list = urls?.split(/\s+/).filter(Boolean) ?? [
    SOCIAL_STARTER_URLS.x,
    SOCIAL_STARTER_URLS.linkedin,
    SOCIAL_STARTER_URLS.instagram,
  ];
  return list.map((href) => ({ network: detectNetwork(href), href }));
}

const PLACEHOLDER_IMAGE = (width: number, height: number) =>
  `https://placehold.co/${width}x${height}/png`;

export interface SectionDefinition<P extends Record<string, string> = Record<string, string>> {
  label: string;
  description: string;
  /** Parameter names agents may pass, with what each means. */
  params: Record<keyof P & string, string>;
  build: (params: Partial<P>) => BlockInput;
}

function define<P extends Record<string, string>>(
  section: SectionDefinition<P>,
): SectionDefinition<P> {
  return section;
}

/**
 * Ready-made groups of blocks. Agents compose emails much more reliably from
 * sections than from single primitives.
 */
export const SECTIONS = {
  header: define<{ logoSrc: string; logoAlt: string; href: string }>({
    label: 'Header',
    description: 'Centered logo at the top of the email.',
    params: { logoSrc: 'Logo image URL', logoAlt: 'Company name', href: 'Website URL' },
    build: (p) => ({
      type: 'image',
      props: {
        src: p.logoSrc ?? 'https://placehold.co/240x64/png?text=Logo',
        alt: p.logoAlt ?? 'Logo',
        width: 120,
        ...(p.href ? { href: p.href } : {}),
      },
      style: { padding: { top: 24, right: 24, bottom: 16, left: 24 }, align: 'center' },
    }),
  }),
  navHeader: define<{ logoSrc: string; logoAlt: string; href: string; links: string }>({
    label: 'Nav header',
    description: 'Logo on the left and a few text links on the right.',
    params: {
      logoSrc: 'Logo image URL',
      logoAlt: 'Company name',
      href: 'Website URL',
      links: 'Markdown links separated by " · ", e.g. "[Shop](https://…) · [Blog](https://…)"',
    },
    build: (p) => ({
      type: 'columns',
      props: { gap: 16, verticalAlign: 'middle', stackOnMobile: false },
      style: { padding: { top: 20, right: 24, bottom: 20, left: 24 } },
      children: [
        {
          type: 'column',
          props: { width: 40 },
          children: [
            {
              type: 'image',
              props: {
                src: p.logoSrc ?? 'https://placehold.co/240x64/png?text=Logo',
                alt: p.logoAlt ?? 'Logo',
                width: 120,
                ...(p.href ? { href: p.href } : {}),
              },
              style: { padding: 0, align: 'left' },
            },
          ],
        },
        {
          type: 'column',
          children: [
            {
              type: 'text',
              props: {
                markdown:
                  p.links ??
                  '[Shop](https://example.com/shop) · [Blog](https://example.com/blog) · [Contact](https://example.com/contact)',
              },
              style: { padding: 0, align: 'right', fontSize: 14 },
            },
          ],
        },
      ],
    }),
  }),
  hero: define<{
    heading: string;
    text: string;
    buttonText: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
  }>({
    label: 'Hero',
    description: 'Large image, headline, supporting copy and a primary button.',
    params: {
      heading: 'Headline',
      text: 'Supporting paragraph (markdown)',
      buttonText: 'Button label',
      href: 'Button link',
      imageSrc: 'Hero image URL (omit for no image)',
      imageAlt: 'Hero image alt text',
    },
    build: (p) => ({
      type: 'container',
      style: { padding: { top: 0, right: 0, bottom: 16, left: 0 } },
      children: [
        ...(p.imageSrc
          ? [
              {
                type: 'image' as const,
                props: { src: p.imageSrc, alt: p.imageAlt ?? '', width: 'full' as const },
                style: { padding: 0 },
              },
            ]
          : []),
        {
          type: 'heading',
          props: { text: p.heading ?? 'A headline worth opening', level: 1 },
          style: { padding: { top: 24, right: 24, bottom: 8, left: 24 }, align: 'center' },
        },
        {
          type: 'text',
          props: {
            markdown: p.text ?? 'One or two sentences that tell the reader why this matters.',
          },
          style: {
            padding: { top: 0, right: 40, bottom: 8, left: 40 },
            align: 'center',
            color: '$muted',
          },
        },
        {
          type: 'button',
          props: { text: p.buttonText ?? 'Learn more', href: p.href ?? 'https://example.com' },
          style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, align: 'center' },
        },
      ],
    }),
  }),
  article: define<{ heading: string; text: string }>({
    label: 'Article',
    description: 'A heading followed by body copy.',
    params: { heading: 'Section heading', text: 'Body (markdown)' },
    build: (p) => ({
      type: 'container',
      children: [
        { type: 'heading', props: { text: p.heading ?? 'Section heading', level: 2 } },
        { type: 'text', props: { markdown: p.text ?? 'Tell the story here.' } },
      ],
    }),
  }),
  features: define<{
    title1: string;
    text1: string;
    title2: string;
    text2: string;
    title3: string;
    text3: string;
  }>({
    label: 'Features',
    description: 'Three columns with a short title and text each; stacks on mobile.',
    params: {
      title1: 'First title',
      text1: 'First text',
      title2: 'Second title',
      text2: 'Second text',
      title3: 'Third title',
      text3: 'Third text',
    },
    build: (p) => ({
      type: 'columns',
      props: { gap: 16 },
      children: ([1, 2, 3] as const).map((n) => ({
        type: 'column' as const,
        children: [
          {
            type: 'heading' as const,
            props: { text: p[`title${n}`] ?? `Feature ${n}`, level: 3 as const },
            style: { padding: { top: 8, right: 0, bottom: 4, left: 0 } },
          },
          {
            type: 'text' as const,
            props: { markdown: p[`text${n}`] ?? 'A short benefit-focused sentence.' },
            style: {
              padding: { top: 0, right: 0, bottom: 8, left: 0 },
              fontSize: 14,
              color: '$muted',
            },
          },
        ],
      })),
    }),
  }),
  imageText: define<{
    heading: string;
    text: string;
    buttonText: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
    imageSide: string;
  }>({
    label: 'Image and text',
    description: 'An image beside a heading, copy and a button; stacks on mobile.',
    params: {
      heading: 'Heading',
      text: 'Body (markdown)',
      buttonText: 'Button label (omit for no button)',
      href: 'Button link',
      imageSrc: 'Image URL',
      imageAlt: 'Image alt text',
      imageSide: '"left" (default) or "right"',
    },
    build: (p) => {
      const image = {
        type: 'column' as const,
        props: { width: 45 },
        children: [
          {
            type: 'image' as const,
            props: {
              src: p.imageSrc ?? PLACEHOLDER_IMAGE(480, 360),
              alt: p.imageAlt ?? '',
              width: 'full' as const,
            },
            style: { padding: 0, borderRadius: 6 },
          },
        ],
      };
      const copy = {
        type: 'column' as const,
        children: [
          {
            type: 'heading' as const,
            props: { text: p.heading ?? 'A closer look', level: 3 as const },
            style: { padding: { top: 0, right: 0, bottom: 8, left: 0 } },
          },
          {
            type: 'text' as const,
            props: {
              markdown:
                p.text ?? 'Two or three sentences about what is pictured and why it matters.',
            },
            style: { padding: { top: 0, right: 0, bottom: 8, left: 0 }, color: '$muted' },
          },
          ...(p.buttonText === ''
            ? []
            : [
                {
                  type: 'button' as const,
                  props: {
                    text: p.buttonText ?? 'Read more',
                    href: p.href ?? 'https://example.com',
                    size: 'sm' as const,
                  },
                  style: { padding: { top: 8, right: 0, bottom: 0, left: 0 } },
                },
              ]),
        ],
      };
      return {
        type: 'columns',
        props: { gap: 24, verticalAlign: 'middle' },
        style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
        children: p.imageSide === 'right' ? [copy, image] : [image, copy],
      };
    },
  }),
  cards: define<{
    title1: string;
    text1: string;
    href1: string;
    imageSrc1: string;
    title2: string;
    text2: string;
    href2: string;
    imageSrc2: string;
    buttonText: string;
  }>({
    label: 'Two cards',
    description:
      'Two side-by-side cards with an image, title, text and link, e.g. products or posts.',
    params: {
      title1: 'First title',
      text1: 'First text',
      href1: 'First link',
      imageSrc1: 'First image URL',
      title2: 'Second title',
      text2: 'Second text',
      href2: 'Second link',
      imageSrc2: 'Second image URL',
      buttonText: 'Label for both buttons',
    },
    build: (p) => ({
      type: 'columns',
      props: { gap: 16 },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
      children: ([1, 2] as const).map((n) => ({
        type: 'column' as const,
        children: [
          {
            type: 'image' as const,
            props: {
              src: p[`imageSrc${n}`] ?? PLACEHOLDER_IMAGE(520, 360),
              alt: p[`title${n}`] ?? '',
              width: 'full' as const,
              ...(p[`href${n}`] ? { href: p[`href${n}`] } : {}),
            },
            style: { padding: { top: 0, right: 0, bottom: 12, left: 0 }, borderRadius: 6 },
          },
          {
            type: 'heading' as const,
            props: { text: p[`title${n}`] ?? `Card title ${n}`, level: 3 as const },
            style: { padding: { top: 0, right: 0, bottom: 4, left: 0 } },
          },
          {
            type: 'text' as const,
            props: { markdown: p[`text${n}`] ?? 'A short description that makes people click.' },
            style: {
              padding: { top: 0, right: 0, bottom: 8, left: 0 },
              fontSize: 14,
              color: '$muted',
            },
          },
          {
            type: 'button' as const,
            props: {
              text: p.buttonText ?? 'View',
              href: p[`href${n}`] ?? 'https://example.com',
              size: 'sm' as const,
            },
            style: { padding: { top: 4, right: 0, bottom: 0, left: 0 } },
          },
        ],
      })),
    }),
  }),
  gallery: define<{ imageSrc1: string; imageSrc2: string; imageSrc3: string; imageSrc4: string }>({
    label: 'Gallery',
    description: 'A 2×2 grid of images.',
    params: {
      imageSrc1: 'Top-left image URL',
      imageSrc2: 'Top-right image URL',
      imageSrc3: 'Bottom-left image URL',
      imageSrc4: 'Bottom-right image URL',
    },
    build: (p) => ({
      type: 'container',
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
      children: (
        [
          [1, 2],
          [3, 4],
        ] as const
      ).map((row, rowIndex) => ({
        type: 'columns' as const,
        props: { gap: 8, stackOnMobile: false },
        style: { padding: { top: rowIndex === 0 ? 0 : 8, right: 0, bottom: 0, left: 0 } },
        children: row.map((n) => ({
          type: 'column' as const,
          children: [
            {
              type: 'image' as const,
              props: {
                src: p[`imageSrc${n}`] ?? PLACEHOLDER_IMAGE(520, 520),
                alt: '',
                width: 'full' as const,
              },
              style: { padding: 0, borderRadius: 6 },
            },
          ],
        })),
      })),
    }),
  }),
  testimonial: define<{ quote: string; name: string; role: string; avatarSrc: string }>({
    label: 'Testimonial',
    description: 'A customer quote with their photo, name and role.',
    params: {
      quote: 'The quote, without quotation marks',
      name: 'Who said it',
      role: 'Their role and company',
      avatarSrc: 'Photo URL',
    },
    build: (p) => ({
      type: 'container',
      style: {
        backgroundColor: '$background',
        borderRadius: 8,
        padding: { top: 28, right: 32, bottom: 28, left: 32 },
        align: 'center',
      },
      children: [
        {
          type: 'text',
          props: {
            markdown: `“${p.quote ?? 'This changed how our whole team works. I can’t imagine going back.'}”`,
          },
          style: {
            padding: { top: 0, right: 0, bottom: 16, left: 0 },
            align: 'center',
            fontSize: 18,
            lineHeight: 1.5,
          },
        },
        {
          type: 'avatar',
          props: {
            src: p.avatarSrc ?? 'https://placehold.co/128x128/png',
            alt: p.name ?? 'Customer photo',
            size: 48,
            shape: 'circle',
          },
          style: { padding: { top: 0, right: 0, bottom: 8, left: 0 }, align: 'center' },
        },
        {
          type: 'text',
          props: {
            markdown: `**${p.name ?? 'Alex Morgan'}**  \n${p.role ?? 'Head of Growth, Acme'}`,
          },
          style: { padding: 0, align: 'center', fontSize: 14, color: '$muted' },
        },
      ],
    }),
  }),
  promo: define<{ heading: string; code: string; text: string; buttonText: string; href: string }>({
    label: 'Promo code',
    description: 'A discount code in a dashed box with a button to redeem it.',
    params: {
      heading: 'Offer headline',
      code: 'The code to copy',
      text: 'Terms or expiry (markdown)',
      buttonText: 'Button label',
      href: 'Shop link',
    },
    build: (p) => ({
      type: 'container',
      style: {
        backgroundColor: '$background',
        borderRadius: 8,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        align: 'center',
      },
      children: [
        {
          type: 'heading',
          props: { text: p.heading ?? '20% off your next order', level: 2 },
          style: { padding: { top: 0, right: 0, bottom: 16, left: 0 }, align: 'center' },
        },
        {
          type: 'container',
          style: {
            backgroundColor: '$surface',
            border: { width: 2, style: 'dashed', color: '$primary' },
            borderRadius: 6,
            padding: { top: 12, right: 16, bottom: 12, left: 16 },
            align: 'center',
          },
          children: [
            {
              type: 'heading',
              props: { text: p.code ?? 'SAVE20', level: 2 },
              style: { padding: 0, align: 'center', letterSpacing: 4, color: '$primary' },
            },
          ],
        },
        {
          type: 'text',
          props: { markdown: p.text ?? 'Use this code at checkout. Ends Sunday at midnight.' },
          style: {
            padding: { top: 12, right: 0, bottom: 0, left: 0 },
            align: 'center',
            fontSize: 14,
            color: '$muted',
          },
        },
        {
          type: 'button',
          props: { text: p.buttonText ?? 'Shop now', href: p.href ?? 'https://example.com' },
          style: { padding: { top: 16, right: 0, bottom: 0, left: 0 }, align: 'center' },
        },
      ],
    }),
  }),
  signoff: define<{ closing: string; name: string; role: string; avatarSrc: string }>({
    label: 'Sign-off',
    description: 'A personal closing line with the sender’s photo, name and title.',
    params: {
      closing: 'Closing line, e.g. "Thanks for reading,"',
      name: 'Sender name',
      role: 'Sender title and company',
      avatarSrc: 'Sender photo URL',
    },
    build: (p) => ({
      type: 'container',
      style: { padding: { top: 8, right: 0, bottom: 8, left: 0 } },
      children: [
        {
          type: 'text',
          props: { markdown: p.closing ?? 'Thanks for reading,' },
          style: { padding: { top: 8, right: 24, bottom: 12, left: 24 } },
        },
        {
          type: 'columns',
          props: { gap: 12, verticalAlign: 'middle', stackOnMobile: false },
          style: { padding: { top: 0, right: 24, bottom: 8, left: 24 } },
          children: [
            {
              type: 'column',
              props: { width: 12 },
              children: [
                {
                  type: 'avatar',
                  props: {
                    src: p.avatarSrc ?? 'https://placehold.co/128x128/png',
                    alt: p.name ?? 'Sender photo',
                    size: 48,
                    shape: 'circle',
                  },
                  style: { padding: 0 },
                },
              ],
            },
            {
              type: 'column',
              children: [
                {
                  type: 'text',
                  props: {
                    markdown: `**${p.name ?? 'Sam Lee'}**  \n${p.role ?? 'Founder, Your Company'}`,
                  },
                  style: { padding: 0, fontSize: 14, lineHeight: 1.4 },
                },
              ],
            },
          ],
        },
      ],
    }),
  }),
  cta: define<{ heading: string; buttonText: string; href: string }>({
    label: 'Call to action',
    description: 'Highlighted band with a heading and a button.',
    params: { heading: 'Heading', buttonText: 'Button label', href: 'Button link' },
    build: (p) => ({
      type: 'container',
      style: {
        backgroundColor: '$background',
        borderRadius: 8,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
        align: 'center',
      },
      children: [
        {
          type: 'heading',
          props: { text: p.heading ?? 'Ready to get started?', level: 2 },
          style: { padding: { top: 0, right: 0, bottom: 8, left: 0 }, align: 'center' },
        },
        {
          type: 'button',
          props: { text: p.buttonText ?? 'Get started', href: p.href ?? 'https://example.com' },
          style: { padding: { top: 8, right: 0, bottom: 0, left: 0 }, align: 'center' },
        },
      ],
    }),
  }),
  footer: define<{ company: string; address: string; socialLinks: string }>({
    label: 'Footer',
    description:
      'Social icons and muted small print with company details and the unsubscribe link.',
    params: {
      company: 'Company name',
      address: 'Postal address',
      socialLinks:
        'Profile URLs separated by spaces; the network is detected from each URL. "" for no icons',
    },
    build: (p) => ({
      type: 'container',
      style: { padding: { top: 24, right: 0, bottom: 8, left: 0 } },
      children: [
        {
          type: 'divider',
          props: { color: '$border' },
          style: { padding: { top: 0, right: 24, bottom: 16, left: 24 } },
        },
        ...(p.socialLinks === ''
          ? []
          : [
              {
                type: 'social' as const,
                props: {
                  links: socialLinks(p.socialLinks),
                  variant: 'light' as const,
                  size: 28,
                  gap: 10,
                },
                style: {
                  padding: { top: 0, right: 24, bottom: 12, left: 24 },
                  align: 'center' as const,
                },
              },
            ]),
        {
          type: 'text',
          props: {
            markdown: `${p.company ?? 'Your Company'} · ${p.address ?? '123 Main Street, City'}\n\nYou received this email because you subscribed. [Unsubscribe]({{ unsubscribe_url }})`,
          },
          style: {
            align: 'center',
            fontSize: 12,
            color: '$muted',
            padding: { top: 0, right: 24, bottom: 0, left: 24 },
          },
        },
      ],
    }),
  }),
} satisfies Record<string, SectionDefinition<never>>;

export type SectionName = keyof typeof SECTIONS;

export const SECTION_NAMES = Object.keys(SECTIONS) as SectionName[];

export function buildSection(name: SectionName, params: Record<string, string> = {}): BlockInput {
  return (SECTIONS[name] as SectionDefinition).build(params);
}
