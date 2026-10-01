import { Braces, Images, ImageUp, Link2, Square, SquareDashed, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { resolveColor } from '../../core/colors';
import type { Theme } from '../../core/schema/document';
import { type Padding, resolvePadding, THEME_COLOR_TOKENS } from '../../core/schema/primitives';
import { useEditorOptions } from '../context';
import { Button, cx, NumberInput, Popover, Tip } from '../ui';

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
  const className = cx('meb-input', mono && 'meb-mono', error && 'meb-invalid');
  return (
    <>
      {multiline ? (
        <textarea
          id={id}
          className={cx(className, 'meb-textarea')}
          rows={rows}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => change(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={className}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => change(event.target.value)}
        />
      )}
      {error ? <p className="meb-error">{error}</p> : null}
    </>
  );
}

/** Menu of merge tags that inserts `{{ key }}` via `onInsert`. */
export function MergeTagMenu({ onInsert }: { onInsert: (tag: string) => void }) {
  const { mergeTags } = useEditorOptions();
  const [open, setOpen] = useState(false);
  if (mergeTags.length === 0) return null;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <Button variant="ghost" size="icon" aria-label="Insert merge tag">
          <Braces size={14} />
        </Button>
      }
    >
      <div className="meb-menu">
        <p className="meb-menu-title">Insert merge tag</p>
        {mergeTags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className="meb-menu-item"
            onClick={() => {
              onInsert(`{{ ${tag.key} }}`);
              setOpen(false);
            }}
          >
            <span>{tag.label ?? tag.key}</span>
            <code>{`{{ ${tag.key} }}`}</code>
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
  placeholder = 'https://',
}: {
  id: string;
  value: string | undefined;
  onCommit: Commit<string | undefined>;
  placeholder?: string;
}) {
  const { draft, error, change } = useDraft(value ?? '', (next) =>
    onCommit(next.trim() === '' ? undefined : next.trim()),
  );
  return (
    <>
      <div className="meb-input-group">
        <Link2 size={14} className="meb-input-icon" />
        <input
          id={id}
          className={cx('meb-input', error && 'meb-invalid')}
          value={draft}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => change(event.target.value)}
        />
        <MergeTagMenu onInsert={(tag) => change(tag)} />
      </div>
      {error ? <p className="meb-error">{error}</p> : null}
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
  const { onUploadImage, onPickImage } = useEditorOptions();
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
      setFailure((error as Error).message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <UrlInput id={id} value={value} onCommit={onCommit} placeholder="https://…/image.png" />
      {onUploadImage || onPickImage ? (
        <div className="meb-row meb-gap-sm">
          {onPickImage ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(onPickImage)}>
              <Images size={14} /> Choose
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
                <ImageUp size={14} /> {busy ? 'Uploading…' : 'Upload'}
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
      {failure ? <p className="meb-error">{failure}</p> : null}
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

export function ColorInput({
  id,
  value,
  theme,
  onCommit,
  allowClear,
  placeholder = 'Default',
}: {
  id: string;
  value: string | undefined;
  theme: Theme;
  onCommit: Commit<string | undefined>;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const resolved = resolveColor(value, theme);
  const { draft, error, change } = useDraft(value ?? '', (next) =>
    onCommit(next === '' ? undefined : next),
  );
  const label = value?.startsWith('$') ? value.slice(1) : value;

  return (
    <>
      <Popover
        className="meb-color-popover"
        trigger={
          <button
            id={id}
            type="button"
            className={cx('meb-input', 'meb-color-trigger', error && 'meb-invalid')}
          >
            <span
              className={cx('meb-swatch', !resolved && 'meb-swatch-empty')}
              style={resolved && resolved !== 'transparent' ? { background: resolved } : undefined}
            />
            <span className={cx('meb-color-label', !value && 'meb-muted')}>
              {label ?? placeholder}
            </span>
          </button>
        }
      >
        <p className="meb-menu-title">Theme</p>
        <div className="meb-swatches">
          {THEME_COLOR_TOKENS.map((token) => (
            <Tip key={token} label={`$${token}`}>
              <button
                type="button"
                aria-label={`Theme ${token}`}
                className={cx(
                  'meb-swatch',
                  'meb-swatch-button',
                  value === `$${token}` && 'meb-swatch-active',
                )}
                style={{ background: theme.colors[token] }}
                onClick={() => change(`$${token}`)}
              />
            </Tip>
          ))}
        </div>
        <p className="meb-menu-title">Colors</p>
        <div className="meb-swatches">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              className={cx(
                'meb-swatch',
                'meb-swatch-button',
                value?.toLowerCase() === swatch && 'meb-swatch-active',
              )}
              style={{ background: swatch }}
              onClick={() => change(swatch)}
            />
          ))}
        </div>
        <div className="meb-row meb-gap-sm meb-mt">
          <input
            type="color"
            className="meb-native-color"
            aria-label="Pick a color"
            value={resolved && /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : '#000000'}
            onChange={(event) => change(event.target.value)}
          />
          <input
            className={cx('meb-input', 'meb-mono', error && 'meb-invalid')}
            value={draft}
            placeholder="#1f6feb or $primary"
            spellCheck={false}
            onChange={(event) => change(event.target.value)}
          />
          {allowClear ? (
            <Tip label="Use default">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Use default color"
                onClick={() => change('')}
              >
                <X size={14} />
              </Button>
            </Tip>
          ) : null}
        </div>
      </Popover>
      {error ? <p className="meb-error">{error}</p> : null}
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
  const padding = resolvePadding(value);
  const uniform =
    typeof value === 'number' ||
    (padding.top === padding.right &&
      padding.right === padding.bottom &&
      padding.bottom === padding.left);
  const [linked, setLinked] = useState(uniform);

  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return (
    <div className="meb-padding">
      {linked ? (
        <NumberInput
          value={padding.top}
          min={0}
          max={200}
          unit="px"
          onChange={(next) => onCommit(next ?? 0)}
        />
      ) : (
        <div className="meb-padding-grid">
          {sides.map((side) => (
            <div key={side} className="meb-padding-side">
              <span aria-hidden>{side[0]?.toUpperCase()}</span>
              <NumberInput
                ariaLabel={`Padding ${side}`}
                value={padding[side]}
                min={0}
                max={200}
                onChange={(next) => onCommit({ ...padding, [side]: next ?? 0 })}
              />
            </div>
          ))}
        </div>
      )}
      <Tip label={linked ? 'Set sides separately' : 'Same on all sides'}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={linked ? 'Set sides separately' : 'Same on all sides'}
          onClick={() => setLinked(!linked)}
        >
          {linked ? <SquareDashed size={14} /> : <Square size={14} />}
        </Button>
      </Tip>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="meb-section">
      <h3 className="meb-section-title">{title}</h3>
      <div className="meb-section-body">{children}</div>
    </section>
  );
}
