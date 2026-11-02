import { describe, expect, it } from 'vitest';
import { createDocument } from '../../src';
import { EditorStore, EN_MESSAGES } from '../../src/editor';
import {
  buildSlashItems,
  filterSlashItems,
  findSlashQuery,
  runBlockCommand,
} from '../../src/editor/canvas/slash';

const MERGE_TAGS = [
  { key: 'first_name', label: 'First name' },
  { key: 'plan', label: 'Plan' },
];

const CONDITIONS = [
  { id: 'segment:pro', label: 'Pro customers', group: 'Segments' },
  { id: 'tag:vip', label: 'VIP', group: 'Tags' },
];

function items(overrides: Partial<Parameters<typeof buildSlashItems>[0]> = {}) {
  return buildSlashItems({
    messages: EN_MESSAGES,
    mergeTags: MERGE_TAGS,
    singleLine: false,
    canCreateField: true,
    canPersonalize: true,
    ...overrides,
  });
}

function store() {
  return new EditorStore(
    createDocument({
      blocks: [
        { id: 'intro', type: 'text', props: { markdown: 'Hello' } },
        { id: 'empty', type: 'text', props: { markdown: '' } },
        { id: 'title', type: 'heading', props: { text: 'Title', level: 2 } },
      ],
    }),
  );
}

describe('findSlashQuery', () => {
  it('opens at the start of a line or after a space', () => {
    expect(findSlashQuery('/')).toBe('');
    expect(findSlashQuery('Hello /hea')).toBe('hea');
    expect(findSlashQuery('and/or')).toBeNull();
    expect(findSlashQuery('https://example.com')).toBeNull();
    expect(findSlashQuery('/two words')).toBeNull();
  });
});

describe('buildSlashItems', () => {
  it('offers blocks, a personalized section, the merge fields and Add a field', () => {
    const ids = items().map((item) => item.id);
    expect(ids).toEqual([
      'text',
      'heading-1',
      'heading-2',
      'heading-3',
      'bullets',
      'numbers',
      'quote',
      'divider',
      'image',
      'button',
      'box',
      'html',
      'section',
      'field-first_name',
      'field-plan',
      'add-field',
    ]);
  });

  it('leaves out lists and quotes in headings, hidden block types, Section without reader groups and Add a field without a callback', () => {
    const ids = items({
      singleLine: true,
      blockTypes: ['text', 'heading', 'container'],
      canCreateField: false,
      canPersonalize: false,
    }).map((item) => item.id);
    expect(ids).toEqual([
      'text',
      'heading-1',
      'heading-2',
      'heading-3',
      'box',
      'field-first_name',
      'field-plan',
    ]);
  });
});

describe('filterSlashItems', () => {
  it('matches the start of any word in the label or keywords', () => {
    const ids = (query: string) => filterSlashItems(items(), query).map((item) => item.id);
    expect(ids('h2')).toEqual(['heading-2']);
    expect(ids('pers')).toEqual(['section']);
    expect(ids('first')).toEqual(['field-first_name']);
    expect(ids('zzz')).toEqual([]);
  });
});

describe('runBlockCommand', () => {
  it('adds the new block after a block with content and selects it', () => {
    const editor = store();
    editor.startEditing('intro');
    runBlockCommand(
      editor,
      'intro',
      { kind: 'block', type: 'divider' },
      {
        empty: false,
        conditions: CONDITIONS,
      },
    );
    const { document, selectedId, editingId } = editor.getState();
    expect(document.root).toHaveLength(4);
    expect(document.root[0]).toBe('intro');
    expect(document.blocks[document.root[1] ?? '']?.type).toBe('divider');
    expect(selectedId).toBe(document.root[1]);
    expect(editingId).toBeNull();
  });

  it('turns an empty block into a heading and keeps editing it', () => {
    const editor = store();
    runBlockCommand(
      editor,
      'empty',
      { kind: 'heading', level: 1 },
      {
        empty: true,
        conditions: CONDITIONS,
      },
    );
    const { document, editingId } = editor.getState();
    expect(document.root).toEqual(['intro', 'empty', 'title']);
    expect(document.blocks.empty).toMatchObject({ type: 'heading', props: { level: 1 } });
    expect(editingId).toBe('empty');
  });

  it("changes a heading's level in place", () => {
    const editor = store();
    runBlockCommand(
      editor,
      'title',
      { kind: 'heading', level: 3 },
      {
        empty: false,
        conditions: CONDITIONS,
      },
    );
    expect(editor.getState().document.blocks.title).toMatchObject({
      props: { text: 'Title', level: 3 },
    });
  });

  it('adds a personalized section with a starter rule and edits its text', () => {
    const editor = store();
    runBlockCommand(editor, 'intro', { kind: 'section' }, { empty: false, conditions: CONDITIONS });
    const { document, editingId } = editor.getState();
    const section = document.blocks[document.root[1] ?? ''];
    expect(section).toMatchObject({
      type: 'container',
      props: { visibleIf: { conditions: [{ id: 'segment:pro', label: 'Pro customers' }] } },
    });
    expect(section && 'children' in section ? section.children : []).toEqual([editingId]);
    expect(document.blocks[editingId ?? '']).toMatchObject({
      type: 'text',
      props: { markdown: '' },
    });
  });
});
