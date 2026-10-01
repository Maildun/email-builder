import {
  Add01Icon,
  ComputerIcon,
  PencilEdit02Icon,
  Redo02Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  Undo02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { useEditorOptions, useEditorState, useEditorStore, useSlotClassName } from '../context';
import type { EditorMessages } from '../messages';
import type { EditorView } from '../store';
import { Button, cn, Icon, type IconSvgElement, Popover, Segmented, Separator, Tip } from '../ui';
import { Palette } from './Sidebar';

const VIEW_ICONS: Record<EditorView, IconSvgElement> = {
  design: PencilEdit02Icon,
  preview: ViewIcon,
  code: SourceCodeIcon,
};

function viewOptions(views: readonly EditorView[], messages: EditorMessages) {
  return (['design', 'preview', 'code'] as const)
    .filter((view) => views.includes(view))
    .map((view) => ({
      value: view,
      label: (
        <>
          <Icon icon={VIEW_ICONS[view]} data-icon="inline-start" /> {messages.topBar[view]}
        </>
      ),
    }));
}

/** The host's extra top-bar controls, in their own context so only the top bar re-renders. */
export const ToolbarContext = createContext<ReactNode>(null);

/** Views, undo/redo, viewport and the host's extra controls. */
export function EditorTopBar() {
  const toolbar = useContext(ToolbarContext);
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const viewport = useEditorState((state) => state.viewport);
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const { readOnly, views, messages } = useEditorOptions();
  const text = messages.topBar;
  const className = useSlotClassName('topbar');
  const [adding, setAdding] = useState(false);

  return (
    <header
      data-slot="topbar"
      className={cn(
        'flex h-13 flex-none items-center justify-between gap-3 border-b bg-card px-3',
        className,
      )}
    >
      {views.length > 1 ? (
        <Segmented<EditorView>
          ariaLabel={text.views}
          fill={false}
          value={view}
          onChange={(next) => store.setView(next)}
          options={viewOptions(views, messages)}
        />
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        {readOnly || view !== 'design' ? null : (
          // The sidebar hides on narrow editors; this keeps adding blocks one click away.
          <div className="@3xl/editor:hidden">
            <Popover
              open={adding}
              onOpenChange={setAdding}
              align="end"
              className="max-h-[min(70vh,560px)] w-72 overflow-y-auto p-0"
              trigger={
                <Button size="sm" variant="outline">
                  <Icon icon={Add01Icon} data-icon="inline-start" /> {text.add}
                </Button>
              }
            >
              <Palette surface="popover" onInsert={() => setAdding(false)} />
            </Popover>
          </div>
        )}
        {readOnly ? null : (
          <>
            <Tip label={text.undoTip}>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={text.undo}
                disabled={!canUndo}
                onClick={() => store.undo()}
              >
                <Icon icon={Undo02Icon} />
              </Button>
            </Tip>
            <Tip label={text.redoTip}>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={text.redo}
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
          ariaLabel={text.viewport}
          fill={false}
          value={viewport}
          onChange={(next) => store.setViewport(next)}
          options={[
            { value: 'desktop', label: <Icon icon={ComputerIcon} />, title: text.desktop },
            { value: 'mobile', label: <Icon icon={SmartPhone01Icon} />, title: text.mobile },
          ]}
        />
        {toolbar}
      </div>
    </header>
  );
}
