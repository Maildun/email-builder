import { matchesVisibleIf, type VisibleIf } from '../core/conditions';

/**
 * How personalized sections render. `omit` (the default) leaves them out, so
 * a host that does not resolve them never sends one to the wrong reader.
 * `markers` keeps them, wrapped in comments the sending platform resolves
 * per recipient:
 *
 *   <!--meb:if:ID {"conditions":[…]}-->…<!--meb:endif:ID-->
 *
 * ID is the block id with "-" written as "." so it can never close the
 * comment, and the JSON escapes "-" as \u002d for the same reason. The id
 * pairs each start with its end, so sections can nest.
 */
export type PersonalizationMode = 'omit' | 'markers';

const CONDITION_BLOCK = /<!--meb:if:([A-Za-z][\w.]*) (\{.*?\})-->([\s\S]*?)<!--meb:endif:\1-->/g;

function markerId(id: string): string {
  return id.replaceAll('-', '.');
}

export function conditionStart(id: string, visibleIf: VisibleIf): string {
  const json = JSON.stringify(visibleIf).replaceAll('-', '\\u002d');
  return `<!--meb:if:${markerId(id)} ${json}-->`;
}

export function conditionEnd(id: string): string {
  return `<!--meb:endif:${markerId(id)}-->`;
}

/**
 * Keeps the personalized sections this reader should see and removes the
 * rest, in HTML or plain text rendered with `personalization: 'markers'`.
 * `memberships` are the ids of the groups the reader is in. Merge tags are
 * left for the host to fill. Markers with unreadable conditions are dropped
 * along with their content.
 */
export function resolveConditions(content: string, memberships: Iterable<string>): string {
  const groups = new Set(memberships);
  const resolve = (source: string): string =>
    source.replace(CONDITION_BLOCK, (_match, _id: string, json: string, inner: string) => {
      let visibleIf: VisibleIf | undefined;
      try {
        visibleIf = JSON.parse(json) as VisibleIf;
      } catch {
        return '';
      }
      return Array.isArray(visibleIf?.conditions) && matchesVisibleIf(visibleIf, groups)
        ? resolve(inner)
        : '';
    });
  return resolve(content);
}
