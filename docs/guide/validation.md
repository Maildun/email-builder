# Validation and lint

Two checks, for two different questions:

- **`validateDocument`**: *is this a valid document?* Schema and tree integrity. An invalid document can't be rendered.
- **`lintDocument`**: *is this a good email?* Accessibility, deliverability and leftover placeholders. Lint warnings never block rendering.

## Validate

Use it on anything that comes from outside your code: a database row, an API request, a file.

```ts
import { validateDocument } from '@maildun/email-builder';

const result = validateDocument(JSON.parse(input));
if (result.ok) {
  result.document; // typed EmailDocument
} else {
  result.issues;   // [{ path, message, hint?, blockId? }]
}
```

Besides the schema, it checks the tree: every child exists, every block has exactly one parent, there are no cycles or orphans, and parent and child types fit together (for example, only `column` blocks inside `columns`). A `columns` block holds 1–4 columns, container blocks need a `children` array while other blocks can't have one, and `root` can't be used as a block id.

Custom block data isn't checked here; use `validateCustomBlocks` for that.

Want the schema itself? `documentJsonSchema()`, `blockInputJsonSchema()` and `opJsonSchema()` return JSON Schemas, useful for validating in other languages or for structured output.

## Lint

```ts
import { lintDocument } from '@maildun/email-builder';

const warnings = lintDocument(document, { requireUnsubscribe: true });
// [{ code: 'missing-alt', severity: 'warning', message: 'Image has no alt text.', blockId: 'hero-img' }]
```

| Code | Severity | When |
| --- | --- | --- |
| `empty-document` | warning | The email has no blocks. |
| `missing-preheader` | info | No preheader; inboxes show the first words of the body instead. |
| `missing-unsubscribe` | warning | With `requireUnsubscribe`: no `{{ unsubscribe_url }}` link. |
| `missing-alt` | warning | An image, video or avatar has no alt text. |
| `missing-src` | warning | An image or avatar has no URL, or a video has no thumbnail. |
| `missing-href` | warning | A button or video has no link, or a social block has no links. |
| `empty-button` | warning | A button has no label. |
| `low-contrast` | warning | Text contrast is below `minContrast`. |
| `placeholder-content` | warning | `placehold.co`, `example.com`, lorem ipsum, or social links that still point to a network's home page. |
| `empty-container` | info | A container or column has no blocks. |

Options:

| Option | Default | Description |
| --- | --- | --- |
| `requireUnsubscribe` | `false` | Warn when no unsubscribe link exists. Set it for marketing email. |
| `unsubscribeTag` | `'unsubscribe_url'` | The merge tag your platform uses for the unsubscribe link. |
| `minContrast` | `4.5` | Minimum WCAG contrast ratio for text. |

A good place to lint is right before sending, or as a checklist next to your "Send" button. The agent tool `check_email` runs it too, so models can fix their own warnings.
