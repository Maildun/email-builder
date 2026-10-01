import {
  ArrowDown01Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  SparklesIcon,
  StopIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { type AgentTool, createAgentTools } from '../../agent/tools';
import type { Op } from '../../core/ops';
import { BLOCK_DEFINITIONS } from '../../core/schema/blocks';
import type { EmailDocument } from '../../core/schema/document';
import { useEditorState, useEditorStore, useSlotClassName } from '../context';
import type { EditorStore, Proposal } from '../store';
import { Badge, Button, cn, Icon, Kbd, Spinner } from '../ui';

/** One earlier request in this editor session, oldest first in `AgentRequest.history`. */
export interface AgentTurn {
  prompt: string;
  /** The agent's summary, if it gave one. */
  summary?: string;
  /** What happened to the turn's proposal. */
  outcome: 'accepted' | 'rejected' | 'no-changes' | 'failed' | 'stopped';
}

export interface AgentRequest {
  prompt: string;
  /** The committed document when the request started. */
  document: EmailDocument;
  /** Block the user had selected, if any. */
  selectedId: string | null;
  /**
   * Earlier requests in this session (up to 10), so follow-ups like "make it
   * shorter" have context. Each turn says whether its proposal was accepted.
   */
  history: AgentTurn[];
  /**
   * Tools bound to a reviewable proposal: every successful call updates the
   * proposal live in the canvas. Pass them to a browser-side LLM loop.
   */
  tools: AgentTool[];
  /** Adds operations to the proposal (for agents that run elsewhere and stream ops). */
  propose: (ops: Op[]) => { ok: boolean; issues: Array<{ path: string; message: string }> };
  /** Shows progress or the agent's final message. */
  setStatus: (message: string) => void;
  /** Aborted when the user stops the request or the editor unmounts. */
  signal: AbortSignal;
}

export interface AgentResponse {
  /** Operations to propose (in addition to any made through `tools` / `propose`). */
  ops?: Op[];
  /** Message shown with the proposal. */
  summary?: string;
}

export interface EditorAgent {
  onRequest: (request: AgentRequest) => Promise<AgentResponse | undefined>;
  /** Placeholder for the prompt box. */
  placeholder?: string;
  /** Prompt ideas shown when the box is empty. */
  suggestions?: string[];
}

/** Space kept between the end of the content and the floating panel. */
const OVERLAY_GAP = 16;
const MAX_HISTORY = 10;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "2 blocks changed · 1 removed · Theme updated". */
export function describeProposal(proposal: Proposal): string {
  const parts: string[] = [];
  if (proposal.changed.length) parts.push(`${plural(proposal.changed.length, 'block')} changed`);
  if (proposal.removed.length) parts.push(`${proposal.removed.length} removed`);
  if (proposal.themeChanged) parts.push('Theme updated');
  if (proposal.settingsChanged) parts.push('Settings updated');
  return parts.length ? parts.join(' · ') : 'No visible changes';
}

/**
 * The panel floats over the stage; publish its height on the stage so the
 * canvas, preview and code views keep their last content scrollable above it.
 */
function reserveOverlaySpace(panel: HTMLElement | null): void {
  const stage = panel?.parentElement;
  if (!panel || !stage) return;
  const offset = stage.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
  stage.style.setProperty('--meb-overlay-space', `${Math.ceil(offset + OVERLAY_GAP)}px`);
}

/** Scrolls a canvas block into view and returns whether it exists. */
function revealBlock(from: Element | null, id: string): boolean {
  const element = from
    ?.closest('.meb-root')
    ?.querySelector<HTMLElement>(`.meb-canvas-scroll [data-block-id="${CSS.escape(id)}"]`);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  return Boolean(element);
}

/** Short, readable error text for the user (details go to the console). */
function errorText(issues: Array<{ path: string; message: string }>): string {
  const [first] = issues;
  if (!first) return 'The assistant made a change that could not be applied.';
  const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : '';
  return `The assistant made a change that could not be applied: ${first.message}${more}`;
}

function recordTurn(history: { current: AgentTurn[] }, turn: AgentTurn): void {
  history.current = [...history.current, turn].slice(-MAX_HISTORY);
}

function bindTools(store: EditorStore, label: string, signal: AbortSignal): AgentTool[] {
  return createAgentTools({
    getDocument: () => store.visibleDocument(),
    setDocument: (_document, change) => {
      // After Stop, late tool calls from the agent are ignored.
      if (!signal.aborted) store.propose(change.ops, { label });
    },
  });
}

export function AgentPanel({ agent }: { agent: EditorAgent }) {
  const store = useEditorStore();
  const proposal = useEditorState((state) => state.proposal);
  const view = useEditorState((state) => state.view);
  const selectedId = useEditorState((state) => state.selectedId);
  const selectedType = useEditorState((state) =>
    state.selectedId ? state.document.blocks[state.selectedId]?.type : undefined,
  );
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; prompt: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  /** A changed block to scroll to once the proposal card is on screen. */
  const [reveal, setReveal] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const history = useRef<AgentTurn[]>([]);
  const pendingTurn = useRef<AgentTurn | null>(null);
  const shown = useRef(0);
  const className = useSlotClassName('assistant');

  // A proposal can end here or elsewhere (⌘Z, the host calling accept/reject).
  // Record its outcome for the conversation and drop its summary from view.
  const lastProposal = useRef<Proposal | null>(null);
  useEffect(() => {
    const ended = lastProposal.current;
    lastProposal.current = proposal;
    if (!ended || proposal) return;
    setStatus(null);
    const turn = pendingTurn.current;
    pendingTurn.current = null;
    if (turn) {
      const accepted = store.getState().document === ended.document;
      recordTurn(history, { ...turn, outcome: accepted ? 'accepted' : 'rejected' });
    }
  }, [proposal, store]);

  // Scroll to the first change once the proposal card has rendered, after
  // reserving the space it needs so the change doesn't land behind it.
  useEffect(() => {
    if (!reveal || running) return;
    reserveOverlaySpace(panel.current);
    revealBlock(panel.current, reveal);
    setReveal(null);
  }, [reveal, running]);

  // Collapse outside the design view; expand again when returning to it.
  useEffect(() => {
    setCollapsed(view !== 'design');
  }, [view]);

  // Stop the request if the editor goes away.
  useEffect(() => () => abort.current?.abort(), []);

  // ⌘K / Ctrl+K anywhere in the editor opens the assistant.
  useEffect(() => {
    const root = panel.current?.closest<HTMLElement>('.meb-root');
    if (!root) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCollapsed(false);
        requestAnimationFrame(() => input.current?.focus());
      }
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep the reserved space in sync with the panel's height.
  useEffect(() => {
    const element = panel.current;
    const stage = element?.parentElement;
    if (!element || !stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => reserveOverlaySpace(element));
    observer.observe(element);
    reserveOverlaySpace(element);
    return () => {
      observer.disconnect();
      stage.style.removeProperty('--meb-overlay-space');
    };
  }, []);

  const submit = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    const controller = new AbortController();
    const { signal } = controller;
    abort.current = controller;
    setRunning(true);
    setError(null);
    setStatus('Thinking…');

    try {
      const response = await agent.onRequest({
        prompt: trimmed,
        document: store.getState().document,
        selectedId: store.getState().selectedId,
        history: history.current,
        tools: bindTools(store, trimmed, signal),
        propose: (ops) =>
          signal.aborted ? { ok: false, issues: [] } : store.propose(ops, { label: trimmed }),
        setStatus: (message) => {
          if (!signal.aborted) setStatus(message);
        },
        signal,
      });
      if (signal.aborted) throw new DOMException('Stopped.', 'AbortError');
      if (response?.ops?.length) {
        const result = store.propose(response.ops, { label: trimmed });
        if (!result.ok) {
          console.warn('[email-builder] Rejected agent ops:', result.issues);
          setError({ message: errorText(result.issues), prompt: trimmed });
        }
      }
      const pending = store.getState().proposal;
      if (response?.summary && pending) store.setProposalSummary(response.summary);
      if (pending) {
        pendingTurn.current = {
          prompt: trimmed,
          ...(response?.summary ? { summary: response.summary } : {}),
          outcome: 'rejected',
        };
        shown.current = 0;
        setReveal(pending.changed[0] ?? null);
        setStatus(null);
      } else {
        recordTurn(history, {
          prompt: trimmed,
          ...(response?.summary ? { summary: response.summary } : {}),
          outcome: 'no-changes',
        });
        setStatus(response?.summary ?? 'No changes proposed.');
      }
      setPrompt('');
    } catch (caught) {
      if (signal.aborted) {
        const pending = store.getState().proposal;
        if (pending) {
          pendingTurn.current = { prompt: trimmed, outcome: 'stopped' };
          if (!pending.summary) {
            store.setProposalSummary('Stopped early. Review what was done so far.');
          }
        } else {
          recordTurn(history, { prompt: trimmed, outcome: 'stopped' });
        }
        setStatus(pending ? null : 'Stopped.');
      } else {
        console.error('[email-builder] Agent request failed:', caught);
        recordTurn(history, { prompt: trimmed, outcome: 'failed' });
        setError({
          message: (caught as Error).message || 'The assistant failed.',
          prompt: trimmed,
        });
        setStatus(null);
      }
    } finally {
      setRunning(false);
      abort.current = null;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const showNextChange = () => {
    const ids = proposal?.changed ?? [];
    if (!ids.length) return;
    const id = ids[shown.current % ids.length];
    shown.current += 1;
    if (id) revealBlock(panel.current, id);
  };

  const changes = proposal?.changed.length ?? 0;

  return (
    <div
      ref={panel}
      data-slot="assistant"
      data-collapsed={collapsed || undefined}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto flex w-[min(640px,calc(100%-32px))] flex-col gap-2 *:pointer-events-auto',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && running) {
          event.stopPropagation();
          abort.current?.abort();
        }
      }}
    >
      {proposal && !running ? (
        <div
          data-slot="assistant-proposal"
          className="flex items-center gap-2.5 rounded-xl border border-editor-ai/30 bg-popover py-2.5 pr-2.5 pl-3.5 text-popover-foreground shadow-lg"
          role="status"
        >
          <Icon icon={SparklesIcon} className="size-4 shrink-0 text-editor-ai" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="text-sm font-semibold">{describeProposal(proposal)}</strong>
            {proposal.summary ? (
              <span className="text-xs text-muted-foreground">{proposal.summary}</span>
            ) : null}
          </div>
          {changes ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={showNextChange}
              aria-label={changes > 1 ? 'Show the next change' : 'Show the change'}
            >
              Show
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              store.reject();
              setStatus(null);
            }}
          >
            <Icon icon={Cancel01Icon} data-icon="inline-start" /> Reject
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              store.accept();
              setStatus(null);
              store.showToast('Changes applied', { label: 'Undo', run: () => store.undo() });
            }}
          >
            <Icon icon={Tick02Icon} data-icon="inline-start" /> Accept
          </Button>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-popover py-1.5 pr-1.5 pl-3 text-destructive text-xs shadow-md"
        >
          <span className="flex-1">{error.message}</span>
          <Button size="xs" variant="outline" onClick={() => submit(error.prompt)}>
            Try again
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Dismiss"
            onClick={() => setError(null)}
          >
            <Icon icon={Cancel01Icon} />
          </Button>
        </div>
      ) : null}
      {collapsed && !running ? (
        <Button
          variant="outline"
          className="self-center rounded-full bg-popover shadow-lg"
          onClick={() => {
            setCollapsed(false);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Icon icon={SparklesIcon} data-icon="inline-start" className="text-editor-ai" />
          Ask AI
          <Kbd>⌘K</Kbd>
        </Button>
      ) : (
        <>
          {!proposal && status && !running ? (
            <p className="self-center rounded-full bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md">
              {status}
            </p>
          ) : null}
          <div
            data-slot="assistant-composer"
            data-running={running || undefined}
            className="flex flex-wrap items-end gap-2 rounded-xl border bg-popover py-2 pr-2 pl-3.5 text-popover-foreground shadow-lg transition-colors focus-within:border-editor-ai/50 data-running:border-editor-ai/40"
          >
            {selectedId && selectedType ? (
              <div className="basis-full">
                <Badge variant="secondary">Selected: {BLOCK_DEFINITIONS[selectedType].label}</Badge>
              </div>
            ) : null}
            <textarea
              ref={input}
              className="field-sizing-content max-h-40 min-w-50 flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-normal text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              rows={1}
              value={prompt}
              placeholder={
                agent.placeholder ?? 'Ask AI to write, restyle or restructure this email…'
              }
              aria-label="Ask the assistant"
              aria-keyshortcuts="Meta+K Control+K"
              disabled={running}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {running ? (
              <div className="flex items-center gap-1.5">
                <span
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 text-xs text-editor-ai"
                >
                  <Spinner aria-hidden className="size-3.5" /> {status}
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Stop"
                  title="Stop (Esc)"
                  onClick={() => abort.current?.abort()}
                >
                  <Icon icon={StopIcon} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Collapse the assistant"
                  onClick={() => setCollapsed(true)}
                >
                  <Icon icon={ArrowDown01Icon} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="default"
                  aria-label="Send"
                  disabled={!prompt.trim()}
                  onClick={() => submit()}
                >
                  <Icon icon={ArrowUp02Icon} />
                </Button>
              </div>
            )}
          </div>
          {!prompt && !running && !proposal && agent.suggestions?.length ? (
            <div
              data-slot="assistant-suggestions"
              className="flex flex-wrap justify-center gap-1.5"
            >
              {agent.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="xs"
                  className="rounded-full bg-popover px-2.5 hover:border-editor-ai/50 hover:text-editor-ai"
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
