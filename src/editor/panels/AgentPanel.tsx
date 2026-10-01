import { ArrowUp, Check, LoaderCircle, Sparkles, Square, X } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';
import { type AgentTool, createAgentTools } from '../../agent/tools';
import type { Op } from '../../core/ops';
import { BLOCK_DEFINITIONS } from '../../core/schema/blocks';
import type { EmailDocument } from '../../core/schema/document';
import { useEditorState, useEditorStore } from '../context';
import { Button, cx } from '../ui';

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
    <div className="meb-agent" onClick={(event) => event.stopPropagation()}>
      {proposal && !running ? (
        <div className="meb-proposal" role="status">
          <Sparkles size={16} />
          <div className="meb-proposal-text">
            <strong>
              {changeCount} block{changeCount === 1 ? '' : 's'} changed
            </strong>
            {proposal.summary ? <span>{proposal.summary}</span> : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              store.reject();
              setStatus(null);
            }}
          >
            <X size={14} /> Reject
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              store.accept();
              setStatus(null);
            }}
          >
            <Check size={14} /> Accept
          </Button>
        </div>
      ) : null}
      {!proposal && status && !running ? <p className="meb-agent-status">{status}</p> : null}
      {error ? <p className="meb-error meb-agent-error">{error}</p> : null}
      <div className={cx('meb-composer', running && 'meb-composer-running')}>
        {selectedId && selectedType ? (
          <span className="meb-chip">Selected: {BLOCK_DEFINITIONS[selectedType].label}</span>
        ) : null}
        <textarea
          className="meb-composer-input"
          rows={1}
          value={prompt}
          placeholder={agent.placeholder ?? 'Ask AI to write, restyle or restructure this email…'}
          aria-label="Ask the assistant"
          disabled={running}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {running ? (
          <div className="meb-row meb-gap-sm">
            <span className="meb-agent-running">
              <LoaderCircle size={14} className="meb-spin" /> {status}
            </span>
            <Button
              size="icon"
              variant="outline"
              aria-label="Stop"
              onClick={() => abort.current?.abort()}
            >
              <Square size={12} />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="primary"
            aria-label="Send"
            disabled={!prompt.trim()}
            onClick={() => submit()}
          >
            <ArrowUp size={16} />
          </Button>
        )}
      </div>
      {!prompt && !running && !proposal && agent.suggestions?.length ? (
        <div className="meb-suggestions">
          {agent.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="meb-suggestion"
              onClick={() => submit(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
