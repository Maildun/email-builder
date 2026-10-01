# @maildun/email-builder

An agentic-first email builder for React and TypeScript.

- **A typed document model** with an operations API (`insert`, `update`, `move`, `remove`, …) that both people and LLM agents use. Every change is validated, atomic and undoable.
- **A dependency-light renderer** that turns a document into Outlook-, Gmail- and mobile-safe HTML plus a plain-text version. It is pure TypeScript with no React and no DOM, so it runs in Node, Bun, browsers, edge functions, or from the command line.
- **Agent tools** for any LLM provider: tool definitions, a system prompt generated from the block schemas, and error messages written so a model can fix its own mistakes.
- **A modern React editor**: drag and drop, inline rich text, live mobile preview, undo/redo, and an assistant panel where agent edits show up as a proposal you accept or reject.
- **EmailBuilder.js import**: existing `@usewaypoint/email-builder` documents convert with one call.

```bash
npm install @maildun/email-builder
```

## Quick start

```tsx
import { useState } from 'react';
import type { EmailDocument } from '@maildun/email-builder';
import { EmailEditor } from '@maildun/email-builder/editor';
import '@maildun/email-builder/styles.css';

export function Compose() {
  const [design, setDesign] = useState<EmailDocument>();
  return (
    <div style={{ height: '100vh' }}>
      <EmailEditor defaultValue={design} onChange={setDesign} />
    </div>
  );
}
```

Render on the server (or anywhere) from the stored JSON:

```ts
import { renderEmail } from '@maildun/email-builder';

const { html, text, warnings } = renderEmail(design);
```

…or from any language through the CLI:

```bash
npx email-builder render design.json   # prints {"html", "text", "warnings"}
npx email-builder validate design.json # prints {"ok", "issues", "warnings"}
```

## Entry points

