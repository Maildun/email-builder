import type { z } from 'zod';
import type { Block, BlockOf } from '../core/schema/blocks';
import type { BorderSchema, Padding } from '../core/schema/primitives';
import { SOCIAL_LABELS, socialIconUrl } from '../core/social';
import { videoThumbnail } from '../core/video';
import { innerWidth, type RenderContext } from './context';
import { css, fontWeightCss, paddingCss, px } from './css';
import { escapeHtml, safeUrl } from './escape';
import { renderInlineMarkdown, renderMarkdown } from './markdown';

type Border = z.infer<typeof BorderSchema>;

export interface BoxStyle {
  padding?: Padding | undefined;
  backgroundColor?: string | undefined;
  border?: Border | undefined;
  borderRadius?: number | undefined;
  align?: 'left' | 'center' | 'right' | undefined;
}

export interface TypeStyle {
  fontFamily?: string | undefined;
  fontSize?: number | undefined;
  fontWeight?: 'normal' | 'bold' | number | undefined;
  color?: string | undefined;
  lineHeight?: number | undefined;
  letterSpacing?: number | undefined;
}

const TABLE_ATTRS = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"';

/** CSS declarations for a block's box (padding, background, border, radius, alignment). */
export function boxDeclarations(ctx: RenderContext, style: BoxStyle | undefined) {
  const border = style?.border;
  const borderColor = border ? (ctx.color(border.color, '$border') ?? '#000000') : undefined;
  const background = ctx.color(style?.backgroundColor);
  return {
    padding: paddingCss(style?.padding),
    'background-color': background,
    border:
      border && (border.width ?? 1) > 0
        ? `${border.width ?? 1}px ${border.style ?? 'solid'} ${borderColor}`
        : undefined,
    'border-radius': px(style?.borderRadius),
    'text-align': style?.align,
  };
}

/** CSS declarations for typography, with explicit fallbacks (Outlook does not inherit). */
export function typeDeclarations(
  ctx: RenderContext,
  style: TypeStyle | undefined,
  defaults: { fontFamily?: string; fontSize?: number; fontWeight?: TypeStyle['fontWeight'] } = {},
) {
  return {
    'font-family': style?.fontFamily
      ? ctx.font(style.fontFamily)
      : (defaults.fontFamily ?? ctx.font(undefined)),
    'font-size': px(style?.fontSize ?? defaults.fontSize ?? ctx.fontSize),
    'font-weight': fontWeightCss(style?.fontWeight ?? defaults.fontWeight),
    color: ctx.color(style?.color) ?? ctx.textColor,
    'line-height': String(style?.lineHeight ?? ctx.lineHeight),
    'letter-spacing': style?.letterSpacing !== undefined ? `${style.letterSpacing}px` : undefined,
  };
}

/** A single-cell presentation table: the most robust block wrapper across clients. */
export function box(
  ctx: RenderContext,
  id: string,
  style: BoxStyle | undefined,
  inner: string,
  extra: Record<string, string | number | undefined> = {},
): string {
  const align = style?.align ? ` align="${style.align}"` : '';
  const background = ctx.color(style?.backgroundColor);
  const bgcolor = background && background !== 'transparent' ? ` bgcolor="${background}"` : '';
  const annotation = ctx.annotate ? ` data-block-id="${escapeHtml(id)}"` : '';
  const tableStyle = style?.borderRadius ? ` style="border-collapse:separate"` : '';
  return `<table ${TABLE_ATTRS}${tableStyle}${annotation}><tr><td${align}${bgcolor} style="${css({ ...boxDeclarations(ctx, style), ...extra })}">${inner}</td></tr></table>`;
}

/**
 * A block's style minus its corner radius, for blocks that apply the radius
 * to themselves (button, avatar) rather than to their cell.
 */
function withoutRadius<T extends BoxStyle>(
  style: T | undefined,
): Omit<T, 'borderRadius'> | undefined {
  if (!style) return style;
  const { borderRadius: _radius, ...rest } = style;
  return rest;
}

const HEADING_SIZES = { 1: 32, 2: 24, 3: 20 } as const;

const BUTTON_SIZES = {
  xs: { padding: [4, 8], fontSize: 12 },
  sm: { padding: [8, 12], fontSize: 14 },
  md: { padding: [12, 20], fontSize: 16 },
  lg: { padding: [16, 32], fontSize: 18 },
} as const;

