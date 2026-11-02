import { z } from 'zod';

export const CONDITION_OPERATORS = [
  'is_set',
  'is_not_set',
  'equals',
  'not_equals',
  'contains',
  'not_contains',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/** Operators that compare against `value`; the others only check presence. */
export function conditionNeedsValue(operator: ConditionOperator): boolean {
  return operator !== 'is_set' && operator !== 'is_not_set';
}

export const ConditionRuleSchema = z.strictObject({
  field: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_.]*$/, 'Use a merge tag key, e.g. "first_name".')
    .describe('Merge tag key the rule reads, without braces, e.g. "plan".'),
  operator: z
    .enum(CONDITION_OPERATORS)
    .describe(
      'is_set / is_not_set check for a non-empty value. equals, not_equals, contains and not_contains compare text, ignoring case and surrounding spaces.',
    ),
  value: z
    .string()
    .max(500)
    .optional()
    .describe('Text to compare with. Omit for is_set and is_not_set.'),
});

export const VisibleIfSchema = z
  .strictObject({
    match: z
      .enum(['all', 'any'])
      .optional()
      .describe('all = every rule must pass (default), any = one passing rule is enough.'),
    rules: z.array(ConditionRuleSchema).max(10),
  })
  .describe(
    'Show this container only to readers whose merge data passes the rules; the sending platform decides per recipient. Omit to show it to everyone.',
  );

export type ConditionRule = z.infer<typeof ConditionRuleSchema>;
export type VisibleIf = z.infer<typeof VisibleIfSchema>;

/** Reader data a condition is checked against: merge tag key to value. */
export type ConditionData = Readonly<Record<string, unknown>>;

function fieldText(data: ConditionData, field: string): string {
  const value = data[field];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim()
    : '';
}

/**
 * Whether a reader passes one rule. Missing fields count as empty. Hosts that
 * evaluate conditions themselves (e.g. in PHP) must follow the same rules.
 */
export function matchesRule(rule: ConditionRule, data: ConditionData): boolean {
  const actual = fieldText(data, rule.field).toLowerCase();
  const expected = (rule.value ?? '').trim().toLowerCase();
  switch (rule.operator) {
    case 'is_set':
      return actual !== '';
    case 'is_not_set':
      return actual === '';
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      return actual.includes(expected);
    case 'not_contains':
      return !actual.includes(expected);
  }
}

/** Whether a reader sees a container with these rules. No rules means everyone does. */
export function matchesVisibleIf(visibleIf: VisibleIf, data: ConditionData): boolean {
  if (visibleIf.rules.length === 0) return true;
  return visibleIf.match === 'any'
    ? visibleIf.rules.some((rule) => matchesRule(rule, data))
    : visibleIf.rules.every((rule) => matchesRule(rule, data));
}
