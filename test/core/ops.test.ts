import { describe, expect, it } from 'vitest';
import {
  applyOps,
  blockInputJsonSchema,
  createDocument,
  documentJsonSchema,
  type EmailDocument,
  lintDocument,
  opJsonSchema,
  ROOT_ID,
  TEMPLATES,
  validateDocument,
} from '../../src';

function ok(result: ReturnType<typeof applyOps>): EmailDocument {
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }
  return result.document;
}

describe('createDocument', () => {
  it('builds a valid document from nested blocks with defaults filled in', () => {
    const doc = createDocument({
      blocks: [
        { id: 'title', type: 'heading', props: { text: 'Hello' } },
        {
          type: 'columns',
          children: [
            { type: 'column', children: [{ type: 'text', props: { markdown: 'Left' } }] },
            { type: 'column', children: [{ type: 'button' }] },
          ],
        },
      ],
    });

    expect(validateDocument(doc).ok).toBe(true);
    expect(doc.root[0]).toBe('title');
    expect(doc.blocks.title).toMatchObject({ type: 'heading', props: { text: 'Hello', level: 2 } });
    const columns = doc.blocks[doc.root[1] as string];
    expect(columns?.type).toBe('columns');
    expect(columns && 'children' in columns ? columns.children : []).toHaveLength(2);
  });

  it('wraps non-column children of a columns block in columns', () => {
    const doc = createDocument({
      blocks: [{ type: 'columns', children: [{ type: 'text' }, { type: 'image' }] }],
    });
    const columns = doc.blocks[doc.root[0] as string];
    if (columns?.type !== 'columns') throw new Error('expected columns');
    expect(columns.children.map((id) => doc.blocks[id]?.type)).toEqual(['column', 'column']);
  });

  it('gives an empty columns block two columns', () => {
    const doc = createDocument({ blocks: [{ type: 'columns' }] });
    const columns = doc.blocks[doc.root[0] as string];
    expect(columns && 'children' in columns ? columns.children : []).toHaveLength(2);
  });

  it('builds every template', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(validateDocument(template.create()).ok).toBe(true);
    }
  });
});

