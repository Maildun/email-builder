import { z } from 'zod';

/**
 * Web-safe font stacks. Keys match EmailBuilder.js so documents import 1:1.
 */
export const FONT_FAMILIES = {
  MODERN_SANS: {
    label: 'Modern sans',
    stack: '"Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif',
  },
  BOOK_SANS: {
    label: 'Book sans',
    stack: 'Optima, Candara, "Noto Sans", source-sans-pro, sans-serif',
  },
  ORGANIC_SANS: {
    label: 'Organic sans',
    stack: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  },
  GEOMETRIC_SANS: {
    label: 'Geometric sans',
    stack:
      'Avenir, "Avenir Next LT Pro", Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif',
  },
  HEAVY_SANS: {
    label: 'Heavy sans',
    stack:
      'Bahnschrift, "DIN Alternate", "Franklin Gothic Medium", "Nimbus Sans Narrow", sans-serif-condensed, sans-serif',
  },
  ROUNDED_SANS: {
    label: 'Rounded sans',
    stack:
      'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif',
  },
  MODERN_SERIF: {
    label: 'Modern serif',
    stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif',
  },
  BOOK_SERIF: {
    label: 'Book serif',
    stack: '"Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif',
  },
  MONOSPACE: {
    label: 'Monospace',
    stack: '"Nimbus Mono PS", "Courier New", "Cutive Mono", monospace',
  },
} as const;

export type FontKey = keyof typeof FONT_FAMILIES;

export const FONT_KEYS = Object.keys(FONT_FAMILIES) as FontKey[];

export const THEME_COLOR_TOKENS = [
  'primary',
  'secondary',
  'text',
  'muted',
  'background',
  'surface',
  'border',
  'link',
] as const;

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TOKEN = new RegExp(`^\\$(?:${THEME_COLOR_TOKENS.join('|')})$`);

export const HexColorSchema = z
  .string()
  .regex(HEX, 'Use a hex color such as "#1a73e8" or "#fff".')
  .describe('Hex color, e.g. "#1a73e8".');

export const ColorSchema = z
  .string()
  .refine((value) => HEX.test(value) || TOKEN.test(value) || value === 'transparent', {
    message: `Use a hex color ("#1a73e8"), "transparent", or a theme token (${THEME_COLOR_TOKENS.map((t) => `$${t}`).join(', ')}).`,
  })
  .describe(
    `Hex color ("#1a73e8"), "transparent", or a theme token: ${THEME_COLOR_TOKENS.map((t) => `$${t}`).join(', ')}. Prefer tokens so the email follows the theme.`,
  );

export type Color = string;

export const PaddingSchema = z
  .union([
    z.number().int().min(0).max(200),
    z.strictObject({
      top: z.number().int().min(0).max(200).optional(),
      right: z.number().int().min(0).max(200).optional(),
      bottom: z.number().int().min(0).max(200).optional(),
      left: z.number().int().min(0).max(200).optional(),
    }),
  ])
  .describe('Padding in px: a single number for all sides, or {top, right, bottom, left}.');

export type Padding = z.infer<typeof PaddingSchema>;

export interface ResolvedPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function resolvePadding(padding: Padding | undefined): ResolvedPadding {
  if (padding === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

export const FontFamilySchema = z
  .string()
  .min(1)
  .describe(`Font preset key (${FONT_KEYS.join(', ')}) or a custom CSS font stack.`);

export type FontFamily = FontKey | (string & {});

export function resolveFontStack(font: string | undefined): string | undefined {
  if (font === undefined) {
    return undefined;
  }
  return font in FONT_FAMILIES ? FONT_FAMILIES[font as FontKey].stack : font;
}

export const FontWeightSchema = z
  .union([
    z.literal('normal'),
    z.literal('bold'),
    z.number().int().min(100).max(900).multipleOf(100),
  ])
  .describe('"normal", "bold", or a numeric weight from 100 to 900.');

export const AlignSchema = z.enum(['left', 'center', 'right']).describe('Horizontal alignment.');

export const VerticalAlignSchema = z.enum(['top', 'middle', 'bottom']);

const MERGE_TAG = /^\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\}\}/;
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:|#)/i;

/**
 * A link or image URL. Merge tags such as `{{ unsubscribe_url }}` are allowed
 * anywhere; script-capable schemes (`javascript:`, `data:` …) are rejected.
 */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  return SAFE_URL.test(trimmed) || MERGE_TAG.test(trimmed);
}

export const UrlSchema = z
  .string()
  .max(2048)
  .refine(isSafeUrl, {
    message:
      'URLs must start with https://, http://, mailto:, tel:, # or a merge tag like {{ unsubscribe_url }}.',
  })
  .describe(
    'Absolute URL (https://…, mailto:, tel:) or a merge tag such as {{ unsubscribe_url }}.',
  );

export const BorderSchema = z
  .strictObject({
    width: z.number().int().min(0).max(20).optional(),
    style: z.enum(['solid', 'dashed', 'dotted']).optional(),
    color: ColorSchema.optional(),
  })
  .describe('Border around the block.');

/** Box styles shared by every block. */
export const BoxStyleShape = {
  padding: PaddingSchema.optional(),
  backgroundColor: ColorSchema.optional(),
  border: BorderSchema.optional(),
  borderRadius: z.number().int().min(0).max(100).optional().describe('Corner radius in px.'),
};

export const AlignStyleShape = {
  align: AlignSchema.optional(),
};

export const TypographyStyleShape = {
  fontFamily: FontFamilySchema.optional(),
  fontSize: z.number().int().min(8).max(96).optional().describe('Font size in px.'),
  fontWeight: FontWeightSchema.optional(),
  color: ColorSchema.optional(),
  lineHeight: z.number().min(0.8).max(3).optional().describe('Unitless line height, e.g. 1.5.'),
  letterSpacing: z.number().min(-5).max(20).optional().describe('Letter spacing in px.'),
};
