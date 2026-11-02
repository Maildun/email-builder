import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import type { SectionCondition, VisibleIf } from '../../core/conditions';
import { type ConditionOption, useEditorOptions, useMessages } from '../context';
import type { EditorMessages } from '../messages';
import { Button, Icon, Segmented, SelectInput, SwitchInput, Tip } from '../ui';

type Commit = (value: unknown) => string | null;

/** The conditions a new personalized section starts with: the host's first group, if any. */
export function starterConditions(
  options: readonly ConditionOption[] | undefined,
): SectionCondition[] {
  const first = options?.[0];
  return first ? [{ id: first.id, label: first.label }] : [];
}

/** A condition's group name: the host's current label, or the one stored with it. */
function groupLabel(
  condition: SectionCondition,
  options: readonly ConditionOption[] | undefined,
  messages: EditorMessages,
): string {
  const option = options?.find((candidate) => candidate.id === condition.id);
  if (option) return option.label;
  const stored = condition.label ?? condition.id;
  return options ? messages.personalize.missingGroup(stored) : stored;
}

/** One-line description of who sees a personalized section, for the canvas. */
export function summarizeVisibleIf(
  visibleIf: VisibleIf,
  options: readonly ConditionOption[] | undefined,
  messages: EditorMessages,
): string {
  const text = messages.personalize;
  if (visibleIf.conditions.length === 0) return text.noConditions;
  const parts = visibleIf.conditions.map((condition) => {
    const label = `“${groupLabel(condition, options, messages)}”`;
    return condition.not ? text.notInGroup(label) : text.inGroup(label);
  });
  return text.summary(parts, visibleIf.match ?? 'all');
}

/** A container's personalization: a switch, then the groups readers must (not) be in. */
export function VisibleIfInput({ value, commit }: { value: unknown; commit: Commit }) {
  const { conditions: options } = useEditorOptions();
  const messages = useMessages();
  const text = messages.personalize;
  const visibleIf = value as VisibleIf | undefined;
  const conditions = visibleIf?.conditions ?? [];

  const update = (patch: Partial<VisibleIf>) =>
    commit({ match: visibleIf?.match ?? 'all', conditions, ...patch });
  const replace = (index: number, condition: SectionCondition) =>
    update({ conditions: conditions.map((current, i) => (i === index ? condition : current)) });

  return (
    <div data-slot="visible-if" className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">{text.onlySomeReaders}</span>
        <SwitchInput
          checked={visibleIf !== undefined}
          onChange={(checked) =>
            commit(checked ? { match: 'all', conditions: starterConditions(options) } : undefined)
          }
        />
      </label>
      {visibleIf ? (
        <>
          {conditions.length > 1 ? (
            <Segmented<'all' | 'any'>
              ariaLabel={text.match}
              value={visibleIf.match ?? 'all'}
              options={[
                { value: 'all', label: text.matchAll },
                { value: 'any', label: text.matchAny },
              ]}
              onChange={(match) => update({ match })}
            />
          ) : null}
          {conditions.map((condition, index) => {
            const groupOptions = [
              ...(options ?? []).map((option) => ({
                value: option.id,
                label: option.group ? `${option.group} · ${option.label}` : option.label,
              })),
              ...(options?.some((option) => option.id === condition.id)
                ? []
                : [{ value: condition.id, label: groupLabel(condition, options, messages) }]),
            ];
            return (
              // Conditions have no ids; the index is their identity while editing.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <div key={index} data-slot="visible-if-condition" className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <SelectInput<'in' | 'not'>
                      value={condition.not ? 'not' : 'in'}
                      options={[
                        { value: 'in', label: text.isIn },
                        { value: 'not', label: text.isNotIn },
                      ]}
                      onChange={(mode) => {
                        const { not: _not, ...rest } = condition;
                        replace(index, mode === 'not' ? { ...rest, not: true } : rest);
                      }}
                    />
                  </div>
                  <Tip label={text.removeCondition}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={text.removeCondition}
                      onClick={() =>
                        update({ conditions: conditions.filter((_, i) => i !== index) })
                      }
                    >
                      <Icon icon={Cancel01Icon} />
                    </Button>
                  </Tip>
                </div>
                <SelectInput<string>
                  value={condition.id}
                  options={groupOptions}
                  placeholder={text.group}
                  onChange={(id) => {
                    const option = options?.find((candidate) => candidate.id === id);
                    replace(index, {
                      ...condition,
                      id,
                      ...(option ? { label: option.label } : {}),
                    });
                  }}
                />
              </div>
            );
          })}
          {options && options.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => update({ conditions: [...conditions, ...starterConditions(options)] })}
            >
              <Icon icon={Add01Icon} data-icon="inline-start" />
              {text.addCondition}
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">{text.noGroups}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
