import { z } from 'zod';
import { SOCIAL_NETWORKS } from '../social';
import {
  AlignStyleShape,
  BoxStyleShape,
  ButtonShapeSchema,
  ButtonSizeSchema,
  ButtonVariantSchema,
  ColorSchema,
  LineStyleSchema,
  TypographyStyleShape,
  UrlSchema,
  VerticalAlignSchema,
} from './primitives';

const BoxStyle = z.strictObject({ ...BoxStyleShape });
const BoxAlignStyle = z.strictObject({ ...BoxStyleShape, ...AlignStyleShape });
const TextStyle = z.strictObject({ ...BoxStyleShape, ...AlignStyleShape, ...TypographyStyleShape });
const ButtonStyle = z.strictObject({
  ...BoxStyleShape,
  ...AlignStyleShape,
  fontFamily: TypographyStyleShape.fontFamily,
  fontSize: TypographyStyleShape.fontSize,
  fontWeight: TypographyStyleShape.fontWeight,
  letterSpacing: TypographyStyleShape.letterSpacing,
});

export const HeadingProps = z.strictObject({
  text: z
    .string()
    .max(500)
    .optional()
    .describe('Heading text. Inline markdown allowed: **bold**, *italic*, [link](url), `code`.'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe('1 = 32px, 2 = 24px, 3 = 20px unless style.fontSize is set.'),
});

export const TextProps = z.strictObject({
  markdown: z
    .string()
    .max(50_000)
    .optional()
    .describe(
      'Body copy as restricted markdown: paragraphs (blank line), line breaks, **bold**, *italic*, ~~strike~~, `code`, [links](https://…), "- " bullet and "1. " numbered lists. Raw HTML is escaped; use an html block for custom markup.',
    ),
});

export const ButtonProps = z.strictObject({
  text: z.string().max(200).optional().describe('Button label.'),
  href: UrlSchema.optional(),
  variant: ButtonVariantSchema.optional().describe(
    `${ButtonVariantSchema.description} Omit to follow the theme's button style.`,
  ),
  shape: ButtonShapeSchema.optional().describe(
    `${ButtonShapeSchema.description} Omit to follow the theme's button style.`,
  ),
  size: ButtonSizeSchema.optional().describe("Omit to follow the theme's button style."),
  fullWidth: z.boolean().optional().describe('Stretch the button to the full content width.'),
  buttonColor: ColorSchema.optional().describe(
    'Button color: the fill of solid buttons, the tint, border or text of the other variants. Defaults to $primary.',
  ),
  textColor: ColorSchema.optional().describe(
    'Label color. Defaults to white on solid buttons and to the button color otherwise.',
  ),
});

export const ImageProps = z.strictObject({
  src: UrlSchema.optional().describe('Absolute image URL (https://…).'),
  alt: z.string().max(500).optional().describe('Alternative text. Always describe the image.'),
  href: UrlSchema.optional().describe('Optional link target when the image is clicked.'),
  width: z
    .union([z.number().int().min(1).max(1200), z.literal('full')])
    .optional()
    .describe('Width in px, or "full" to fill the content width. Omit to keep the natural size.'),
  height: z.number().int().min(1).max(2000).optional().describe('Height in px. Usually omitted.'),
});

export const VideoProps = z.strictObject({
  url: UrlSchema.optional().describe('Where the video plays, e.g. a YouTube or Vimeo link.'),
  thumbnail: UrlSchema.optional().describe(
    "Poster image URL. Omit for YouTube links to use the video's own thumbnail.",
  ),
  alt: z.string().max(500).optional().describe('Describe the video, e.g. "Watch: product tour".'),
  width: z
    .union([z.number().int().min(80).max(1200), z.literal('full')])
    .optional()
    .describe('Width in px, or "full" to fill the content width. Shown at 16:9.'),
});

export const SocialLinkSchema = z.strictObject({
  network: z.enum(SOCIAL_NETWORKS),
  href: UrlSchema.describe('Profile URL (mailto: for email).'),
  label: z.string().max(100).optional().describe('Alt text; defaults to the network name.'),
  icon: UrlSchema.optional().describe(
    'Your own icon image (square works best). Omit to use the built-in icon.',
  ),
});

export const SocialProps = z.strictObject({
  links: z.array(SocialLinkSchema).max(16).optional().describe('Icons in order.'),
  variant: z
    .enum(['brand', 'dark', 'light'])
    .optional()
    .describe("brand = each network's color, dark = black tiles, light = gray tiles."),
  shape: z.enum(['circle', 'rounded', 'square']).optional(),
  size: z.number().int().min(16).max(48).optional().describe('Icon size in px.'),
  gap: z.number().int().min(0).max(32).optional().describe('Space between icons in px.'),
});

export const AvatarProps = z.strictObject({
  src: UrlSchema.optional(),
  alt: z.string().max(500).optional(),
  size: z.number().int().min(16).max(256).optional().describe('Diameter in px.'),
  shape: z.enum(['circle', 'square', 'rounded']).optional(),
});

export const DividerProps = z.strictObject({
  color: ColorSchema.optional(),
  thickness: z.number().int().min(1).max(24).optional().describe('Line thickness in px.'),
  width: z.number().int().min(1).max(100).optional().describe('Line width as % of the content.'),
  lineStyle: LineStyleSchema.optional().describe("Omit to follow the theme's divider style."),
});

export const SpacerProps = z.strictObject({
  height: z.number().int().min(1).max(400).optional().describe('Vertical space in px.'),
});

export const HtmlProps = z.strictObject({
  html: z
    .string()
    .max(500_000)
    .optional()
    .describe('Raw HTML inserted as-is. Use only when no other block fits.'),
});

export const CustomProps = z.strictObject({
  name: z
    .string()
    .regex(
      /^[a-z][a-z0-9-]{0,63}$/,
      'Use lowercase letters, digits and dashes, e.g. "product-card".',
    )
    .describe('Name of a custom block type the host app defined, e.g. "product-card".'),
  data: z
    .record(z.string(), z.json())
    .optional()
    .describe("The custom block's content; its shape is set by the custom block definition."),
});

const CardSchema = z
  .boolean()
  .optional()
  .describe(
    "Style as a card with the theme's card radius, border and shadow. Give it a backgroundColor such as $surface or $background.",
  );

export const ContainerProps = z.strictObject({ card: CardSchema });

export const ColumnsProps = z.strictObject({
  gap: z.number().int().min(0).max(80).optional().describe('Space between columns in px.'),
  verticalAlign: VerticalAlignSchema.optional(),
  stackOnMobile: z
    .boolean()
    .optional()
    .describe('Stack columns vertically on small screens (default true).'),
});

export const ColumnProps = z.strictObject({
  width: z
    .number()
    .min(5)
    .max(100)
    .optional()
    .describe('Column width as % of the row. Omit to share the remaining space equally.'),
  card: CardSchema,
});

/**
 * Registry of every block type: schemas, defaults and the documentation the
 * agent prompt is generated from. The order is the palette order.
 */
export const BLOCK_DEFINITIONS = {
  heading: {
    label: 'Heading',
    description: 'A title or section heading.',
    category: 'content',
    props: HeadingProps,
    style: TextStyle,
    container: false,
    defaults: {
      props: { text: 'Heading', level: 2 },
      style: { padding: { top: 16, right: 24, bottom: 8, left: 24 } },
    },
  },
  text: {
    label: 'Text',
    description: 'Paragraphs of body copy written in restricted markdown.',
    category: 'content',
    props: TextProps,
    style: TextStyle,
    container: false,
    defaults: {
      props: { markdown: 'Write something people want to read.' },
      style: { padding: { top: 8, right: 24, bottom: 8, left: 24 } },
    },
  },
  button: {
    label: 'Button',
    description: 'A call-to-action link styled as a button. Outlook-safe.',
    category: 'content',
    props: ButtonProps,
    style: ButtonStyle,
    container: false,
    defaults: {
      props: {
        text: 'Get started',
        href: 'https://example.com',
        fullWidth: false,
        buttonColor: '$primary',
      },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
    },
  },
  social: {
    label: 'Social',
    description: 'A row of social network icons linking to your profiles.',
    category: 'content',
    props: SocialProps,
    style: BoxAlignStyle,
    container: false,
    defaults: {
      props: {
        links: [
          { network: 'x', href: 'https://x.com' },
          { network: 'linkedin', href: 'https://linkedin.com' },
          { network: 'instagram', href: 'https://instagram.com' },
          { network: 'youtube', href: 'https://youtube.com' },
        ],
        variant: 'dark',
        shape: 'circle',
        size: 32,
        gap: 12,
      },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, align: 'center' },
    },
  },
  image: {
    label: 'Image',
    description: 'A picture, optionally linked.',
    category: 'media',
    props: ImageProps,
    style: BoxAlignStyle,
    container: false,
    defaults: {
      props: { src: 'https://placehold.co/1104x552/png', alt: '', width: 'full' },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, align: 'center' },
    },
  },
  video: {
    label: 'Video',
    description:
      'A video thumbnail with a play button that links to the video (email cannot play video inline).',
    category: 'media',
    props: VideoProps,
    style: BoxAlignStyle,
    container: false,
    defaults: {
      props: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        alt: 'Watch the video',
        width: 'full',
      },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, align: 'center' },
    },
  },
  avatar: {
    label: 'Avatar',
    description: 'A small round or square portrait or logo.',
    category: 'media',
    props: AvatarProps,
    style: BoxAlignStyle,
    container: false,
    defaults: {
      props: { src: 'https://placehold.co/128x128/png', alt: '', size: 64, shape: 'circle' },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, align: 'left' },
    },
  },
  divider: {
    label: 'Divider',
    description: 'A horizontal rule separating content.',
    category: 'layout',
    props: DividerProps,
    style: BoxStyle,
    container: false,
    defaults: {
      props: { color: '$border', width: 100 },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
    },
  },
  spacer: {
    label: 'Spacer',
    description: 'Empty vertical space.',
    category: 'layout',
    props: SpacerProps,
    style: BoxStyle,
    container: false,
    defaults: { props: { height: 24 }, style: {} },
  },
  html: {
    label: 'HTML',
    description: 'Raw HTML for anything the other blocks cannot express.',
    category: 'advanced',
    props: HtmlProps,
    style: TextStyle,
    container: false,
    defaults: {
      props: { html: '<p>Custom <strong>HTML</strong></p>' },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
    },
  },
  custom: {
    label: 'Custom',
    description:
      'A block type defined by the host app (see "Custom blocks"). props.name picks the type, props.data holds its content.',
    category: 'advanced',
    props: CustomProps,
    style: BoxAlignStyle,
    container: false,
    defaults: {
      props: { name: 'custom', data: {} },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 } },
    },
  },
  container: {
    label: 'Container',
    description: 'Groups blocks with a shared background, border or padding.',
    category: 'layout',
    props: ContainerProps,
    style: BoxAlignStyle,
    container: true,
    defaults: { props: {}, style: { padding: { top: 16, right: 0, bottom: 16, left: 0 } } },
  },
  columns: {
    label: 'Columns',
    description: 'A row of 1–4 column blocks. Children must be "column" blocks.',
    category: 'layout',
    props: ColumnsProps,
    style: BoxStyle,
    container: true,
    defaults: {
      props: { gap: 16, verticalAlign: 'top', stackOnMobile: true },
      style: { padding: { top: 8, right: 24, bottom: 8, left: 24 } },
    },
  },
  column: {
    label: 'Column',
    description:
      'One column inside a columns block. Holds any blocks, including another columns row.',
    category: 'layout',
    props: ColumnProps,
    style: BoxStyle,
    container: true,
    defaults: { props: {}, style: {} },
  },
} as const;

