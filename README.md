<div align="center">

# Email Builder

**Emails that people and AI can design together.**

A typed document model, an operations API for LLM agents, an email-safe HTML renderer and a modern React editor. One package, MIT licensed.

[![CI](https://github.com/Maildun/email-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/Maildun/email-builder/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@maildun/email-builder)](https://www.npmjs.com/package/@maildun/email-builder)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Documentation](https://maildun.github.io/email-builder/) · [Getting started](https://maildun.github.io/email-builder/guide/getting-started) · [Agents](https://maildun.github.io/email-builder/ai/agents) · [MCP](https://maildun.github.io/email-builder/ai/mcp)

</div>

## Why

AI is great at writing emails and bad at writing email HTML. Email Builder lets models and people edit the same structured document through the same validated operations, and leaves the HTML to a renderer that knows Outlook.

- **🧱 A document you can trust.** Plain JSON with a Zod schema. Every change is validated, atomic and undoable.
- **📨 HTML that survives inboxes.** Outlook-, Gmail- and mobile-safe HTML plus plain text, from pure TypeScript with no React and no DOM. Runs on servers, edge functions and from a CLI.
- **🤖 Built for agents.** Provider-neutral tools, a system prompt generated from the schemas, and errors written so a model fixes its own mistakes.
- **✨ An editor people enjoy.** Drag and drop, inline rich text, mobile preview, keyboard shortcuts, dark mode, translations, and shadcn/ui styling that matches your app.
- **👀 Review what the AI changed.** AI edits arrive as a proposal the user accepts or rejects in one step.
- **🔌 MCP server included.** Claude, Cursor and other AI clients can design emails in a folder of JSON files.
- **↪️ Easy to switch.** EmailBuilder.js (`@usewaypoint/email-builder`) designs convert with one call.

## Install

```bash
npm install @maildun/email-builder
```

## Quick start

**Edit** with the React editor:

```tsx
import { EmailEditor } from '@maildun/email-builder/editor';
import '@maildun/email-builder/styles.css';

export function Compose() {
  return (
    <div style={{ height: '100vh' }}>
      <EmailEditor defaultValue={design} onChange={save} />
    </div>
  );
}
```

**Render** the stored JSON anywhere:

```ts
import { renderEmail } from '@maildun/email-builder';

const { html, text, warnings } = renderEmail(design);
```

**Generate** with any LLM:

```ts
import { buildSystemPrompt, createAgentSession, runTool, toAnthropicTools } from '@maildun/email-builder/agent';

const session = createAgentSession(design);
// system: buildSystemPrompt(), tools: toAnthropicTools(session.tools)
// for each tool call: runTool(session.tools, call.name, call.input)
session.getDocument(); // the new design
```

**Connect** an AI client over MCP:

```bash
claude mcp add email-builder -- npx -y @maildun/email-builder mcp --dir ./emails
```

## Documentation

| | |
| --- | --- |
| [What is Email Builder?](https://maildun.github.io/email-builder/guide/introduction) | How the pieces fit together |
| [Getting started](https://maildun.github.io/email-builder/guide/getting-started) | Install, edit, save, render and send |
| [The document](https://maildun.github.io/email-builder/guide/document) · [Blocks](https://maildun.github.io/email-builder/reference/blocks) | The JSON model, theme tokens and every block |
| [Operations](https://maildun.github.io/email-builder/guide/operations) · [Validation](https://maildun.github.io/email-builder/guide/validation) | Changing and checking documents |
| [Rendering and sending](https://maildun.github.io/email-builder/guide/rendering) · [CLI](https://maildun.github.io/email-builder/reference/cli) | HTML, plain text, providers, other languages |
| [Using the editor](https://maildun.github.io/email-builder/editor/) · [Styling](https://maildun.github.io/email-builder/editor/styling) | Props, images, merge tags, theming, dark mode |
| [Agent tools](https://maildun.github.io/email-builder/ai/agents) · [AI in the editor](https://maildun.github.io/email-builder/ai/editor-review) · [MCP](https://maildun.github.io/email-builder/ai/mcp) | Let models design emails |
| [Custom blocks](https://maildun.github.io/email-builder/guide/custom-blocks) | Your own block types |
| [Migrating from EmailBuilder.js](https://maildun.github.io/email-builder/guide/migrating) | Convert existing designs |
| [API reference](https://maildun.github.io/email-builder/reference/api) | Everything exported |

The docs are also readable on GitHub in [`docs/`](docs/).

## Entry points

| Import | Contents | Needs React |
| --- | --- | --- |
| `@maildun/email-builder` | Schema, operations, validation, lint, sections, templates, renderer | No |
| `@maildun/email-builder/editor` | `<EmailEditor>`, `EditorStore`, hooks | Yes (19) |
| `@maildun/email-builder/styles.css` | Precompiled editor styles, for any React app | – |
| `@maildun/email-builder/core.css` | Editor styles for Tailwind CSS 4 + shadcn/ui apps | – |
| `@maildun/email-builder/agent` | Agent tools, system prompt, provider adapters | No |
| `@maildun/email-builder/compat` | `fromEmailBuilderJs` | No |
| `@maildun/email-builder/mcp` | `EmailMcpServer`, `serveStdio` (Node) | No |

## Contributing

```bash
bun install
bun run dev         # playground at http://localhost:5173
bun run test
bun run docs:dev    # this documentation at http://localhost:5174
```

See the [contributing guide](https://maildun.github.io/email-builder/contributing).

## License

MIT. Parts of the UI and stylesheet come from shadcn/ui, Tailwind CSS and tw-animate-css (all MIT); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The EmailBuilder.js importer and font presets follow [EmailBuilder.js](https://github.com/usewaypoint/email-builder-js) (MIT) for compatibility.
