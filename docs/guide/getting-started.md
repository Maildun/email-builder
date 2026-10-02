# Getting started

## Install

::: code-group

```bash [npm]
npm install @maildun/email-builder
```

```bash [pnpm]
pnpm add @maildun/email-builder
```

```bash [bun]
bun add @maildun/email-builder
```

:::

Requirements: Node 20 or newer. The editor needs React 19; the core, renderer and agent modules don't need React at all.

## Show the editor

```tsx
import { useState } from 'react';
import type { EmailDocument } from '@maildun/email-builder';
import { EmailEditor } from '@maildun/email-builder/editor';
import '@maildun/email-builder/styles.css';

export function Compose() {
  const [design, setDesign] = useState<EmailDocument>();

  return (
    <div style={{ height: '100vh' }}>
      <EmailEditor defaultValue={design} onChange={setDesign} />
    </div>
  );
}
```

That's a working editor with drag and drop, inline text editing, an inspector, a mobile preview and undo/redo.

- The editor fills its container, so give the container a height (the minimum is 480px).
- `styles.css` is precompiled and scoped to the editor; you don't need Tailwind. Tailwind CSS 4 apps can use `core.css` instead to share their theme, see [Styling and theming](/editor/styling).
- The editor is a client component (`'use client'` is built in), so it works in the Next.js App Router.

## Start from a template

`TEMPLATES` holds ready-made documents: `blank`, `newsletter` and `announcement`.

```tsx
import { TEMPLATES } from '@maildun/email-builder';

const [design, setDesign] = useState(() => TEMPLATES.newsletter.create());
```

Or build one in code with `createDocument`, which fills in ids and defaults:

```ts
import { buildSection, createDocument } from '@maildun/email-builder';

const design = createDocument({
  settings: { preheader: 'Your order is on its way' },
  theme: { colors: { primary: '#0f766e' } },
  blocks: [
    buildSection('header', { logoAlt: 'Acme' }),
    { type: 'heading', props: { text: 'Thanks for your order, {{ first_name }}!', level: 1 } },
    { type: 'text', props: { markdown: 'We will email you again when it ships.' } },
    buildSection('footer', { company: 'Acme Inc.' }),
  ],
});
```

## Save the design

The document is plain JSON. Store it in your database as-is (a `json`/`jsonb` column works well) and load it back into the editor later:

```tsx
<EmailEditor
  defaultValue={saved}
  onChange={(next) => save(next)}            // every committed change
  onSave={(next) => saveNow(next)}           // ⌘S / Ctrl+S inside the editor
/>
```

`onChange` only fires for committed changes, never for an AI proposal the user hasn't accepted yet.

## Render and send

Render the stored JSON wherever you send email, usually on the server:

```ts
import { renderEmail, validateDocument } from '@maildun/email-builder';

const checked = validateDocument(JSON.parse(row.design));
if (!checked.ok) throw new Error('Invalid design');

const { html, text, warnings } = renderEmail(checked.document);
await mailer.send({ to, subject, html, text });
```

Merge tags such as `{{ first_name }}` stay in the HTML untouched, so your sending platform can fill them in. Not using JavaScript on the server? Use the [CLI](/reference/cli):

```bash
npx email-builder render design.json
```

## Where to next

- Learn the [document model](./document) and the [blocks](/reference/blocks).
- Connect image uploads and merge tags in the [editor](/editor/).
- Let a model design emails with the [agent tools](/ai/agents).