export type BlockType = keyof typeof BLOCK_DEFINITIONS;

export const BLOCK_TYPES = Object.keys(BLOCK_DEFINITIONS) as BlockType[];

export type BlockDefinition<T extends BlockType = BlockType> = (typeof BLOCK_DEFINITIONS)[T];

export type BlockProps<T extends BlockType> = z.infer<(typeof BLOCK_DEFINITIONS)[T]['props']>;
export type BlockStyle<T extends BlockType> = z.infer<(typeof BLOCK_DEFINITIONS)[T]['style']>;

export function isContainerType(type: BlockType): boolean {
  return BLOCK_DEFINITIONS[type].container;
}

/** Which parent types may hold a given child type. `root` is the document body. */
export function canContain(parentType: BlockType | 'root', childType: BlockType): boolean {
  if (parentType === 'columns') {
    return childType === 'column';
  }
  if (childType === 'column') {
    return false;
  }
  return parentType === 'root' || parentType === 'container' || parentType === 'column';
}

const childrenShape = { children: z.array(z.string()).describe('Ids of child blocks, in order.') };

export const HeadingBlockSchema = z.strictObject({
  type: z.literal('heading'),
  props: HeadingProps,
  style: TextStyle.optional(),
});
export const TextBlockSchema = z.strictObject({
  type: z.literal('text'),
  props: TextProps,
  style: TextStyle.optional(),
});
export const ButtonBlockSchema = z.strictObject({
  type: z.literal('button'),
  props: ButtonProps,
  style: ButtonStyle.optional(),
});
export const ImageBlockSchema = z.strictObject({
  type: z.literal('image'),
  props: ImageProps,
  style: BoxAlignStyle.optional(),
});
export const SocialBlockSchema = z.strictObject({
  type: z.literal('social'),
  props: SocialProps,
  style: BoxAlignStyle.optional(),
});
export const VideoBlockSchema = z.strictObject({
  type: z.literal('video'),
  props: VideoProps,
  style: BoxAlignStyle.optional(),
});
export const AvatarBlockSchema = z.strictObject({
  type: z.literal('avatar'),
  props: AvatarProps,
  style: BoxAlignStyle.optional(),
});
export const DividerBlockSchema = z.strictObject({
  type: z.literal('divider'),
  props: DividerProps,
  style: BoxStyle.optional(),
});
export const SpacerBlockSchema = z.strictObject({
  type: z.literal('spacer'),
  props: SpacerProps,
  style: BoxStyle.optional(),
});
export const HtmlBlockSchema = z.strictObject({
  type: z.literal('html'),
  props: HtmlProps,
  style: TextStyle.optional(),
});
export const CustomBlockSchema = z.strictObject({
  type: z.literal('custom'),
  props: CustomProps,
  style: BoxAlignStyle.optional(),
});
export const ContainerBlockSchema = z.strictObject({
  type: z.literal('container'),
  props: ContainerProps,
  style: BoxAlignStyle.optional(),
  ...childrenShape,
});
export const ColumnsBlockSchema = z.strictObject({
  type: z.literal('columns'),
  props: ColumnsProps,
  style: BoxStyle.optional(),
  ...childrenShape,
});
export const ColumnBlockSchema = z.strictObject({
  type: z.literal('column'),
  props: ColumnProps,
  style: BoxStyle.optional(),
  ...childrenShape,
});

export const BlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  TextBlockSchema,
  ButtonBlockSchema,
  SocialBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  AvatarBlockSchema,
  DividerBlockSchema,
  SpacerBlockSchema,
  HtmlBlockSchema,
  CustomBlockSchema,
  ContainerBlockSchema,
  ColumnsBlockSchema,
  ColumnBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
export type ContainerBlock = Extract<Block, { children: string[] }>;

export function hasChildren(block: Block): block is ContainerBlock {
  return 'children' in block && Array.isArray(block.children);
}
