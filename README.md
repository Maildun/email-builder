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
import '@maildun/email-builder/editor.css';

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
| `@maildun/email-builder/editor.css` | Editor styles | – |
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

Pass an `agent` to get the assistant panel. Edits arrive as a **proposal**: changed blocks are highlighted, and the user accepts or rejects them as one undoable step.

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

**Ref handle:** `ref` exposes `getDocument`, `apply`, `undo`, `redo`, `propose`, `accept`, `reject` and `render`.

**Theming:** the editor uses its own `--meb-*` CSS variables. Each one falls back to the matching shadcn/ui variable (`--background`, `--primary`, `--border`, …), so the editor picks up your app's theme automatically.

**Keyboard shortcuts:**

| Shortcut | Action |
| --- | --- |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌫ | Delete the selected block |
| ⌘D | Duplicate |
| ⌥↑ / ⌥↓ | Move up / down |
| Enter | Edit text |
| Esc | Stop editing / deselect |

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
bun run build       # tsdown → dist/
```

To run the playground (from the repository root):

```bash
bun run dev
```

Then open http://localhost:5173.

The playground has a scripted demo agent. To use the Claude agent, set `ANTHROPIC_API_KEY` first.

## License

MIT
