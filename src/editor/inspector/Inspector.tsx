import { ArrowRight01Icon, Copy01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import type { Block } from '../../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { FONT_FAMILIES, type FontKey, type Padding } from '../../core/schema/primitives';
import { ancestorIds } from '../../core/tree';
import { duplicateBlock, removeBlock } from '../actions';
import {
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useMessages,
  useSlotClassName,
  useVisibleDocument,
} from '../context';
import { type EditorMessages, translate } from '../messages';
import { blockIcon, blockLabel } from '../meta';
import type { EditorStore } from '../store';
import {
  Button,
  cn,
  Field,
  Icon,
  NumberInput,
  Segmented,
  SelectInput,
  SwitchInput,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tip,
} from '../ui';
import {
  ColorInput,
  GroupField,
  ImageInput,
  PaddingInput,
  Section,
  TextInput,
  UrlInput,
} from './controls';
import {
  BLOCK_FIELDS,
  customFieldGroups,
  DEFAULT_OPTION,
  type FieldGroup,
  type FieldSpec,
  FONT_OPTIONS,
  type Scope,
} from './fields';

type Commit = (value: unknown) => string | null;

function firstMessage(issues: Array<{ message: string; hint?: string }>): string | null {
  const issue = issues[0];
  return issue ? `${issue.message}${issue.hint ? ` ${issue.hint}` : ''}` : null;
}

function blockCommit(store: EditorStore, id: string, scope: Scope, key: string): Commit {
  return (value) => {
    if (scope === 'data') {
      // A custom block's data is one prop; replace it with the key changed.
      const block = store.getState().document.blocks[id];
      const data = { ...(block?.type === 'custom' ? (block.props.data ?? {}) : {}) };
      if (value === undefined) delete data[key];
      else data[key] = value as never;
      const result = store.apply(
        { op: 'update', id, props: { data } },
        { mergeKey: `${id}.data.${key}` },
      );
      return result.ok ? null : firstMessage(result.issues);
    }
    const result = store.apply(
      { op: 'update', id, [scope]: { [key]: value === undefined ? null : value } },
      { mergeKey: `${id}.${scope}.${key}` },
    );
    return result.ok ? null : firstMessage(result.issues);
  };
}

/** A field spec with its label, hint, placeholder and options in the editor's language. */
function localizeField(field: FieldSpec, messages: EditorMessages): FieldSpec {
  const t = (english: string) => translate(messages, english);
  const localized = {
    ...field,
    label: t(field.label),
    ...(field.hint ? { hint: t(field.hint) } : {}),
  } as FieldSpec;
  if ('placeholder' in localized && localized.placeholder) {
    localized.placeholder = t(localized.placeholder);
  }
  if ('options' in localized) {
    localized.options = localized.options.map((option) => ({ ...option, label: t(option.label) }));
  }
  return localized;
}

/** Field values by scope; custom block data lives in `props.data`. */
function fieldSource(block: Block, scope: Scope): Record<string, unknown> {
  if (scope === 'style') return (block.style ?? {}) as Record<string, unknown>;
  if (scope === 'data') return block.type === 'custom' ? (block.props.data ?? {}) : {};
  return block.props as Record<string, unknown>;
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
  const value = fieldSource(block, field.scope)[field.key];
  const strings = useMessages().inspector;

  if (field.kind === 'json') {
    return (
      <Field label={field.label} hint={field.hint}>
        {(id) => (
          <TextInput
            id={id}
            multiline
            mono
            rows={8}
            value={JSON.stringify(value ?? {}, null, 2)}
            onCommit={(text) => {
              try {
                return commit(JSON.parse(text || '{}'));
              } catch {
                return strings.invalidJson;
              }
            }}
          />
        )}
      </Field>
    );
  }

  // Option rows, padding and image width have no single labelable element,
  // so their title labels the group rather than a `<label for>`.
  if (field.kind === 'segmented') {
    return (
      <GroupField label={field.label} hint={field.hint}>
        {() => (
          <Segmented
            ariaLabel={field.label}
            value={value === undefined ? undefined : String(value)}
            options={field.options}
            onChange={(next) => commit(field.key === 'level' ? Number(next) : next)}
          />
        )}
      </GroupField>
    );
  }
  if (field.kind === 'padding') {
    return (
      <GroupField label={field.label} hint={field.hint}>
        {() => <PaddingInput value={value as Padding | undefined} onCommit={commit} />}
      </GroupField>
    );
  }
  if (field.kind === 'imageWidth') {
    const mode = value === 'full' ? 'full' : value === undefined ? 'auto' : 'fixed';
    return (
      <GroupField label={field.label} hint={field.hint}>
        {() => (
          <div className="flex flex-col gap-1.5">
            <Segmented
              ariaLabel={strings.widthMode}
              value={mode}
              options={[
                { value: 'full', label: strings.widthFill },
                { value: 'auto', label: strings.widthNatural },
                { value: 'fixed', label: strings.widthFixed },
              ]}
              onChange={(next) =>
                commit(next === 'full' ? 'full' : next === 'auto' ? undefined : 300)
              }
            />
            {mode === 'fixed' ? (
              <NumberInput
                ariaLabel={strings.inPixels(field.label)}
                value={value as number}
                min={1}
                max={1200}
                unit="px"
                onChange={(next) => commit(next ?? 300)}
              />
            ) : null}
          </div>
        )}
      </GroupField>
    );
  }

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
                placeholder={strings.selectPlaceholder}
                onChange={(next) => commit(next === DEFAULT_OPTION ? undefined : next)}
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
        }
      }}
    </Field>
  );
}

