import { marked } from 'marked';
import { DEFAULT_SETTINGS, DEFAULT_THEME } from '../core/defaults';
import { type Block, BlockSchema } from '../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../core/schema/document';
import { validateDocument } from '../core/validate';

/** Shape of an EmailBuilder.js (`@usewaypoint/email-builder`) document. */
export type EmailBuilderJsDocument = Record<
  string,
  { type: string; data?: Record<string, unknown> }
>;

export interface ImportResult {
  document: EmailDocument;
  /** Things that could not be carried over exactly. */
  warnings: string[];
}

type Json = Record<string, unknown>;

const SIZES: Record<string, string> = { 'x-small': 'xs', small: 'sm', medium: 'md', large: 'lg' };
const LEVELS: Record<string, number> = { h1: 1, h2: 2, h3: 3 };
const VALID_ID = /^[A-Za-z][\w-]{0,63}$/;

/** Drops null/undefined/empty-string values. */
function clean(input: Json): Json {
  const output: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== null && value !== undefined && value !== '') {
      output[key] = value;
    }
  }
  return output;
}

function obj(value: unknown): Json {
  return typeof value === 'object' && value !== null ? (value as Json) : {};
}

/** Escapes markdown syntax so plain EmailBuilder.js text renders literally. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*_[\]~])/g, '\\$1')
    .replace(/^(\s*)([#>+-])/gm, '$1\\$2')
    .replace(/^(\s*)(\d+)\./gm, '$1$2\\.');
}

function textStyle(style: Json): Json {
  return clean({
    padding: style.padding,
    backgroundColor: style.backgroundColor,
    align: style.textAlign,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
  });
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}

/** Markdown the restricted renderer cannot express (tables, images, raw HTML). */
const UNSUPPORTED_MARKDOWN = /^\s*\|.*\|\s*$|!\[[^\]]*\]\(|<\/?[a-z][^>]*>/im;

/**
 * Converts an EmailBuilder.js document. Ids are preserved when valid, the
 * 3-slot column tuple becomes `column` blocks, unreachable blocks are dropped,
 * and markdown we cannot express falls back to an `html` block.
 */
export function fromEmailBuilderJs(input: unknown): ImportResult {
  const source = obj(input) as EmailBuilderJsDocument;
  const warnings: string[] = [];
  const rootBlock = source.root;
  if (rootBlock?.type !== 'EmailLayout') {
    throw new Error('Not an EmailBuilder.js document: missing "root" EmailLayout block.');
  }

  const layout = obj(rootBlock.data);
  const theme = structuredClone(DEFAULT_THEME);
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (typeof layout.backdropColor === 'string') theme.colors.background = layout.backdropColor;
  if (typeof layout.canvasColor === 'string') theme.colors.surface = layout.canvasColor;
  if (typeof layout.textColor === 'string') theme.colors.text = layout.textColor;
  if (typeof layout.fontFamily === 'string') {
    theme.fonts.body = layout.fontFamily;
    theme.fonts.heading = layout.fontFamily;
  }
  if (typeof layout.borderColor === 'string') settings.borderColor = layout.borderColor;
  if (typeof layout.borderRadius === 'number') settings.borderRadius = layout.borderRadius;

  const blocks: Record<string, Block> = {};
  const used = new Set<string>([ROOT_ID]);
  const visited = new Set<string>();
  let counter = 0;

  const claimId = (sourceId: string): string => {
    let id = VALID_ID.test(sourceId) && !used.has(sourceId) ? sourceId : `imported_${++counter}`;
    while (used.has(id)) id = `imported_${++counter}`;
    used.add(id);
    return id;
  };

  const add = (id: string, block: Json): string => {
    const parsed = BlockSchema.safeParse(block);
    if (parsed.success) {
      blocks[id] = parsed.data;
      return id;
    }
    // Strip the offending keys one by one so the rest of the block survives.
    const copy = structuredClone(block);
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String);
      const key = path.pop();
      let target: Json = copy;
      for (const segment of path) target = obj(target[segment]);
      if (key !== undefined) {
        delete target[key];
        warnings.push(`${id}: dropped invalid ${[...path, key].join('.')} (${issue.message})`);
      }
    }
    const retry = BlockSchema.safeParse(copy);
    if (retry.success) {
      blocks[id] = retry.data;
      return id;
    }
    warnings.push(`${id}: could not be converted and was skipped.`);
    used.delete(id);
    return '';
  };

  const convertChildren = (ids: unknown): string[] =>
    (Array.isArray(ids) ? ids : [])
      .map((childId) => convert(String(childId)))
      .filter((id): id is string => id !== '');

  const convert = (sourceId: string): string => {
    const sourceBlock = source[sourceId];
    if (!sourceBlock) {
      warnings.push(`Missing block "${sourceId}" was skipped.`);
      return '';
    }
    visited.add(sourceId);
    const data = obj(sourceBlock.data);
    const style = obj(data.style);
    const props = obj(data.props);
    const id = claimId(sourceId);

    switch (sourceBlock.type) {
      case 'Heading':
        return add(id, {
          type: 'heading',
          props: clean({
            text: typeof props.text === 'string' ? escapeMarkdown(props.text) : undefined,
            level: LEVELS[String(props.level ?? 'h2')] ?? 2,
          }),
          style: textStyle(style),
        });

      case 'Text': {
        const text = typeof props.text === 'string' ? props.text : '';
        if (props.markdown && UNSUPPORTED_MARKDOWN.test(text)) {
          warnings.push(
            `${id}: markdown with tables, images or HTML was converted to an html block.`,
          );
          return add(id, {
            type: 'html',
            props: {
              html: sanitizeHtml(marked.parse(text, { gfm: true, breaks: true, async: false })),
            },
            style: textStyle(style),
          });
        }
        return add(id, {
          type: 'text',
          props: { markdown: props.markdown ? text : escapeMarkdown(text) },
          style: textStyle(style),
        });
      }

      case 'Button':
        return add(id, {
          type: 'button',
          props: clean({
            text: props.text,
            href: props.url,
            shape: props.buttonStyle,
            size: SIZES[String(props.size)] ?? undefined,
            fullWidth: props.fullWidth,
            buttonColor: props.buttonBackgroundColor ?? '#999999',
            textColor: props.buttonTextColor,
          }),
          style: clean({
            padding: style.padding,
            backgroundColor: style.backgroundColor,
            align: style.textAlign,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize ?? 16,
            fontWeight: style.fontWeight,
          }),
        });

      case 'Image':
        return add(id, {
          type: 'image',
          props: clean({
            src: props.url,
            alt: props.alt ?? '',
            href: props.linkHref,
            width: props.width,
            height: props.height,
          }),
          style: clean({
            padding: style.padding,
            backgroundColor: style.backgroundColor,
            align: style.textAlign ?? 'left',
          }),
        });

      case 'Avatar':
        return add(id, {
          type: 'avatar',
          props: clean({
            src: props.imageUrl,
            alt: props.alt ?? '',
            size: props.size,
            shape: props.shape ?? 'square',
          }),
          style: clean({ padding: style.padding, align: style.textAlign }),
        });

      case 'Divider':
        return add(id, {
          type: 'divider',
          props: clean({ color: props.lineColor ?? '#333333', thickness: props.lineHeight }),
          style: clean({ padding: style.padding, backgroundColor: style.backgroundColor }),
        });

      case 'Spacer':
        return add(id, { type: 'spacer', props: clean({ height: props.height ?? 16 }), style: {} });

      case 'Html':
        return add(id, {
          type: 'html',
          props: clean({ html: props.contents }),
          style: clean({
            padding: style.padding,
            backgroundColor: style.backgroundColor,
            align: style.textAlign,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            color: style.color,
          }),
        });

      case 'Container':
        return add(id, {
          type: 'container',
          props: {},
          style: clean({
            padding: style.padding,
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            border:
              typeof style.borderColor === 'string'
                ? { width: 1, style: 'solid', color: style.borderColor }
                : undefined,
          }),
          children: convertChildren(props.childrenIds),
        });

      case 'ColumnsContainer': {
        const count = props.columnsCount === 3 ? 3 : 2;
        const columns = Array.isArray(props.columns) ? props.columns.map(obj) : [];
        const fixed = Array.isArray(props.fixedWidths) ? props.fixedWidths : [];
        const gap = typeof props.columnsGap === 'number' ? props.columnsGap : 0;
        const padding = obj(style.padding);
        const rowWidth =
          settings.width -
          Number(padding.left ?? 0) -
          Number(padding.right ?? 0) -
          gap * (count - 1);

        columns.slice(count).forEach((column, index) => {
          if (Array.isArray(column.childrenIds) && column.childrenIds.length > 0) {
            warnings.push(
              `${id}: hidden column ${count + index + 1} had content that was dropped.`,
            );
          }
        });

        const columnIds: string[] = [];
        const contentTypes = new Set<string>();
        for (let index = 0; index < count; index++) {
          const children = convertChildren(columns[index]?.childrenIds);
          for (const childId of children) {
            const child = blocks[childId];
            if (child) contentTypes.add(child.type);
          }
          const fixedWidth = fixed[index];
          const columnId = claimId(`${id}-col-${index + 1}`);
          add(columnId, {
            type: 'column',
            props:
              typeof fixedWidth === 'number' && rowWidth > 0
                ? {
                    width: Math.min(
                      100,
                      Math.max(5, Math.round((fixedWidth / rowWidth) * 1000) / 10),
                    ),
                  }
                : {},
            style: {},
            children,
          });
          columnIds.push(columnId);
        }

        return add(id, {
          type: 'columns',
          props: clean({
            gap,
            verticalAlign: props.contentAlignment ?? 'middle',
            // EmailBuilder.js never stacks. Keep short text rows (label/value
            // pairs) side by side; stack wider or media-heavy rows.
            stackOnMobile:
              count === 3 ||
              ['image', 'avatar', 'button', 'columns'].some((type) => contentTypes.has(type)),
          }),
          style: clean({ padding: style.padding, backgroundColor: style.backgroundColor }),
          children: columnIds,
        });
      }

      default:
        warnings.push(`${sourceId}: unsupported block type "${sourceBlock.type}" was skipped.`);
        used.delete(id);
        return '';
    }
  };

  const root = convertChildren(layout.childrenIds);

  const unreachable = Object.keys(source).filter((id) => id !== ROOT_ID && !visited.has(id));
  if (unreachable.length > 0) {
    warnings.push(`${unreachable.length} unattached block(s) were dropped.`);
  }

  const document: EmailDocument = { version: 1, settings, theme, root, blocks };
  const validation = validateDocument(document);
  if (!validation.ok) {
    throw new Error(
      `Conversion produced an invalid document:\n${validation.issues.map((i) => `${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  return { document: validation.document, warnings };
}

/** True when the value looks like an EmailBuilder.js document. */
export function isEmailBuilderJsDocument(value: unknown): value is EmailBuilderJsDocument {
  const root = obj(obj(value).root);
  return root.type === 'EmailLayout';
}
