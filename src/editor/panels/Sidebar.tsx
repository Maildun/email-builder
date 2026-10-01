import { useDraggable, useDroppable } from '@dnd-kit/core';
import { DragDropVerticalIcon, LayoutTemplateIcon } from '@hugeicons/core-free-icons';
import type { ReactNode } from 'react';
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
import { useEditorState, useEditorStore, useSlotClassName, useVisibleDocument } from '../context';
import { type DragData, dropId, useActiveDrag, useOverId } from '../dnd';
import { BLOCK_ICONS } from '../meta';
import type { EditorStore } from '../store';
import { cn, Icon, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';

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
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-slot="palette-item"
      data-dragging={isDragging || undefined}
      className="group/tile flex h-16 cursor-grab touch-none flex-col items-center justify-center gap-1.5 rounded-md border bg-card px-1 py-1.5 text-[11px] font-medium text-foreground outline-none transition-[background-color,border-color,opacity] hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:opacity-50"
      title={BLOCK_DEFINITIONS[type].description}
      onClick={() =>
        insert(store, (target) => ({ op: 'insert', ...target, blocks: [{ type }] }), type)
      }
      {...attributes}
      {...listeners}
    >
      <Icon
        icon={BLOCK_ICONS[type]}
        className="size-4.5 text-muted-foreground group-hover/tile:text-foreground"
      />
      <span className="max-w-full truncate">{BLOCK_DEFINITIONS[type].label}</span>
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
      data-slot="section-item"
      className="flex cursor-grab touch-none items-start gap-2.5 rounded-md border bg-card p-2.5 text-left text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
      <Icon icon={LayoutTemplateIcon} className="mt-px size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <strong className="text-sm font-medium">{section.label}</strong>
        <small className="text-xs text-muted-foreground">{section.description}</small>
      </span>
    </button>
  );
}

function PaletteGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section data-slot="palette-group" className="flex flex-col gap-2.5 pt-3.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      {children}
    </section>
  );
}

function Palette() {
  return (
    <div data-slot="palette" className="px-3 pt-1 pb-4">
      {CATEGORIES.map((category) => {
        const types = BLOCK_TYPES.filter(
          (type) => type !== 'column' && BLOCK_DEFINITIONS[type].category === category.id,
        );
        return (
          <PaletteGroup key={category.id} label={category.label}>
            <div className="grid grid-cols-3 gap-1.5">
              {types.map((type) => (
                <PaletteItem key={type} type={type} />
              ))}
            </div>
          </PaletteGroup>
        );
      })}
      <PaletteGroup label="Sections">
        <div className="flex flex-col gap-1.5">
          {SECTION_NAMES.map((name) => (
            <SectionItem key={name} name={name} />
          ))}
        </div>
      </PaletteGroup>
    </div>
  );
}

const ZONE_POSITION = {
  before: 'top-0 h-[30%]',
  after: 'bottom-0 h-[30%]',
  inside: 'top-[30%] h-[40%]',
} as const;

function LayerZone({ id, position }: { id: string; position: 'before' | 'after' | 'inside' }) {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('layer', position, id), disabled: !drag });
  return (
    <div
      ref={setNodeRef}
      className={cn('pointer-events-none absolute inset-x-0', ZONE_POSITION[position])}
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
  const summary = summarizeBlock(block);
  const indicator = ['before', 'after', 'inside'].find(
    (position) => overId === dropId('layer', position as 'before', id),
  );

  return (
    <li
      data-slot="layer"
      data-selected={selected || undefined}
      data-changed={changed || undefined}
      data-indicator={indicator}
      className="group/layer relative flex h-7.5 items-center gap-0.5 rounded-sm pr-2 not-data-selected:hover:bg-muted data-selected:bg-accent data-selected:text-accent-foreground data-[indicator=after]:shadow-[inset_0_-2px_0_var(--color-editor-selection)] data-[indicator=before]:shadow-[inset_0_2px_0_var(--color-editor-selection)] data-[indicator=inside]:shadow-[inset_0_0_0_2px_var(--color-editor-selection)]"
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <button
        ref={setNodeRef}
        type="button"
        className="flex cursor-grab touch-none rounded-sm p-0.5 text-muted-foreground opacity-0 outline-none group-hover/layer:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
      >
        <Icon icon={DragDropVerticalIcon} className="size-3" />
      </button>
      <button
        type="button"
        aria-current={selected || undefined}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => store.select(id)}
      >
        <Icon icon={BLOCK_ICONS[block.type]} className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium group-data-changed/layer:text-editor-ai">
          {BLOCK_DEFINITIONS[block.type].label}
        </span>
        {summary ? (
          <span className="truncate text-muted-foreground">{summary.replace(/^"|"$/g, '')}</span>
        ) : null}
      </button>
      {drag ? (
        <>
          <LayerZone id={id} position="before" />
          <LayerZone id={id} position="after" />
          {hasChildren(block) ? <LayerZone id={id} position="inside" /> : null}
        </>
      ) : null}
    </li>
  );
}

function Layers() {
  const document = useVisibleDocument();
  const rows: Array<{ id: string; depth: number }> = [];
  walk(document, (id, _block, depth) => rows.push({ id, depth }));
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No blocks yet.</p>;
  }
  return (
    <ul data-slot="layers" aria-label="Layers" className="flex flex-col px-1 pt-1.5 pb-3">
      {rows.map((row) => (
        <LayerRow key={row.id} id={row.id} depth={row.depth} document={document} />
      ))}
    </ul>
  );
}

export function Sidebar() {
  const className = useSlotClassName('sidebar');
  return (
    <aside
      data-slot="sidebar"
      aria-label="Blocks and layers"
      className={cn('hidden min-h-0 flex-col border-r bg-card @3xl/editor:flex', className)}
    >
      <Tabs defaultValue="add" className="min-h-0 flex-1 gap-0">
        <TabsList
          variant="line"
          className="w-full flex-none justify-start border-b px-2 pt-1 group-data-horizontal/tabs:h-10"
        >
          <TabsTrigger value="add" className="flex-none px-2.5">
            Add
          </TabsTrigger>
          <TabsTrigger value="layers" className="flex-none px-2.5">
            Layers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="add" className="min-h-0 overflow-y-auto">
          <Palette />
        </TabsContent>
        <TabsContent value="layers" className="min-h-0 overflow-y-auto">
          <Layers />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
