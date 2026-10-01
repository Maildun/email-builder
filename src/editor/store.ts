import type { CustomBlocks } from '../core/custom';
import type { Issue } from '../core/issues';
import { applyOps, type Op } from '../core/ops';
import type { EmailDocument } from '../core/schema/document';
import { findParent } from '../core/tree';

export type Viewport = 'desktop' | 'mobile';
export type EditorView = 'design' | 'preview' | 'code';

export interface Proposal {
  /** The document as it would be after accepting. */
  document: EmailDocument;
  /** Blocks that changed or were added, for highlighting. */
  changed: string[];
  /** Blocks of the committed document that the proposal removes. */
  removed: string[];
  /** Whether the proposal changes the theme (colors, fonts). */
  themeChanged: boolean;
  /** Whether the proposal changes email settings (width, preheader, …). */
  settingsChanged: boolean;
  ops: Op[];
  /** What the agent was asked, or any label. */
  label?: string;
  /** Agent summary shown next to accept/reject. */
  summary?: string;
}

/** A short message shown over the canvas, optionally with one action (e.g. Undo). */
export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export interface EditorState {
  document: EmailDocument;
  selectedId: string | null;
  /** Block currently being edited inline (text/heading). */
  editingId: string | null;
  viewport: Viewport;
  view: EditorView;
  proposal: Proposal | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Issues from the last rejected change, for display. */
  lastIssues: Issue[];
  toast: Toast | null;
}

export interface ApplyOptions {
  /**
   * Coalesce with the previous change in history when the key matches and it
   * happened recently (e.g. typing in one field).
   */
  mergeKey?: string;
  /** Select this block after applying. */
  select?: string | null;
}

type Listener = () => void;

const MAX_HISTORY = 200;
const MERGE_WINDOW_MS = 1000;

/**
 * Framework-agnostic editor state with undo/redo and agent proposals. One
 * store per editor instance, so several editors can live on a page.
 */
export class EditorStore {
  private state: EditorState;
  private readonly listeners = new Set<Listener>();
  private past: EmailDocument[] = [];
  private future: EmailDocument[] = [];
  private lastMerge: { key: string; at: number } | null = null;
  /** Called with every committed document (not proposals). */
  onDocumentChange: ((document: EmailDocument) => void) | null = null;
  /** Custom block definitions; their data is validated on every change. */
  customBlocks: CustomBlocks = [];

  constructor(document: EmailDocument) {
    this.state = {
      document,
      selectedId: null,
      editingId: null,
      viewport: 'desktop',
      view: 'design',
      proposal: null,
      canUndo: false,
      canRedo: false,
      lastIssues: [],
      toast: null,
    };
  }

  getState = (): EditorState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(partial: Partial<EditorState>): void {
    const proposal = partial.proposal !== undefined ? partial.proposal : this.state.proposal;
    this.state = {
      ...this.state,
      ...partial,
      // While a proposal is pending, undo discards it and redo is unavailable.
      canUndo: this.past.length > 0 || proposal !== null,
      canRedo: this.future.length > 0 && proposal === null,
    };
    for (const listener of this.listeners) listener();
  }

  private commit(document: EmailDocument, options: ApplyOptions = {}): void {
    const now = Date.now();
    const merge =
      options.mergeKey !== undefined &&
      this.lastMerge?.key === options.mergeKey &&
      now - this.lastMerge.at < MERGE_WINDOW_MS;
    if (!merge) {
      this.past.push(this.state.document);
      if (this.past.length > MAX_HISTORY) this.past.shift();
    }
    this.lastMerge = options.mergeKey ? { key: options.mergeKey, at: now } : null;
    this.future = [];
    const selectedId =
      options.select !== undefined
        ? options.select
        : this.state.selectedId && document.blocks[this.state.selectedId]
          ? this.state.selectedId
          : null;
    this.set({
      document,
      selectedId,
      editingId:
        this.state.editingId && document.blocks[this.state.editingId] ? this.state.editingId : null,
      lastIssues: [],
      // A toast's action (e.g. Undo) refers to the change it announced; drop it once anything else happens.
      toast: null,
    });
    this.onDocumentChange?.(document);
  }

  /** Applies operations as one undoable step. Returns false (and records issues) on rejection. */
  apply(
    ops: Op | Op[],
    options: ApplyOptions = {},
  ): { ok: boolean; inserted: string[]; issues: Issue[] } {
    const result = applyOps(this.state.document, ops, { customBlocks: this.customBlocks });
    if (!result.ok) {
      this.set({ lastIssues: result.issues });
      return { ok: false, inserted: [], issues: result.issues };
    }
    this.commit(result.document, options);
    return { ok: true, inserted: result.inserted, issues: [] };
  }

