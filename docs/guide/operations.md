# Operations

Every change to a document is an **operation**. The editor uses them for drag and drop and the inspector, agents use them through tools, and you can use them in your own code. Because there is one path for every change, everything is validated the same way and can be undone, replayed or reviewed.

```ts
import { applyOps, createDocument } from '@maildun/email-builder';

const doc = createDocument({
  blocks: [
    { type: 'heading', props: { text: 'Hello' } },
    {
      type: 'columns',
      children: [
        { type: 'column', children: [{ type: 'text' }] },
        { type: 'column', children: [{ type: 'image', props: { src: 'https://…', alt: 'Product' } }] },
      ],
    },
  ],
});

const result = applyOps(doc, [
  { op: 'insert', parentId: 'root', index: 0, blocks: [{ id: 'logo', type: 'image', props: { src: 'https://…', alt: 'Acme' } }] },
  { op: 'update', id: 'logo', style: { align: 'center' } },
]);

if (result.ok) {
  result.document; // the new document
  result.inserted; // ['logo']
  result.changed;  // ids whose content, style or position changed
  result.removed;  // ids that were removed
} else {
  result.issues;   // [{ path, message, hint?, blockId?, opIndex? }]
}
```

## How operations behave

- **Atomic.** If any op in a batch fails, nothing changes and you get the issues. The input document is never mutated.
- **Complete.** A failing op doesn't stop the batch from being checked: you get the issues of every failing op at once, each with its `opIndex`. An op that targets a block an earlier failed op would have created gets a hint naming that op. When every op succeeds but the result breaks a document rule, those final issues have no `opIndex`.
- **Validated.** The result is checked against the schema and the tree rules (placement, no orphans, no cycles) before it's returned.
- **Nested input.** Inserted blocks can include their children. Missing ids are filled in, and the block's default props and style are merged under yours. In a `columns` block, children that aren't `column` blocks are wrapped in one, and an empty `columns` gets two columns.
- **Structural sharing.** Unchanged blocks, the theme and settings keep their object identity, so UIs can skip re-rendering them.

## The operations

| Op | Shape | What it does |
| --- | --- | --- |
| `insert` | `{ op, parentId?, index?, blocks }` | Inserts blocks (with nested children) into `parentId` (default `root`) at `index` (default: the end; an index past the end is clamped). |
| `update` | `{ op, id, props?, style? }` | Merges keys into a block's props and/or style. `null` removes a key so the default applies. |
| `move` | `{ op, id, parentId, index? }` | Moves a block, with its children, to another parent or position. Fails when the target is the block itself or one of its descendants. |
| `remove` | `{ op, id }` | Removes a block and all its descendants. Refuses the last `column` of a `columns` block; remove the `columns` block instead. |
| `duplicate` | `{ op, id }` | Copies a block, with its children, right after itself. |
| `replace` | `{ op, id, block }` | Replaces a block in place with new content. Keeps the original id unless `block.id` is given. |
| `updateSettings` | `{ op, settings }` | Merges keys into `settings`. `null` removes an optional key. |
| `updateTheme` | `{ op, colors?, fonts? }` | Merges theme colors and fonts. Every block using `$tokens` follows. Theme keys can't be removed. |
| `replaceDocument` | `{ op, document }` | Replaces everything, with a full document (one with `version`, which must be valid as is) or `{ settings?, theme?, blocks }` built on an empty document. |

`parentId` is the id of a `container`, a `column`, a `columns` block (for inserting or moving `column` blocks), or `"root"` for the document body.

`applyOps` takes one op or an array. `applyOpsMaterialized` takes an array and, on success, also returns the `ops` it applied.

## Errors that explain themselves

Issues are written for both developers and models. Each has a dot `path` to the problem, a `message`, and a `hint` when a fix is known:

```ts
applyOps(doc, { op: 'update', id: 'cta', props: { url: 'https://acme.com' } });
// {
//   ok: false,
//   issues: [{
//     path: 'props.url',
//     message: 'Unknown key "url".',
//     hint: 'Did you mean "href"?',
//     blockId: 'cta',
//     opIndex: 0,
//   }]
// }
```

`formatIssues(issues)` turns a list into readable text.

## Custom blocks

Pass your [custom block](./custom-blocks) definitions so their data is validated too:

```ts
applyOps(doc, ops, { customBlocks: [productCard] });
```

## Replaying operations

`applyOpsMaterialized(doc, ops)` applies ops one at a time and returns them with every generated id made explicit (and `duplicate` turned into an `insert`), so replaying the returned `ops` gives exactly the same document. The agent tools use it so a model's changes can be replayed in the editor as a [proposal](/ai/editor-review).

## Reading the tree

Helpers for walking a document:

| Function | Returns |
| --- | --- |
| `walk(doc, visit)` | Visits every block depth-first: `visit(id, block, depth, parentId)` |
| `findParent(doc, id)` | `{ parentId, index }`, or `undefined` |
| `childrenOf(doc, parentId)` | Child ids of a container or `root`, or `undefined` |
| `descendantIds(doc, id)` | The block's id and every id inside it |
| `ancestorIds(doc, id)` | Ids of the containers above a block, nearest first |
| `toBlockInput(doc, id, keepIds = true)` | A block as nested input, e.g. to copy it. Pass `false` to drop the ids. Throws if the block doesn't exist. |

Next: [validate and lint](./validation) documents you receive.