export type ChildRenderer = (id: string, available: number) => string;

/**
 * Renders one block (and its subtree) to email HTML.
 * `available` is the content width in px the block may occupy.
 */
export function renderBlock(
  ctx: RenderContext,
  id: string,
  available: number,
  renderChild: ChildRenderer = (childId, width) => renderBlock(ctx, childId, width),
): string {
  const block = ctx.document.blocks[id];
  if (!block) {
    return '';
  }
  switch (block.type) {
    case 'heading':
      return renderHeading(ctx, id, block);
    case 'text':
      return renderText(ctx, id, block);
    case 'button':
      return renderButton(ctx, id, block, available);
    case 'social':
      return renderSocial(ctx, id, block);
    case 'image':
      return renderImage(ctx, id, block, available);
    case 'video':
      return renderVideo(ctx, id, block, available);
    case 'avatar':
      return renderAvatar(ctx, id, block);
    case 'divider':
      return renderDivider(ctx, id, block);
    case 'spacer':
      return renderSpacer(ctx, id, block);
    case 'html':
      return box(ctx, id, block.style, block.props.html ?? '', typeDeclarations(ctx, block.style));
    case 'custom':
      return renderCustom(ctx, id, block, available);
    case 'container': {
      const width = innerWidth(available, block.style?.padding, block.style?.border);
      return box(
        ctx,
        id,
        block.style,
        block.children.map((child) => renderChild(child, width)).join(''),
      );
    }
    case 'columns':
      return renderColumns(ctx, id, block, available, renderChild);
    case 'column': {
      const width = innerWidth(available, block.style?.padding, block.style?.border);
      return box(
        ctx,
        id,
        block.style,
        block.children.map((child) => renderChild(child, width)).join(''),
      );
    }
  }
}

/**
 * Renders a host-defined block inside the standard block cell. Missing
 * definitions, invalid data and errors thrown by `render` become warnings
 * (and an empty cell) instead of breaking the whole email.
 */
function renderCustom(
  ctx: RenderContext,
  id: string,
  block: BlockOf<'custom'>,
  available: number,
): string {
  const { name } = block.props;
  const definition = ctx.customBlocks.get(name);
  const empty = ctx.annotate ? box(ctx, id, block.style, '') : '';
  if (!definition) {
    ctx.warnings.push({
      code: 'unknown-custom-block',
      message: `No definition for custom block "${name}"; it was left out.`,
      blockId: id,
    });
    return empty;
  }
  const data = definition.schema.safeParse(block.props.data ?? {});
  if (!data.success) {
    ctx.warnings.push({
      code: 'invalid-custom-block',
      message: `Custom block "${name}" has invalid data; it was left out.`,
      blockId: id,
    });
    return empty;
  }
  try {
    const inner = definition.render(data.data, {
      theme: ctx.theme,
      color: ctx.color,
      font: ctx.font,
      textColor: ctx.textColor,
      linkColor: ctx.linkColor,
      fontSize: ctx.fontSize,
      lineHeight: ctx.lineHeight,
      width: innerWidth(available, block.style?.padding, block.style?.border),
      escape: escapeHtml,
    });
    return box(ctx, id, block.style, inner);
  } catch (error) {
    ctx.warnings.push({
      code: 'custom-block-error',
      message: `Custom block "${name}" failed to render: ${(error as Error).message}`,
      blockId: id,
    });
    return empty;
  }
}

function renderHeading(ctx: RenderContext, id: string, block: BlockOf<'heading'>): string {
  const level = block.props.level ?? 2;
  const style = css({
    margin: '0',
    ...typeDeclarations(ctx, block.style, {
      fontFamily: ctx.headingFont,
      fontSize: HEADING_SIZES[level],
      fontWeight: 'bold',
    }),
    'line-height': String(block.style?.lineHeight ?? 1.25),
  });
  const text = renderInlineMarkdown(block.props.text ?? '', { linkStyle: ctx.linkStyle });
  return box(ctx, id, block.style, `<h${level} style="${style}">${text}</h${level}>`);
}

function renderText(ctx: RenderContext, id: string, block: BlockOf<'text'>): string {
  const style = css(typeDeclarations(ctx, block.style));
  const body = renderMarkdown(block.props.markdown ?? '', { linkStyle: ctx.linkStyle });
  return box(ctx, id, block.style, `<div style="${style}">${body}</div>`);
}