  /** Replaces the document from outside (controlled `value`). Clears history when `resetHistory`. */
  setDocument(document: EmailDocument, resetHistory = false): void {
    if (document === this.state.document) return;
    if (resetHistory) {
      this.past = [];
      this.future = [];
    }
    this.set({
      document,
      selectedId:
        this.state.selectedId && document.blocks[this.state.selectedId]
          ? this.state.selectedId
          : null,
      editingId: null,
      proposal: null,
    });
  }

  /** Opens another document: clears history, selection and any pending proposal. */
  load(document: EmailDocument): void {
    this.past = [];
    this.future = [];
    this.lastMerge = null;
    this.set({
      document,
      selectedId: null,
      editingId: null,
      proposal: null,
      lastIssues: [],
      toast: null,
    });
  }

  /** Steps back in history. With a proposal pending, discards the proposal instead. */
  undo(): void {
    if (this.state.proposal) {
      this.reject();
      return;
    }
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.state.document);
    this.lastMerge = null;
    this.set({
      document: previous,
      editingId: null,
      selectedId: this.keepSelection(previous),
      toast: null,
    });
    this.onDocumentChange?.(previous);
  }

  redo(): void {
    if (this.state.proposal) return;
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state.document);
    this.lastMerge = null;
    this.set({
      document: next,
      editingId: null,
      selectedId: this.keepSelection(next),
      toast: null,
    });
    this.onDocumentChange?.(next);
  }

  private keepSelection(document: EmailDocument): string | null {
    const id = this.state.selectedId;
    return id && document.blocks[id] ? id : null;
  }

  select(id: string | null): void {
    if (id === this.state.selectedId && this.state.editingId === null) return;
    this.set({ selectedId: id, editingId: id === this.state.editingId ? id : null });
  }

  /** Selects the parent of the selected block. */
  selectParent(): void {
    const id = this.state.selectedId;
    if (!id) return;
    const parent = findParent(this.state.document, id);
    this.select(parent && parent.parentId !== 'root' ? parent.parentId : null);
  }

  startEditing(id: string): void {
    this.set({ selectedId: id, editingId: id });
  }

  stopEditing(): void {
    if (this.state.editingId !== null) this.set({ editingId: null });
  }

  setViewport(viewport: Viewport): void {
    this.set({ viewport });
  }

  setView(view: EditorView): void {
    this.set({ view, editingId: null });
  }

  /**
   * Stages changes for review without committing them. The canvas shows the
   * proposed document with changed blocks highlighted until accepted or rejected.
   */
  propose(
    ops: Op[],
    meta: { label?: string; summary?: string } = {},
  ): { ok: boolean; issues: Issue[] } {
    const base = this.state.proposal?.document ?? this.state.document;
    const result = applyOps(base, ops, { customBlocks: this.customBlocks });
    if (!result.ok) {
      this.set({ lastIssues: result.issues });
      return { ok: false, issues: result.issues };
    }
    const previous = this.state.proposal;
    const committed = this.state.document;
    const changed = new Set([...(previous?.changed ?? []), ...result.changed]);
    for (const id of result.removed) changed.delete(id);
    const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
    this.set({
      proposal: {
        document: result.document,
        changed: [...changed],
        removed: Object.keys(committed.blocks).filter((id) => !result.document.blocks[id]),
        themeChanged: !same(committed.theme, result.document.theme),
        settingsChanged: !same(committed.settings, result.document.settings),
        ops: [...(previous?.ops ?? []), ...ops],
        ...((meta.label ?? previous?.label) ? { label: meta.label ?? previous?.label } : {}),
        ...((meta.summary ?? previous?.summary)
          ? { summary: meta.summary ?? previous?.summary }
          : {}),
      },
      editingId: null,
      lastIssues: [],
    });
    return { ok: true, issues: [] };
  }

  /** Updates the summary text of the pending proposal. */
  setProposalSummary(summary: string): void {
    if (this.state.proposal) this.set({ proposal: { ...this.state.proposal, summary } });
  }

  accept(): void {
    const proposal = this.state.proposal;
    if (!proposal) return;
    this.lastMerge = null;
    this.state = { ...this.state, proposal: null };
    this.commit(proposal.document);
  }

  reject(): void {
    if (this.state.proposal) this.set({ proposal: null });
  }

  private toastId = 0;

  /** Shows a short message over the canvas, replacing the current one. */
  showToast(message: string, action?: Toast['action']): void {
    this.toastId += 1;
    this.set({ toast: { id: this.toastId, message, ...(action ? { action } : {}) } });
  }

  dismissToast(id?: number): void {
    if (this.state.toast && (id === undefined || this.state.toast.id === id)) {
      this.set({ toast: null });
    }
  }

  /** The document shown on screen: the proposal while one is pending. */
  visibleDocument(): EmailDocument {
    return this.state.proposal?.document ?? this.state.document;
  }
}
