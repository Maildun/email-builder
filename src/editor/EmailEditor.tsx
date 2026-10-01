import { forwardRef } from 'react';
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

/** The default three-column layout: sidebar, stage, inspector. */
export function EditorLayout({
  sidebar = true,
  inspector = true,
}: {
  sidebar?: boolean;
  inspector?: boolean;
}) {
  const view = useEditorState((state) => state.view);
  const { readOnly } = useEditorOptions();
  const panels = !readOnly && view === 'design';
  const showSidebar = panels && sidebar;
  const showInspector = panels && inspector;
  return (
    <div
      className={cn(
        'grid min-h-0 flex-1',
        showSidebar && showInspector
          ? 'grid-cols-[minmax(0,1fr)_260px] @3xl/editor:grid-cols-[220px_minmax(0,1fr)_260px] @5xl/editor:grid-cols-[248px_minmax(0,1fr)_300px]'
          : showInspector
            ? 'grid-cols-[minmax(0,1fr)_260px] @5xl/editor:grid-cols-[minmax(0,1fr)_300px]'
            : showSidebar
              ? 'grid-cols-[minmax(0,1fr)] @3xl/editor:grid-cols-[220px_minmax(0,1fr)] @5xl/editor:grid-cols-[248px_minmax(0,1fr)]'
              : 'grid-cols-[minmax(0,1fr)]',
      )}
    >
      {showSidebar ? <Sidebar /> : null}
      <EditorStage />
      {showInspector ? <Inspector /> : null}
    </div>
  );
}

const EmailEditorBase = forwardRef<EmailEditorHandle, EmailEditorProps>(function EmailEditor(
  { panels, ...props },
  ref,
) {
  return (
    <EditorRoot ref={ref} {...props}>
      <EditorTopBar />
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