function renderButton(
  ctx: RenderContext,
  id: string,
  block: BlockOf<'button'>,
  available: number,
): string {
  const props = block.props;
  const size = BUTTON_SIZES[props.size ?? 'md'];
  const fontSize = block.style?.fontSize ?? size.fontSize;
  const [padY, padX] = size.padding;
  const fill = ctx.color(props.buttonColor, '$primary') ?? '#000000';
  const textColor = ctx.color(props.textColor) ?? '#ffffff';
  const fontFamily = ctx.font(block.style?.fontFamily);
  const fontWeight = fontWeightCss(block.style?.fontWeight ?? 'bold');
  const href = safeUrl(props.href) ?? '#';
  const label = escapeHtml(props.text ?? '');
  const height = Math.round(fontSize * 1.25 + padY * 2);
  const contentWidth = innerWidth(available, block.style?.padding, block.style?.border);
  const width = props.fullWidth
    ? contentWidth
    : Math.min(contentWidth, Math.round((props.text ?? '').length * fontSize * 0.6 + padX * 2));
  // A corner radius overrides the shape; past half the height it is a pill.
  const shapeRadius =
    props.shape === 'pill' ? Math.round(height / 2) : props.shape === 'rectangle' ? 0 : 6;
  const radius = Math.min(block.style?.borderRadius ?? shapeRadius, Math.round(height / 2));
  const arcsize = `${Math.round((radius / height) * 100)}%`;
  const letterSpacing =
    block.style?.letterSpacing !== undefined ? `${block.style.letterSpacing}px` : undefined;

  const anchorStyle = css({
    display: props.fullWidth ? 'block' : 'inline-block',
    'background-color': fill,
    color: textColor,
    'font-family': fontFamily,
    'font-size': px(fontSize),
    'font-weight': fontWeight,
    'line-height': '1.25',
    'letter-spacing': letterSpacing,
    'text-align': 'center',
    'text-decoration': 'none',
    padding: `${padY}px ${padX}px`,
    'border-radius': px(radius),
    'mso-hide': 'all',
  });
  const vml =
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="${arcsize}" stroke="f" fillcolor="${fill}">` +
    `<w:anchorlock/><center style="${css({ color: textColor, 'font-family': fontFamily, 'font-size': px(fontSize), 'font-weight': fontWeight })}">${label}</center></v:roundrect><![endif]-->`;
  const anchor = `<!--[if !mso]><!--><a href="${href}" target="_blank" style="${anchorStyle}">${label}</a><!--<![endif]-->`;
  return box(ctx, id, { align: 'left', ...withoutRadius(block.style) }, vml + anchor);
}

function imageMargin(align: BoxStyle['align']): string {
  return align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0';
}

function renderImage(
  ctx: RenderContext,
  id: string,
  block: BlockOf<'image'>,
  available: number,
): string {
  const props = block.props;
  const src = safeUrl(props.src);
  if (!src) {
    return box(ctx, id, block.style, '');
  }
  const contentWidth = innerWidth(available, block.style?.padding, block.style?.border);
  // "full" fills the content width; a number is a fixed width; no width keeps
  // the image's natural size (capped at the content width).
  const width =
    props.width === 'full'
      ? contentWidth
      : props.width === undefined
        ? undefined
        : Math.min(props.width, contentWidth);
  const align = block.style?.align ?? 'center';
  const imgStyle = css({
    display: 'block',
    width: props.width === 'full' ? '100%' : px(width),
    'max-width': '100%',
    height: props.height ? px(props.height) : 'auto',
    margin: imageMargin(align),
    // Round the picture itself: the cell's radius doesn't clip its content.
    'border-radius': px(block.style?.borderRadius),
    border: '0',
    outline: 'none',
    'text-decoration': 'none',
  });
  const widthAttr = width !== undefined ? ` width="${width}"` : '';
  const height = props.height ? ` height="${props.height}"` : '';
  let img = `<img src="${src}" alt="${escapeHtml(props.alt ?? '')}"${widthAttr}${height} style="${imgStyle}">`;
  const href = safeUrl(props.href);
  if (href) {
    img = `<a href="${href}" target="_blank" style="text-decoration:none">${img}</a>`;
  }
  return box(ctx, id, { ...block.style, align }, img, { 'font-size': '0', 'line-height': '0' });
}

function renderAvatar(ctx: RenderContext, id: string, block: BlockOf<'avatar'>): string {
  const props = block.props;
  const src = safeUrl(props.src);
  if (!src) {
    return box(ctx, id, block.style, '');
  }
  const size = props.size ?? 64;
  const shapeRadius =
    props.shape === 'circle' ? size : props.shape === 'rounded' ? Math.round(size * 0.125) : 0;
  const radius = block.style?.borderRadius ?? shapeRadius;
  const align = block.style?.align ?? 'left';
  const imgStyle = css({
    display: 'block',
    width: px(size),
    height: px(size),
    margin: imageMargin(align),
    'border-radius': px(radius),
    'object-fit': 'cover',
    border: '0',
    outline: 'none',
  });
  return box(
    ctx,
    id,
    { ...withoutRadius(block.style), align },
    `<img src="${src}" alt="${escapeHtml(props.alt ?? '')}" width="${size}" height="${size}" style="${imgStyle}">`,
    { 'font-size': '0', 'line-height': '0' },
  );
}

function renderSocial(ctx: RenderContext, id: string, block: BlockOf<'social'>): string {
  const props = block.props;
  const links = (props.links ?? []).flatMap((link) => {
    const href = safeUrl(link.href);
    return href ? [{ ...link, href }] : [];
  });
  if (links.length === 0) {
    return box(ctx, id, block.style, '');
  }
  const size = props.size ?? 32;
  const gap = props.gap ?? 12;
  const variant = props.variant ?? 'dark';
  const radius =
    props.shape === 'square' ? 0 : props.shape === 'rounded' ? Math.round(size * 0.25) : size;
  const align = block.style?.align ?? 'center';
  const cells = links
    .map((link, index) => {
      const src =
        safeUrl(link.icon) ?? escapeHtml(socialIconUrl(ctx.assetsUrl, link.network, variant));
      const alt = escapeHtml(link.label ?? SOCIAL_LABELS[link.network]);
      const imgStyle = css({
        display: 'block',
        width: px(size),
        height: px(size),
        'border-radius': px(radius),
        border: '0',
        outline: 'none',
      });
      const padding = index < links.length - 1 ? ` style="padding-right:${gap}px"` : '';
      return `<td${padding}><a href="${link.href}" target="_blank" style="text-decoration:none"><img src="${src}" alt="${alt}" width="${size}" height="${size}" style="${imgStyle}"></a></td>`;
    })
    .join('');
  const row = `<table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0" style="margin:${imageMargin(align)}"><tr>${cells}</tr></table>`;
  return box(ctx, id, { ...block.style, align }, row, { 'font-size': '0', 'line-height': '0' });
}

