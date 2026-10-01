import {
  BracesIcon,
  Cancel01Icon,
  Image02Icon,
  ImageUploadIcon,
  Link01Icon,
  SquareDashedIcon,
  SquareIcon,
} from '@hugeicons/core-free-icons';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { resolveColor } from '../../core/colors';
import type { Theme } from '../../core/schema/document';
import { type Padding, resolvePadding, THEME_COLOR_TOKENS } from '../../core/schema/primitives';
import { useEditorOptions, useMessages } from '../context';
import { Button, cn, Icon, Input, NumberInput, Popover, Spinner, Textarea, Tip } from '../ui';
import { FieldDescription, Field as FieldRoot, FieldTitle } from '../ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group';

/**
 * Keeps a local draft so in-progress values that do not validate yet
 * (a half-typed URL) stay editable. `commit` returns an error message or null.
 */
export function useDraft<T>(value: T, commit: (next: T) => string | null) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setDraft(value);
      setError(null);
    }
  }, [value]);

  const change = (next: T) => {
    setDraft(next);
    const message = commit(next);
    setError(message);
    if (message === null) lastCommitted.current = next;
  };

  return { draft, error, change };
}

export type Commit<T> = (value: T) => string | null;

/** Inline validation message under a control. */
function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p data-slot="field-error" id={id} className="text-xs whitespace-pre-wrap text-destructive">
      {children}
    </p>
  );
}

const MENU_TITLE = 'text-xs font-medium tracking-wide text-muted-foreground uppercase';

/**
 * A labelled form row for composite controls (option rows, padding) that have
 * no single labelable element: the title labels the whole group instead of
 * pointing a `<label for>` at a non-input.
 */
export function GroupField({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  return (
    <FieldRoot aria-labelledby={labelId} className="gap-1.5">
      <FieldTitle id={labelId} className="text-xs leading-snug font-medium text-muted-foreground">
        {label}
      </FieldTitle>
      {children(labelId)}
      {hint ? <FieldDescription className="text-xs">{hint}</FieldDescription> : null}
    </FieldRoot>
  );
}

export function TextInput({
  id,
  value,
  onCommit,
  placeholder,
  multiline,
  rows = 4,
  mono,
}: {
  id: string;
  value: string | undefined;
  onCommit: Commit<string | undefined>;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}) {
  const { draft, error, change } = useDraft(value ?? '', (next) =>
    onCommit(next === '' ? undefined : next),
  );
  const errorId = `${id}-error`;
  const shared = {
    id,
    value: draft,
    placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  } as const;
  return (
    <>
      {multiline ? (
        <Textarea
          {...shared}
          rows={rows}
          className={cn(
            'field-sizing-fixed min-h-0 resize-y text-sm leading-normal',
            mono && 'font-mono text-xs',
          )}
          onChange={(event) => change(event.target.value)}
        />
      ) : (
        <Input
          {...shared}
          className={cn('h-8 text-sm', mono && 'font-mono text-xs')}
          onChange={(event) => change(event.target.value)}
        />
      )}
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </>
  );
}

/** Menu of merge tags that inserts `{{ key }}` via `onInsert`. */
export function MergeTagMenu({ onInsert }: { onInsert: (tag: string) => void }) {
  const { mergeTags, messages } = useEditorOptions();
  const text = messages.inspector;
  const [open, setOpen] = useState(false);
  if (mergeTags.length === 0) return null;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-auto min-w-56 p-2"
      trigger={
        <InputGroupButton size="icon-xs" aria-label={text.insertMergeTag}>
          <Icon icon={BracesIcon} />
        </InputGroupButton>
      }
    >
      <div data-slot="merge-tag-menu" className="flex max-h-75 flex-col overflow-y-auto">
        <p className={cn(MENU_TITLE, 'px-2 pt-1 pb-1.5')}>{text.insertMergeTag}</p>
        {mergeTags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
            onClick={() => {
              onInsert(`{{ ${tag.key} }}`);
              setOpen(false);
            }}
          >
            <span className="truncate">{tag.label ?? tag.key}</span>
            <code className="font-mono text-xs text-muted-foreground">{`{{ ${tag.key} }}`}</code>
          </button>
        ))}
      </div>
    </Popover>
  );
}

export function UrlInput({
  id,
  value,
  onCommit,
  placeholder,
}: {
  id: string;
  value: string | undefined;
  onCommit: Commit<string | undefined>;
  placeholder?: string;
}) {
  const text = useMessages().inspector;
  const { draft, error, change } = useDraft(value ?? '', (next) =>
    onCommit(next.trim() === '' ? undefined : next.trim()),
  );
  const errorId = `${id}-error`;
  return (
    <>
      <InputGroup className="h-8">
        <InputGroupAddon align="inline-start">
          <Icon icon={Link01Icon} className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          className="h-8 text-sm"
          value={draft}
          placeholder={placeholder ?? text.urlPlaceholder}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => change(event.target.value)}
        />
        <InputGroupAddon align="inline-end" className="empty:hidden">
          <MergeTagMenu onInsert={(tag) => change(tag)} />
        </InputGroupAddon>
      </InputGroup>
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </>
  );
}

