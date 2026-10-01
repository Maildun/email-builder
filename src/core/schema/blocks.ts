import { z } from 'zod';
import {
  AlignStyleShape,
  BoxStyleShape,
  ColorSchema,
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
  shape: z.enum(['rectangle', 'rounded', 'pill']).optional(),
  size: z.enum(['xs', 'sm', 'md', 'lg']).optional(),
  fullWidth: z.boolean().optional().describe('Stretch the button to the full content width.'),
  buttonColor: ColorSchema.optional().describe('Button fill color.'),
  textColor: ColorSchema.optional().describe('Button label color.'),
});

export const ImageProps = z.strictObject({
  src: UrlSchema.optional().describe('Absolute image URL (https://…).'),
  alt: z.string().max(500).optional().describe('Alternative text. Always describe the image.'),
  href: UrlSchema.optional().describe('Optional link target when the image is clicked.'),
  width: z
    .union([z.number().int().min(1).max(1200), z.literal('full')])
    .optional()
    .describe('Width in px, or "full" to fill the content width.'),
  height: z.number().int().min(1).max(2000).optional().describe('Height in px. Usually omitted.'),
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

export const ContainerProps = z.strictObject({});

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
        shape: 'rounded',
        size: 'md',
        fullWidth: false,
        buttonColor: '$primary',
        textColor: '#ffffff',
      },
      style: { padding: { top: 16, right: 24, bottom: 16, left: 24 }, fontWeight: 'bold' },
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
      props: { color: '$border', thickness: 1, width: 100 },
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
  ImageBlockSchema,
  AvatarBlockSchema,
  DividerBlockSchema,
  SpacerBlockSchema,
  HtmlBlockSchema,
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
