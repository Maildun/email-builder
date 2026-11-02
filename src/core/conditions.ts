import { z } from 'zod';

/**
 * One condition of a personalized section: the reader is (or, with `not`,
 * is not) in a group the host app defines, such as a segment or a tag.
 */
export const SectionConditionSchema = z.strictObject({
  id: z
    .string()
    .regex(
      /^[A-Za-z0-9][\w:.-]{0,199}$/,
      'Use a condition id the host app offers, e.g. "segment:0b9c…" or "tag:vip".',
    )
    .describe('Id of a reader group the host app offers, e.g. a segment or a tag.'),
  label: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Name of the group when the section was set up, shown if the host no longer offers it.',
    ),
  not: z.boolean().optional().describe('true = the reader must NOT be in the group.'),
});

export const VisibleIfSchema = z
  .strictObject({
    match: z
      .enum(['all', 'any'])
      .optional()
      .describe(
        'all = every condition must pass (default), any = one passing condition is enough.',
      ),
    conditions: z.array(SectionConditionSchema).max(10),
  })
  .describe(
    'Show this container only to readers in (or not in) groups the host app offers, such as segments or tags. The sending platform decides per recipient. Omit to show it to everyone.',
  );

export type SectionCondition = z.infer<typeof SectionConditionSchema>;
export type VisibleIf = z.infer<typeof VisibleIfSchema>;

/** Whether a personalized section has conditions, so not every reader sees it. */
export function isPersonalized(visibleIf: VisibleIf | undefined): visibleIf is VisibleIf {
  return (visibleIf?.conditions.length ?? 0) > 0;
}

/**
 * Whether a reader in the given groups sees a section with these conditions.
 * No conditions means everyone does. Hosts that evaluate conditions
 * themselves (e.g. in PHP) must follow the same rules.
 */
export function matchesVisibleIf(visibleIf: VisibleIf, memberships: ReadonlySet<string>): boolean {
  if (visibleIf.conditions.length === 0) return true;
  const passes = (condition: SectionCondition) =>
    memberships.has(condition.id) !== (condition.not === true);
  return visibleIf.match === 'any'
    ? visibleIf.conditions.some(passes)
    : visibleIf.conditions.every(passes);
}
