import { Canvas } from '../canvas/Canvas';
import { useEditorOptions, useEditorState, useEditorStore, useSlotClassName } from '../context';
import { cn } from '../ui';
import { AgentPanel } from './AgentPanel';
import { CodeView, Preview } from './Preview';
import { EditorToast } from './Toast';

/**
 * The middle of the editor: the canvas, preview or code (whichever view is
 * active), plus the floating assistant and toasts.
 */
export function EditorStage({ className }: { className?: string }) {
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const { readOnly, agent } = useEditorOptions();
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
      {agent && !readOnly ? <AgentPanel agent={agent} /> : null}
      <EditorToast />
    </main>
  );
}
