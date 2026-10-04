# Blocks

Every block is `{ type, props, style? }`, plus `children` for containers. Props are the block's content; style is its box and typography. Everything is optional: a missing value falls back to the default shown here (what the editor inserts) or to the email's settings.

## Style keys

Blocks share three groups of style keys:

**Box** (every block)

| Key | Type | Description |
| --- | --- | --- |
| `padding` | number or `{ top, right, bottom, left }` | px, 0–200 |
| `backgroundColor` | color | |
| `border` | `{ width, style, color }` | width 0–20 px; style `solid`, `dashed` or `dotted` |
| `borderRadius` | 0–100 | px |

**Align**

| Key | Type |
| --- | --- |
| `align` | `left`, `center` or `right` |

**Typography**

| Key | Type | Description |
| --- | --- | --- |
| `fontFamily` | font key or CSS stack | See [fonts](/guide/document#fonts) |
| `fontSize` | 8–96 | px |
| `fontWeight` | `normal`, `bold` or 100–900 | |
| `color` | color | |
| `lineHeight` | 0.8–3 | unitless |
| `letterSpacing` | -5–20 | px |

| Block | Style keys |
| --- | --- |
| `heading`, `text`, `html` | Box, align, typography |
| `button` | Box, align, and `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing` |
| `social`, `image`, `video`, `avatar`, `custom`, `container` | Box, align |
| `divider`, `spacer`, `columns`, `column` | Box |

Colors are hex values, `transparent`, or theme tokens like `$primary`. See [Values](/guide/document#values).

### Default styles

New blocks start with this style; anything else comes from the email's settings.

| Block | Default style |
| --- | --- |
| `heading` | padding 16 / 24 / 8 / 24 |
| `text` | padding 8 / 24 |
| `button` | padding 16 / 24, `fontWeight: 'bold'` |
| `image`, `video`, `social` | padding 16 / 24, `align: 'center'` |
| `avatar` | padding 16 / 24, `align: 'left'` |
| `divider`, `html`, `custom` | padding 16 / 24 |
| `container` | padding 16 / 0 |
| `columns` | padding 8 / 24 |
| `spacer`, `column` | none |

Padding is written top / right / bottom / left, or vertical / horizontal when the sides match.

## Content

### heading

A title or section heading.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | string | `'Heading'` | Inline markdown: bold, italic, links, code. |
| `level` | `1`, `2`, `3` | `2` | 32px, 24px or 20px unless `style.fontSize` is set. |

### text

Paragraphs of body copy in restricted markdown.

Default: `'Write something people want to read.'`

| Prop | Type | Description |
| --- | --- | --- |
| `markdown` | string | Paragraphs, line breaks, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, links, `- ` and `1. ` lists. Raw HTML is escaped. |

### button

A call-to-action link styled as a button. Outlook-safe.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | string | `'Get started'` | Label |
| `href` | URL | `'https://example.com'` | Link |
| `shape` | `rectangle`, `rounded`, `pill` | `rounded` | |
| `size` | `xs`, `sm`, `md`, `lg` | `md` | |
| `fullWidth` | boolean | `false` | Stretch to the content width |
| `buttonColor` | color | `$primary` | Fill |
| `textColor` | color | `#ffffff` | Label color |

### social

A row of social network icons linking to your profiles.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `links` | `{ network, href, label?, icon? }[]` | X, LinkedIn, Instagram, YouTube | Up to 16, in order |
| `variant` | `brand`, `dark`, `light` | `dark` | Network colors, black tiles or gray tiles |
| `shape` | `circle`, `rounded`, `square` | `circle` | |
| `size` | 16–48 | `32` | Icon size in px |
| `gap` | 0–32 | `12` | Space between icons in px |

Networks: `x`, `facebook`, `instagram`, `linkedin`, `youtube`, `tiktok`, `threads`, `bluesky`, `github`, `discord`, `whatsapp`, `pinterest`, `telegram`, `mastodon`, `reddit`, `website`, `email` (use a `mailto:` link). `label` is the alt text (defaults to the network name); `icon` is your own square image URL.

## Media

### image

A picture, optionally linked.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | URL | a placehold.co placeholder | Absolute image URL |
| `alt` | string | | Always describe the image |
| `href` | URL | | Link when clicked |
| `width` | 1–1200 or `'full'` | `'full'` | px, or fill the content width. Omit for the natural size. |
| `height` | 1–2000 | | px; usually omitted |

### video

Email can't play video inline, so this is a thumbnail with a play button that links to the video.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | URL | | Where the video plays, e.g. a YouTube or Vimeo link |
| `thumbnail` | URL | | Poster image. Omit for YouTube links to use the video's own thumbnail. |
| `alt` | string | `'Watch the video'` | |
| `width` | 80–1200 or `'full'` | `'full'` | Shown at 16:9 |

### avatar

A small round or square portrait or logo.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | URL | a placehold.co placeholder | |
| `alt` | string | | |
| `size` | 16–256 | `64` | Diameter in px |
| `shape` | `circle`, `square`, `rounded` | `circle` | |

## Layout

### divider

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | color | `$border` | |
| `thickness` | 1–24 | `1` | px |
| `width` | 1–100 | `100` | % of the content width |

### spacer

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `height` | 1–400 | `24` | px |

### container

Groups blocks with a shared background, border or padding. No props; style it and put blocks in `children`.

### columns

A row of 1–4 `column` blocks.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gap` | 0–80 | `16` | px between columns |
| `verticalAlign` | `top`, `middle`, `bottom` | `top` | |
| `stackOnMobile` | boolean | `true` | Stack columns on small screens |

### column

One column inside `columns`. Holds any blocks, including another `columns` row.

| Prop | Type | Description |
| --- | --- | --- |
| `width` | 5–100 | % of the row. Omit to share the remaining space equally. |

## Advanced

### html

Raw HTML for anything the other blocks can't express. Inserted as-is, so it's your job to keep it email-safe.

Default: `'<p>Custom <strong>HTML</strong></p>'`

| Prop | Type | Description |
| --- | --- | --- |
| `html` | string | Up to 500,000 characters |

### custom

A block type your app defines. See [Custom blocks](/guide/custom-blocks).

| Prop | Type | Description |
| --- | --- | --- |
| `name` | string | The definition's name, e.g. `product-card` |
| `data` | object | Content, shaped by the definition's schema |

## In code

`BLOCK_DEFINITIONS` holds each type's `label`, `description`, `category`, `props` and `style` Zod schemas, `container` flag and `defaults`. `BLOCK_TYPES` lists the types, and `canContain(parentType, childType)` checks placement.
