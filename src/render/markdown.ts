import { Lexer, type Token, type Tokens } from 'marked';
import { css } from './css';
import { escapeHtml, protectMergeTags, safeUrl } from './escape';

export interface MarkdownOptions {
  /** Inline style for links, e.g. `color:#1f6feb`. */
  linkStyle?: string;
}

const LEXER_OPTIONS = { gfm: true, breaks: true } as const;

/**
 * Renders restricted markdown to email-safe HTML. Only a whitelist of
 * constructs is honoured; raw HTML and anything unknown is escaped as text.
 */
export function renderMarkdown(source: string, options: MarkdownOptions = {}): string {
  const { text, restore } = protectMergeTags(source);
  const tokens = new Lexer(LEXER_OPTIONS).lex(text);
  return restore(renderBlocks(tokens, options, restore).join(''));
}

/** Renders inline markdown only (bold, italic, strike, code, links). */
export function renderInlineMarkdown(source: string, options: MarkdownOptions = {}): string {
  const { text, restore } = protectMergeTags(source);
  return restore(renderInline(Lexer.lexInline(text, LEXER_OPTIONS), options, restore));
}

function renderBlocks(
  tokens: Token[],
  options: MarkdownOptions,
  restore: (html: string) => string,
): string[] {
  const out: string[] = [];
  /** Paragraph spacing: the first block has no top margin. */
  const margin = () => (out.length === 0 ? 'margin:0' : 'margin:1em 0 0 0');
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'paragraph':
      case 'heading':
        out.push(
          `<p style="${margin()}">${token.type === 'heading' ? '<strong>' : ''}${renderInline((token as Tokens.Paragraph).tokens, options, restore)}${token.type === 'heading' ? '</strong>' : ''}</p>`,
        );
        break;
      case 'text': {
        const textToken = token as Tokens.Text;
        out.push(
          `<p style="${margin()}">${textToken.tokens ? renderInline(textToken.tokens, options, restore) : escapeHtml(textToken.text)}</p>`,
        );
        break;
      }
      case 'list': {
        const list = token as Tokens.List;
        const tag = list.ordered ? 'ol' : 'ul';
        const start =
          list.ordered && list.start !== '' && list.start !== 1
            ? ` start="${Number(list.start)}"`
            : '';
        const items = list.items
          .map((item) => {
            const inner = item.tokens
              .map((child) => {
                if (child.type === 'text') {
                  const textChild = child as Tokens.Text;
                  return textChild.tokens
                    ? renderInline(textChild.tokens, options, restore)
                    : escapeHtml(textChild.text);
                }
                if (child.type === 'paragraph') {
                  return renderInline((child as Tokens.Paragraph).tokens, options, restore);
                }
                return renderBlocks([child], options, restore).join('');
              })
              .join('');
            return `<li style="margin:0 0 4px 0">${inner}</li>`;
          })
          .join('');
        out.push(`<${tag}${start} style="${margin()};padding:0 0 0 24px">${items}</${tag}>`);
        break;
      }
      case 'blockquote':
        out.push(
          `<div style="${margin()};${css({ 'padding-left': '12px', 'border-left': '3px solid currentColor' })}">${renderBlocks((token as Tokens.Blockquote).tokens, options, restore).join('')}</div>`,
        );
        break;
      case 'code':
        out.push(
          `<p style="${margin()};font-family:monospace;white-space:pre-wrap">${escapeHtml((token as Tokens.Code).text)}</p>`,
        );
        break;
      case 'hr':
        out.push(`<hr style="border:0;border-top:1px solid currentColor;opacity:0.2;${margin()}">`);
        break;
      default:
        out.push(`<p style="${margin()}">${escapeHtml(token.raw).replace(/\n/g, '<br>')}</p>`);
    }
  }
  return out;
}

function renderInline(
  tokens: Token[] | undefined,
  options: MarkdownOptions,
  restore: (html: string) => string,
): string {
  if (!tokens) {
    return '';
  }
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'text': {
          const textToken = token as Tokens.Text;
          if (textToken.tokens) {
            return renderInline(textToken.tokens, options, restore);
          }
          return textToken.escaped ? textToken.text : escapeHtml(textToken.text);
        }
        case 'escape':
          return escapeHtml((token as Tokens.Escape).text);
        case 'strong':
          return `<strong>${renderInline((token as Tokens.Strong).tokens, options, restore)}</strong>`;
        case 'em':
          return `<em>${renderInline((token as Tokens.Em).tokens, options, restore)}</em>`;
        case 'del':
          return `<del>${renderInline((token as Tokens.Del).tokens, options, restore)}</del>`;
        case 'codespan':
          return `<code style="font-family:monospace">${escapeHtml((token as Tokens.Codespan).text)}</code>`;
        case 'br':
          return '<br>';
        case 'link': {
          const link = token as Tokens.Link;
          const label = renderInline(link.tokens, options, restore);
          const href = safeUrl(restore(link.href));
          if (!href) {
            return label;
          }
          const title = link.title ? ` title="${escapeHtml(link.title)}"` : '';
          const style = options.linkStyle ? ` style="${options.linkStyle}"` : '';
          return `<a href="${href}" target="_blank"${title}${style}>${label}</a>`;
        }
        case 'image': {
          const image = token as Tokens.Image;
          return escapeHtml(image.text);
        }
        default:
          return escapeHtml(token.raw);
      }
    })
    .join('');
}

/** Plain-text rendering of markdown: links become "label (url)", lists keep markers. */
export function markdownToPlainText(source: string): string {
  const { text, restore } = protectMergeTags(source);
  const tokens = new Lexer(LEXER_OPTIONS).lex(text);
  return restore(plainBlocks(tokens).join('\n\n')).trim();
}

function plainBlocks(tokens: Token[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'list': {
        const list = token as Tokens.List;
        const start = typeof list.start === 'number' ? list.start : 1;
        out.push(
          list.items
            .map((item, index) => {
              const marker = list.ordered ? `${start + index}.` : '-';
              return `${marker} ${plainBlocks(item.tokens).join(' ')}`;
            })
            .join('\n'),
        );
        break;
      }
      case 'hr':
        out.push('---');
        break;
      case 'code':
        out.push((token as Tokens.Code).text);
        break;
      default: {
        const withTokens = token as { tokens?: Token[]; text?: string };
        out.push(
          withTokens.tokens ? plainInline(withTokens.tokens) : (withTokens.text ?? token.raw),
        );
      }
    }
  }
  return out;
}

export function plainInline(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'link': {
          const link = token as Tokens.Link;
          const label = plainInline(link.tokens);
          return label === link.href ? label : `${label} (${link.href})`;
        }
        case 'br':
          return '\n';
        case 'image':
          return (token as Tokens.Image).text;
        default: {
          const withTokens = token as { tokens?: Token[]; text?: string };
          return withTokens.tokens
            ? plainInline(withTokens.tokens)
            : (withTokens.text ?? token.raw);
        }
      }
    })
    .join('');
}

/** Plain text of inline markdown. */
export function inlineMarkdownToPlainText(source: string): string {
  const { text, restore } = protectMergeTags(source);
  return restore(plainInline(Lexer.lexInline(text, LEXER_OPTIONS)));
}
