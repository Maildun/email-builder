import {
  ComputerIcon,
  PencilEdit02Icon,
  Redo02Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  Undo02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import {
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { emptyDocument } from '../core/defaults';
import type { Op } from '../core/ops';
import type { EmailDocument } from '../core/schema/document';
import { findParent } from '../core/tree';
import { type RenderResult, renderEmail } from '../render/html';
import { duplicateBlock, removeBlock } from './actions';
import { Canvas } from './canvas/Canvas';
import {
  type EditorClassNames,
  EditorProvider,
  type ImageResult,
  type MergeTag,
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useSlotClassName,
} from './context';
import { EditorDnd } from './dnd';
import { Inspector } from './inspector/Inspector';
import { AgentPanel, type EditorAgent } from './panels/AgentPanel';
import { CodeView, Preview } from './panels/Preview';
import { Sidebar } from './panels/Sidebar';
import { EditorStore, type EditorView } from './store';
import { Button, cn, Icon, PortalContext, Segmented, Separator, Tip, TooltipProvider } from './ui';

export interface EmailEditorProps {
  /** Controlled document. Pair with `onChange`. */
  value?: EmailDocument;
  /** Initial document when uncontrolled. */
  defaultValue?: EmailDocument;
  /** Called with every committed change (not with pending agent proposals). */
  onChange?: (document: EmailDocument) => void;
  readOnly?: boolean;
  /** Merge tags offered in link fields and the text toolbar. */
  mergeTags?: MergeTag[];
  /** Upload a file and resolve with its public URL. Enables the Upload button. */
  onUploadImage?: (file: File) => Promise<ImageResult>;
  /** Open your media library and resolve with the chosen image. Enables the Choose button. */
  onPickImage?: () => Promise<ImageResult | null>;
  /** Enables the assistant panel. */
  agent?: EditorAgent;
  /** Extra controls at the right of the top bar. */
  toolbar?: ReactNode;
  /**
   * Color scheme. `inherit` (the default) follows a `.dark` class on an
   * ancestor, the shadcn/ui convention; `system` follows the OS setting.
   */
  appearance?: 'inherit' | 'light' | 'dark' | 'system';
  /** Extra class names for parts of the editor; each part also has a matching `data-slot`. */
  classNames?: EditorClassNames;
  className?: string;
  style?: CSSProperties;
}

export interface EmailEditorHandle {
  store: EditorStore;
  getDocument: () => EmailDocument;
  apply: (ops: Op | Op[]) => boolean;
  undo: () => void;
  redo: () => void;
  propose: (ops: Op[], summary?: string) => boolean;
  accept: () => void;
  reject: () => void;
  /** Renders the committed document to HTML and plain text. Safe to call from event handlers. */
  render: () => RenderResult;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

const CONTROL_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [role="menuitem"]';

/**
 * A focused control that handles keys itself. `outsideToolbar` ignores the
 * block toolbar, whose buttons act on the selected block anyway.
 */
function isControlTarget(target: EventTarget | null, outsideToolbar = false): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const control = target.closest(CONTROL_SELECTOR);
  if (!control) return false;
  return !(outsideToolbar && control.closest('.meb-block-toolbar'));
}

function useShortcuts(root: React.RefObject<HTMLDivElement | null>) {
  const store = useEditorStore();
  const { readOnly } = useEditorOptions();
  useEffect(() => {
    const element = root.current;
    if (!element || readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const state = store.getState();
      if (mod && event.key.toLowerCase() === 'z' && !isTypingTarget(event.target)) {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y' && !isTypingTarget(event.target)) {
        event.preventDefault();
        store.redo();
        return;
      }
      if (isTypingTarget(event.target) || state.proposal) return;
      const id = state.selectedId;
      if (event.key === 'Escape') {
        if (state.editingId) store.stopEditing();
        else store.select(null);
        return;
      }
      if (!id) return;
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateBlock(store, id, element);
        return;
      }
      // Let focused buttons, tabs and switches handle their own keys. Enter
      // always activates them; the block toolbar still allows Delete and moves.
      if (isControlTarget(event.target, event.key !== 'Enter')) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeBlock(store, id, element);
      } else if (event.key === 'Enter') {
        const block = state.document.blocks[id];
        if (block?.type === 'text' || block?.type === 'heading') {
          event.preventDefault();
          store.startEditing(id);
        }
      } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const parent = findParent(state.document, id);
        if (parent) {
          store.apply({
            op: 'move',
            id,
            parentId: parent.parentId,
            index: Math.max(0, parent.index + (event.key === 'ArrowUp' ? -1 : 1)),
          });
        }
      }
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [root, store, readOnly]);
}

function TopBar({ toolbar }: { toolbar?: ReactNode }) {
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const viewport = useEditorState((state) => state.viewport);
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const { readOnly } = useEditorOptions();
  const className = useSlotClassName('topbar');

  return (
    <header
      data-slot="topbar"
      className={cn(
        'flex h-13 flex-none items-center justify-between gap-3 border-b bg-card px-3',
        className,
      )}
    >
      <Segmented<EditorView>
        ariaLabel="View"
        fill={false}
        value={view}
        onChange={(next) => store.setView(next)}
        options={[
          {
            value: 'design',
            label: (
              <>
                <Icon icon={PencilEdit02Icon} data-icon="inline-start" /> Design
              </>
            ),
          },
          {
            value: 'preview',
            label: (
              <>
                <Icon icon={ViewIcon} data-icon="inline-start" /> Preview
              </>
            ),
          },
          {
            value: 'code',
            label: (
              <>
                <Icon icon={SourceCodeIcon} data-icon="inline-start" /> Code
              </>
            ),
          },
        ]}
      />
      <div className="flex items-center gap-1">
        {readOnly ? null : (
          <>
            <Tip label="Undo (⌘Z)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => store.undo()}
              >
                <Icon icon={Undo02Icon} />
              </Button>
            </Tip>
            <Tip label="Redo (⇧⌘Z)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => store.redo()}
              >
                <Icon icon={Redo02Icon} />
              </Button>
            </Tip>
            <Separator
              orientation="vertical"
              className="mx-1 data-vertical:h-5 data-vertical:self-center"
            />
          </>
        )}
        <Segmented
          ariaLabel="Viewport"
          fill={false}
          value={viewport}
          onChange={(next) => store.setViewport(next)}
          options={[
            { value: 'desktop', label: <Icon icon={ComputerIcon} />, title: 'Desktop' },
            { value: 'mobile', label: <Icon icon={SmartPhone01Icon} />, title: 'Mobile' },
          ]}
        />
        {toolbar}
      </div>
    </header>
  );
}

function Layout({ agent, toolbar }: { agent?: EditorAgent | undefined; toolbar?: ReactNode }) {
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const { readOnly } = useEditorOptions();
  const stageClassName = useSlotClassName('stage');
  const root = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const editingId = useEditorState((state) => state.editingId);
  useShortcuts(root);

  // When inline editing ends its editor unmounts and focus would fall back to
  // <body>; keep it inside the editor so keyboard shortcuts keep working.
  const wasEditing = useRef(false);
  useEffect(() => {
    const ended = wasEditing.current && editingId === null;
    wasEditing.current = editingId !== null;
    if (ended && root.current && !root.current.contains(document.activeElement)) {
      root.current.focus({ preventScroll: true });
    }
  }, [editingId]);

  const panels = !readOnly && view === 'design';

  return (
    <PortalContext.Provider value={portal}>
      <TooltipProvider>
        <div
          ref={root}
          className="meb-shell @container/editor flex min-h-0 flex-1 flex-col outline-none"
          tabIndex={-1}
        >
          <TopBar toolbar={toolbar} />
          <EditorDnd>
            <div
              className={cn(
                'grid min-h-0 flex-1',
                panels
                  ? 'grid-cols-[minmax(0,1fr)_260px] @3xl/editor:grid-cols-[220px_minmax(0,1fr)_260px] @5xl/editor:grid-cols-[248px_minmax(0,1fr)_300px]'
                  : 'grid-cols-[minmax(0,1fr)]',
              )}
            >
              {panels ? <Sidebar /> : null}
              <main
                data-slot="stage"
                className={cn(
                  'relative flex min-h-0 min-w-0 flex-col bg-editor-stage',
                  stageClassName,
                )}
              >
                {view === 'design' ? (
                  <Canvas
                    onAddFirst={() => {
                      const result = store.apply({ op: 'insert', blocks: [{ type: 'text' }] });
                      if (result.inserted[0]) store.startEditing(result.inserted[0]);
                    }}
                  />
                ) : view === 'preview' ? (
                  <Preview />
                ) : (
                  <CodeView />
                )}
                {agent && !readOnly ? <AgentPanel agent={agent} /> : null}
              </main>
              {panels ? <Inspector /> : null}
            </div>
          </EditorDnd>
        </div>
        <div ref={setPortal} className="meb-portal" />
      </TooltipProvider>
    </PortalContext.Provider>
  );
}

const darkQuery = '(prefers-color-scheme: dark)';

function subscribeToColorScheme(onChange: () => void): () => void {
  const query = window.matchMedia(darkQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the OS prefers dark mode; false while rendering on the server. */
function useSystemDark(enabled: boolean): boolean {
  return useSyncExternalStore(
    enabled ? subscribeToColorScheme : () => () => {},
    () => enabled && window.matchMedia(darkQuery).matches,
    () => false,
  );
}

/**
 * The visual email editor. Works controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue`), and exposes an imperative handle via `ref`.
 */
export const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorProps>(function EmailEditor(
  {
    value,
    defaultValue,
    onChange,
    readOnly = false,
    mergeTags = [],
    onUploadImage,
    onPickImage,
    agent,
    toolbar,
    appearance = 'inherit',
    classNames,
    className,
    style,
  },
  ref,
) {
  const [store] = useState(() => new EditorStore(value ?? defaultValue ?? emptyDocument()));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    store.onDocumentChange = (document) => onChangeRef.current?.(document);
    return () => {
      store.onDocumentChange = null;
    };
  }, [store]);

  useEffect(() => {
    if (value && value !== store.getState().document) {
      store.setDocument(value);
    }
  }, [value, store]);

  useImperativeHandle(
    ref,
    () => ({
      store,
      getDocument: () => store.getState().document,
      apply: (ops) => store.apply(ops).ok,
      undo: () => store.undo(),
      redo: () => store.redo(),
      propose: (ops, summary) => store.propose(ops, summary ? { summary } : {}).ok,
      accept: () => store.accept(),
      reject: () => store.reject(),
      render: () => renderEmail(store.getState().document),
    }),
    [store],
  );

  const options = {
    readOnly,
    mergeTags,
    ...(classNames ? { classNames } : {}),
    ...(onUploadImage ? { onUploadImage } : {}),
    ...(onPickImage ? { onPickImage } : {}),
  };
  const systemDark = useSystemDark(appearance === 'system');
  const dark = appearance === 'dark' || systemDark;

  return (
    <div
      data-slot="editor"
      className={cn(
        'meb-root',
        dark && 'dark',
        appearance === 'light' && 'meb-light',
        classNames?.root,
        className,
      )}
      style={style}
    >
      <EditorProvider store={store} options={options}>
        <Layout agent={agent} toolbar={toolbar} />
      </EditorProvider>
    </div>
  );
});