describe('applyOps', () => {
  const base = () =>
    createDocument({
      blocks: [
        { id: 'a', type: 'text', props: { markdown: 'A' } },
        { id: 'box', type: 'container', children: [{ id: 'b', type: 'button' }] },
      ],
    });

  it('keeps unchanged parts of the document referentially equal', () => {
    const before = base();
    const after = ok(applyOps(before, { op: 'update', id: 'a', props: { markdown: 'Changed' } }));
    expect(after.blocks.a).not.toBe(before.blocks.a);
    expect(after.blocks.box).toBe(before.blocks.box);
    expect(after.blocks.b).toBe(before.blocks.b);
    expect(after.root).toBe(before.root);
    expect(after.theme).toBe(before.theme);
    expect(after.settings).toBe(before.settings);

    const moved = ok(applyOps(after, { op: 'move', id: 'a', parentId: 'box', index: 0 }));
    expect(moved.blocks.box).not.toBe(after.blocks.box);
    expect(moved.root).not.toBe(after.root);
    expect(moved.blocks.b).toBe(after.blocks.b);
  });

  it('inserts at an index and reports inserted ids', () => {
    const result = applyOps(base(), {
      op: 'insert',
      parentId: ROOT_ID,
      index: 1,
      blocks: [{ id: 'new', type: 'divider' }],
    });
    const doc = ok(result);
    expect(doc.root).toEqual(['a', 'new', 'box']);
    expect(result.ok && result.inserted).toEqual(['new']);
  });

  it('inserts into a container', () => {
    const doc = ok(
      applyOps(base(), { op: 'insert', parentId: 'box', blocks: [{ type: 'spacer' }] }),
    );
    const box = doc.blocks.box;
    expect(box && 'children' in box ? box.children.length : 0).toBe(2);
  });

  it('updates props, and null removes a key', () => {
    let doc = ok(
      applyOps(base(), { op: 'update', id: 'b', props: { text: 'Buy', href: '{{ shop_url }}' } }),
    );
    expect(doc.blocks.b?.props).toMatchObject({ text: 'Buy', href: '{{ shop_url }}' });
    doc = ok(applyOps(doc, { op: 'update', id: 'b', props: { href: null } }));
    expect(doc.blocks.b?.props).not.toHaveProperty('href');
  });

  it('rejects unknown keys with an alias hint', () => {
    const result = applyOps(base(), { op: 'update', id: 'b', props: { url: 'https://x.com' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({ opIndex: 0, hint: 'Did you mean "href"?' });
    }
  });

  it('rejects unsafe URLs', () => {
    const result = applyOps(base(), {
      op: 'update',
      id: 'b',
      props: { href: 'javascript:alert(1)' },
    });
    expect(result.ok).toBe(false);
  });

  it('moves across parents and refuses moving into a descendant', () => {
    const doc = ok(applyOps(base(), { op: 'move', id: 'a', parentId: 'box', index: 0 }));
    expect(doc.root).toEqual(['box']);
    const box = doc.blocks.box;
    expect(box && 'children' in box ? box.children : []).toEqual(['a', 'b']);
    expect(applyOps(doc, { op: 'move', id: 'box', parentId: 'box' }).ok).toBe(false);
  });

  it('removes a block together with its descendants (no orphans)', () => {
    const result = applyOps(base(), { op: 'remove', id: 'box' });
    const doc = ok(result);
    expect(Object.keys(doc.blocks)).toEqual(['a']);
    expect(result.ok && result.removed.sort()).toEqual(['b', 'box']);
  });

  it('refuses to remove the last column', () => {
    const doc = createDocument({
      blocks: [{ type: 'columns', children: [{ id: 'only', type: 'column' }] }],
    });
    expect(applyOps(doc, { op: 'remove', id: 'only' }).ok).toBe(false);
  });

  it('duplicates a subtree with fresh ids right after the original', () => {
    const result = applyOps(base(), { op: 'duplicate', id: 'box' });
    const doc = ok(result);
    expect(doc.root).toHaveLength(3);
    expect(doc.root[2]).not.toBe('box');
    expect(result.ok && result.inserted).toHaveLength(2);
  });

  it('replaces a block in place, keeping its id', () => {
    const doc = ok(
      applyOps(base(), {
        op: 'replace',
        id: 'a',
        block: { type: 'heading', props: { text: 'Hi' } },
      }),
    );
    expect(doc.root[0]).toBe('a');
    expect(doc.blocks.a?.type).toBe('heading');
  });

  it('enforces placement rules', () => {
    expect(applyOps(base(), { op: 'insert', blocks: [{ type: 'column' }] }).ok).toBe(false);
    expect(applyOps(base(), { op: 'insert', parentId: 'a', blocks: [{ type: 'text' }] }).ok).toBe(
      false,
    );
    expect(
      applyOps(createDocument(), {
        op: 'insert',
        blocks: [{ type: 'columns', children: [{ type: 'column' }] }],
      }).ok,
    ).toBe(true);
  });

  it('allows a columns row nested inside a column', () => {
    const nested = applyOps(createDocument(), {
      op: 'insert',
      blocks: [
        { type: 'columns', children: [{ type: 'column', children: [{ type: 'columns' }] }] },
      ],
    });
    expect(nested.ok).toBe(true);
  });

  it('rejects duplicate ids', () => {
    expect(applyOps(base(), { op: 'insert', blocks: [{ id: 'a', type: 'text' }] }).ok).toBe(false);
  });

  it('is atomic: a failing op leaves the document untouched', () => {
    const doc = base();
    const snapshot = structuredClone(doc);
    const result = applyOps(doc, [
      { op: 'insert', blocks: [{ type: 'text' }] },
      { op: 'remove', id: 'missing' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.opIndex).toBe(1);
    expect(doc).toEqual(snapshot);
  });

  it('updates settings and theme with validation', () => {
    const doc = ok(
      applyOps(base(), [
        { op: 'updateSettings', settings: { preheader: 'Hi', width: 640 } },
        { op: 'updateTheme', colors: { primary: '#ff5500' } },
      ]),
    );
    expect(doc.settings).toMatchObject({ preheader: 'Hi', width: 640 });
    expect(doc.theme.colors.primary).toBe('#ff5500');
    expect(applyOps(doc, { op: 'updateTheme', colors: { primary: '$text' } }).ok).toBe(false);
  });

  it('replaces the whole document from a tree', () => {
    const result = applyOps(base(), {
      op: 'replaceDocument',
      document: { settings: { preheader: 'New' }, blocks: [{ type: 'heading' }] },
    });
    const doc = ok(result);
    expect(doc.root).toHaveLength(1);
    expect(result.ok && result.removed.sort()).toEqual(['a', 'b', 'box']);
  });
});

describe('validateDocument', () => {
  it('detects missing children, orphans and duplicates', () => {
    const doc = createDocument({ blocks: [{ id: 'a', type: 'text' }] });
    const broken = structuredClone(doc) as EmailDocument;
    broken.root.push('ghost', 'a');
    broken.blocks.orphan = { type: 'spacer', props: {} };
    const result = validateDocument(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const messages = result.issues.map((issue) => issue.message).join('\n');
      expect(messages).toContain('does not exist');
      expect(messages).toContain('more than once');
      expect(messages).toContain('orphan');
    }
  });
});

describe('lintDocument', () => {
  it('flags accessibility and deliverability problems', () => {
    const doc = createDocument({
      blocks: [
        { type: 'image', props: { src: 'https://cdn.test/a.png', alt: '' } },
        { type: 'text', props: { markdown: 'Faint' }, style: { color: '#eeeeee' } },
      ],
    });
    const codes = lintDocument(doc, { requireUnsubscribe: true }).map((warning) => warning.code);
    expect(codes).toEqual(
      expect.arrayContaining(['missing-alt', 'low-contrast', 'missing-unsubscribe']),
    );
  });
});

describe('JSON Schema export', () => {
  it('produces schemas for documents, block input and ops', () => {
    expect(documentJsonSchema()).toHaveProperty('type', 'object');
    expect(JSON.stringify(blockInputJsonSchema())).toContain('stackOnMobile');
    expect(JSON.stringify(opJsonSchema())).toContain('replaceDocument');
  });
});
