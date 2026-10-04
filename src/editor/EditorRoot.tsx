import {
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type AgentTool, type AgentToolsOptions, createAgentTools } from '../agent/tools';
import type { CustomBlocks } from '../core/custom';
import { customBlockMap } from '../core/custom';
import { emptyDocument } from '../core/defaults';
import type { Issue } from '../core/issues';
import type { Op } from '../core/ops';
import type { Block, BlockType } from '../core/schema/blocks';
import type { EmailDocument } from '../core/schema/document';
import type { SectionName } from '../core/sections';
import { findParent, walk } from '../core/tree';
import { type RenderResult, renderEmail } from '../render/html';
import { duplicateBlock, removeBlock } from './actions';
import {
  DEFAULT_OPTIONS,
  type EditorClassNames,
  type EditorOptions,
  EditorProvider,
  type ImageResult,
  type MergeTag,
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useMessages,
} from './context';
import { EditorDnd } from './dnd';
import { type DeepPartial, type EditorMessages, resolveMessages } from './messages';
import { blockLabel } from './meta';
import { ProposalActionsContext } from './panels/ProposalBar';
import { ToolbarContext } from './panels/TopBar';
import { EditorStore, type EditorView, type Proposal } from './store';
import { cn, PortalContext, TooltipProvider } from './ui';

