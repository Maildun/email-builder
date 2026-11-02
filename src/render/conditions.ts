import { type ConditionData, matchesVisibleIf, type VisibleIf } from '../core/conditions';

/**
 * Personalized sections are wrapped in comment markers that the sending
 * platform resolves per recipient:
 *
 *   <!--meb:if:ID {"rules":[…]}-->…<!--meb:endif:ID-->
 *
 * ID is the block id with "-" written as "." so it can never close the
 * comment, and the JSON escapes "-" as \u002d for the same reason. The id
 * pairs each start with its end, so sections can nest.
 */
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
 * rest, in rendered HTML or plain text. Merge tags are left for the host to
 * fill. Markers with unreadable rules are dropped and their content kept.
 */
export function resolveConditions(content: string, data: ConditionData): string {
  return content.replace(CONDITION_BLOCK, (_match, _id: string, json: string, inner: string) => {
    let visibleIf: VisibleIf | undefined;
    try {
      visibleIf = JSON.parse(json) as VisibleIf;
    } catch {
      visibleIf = undefined;
    }
    if (visibleIf && Array.isArray(visibleIf.rules) && !matchesVisibleIf(visibleIf, data)) {
      return '';
    }
    return resolveConditions(inner, data);
  });
}
