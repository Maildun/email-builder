# Using the editor

`<EmailEditor>` is the visual editor: a palette of blocks and sections on the left, the email in the middle, an inspector on the right, and a top bar with views (design, preview, code), the mobile/desktop toggle and undo/redo.

The code view shows the HTML, plain text and JSON with line numbers and syntax colors. HTML is indented for reading (toggle it off to see the output as sent); **Copy** always copies the exact output.

```tsx
import { EmailEditor } from '@maildun/email-builder/editor';
import '@maildun/email-builder/styles.css';

<div style={{ height: '100vh' }}>
  <EmailEditor defaultValue={design} onChange={setDesign} />
</div>
```

The editor fills its container (minimum height 480px) and adapts to its own width: the sidebar hides in narrow containers and the inspector widens in large ones.

## Controlled or uncontrolled

**Uncontrolled:** pass `defaultValue` and listen with `onChange`. The editor owns the state. This is the simplest choice.

**Controlled:** pass `value` and `onChange`. When `value` changes to a different document, the editor shows it.

```tsx
const [design, setDesign] = useState(initial);
<EmailEditor value={design} onChange={setDesign} />;
```

A `value` that's only a copy of the current document (for example after a JSON round trip through your server) is ignored, so undo history and pending AI proposals survive. To open a different email and clear the history, call `editor.load(document)` on the [ref](#the-ref-handle).

`onChange` fires for committed changes only, never while an AI proposal is waiting for review.

## Images

Connect your uploads and media library and the image fields gain **Upload** and **Choose** buttons:

```tsx
<EmailEditor
  onUploadImage={async (file) => {
    const { url } = await uploadToS3(file);
    return { url, alt: file.name };
  }}
  onPickImage={async () => {
    const picked = await openMediaLibrary(); // your own dialog
    return picked ? { url: picked.url, alt: picked.alt } : null;
  }}
/>
```

Without them, people paste image URLs.

## Merge tags

Tell the editor which merge tags your sending platform supports. They're offered in link fields and the text toolbar:

```tsx
<EmailEditor
  mergeTags={[
    { key: 'first_name', label: 'First name' },
    { key: 'unsubscribe_url', label: 'Unsubscribe link' },
  ]}
/>
```

Tags are inserted as `{{ first_name }}` and stay as written in the rendered HTML.

## Limit what's offered

```tsx
<EmailEditor
  blockTypes={['heading', 'text', 'button', 'image', 'divider', 'spacer', 'columns', 'column']}
  sections={['header', 'hero', 'footer']} // [] hides sections
  views={['design', 'preview']}            // hide the code view
  panels={{ inspector: true, sidebar: false }}
/>
```

Use `readOnly` to show a design without editing chrome, for example in an approval screen.

## Add your own controls

`toolbar` puts your controls at the right of the top bar. Pair it with the ref to save, send a test, or open your AI assistant:

```tsx
const editor = useRef<EmailEditorHandle>(null);

<EmailEditor
  ref={editor}
  defaultValue={design}
  toolbar={
    <button onClick={() => sendTest(editor.current!.render().html)}>Send test</button>
  }
  onSave={(doc) => save(doc)}
/>;
```

## Palette groups

`paletteGroups` adds your own groups to the palette, for example sections the user saved. Items insert on click (after the selection, like the built-in blocks) and drag onto the canvas or the layers. Their blocks' ids are dropped, so every insert gets fresh ones.

```tsx
<EmailEditor
  paletteGroups={[
    {
      id: 'saved',
      label: 'Your sections',
      position: 'beforeSections', // 'start' | 'beforeSections' | 'end' (default)
      actions: <button onClick={saveSelection}>Save</button>,
      empty: <p>Select a block and save it to reuse it.</p>,
      items: saved.map((section) => ({
        id: section.id,
        label: section.name,
        blocks: section.blocks,
        actions: <SectionMenu section={section} />, // shown on hover
      })),
    },
  ]}
/>
```

| `PaletteGroup` | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique among the groups. |
| `label` | `string` | Heading. |
| `items` | `PaletteGroupItem[]` | What the group offers. |
| `position` | `'start' \| 'beforeSections' \| 'end'` | Where the group goes. Default `end`. |
| `actions` | `ReactNode` | Controls beside the heading. |
| `empty` | `ReactNode` | Shown when `items` is empty. Without it, an empty group is hidden. |

| `PaletteGroupItem` | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique within its group. |
| `label` | `string` | Name under the thumbnail. |
| `description` | `string` | Tooltip. |
| `blocks` | `BlockInput[]` | Inserted on click or drop. |
| `thumbnail` | `ReactNode` | Replaces the default thumbnail, a small render of the blocks in the email's theme. |
| `actions` | `ReactNode` | Controls shown over the item on hover. |

To save something the user selected, turn it into blocks with `toBlockInput(document, id)` from the core package.

## The ref handle

| Method | Description |
| --- | --- |
| `getDocument()` | The committed document. |
| `apply(ops)` | Applies [operations](/guide/operations) as one undoable step. Returns `{ ok, issues }`. |
| `undo()` / `redo()` | History. |
| `propose(ops, summary?)` | Stages changes for review. See [AI in the editor](/ai/editor-review). |
| `setProposalSummary(text)` | Message shown with the pending proposal. |
| `accept()` / `reject()` | Resolves the proposal. |
| `tools(options?)` | Agent tools bound to the editor; each call adds to the proposal. |
| `load(document)` | Opens another document, clearing history, selection and any proposal. |
| `select(id)` | Selects a block (`null` deselects). |
| `render()` | Renders the committed document: `{ html, text, warnings }`. |
| `store` | The underlying `EditorStore`, for advanced use. |

## Events

| Prop | Called when |
| --- | --- |
| `onChange(document)` | A change is committed. |
| `onSave(document)` | The user presses ⌘S / Ctrl+S inside the editor (the browser's save dialog is suppressed). |
| `onSelectionChange(id, block)` | The selected block changes. |
| `onProposalChange(proposal)` | A proposal appears, changes, or is resolved (`null`). |

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘Z / ⇧⌘Z (or ⌘Y) | Undo / redo |
| ⌫ or Delete | Delete the selected block |
| ⌘D | Duplicate |
| ⌘\\ | Hide or show both side panels |
| ⌥↑ / ⌥↓ | Move the block up / down |
| ↑ / ↓ | Select the previous / next block |
| ← / → | Select the parent / first child |
| Enter | Edit text |
| Esc | Stop editing, then deselect |
| ⌘S | `onSave` |

On Windows and Linux, use Ctrl for ⌘ and Alt for ⌥.

## More

- [Styling and theming](./styling): stylesheets, dark mode, CSS variables.
- [Custom layouts](./custom-layouts): arrange the editor's parts yourself.
- [Translations](./translations): every piece of UI text.
- [Props reference](/reference/editor): every prop and type.