export interface EditorRootProps {
  /** Controlled document. Pair with `onChange`. */
  value?: EmailDocument;
  /** Initial document when uncontrolled. */
  defaultValue?: EmailDocument;
  /** Called with every committed change (not with pending proposals). */
  onChange?: (document: EmailDocument) => void;
  readOnly?: boolean;
  /** Merge tags offered in link fields and the text toolbar. */
  mergeTags?: MergeTag[];
  /** Upload a file and resolve with its public URL. Enables the Upload button. */
  onUploadImage?: (file: File) => Promise<ImageResult>;
  /** Open your media library and resolve with the chosen image. Enables the Choose button. */
  onPickImage?: () => Promise<ImageResult | null>;
  /** Block types defined by your app (see `defineBlock`). */
  customBlocks?: CustomBlocks;
  /**
   * Where the social icons are hosted: a copy of this package's `assets/`
   * folder. Defaults to jsDelivr.
   */
  assetsUrl?: string;
  /** Built-in block types offered in the palette, e.g. to leave out `html`. All by default. */
  blockTypes?: BlockType[];
  /** Sections offered in the palette; `[]` hides them. All by default. */
  sections?: SectionName[];
  /** Views offered in the top bar. All by default. */
  views?: EditorView[];
  /** Extra controls at the right of the top bar. */
  toolbar?: ReactNode;
  /**
   * Extra controls in the proposal bar, before Reject, e.g. "Always allow"
   * for a trusted AI. A function gets the pending proposal.
   */
  proposalActions?: ReactNode | ((proposal: Proposal) => ReactNode);
  /**
   * Color scheme. `inherit` (the default) follows a `.dark` class on an
   * ancestor, the shadcn/ui convention; `system` follows the OS setting.
   */
  appearance?: 'inherit' | 'light' | 'dark' | 'system';
  /** Extra class names for parts of the editor; each part also has a matching `data-slot`. */
  classNames?: EditorClassNames;
  /** Called when the selected block changes. */
  onSelectionChange?: (id: string | null, block: Block | null) => void;
  /** Called when a proposal appears, changes, or is accepted/rejected (null). */
  onProposalChange?: (proposal: Proposal | null) => void;
  /** Called on ⌘S / Ctrl+S inside the editor (the browser's save dialog is suppressed). */
  onSave?: (document: EmailDocument) => void;
  /**
   * UI text to translate or reword, merged over the English defaults
   * (`EN_MESSAGES`). Compared by content, so an inline object is fine.
   * Message functions are compared by their source code, so keep them pure:
   * a function whose output depends on a variable it closes over won't be
   * picked up when only that variable changes.
   */
  messages?: DeepPartial<EditorMessages>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface EmailEditorHandle {
  store: EditorStore;
  getDocument: () => EmailDocument;
  /** Applies operations as one undoable step. */
  apply: (ops: Op | Op[]) => { ok: boolean; issues: Issue[] };
  undo: () => void;
  redo: () => void;
  /**
   * Stages changes for review: the canvas highlights them and a bar offers
   * Accept / Reject. Calls add up into one proposal until it is resolved.
   */
  propose: (ops: Op[], summary?: string) => { ok: boolean; issues: Issue[] };
  /** Shows a message with the pending proposal, e.g. your agent's summary. */
  setProposalSummary: (summary: string) => void;
  accept: () => void;
  reject: () => void;
  /**
   * The agent tools (see `@maildun/email-builder/agent`) bound to this editor:
   * each successful call adds to the proposal, live on the canvas, for the
   * user to review. Pass them to your own LLM loop.
   */
  tools: (options?: Omit<AgentToolsOptions, 'customBlocks'>) => AgentTool[];
  /** Opens another document, clearing undo history, selection and any proposal. */
  load: (document: EmailDocument) => void;
  select: (id: string | null) => void;
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

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * The block to select for an arrow key: ↑/↓ step through blocks in reading
 * order, ← selects the parent and → the first child.
 */
function neighbour(document: EmailDocument, id: string | null, key: string): string | null {
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (!id) return null;
    if (key === 'ArrowLeft') {
      const parent = findParent(document, id);
      return parent && parent.parentId !== 'root' ? parent.parentId : null;
    }
    const block = document.blocks[id];
    return block && 'children' in block ? (block.children[0] ?? null) : null;
  }
  const order: string[] = [];
  walk(document, (blockId) => order.push(blockId));
  if (!id) return key === 'ArrowDown' ? (order[0] ?? null) : (order.at(-1) ?? null);
  const index = order.indexOf(id) + (key === 'ArrowDown' ? 1 : -1);
  return order[index] ?? null;
}

/** Moves keyboard focus to a block on the canvas once it has rendered as selected. */
function focusBlock(root: HTMLElement, id: string): void {
  requestAnimationFrame(() => {
    root
      .querySelector<HTMLElement>(`.meb-canvas-scroll [data-block-id="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
  });
}

function useShortcuts(root: React.RefObject<HTMLDivElement | null>) {
  const store = useEditorStore();
  const { readOnly } = useEditorOptions();
  // Read at key time so a change of language doesn't re-attach the listener.
  const latestMessages = useMessages();
  const messages = useRef(latestMessages);
  messages.current = latestMessages;
  useEffect(() => {
    const element = root.current;
    if (!element || readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const state = store.getState();
      if (mod && event.key === '\\') {
        event.preventDefault();
        store.togglePanels();
        return;
      }
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
      if (ARROWS.has(event.key) && !event.altKey && !event.shiftKey && !mod) {
        if (isControlTarget(event.target, true)) return;
        const next = neighbour(state.document, id, event.key);
        if (next) {
          event.preventDefault();
          store.select(next);
          focusBlock(element, next);
        }
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
        removeBlock(store, id, messages.current, element);
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

/** Announces selection changes to screen readers ("Heading selected"). */
function SelectionAnnouncer() {
  const { customBlockMap: custom, messages } = useEditorOptions();
  const message = useEditorState((state) => {
    const block = state.selectedId ? state.document.blocks[state.selectedId] : undefined;
    return block ? messages.canvas.selected(blockLabel(block, custom, messages)) : '';
  });
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
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
 * Keeps the previous value while the new one is structurally equal, so props
 * written inline by the host (`mergeTags={[…]}`) don't re-render the editor.
 */
function useStructural<T>(value: T): T {
  const ref = useRef(value);
  if (value !== ref.current && JSON.stringify(value) !== JSON.stringify(ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

/** A stable wrapper that always calls the latest `callback`; undefined when there is none. */
function useLatestCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
): ((...args: Args) => Result) | undefined {
  const ref = useRef(callback);
  ref.current = callback;
  const present = callback !== undefined;
  return useMemo(
    () =>
      present ? (...args: Args) => (ref.current as (...args: Args) => Result)(...args) : undefined,
    [present],
  );
}

/** JSON replacer that keeps message functions comparable by their source. */
function functionSource(_key: string, value: unknown): unknown {
  return typeof value === 'function' ? String(value) : value;
}

/**
 * Resolves the host's partial messages over the English defaults, keeping the
 * same object while the content is unchanged so inline objects don't
 * re-render the whole editor.
 */
function useResolvedMessages(partial: DeepPartial<EditorMessages> | undefined): EditorMessages {
  const key = partial ? JSON.stringify(partial, functionSource) : '';
  const cache = useRef<{ key: string; messages: EditorMessages } | null>(null);
  if (cache.current?.key !== key) {
    cache.current = { key, messages: resolveMessages(partial) };
  }
  return cache.current.messages;
}

const NO_MERGE_TAGS: MergeTag[] = [];

/** Keeps the previous array while it holds the same items in the same order. */
function useShallowStable<T>(value: readonly T[] | undefined): readonly T[] | undefined {
  const ref = useRef(value);
  const previous = ref.current;
  const same =
    value === previous ||
    (value !== undefined &&
      previous !== undefined &&
      value.length === previous.length &&
      value.every((item, index) => item === previous[index]));
  if (!same) ref.current = value;
  return ref.current;
}

const NO_CUSTOM_BLOCKS: CustomBlocks = [];

/** Runs `callback` with each new value of a store slice (not on mount). */
function useStoreEffect<T>(
  store: EditorStore,
  select: (state: ReturnType<EditorStore['getState']>) => T,
  callback: ((value: T) => void) | undefined,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    let previous = selectRef.current(store.getState());
    return store.subscribe(() => {
      const next = selectRef.current(store.getState());
      if (next === previous) return;
      previous = next;
      callbackRef.current?.(next);
    });
  }, [store]);
}

/**
 * Provides everything the editor's parts need: the document store, options,
 * theme, keyboard shortcuts, drag and drop and popups. Compose your own layout
 * inside it from `EditorTopBar`, `EditorSidebar`, `EditorStage`,
 * `EditorInspector` (or `EmailEditor.TopBar` and friends) and your own UI.
 */
export const EditorRoot = forwardRef<EmailEditorHandle, EditorRootProps>(function EditorRoot(
  {
    value,
    defaultValue,
    onChange,
    readOnly = false,
    mergeTags: mergeTagsProp = NO_MERGE_TAGS,
    onUploadImage,
    onPickImage,
    customBlocks: customBlocksProp = NO_CUSTOM_BLOCKS,
    assetsUrl = DEFAULT_OPTIONS.assetsUrl,
    blockTypes: blockTypesProp,
    sections: sectionsProp,
    views: viewsProp,
    toolbar,
    proposalActions,
    appearance = 'inherit',
    classNames,
    onSelectionChange,
    onProposalChange,
    onSave,
    messages: messagesProp,
    className,
    style,
    children,
  },
  ref,
) {
  const [store] = useState(() => {
    const created = new EditorStore(value ?? defaultValue ?? emptyDocument());
    created.customBlocks = customBlocksProp;
    return created;
  });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    store.onDocumentChange = (document) => onChangeRef.current?.(document);
    return () => {
      store.onDocumentChange = null;
    };
  }, [store]);

  // Follow a controlled value. Hosts that clone or round-trip the document
  // (e.g. through JSON) hand back equal copies; ignore those so history and
  // pending proposals survive.
  useEffect(() => {
    const current = store.getState().document;
    if (value && value !== current && JSON.stringify(value) !== JSON.stringify(current)) {
      store.setDocument(value);
    }
  }, [value, store]);

  useStoreEffect(
    store,
    (state) => state.selectedId,
    onSelectionChange &&
      ((id: string | null) =>
        onSelectionChange(id, id ? (store.getState().document.blocks[id] ?? null) : null)),
  );
  useStoreEffect(store, (state) => state.proposal, onProposalChange);

  const assetsRef = useRef(assetsUrl);
  assetsRef.current = assetsUrl;

  useImperativeHandle(
    ref,
    () => ({
      store,
      getDocument: () => store.getState().document,
      apply: (ops) => {
        const { ok, issues } = store.apply(ops);
        return { ok, issues };
      },
      undo: () => store.undo(),
      redo: () => store.redo(),
      propose: (ops, summary) => store.propose(ops, summary ? { summary } : {}),
      setProposalSummary: (summary) => store.setProposalSummary(summary),
      tools: (options = {}) =>
        createAgentTools(
          {
            getDocument: () => store.visibleDocument(),
            setDocument: (_document, change) => {
              store.propose(change.ops);
            },
          },
          { ...options, customBlocks: store.customBlocks },
        ),
      accept: () => store.accept(),
      reject: () => store.reject(),
      load: (document) => store.load(document),
      select: (id) => store.select(id),
      render: () =>
        renderEmail(store.getState().document, {
          customBlocks: store.customBlocks,
          assetsUrl: assetsRef.current,
        }),
    }),
    [store],
  );

  const mergeTags = useStructural(mergeTagsProp);
  const slotClassNames = useStructural(classNames);
  const customBlocks = useShallowStable(customBlocksProp) ?? NO_CUSTOM_BLOCKS;
  const blockTypes = useShallowStable(blockTypesProp);
  const sections = useShallowStable(sectionsProp);
  const views = useShallowStable(viewsProp) ?? DEFAULT_OPTIONS.views;
  const uploadImage = useLatestCallback(onUploadImage);
  const pickImage = useLatestCallback(onPickImage);
  const messages = useResolvedMessages(messagesProp);

  useLayoutEffect(() => {
    store.customBlocks = customBlocks;
  }, [store, customBlocks]);

  // Keep the active view one of the offered views.
  useEffect(() => {
    const first = views[0];
    if (first && !views.includes(store.getState().view)) store.setView(first);
  }, [store, views]);

  const options = useMemo<EditorOptions>(
    () => ({
      readOnly,
      mergeTags,
      customBlocks,
      customBlockMap: customBlockMap(customBlocks),
      views,
      messages,
      assetsUrl,
      ...(slotClassNames ? { classNames: slotClassNames } : {}),
      ...(uploadImage ? { onUploadImage: uploadImage } : {}),
      ...(pickImage ? { onPickImage: pickImage } : {}),
      ...(blockTypes ? { blockTypes } : {}),
      ...(sections ? { sections } : {}),
    }),
    [
      readOnly,
      mergeTags,
      customBlocks,
      views,
      messages,
      assetsUrl,
      slotClassNames,
      uploadImage,
      pickImage,
      blockTypes,
      sections,
    ],
  );

  const systemDark = useSystemDark(appearance === 'system');
  const dark = appearance === 'dark' || systemDark;
  const save = useLatestCallback(onSave);

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
        <ToolbarContext.Provider value={toolbar}>
          <ProposalActionsContext.Provider value={proposalActions}>
            <Shell onSave={save}>{children}</Shell>
          </ProposalActionsContext.Provider>
        </ToolbarContext.Provider>
      </EditorProvider>
    </div>
  );
});

/** Focus target for the shortcuts, plus the providers every part relies on. */
function Shell({
  children,
  onSave,
}: {
  children: ReactNode;
  onSave: ((document: EmailDocument) => void) | undefined;
}) {
  const store = useEditorStore();
  const root = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const editingId = useEditorState((state) => state.editingId);
  useShortcuts(root);

  useEffect(() => {
    const element = root.current;
    if (!element || !onSave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave(store.getState().document);
      }
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [store, onSave]);

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

  return (
    <PortalContext.Provider value={portal}>
      <TooltipProvider>
        <div
          ref={root}
          className="meb-shell @container/editor flex min-h-0 flex-1 flex-col outline-none"
          tabIndex={-1}
        >
          <EditorDnd>
            <SelectionAnnouncer />
            {children}
          </EditorDnd>
        </div>
        <div ref={setPortal} className="meb-portal" />
      </TooltipProvider>
    </PortalContext.Provider>
  );
}
