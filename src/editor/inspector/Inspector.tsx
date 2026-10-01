import { Tabs } from '@base-ui/react/tabs';
import { ChevronRight, Copy, Trash } from 'lucide-react';
import { BLOCK_DEFINITIONS, type Block } from '../../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { FONT_FAMILIES, type FontKey, type Padding } from '../../core/schema/primitives';
import { ancestorIds } from '../../core/tree';
import { useEditorOptions, useEditorState, useEditorStore, useVisibleDocument } from '../context';
import { BLOCK_ICONS } from '../meta';
import type { EditorStore } from '../store';
import { Button, Field, NumberInput, Segmented, SelectInput, SwitchInput, Tip } from '../ui';
import { ColorInput, ImageInput, PaddingInput, Section, TextInput, UrlInput } from './controls';
import { BLOCK_FIELDS, DEFAULT_OPTION, type FieldSpec, FONT_OPTIONS, type Scope } from './fields';

type Commit = (value: unknown) => string | null;

function firstMessage(issues: Array<{ message: string; hint?: string }>): string | null {
  const issue = issues[0];
  return issue ? `${issue.message}${issue.hint ? ` ${issue.hint}` : ''}` : null;
}

function blockCommit(store: EditorStore, id: string, scope: Scope, key: string): Commit {
  return (value) => {
    const result = store.apply(
      { op: 'update', id, [scope]: { [key]: value === undefined ? null : value } },
      { mergeKey: `${id}.${scope}.${key}` },
    );
    return result.ok ? null : firstMessage(result.issues);
  };
}

function FieldControl({
  field,
  block,
  document,
  commit,
  commitAlt,
}: {
  field: FieldSpec;
  block: Block;
  document: EmailDocument;
  commit: Commit;
  commitAlt?: Commit;
}) {
  const source = (field.scope === 'props' ? block.props : (block.style ?? {})) as Record<
    string,
    unknown
  >;
  const value = source[field.key];

  return (
    <Field label={field.label} hint={field.hint} inline={field.kind === 'switch'}>
      {(id) => {
        switch (field.kind) {
          case 'text':
            return (
              <TextInput
                id={id}
                value={value as string | undefined}
                onCommit={commit}
                placeholder={field.placeholder}
              />
            );
          case 'textarea':
            return (
              <TextInput
                id={id}
                multiline
                rows={field.rows}
                mono={field.mono}
                value={value as string | undefined}
                onCommit={commit}
                placeholder={field.placeholder}
              />
            );
          case 'url':
            return (
              <UrlInput
                id={id}
                value={value as string | undefined}
                onCommit={commit}
                placeholder={field.placeholder}
              />
            );
          case 'image':
            return (
              <ImageInput
                id={id}
                value={value as string | undefined}
                onCommit={commit}
                {...(commitAlt ? { onAlt: (alt: string) => void commitAlt(alt) } : {})}
              />
            );
          case 'number':
            return (
              <NumberInput
                id={id}
                value={value as number | undefined}
                min={field.min}
                max={field.max}
                step={field.step}
                unit={field.unit}
                placeholder={field.placeholder}
                onChange={(next) => commit(next)}
              />
            );
          case 'select':
            return (
              <SelectInput
                id={id}
                value={(value as string | undefined) ?? DEFAULT_OPTION}
                options={field.options}
                onChange={(next) => commit(next === DEFAULT_OPTION ? undefined : next)}
              />
            );
          case 'segmented':
            return (
              <Segmented
                id={id}
                ariaLabel={field.label}
                value={value === undefined ? undefined : String(value)}
                options={field.options}
                onChange={(next) => commit(field.key === 'level' ? Number(next) : next)}
              />
            );
          case 'switch':
            return (
              <SwitchInput
                id={id}
                checked={Boolean(value ?? field.key === 'stackOnMobile')}
                onChange={(next) => commit(next)}
              />
            );
          case 'color':
            return (
              <ColorInput
                id={id}
                value={value as string | undefined}
                theme={document.theme}
                allowClear={field.allowClear}
                onCommit={commit}
              />
            );
          case 'padding':
            return <PaddingInput value={value as Padding | undefined} onCommit={commit} />;
          case 'imageWidth': {
            const mode = value === 'full' ? 'full' : value === undefined ? 'auto' : 'fixed';
            return (
              <div className="meb-stack-sm">
                <Segmented
                  id={id}
                  ariaLabel="Width mode"
                  value={mode}
                  options={[
                    { value: 'full', label: 'Fill' },
                    { value: 'auto', label: 'Natural' },
                    { value: 'fixed', label: 'Fixed' },
                  ]}
                  onChange={(next) =>
                    commit(next === 'full' ? 'full' : next === 'auto' ? undefined : 300)
                  }
                />
                {mode === 'fixed' ? (
                  <NumberInput
                    value={value as number}
                    min={1}
                    max={1200}
                    unit="px"
                    onChange={(next) => commit(next ?? 300)}
                  />
                ) : null}
              </div>
            );
          }
        }
      }}
    </Field>
  );
}