/** The play button over a video poster: a dark disc with a white triangle. */
const PLAY_SIZE = 64;

function renderVideo(
  ctx: RenderContext,
  id: string,
  block: BlockOf<'video'>,
  available: number,
): string {
  const props = block.props;
  const poster = safeUrl(videoThumbnail(props));
  const href = safeUrl(props.url) ?? '#';
  if (!poster) {
    return box(ctx, id, block.style, '');
  }
  const contentWidth = innerWidth(available, block.style?.padding, block.style?.border);
  const width =
    props.width === undefined || props.width === 'full'
      ? contentWidth
      : Math.min(props.width, contentWidth);
  const height = Math.round((width * 9) / 16);
  const align = block.style?.align ?? 'center';
  const alt = escapeHtml(props.alt ?? '');
  const radius = block.style?.borderRadius;
  // A background image (VML for Outlook) under a link that fills the frame,
  // so the whole poster is clickable; the dark fill shows if images are off.
  const cellStyle = css({
    width: px(width),
    height: px(height),
    'background-color': '#111111',
    'background-image': `url('${poster}')`,
    'background-size': 'cover',
    'background-position': 'center',
    'border-radius': px(radius),
  });
  const discStyle = css({
    width: px(PLAY_SIZE),
    height: px(PLAY_SIZE),
    'border-radius': px(PLAY_SIZE / 2),
    'background-color': 'rgba(0,0,0,0.6)',
    color: '#ffffff',
    'font-family': 'Arial, sans-serif',
    'font-size': '26px',
    'line-height': px(PLAY_SIZE),
    'text-align': 'center',
    'mso-line-height-rule': 'exactly',
  });
  const linkStyle = css({ display: 'block', height: px(height), 'text-decoration': 'none' });
  const above = Math.max(0, Math.floor((height - PLAY_SIZE) / 2));
  const disc = `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td height="${above}" style="height:${above}px;font-size:0;line-height:0">&#8202;</td></tr><tr><td width="${PLAY_SIZE}" height="${PLAY_SIZE}" align="center" valign="middle" bgcolor="#333333" style="${discStyle}">&#9654;&#xFE0E;</td></tr></table>`;
  const vmlOpen = `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${width}px;height:${height}px;"><v:fill type="frame" src="${poster}" color="#111111"/><v:textbox inset="0,0,0,0"><![endif]-->`;
  const vmlClose = '<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->';
  const frame = `<table role="presentation" align="${align}" width="${width}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${width}px;margin:${imageMargin(align)}"><tr><td background="${poster}" bgcolor="#111111" width="${width}" height="${height}" valign="top" style="${cellStyle}">${vmlOpen}<a href="${href}" target="_blank" title="${alt}" aria-label="${alt}" style="${linkStyle}">${disc}</a>${vmlClose}</td></tr></table>`;
  return box(ctx, id, { ...block.style, align }, frame);
}

