import type { CustomBlocks } from '../core/custom';
import type { EmailDocument } from '../core/schema/document';
import { resolvePadding } from '../core/schema/primitives';
import { renderBlock } from './blocks';
import { createRenderContext, type RenderContext, type RenderWarning } from './context';
import { css, paddingCss, px } from './css';
import { escapeHtml } from './escape';
import { renderPlainText } from './text';

export interface RenderOptions {
  /** Overrides `settings.lang`. Defaults to "en". */
  lang?: string;
  /** Definitions for the document's custom blocks. */
  customBlocks?: CustomBlocks;
}

export type { RenderWarning };

export interface RenderResult {
  html: string;
  text: string;
  warnings: RenderWarning[];
}

/** Gmail clips messages above roughly 102 KB. */
const GMAIL_CLIP_BYTES = 102 * 1024;

/** Preheader filler that stops inboxes from pulling body text into the preview. */
const PREHEADER_FILLER = '&#847;&zwnj;&nbsp;'.repeat(80);

/**
 * Renders a document to a complete, email-client-safe HTML file and a
 * plain-text alternative. Pure and synchronous: runs in Node, Bun, browsers
 * and edge runtimes. Merge tags (`{{ key }}`) are kept verbatim.
 */
export function renderEmail(document: EmailDocument, options: RenderOptions = {}): RenderResult {
  const ctx = createRenderContext(document, {
    ...(options.customBlocks ? { customBlocks: options.customBlocks } : {}),
  });
  const html = renderDocumentHtml(ctx, options);
  const warnings: RenderWarning[] = [...ctx.warnings];

  const bytes = new TextEncoder().encode(html).length;
  if (bytes > GMAIL_CLIP_BYTES) {
    warnings.push({
      code: 'gmail-clipping',
      message: `HTML is ${Math.round(bytes / 1024)} KB; Gmail clips messages above 102 KB.`,
    });
  }
  if (/\$(?:primary|secondary|text|muted|background|surface|border|link)\b/.test(html)) {
    warnings.push({ code: 'unresolved-token', message: 'A theme color token was not resolved.' });
  }

  return { html, text: renderPlainText(document, options), warnings };
}

/** Responsive and client-reset CSS placed in <head>. */
function headStyles(ctx: RenderContext, width: number): string {
  return [
    'body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}',
    'table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}',
    'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}',
    `a{color:${ctx.linkColor}}`,
    'h1,h2,h3,p{margin:0}',
    `@media only screen and (max-width:${width + 20}px){`,
    '.meb-canvas{width:100%!important}',
    '.meb-col{display:block!important;width:100%!important;max-width:100%!important;padding-left:0!important;padding-right:0!important;box-sizing:border-box}',
    '.meb-col-next{padding-top:16px!important}',
    '}',
  ].join('');
}

export function renderDocumentHtml(ctx: RenderContext, options: RenderOptions = {}): string {
  const { settings } = ctx.document;
  const width = settings.width;
  const backdrop = ctx.color(settings.backdropColor, '$background') ?? '#ffffff';
  const canvas = ctx.color(settings.canvasColor, '$surface') ?? '#ffffff';
  const lang = escapeHtml(options.lang ?? settings.lang ?? 'en');
  const outer = resolvePadding(settings.padding);
  const borderColor = ctx.color(settings.borderColor);

  const body = ctx.document.root.map((id) => renderBlock(ctx, id, width)).join('');

  const canvasStyle = css({
    width: '100%',
    'max-width': px(width),
    margin: '0 auto',
    'background-color': canvas,
    'border-radius': px(settings.borderRadius),
    border: borderColor ? `1px solid ${borderColor}` : undefined,
    'border-collapse': settings.borderRadius ? 'separate' : undefined,
    overflow: settings.borderRadius ? 'hidden' : undefined,
  });
  const bodyStyle = css({
    'font-family': ctx.font(undefined),
    'font-size': px(ctx.fontSize),
    'line-height': String(ctx.lineHeight),
    color: ctx.textColor,
  });

  const preheader = settings.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(settings.preheader)}${PREHEADER_FILLER}</div>`
    : '';

  return [
    '<!DOCTYPE html>',
    `<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(settings.title ?? '')}</title>`,
    '<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->',
    `<style>${headStyles(ctx, width)}</style>`,
    '</head>',
    `<body style="margin:0;padding:0;background-color:${backdrop}">`,
    preheader,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${backdrop}" style="background-color:${backdrop}">`,
    `<tr><td align="center" style="padding:${paddingCss({ ...outer, left: outer.left, right: outer.right })}">`,
    `<!--[if mso]><table role="presentation" width="${width}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`,
    `<table role="presentation" class="meb-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${canvas}" style="${canvasStyle}">`,
    `<tr><td style="${bodyStyle}">${body}</td></tr>`,
    '</table>',
    '<!--[if mso]></td></tr></table><![endif]-->',
    '</td></tr></table>',
    '</body>',
    '</html>',
  ].join('\n');
}
