import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { useId } from 'react';
import {
  CONDITION_OPERATORS,
  type ConditionOperator,
  type ConditionRule,
  conditionNeedsValue,
  type VisibleIf,
} from '../../core/conditions';
import { type MergeTag, useEditorOptions, useMessages } from '../context';
import type { EditorMessages } from '../messages';
import { Button, Icon, Segmented, SelectInput, SwitchInput, Tip } from '../ui';
import { TextInput } from './controls';

type Commit = (value: unknown) => string | null;

/** The rule a new personalized section or a new rule starts with. */
export function starterRule(mergeTags: readonly MergeTag[]): ConditionRule {
  return { field: mergeTags[0]?.key ?? 'first_name', operator: 'is_set' };
}

function fieldLabel(mergeTags: readonly MergeTag[], key: string): string {
  return mergeTags.find((tag) => tag.key === key)?.label ?? key;
}

/** One-line description of who sees a personalized section, for the canvas. */
export function summarizeVisibleIf(
  visibleIf: VisibleIf,
  mergeTags: readonly MergeTag[],
  messages: EditorMessages,
): string {
  const text = messages.personalize;
  if (visibleIf.rules.length === 0) return text.noRules;
  const rules = visibleIf.rules.map((rule) => {
    const field = fieldLabel(mergeTags, rule.field);
    const operator = text.operators[rule.operator];
    return conditionNeedsValue(rule.operator)
      ? `${field} ${operator} “${rule.value ?? ''}”`
      : `${field} ${operator}`;
  });
  return text.summary(rules, visibleIf.match ?? 'all');
}

/** A container's personalization: a switch, then the rules readers must pass. */
export function VisibleIfInput({ value, commit }: { value: unknown; commit: Commit }) {
  const { mergeTags } = useEditorOptions();
  const text = useMessages().personalize;
  const baseId = useId();
  const visibleIf = value as VisibleIf | undefined;
  const rules = visibleIf?.rules ?? [];

  const update = (patch: Partial<VisibleIf>) =>
    commit({ match: visibleIf?.match ?? 'all', rules, ...patch });
  const replace = (index: number, rule: ConditionRule) =>
    update({ rules: rules.map((current, i) => (i === index ? rule : current)) });

  const operatorOptions = CONDITION_OPERATORS.map((operator) => ({
    value: operator,
    label: text.operators[operator],
  }));

  return (
    <div data-slot="visible-if" className="flex flex-col gap-3">
      <label htmlFor={`${baseId}-switch`} className="flex items-center justify-between gap-3">
        <span className="text-sm">{text.onlySomeReaders}</span>
        <SwitchInput
          id={`${baseId}-switch`}
          checked={visibleIf !== undefined}
          onChange={(checked) =>
            commit(checked ? { match: 'all', rules: [starterRule(mergeTags)] } : undefined)
          }
        />
      </label>
      {visibleIf ? (
        <>
          {rules.length > 1 ? (
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
          {rules.map((rule, index) => {
            const fieldOptions = [
              ...mergeTags.map((tag) => ({ value: tag.key, label: tag.label ?? tag.key })),
              ...(mergeTags.some((tag) => tag.key === rule.field)
                ? []
                : [{ value: rule.field, label: rule.field }]),
            ];
            return (
              // Rules have no ids; the index is their identity while editing.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <div key={index} data-slot="visible-if-rule" className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    {mergeTags.length > 0 ? (
                      <SelectInput<string>
                        value={rule.field}
                        options={fieldOptions}
                        placeholder={text.field}
                        onChange={(field) => replace(index, { ...rule, field })}
                      />
                    ) : (
                      <TextInput
                        id={`${baseId}-${index}-field`}
                        value={rule.field}
                        placeholder={text.noFields}
                        onCommit={(field) => (field ? replace(index, { ...rule, field }) : null)}
                      />
                    )}
                  </div>
                  <Tip label={text.removeRule}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={text.removeRule}
                      onClick={() => update({ rules: rules.filter((_, i) => i !== index) })}
                    >
                      <Icon icon={Cancel01Icon} />
                    </Button>
                  </Tip>
                </div>
                <SelectInput<ConditionOperator>
                  value={rule.operator}
                  options={operatorOptions}
                  placeholder={text.condition}
                  onChange={(operator) => {
                    const { value: _value, ...rest } = rule;
                    replace(
                      index,
                      conditionNeedsValue(operator) ? { ...rule, operator } : { ...rest, operator },
                    );
                  }}
                />
                {conditionNeedsValue(rule.operator) ? (
                  <TextInput
                    id={`${baseId}-${index}-value`}
                    value={rule.value}
                    placeholder={text.value}
                    onCommit={(next) => {
                      const { value: _value, ...rest } = rule;
                      return replace(index, next === undefined ? rest : { ...rule, value: next });
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => update({ rules: [...rules, starterRule(mergeTags)] })}
          >
            <Icon icon={Add01Icon} data-icon="inline-start" />
            {text.addRule}
          </Button>
        </>
      ) : null}
    </div>
  );
}
