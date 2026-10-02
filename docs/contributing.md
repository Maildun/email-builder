# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome on [GitHub](https://github.com/Maildun/email-builder).

## Setup

The repository uses [Bun](https://bun.sh).

```bash
bun install
bun run test        # vitest
bun run typecheck   # tsc
bun run lint        # biome
bun run build       # tsdown → dist/, then dist/styles.css and dist/core.css
```

CI runs typecheck, lint, test and build on every pull request. `bun run format` fixes formatting.

## Playground

```bash
bun run dev
```

Then open <http://localhost:5173>. The playground loads the source directly (no build needed), uses the same CSS pipeline as `dist/styles.css`, and has template, theme and import controls. **Propose a change** in its header shows the review flow: it calls `editor.tools()` the way your AI would.

## Docs

This site lives in `docs/` and is built with [VitePress](https://vitepress.dev).

```bash
bun run docs:dev     # http://localhost:5174
bun run docs:build
```

Every page has an **Edit this page on GitHub** link at the bottom.

## Project layout

| Path | Contents |
| --- | --- |
| `src/core/` | Schema, operations, validation, lint, sections, templates |
| `src/render/` | HTML and plain-text renderer, CLI |
| `src/agent/` | Agent tools, system prompt, adapters |
| `src/mcp/` | MCP server |
| `src/editor/` | React editor; `ui/` holds the shadcn/ui components |
| `src/compat/` | EmailBuilder.js importer |
| `assets/social/` | Social icon PNGs (`bun run icons` regenerates them) |
| `test/` | Vitest tests, including EmailBuilder.js fixtures |
| `playground/` | Vite playground app |
| `docs/` | This site |

## UI components

The components in `src/editor/ui/` come from shadcn/ui (`base-vega` style, Hugeicons). To add one:

```bash
bunx shadcn@latest add dialog
bun run ui:fix      # relative imports + portal popups into the editor
```

## Guidelines

- **Core stays portable.** `src/core`, `src/render` and `src/agent` must not import React or touch the DOM.
- **Errors are for models too.** New validation messages should say what's wrong and how to fix it, with a `hint` when a fix is known.
- **Email-safe output.** Renderer changes should hold up in Outlook, Gmail and Apple Mail, light and dark. Mention which clients you tested.
- **Add tests** next to the area you change in `test/`.
- **Update the docs** in `docs/` when you change behavior or add an option.
