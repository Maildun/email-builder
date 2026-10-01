import { Tabs } from '@base-ui/react/tabs';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, LayoutTemplate } from 'lucide-react';
import { summarizeBlock } from '../../agent/outline';
import type { Op } from '../../core/ops';
import {
  BLOCK_DEFINITIONS,
  BLOCK_TYPES,
  type BlockType,
  hasChildren,
} from '../../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { buildSection, SECTION_NAMES, SECTIONS, type SectionName } from '../../core/sections';
import { findParent, walk } from '../../core/tree';
import { useEditorState, useEditorStore, useVisibleDocument } from '../context';
import { type DragData, dropId, useActiveDrag, useOverId } from '../dnd';
import { BLOCK_ICONS } from '../meta';
import type { EditorStore } from '../store';
import { cx } from '../ui';

const CATEGORIES = [
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'layout', label: 'Layout' },
  { id: 'advanced', label: 'Advanced' },
] as const;

/** Where a click-inserted block goes: into the selected container, after the selected block, or at the end. */
export function insertionPoint(
  document: EmailDocument,
  selectedId: string | null,
  type: BlockType,
) {
  if (selectedId && document.blocks[selectedId]) {
    const selected = document.blocks[selectedId];
    if (selected && hasChildren(selected) && selected.type !== 'columns' && type !== 'column') {
      return { parentId: selectedId, index: selected.children.length };
    }
    const parent = findParent(document, selectedId);
    if (parent) {
      const parentType =
        parent.parentId === ROOT_ID ? 'root' : document.blocks[parent.parentId]?.type;
      if (parentType && (parentType !== 'columns' || type === 'column')) {
        return { parentId: parent.parentId, index: parent.index + 1 };
      }
    }
  }
  return { parentId: ROOT_ID, index: document.root.length };
}

function insert(
  store: EditorStore,
  op: (target: { parentId: string; index: number }) => Op,
  type: BlockType,
) {
  const state = store.getState();
  const target = insertionPoint(state.document, state.selectedId, type);
  const result = store.apply(op(target));
  if (result.ok && result.inserted[0]) store.select(result.inserted[0]);
}

function PaletteItem({ type }: { type: BlockType }) {
  const store = useEditorStore();
  const data: DragData = { kind: 'new', blockType: type };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new|${type}`,
    data,
  });
  const Icon = BLOCK_ICONS[type];
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cx('meb-tile', isDragging && 'meb-tile-dragging')}
      title={BLOCK_DEFINITIONS[type].description}
      onClick={() =>
        insert(store, (target) => ({ op: 'insert', ...target, blocks: [{ type }] }), type)
      }
      {...attributes}
      {...listeners}
    >
      <Icon size={18} />
      <span>{BLOCK_DEFINITIONS[type].label}</span>
    </button>
  );
}

function SectionItem({ name }: { name: SectionName }) {
  const store = useEditorStore();
  const blockType = buildSection(name).type;
  const data: DragData = { kind: 'section', section: name, blockType };
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `section|${name}`, data });
  const section = SECTIONS[name];
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="meb-section-item"
      onClick={() =>
        insert(
          store,
          (target) => ({ op: 'insert', ...target, blocks: [buildSection(name)] }),
          blockType,
        )
      }
      {...attributes}
      {...listeners}
    >
      <LayoutTemplate size={16} />
      <span>
        <strong>{section.label}</strong>
        <small>{section.description}</small>
      </span>
    </button>
  );
}

function Palette() {
  return (
    <div className="meb-palette">
      {CATEGORIES.map((category) => {
        const types = BLOCK_TYPES.filter(
          (type) => type !== 'column' && BLOCK_DEFINITIONS[type].category === category.id,
        );
        return (
          <div key={category.id} className="meb-palette-group">
            <h3 className="meb-section-title">{category.label}</h3>
            <div className="meb-tiles">
              {types.map((type) => (
                <PaletteItem key={type} type={type} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="meb-palette-group">
        <h3 className="meb-section-title">Sections</h3>
        <div className="meb-section-list">
          {SECTION_NAMES.map((name) => (
            <SectionItem key={name} name={name} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LayerZone({ id, position }: { id: string; position: 'before' | 'after' | 'inside' }) {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('layer', position, id), disabled: !drag });
  return (
    <div
      ref={setNodeRef}
      className={cx('meb-layer-zone', `meb-layer-zone-${position}`)}
      aria-hidden
    />
  );
}

function LayerRow({ id, depth, document }: { id: string; depth: number; document: EmailDocument }) {
  const store = useEditorStore();
  const selected = useEditorState((state) => state.selectedId === id);
  const changed = useEditorState((state) => state.proposal?.changed.includes(id) ?? false);
  const drag = useActiveDrag();
  const overId = useOverId();
  const block = document.blocks[id];
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `layer-move|${id}`,
    data: { kind: 'move', id, blockType: block?.type ?? 'text' } satisfies DragData,
  });
  if (!block) return null;
  const Icon = BLOCK_ICONS[block.type];
  const summary = summarizeBlock(block);
  const indicator = ['before', 'after', 'inside'].find(
    (position) => overId === dropId('layer', position as 'before', id),
  );

  return (
    <div
      className={cx(
        'meb-layer',
        selected && 'meb-layer-selected',
        changed && 'meb-changed-text',
        indicator && `meb-layer-${indicator}`,
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <button
        ref={setNodeRef}
        type="button"
        className="meb-layer-handle"
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </button>
      <button type="button" className="meb-layer-label" onClick={() => store.select(id)}>
        <Icon size={14} />
        <span className="meb-layer-type">{BLOCK_DEFINITIONS[block.type].label}</span>
        {summary ? (
          <span className="meb-layer-summary">{summary.replace(/^"|"$/g, '')}</span>
        ) : null}
      </button>
      {drag ? (
        <>
          <LayerZone id={id} position="before" />
          <LayerZone id={id} position="after" />
          {hasChildren(block) ? <LayerZone id={id} position="inside" /> : null}
        </>
      ) : null}
    </div>
  );
}

function Layers() {
  const document = useVisibleDocument();
  const rows: Array<{ id: string; depth: number }> = [];
  walk(document, (id, _block, depth) => rows.push({ id, depth }));
  if (rows.length === 0) {
    return <p className="meb-muted meb-pad">No blocks yet.</p>;
  }
  return (
    <div className="meb-layers" role="tree">
      {rows.map((row) => (
        <LayerRow key={row.id} id={row.id} depth={row.depth} document={document} />
      ))}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="meb-sidebar" aria-label="Blocks and layers">
      <Tabs.Root defaultValue="add">
        <Tabs.List className="meb-tabs">
          <Tabs.Tab value="add" className="meb-tab">
            Add
          </Tabs.Tab>
          <Tabs.Tab value="layers" className="meb-tab">
            Layers
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="add" className="meb-panel-scroll">
          <Palette />
        </Tabs.Panel>
        <Tabs.Panel value="layers" className="meb-panel-scroll">
          <Layers />
        </Tabs.Panel>
      </Tabs.Root>
    </aside>
  );
}
