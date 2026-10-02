# Migrating from EmailBuilder.js

Designs made with [EmailBuilder.js](https://github.com/usewaypoint/email-builder-js) (`@usewaypoint/email-builder`) convert with one call. A good pattern is to convert when a design is opened, so old and new designs can live side by side in your database:

```ts
import { fromEmailBuilderJs, isEmailBuilderJsDocument } from '@maildun/email-builder/compat';

function openDesign(stored: unknown) {
  if (isEmailBuilderJsDocument(stored)) {
    const { document, warnings } = fromEmailBuilderJs(stored);
    if (warnings.length > 0) console.warn(warnings);
    return document;
  }
  return stored as EmailDocument;
}
```

Save the converted document the next time the user saves, and it's migrated.

## How the import works

- **Ids** are kept where they're valid, so links to blocks survive.
- **Layout.** The `EmailLayout` root becomes the document's settings and theme (backdrop, canvas, text color, font).
- **Columns.** The fixed three-slot `ColumnsContainer` becomes a `columns` block with `column` children.
- **Fonts.** The nine font presets have the same keys and stacks, so text looks the same.
- **Text.** Plain text is escaped so it renders literally. Markdown text that the restricted renderer can't express (tables, images, raw HTML) becomes an `html` block.
- **Dropped content.** Hidden or unattached blocks, unsupported block types and invalid values are dropped, with a warning for each. An invalid value only drops that key; the rest of the block survives.

`fromEmailBuilderJs` throws when the input has no `EmailLayout` root; check with `isEmailBuilderJsDocument` first.

## Side by side

| EmailBuilder.js | Email Builder |
| --- | --- |
| `renderToStaticMarkup(document, { rootBlockId: 'root' })` | `renderEmail(document)` (also returns plain text) |
| MUI-based editor app | `<EmailEditor>` component with shadcn/ui styling |
| Blocks keyed in one object, `root` is an `EmailLayout` | `root` array of ids, settings and theme at the top |
| `ColumnsContainer` with three fixed slots | `columns` with 1–4 `column` children |
| Colors are hex values | Hex values or theme tokens like `$primary` |
