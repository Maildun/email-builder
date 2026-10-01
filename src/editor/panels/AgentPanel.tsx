import {
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
import { Badge, Button, cn, Icon, Spinner } from '../ui';

export interface AgentRequest {
  prompt: string;
  /** The committed document when the request started. */
  document: EmailDocument;
  /** Block the user had selected, if any. */
  selectedId: string | null;
  /**
   * Tools bound to a reviewable proposal: every successful call updates the
   * proposal live in the canvas. Pass them to a browser-side LLM loop.
   */
  tools: AgentTool[];
  /** Adds operations to the proposal (for agents that run elsewhere and stream ops). */
  propose: (ops: Op[]) => { ok: boolean; issues: Array<{ path: string; message: string }> };
  /** Shows progress or the agent's final message. */
  setStatus: (message: string) => void;
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

export function AgentPanel({ agent }: { agent: EditorAgent }) {
  const store = useEditorStore();
  const proposal = useEditorState((state) => state.proposal);
  const selectedId = useEditorState((state) => state.selectedId);
  const selectedType = useEditorState((state) =>
    state.selectedId ? state.document.blocks[state.selectedId]?.type : undefined,
  );
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const className = useSlotClassName('assistant');

  // A proposal can also end outside this panel (⌘Z, or the host calling
  // accept/reject); drop its summary so it doesn't linger as a status.
  const hadProposal = useRef(false);
  useEffect(() => {
    if (hadProposal.current && !proposal) setStatus(null);
    hadProposal.current = proposal !== null;
  }, [proposal]);

  // The panel floats over the stage; publish its height so the canvas,
  // preview and code views can keep their last content scrollable above it.
  useEffect(() => {
    const element = panel.current;
    const stage = element?.parentElement;
    if (!element || !stage || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const offset = stage.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
      stage.style.setProperty('--meb-overlay-space', `${Math.ceil(offset + OVERLAY_GAP)}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      observer.disconnect();
      stage.style.removeProperty('--meb-overlay-space');
    };
  }, []);

  const submit = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    setStatus('Thinking…');

    const tools = createAgentTools({
      getDocument: () => store.visibleDocument(),
      setDocument: (_document, change) => {
        store.propose(change.ops, { label: trimmed });
      },
    });

    try {
      const response = await agent.onRequest({
        prompt: trimmed,
        document: store.getState().document,
        selectedId: store.getState().selectedId,
        tools,
        propose: (ops) => store.propose(ops, { label: trimmed }),
        setStatus: (message) => setStatus(message),
        signal: controller.signal,
      });
      if (response?.ops?.length) {
        const result = store.propose(response.ops, { label: trimmed });
        if (!result.ok) {
          setError(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
        }
      }
      if (response?.summary) {
        if (store.getState().proposal) store.setProposalSummary(response.summary);
        setStatus(response.summary);
      } else {
        setStatus(store.getState().proposal ? null : 'No changes proposed.');
      }
      setPrompt('');
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError((caught as Error).message || 'The assistant failed.');
      }
      setStatus(null);
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

  const changeCount = proposal?.changed.length ?? 0;

  return (
    <div
      ref={panel}
      data-slot="assistant"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto flex w-[min(640px,calc(100%-32px))] flex-col gap-2 *:pointer-events-auto',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {proposal && !running ? (
        <div
          data-slot="assistant-proposal"
          className="flex items-center gap-2.5 rounded-xl border border-editor-ai/30 bg-popover py-2.5 pr-2.5 pl-3.5 text-popover-foreground shadow-lg"
          role="status"
        >
          <Icon icon={SparklesIcon} className="size-4 shrink-0 text-editor-ai" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="text-sm font-semibold">
              {changeCount} block{changeCount === 1 ? '' : 's'} changed
            </strong>
            {proposal.summary ? (
              <span className="text-xs text-muted-foreground">{proposal.summary}</span>
            ) : null}
          </div>
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
            }}
          >
            <Icon icon={Tick02Icon} data-icon="inline-start" /> Accept
          </Button>
        </div>
      ) : null}
      {!proposal && status && !running ? (
        <p className="self-center rounded-full bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-popover px-3 py-2 text-xs whitespace-pre-wrap text-destructive shadow-md"
        >
          {error}
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
          className="field-sizing-content max-h-40 min-w-50 flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-normal text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          rows={1}
          value={prompt}
          placeholder={agent.placeholder ?? 'Ask AI to write, restyle or restructure this email…'}
          aria-label="Ask the assistant"
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
              onClick={() => abort.current?.abort()}
            >
              <Icon icon={StopIcon} />
            </Button>
          </div>
        ) : (
          <Button
            size="icon-sm"
            variant="default"
            aria-label="Send"
            disabled={!prompt.trim()}
            onClick={() => submit()}
          >
            <Icon icon={ArrowUp02Icon} />
          </Button>
        )}
      </div>
      {!prompt && !running && !proposal && agent.suggestions?.length ? (
        <div data-slot="assistant-suggestions" className="flex flex-wrap justify-center gap-1.5">
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
    </div>
  );
}
