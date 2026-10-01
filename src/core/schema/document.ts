import { z } from 'zod';
import {
  BLOCK_DEFINITIONS,
  BLOCK_TYPES,
  type BlockProps,
  BlockSchema,
  type BlockStyle,
  type BlockType,
} from './blocks';
import { ColorSchema, FontFamilySchema, HexColorSchema, PaddingSchema } from './primitives';

export const ROOT_ID = 'root';

export const ThemeSchema = z.strictObject({
  colors: z.strictObject({
    primary: HexColorSchema.describe('Brand color for buttons and accents.'),
    secondary: HexColorSchema,
    text: HexColorSchema.describe('Body text color.'),
    muted: HexColorSchema.describe('Secondary text such as footers and captions.'),
    background: HexColorSchema.describe('Color around the email canvas.'),
    surface: HexColorSchema.describe('Email canvas color.'),
    border: HexColorSchema,
    link: HexColorSchema,
  }),
  fonts: z.strictObject({
    body: FontFamilySchema,
    heading: FontFamilySchema,
  }),
});

export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z.strictObject({
  width: z.number().int().min(320).max(1200).describe('Content width in px. 600 is standard.'),
  preheader: z
    .string()
    .max(300)
    .optional()
    .describe('Inbox preview text shown after the subject line. Not visible in the body.'),
  title: z.string().max(200).optional().describe('HTML <title>, used by some web views.'),
  lang: z.string().max(20).optional().describe('Language code for <html lang>, e.g. "en".'),
  padding: PaddingSchema.optional().describe('Space between the window edge and the canvas.'),
  backdropColor: ColorSchema,
  canvasColor: ColorSchema,
  textColor: ColorSchema,
  linkColor: ColorSchema,
  borderColor: ColorSchema.optional(),
  borderRadius: z.number().int().min(0).max(48).optional(),
  fontSize: z.number().int().min(10).max(24),
  lineHeight: z.number().min(1).max(2.5),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DocumentSchema = z.strictObject({
  version: z.literal(1),
  settings: SettingsSchema,
  theme: ThemeSchema,
  root: z.array(z.string()).describe('Ids of the top-level blocks, in order.'),
  blocks: z.record(z.string(), BlockSchema),
});

export type EmailDocument = z.infer<typeof DocumentSchema>;

/**
 * A nested block, as authored by people and agents. Ids are optional; they are
 * generated during normalization. Container blocks list their children inline.
 */
export type BlockInput = {
  [T in BlockType]: {
    id?: string;
    type: T;
    props?: BlockProps<T>;
    style?: BlockStyle<T>;
    children?: BlockInput[];
  };
}[BlockType];

const BlockIdSchema = z
  .string()
  .regex(/^[A-Za-z][\w-]{0,63}$/, 'Ids start with a letter and use letters, digits, "_" or "-".')
  .refine((id) => id !== ROOT_ID, { message: `"${ROOT_ID}" is reserved for the document body.` })
  .describe('Optional id so later operations can reference this block. Generated when omitted.');

function blockInputSchema(type: BlockType): z.ZodType {
  const definition = BLOCK_DEFINITIONS[type];
  const shape = {
    id: BlockIdSchema.optional(),
    type: z.literal(type),
    props: definition.props.optional(),
    style: definition.style.optional(),
  };
  if (!definition.container) {
    return z.strictObject(shape).describe(definition.description);
  }
  return z
    .strictObject({
      ...shape,
      get children() {
        return z.array(BlockInputSchema).optional();
      },
    })
    .describe(definition.description);
}

export const BlockInputSchema: z.ZodType<BlockInput> = z.lazy(() =>
  z.discriminatedUnion(
    'type',
    BLOCK_TYPES.map(blockInputSchema) as unknown as [
      z.ZodObject<{ type: z.ZodLiteral<string> }>,
      ...z.ZodObject<{ type: z.ZodLiteral<string> }>[],
    ],
  ),
) as unknown as z.ZodType<BlockInput>;

export { BlockIdSchema };