export function ImageInput({
  id,
  value,
  onCommit,
  onAlt,
}: {
  id: string;
  value: string | undefined;
  onCommit: Commit<string | undefined>;
  onAlt?: (alt: string) => void;
}) {
  const { onUploadImage, onPickImage, messages } = useEditorOptions();
  const text = messages.inspector;
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (task: () => Promise<{ url: string; alt?: string } | null>) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await task();
      if (result) {
        onCommit(result.url);
        if (result.alt && onAlt) onAlt(result.alt);
      }
    } catch (error) {
      setFailure((error as Error).message || text.uploadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <UrlInput id={id} value={value} onCommit={onCommit} placeholder={text.imagePlaceholder} />
      {onUploadImage || onPickImage ? (
        <div data-slot="image-input-actions" className="flex items-center gap-1.5">
          {onPickImage ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(onPickImage)}>
              <Icon icon={Image02Icon} data-icon="inline-start" /> {text.choose}
            </Button>
          ) : null}
          {onUploadImage ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {busy ? (
                  <Spinner
                    data-icon="inline-start"
                    aria-hidden
                    aria-label={messages.common.loading}
                  />
                ) : (
                  <Icon icon={ImageUploadIcon} data-icon="inline-start" />
                )}{' '}
                {busy ? text.uploading : text.upload}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) run(() => onUploadImage(file));
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {failure ? <ErrorText>{failure}</ErrorText> : null}
    </>
  );
}

const SWATCHES = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

/** A color chip. The fill comes from an inline style (it is user data). */
const SWATCH = 'inline-block shrink-0 rounded-[5px] inset-ring inset-ring-foreground/15';
const SWATCH_BUTTON = cn(
  SWATCH,
  'size-5.5 cursor-pointer p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
  'data-active:outline-2 data-active:outline-offset-2 data-active:outline-solid data-active:outline-editor-selection',
);

export function ColorInput({
  id,
  value,
  theme,
  onCommit,
  allowClear,
  placeholder,
}: {
  id: string;
  value: string | undefined;
  theme: Theme;
  onCommit: Commit<string | undefined>;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const text = useMessages().inspector;
  const resolved = resolveColor(value, theme);
  const { draft, error, change } = useDraft(value ?? '', (next) =>
    onCommit(next === '' ? undefined : next),
  );
  const label = value?.startsWith('$') ? value.slice(1) : value;
  const errorId = `${id}-error`;

  return (
    <>
      <Popover
        className="w-60.5 gap-2.5"
        trigger={
          <Button
            id={id}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 px-2.5 font-normal"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          >
            <span
              data-slot="color-swatch"
              className={cn(
                SWATCH,
                'size-4.5',
                !resolved &&
                  'bg-background bg-[linear-gradient(135deg,transparent_45%,var(--destructive)_45%,var(--destructive)_55%,transparent_55%)]',
              )}
              style={resolved && resolved !== 'transparent' ? { background: resolved } : undefined}
            />
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {label ?? placeholder ?? text.colorDefault}
            </span>
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <p className={MENU_TITLE}>{text.themeSwatches}</p>
          <div className="grid grid-cols-[repeat(8,22px)] gap-1.5">
            {THEME_COLOR_TOKENS.map((token) => {
              const active = value === `$${token}`;
              return (
                <Tip key={token} label={`$${token}`}>
                  <button
                    type="button"
                    aria-label={text.themeSwatch(token)}
                    aria-pressed={active}
                    data-active={active || undefined}
                    className={SWATCH_BUTTON}
                    style={{ background: theme.colors[token] }}
                    onClick={() => change(`$${token}`)}
                  />
                </Tip>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className={MENU_TITLE}>{text.colorSwatches}</p>
          <div className="grid grid-cols-[repeat(8,22px)] gap-1.5">
            {SWATCHES.map((swatch) => {
              const active = value?.toLowerCase() === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={active}
                  data-active={active || undefined}
                  className={SWATCH_BUTTON}
                  style={{ background: swatch }}
                  onClick={() => change(swatch)}
                />
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
            aria-label={text.pickColor}
            value={resolved && /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : '#000000'}
            onChange={(event) => change(event.target.value)}
          />
          <Input
            className="h-8 font-mono text-xs"
            aria-label={text.colorValue}
            value={draft}
            placeholder={text.colorPlaceholder}
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            onChange={(event) => change(event.target.value)}
          />
          {allowClear ? (
            <Tip label={text.useDefault}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={text.useDefaultColor}
                onClick={() => change('')}
              >
                <Icon icon={Cancel01Icon} />
              </Button>
            </Tip>
          ) : null}
        </div>
      </Popover>
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </>
  );
}

export function PaddingInput({
  value,
  onCommit,
}: {
  value: Padding | undefined;
  onCommit: Commit<Padding | undefined>;
}) {
  const text = useMessages().inspector;
  const padding = resolvePadding(value);
  const uniform =
    typeof value === 'number' ||
    (padding.top === padding.right &&
      padding.right === padding.bottom &&
      padding.bottom === padding.left);
  const [linked, setLinked] = useState(uniform);

  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return (
    <div data-slot="padding-input" className="flex items-start gap-1">
      {linked ? (
        <div className="min-w-0 flex-1">
          <NumberInput
            ariaLabel={text.paddingAll}
            value={padding.top}
            min={0}
            max={200}
            unit="px"
            onChange={(next) => onCommit(next ?? 0)}
          />
        </div>
      ) : (
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          {sides.map((side) => (
            <div
              key={side}
              className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground"
            >
              <span aria-hidden>{text.paddingSideShort(side)}</span>
              <div className="min-w-0 flex-1">
                <NumberInput
                  ariaLabel={text.paddingSide(side)}
                  value={padding[side]}
                  min={0}
                  max={200}
                  onChange={(next) => onCommit({ ...padding, [side]: next ?? 0 })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Tip label={linked ? text.separateSides : text.sameSides}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={linked ? text.separateSides : text.sameSides}
          onClick={() => setLinked(!linked)}
        >
          <Icon icon={linked ? SquareDashedIcon : SquareIcon} />
        </Button>
      </Tip>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-slot="inspector-section" className="flex flex-col gap-2.5 border-b p-4">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div data-slot="inspector-section-body" className="flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}