function renderDivider(ctx: RenderContext, id: string, block: BlockOf<'divider'>): string {
  const thickness = block.props.thickness ?? 1;
  const color = ctx.color(block.props.color, '$border') ?? '#cccccc';
  const width = block.props.width ?? 100;
  const line = `<table role="presentation" width="${width}%" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${color}" style="${css({ height: px(thickness), 'line-height': px(thickness), 'font-size': '0', 'background-color': color })}">&#8202;</td></tr></table>`;
  return box(ctx, id, block.style, line);
}

function renderSpacer(ctx: RenderContext, id: string, block: BlockOf<'spacer'>): string {
  const height = block.props.height ?? 24;
  return box(ctx, id, block.style, '&#8202;', {
    height: px(height),
    'line-height': px(height),
    'font-size': '0',
  });
}

/** Pixel widths of each column (excluding gaps) for a columns block. */
export function columnWidths(
  ctx: RenderContext,
  block: BlockOf<'columns'>,
  available: number,
): number[] {
  const columns = block.children.map((childId) => ctx.document.blocks[childId]);
  const count = columns.length;
  const gap = block.props.gap ?? 0;
  const inner =
    innerWidth(available, block.style?.padding, block.style?.border) - gap * (count - 1);
  const explicit = columns.map((column) =>
    column?.type === 'column' && column.props.width !== undefined ? column.props.width : undefined,
  );
  const used = explicit.reduce<number>((sum, width) => sum + (width ?? 0), 0);
  const auto = explicit.filter((width) => width === undefined).length;
  const share = auto > 0 ? Math.max(0, 100 - used) / auto : 0;
  return explicit.map((width) => Math.floor((inner * (width ?? share)) / 100));
}

function renderColumns(
  ctx: RenderContext,
  id: string,
  block: BlockOf<'columns'>,
  available: number,
  renderChild: ChildRenderer,
): string {
  const widths = columnWidths(ctx, block, available);
  const rowWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    (block.props.gap ?? 0) * (block.children.length - 1);
  const gap = block.props.gap ?? 0;
  const stack = block.props.stackOnMobile ?? true;
  const valign = block.props.verticalAlign ?? 'top';
  const count = block.children.length;
  const cells = block.children
    .map((childId, index) => {
      const left = index === 0 ? 0 : Math.ceil(gap / 2);
      const right = index === count - 1 ? 0 : Math.floor(gap / 2);
      const width = (widths[index] ?? 0) + left + right;
      const className = stack ? ` class="meb-col${index > 0 ? ' meb-col-next' : ''}"` : '';
      // Pixel width attribute for Outlook; percentage CSS width so rows that
      // do not stack still shrink on screens narrower than the email.
      const percent = rowWidth > 0 ? `${Math.round((width / rowWidth) * 10000) / 100}%` : undefined;
      return `<td${className} width="${width}" valign="${valign}" style="${css({ width: percent, 'padding-left': px(left), 'padding-right': px(right), 'vertical-align': valign })}">${renderChild(childId, widths[index] ?? 0)}</td>`;
    })
    .join('');
  return box(
    ctx,
    id,
    block.style,
    `<table ${TABLE_ATTRS} style="table-layout:fixed"><tr>${cells}</tr></table>`,
  );
}

export type { Block };