function BlockInspector({ id }: { id: string }) {
  const store = useEditorStore();
  const document = useVisibleDocument();
  const block = document.blocks[id];
  if (!block) return null;
  const Icon = BLOCK_ICONS[block.type];
  const trail = ancestorIds(document, id).reverse();

  return (
    <div className="meb-inspector-body">
      <div className="meb-inspector-head">
        <div className="meb-breadcrumbs">
          {trail.map((ancestor) => {
            const ancestorBlock = document.blocks[ancestor];
            return ancestorBlock ? (
              <span key={ancestor} className="meb-crumb">
                <button
                  type="button"
                  className="meb-link-button"
                  onClick={() => store.select(ancestor)}
                >
                  {BLOCK_DEFINITIONS[ancestorBlock.type].label}
                </button>
                <ChevronRight size={12} />
              </span>
            ) : null;
          })}
        </div>
        <div className="meb-row meb-between">
          <h2 className="meb-inspector-title">
            <Icon size={16} /> {BLOCK_DEFINITIONS[block.type].label}
          </h2>
          <div className="meb-row">
            <Tip label="Duplicate (⌘D)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Duplicate block"
                onClick={() => store.apply({ op: 'duplicate', id })}
              >
                <Copy size={15} />
              </Button>
            </Tip>
            <Tip label="Delete (⌫)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete block"
                onClick={() => store.apply({ op: 'remove', id })}
              >
                <Trash size={15} />
              </Button>
            </Tip>
          </div>
        </div>
      </div>
      {BLOCK_FIELDS[block.type].map((group) => (
        <Section key={group.title} title={group.title}>
          {group.fields.map((field) => (
            <FieldControl
              key={`${id}.${field.scope}.${field.key}`}
              field={field}
              block={block}
              document={document}
              commit={blockCommit(store, id, field.scope, field.key)}
              {...(field.kind === 'image'
                ? { commitAlt: blockCommit(store, id, 'props', 'alt') }
                : {})}
            />
          ))}
        </Section>
      ))}
    </div>
  );
}

