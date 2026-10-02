# API

Everything exported, by entry point. All of it ships with TypeScript types.

## `@maildun/email-builder`

No React, no DOM. Safe on servers, edge runtimes and in the browser.

### Documents

| Export | Description |
| --- | --- |
| `createDocument({ settings?, theme?, blocks? })` | A valid document from partial settings/theme and nested blocks. Throws on invalid input. |
| `emptyDocument()` | A blank document with default settings and theme. |
| `DEFAULT_SETTINGS`, `DEFAULT_THEME` | The defaults. |
| `TEMPLATES`, `TemplateName` | Starter documents. See [Templates](/guide/sections#templates). |
| `SECTIONS`, `SECTION_NAMES`, `buildSection(name, params)` | See [Sections](/guide/sections). |
| `ROOT_ID` | `'root'`, the id of the document body. |

### Operations

| Export | Description |
| --- | --- |
| `applyOps(doc, ops, { customBlocks? })` | Applies ops atomically. Returns `{ ok, document, changed, inserted, removed }` or `{ ok: false, issues }`. |
| `applyOpsMaterialized(doc, ops, options?)` | Same, one op at a time, and returns the ops with explicit ids. |
| `materializeOp(doc, op)` | One op with explicit ids for everything it creates. |
| `OpSchema` and `InsertOpSchema` … `ReplaceDocumentOpSchema` | Zod schemas for operations. |
| `Op`, `InsertOp`, `UpdateOp`, `MoveOp`, `RemoveOp`, `DuplicateOp`, `ReplaceOp`, `UpdateSettingsOp`, `UpdateThemeOp`, `ReplaceDocumentOp`, `ApplyResult` | Types. |

See [Operations](/guide/operations).

### Validation and lint

| Export | Description |
| --- | --- |
| `validateDocument(input)` | `{ ok: true, document }` or `{ ok: false, issues }`. |
| `validateStructure(doc)` | Tree checks only, for an already-typed document. |
| `lintDocument(doc, options?)` | Quality warnings. See [Lint](/guide/validation#lint). |
| `formatIssues(issues)` | Issues as readable text. |
| `Issue`, `LintWarning`, `LintOptions`, `ValidationResult` | Types. |

### Schemas and types

| Export | Description |
| --- | --- |
| `DocumentSchema`, `SettingsSchema`, `ThemeSchema` | Zod schemas. |
| `BlockSchema`, `BlockInputSchema`, `HeadingBlockSchema` … | Zod schemas for stored and nested input blocks. |
| `BLOCK_DEFINITIONS`, `BLOCK_TYPES` | Per-type schemas, defaults and docs. |
| `canContain(parent, child)`, `isContainerType(type)`, `hasChildren(block)` | Placement helpers. |
| `documentJsonSchema()`, `blockInputJsonSchema()`, `opJsonSchema()` | JSON Schemas. |
| `FONT_FAMILIES`, `FONT_KEYS`, `resolveFontStack(font)` | Font presets. |
| `THEME_COLOR_TOKENS`, `resolveColor(color, theme)`, `contrastRatio(fg, bg)` | Colors. |
| `resolvePadding(padding)`, `isSafeUrl(url)` | Value helpers. |
| `EmailDocument`, `Settings`, `Theme`, `Block`, `BlockOf<T>`, `BlockInput`, `BlockType`, `BlockProps<T>`, `BlockStyle<T>` | Types. |

### Tree

`walk`, `findParent`, `childrenOf`, `descendantIds`, `ancestorIds`, `toBlockInput`, `normalizeBlockInputs`, and `createId` / `createUniqueId` for ids. See [Reading the tree](/guide/operations#reading-the-tree).

### Custom blocks

| Export | Description |
| --- | --- |
| `defineBlock(definition)` | Declares a custom block. See [Custom blocks](/guide/custom-blocks). |
| `customBlockMap(list)` | Definitions by name. |
| `validateCustomBlocks(doc, list, ids?)` | Checks custom block data against the definitions. |
| `CustomBlockDefinition`, `CustomBlockField`, `CustomRenderContext`, `CustomBlocks` | Types. |

### Social and video

| Export | Description |
| --- | --- |
| `SOCIAL_NETWORKS`, `SOCIAL_LABELS`, `detectNetwork(url)` | Supported networks. |
| `socialIconUrl(assetsUrl, network, variant)`, `DEFAULT_ASSETS_URL` | Icon URLs. |
| `youtubeId(url)`, `videoThumbnail(props)` | Video helpers. |

### Renderer

| Export | Description |
| --- | --- |
| `renderEmail(doc, options?)` | `{ html, text, warnings }`. See [Rendering](/guide/rendering). |
| `renderPlainText(doc, options?)` | Only the plain-text version. |
| `renderMarkdown`, `renderInlineMarkdown`, `markdownToPlainText` | The restricted markdown renderer. |
| `escapeHtml`, `safeUrl`, `protectMergeTags` | Escaping helpers. |
| `createRenderContext`, `renderDocumentHtml`, `renderBlock`, `box`, `boxDeclarations`, `typeDeclarations`, `columnWidths`, `innerWidth` | Building blocks for custom renderers. |
| `RenderOptions`, `RenderResult`, `RenderWarning`, `RenderContext` | Types. |

## `@maildun/email-builder/editor`

React 19. Marked `'use client'`.

| Export | Description |
| --- | --- |
| `EmailEditor` | The editor, with `.Root`, `.TopBar`, `.Sidebar`, `.Stage`, `.Inspector`, `.Layout`. See [Editor props](./editor). |
| `EditorRoot`, `EditorTopBar`, `EditorSidebar`, `EditorPalette`, `EditorStage`, `EditorInspector`, `EditorLayout`, `EditorProposalBar`, `Canvas` | Parts. |
| `useEditorStore`, `useEditorState`, `useVisibleDocument`, `useEditorOptions`, `useMessages` | Hooks. See [Custom layouts](/editor/custom-layouts). |
| `EditorProvider` | Context provider, for advanced compositions. |
| `EditorStore` | The state store. |
| `EN_MESSAGES`, `resolveMessages`, `EditorMessages` | UI text. See [Translations](/editor/translations). |
| `describeProposal(proposal, messages)` | A short description of a proposal's changes, in the given UI language. |
| `EmailEditorProps`, `EmailEditorHandle`, `EditorRootProps`, `EditorOptions`, `EditorState`, `Proposal`, `MergeTag`, `ImageResult`, `EditorView`, `Viewport`, `EditorSlot`, `EditorClassNames` | Types. |

## `@maildun/email-builder/agent`

| Export | Description |
| --- | --- |
| `createAgentSession(doc, options?)` | In-memory document with tools. |
| `createAgentTools(store, options?)` | Tools bound to your own store. |
| `runTool(tools, name, input)` | Runs a tool call: `{ ok, content, data? }`. |
| `buildSystemPrompt(options?)` | The system prompt. |
| `blockCatalog()`, `customBlockCatalog(list)` | Just the catalogs. |
| `toAnthropicTools`, `toOpenAITools`, `toMcpTools` | Provider adapters. |
| `outlineDocument(doc)`, `summarizeBlock(block)` | The outline `get_document` returns. |
| `AgentTool`, `AgentSession`, `AgentToolsOptions`, `DocumentStore`, `ToolResult`, `SystemPromptOptions`, `JsonSchema` | Types. |

See [Agent tools](/ai/agents).

## `@maildun/email-builder/compat`

| Export | Description |
| --- | --- |
| `fromEmailBuilderJs(input)` | `{ document, warnings }`. Throws when the input isn't an EmailBuilder.js document. |
| `isEmailBuilderJsDocument(value)` | Type guard. |
| `escapeMarkdown(text)` | Escapes markdown syntax so text renders literally. |

See [Migrating from EmailBuilder.js](/guide/migrating).

## Stylesheets

| Import | Use |
| --- | --- |
| `@maildun/email-builder/styles.css` | Precompiled, scoped. Any React app. |
| `@maildun/email-builder/core.css` | For Tailwind CSS 4 + shadcn/ui apps. |

See [Styling and theming](/editor/styling).
