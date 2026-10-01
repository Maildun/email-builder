import { type CustomBlocks, customBlockMap } from '../core/custom';
import { hasChildren } from '../core/schema/blocks';
import type { EmailDocument } from '../core/schema/document';
import { SOCIAL_LABELS } from '../core/social';
import { inlineMarkdownToPlainText, markdownToPlainText } from './markdown';

/** Plain-text alternative of the email for the text/plain MIME part. */
export function renderPlainText(
  document: EmailDocument,
  options: { customBlocks?: CustomBlocks } = {},
): string {
  const parts: string[] = [];
  const customBlocks = customBlockMap(options.customBlocks);

  const visit = (ids: string[]) => {
    for (const id of ids) {
      const block = document.blocks[id];
      if (!block) continue;
      switch (block.type) {
        case 'heading': {
          const text = inlineMarkdownToPlainText(block.props.text ?? '').trim();
          if (text) parts.push(block.props.level === 1 ? text.toUpperCase() : text);
          break;
        }
        case 'text': {
          const text = markdownToPlainText(block.props.markdown ?? '');
          if (text) parts.push(text);
          break;
        }
        case 'button':
          if (block.props.text) {
            parts.push(
              block.props.href ? `${block.props.text}: ${block.props.href}` : block.props.text,
            );
          }
          break;
        case 'image':
          if (block.props.href && block.props.alt) {
            parts.push(`${block.props.alt}: ${block.props.href}`);
          }
          break;
        case 'social': {
          const links = (block.props.links ?? []).map(
            (link) => `${link.label ?? SOCIAL_LABELS[link.network]}: ${link.href}`,
          );
          if (links.length) parts.push(links.join('\n'));
          break;
        }
        case 'video':
          if (block.props.url)
            parts.push(`${block.props.alt || 'Watch the video'}: ${block.props.url}`);
          break;
        case 'divider':
          parts.push('---');
          break;
        case 'html': {
          const text = htmlToText(block.props.html ?? '');
          if (text) parts.push(text);
          break;
        }
        case 'custom': {
          const definition = customBlocks.get(block.props.name);
          const data = definition?.schema.safeParse(block.props.data ?? {});
          if (!definition?.text || !data?.success) break;
          try {
            const text = definition.text(data.data).trim();
            if (text) parts.push(text);
          } catch {
            // The HTML render reports the error; the text part just skips the block.
          }
          break;
        }
        default:
          if (hasChildren(block)) visit(block.children);
      }
    }
  };

  visit(document.root);
  return parts
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
