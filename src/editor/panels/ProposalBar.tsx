import { Cancel01Icon, SparklesIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { useEditorOptions, useEditorState, useEditorStore, useSlotClassName } from '../context';
import type { EditorMessages } from '../messages';
import type { Proposal } from '../store';
import { Button, cn, Icon } from '../ui';

/** Space kept between the end of the content and the floating bar. */
const OVERLAY_GAP = 16;

/** "2 blocks changed · 1 removed · Theme updated". */
export function describeProposal(proposal: Proposal, messages: EditorMessages): string {
  const text = messages.proposal;
  const parts: string[] = [];
  if (proposal.changed.length) parts.push(text.blocksChanged(proposal.changed.length));
  if (proposal.removed.length) parts.push(text.blocksRemoved(proposal.removed.length));
  if (proposal.themeChanged) parts.push(text.themeUpdated);
  if (proposal.settingsChanged) parts.push(text.settingsUpdated);
  return parts.length ? parts.join(' · ') : text.noVisibleChanges;
}

/**
 * The bar floats over the stage; publish its height on the stage so the
 * canvas, preview and code views keep their last content scrollable above it.
 */
function reserveOverlaySpace(bar: HTMLElement): void {
  const stage = bar.parentElement;
  if (!stage) return;
  const offset = stage.getBoundingClientRect().bottom - bar.getBoundingClientRect().top;
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

/** Extra controls in the proposal bar, before Reject (the `proposalActions` prop). */
export const ProposalActionsContext = createContext<
  ReactNode | ((proposal: Proposal) => ReactNode)
>(null);

/**
 * Review for pending changes (`editor.propose()`, e.g. from your own AI):
 * what changed, a way to step through it, and accept or reject as one undoable
 * step. Renders nothing without a proposal.
 */
export function EditorProposalBar() {
  const store = useEditorStore();
  const proposal = useEditorState((state) => state.proposal);
  const { messages } = useEditorOptions();
  const text = messages.proposal;
  const className = useSlotClassName('proposal');
  const bar = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  const actions = useContext(ProposalActionsContext);

  // Reserve room while the bar is up, and bring the first change into view.
  const first = proposal?.changed[0];
  const open = proposal !== null;
  useEffect(() => {
    const element = bar.current;
    const stage = element?.parentElement;
    if (!open || !element || !stage) return;
    reserveOverlaySpace(element);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => reserveOverlaySpace(element));
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      stage.style.removeProperty('--meb-overlay-space');
    };
  }, [open]);
  useEffect(() => {
    shown.current = 0;
    if (first) revealBlock(bar.current, first);
  }, [first]);

  if (!proposal) return null;
  const changes = proposal.changed.length;

  const showNextChange = () => {
    const id = proposal.changed[shown.current % changes];
    shown.current += 1;
    if (!id) return;
    if (store.getState().view !== 'design') store.setView('design');
    // The canvas mounts on the next frame when coming from another view.
    requestAnimationFrame(() => revealBlock(bar.current, id));
  };

  return (
    <div
      ref={bar}
      data-slot="proposal"
      role="status"
      className={cn(
        'absolute inset-x-0 bottom-4 z-10 mx-auto flex w-[min(640px,calc(100%-32px))] items-center gap-2.5 rounded-xl border border-editor-ai/30 bg-popover py-2.5 pr-2.5 pl-3.5 text-popover-foreground shadow-lg',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon icon={SparklesIcon} className="size-4 shrink-0 text-editor-ai" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="font-semibold text-sm">{describeProposal(proposal, messages)}</strong>
        {proposal.summary ? (
          <span className="text-muted-foreground text-xs">{proposal.summary}</span>
        ) : null}
      </div>
      {changes ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={showNextChange}
          aria-label={changes > 1 ? text.showNextChange : text.showChange}
        >
          {text.show}
        </Button>
      ) : null}
      {typeof actions === 'function' ? actions(proposal) : actions}
      <Button size="sm" variant="ghost" onClick={() => store.reject()}>
        <Icon icon={Cancel01Icon} data-icon="inline-start" /> {text.reject}
      </Button>
      <Button
        size="sm"
        variant="default"
        onClick={() => {
          store.accept();
          store.showToast(messages.toast.changesApplied, {
            label: messages.toast.undo,
            run: () => store.undo(),
          });
        }}
      >
        <Icon icon={Tick02Icon} data-icon="inline-start" /> {text.accept}
      </Button>
    </div>
  );
}
