# What is Email Builder?

`@maildun/email-builder` is an email builder for React and TypeScript apps, designed from the start so that **people and AI agents edit the same email with the same tools**.

It's four layers that you can use together or on their own:

```text
            ┌──────────────────────────────┐
  people ──▶│  <EmailEditor>  (React)      │──┐
            └──────────────────────────────┘  │   operations
            ┌──────────────────────────────┐  ├──▶ insert · update · move · remove …
  LLMs  ───▶│  agent tools / MCP server    │──┘          │
            └──────────────────────────────┘             ▼
                                              ┌──────────────────────┐
                                              │  EmailDocument (JSON)│
                                              └──────────┬───────────┘
                                                         ▼
                                              ┌──────────────────────┐
                                              │  renderEmail()       │──▶ HTML + plain text
                                              └──────────────────────┘
```

1. **The document.** An email is a JSON object: settings, a theme, and a flat map of blocks. You store it in your database as-is. See [The document](./document).
2. **Operations.** Every change, whether a person drags a block or a model calls a tool, is an operation such as `insert` or `update`. Operations are validated, atomic and undoable. See [Operations](./operations).
3. **The renderer.** `renderEmail()` turns a document into a complete HTML email and a plain-text version. It's pure TypeScript, so it runs in Node, Bun, browsers, edge functions and through a CLI. See [Rendering and sending](./rendering).
4. **The editor and the agents.** `<EmailEditor>` is the visual editor. The agent module gives any LLM the same editing power as tools, and the MCP server exposes them to AI clients. See [Using the editor](/editor/) and [Agent tools](/ai/agents).

## Why another email builder?

Most email builders store HTML or an opaque tree that only their UI understands. That makes them hard for an AI to edit safely: a model that writes raw email HTML produces something that breaks in Outlook, and a model that edits an unvalidated tree can corrupt the design.

Email Builder takes the other route:

- **The model never writes HTML.** It calls tools that change a typed document, and the renderer produces the email-safe markup.
- **Mistakes come back as instructions.** A rejected call explains what was wrong and how to fix it (`Unknown key "url". Did you mean "href"?`), so the model corrects itself without your help.
- **People stay in charge.** In the editor, AI changes are a proposal the user reviews, not a silent overwrite.
- **It's small and portable.** The core and renderer have no React and no DOM. The editor is one component with sensible defaults and a lot of room to customize.

## Entry points

| Import | Contents | Needs React |
| --- | --- | --- |
| `@maildun/email-builder` | Schema, operations, validation, lint, sections, templates, renderer | No |
| `@maildun/email-builder/editor` | `<EmailEditor>`, `EditorStore`, hooks and layout parts | Yes (19) |
| `@maildun/email-builder/styles.css` | Precompiled editor styles, for any React app | – |
| `@maildun/email-builder/core.css` | Editor styles for Tailwind CSS 4 + shadcn/ui apps | – |
| `@maildun/email-builder/agent` | Agent tools, system prompt, provider adapters | No |
| `@maildun/email-builder/compat` | `fromEmailBuilderJs` importer | No |

React is an optional peer dependency: a server that only renders or runs agents doesn't need it.

## Next steps

- [Getting started](./getting-started): install it and show the editor in five minutes.
- [Agent tools](/ai/agents): let a model write an email.
- [Migrating from EmailBuilder.js](./migrating): convert existing `@usewaypoint/email-builder` designs.
