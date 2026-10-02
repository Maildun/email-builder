# Custom blocks

Add your own block types, like a product card fed from your store or an event with a calendar link. A custom block:

- renders to email-safe HTML you control,
- validates its data with a [Zod](https://zod.dev) schema,
- gets inspector fields in the editor (or a JSON editor if you don't define any),
- and is documented for agents automatically.

## Define a block

```ts
import { defineBlock } from '@maildun/email-builder';
import { z } from 'zod';

export const productCard = defineBlock({
  name: 'product-card', // stored in documents; don't rename it later
  label: 'Product',
  description: 'A product with its image, name, price and a buy button.',
  category: 'content', // palette group (default "advanced")
  schema: z.object({
    name: z.string().min(1),
    price: z.string(),
    image: z.string().url(),
    href: z.string().url(),
  }),
  defaults: {
    name: 'Pour-over set',
    price: '$48',
    image: 'https://acme.com/pour-over.jpg',
    href: 'https://acme.com/p/pour-over',
  },
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'href', label: 'Link', type: 'url' },
  ],
  render: (data, ctx) => `
    <a href="${ctx.escape(data.href)}" style="text-decoration:none;color:${ctx.color('$text')}">
      <img src="${ctx.escape(data.image)}" alt="${ctx.escape(data.name)}" width="${ctx.width}"
           style="display:block;width:100%;height:auto;border:0" />
      <p style="margin:12px 0 0;font-family:${ctx.font('MODERN_SANS')};font-size:18px">
        ${ctx.escape(data.name)} · <strong style="color:${ctx.color('$primary')}">${ctx.escape(data.price)}</strong>
      </p>
    </a>`,
  text: (data) => `${data.name} – ${data.price}: ${data.href}`,
});
```

`defineBlock` checks the name and that `defaults` match the schema, and throws early if they don't.

## Use it everywhere

Pass the same list wherever documents are edited, rendered or generated:

```ts
const customBlocks = [productCard];

<EmailEditor customBlocks={customBlocks} />;
renderEmail(design, { customBlocks });
applyOps(design, ops, { customBlocks });          // validates data
createAgentSession(design, { customBlocks });     // agents may insert them
buildSystemPrompt({ customBlocks });              // documents name + data schema
```

## How they're stored

A custom block is stored as a built-in `custom` block:

```json
{ "type": "custom", "props": { "name": "product-card", "data": { "name": "Pour-over set", "price": "$48" } } }
```

So documents stay valid everywhere, even in code that doesn't know your definitions. Custom blocks also accept the usual box and alignment `style` (padding, background, border, radius, align).

## Writing `render`

- Return the block's **content** as email HTML: tables and inline styles, no scripts, no `<style>` tags. It goes inside the block's padded cell, so don't add outer padding.
- **Escape everything** that comes from data with `ctx.escape`.
- Match the email with the context:

| `ctx.` | Description |
| --- | --- |
| `color(value, fallback?)` | Resolves theme tokens like `$primary` to hex. |
| `font(value)` | Resolves a font key or stack to a CSS font stack. |
| `theme` | The document theme. |
| `textColor`, `linkColor` | The email's resolved text and link colors. |
| `fontSize`, `lineHeight` | The email's base typography. |
| `width` | Content width available to the block, in px. |
| `escape(text)` | Escapes text for HTML content and attributes. |

`text(data)` is optional and produces the plain-text version.

## Inspector fields

| Type | Edits | Extra options |
| --- | --- | --- |
| `text` | a single line | `placeholder` |
| `textarea` | multiple lines | `placeholder` |
| `url` | a link | `placeholder` |
| `image` | an image URL, with Upload / Choose when the editor has them | |
| `number` | a number | `min`, `max`, `step`, `unit` |
| `color` | a color or theme token | |
| `switch` | a boolean | |
| `select` | one of a list | `options: [{ value, label }]` |

Every field takes `key`, `label` and an optional `hint`. Give the block a palette `icon` from [Hugeicons](https://hugeicons.com) (`@hugeicons/core-free-icons`) if you like.

## When things go wrong

Problems never break the email. A missing definition, data that fails the schema, or a `render` that throws leaves the block out of the HTML and adds a `renderEmail` warning (`unknown-custom-block`, `invalid-custom-block`, `custom-block-error`). In the editor, a block whose definition is missing shows as "unknown" so it isn't lost.
