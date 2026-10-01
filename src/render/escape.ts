import { isSafeUrl } from '../core/schema/primitives';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Returns an escaped attribute-safe URL, or undefined for unsafe/empty values. */
export function safeUrl(value: string | undefined): string | undefined {
  if (!value?.trim() || !isSafeUrl(value)) {
    return undefined;
  }
  return escapeHtml(value.trim());
}

const MERGE_TAG = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

/**
 * Swaps merge tags for space-free placeholders so markdown can parse them as
 * link targets, and returns a function that puts canonical `{{ key }}` back.
 */
export function protectMergeTags(text: string): {
  text: string;
  restore: (html: string) => string;
} {
  const keys: string[] = [];
  const protectedText = text.replace(MERGE_TAG, (_match, key: string) => {
    keys.push(key);
    return `MEBMERGE${keys.length - 1}TAG`;
  });
  return {
    text: protectedText,
    restore: (html) =>
      keys.length === 0
        ? html
        : html.replace(/MEBMERGE(\d+)TAG/g, (match, index: string) => {
            const key = keys[Number(index)];
            return key === undefined ? match : `{{ ${key} }}`;
          }),
  };
}
