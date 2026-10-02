# Custom layouts

`<EmailEditor>` is a ready-made arrangement of parts. When you need a different one (your own header, an AI chat panel beside the canvas, the inspector in a drawer) compose the parts yourself inside `EmailEditor.Root`, which takes every editor prop:

```tsx
import { EmailEditor } from '@maildun/email-builder/editor';

<EmailEditor.Root defaultValue={design} onChange={setDesign}>
  <MyHeader />
  <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
    <EmailEditor.Stage />
    <EmailEditor.Inspector />
  </div>
</EmailEditor.Root>
```

| Part | Contents |
| --- | --- |
| `EmailEditor.TopBar` | Views, viewport toggle, undo/redo, panel toggles and your `toolbar` |
| `EmailEditor.Sidebar` | Palette (blocks and sections) and layers |
| `EmailEditor.Stage` | Canvas, preview or code, plus the proposal bar and toasts |
| `EmailEditor.Inspector` | Settings for the selected block, or the email when nothing is selected |
| `EmailEditor.Layout` | Sidebar, stage and inspector in the default three columns |

They're also exported by name: `EditorRoot`, `EditorTopBar`, `EditorSidebar`, `EditorStage`, `EditorInspector`, `EditorLayout`, plus `EditorPalette` (the palette alone) and `EditorProposalBar`.

## Reading and changing state

Components inside the root can use the editor's hooks:

```tsx
import { useEditorState, useEditorStore, useVisibleDocument } from '@maildun/email-builder/editor';

function MyHeader() {
  const store = useEditorStore();
  const canUndo = useEditorState((state) => state.canUndo);
  const selectedId = useEditorState((state) => state.selectedId);
  const document = useVisibleDocument(); // includes a pending proposal

  return (
    <header>
      <button disabled={!canUndo} onClick={() => store.undo()}>Undo</button>
      <span>{selectedId ?? `${document.root.length} blocks`}</span>
    </header>
  );
}
```

| Hook | Returns |
| --- | --- |
| `useEditorStore()` | The `EditorStore`: `apply`, `undo`, `redo`, `select`, `propose`, `accept`, `reject`, `setView`, `setViewport`, `setPanel` … |
| `useEditorState(selector)` | A slice of state, re-rendering when it changes. Selectors must return stable values. |
| `useVisibleDocument()` | The document on screen: the pending proposal, or the committed document. |
| `useEditorOptions()` | The resolved props (merge tags, custom blocks, views …). |
| `useMessages()` | The UI text, with your translations applied. |

Editor state (`EditorState`):

| Key | Description |
| --- | --- |
| `document` | The committed document |
| `selectedId`, `editingId` | Selected block, and the block whose text is being edited |
| `view` | `'design'`, `'preview'` or `'code'` |
| `viewport` | `'desktop'` or `'mobile'` |
| `panels` | `{ sidebar, inspector }` open state |
| `proposal` | The pending [proposal](/ai/editor-review), or `null` |
| `canUndo`, `canRedo` | History availability |
| `lastIssues` | Issues from the last rejected change |
| `toast` | The toast on screen, if any |

## Several editors on a page

Each editor has its own store, so you can render several at once (for example, A/B variants side by side).
