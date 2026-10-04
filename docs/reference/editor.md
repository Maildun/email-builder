# Editor props and handle

```ts
import { EmailEditor, type EmailEditorProps, type EmailEditorHandle } from '@maildun/email-builder/editor';
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `EmailDocument` | Controlled document. Pair with `onChange`. |
| `defaultValue` | `EmailDocument` | Initial document when uncontrolled. Empty when omitted. |
| `onChange` | `(document) => void` | Every committed change; never pending proposals. |
| `readOnly` | `boolean` | Hides editing chrome. |
| `mergeTags` | `{ key, label? }[]` | Offered in link fields and the text toolbar. |
| `onUploadImage` | `(file: File) => Promise<{ url, alt? }>` | Enables **Upload** on image fields. |
| `onPickImage` | `() => Promise<{ url, alt? } \| null>` | Opens your media library. Enables **Choose**. |
| `customBlocks` | `CustomBlockDefinition[]` | Your block types. See [Custom blocks](/guide/custom-blocks). |
| `assetsUrl` | `string` | Where the social icons are hosted. Defaults to jsDelivr. |
| `blockTypes` | `BlockType[]` | Built-in blocks offered in the palette. All by default. |
| `sections` | `SectionName[]` | Sections in the palette; `[]` hides them. All by default. |
| `views` | `('design' \| 'preview' \| 'code')[]` | Views in the top bar. All by default. |
| `panels` | `{ sidebar?: boolean; inspector?: boolean }` | Panels in the default layout. Panels left on can still be hidden from the top bar. |
| `toolbar` | `ReactNode` | Extra controls at the right of the top bar. |
| `proposalActions` | `ReactNode \| (proposal) => ReactNode` | Extra controls in the proposal bar, before Reject. |
| `appearance` | `'inherit' \| 'light' \| 'dark' \| 'system'` | Color scheme. `inherit` follows a `.dark` class on an ancestor. |
| `classNames` | `Partial<Record<EditorSlot, string>>` | Extra classes for `root`, `topbar`, `sidebar`, `stage`, `canvas`, `inspector`, `proposal`, `block-toolbar`. |
| `icons` | `Partial<Record<EditorIconName, IconSvgElement>>` | Replacement Hugeicons for `proposal` (the review bar's mark), `reject` and `accept`. Others keep the built-in icons. |
| `messages` | `DeepPartial<EditorMessages>` | UI text. See [Translations](/editor/translations). |
| `onSelectionChange` | `(id, block) => void` | The selected block changed. |
| `onProposalChange` | `(proposal \| null) => void` | A proposal appeared, changed, or was resolved. |
| `onSave` | `(document) => void` | ⌘S / Ctrl+S inside the editor. |
| `className`, `style` | | On the root element. |
| `ref` | `Ref<EmailEditorHandle>` | See below. |

`EmailEditor.Root` takes the same props except `panels`, plus `children`. See [Custom layouts](/editor/custom-layouts).

## Handle

| Member | Type | Description |
| --- | --- | --- |
| `getDocument` | `() => EmailDocument` | The committed document. |
| `apply` | `(ops: Op \| Op[]) => { ok, issues }` | Applies operations as one undoable step. |
| `undo`, `redo` | `() => void` | |
| `propose` | `(ops: Op[], summary?: string) => { ok, issues }` | Stages changes for review; calls add up into one proposal. |
| `setProposalSummary` | `(summary: string) => void` | Message shown with the pending proposal. |
| `accept`, `reject` | `() => void` | Resolves the proposal. |
| `tools` | `(options?) => AgentTool[]` | [Agent tools](/ai/agents) that add to the proposal. Takes `lint` and `strictSchemas`; custom blocks come from the editor. |
| `load` | `(document) => void` | Opens another document; clears history, selection and any proposal. |
| `select` | `(id: string \| null) => void` | |
| `render` | `() => RenderResult` | Renders the committed document. Safe in event handlers. |
| `store` | `EditorStore` | The underlying store. |

## Types

| Type | Description |
| --- | --- |
| `Proposal` | `{ document, changed, removed, themeChanged, settingsChanged, ops, label?, summary? }` |
| `EditorState` | See [Custom layouts](/editor/custom-layouts#reading-and-changing-state). |
| `MergeTag` | `{ key: string; label?: string }` |
| `ImageResult` | `{ url: string; alt?: string }` |
| `EditorView` | `'design' \| 'preview' \| 'code'` |
| `Viewport` | `'desktop' \| 'mobile'` |
| `EditorSlot` | The `classNames` keys |
| `EditorMessages` | Every UI string; `EN_MESSAGES` is the English set |

## `EditorStore`

The framework-agnostic state behind each editor, with undo/redo (200 steps) and proposals. You can create one yourself for tests or non-React tooling:

```ts
import { EditorStore } from '@maildun/email-builder/editor';

const store = new EditorStore(document);
store.apply([{ op: 'remove', id: 'promo' }]);
store.undo();
store.subscribe(() => console.log(store.getState().canRedo));
```

Methods: `getState`, `subscribe`, `apply(ops, { mergeKey?, select? })`, `setDocument`, `load`, `undo`, `redo`, `select`, `selectParent`, `startEditing`, `stopEditing`, `setView`, `setViewport`, `setPanel`, `togglePanels`, `propose(ops, { label?, summary? })`, `setProposalSummary`, `accept`, `reject`, `showToast`, `dismissToast`, `visibleDocument`.
