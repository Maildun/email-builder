# Rendering and sending

`renderEmail` turns a document into a complete HTML email and a plain-text version:

```ts
import { renderEmail } from '@maildun/email-builder';

const { html, text, warnings } = renderEmail(document);
```

- **Pure and synchronous.** No React, no DOM, no network. It runs in Node, Bun, Deno, browsers, Cloudflare Workers and other edge runtimes.
- **Email-client safe.** Table layout, inline styles, Outlook (MSO) fixes, a responsive stylesheet for mobile, and columns that stack on small screens.
- **Merge tags untouched.** `{{ first_name }}` appears in the output exactly as written, including inside `href` attributes, ready for your sending platform.
- **Preheader handled.** `settings.preheader` is added as hidden preview text, padded so inboxes don't pull body copy into the preview.
- **Plain text included.** `text` is a readable alternative for the `text/plain` part: headings, paragraphs, lists, and buttons, linked images, videos and social icons as "label: URL".

## Options

```ts
renderEmail(document, {
  lang: 'id',                         // overrides settings.lang (default "en")
  customBlocks: [productCard],        // definitions for your custom blocks
  assetsUrl: 'https://cdn.acme.com/email-builder', // where the social icons are hosted
});
```

## Warnings

Rendering never throws on a valid document. Problems are collected in `warnings`:

| Code | Meaning |
| --- | --- |
| `gmail-clipping` | The HTML is above 102 KB, so Gmail will clip it. |
| `unresolved-token` | A theme color token didn't resolve. |
| `unknown-custom-block` | A custom block's definition wasn't passed; the block is left out. |
| `invalid-custom-block` | A custom block's data fails its schema; the block is left out. |
| `custom-block-error` | A custom block's `render` threw; the block is left out. |

For quality checks such as missing alt text, use [`lintDocument`](./validation#lint).

## Sending

The output works with any provider. Two examples:

::: code-group

```ts [Resend]
import { Resend } from 'resend';
import { renderEmail } from '@maildun/email-builder';

const { html, text } = renderEmail(design);
await new Resend(process.env.RESEND_API_KEY).emails.send({
  from: 'Acme <hello@acme.com>',
  to: 'ada@example.com',
  subject: 'Welcome to Acme',
  html,
  text,
});
```

```ts [Nodemailer]
import nodemailer from 'nodemailer';
import { renderEmail } from '@maildun/email-builder';

const { html, text } = renderEmail(design);
await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
  from: 'Acme <hello@acme.com>',
  to: 'ada@example.com',
  subject: 'Welcome to Acme',
  html,
  text,
});
```

:::

If your provider doesn't replace merge tags, replace them yourself before sending. Escape the values, since they go into HTML:

```ts
import { escapeHtml } from '@maildun/email-builder';

const fill = (source: string, values: Record<string, string>, escape = true) =>
  source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (tag, key) =>
    key in values ? (escape ? escapeHtml(values[key]) : values[key]) : tag,
  );

const personalHtml = fill(html, { first_name: 'Ada', unsubscribe_url: link });
const personalText = fill(text, { first_name: 'Ada', unsubscribe_url: link }, false);
```

## Other languages

The [CLI](/reference/cli) reads a document from a file or stdin and prints JSON, so a PHP, Python, Ruby or Go backend can render without a JavaScript runtime of its own beyond Node:

```bash
npx email-builder render design.json
# {"html":"<!doctype html>…","text":"…","warnings":[]}
```

For example, from Laravel:

```php
$result = Process::input($design)->run(['npx', 'email-builder', 'render']);
['html' => $html, 'text' => $text] = json_decode($result->output(), true);
```

## Social icons

Email clients don't show SVG, so the `social` block uses PNG icons: 17 networks in `brand`, `dark` and `light` styles, shipped in the package's `assets/` folder. By default they load from jsDelivr, pinned to the installed package version, so emails you've already sent keep working after you upgrade.

To host them yourself, copy `node_modules/@maildun/email-builder/assets` to your CDN and pass its URL as `assetsUrl`, both to `renderEmail()` and to `<EmailEditor>`:

```ts
renderEmail(design, { assetsUrl: 'https://cdn.acme.com/email-builder' });
// → https://cdn.acme.com/email-builder/social/brand/x.png
```

A single link can also use its own image through its `icon` prop (**Custom icon** in the inspector).

## Lower-level pieces

For custom pipelines the renderer's parts are exported too: `renderPlainText`, `renderMarkdown`, `renderInlineMarkdown`, `markdownToPlainText`, `escapeHtml`, `safeUrl`, `createRenderContext` and `renderBlock`. See the [API reference](/reference/api#renderer).
