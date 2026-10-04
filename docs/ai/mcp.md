# MCP server

`email-builder mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server, so AI clients such as Claude Desktop, Claude Code or Cursor can design emails in a folder of JSON files.

## Set it up

::: code-group

```bash [Claude Code]
claude mcp add email-builder -- npx -y @maildun/email-builder mcp --dir ./emails
```

```jsonc [Claude Desktop]
// claude_desktop_config.json
{
  "mcpServers": {
    "email-builder": {
      "command": "npx",
      "args": ["-y", "@maildun/email-builder", "mcp", "--dir", "/path/to/emails"]
    }
  }
}
```

```jsonc [Cursor]
// .cursor/mcp.json
{
  "mcpServers": {
    "email-builder": {
      "command": "npx",
      "args": ["-y", "@maildun/email-builder", "mcp", "--dir", "./emails"]
    }
  }
}
```

:::

Then ask: *"Create a welcome email for our coffee subscription in emails/welcome.json and render it."*

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--dir <folder>` | the current folder | Where the email files live. Paths outside it are refused. |
| `--assets-url <url>` | jsDelivr | Where rendered social icons load from (see [Social icons](/guide/rendering#social-icons)). |
| `--brief <text>` | – | Brand, audience or tone guidance, added to the instructions. |
| `--merge-tags <a,b,…>` | – | Merge tags your sending platform supports. The AI uses only these. |
| `--blocks <module>` | – | A JS module exporting your [custom blocks](/guide/custom-blocks) (default export or `customBlocks`). The AI can insert, look up and render them. |
| `--require-unsubscribe` | off | `check_email` and `render_email` warn when there's no `{{ unsubscribe_url }}`. |

```bash
npx -y @maildun/email-builder mcp --dir ./emails --merge-tags first_name,unsubscribe_url \
  --brief "Acme sells specialty coffee. Warm, short." --blocks ./email-blocks.js --require-unsubscribe
```

## Tools

The server offers file tools plus the same editing tools as the [agent module](./agents):

| Tool | Arguments | What it does |
| --- | --- | --- |
| `list_emails` | – | Lists the email documents in the folder, marking the open one. Looks up to 3 folders deep, skips dotfiles and `node_modules`, lists only valid email JSON and stops at 200 files. |
| `create_email` | `file`, `template?` | Creates a new email file, optionally from a [template](/guide/sections#templates) (default `blank`), and opens it. Fails if the file already exists. |
| `open_email` | `file` | Opens an existing email file for editing. Points to `import_email` for EmailBuilder.js files. |
| `copy_email` | `to`, `from?` | Copies an email (the open one by default) to a new file and opens the copy, e.g. for a variant. |
| `import_email` | `from`, `to?` | Converts an [EmailBuilder.js](/guide/migrating) JSON file into a new email file (default `<from>-imported.json`) and opens it, listing anything that didn't carry over. |
| `undo` / `redo` | – | Steps back and forward through changes to the open email (100 steps), saving each time. History resets when another email is opened. |
| `render_email` | `out?`, `include_html?` | Writes the HTML (default: the JSON file's name with `.html`) and a plain-text `.txt` beside it, and reports warnings. `include_html: true` also returns the HTML. |
| `get_reference` | `topic` | Looks up a block type's props and style (with types, defaults and where it can go), a section's params, a custom block, or the catalog of blocks, sections, templates or custom blocks. Works without an open email. |
| `get_document` … `check_email` | | The other [editing tools](./agents#tools). They act on the open email and save it after every successful change. |

Paths are relative to `--dir`; a path without an extension gets `.json`. Until an email is opened or created, the editing tools (except `get_reference`) answer *"No email is open"*.

Every tool has a `title` and MCP `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint: false` since nothing leaves the folder), so clients can auto-approve reads and ask before destructive changes.

The system prompt is sent as the server's instructions, so the client knows the blocks, sections and rules without extra setup. Some clients shorten long instructions; `get_reference` gives the model the same reference on demand.

The server speaks MCP `2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`.

## Works with the editor

The files are ordinary documents. Open them in `<EmailEditor>`, render them with `renderEmail`, or commit them to your repository as source-controlled templates.

## Embedding the server

The server is transport-agnostic and exported from `@maildun/email-builder/mcp` (Node only). `EmailMcpServer` handles parsed JSON-RPC messages; `serveStdio(options)` wires it to stdin/stdout (logging to stderr) and returns the server, which is what the CLI does. The `instructions` option, which adds your own text after the built-in instructions, is only available from code; the CLI has no flag for it.

```ts
import { EmailMcpServer } from '@maildun/email-builder/mcp';

const server = new EmailMcpServer({
  dir: './emails',
  brief: 'Acme sells specialty coffee.',
  mergeTags: ['first_name', 'unsubscribe_url'],
  customBlocks: [productCard],
  lint: { requireUnsubscribe: true },
  instructions: 'Always create a plain-text-friendly layout.', // appended to the server instructions
});

// From your own transport (HTTP, WebSocket …):
const response = server.handle(JSON.parse(body)); // null for notifications
```

Hosts that keep emails somewhere other than files (a database, an open editor) can build the same thing from the [agent module](./agents): `createAgentTools(store)` with their own store, `toMcpTools` for `tools/list`, and `buildSystemPrompt` for `instructions`.
