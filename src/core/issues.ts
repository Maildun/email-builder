import type { z } from 'zod';

/**
 * A validation or operation problem. Messages are written so an LLM agent can
 * read them and correct its next call without human help.
 */
export interface Issue {
  /** Dot path to the offending value, e.g. `blocks.b_1.props.href` or `ops.0.blocks.1.type`. */
  path: string;
  message: string;
  /** Concrete fix suggestion when one is known. */
  hint?: string;
  /** Block the issue belongs to, when there is one. */
  blockId?: string;
  /** Index of the operation in an `applyOps` batch. */
  opIndex?: number;
}

/** Common wrong keys mapped to the right ones, per block type (`*` = any). */
const KEY_ALIASES: Record<string, Record<string, string>> = {
  '*': {
    textAlign: 'align',
    alignment: 'align',
    bgColor: 'backgroundColor',
    background: 'backgroundColor',
  },
  button: {
    url: 'href',
    link: 'href',
    label: 'text',
    backgroundColor: 'buttonColor',
    color: 'textColor',
  },
  image: { url: 'src', link: 'href', linkHref: 'href', altText: 'alt' },
  avatar: { url: 'src', imageUrl: 'src' },
  text: { text: 'markdown', content: 'markdown', body: 'markdown' },
  heading: { content: 'text', title: 'text' },
  html: { contents: 'html', content: 'html' },
  divider: { lineColor: 'color', lineHeight: 'thickness', height: 'thickness' },
};

export function aliasHint(blockType: string | undefined, key: string): string | undefined {
  const alias = (blockType && KEY_ALIASES[blockType]?.[key]) ?? KEY_ALIASES['*']?.[key];
  return alias ? `Did you mean "${alias}"?` : undefined;
}

export function joinPath(...parts: Array<string | number | undefined>): string {
  return parts
    .filter((part) => part !== undefined && part !== '')
    .map(String)
    .join('.');
}

/** Flattens a zod error into issues, adding alias hints for unknown keys. */
export function issuesFromZod(
  error: z.ZodError,
  options: { prefix?: string; blockType?: string; blockId?: string; opIndex?: number } = {},
): Issue[] {
  const issues: Issue[] = [];
  for (const zodIssue of error.issues) {
    const basePath = joinPath(options.prefix, ...zodIssue.path.map((p) => String(p)));
    if (zodIssue.code === 'unrecognized_keys') {
      for (const key of zodIssue.keys) {
        const hint = aliasHint(options.blockType, key);
        issues.push({
          path: joinPath(basePath, key),
          message: `Unknown key "${key}".`,
          ...(hint ? { hint } : {}),
          ...(options.blockId ? { blockId: options.blockId } : {}),
          ...(options.opIndex !== undefined ? { opIndex: options.opIndex } : {}),
        });
      }
      continue;
    }
    if (
      zodIssue.code === 'invalid_union' &&
      'note' in zodIssue &&
      zodIssue.note === 'No matching discriminator'
    ) {
      issues.push({
        path: basePath,
        message: 'Unknown block type.',
        hint: 'Use one of: heading, text, button, image, avatar, divider, spacer, html, custom, container, columns, column.',
        ...(options.blockId ? { blockId: options.blockId } : {}),
        ...(options.opIndex !== undefined ? { opIndex: options.opIndex } : {}),
      });
      continue;
    }
    issues.push({
      path: basePath,
      // "Invalid input: expected string, received undefined" means a missing value.
      message:
        zodIssue.code === 'invalid_type' && zodIssue.message.endsWith('received undefined')
          ? 'Required.'
          : zodIssue.message,
      ...(options.blockId ? { blockId: options.blockId } : {}),
      ...(options.opIndex !== undefined ? { opIndex: options.opIndex } : {}),
    });
  }
  return issues;
}

export function formatIssues(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const where = issue.opIndex !== undefined ? `op ${issue.opIndex}: ` : '';
      const path = issue.path ? `${issue.path}: ` : '';
      return `- ${where}${path}${issue.message}${issue.hint ? ` ${issue.hint}` : ''}`;
    })
    .join('\n');
}
