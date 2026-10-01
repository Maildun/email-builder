import type { BlockInput } from './schema/document';

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
  footer: define<{ company: string; address: string }>({
    label: 'Footer',
    description: 'Muted small print with company details and the unsubscribe link.',
    params: { company: 'Company name', address: 'Postal address' },
    build: (p) => ({
      type: 'container',
      style: { padding: { top: 24, right: 0, bottom: 8, left: 0 } },
      children: [
        {
          type: 'divider',
          props: { color: '$border' },
          style: { padding: { top: 0, right: 24, bottom: 16, left: 24 } },
        },
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
