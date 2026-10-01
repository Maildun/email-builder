import { describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../src';
import { EditorStore } from '../../src/editor';

const doc = () =>
  createDocument({
    blocks: [
      { id: 'a', type: 'text' },
      { id: 'b', type: 'button' },
    ],
  });

describe('EditorStore', () => {
  it('applies ops as undoable steps and notifies listeners', () => {
    const store = new EditorStore(doc());
    const listener = vi.fn();
    const changed = vi.fn();
    store.subscribe(listener);
    store.onDocumentChange = changed;

    expect(store.apply({ op: 'remove', id: 'a' }).ok).toBe(true);
    expect(store.getState().document.root).toEqual(['b']);
    expect(store.getState().canUndo).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);

    store.undo();
    expect(store.getState().document.root).toEqual(['a', 'b']);
    store.redo();
    expect(store.getState().document.root).toEqual(['b']);
  });

  it('coalesces rapid edits with the same merge key into one history step', () => {
    const store = new EditorStore(doc());
    for (const text of ['H', 'He', 'Hey']) {
      store.apply({ op: 'update', id: 'a', props: { markdown: text } }, { mergeKey: 'a.markdown' });
    }
    store.undo();
    expect(store.getState().document.blocks.a?.props).toMatchObject({
      markdown: 'Write something people want to read.',
    });
    expect(store.getState().canUndo).toBe(false);
  });

  it('records issues for rejected ops without changing the document', () => {
    const store = new EditorStore(doc());
    const before = store.getState().document;
    const result = store.apply({ op: 'update', id: 'b', props: { href: 'javascript:x' } });
    expect(result.ok).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().lastIssues.length).toBeGreaterThan(0);
  });

  it('stages proposals without committing until accepted', () => {
    const store = new EditorStore(doc());
    const changed = vi.fn();
    store.onDocumentChange = changed;
    store.propose([{ op: 'update', id: 'a', props: { markdown: 'AI copy' } }], {
      summary: 'Rewrote intro',
    });
    store.propose([{ op: 'insert', blocks: [{ id: 'c', type: 'divider' }] }]);

    const { proposal, document } = store.getState();
    expect(proposal?.changed.sort()).toEqual(['a', 'c']);
    expect(proposal?.summary).toBe('Rewrote intro');
    expect(document.blocks.c).toBeUndefined();
    expect(store.visibleDocument().blocks.c).toBeDefined();
    expect(changed).not.toHaveBeenCalled();

    store.accept();
    expect(store.getState().document.blocks.c).toBeDefined();
    expect(store.getState().proposal).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);

    store.undo();
    expect(store.getState().document.blocks.c).toBeUndefined();
  });

  it('undo discards a pending proposal without touching history', () => {
    const store = new EditorStore(doc());
    store.apply({ op: 'remove', id: 'b' });
    store.undo();
    expect(store.getState().canRedo).toBe(true);

    store.propose([{ op: 'update', id: 'a', props: { markdown: 'AI copy' } }]);
    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().canRedo).toBe(false);
    store.redo();
    expect(store.getState().document.root).toEqual(['a', 'b']);

    store.undo();
    expect(store.getState().proposal).toBeNull();
    expect(store.getState().document.root).toEqual(['a', 'b']);
    expect(store.getState().canRedo).toBe(true);
  });

  it('discards rejected proposals', () => {
    const store = new EditorStore(doc());
    store.propose([{ op: 'remove', id: 'a' }]);
    store.reject();
    expect(store.getState().proposal).toBeNull();
    expect(store.getState().document.root).toEqual(['a', 'b']);
  });

  it('clears selection when the selected block disappears', () => {
    const store = new EditorStore(doc());
    store.select('a');
    store.apply({ op: 'remove', id: 'a' });
    expect(store.getState().selectedId).toBeNull();
  });
});
