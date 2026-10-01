import { Code, Eye, Monitor, PenLine, Redo2, Smartphone, Undo2 } from 'lucide-react';
import {
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { emptyDocument } from '../core/defaults';
import type { Op } from '../core/ops';
import type { EmailDocument } from '../core/schema/document';
import { findParent } from '../core/tree';
import { type RenderResult, renderEmail } from '../render/html';
import { Canvas } from './canvas/Canvas';
import {
  EditorProvider,
  type ImageResult,
  type MergeTag,
  useEditorOptions,
  useEditorState,
  useEditorStore,
} from './context';
import { EditorDnd } from './dnd';
import { Inspector } from './inspector/Inspector';
import { AgentPanel, type EditorAgent } from './panels/AgentPanel';
import { CodeView, Preview } from './panels/Preview';
import { Sidebar } from './panels/Sidebar';
import { EditorStore, type EditorView } from './store';
import { Button, cx, PortalContext, Segmented, Tip, TooltipProvider } from './ui';

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
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.apply({ op: 'remove', id });
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        const result = store.apply({ op: 'duplicate', id });
        if (result.inserted[0]) store.select(result.inserted[0]);
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

  return (
    <header className="meb-topbar">
      <Segmented<EditorView>
        ariaLabel="View"
        value={view}
        onChange={(next) => store.setView(next)}
        options={[
          {
            value: 'design',
            label: (
              <>
                <PenLine size={14} /> Design
              </>
            ),
            title: 'Design',
          },
          {
            value: 'preview',
            label: (
              <>
                <Eye size={14} /> Preview
              </>
            ),
            title: 'Preview',
          },
          {
            value: 'code',
            label: (
              <>
                <Code size={14} /> Code
              </>
            ),
            title: 'Code',
          },
        ]}
      />
      <div className="meb-row meb-gap-sm">
        {readOnly ? null : (
          <>
            <Tip label="Undo (⌘Z)">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => store.undo()}
              >
                <Undo2 size={16} />
              </Button>
            </Tip>
            <Tip label="Redo (⇧⌘Z)">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => store.redo()}
              >
                <Redo2 size={16} />
              </Button>
            </Tip>
            <span className="meb-divider" />
          </>
        )}
        <Segmented
          ariaLabel="Viewport"
          value={viewport}
          onChange={(next) => store.setViewport(next)}
          options={[
            { value: 'desktop', label: <Monitor size={15} />, title: 'Desktop' },
            { value: 'mobile', label: <Smartphone size={15} />, title: 'Mobile' },
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
  const root = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  useShortcuts(root);

  return (
    <PortalContext.Provider value={portal}>
      <TooltipProvider>
        <div ref={root} className="meb-shell" tabIndex={-1}>
          <TopBar toolbar={toolbar} />
          <EditorDnd>
            <div className={cx('meb-main', readOnly && 'meb-main-readonly')}>
              {readOnly || view !== 'design' ? null : <Sidebar />}
              <main className="meb-stage">
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
              {readOnly || view !== 'design' ? null : <Inspector />}
            </div>
          </EditorDnd>
        </div>
        <div ref={setPortal} className="meb-portal" />
      </TooltipProvider>
    </PortalContext.Provider>
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
    ...(onUploadImage ? { onUploadImage } : {}),
    ...(onPickImage ? { onPickImage } : {}),
  };

  return (
    <div className={cx('meb-root', className)} style={style}>
      <EditorProvider store={store} options={options}>
        <Layout agent={agent} toolbar={toolbar} />
      </EditorProvider>
    </div>
  );
});
