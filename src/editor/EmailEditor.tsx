import { type CSSProperties, forwardRef, type ReactNode, useEffect, useRef } from 'react';
import { useEditorOptions, useEditorState } from './context';
import { EditorRoot, type EditorRootProps, type EmailEditorHandle } from './EditorRoot';
import { Inspector } from './inspector/Inspector';
import { Sidebar } from './panels/Sidebar';
import { EditorStage } from './panels/Stage';
import { EditorTopBar } from './panels/TopBar';
import { cn } from './ui';

export type { EditorRootProps, EmailEditorHandle };

export interface EmailEditorProps extends Omit<EditorRootProps, 'children'> {
  /** Parts of the default layout to show. Both default to true. */
  panels?: { sidebar?: boolean; inspector?: boolean };
}

/**
 * Holds a side panel at its full width inside a grid column that can shrink to
 * nothing, so closing slides the panel out instead of squashing it. A closed
 * panel stays mounted (keeping its tab and scroll) but is inert.
 */
function PanelSlot({
  open,
  side,
  children,
}: {
  open: boolean;
  side: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <div
      inert={!open}
      className={cn('flex min-h-0 min-w-0 overflow-hidden', side === 'left' && 'justify-end')}
    >
      <div
        className={cn(
          'flex min-h-0 flex-none flex-col *:min-h-0 *:flex-1',
          side === 'left' ? 'w-(--meb-sidebar-width)' : 'w-(--meb-inspector-width)',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The default three-column layout: sidebar, stage, inspector. */
export function EditorLayout({
  sidebar = true,
  inspector = true,
}: {
  sidebar?: boolean;
  inspector?: boolean;
}) {
  const view = useEditorState((state) => state.view);
  const open = useEditorState((state) => state.panels);
  const { readOnly } = useEditorOptions();
  const panels = !readOnly && view === 'design';
  const showSidebar = panels && sidebar && open.sidebar;
  const showInspector = panels && inspector && open.inspector;
  // Slide only when a panel is toggled, not when switching views or modes.
  const previous = useRef(panels);
  const animate = previous.current === panels;
  useEffect(() => {
    previous.current = panels;
  }, [panels]);
  return (
    <div
      data-slot="layout"
      className={cn(
        'grid min-h-0 flex-1 grid-cols-[var(--meb-sidebar-column)_minmax(0,1fr)_var(--meb-inspector-column)]',
        // The sidebar hides on narrow editors; the inspector widens on large ones.
        '[--meb-sidebar-width:0px] @3xl/editor:[--meb-sidebar-width:220px] @5xl/editor:[--meb-sidebar-width:248px]',
        '[--meb-inspector-width:260px] @5xl/editor:[--meb-inspector-width:300px]',
        animate &&
          'transition-[grid-template-columns] duration-250 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
      )}
      style={
        {
          '--meb-sidebar-column': showSidebar ? 'var(--meb-sidebar-width)' : '0px',
          '--meb-inspector-column': showInspector ? 'var(--meb-inspector-width)' : '0px',
        } as CSSProperties
      }
    >
      {panels && sidebar ? (
        <PanelSlot side="left" open={showSidebar}>
          <Sidebar />
        </PanelSlot>
      ) : (
        <div />
      )}
      <EditorStage />
      {panels && inspector ? (
        <PanelSlot side="right" open={showInspector}>
          <Inspector />
        </PanelSlot>
      ) : (
        <div />
      )}
    </div>
  );
}

const EmailEditorBase = forwardRef<EmailEditorHandle, EmailEditorProps>(function EmailEditor(
  { panels, ...props },
  ref,
) {
  return (
    <EditorRoot ref={ref} {...props}>
      <EditorTopBar
        panelToggles={{ sidebar: panels?.sidebar ?? true, inspector: panels?.inspector ?? true }}
      />
      <EditorLayout sidebar={panels?.sidebar ?? true} inspector={panels?.inspector ?? true} />
    </EditorRoot>
  );
});

/**
 * The visual email editor. Works controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue`), and exposes an imperative handle via `ref`.
 *
 * For a custom layout, compose the parts yourself:
 * `<EmailEditor.Root>` with `<EmailEditor.TopBar>`, `<EmailEditor.Sidebar>`,
 * `<EmailEditor.Stage>`, `<EmailEditor.Inspector>` and your own components.
 */
export const EmailEditor = Object.assign(EmailEditorBase, {
  Root: EditorRoot,
  TopBar: EditorTopBar,
  Sidebar,
  Stage: EditorStage,
  Inspector,
  Layout: EditorLayout,
});
