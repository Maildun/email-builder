# The document

An email is an `EmailDocument`: a JSON object with settings, a theme, and a **flat map of blocks** plus the ordered ids of the top-level blocks. Container blocks list their children by id.

```jsonc
{
  "version": 1,
  "settings": {
    "width": 600,
    "preheader": "Inbox preview text",
    "padding": { "top": 32, "right": 0, "bottom": 32, "left": 0 },
    "backdropColor": "$background",
    "canvasColor": "$surface",
    "textColor": "$text",
    "linkColor": "$link",
    "fontSize": 16,
    "lineHeight": 1.5
  },
  "theme": {
    "colors": {
      "primary": "#1f6feb", "secondary": "#6e40c9", "text": "#1f2328", "muted": "#656d76",
      "background": "#f4f5f7", "surface": "#ffffff", "border": "#d8dee4", "link": "#1f6feb"
    },
    "fonts": { "body": "MODERN_SANS", "heading": "MODERN_SANS" }
  },
  "root": ["hello", "cta"],
  "blocks": {
    "hello": { "type": "text", "props": { "markdown": "Hi {{ first_name }}, **welcome**!" } },
    "cta": {
      "type": "button",
      "props": { "text": "Get started", "href": "https://example.com", "buttonColor": "$primary" }
    }
  }
}
```

Why flat? It makes every block addressable by id, so operations like "update `cta`" or "move `hello` into `col-2`" are short and unambiguous for both code and models. When you *write* blocks (in `createDocument` or an `insert` operation) you can still nest them; ids are generated for you.

## Settings

| Key | Type | Description |
| --- | --- | --- |
| `width` | 320–1200 | Content width in px. 600 is standard. |
| `preheader` | string (≤300) | Inbox preview text after the subject line. Not visible in the body. |
| `title` | string (≤200) | HTML `<title>`, used by some web views. |
| `lang` | string (≤20) | `<html lang>`, e.g. `"en"`. |
| `padding` | padding | Space between the window edge and the canvas. Default 32 top and bottom, 0 at the sides. |
| `backdropColor` | color | Color around the canvas. Default `$background`. |
| `canvasColor` | color | The email's own background. Default `$surface`. |
| `textColor` | color | Default text color. Default `$text`. |
| `linkColor` | color | Default link color. Default `$link`. |
| `borderColor` | color | Optional border around the canvas. |
| `borderRadius` | 0–48 | Canvas corner radius in px. |
| `fontSize` | 10–24 | Base font size in px. Default 16. |
| `lineHeight` | 1–2.5 | Base line height. Default 1.5. |

## Theme

The theme holds eight colors and two fonts. Blocks reference them as **tokens**, so changing the theme restyles the whole email at once.

| Token | Used for |
| --- | --- |
| `$primary` | Buttons and accents |
| `$secondary` | Secondary accents |
| `$text` | Body text |
| `$muted` | Footers, captions, small print |
| `$background` | Around the canvas |
| `$surface` | The canvas |
| `$border` | Dividers and borders |
| `$link` | Links |

Theme colors themselves must be hex values (`#1f6feb`). `DEFAULT_THEME` and `DEFAULT_SETTINGS` hold the defaults.

### Fonts

`theme.fonts.body` and `theme.fonts.heading`, and any block's `style.fontFamily`, take either a preset key or your own CSS font stack. The presets are web-safe stacks that look good without loading web fonts:

`MODERN_SANS`, `BOOK_SANS`, `ORGANIC_SANS`, `GEOMETRIC_SANS`, `HEAVY_SANS`, `ROUNDED_SANS`, `MODERN_SERIF`, `BOOK_SERIF`, `MONOSPACE`

`FONT_FAMILIES` maps each key to its label and stack.

## Blocks

Each block has a `type`, `props` (its content) and an optional `style` (its box and typography). Containers also have `children`.

```json
{
  "type": "heading",
  "props": { "text": "Spring sale", "level": 1 },
  "style": { "align": "center", "color": "$primary", "padding": { "top": 32, "bottom": 8 } }
}
```

| Group | Blocks |
| --- | --- |
| Content | `heading`, `text`, `button`, `social` |
| Media | `image`, `video`, `avatar` |
| Layout | `divider`, `spacer`, `container`, `columns`, `column` |
| Advanced | `html`, `custom` |

Placement rules:

- `columns` holds only `column` blocks (1–4 of them). Columns stack on mobile by default.
- `column` can only live inside `columns`, and holds any other block, including another `columns` row.
- `container` groups blocks with a shared background, border or padding.

Every block's props, style keys and defaults are listed in the [blocks reference](/reference/blocks).

## Values

**Colors** are a hex value (`"#1a73e8"` or `"#fff"`), `"transparent"`, or a theme token (`"$primary"`). Prefer tokens.

**Padding** is a number for all sides, or `{ top, right, bottom, left }` with any sides left out meaning 0. Values are px, 0–200.

**Text** in `text` blocks is restricted markdown: paragraphs (blank line), line breaks, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[links](https://…)`, `- ` bullet and `1. ` numbered lists. Headings take inline markdown only. Raw HTML is escaped; use an `html` block for custom markup.

**URLs** must start with `https://`, `http://`, `mailto:`, `tel:` or `#`, or be a merge tag. Script-capable schemes such as `javascript:` and `data:` are rejected.

**Merge tags** like `{{ first_name }}` or `{{ unsubscribe_url }}` are kept verbatim everywhere, including as link targets, so your sending platform can replace them. Tell the editor which tags you support with the [`mergeTags` prop](/editor/#merge-tags).

## Ids

Block ids start with a letter and use letters, digits, `_` or `-` (up to 64 characters). `root` is reserved for the document body. Give blocks readable ids (`hero-title`) when code or agents will refer to them later; otherwise they're generated.

## Types and schemas

Everything is exported with TypeScript types and Zod schemas:

```ts
import {
  DocumentSchema,      // z schema for EmailDocument
  BlockInputSchema,    // nested input blocks
  BLOCK_DEFINITIONS,   // per-type props/style schemas, defaults and docs
  documentJsonSchema,  // JSON Schema, for other languages and tools
  type EmailDocument,
  type Block,
  type BlockInput,
} from '@maildun/email-builder';
```

Next: change documents with [operations](./operations).
