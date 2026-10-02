# Translations

Every piece of UI text in the editor comes from `messages`. Pass only what you translate or reword; everything else stays English.

```tsx
<EmailEditor
  messages={{
    topBar: { design: 'Desain', preview: 'Pratinjau', undo: 'Urungkan' },
    toast: { deleted: (label) => `${label} dihapus`, undo: 'Urungkan' },
    blocks: { text: { label: 'Teks' }, divider: { label: 'Pemisah' } },
    inspector: { fields: { Padding: 'Jarak dalam', Alignment: 'Perataan' } },
  }}
/>
```

- **Messages with values are functions**, like `deleted: (label) => …`.
- **`inspector.fields`** translates inspector labels and options by their English text.
- **`EN_MESSAGES`** holds every key with its English text. Use it as a checklist, and the `EditorMessages` type to type-check a full translation.
- **Inline objects are fine.** Messages are compared by content, so a new object on every render doesn't cost anything. Keep message functions pure: they're compared by source, so a function whose output depends on a variable it closes over won't update when only that variable changes.

Message groups: `common`, `topBar`, `sidebar`, `palette`, `layers`, `canvas`, `blockToolbar`, `inspector`, `proposal`, `toast`, `preview`, `code`, `formatBar`, plus `blocks` and `sections` for palette labels and descriptions.

```ts
import { EN_MESSAGES, type EditorMessages } from '@maildun/email-builder/editor';

export const id: EditorMessages = {
  ...EN_MESSAGES,
  topBar: { ...EN_MESSAGES.topBar, design: 'Desain', preview: 'Pratinjau' },
  // …
};
```

Validation messages from the core stay English, since agents read them too.
