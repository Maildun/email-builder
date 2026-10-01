import { contrastRatio, resolveColor } from './colors';
import type { Block } from './schema/blocks';
import { type EmailDocument, ROOT_ID } from './schema/document';
import { walk } from './tree';

export interface LintWarning {
  code:
    | 'empty-document'
    | 'missing-alt'
    | 'missing-src'
    | 'missing-href'
    | 'empty-button'
    | 'missing-unsubscribe'
    | 'missing-preheader'
    | 'low-contrast'
    | 'empty-container'
    | 'placeholder-content';
  severity: 'warning' | 'info';
  message: string;
  blockId?: string;
}

export interface LintOptions {
  /** Warn when no `{{ unsubscribe_url }}` (or `unsubscribeTag`) appears. Marketing email should set this. */
  requireUnsubscribe?: boolean;
  unsubscribeTag?: string;
  /** Minimum WCAG contrast ratio for text. Default 4.5. */
  minContrast?: number;
}

const PLACEHOLDER = /placehold\.co|example\.com|lorem ipsum/i;

/** Deliverability, accessibility and quality checks. Never blocks rendering. */
export function lintDocument(document: EmailDocument, options: LintOptions = {}): LintWarning[] {
  const warnings: LintWarning[] = [];
  const minContrast = options.minContrast ?? 4.5;
  const theme = document.theme;
  const canvas = resolveColor(document.settings.canvasColor, theme) ?? '#ffffff';
  const backgrounds = new Map<string, string>([[ROOT_ID, canvas]]);
  let content = document.settings.preheader ?? '';

  if (document.root.length === 0) {
    warnings.push({
      code: 'empty-document',
      severity: 'warning',
      message: 'The email has no content.',
    });
  }
  if (!document.settings.preheader) {
    warnings.push({
      code: 'missing-preheader',
      severity: 'info',
      message: 'No preheader set; inboxes will show the first words of the body instead.',
    });
  }

  walk(document, (id, block, _depth, parentId) => {
    const style = (block.style ?? {}) as { backgroundColor?: string; color?: string };
    const parentBackground = backgrounds.get(parentId) ?? canvas;
    const background =
      style.backgroundColor && style.backgroundColor !== 'transparent'
        ? (resolveColor(style.backgroundColor, theme) ?? parentBackground)
        : parentBackground;
    backgrounds.set(id, background);
    content += ` ${JSON.stringify(block.props)}`;
    warnings.push(...lintBlock(id, block, document, background, minContrast));
  });

  if (options.requireUnsubscribe) {
    const tag = options.unsubscribeTag ?? 'unsubscribe_url';
    if (!new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`).test(content)) {
      warnings.push({
        code: 'missing-unsubscribe',
        severity: 'warning',
        message: `No {{ ${tag} }} link found. Marketing email must let recipients unsubscribe.`,
      });
    }
  }

  return warnings;
}

function lintBlock(
  id: string,
  block: Block,
  document: EmailDocument,
  background: string,
  minContrast: number,
): LintWarning[] {
  const warnings: LintWarning[] = [];
  const theme = document.theme;

  const checkContrast = (foreground: string | undefined, against: string, what: string) => {
    const resolved = resolveColor(foreground, theme);
    if (!resolved) return;
    const ratio = contrastRatio(resolved, against);
    if (ratio !== undefined && ratio < minContrast) {
      warnings.push({
        code: 'low-contrast',
        severity: 'warning',
        blockId: id,
        message: `${what} contrast is ${ratio.toFixed(1)}:1 (minimum ${minContrast}:1).`,
      });
    }
  };

  switch (block.type) {
    case 'image':
    case 'avatar':
      if (!block.props.src) {
        warnings.push({
          code: 'missing-src',
          severity: 'warning',
          blockId: id,
          message: 'Image has no source URL.',
        });
      } else if (PLACEHOLDER.test(block.props.src)) {
        warnings.push({
          code: 'placeholder-content',
          severity: 'warning',
          blockId: id,
          message: 'Image still uses a placeholder URL.',
        });
      }
      if (!block.props.alt?.trim()) {
        warnings.push({
          code: 'missing-alt',
          severity: 'warning',
          blockId: id,
          message: 'Image has no alt text.',
        });
      }
      break;
    case 'button': {
      if (!block.props.text?.trim()) {
        warnings.push({
          code: 'empty-button',
          severity: 'warning',
          blockId: id,
          message: 'Button has no label.',
        });
      }
      if (!block.props.href) {
        warnings.push({
          code: 'missing-href',
          severity: 'warning',
          blockId: id,
          message: 'Button has no link.',
        });
      } else if (PLACEHOLDER.test(block.props.href)) {
        warnings.push({
          code: 'placeholder-content',
          severity: 'warning',
          blockId: id,
          message: 'Button still links to example.com.',
        });
      }
      const fill = resolveColor(block.props.buttonColor ?? '$primary', theme);
      if (fill) checkContrast(block.props.textColor ?? '#ffffff', fill, 'Button label');
      break;
    }
    case 'text':
    case 'heading': {
      const color = block.style?.color ?? document.settings.textColor;
      checkContrast(color, background, block.type === 'text' ? 'Text' : 'Heading');
      const text = block.type === 'text' ? block.props.markdown : block.props.text;
      if (text && PLACEHOLDER.test(text)) {
        warnings.push({
          code: 'placeholder-content',
          severity: 'warning',
          blockId: id,
          message: 'Contains placeholder text.',
        });
      }
      break;
    }
    case 'container':
    case 'column':
      if (block.children.length === 0) {
        warnings.push({
          code: 'empty-container',
          severity: 'info',
          blockId: id,
          message: `Empty ${block.type}.`,
        });
      }
      break;
    default:
      break;
  }
  return warnings;
}
