import { Canvas } from '../canvas/Canvas';
import { useEditorState, useEditorStore, useSlotClassName } from '../context';
import { cn } from '../ui';
import { CodeView, Preview } from './Preview';
import { EditorProposalBar } from './ProposalBar';
import { EditorToast } from './Toast';

/**
 * The middle of the editor: the canvas, preview or code (whichever view is
 * active), plus the review bar for pending changes and toasts.
 */
export function EditorStage({ className }: { className?: string }) {
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const slotClassName = useSlotClassName('stage');

  return (
    <main
      data-slot="stage"
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col bg-editor-stage',
        slotClassName,
        className,
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
      <EditorProposalBar />
      <EditorToast />
    </main>
  );
}