| Import | Contents | Needs React |
| --- | --- | --- |
| `@maildun/email-builder` | Schema, operations, validation, lint, sections, templates, renderer | No |
| `@maildun/email-builder/editor` | `<EmailEditor>`, `EditorStore`, hooks | Yes (19) |
| `@maildun/email-builder/styles.css` | Editor styles, ready to use | – |
| `@maildun/email-builder/core.css` | Editor styles for Tailwind CSS 4 apps (see [Styling](#styling)) | – |
| `@maildun/email-builder/agent` | Agent tools, system prompt, provider adapters | No |
| `@maildun/email-builder/compat` | `fromEmailBuilderJs` | No |

## The document

A document is a flat map of blocks plus an ordered list of top-level ids. Container blocks list their children by id.

```jsonc
{
  "version": 1,
  "settings": { "width": 600, "preheader": "Inbox preview text", "backdropColor": "$background", "canvasColor": "$surface", "textColor": "$text", "linkColor": "$link", "fontSize": 16, "lineHeight": 1.5 },
  "theme": {
    "colors": { "primary": "#1f6feb", "secondary": "#6e40c9", "text": "#1f2328", "muted": "#656d76", "background": "#f4f5f7", "surface": "#ffffff", "border": "#d8dee4", "link": "#1f6feb" },
    "fonts": { "body": "MODERN_SANS", "heading": "MODERN_SANS" }
  },
  "root": ["hello", "cta"],
  "blocks": {
    "hello": { "type": "text", "props": { "markdown": "Hi {{ first_name }}, **welcome**!" } },
    "cta": { "type": "button", "props": { "text": "Get started", "href": "https://example.com", "buttonColor": "$primary" } }
  }
}
```

**Blocks:**

| Group | Blocks |
| --- | --- |
| Content | `heading`, `text`, `button` |
| Media | `image`, `avatar` |
| Layout | `divider`, `spacer`, `container`, `columns` (1–4 `column` children that stack on mobile) |
| Advanced | `html` |

**Values:**

- **Colors** are hex values or theme tokens (`$primary`, `$text`, …). With tokens, a single theme change restyles the whole email.
- **Text** is restricted markdown: bold, italic, strike, code, links and lists. Raw HTML is escaped.
- **Merge tags** (`{{ first_name }}`, `{{ unsubscribe_url }}`) are kept as-is, even as link targets, so your sending platform can fill them in.

## Operations

```ts
import { applyOps, createDocument } from '@maildun/email-builder';

const doc = createDocument({
  blocks: [
    { type: 'heading', props: { text: 'Hello' } },
    { type: 'columns', children: [{ type: 'text' }, { type: 'image', props: { src: 'https://…', alt: 'Product' } }] },
  ],
});

const result = applyOps(doc, [
  { op: 'insert', parentId: 'root', index: 0, blocks: [{ id: 'logo', type: 'image', props: { src: 'https://…', alt: 'Acme' } }] },
  { op: 'update', id: 'logo', style: { align: 'center' } },
]);

if (!result.ok) console.log(result.issues); // [{ path, message, hint, opIndex }]
```

**How operations behave:**

- **Atomic.** If any op in a batch fails, the original document is returned untouched.
- **Nested input.** Inserted blocks can include their children. Ids and defaults are filled in.
- **Ops:** `insert`, `update` (`null` removes a key), `move`, `remove` (removes descendants too), `duplicate`, `replace`, `updateSettings`, `updateTheme`, `replaceDocument`.
- **Related helpers:**
  - `validateDocument`: schema and tree integrity (missing children, orphans, cycles, placement).
  - `lintDocument`: alt text, contrast, placeholder links, unsubscribe link.
  - `documentJsonSchema()`: the JSON Schema.

## Agents

The agent module is provider-neutral: it gives you tools and a prompt, and you bring the model.

```ts
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, createAgentSession, runTool, toAnthropicTools } from '@maildun/email-builder/agent';

const session = createAgentSession(design, { lint: { requireUnsubscribe: true } });
const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [{ role: 'user', content: 'Write a welcome email for a coffee roaster' }];

while (true) {
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: buildSystemPrompt({ mergeTags: ['first_name', 'unsubscribe_url'] }),
    tools: toAnthropicTools(session.tools),
    messages,
  });
  messages.push({ role: 'assistant', content: response.content });
  if (response.stop_reason !== 'tool_use') break;
  messages.push({
    role: 'user',
    content: response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map((block): Anthropic.ToolResultBlockParam => {
        const result = runTool(session.tools, block.name, block.input);
        return { type: 'tool_result', tool_use_id: block.id, content: result.content, is_error: !result.ok };
      }),
  });
}

session.getDocument(); // the new design
session.ops;           // the operations, replayable as an editor proposal
```

**Tools:** `get_document`, `get_block`, `insert_blocks`, `update_block`, `move_block`, `remove_block`, `duplicate_block`, `replace_block`, `insert_section`, `update_settings`, `update_theme`, `replace_document`, `apply_ops`, `check_email`.

**Adapters:** `toAnthropicTools`, `toOpenAITools`, `toMcpTools`.

### In the editor

Pass an `agent` to get the assistant panel. Edits arrive as a **proposal**: changed blocks are highlighted, the panel summarizes what changed (blocks, removals, theme, settings) with a **Show** button that jumps to each change, and the user accepts or rejects everything as one undoable step.

Each request includes `history`: the earlier prompts in this session and whether their proposals were accepted, so follow-ups like "make it shorter" have context. **Stop** (or Esc) aborts `signal` and ignores any tool calls that arrive afterwards.

```tsx
<EmailEditor
  value={design}
  onChange={setDesign}
  agent={{
    suggestions: ['Add a footer', 'Make it shorter'],
    // Option A: run the model on your server and return its ops.
    onRequest: async ({ prompt, document, selectedId, signal }) => {
      const response = await fetch('/api/email-agent', {
        method: 'POST',
        body: JSON.stringify({ prompt, document, selectedId }),
        signal,
      });
      return response.json(); // { ops, summary }
    },
    // Option B: run an LLM loop in the browser with `request.tools`;
    // each tool call updates the proposal live.
  }}
/>
```

## Editor props

| Prop | Description |
| --- | --- |
| `value` / `defaultValue` / `onChange` | Controlled or uncontrolled document. `onChange` only fires for committed changes, never for pending proposals. |
| `mergeTags` | `{ key, label }[]` offered in link fields and the text toolbar. |
| `onUploadImage(file)` | Resolve with `{ url, alt? }`. Enables **Upload**. |
| `onPickImage()` | Open your media library and resolve with `{ url, alt? }`. Enables **Choose**. |
| `agent` | Enables the assistant panel (see above). |
| `readOnly` | Hides editing chrome. |
| `toolbar` | Extra controls in the top bar. |
| `appearance` | `'inherit'` (default: dark when an ancestor has the `dark` class), `'light'`, `'dark'` or `'system'`. |
| `classNames` | Extra classes per part: `root`, `topbar`, `sidebar`, `stage`, `canvas`, `inspector`, `assistant`, `block-toolbar`. |
| `customBlocks` | Your own block types (see [Custom blocks](#custom-blocks)). |
| `blockTypes` | Built-in block types offered in the palette, e.g. `['heading', 'text', 'button', 'image']` to leave out raw HTML. All by default. |
| `sections` | Sections offered in the palette; `[]` hides them. All by default. |
| `views` | Views in the top bar, e.g. `['design', 'preview']`. All by default. |
| `panels` | `{ sidebar?: boolean; inspector?: boolean }` for the default layout. |
| `onSelectionChange(id, block)` | The selected block changed. |
| `onProposalChange(proposal)` | An agent proposal appeared, changed, or was resolved (`null`). |
| `onSave(document)` | ⌘S / Ctrl+S inside the editor; the browser's save dialog is suppressed. |
| `messages` | Translations for the editor's UI text (see below). |

**Ref handle:** `ref` exposes `getDocument`, `apply` and `propose` (both return `{ ok, issues }`), `undo`, `redo`, `accept`, `reject`, `select`, `load` (open another document and clear its undo history) and `render`.

A controlled `value` that is only a copy of the current document (for example after a JSON round trip) is ignored, so undo history and pending proposals survive.

**Keyboard shortcuts:**

| Shortcut | Action |
| --- | --- |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌫ | Delete the selected block |
| ⌘D | Duplicate |
| ⌥↑ / ⌥↓ | Move up / down |
| ↑ / ↓ | Select the previous / next block |
| ← / → | Select the parent / first child |
| Enter | Edit text |
| Esc | Stop editing / deselect, or stop the assistant |
| ⌘K | Open the assistant |

**Translations:** every piece of UI text comes from `messages`. Pass only what you translate; the rest stays English. Messages with values are functions.

```tsx
<EmailEditor
  messages={{
    topBar: { design: 'Desain', preview: 'Pratinjau', undo: 'Urungkan' },
    toast: { deleted: (label) => `${label} dihapus`, undo: 'Urungkan' },
    blocks: { text: { label: 'Teks' }, divider: { label: 'Pemisah' } },
    inspector: { fields: { Padding: 'Jarak dalam', Alignment: 'Perataan' } },
  }}
/>
```

`EN_MESSAGES` holds every key with its English text. `inspector.fields` translates inspector labels and options by their English text. Validation messages from the core stay English, since agents read them too.

## Custom blocks

Add your own block types, like a product card fed from your store. A custom block renders to email-safe HTML, validates its data with a [Zod](https://zod.dev) schema, gets inspector fields, and is documented for agents automatically.

```ts
import { defineBlock } from '@maildun/email-builder';
import { z } from 'zod';

export const productCard = defineBlock({
  name: 'product-card', // stored in documents; don't rename it later
  label: 'Product',
  description: 'A product with its image, name, price and a buy button.',
  category: 'content', // palette group (default "advanced")
  schema: z.object({ name: z.string().min(1), price: z.string(), image: z.string().url(), href: z.string().url() }),
  defaults: { name: 'Pour-over set', price: '$48', image: 'https://…', href: 'https://…' },
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'href', label: 'Link', type: 'url' },
  ],
  render: (data, ctx) => `<a href="${ctx.escape(data.href)}" style="color:${ctx.color('$primary')}">${ctx.escape(data.name)} · ${ctx.escape(data.price)}</a>`,
  text: (data) => `${data.name} – ${data.price}: ${data.href}`,
});
```

Pass the same list everywhere documents are edited or rendered:

```ts
<EmailEditor customBlocks={[productCard]} />
renderEmail(design, { customBlocks: [productCard] });
applyOps(design, ops, { customBlocks: [productCard] }); // validates data
createAgentSession(design, { customBlocks: [productCard] });
buildSystemPrompt({ customBlocks: [productCard] }); // documents name + data schema
```

- **Stored as** `{ type: "custom", props: { name, data } }`, so documents stay valid even where a definition is missing.
- **`render`** returns the block's content as email HTML (tables and inline styles, no scripts). It goes inside the block's padded cell. Escape user content with `ctx.escape`, and use `ctx.color('$primary')`, `ctx.font()` and `ctx.width` to match the email.
- **Field types:** `text`, `textarea`, `url`, `image`, `number`, `color`, `switch` and `select`. Without `fields`, the inspector shows a JSON editor.
- **Problems don't break the email:** a missing definition, data that fails the schema, or a `render` that throws leaves the block out and adds a `renderEmail` warning (`unknown-custom-block`, `invalid-custom-block`, `custom-block-error`).

## Custom layouts

`<EmailEditor>` is a ready-made arrangement of parts. Compose your own with `EmailEditor.Root`, which takes every editor prop, and any of the parts:

```tsx
<EmailEditor.Root defaultValue={design} onChange={setDesign} agent={agent}>
  <MyHeader /> {/* can use useEditorStore() / useEditorState() */}
  <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
    <EmailEditor.Stage /> {/* canvas, preview or code, plus the assistant and toasts */}
    <EmailEditor.Inspector />
  </div>
</EmailEditor.Root>
```

Parts: `EmailEditor.TopBar`, `EmailEditor.Sidebar`, `EmailEditor.Stage`, `EmailEditor.Inspector` and `EmailEditor.Layout` (sidebar, stage and inspector). They're also exported as `EditorTopBar`, `EditorSidebar`, `EditorStage`, `EditorInspector`, `EditorLayout`, `EditorPalette` and `EditorRoot`.

## Styling

The editor UI is built with [shadcn/ui](https://ui.shadcn.com) (Base UI primitives) and Tailwind CSS. Pick the stylesheet that fits your app; the editor needs a container with a height (it fills it, with a minimum of 480px).

**Any React app: `styles.css`.** Everything is precompiled. Rules are scoped to the editor, so they never touch the rest of your page, and you don't need Tailwind.

```ts
import '@maildun/email-builder/styles.css';
```

Theme it with `--meb-*` variables (shadcn's token names with a `meb-` prefix), on `.meb-root` or any ancestor:

```css
:root {
  --meb-primary: oklch(0.55 0.22 263);
  --meb-radius: 0.75rem;
  --meb-font: 'Inter', sans-serif;
}
.dark {
  --meb-primary: oklch(0.7 0.16 263);
}
```

Tokens: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent` (each with a `-foreground` pair), `destructive`, `border`, `input`, `ring`, `radius`, `font`, plus the editor's own `selection`, `selection-soft`, `ai`, `ai-soft` and `stage`.

**Tailwind CSS 4 + shadcn/ui apps: `core.css`.** Your app compiles the editor's classes, so the editor uses your theme (colors, radius, fonts, dark mode) and your Tailwind build. It expects the standard shadcn setup (`tw-animate-css` and `shadcn/tailwind.css` imported):

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@maildun/email-builder/core.css';
@source '../node_modules/@maildun/email-builder/dist';
```

**Dark mode** follows a `dark` class on an ancestor (the shadcn convention). Use the `appearance` prop to force `light`, `dark` or follow the OS with `system`. The email canvas always shows the email's own colors, because that's what recipients see.

Browser dark-mode tools (Dark Reader, Chrome's auto dark mode) recolor every page, including the email preview and color swatches. If your app has its own dark mode, tell them so:

```html
<meta name="color-scheme" content="light dark" />
<meta name="darkreader-lock" />
```

**Customizing parts.** Each part of the editor has a `data-slot` attribute and accepts extra classes through `classNames`:

```tsx
<EmailEditor classNames={{ sidebar: 'w-72', canvas: 'bg-slate-50' }} />
```

```css
/* Loaded after the editor's stylesheet. */
[data-slot='topbar'] {
  height: 56px;
}
.meb-block[data-selected]::after {
  box-shadow: inset 0 0 0 2px hotpink;
}
```

The email canvas resets your page's global styles inside it, so what you see matches what recipients get.

## Migrating from EmailBuilder.js

```ts
import { fromEmailBuilderJs, isEmailBuilderJsDocument } from '@maildun/email-builder/compat';

if (isEmailBuilderJsDocument(stored)) {
  const { document, warnings } = fromEmailBuilderJs(stored);
}
```

**How the import works:**

- Block ids are preserved where they are valid.
- The fixed three-slot columns become `column` blocks.
- Hidden or unattached content is dropped, with a warning for each.
- Markdown the restricted renderer cannot express (tables, images, raw HTML) becomes an `html` block.

## Development

```bash
bun install
bun run test        # vitest
bun run typecheck
bun run lint        # biome
bun run build       # tsdown → dist/, then dist/styles.css and dist/core.css
```

The UI components in `src/editor/ui/` come from shadcn/ui (`base-vega` style, Hugeicons). To add one:

```bash
bunx shadcn@latest add dialog
bun run ui:fix      # relative imports + portal popups into the editor
```

To run the playground (from the repository root):

```bash
bun run dev
```

Then open http://localhost:5173.

The playground has a scripted demo agent. To use the Claude agent, set `ANTHROPIC_API_KEY` first.

## License

MIT
