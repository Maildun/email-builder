import { resolveColor } from '../core/colors';
import { type CustomBlockDefinition, type CustomBlocks, customBlockMap } from '../core/custom';
import type { EmailDocument, Theme } from '../core/schema/document';
import { type Padding, resolveFontStack, resolvePadding } from '../core/schema/primitives';
import { DEFAULT_ASSETS_URL } from '../core/social';

export interface RenderWarning {
  code:
    | 'gmail-clipping'
    | 'unresolved-token'
    | 'unknown-custom-block'
    | 'invalid-custom-block'
    | 'custom-block-error';
  message: string;
  blockId?: string;
}

export interface RenderContext {
  document: EmailDocument;
  theme: Theme;
  /** Resolves tokens like `$primary`; falls back when the value is missing. */
  color: (value: string | undefined, fallback?: string) => string | undefined;
  /** Resolves a font key or stack; falls back to the body font. */
  font: (value: string | undefined) => string;
  headingFont: string;
  textColor: string;
  linkColor: string;
  linkStyle: string;
  fontSize: number;
  lineHeight: number;
  /** When set, block wrappers carry `data-block-id` (used by the editor canvas). */
  annotate: boolean;
  /** Custom block definitions by name. */
  customBlocks: ReadonlyMap<string, CustomBlockDefinition>;
  /** Base URL of the bundled image assets (social icons). */
  assetsUrl: string;
  /** Problems found while rendering (collected, never thrown). */
  warnings: RenderWarning[];
}

export function createRenderContext(
  document: EmailDocument,
  options: { annotate?: boolean; customBlocks?: CustomBlocks; assetsUrl?: string } = {},
): RenderContext {
  const theme = document.theme;
  const color = (value: string | undefined, fallback?: string) =>
    resolveColor(value, theme) ?? (fallback ? resolveColor(fallback, theme) : undefined);
  const bodyFont = resolveFontStack(theme.fonts.body) ?? 'Arial, sans-serif';
  const textColor = color(document.settings.textColor, '$text') ?? '#000000';
  const linkColor = color(document.settings.linkColor, '$link') ?? textColor;
  return {
    document,
    theme,
    color,
    font: (value) => resolveFontStack(value) ?? bodyFont,
    headingFont: resolveFontStack(theme.fonts.heading) ?? bodyFont,
    textColor,
    linkColor,
    linkStyle: `color:${linkColor};text-decoration:underline`,
    fontSize: document.settings.fontSize,
    lineHeight: document.settings.lineHeight,
    annotate: options.annotate ?? false,
    customBlocks: customBlockMap(options.customBlocks),
    assetsUrl: options.assetsUrl ?? DEFAULT_ASSETS_URL,
    warnings: [],
  };
}

/** Width available to the children of a box with this padding and border. */
export function innerWidth(
  available: number,
  padding: Padding | undefined,
  border?: { width?: number | undefined } | undefined,
): number {
  const p = resolvePadding(padding);
  const borderWidth = border?.width ?? 0;
  return Math.max(0, available - p.left - p.right - borderWidth * 2);
}
