import {
  Add01Icon,
  ComputerIcon,
  LayoutAlignLeftIcon,
  LayoutAlignRightIcon,
  PencilEdit02Icon,
  Redo02Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  Undo02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { createContext, type ReactNode, useContext, useState } from 'react';
import {
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useMessages,
  useSlotClassName,
} from '../context';
import type { EditorMessages } from '../messages';
import type { EditorPanel, EditorView } from '../store';
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

/** Each panel's icon while open and while closed; the inspector mirrors the sidebar. */
const PANEL_ICONS: Record<EditorPanel, { open: IconSvgElement; closed: IconSvgElement }> = {
  sidebar: { open: LayoutAlignLeftIcon, closed: LayoutAlignRightIcon },
  inspector: { open: LayoutAlignRightIcon, closed: LayoutAlignLeftIcon },
};

/** Shows or hides one side panel of the default layout. */
function PanelToggle({ panel, className }: { panel: EditorPanel; className?: string }) {
  const store = useEditorStore();
  const open = useEditorState((state) => state.panels[panel]);
  const text = useMessages().topBar;
  const label =
    panel === 'sidebar'
      ? open
        ? text.hideSidebar
        : text.showSidebar
      : open
        ? text.hideInspector
        : text.showInspector;
  return (
    <Tip
      label={
        <span className="flex flex-col">
          {label}
          <span className="opacity-70">{text.panelsTip}</span>
        </span>
      }
    >
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        aria-pressed={open}
        className={cn(!open && 'text-muted-foreground', className)}
        onClick={() => store.setPanel(panel)}
      >
        <Icon icon={PANEL_ICONS[panel][open ? 'open' : 'closed']} />
      </Button>
    </Tip>
  );
}

export interface EditorTopBarProps {
  /**
   * Buttons that show and hide the side panels of `EditorLayout`. Off by
   * default, since a custom layout may not have them.
   */
  panelToggles?: { sidebar?: boolean; inspector?: boolean };
}

/** Views, undo/redo, viewport and the host's extra controls. */
export function EditorTopBar({ panelToggles }: EditorTopBarProps = {}) {
  const toolbar = useContext(ToolbarContext);
  const store = useEditorStore();
  const view = useEditorState((state) => state.view);
  const sidebarOpen = useEditorState((state) => state.panels.sidebar);
  const viewport = useEditorState((state) => state.viewport);
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const { readOnly, views, messages } = useEditorOptions();
  const text = messages.topBar;
  const className = useSlotClassName('topbar');
  const [adding, setAdding] = useState(false);
  const togglesShown = !readOnly && view === 'design';
  const sidebarToggle = togglesShown && panelToggles?.sidebar;
  const inspectorToggle = togglesShown && panelToggles?.inspector;
  // The sidebar hides on narrow editors, or when closed; this keeps adding blocks one click away.
  const addButton = !(sidebarToggle && sidebarOpen);

  return (
    <header
      data-slot="topbar"
      className={cn(
        'flex h-13 flex-none items-center justify-between gap-3 border-b bg-card px-3',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {sidebarToggle ? (
          // The sidebar never shows on narrow editors, so neither does its toggle.
          <PanelToggle panel="sidebar" className="hidden @3xl/editor:inline-flex" />
        ) : null}
        {views.length > 1 ? (
          <Segmented<EditorView>
            ariaLabel={text.views}
            fill={false}
            value={view}
            onChange={(next) => store.setView(next)}
            options={viewOptions(views, messages)}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {readOnly || view !== 'design' ? null : (
          <div className={addButton ? undefined : '@3xl/editor:hidden'}>
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
        {inspectorToggle ? <PanelToggle panel="inspector" /> : null}
        {toolbar}
      </div>
    </header>
  );
}
