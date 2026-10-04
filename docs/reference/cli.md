# CLI

The package installs an `email-builder` command. It reads a document as JSON from a file or stdin and prints JSON to stdout, so any language can use it.

```bash
npx email-builder <command> [file]
```

## `render`

Renders a document to HTML and plain text.

```bash
npx email-builder render design.json
cat design.json | npx email-builder render
```

```json
{ "html": "<!DOCTYPE html>…", "text": "…", "warnings": [] }
```

If the document is invalid, it prints `{ "ok": false, "issues": [...] }` and exits with code 1.

## `validate`

Validates a document and lints it.

```bash
npx email-builder validate design.json
```

```json
{ "ok": true, "issues": [], "warnings": [{ "code": "missing-preheader", "severity": "info", "message": "…" }] }
```

Exits with 1 when the document is invalid. Lint warnings don't affect the exit code.

## `mcp`

Runs the [MCP server](/ai/mcp) over stdio.

```bash
npx email-builder mcp --dir ./emails
```

| Option | Default | Description |
| --- | --- | --- |
| `--dir <folder>` | current folder | Where the email files live |
| `--assets-url <url>` | jsDelivr | Where rendered social icons load from |
| `--brief <text>` | – | Brand, audience or tone guidance added to the instructions |
| `--merge-tags <a,b,…>` | – | Merge tags your sending platform supports; the AI uses only these |
| `--blocks <module>` | – | JS module exporting [custom blocks](/guide/custom-blocks) (default export or `customBlocks`) |
| `--require-unsubscribe` | off | `check_email` and `render_email` warn when there's no `{{ unsubscribe_url }}` |

## Exit codes

Running `email-builder` with no command, or with `--help`, prints the usage to stderr and exits with `0`.

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | The document is invalid |
| `2` | Unknown command, the input isn't JSON, or `mcp` couldn't start (e.g. the `--blocks` module didn't load or doesn't export an array) |