/** Field groups for a block; custom blocks add their own fields before the box styles. */
function fieldGroupsFor(
  block: Block,
  custom: ReturnType<typeof useEditorOptions>['customBlockMap'],
): FieldGroup[] {
  if (block.type !== 'custom') return BLOCK_FIELDS[block.type];
  const definition = custom.get(block.props.name);
  return [...(definition ? customFieldGroups(definition) : []), ...BLOCK_FIELDS.custom];
}

function BlockInspector({ id }: { id: string }) {
  const store = useEditorStore();
  const document = useVisibleDocument();
  const { customBlockMap: custom, messages } = useEditorOptions();
  const text = messages.inspector;
  const block = document.blocks[id];
  if (!block) return null;
  const trail = ancestorIds(document, id).reverse();
  const unknownCustom = block.type === 'custom' && !custom.has(block.props.name);

  return (
    <div data-slot="inspector-body" className="pb-6">
      <div data-slot="inspector-header" className="flex flex-col gap-1 border-b px-4 py-3">
        {trail.length > 0 ? (
          <nav
            aria-label={text.breadcrumb}
            className="flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground"
          >
            {trail.map((ancestor) => {
              const ancestorBlock = document.blocks[ancestor];
              return ancestorBlock ? (
                <span key={ancestor} className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    className="cursor-pointer rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => store.select(ancestor)}
                  >
                    {blockLabel(ancestorBlock, custom, messages)}
                  </button>
                  <Icon icon={ArrowRight01Icon} className="size-3" />
                </span>
              ) : null;
            })}
          </nav>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <Icon icon={blockIcon(block, custom)} className="size-4 shrink-0" />{' '}
            <span className="truncate">{blockLabel(block, custom, messages)}</span>
          </h2>
          <div className="flex items-center gap-0.5">
            <Tip label={text.duplicateTip}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={text.duplicate}
                onClick={(event) => duplicateBlock(store, id, event.currentTarget)}
              >
                <Icon icon={Copy01Icon} />
              </Button>
            </Tip>
            <Tip label={text.deleteTip}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={text.delete}
                onClick={(event) => removeBlock(store, id, messages, event.currentTarget)}
              >
                <Icon icon={Delete02Icon} />
              </Button>
            </Tip>
          </div>
        </div>
      </div>
      {unknownCustom ? (
        <p className="mx-4 mt-3 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {text.unknownCustom(block.props.name)}
        </p>
      ) : null}
      {fieldGroupsFor(block, custom).map((group) => (
        <Section key={group.title} title={translate(messages, group.title)}>
          {group.fields.map((field) => (
            <FieldControl
              key={`${id}.${field.scope}.${field.key}`}
              field={localizeField(field, messages)}
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
  const messages = useMessages();
  const text = messages.inspector;
  const fontOptions = FONT_OPTIONS.map((option) => ({
    ...option,
    label: translate(messages, option.label),
  }));

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
    <div data-slot="inspector-body" className="pb-6">
      <Section title={text.inbox}>
        <Field label={text.preheader} hint={text.preheaderHint}>
          {(id) => (
            <TextInput
              id={id}
              value={settings.preheader}
              onCommit={setting('preheader')}
              placeholder={text.preheaderPlaceholder}
            />
          )}
        </Field>
      </Section>
      <Section title={text.themeColors}>
        {(Object.keys(theme.colors) as Array<keyof typeof theme.colors>).map((key) => (
          <Field key={key} label={translate(messages, key[0]?.toUpperCase() + key.slice(1))}>
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
      <Section title={text.typography}>
        <Field label={text.bodyFont}>
          {(id) => (
            <SelectInput
              id={id}
              value={fontValue(theme.fonts.body)}
              options={fontOptions}
              placeholder={text.selectPlaceholder}
              onChange={themeFont('body')}
            />
          )}
        </Field>
        <Field label={text.headingFont}>
          {(id) => (
            <SelectInput
              id={id}
              value={fontValue(theme.fonts.heading)}
              options={fontOptions}
              placeholder={text.selectPlaceholder}
              onChange={themeFont('heading')}
            />
          )}
        </Field>
        <Field label={text.baseSize}>
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
        <Field label={text.lineHeight}>
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
      <Section title={text.layout}>
        <Field label={text.contentWidth}>
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
        <GroupField label={text.outerPadding}>
          {() => <PaddingInput value={settings.padding} onCommit={setting('padding')} />}
        </GroupField>
        <Field label={text.backdrop}>
          {(id) => (
            <ColorInput
              id={id}
              value={settings.backdropColor}
              theme={theme}
              onCommit={setting('backdropColor')}
            />
          )}
        </Field>
        <Field label={text.canvas}>
          {(id) => (
            <ColorInput
              id={id}
              value={settings.canvasColor}
              theme={theme}
              onCommit={setting('canvasColor')}
            />
          )}
        </Field>
        <Field label={text.text}>
          {(id) => (
            <ColorInput
              id={id}
              value={settings.textColor}
              theme={theme}
              onCommit={setting('textColor')}
            />
          )}
        </Field>
        <Field label={text.links}>
          {(id) => (
            <ColorInput
              id={id}
              value={settings.linkColor}
              theme={theme}
              onCommit={setting('linkColor')}
            />
          )}
        </Field>
        <Field label={text.canvasBorder}>
          {(id) => (
            <ColorInput
              id={id}
              value={settings.borderColor}
              theme={theme}
              allowClear
              placeholder={text.none}
              onCommit={setting('borderColor')}
            />
          )}
        </Field>
        <Field label={text.canvasRadius}>
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
  const slotClassName = useSlotClassName('inspector');
  const text = useMessages().inspector;
  const tab = selectedId && selectedId !== ROOT_ID ? 'block' : 'email';

  return (
    <aside
      data-slot="inspector"
      aria-label={text.label}
      className={cn(
        'flex min-h-0 flex-col overflow-y-auto border-l bg-card text-card-foreground',
        slotClassName,
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === 'email') store.select(null);
        }}
        className="gap-0"
      >
        <div className="shrink-0 border-b px-3 py-2">
          <TabsList className="w-full group-data-horizontal/tabs:h-8">
            <TabsTrigger value="block" disabled={!selectedId}>
              {text.blockTab}
            </TabsTrigger>
            <TabsTrigger value="email">{text.emailTab}</TabsTrigger>
          </TabsList>
        </div>
        {hasProposal ? (
          <p
            data-slot="inspector-notice"
            className="mx-4 mt-3 rounded-md border border-editor-ai/30 bg-editor-ai-soft px-2.5 py-2 text-xs text-editor-ai"
          >
            {text.proposalNotice}
          </p>
        ) : null}
        <fieldset
          data-slot="inspector-fieldset"
          className="m-0 min-w-0 border-0 p-0 disabled:[&_[data-slot=field-label]]:opacity-60"
          disabled={hasProposal || readOnly}
        >
          <TabsContent value="block">
            {selectedId ? <BlockInspector id={selectedId} /> : null}
          </TabsContent>
          <TabsContent value="email">
            <EmailInspector />
          </TabsContent>
        </fieldset>
      </Tabs>
    </aside>
  );
}