function EmailInspector() {
  const store = useEditorStore();
  const document = useVisibleDocument();
  const { settings, theme } = document;

  const setting =
    (key: string): Commit =>
    (value) => {
      const result = store.apply(
        { op: 'updateSettings', settings: { [key]: value === undefined ? null : value } },
        { mergeKey: `settings.${key}` },
      );
      return result.ok ? null : firstMessage(result.issues);
    };
  const themeColor =
    (key: string): Commit =>
    (value) => {
      if (value === undefined) return null;
      const result = store.apply(
        { op: 'updateTheme', colors: { [key]: value } },
        { mergeKey: `theme.${key}` },
      );
      return result.ok ? null : firstMessage(result.issues);
    };
  const themeFont = (key: 'body' | 'heading') => (value: string) =>
    store.apply({ op: 'updateTheme', fonts: { [key]: value } });

  const fontValue = (font: string) => (font in FONT_FAMILIES ? (font as FontKey) : undefined);

  return (
    <div className="meb-inspector-body">
      <Section title="Inbox">
        <Field label="Preheader" hint="Preview text shown after the subject line.">
          {(id) => (
            <TextInput
              id={id}
              value={settings.preheader}
              onCommit={setting('preheader')}
              placeholder="A short summary…"
            />
          )}
        </Field>
      </Section>
      <Section title="Theme colors">
        {(Object.keys(theme.colors) as Array<keyof typeof theme.colors>).map((key) => (
          <Field key={key} label={key[0]?.toUpperCase() + key.slice(1)}>
            {(id) => (
              <ColorInput
                id={id}
                value={theme.colors[key]}
                theme={theme}
                onCommit={themeColor(key)}
              />
            )}
          </Field>
        ))}
      </Section>
      <Section title="Typography">
        <Field label="Body font">
          {(id) => (
            <SelectInput
              id={id}
              value={fontValue(theme.fonts.body)}
              options={FONT_OPTIONS}
              onChange={themeFont('body')}
            />
          )}
        </Field>
        <Field label="Heading font">
          {(id) => (
            <SelectInput
              id={id}
              value={fontValue(theme.fonts.heading)}
              options={FONT_OPTIONS}
              onChange={themeFont('heading')}
            />
          )}
        </Field>
        <Field label="Base size">
          {(id) => (
            <NumberInput
              id={id}
              value={settings.fontSize}
              min={10}
              max={24}
              unit="px"
              onChange={(v) => setting('fontSize')(v ?? 16)}
            />
          )}
        </Field>
        <Field label="Line height">
          {(id) => (
            <NumberInput
              id={id}
              value={settings.lineHeight}
              min={1}
              max={2.5}
              step={0.05}
              onChange={(v) => setting('lineHeight')(v ?? 1.5)}
            />
          )}
        </Field>
      </Section>
      <Section title="Layout">
        <Field label="Content width">
          {(id) => (
            <NumberInput
              id={id}
              value={settings.width}
              min={320}
              max={1200}
              step={10}
              unit="px"
              onChange={(v) => setting('width')(v ?? 600)}
            />
          )}
        </Field>
        <Field label="Outer padding">
          {() => <PaddingInput value={settings.padding} onCommit={setting('padding')} />}
        </Field>
        <Field label="Backdrop">
          {(id) => (
            <ColorInput
              id={id}
              value={settings.backdropColor}
              theme={theme}
              onCommit={setting('backdropColor')}
            />
          )}
        </Field>
        <Field label="Canvas">
          {(id) => (
            <ColorInput
              id={id}
              value={settings.canvasColor}
              theme={theme}
              onCommit={setting('canvasColor')}
            />
          )}
        </Field>
        <Field label="Text">
          {(id) => (
            <ColorInput
              id={id}
              value={settings.textColor}
              theme={theme}
              onCommit={setting('textColor')}
            />
          )}
        </Field>
        <Field label="Links">
          {(id) => (
            <ColorInput
              id={id}
              value={settings.linkColor}
              theme={theme}
              onCommit={setting('linkColor')}
            />
          )}
        </Field>
        <Field label="Canvas border">
          {(id) => (
            <ColorInput
              id={id}
              value={settings.borderColor}
              theme={theme}
              allowClear
              placeholder="None"
              onCommit={setting('borderColor')}
            />
          )}
        </Field>
        <Field label="Canvas radius">
          {(id) => (
            <NumberInput
              id={id}
              value={settings.borderRadius}
              min={0}
              max={48}
              unit="px"
              placeholder="0"
              onChange={(v) => setting('borderRadius')(v)}
            />
          )}
        </Field>
      </Section>
    </div>
  );
}

export function Inspector() {
  const selectedId = useEditorState((state) => state.selectedId);
  const hasProposal = useEditorState((state) => state.proposal !== null);
  const { readOnly } = useEditorOptions();
  const store = useEditorStore();
  const tab = selectedId && selectedId !== ROOT_ID ? 'block' : 'email';

  return (
    <aside className="meb-inspector" aria-label="Inspector">
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          if (value === 'email') store.select(null);
        }}
      >
        <Tabs.List className="meb-tabs">
          <Tabs.Tab value="block" className="meb-tab" disabled={!selectedId}>
            Block
          </Tabs.Tab>
          <Tabs.Tab value="email" className="meb-tab">
            Email
          </Tabs.Tab>
        </Tabs.List>
        <fieldset className="meb-fieldset" disabled={hasProposal || readOnly}>
          {hasProposal ? (
            <p className="meb-notice">Accept or reject the proposed changes to keep editing.</p>
          ) : null}
          <Tabs.Panel value="block">
            {selectedId ? <BlockInspector id={selectedId} /> : null}
          </Tabs.Panel>
          <Tabs.Panel value="email">
            <EmailInspector />
          </Tabs.Panel>
        </fieldset>
      </Tabs.Root>
    </aside>
  );
}
