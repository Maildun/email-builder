import type { Block } from '../core/schema/blocks';
import type { EmailDocument } from '../core/schema/document';
import { walk } from '../core/tree';

function quote(text: string | undefined, max = 70): string {
  if (!text) return '""';
  const flat = text.replace(/\s+/g, ' ').trim();
  return JSON.stringify(flat.length > max ? `${flat.slice(0, max - 1)}…` : flat);
}

/** One-line description of a block for the outline. */
export function summarizeBlock(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `h${block.props.level ?? 2} ${quote(block.props.text)}`;
    case 'text':
      return quote(block.props.markdown);
    case 'button':
      return `${quote(block.props.text, 40)} → ${block.props.href ?? '(no link)'}`;
    case 'image':
      return `${quote(block.props.alt, 40)} ${block.props.src ?? '(no src)'}${block.props.href ? ` → ${block.props.href}` : ''}`;
    case 'avatar':
      return `${block.props.shape ?? 'circle'} ${block.props.size ?? 64}px ${block.props.src ?? '(no src)'}`;
    case 'divider':
      return `${block.props.thickness ?? 1}px ${block.props.color ?? ''}`.trim();
    case 'spacer':
      return `${block.props.height ?? 24}px`;
    case 'html':
      return quote(block.props.html, 50);
    case 'custom': {
      const data = JSON.stringify(block.props.data ?? {});
      return `${block.props.name} ${data.length > 60 ? `${data.slice(0, 59)}…` : data}`;
    }
    case 'columns':
      return `${block.children.length} columns, gap ${block.props.gap ?? 0}${block.props.stackOnMobile === false ? ', no stacking' : ''}`;
    case 'column':
      return block.props.width !== undefined ? `${block.props.width}%` : 'auto width';
    case 'container': {
      const background = block.style?.backgroundColor;
      return background ? `bg ${background}` : '';
    }
  }
}

/**
 * Compact, token-cheap view of the document for LLMs: settings, theme and an
 * indented tree of `id type: summary` lines.
 */
export function outlineDocument(document: EmailDocument): string {
  const { settings, theme } = document;
  const lines = [
    `settings: width ${settings.width}px, preheader ${quote(settings.preheader)}, font ${settings.fontSize}px/${settings.lineHeight}`,
    `theme: ${Object.entries(theme.colors)
      .map(([name, value]) => `$${name} ${value}`)
      .join(', ')}; fonts body ${theme.fonts.body}, heading ${theme.fonts.heading}`,
    'body (id "root"):',
  ];
  if (document.root.length === 0) {
    lines.push('  (empty)');
  }
  walk(document, (id, block, depth) => {
    const summary = summarizeBlock(block);
    lines.push(`${'  '.repeat(depth + 1)}- ${id} ${block.type}${summary ? `: ${summary}` : ''}`);
  });
  return lines.join('\n');
}
