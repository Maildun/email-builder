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

## Tools

The server offers file tools plus the same editing tools as the [agent module](./agents):

| Tool | What it does |
| --- | --- |
| `list_emails` | Lists the email documents in the folder. |
| `create_email` | Creates a new email file, optionally from a [template](/guide/sections#templates), and opens it. |
| `open_email` | Opens an existing email file for editing. |
| `render_email` | Writes the HTML and plain-text versions next to the JSON file. |
| `get_document` … `check_email` | The [editing tools](./agents#tools). They act on the open email and save it after every successful change. |

The system prompt is sent as the server's instructions, so the client knows the blocks, sections and rules without extra setup.

## Works with the editor

The files are ordinary documents. Open them in `<EmailEditor>`, render them with `renderEmail`, or commit them to your repository as source-controlled templates.

## Embedding the server

The server is transport-agnostic. `EmailMcpServer` handles parsed JSON-RPC messages, and `serveStdio(options)` wires it to stdin/stdout, which is what the CLI does. They're internal to the CLI today; open an issue if you'd like them exported.
