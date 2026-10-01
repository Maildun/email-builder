import { useDraggable, useDroppable } from '@dnd-kit/core';
import { DragDropVerticalIcon } from '@hugeicons/core-free-icons';
import { type ReactNode, useMemo } from 'react';
import { summarizeBlock } from '../../agent/outline';
import type { Op } from '../../core/ops';
import {
  BLOCK_DEFINITIONS,
  BLOCK_TYPES,
  type BlockType,
  hasChildren,
} from '../../core/schema/blocks';
import { type BlockInput, type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { buildSection, SECTION_NAMES, type SectionName } from '../../core/sections';
import { findParent, walk } from '../../core/tree';
import {
  type EditorOptions,
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useMessages,
  useSlotClassName,
  useVisibleDocument,
} from '../context';
import { type DragData, dropId, useActiveDrag, useDropIndicator } from '../dnd';
import type { BlockCategory } from '../messages';
import { BLOCK_ICONS, blockIcon, blockLabel } from '../meta';
import type { EditorStore } from '../store';
import { cn, Icon, type IconSvgElement, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';
import { SectionThumb } from './SectionThumb';

const CATEGORIES: readonly BlockCategory[] = ['content', 'media', 'layout', 'advanced'];

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

interface PaletteProps {
  /** Distinguishes several palettes on screen (drag ids must be unique). */
  surface?: string;
  /** Called after a click inserts a block, e.g. to close a popover. */
  onInsert?: () => void;
}

type Align = 'left' | 'center' | 'right';

const TEXT_TYPES = new Set<BlockType>(['text', 'heading']);

/** New text follows the alignment of the text it is inserted after (e.g. a centered hero). */
function inheritedStyle(store: EditorStore, type: BlockType): { align: Align } | undefined {
  if (!TEXT_TYPES.has(type)) return undefined;
  const { document, selectedId } = store.getState();
  const selected = selectedId ? document.blocks[selectedId] : undefined;
  if (!selected || !TEXT_TYPES.has(selected.type)) return undefined;
  const align = (selected.style as { align?: Align } | undefined)?.align;
  return align ? { align } : undefined;
}

/** Something the palette can insert: a built-in block type or a custom block. */
interface PaletteEntry {
  id: string;
  label: string;
  description: string;
  icon: IconSvgElement;
  blockType: BlockType;
  input: BlockInput;
  category: BlockCategory;
}

function paletteEntries(options: EditorOptions): PaletteEntry[] {
  const builtIn = BLOCK_TYPES.filter(
    (type) =>
      type !== 'column' &&
      type !== 'custom' &&
      (!options.blockTypes || options.blockTypes.includes(type)),
  ).map(
    (type): PaletteEntry => ({
      id: type,
      label: options.messages.blocks[type].label,
      description: options.messages.blocks[type].description,
      icon: BLOCK_ICONS[type],
      blockType: type,
      input: { type } as BlockInput,
      category: BLOCK_DEFINITIONS[type].category,
    }),
  );
  const custom = options.customBlocks.map(
    (definition): PaletteEntry => ({
      id: `custom:${definition.name}`,
      label: definition.label,
      description: definition.description,
      icon: (definition.icon as IconSvgElement | undefined) ?? BLOCK_ICONS.custom,
      blockType: 'custom',
      input: { type: 'custom', props: { name: definition.name, data: definition.defaults } },
      category: definition.category ?? 'advanced',
    }),
  );
  return [...builtIn, ...custom];
}

function PaletteItem({ entry, surface, onInsert }: PaletteProps & { entry: PaletteEntry }) {
  const store = useEditorStore();
  const data: DragData = {
    kind: 'new',
    blockType: entry.blockType,
    input: entry.input,
    label: entry.label,
    icon: entry.icon,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${surface}:new|${entry.id}`,
    data,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-slot="palette-item"
      data-dragging={isDragging || undefined}
      className="group/tile flex h-16 cursor-grab touch-none flex-col items-center justify-center gap-1.5 rounded-md border bg-card px-1 py-1.5 text-[11px] font-medium text-foreground outline-none transition-[background-color,border-color,opacity] hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:opacity-50"
      title={entry.description}
      onClick={() => {
        const style = inheritedStyle(store, entry.blockType);
        insert(
          store,
          (target) => ({
            op: 'insert',
            ...target,
            blocks: [{ ...entry.input, ...(style ? { style } : {}) } as BlockInput],
          }),
          entry.blockType,
        );
        onInsert?.();
      }}
      {...attributes}
      {...listeners}
    >
      <Icon
        icon={entry.icon}
        className="size-4.5 text-muted-foreground group-hover/tile:text-foreground"
      />
      <span className="max-w-full truncate">{entry.label}</span>
    </button>
  );
}

function SectionItem({ name, surface, onInsert }: PaletteProps & { name: SectionName }) {
  const store = useEditorStore();
  const blockType = buildSection(name).type;
  const data: DragData = { kind: 'section', section: name, blockType };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${surface}:section|${name}`,
    data,
  });
  const section = useMessages().sections[name];
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-slot="section-item"
      data-dragging={isDragging || undefined}
      className="group/section flex cursor-grab touch-none flex-col gap-1.5 rounded-md p-1 pb-1.5 text-left text-foreground outline-none transition-[background-color,opacity] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:opacity-50"
      title={section.description}
      onClick={() => {
        insert(
          store,
          (target) => ({ op: 'insert', ...target, blocks: [buildSection(name)] }),
          blockType,
        );
        onInsert?.();
      }}
      {...attributes}
      {...listeners}
    >
      <SectionThumb name={name} />
      <span className="truncate px-0.5 text-xs font-medium">{section.label}</span>
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

/** Blocks and sections to add. Click inserts after the selection; drag drops anywhere. */
export function Palette({ surface = 'sidebar', onInsert }: PaletteProps) {
  const options = useEditorOptions();
  const entries = useMemo(() => paletteEntries(options), [options]);
  const sections = options.sections ?? SECTION_NAMES;
  const text = options.messages.palette;
  return (
    <div data-slot="palette" className="px-3 pt-1 pb-4">
      {CATEGORIES.map((category) => {
        const inCategory = entries.filter((entry) => entry.category === category);
        if (!inCategory.length) return null;
        return (
          <PaletteGroup key={category} label={text.categories[category]}>
            <div className="grid grid-cols-3 gap-1.5">
              {inCategory.map((entry) => (
                <PaletteItem key={entry.id} entry={entry} surface={surface} onInsert={onInsert} />
              ))}
            </div>
          </PaletteGroup>
        );
      })}
      {sections.length ? (
        <PaletteGroup label={text.sections}>
          <div className="grid grid-cols-2 gap-1">
            {sections.map((name) => (
              <SectionItem key={name} name={name} surface={surface} onInsert={onInsert} />
            ))}
          </div>
        </PaletteGroup>
      ) : null}
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
  const dragging = useActiveDrag() !== null;
  const indicator = useDropIndicator('layer', id) ?? undefined;
  const { customBlockMap: custom, messages } = useEditorOptions();
  const block = document.blocks[id];
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `layer-move|${id}`,
    data: { kind: 'move', id, blockType: block?.type ?? 'text' } satisfies DragData,
  });
  if (!block) return null;
  const summary = summarizeBlock(block);

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
        aria-label={messages.common.dragToMove}
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
        <Icon icon={blockIcon(block, custom)} className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium group-data-changed/layer:text-editor-ai">
          {blockLabel(block, custom, messages)}
        </span>
        {summary ? (
          <span className="truncate text-muted-foreground">{summary.replace(/^"|"$/g, '')}</span>
        ) : null}
      </button>
      {dragging ? (
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
  const text = useMessages().layers;
  const rows: Array<{ id: string; depth: number }> = [];
  walk(document, (id, _block, depth) => rows.push({ id, depth }));
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{text.empty}</p>;
  }
  return (
    <ul data-slot="layers" aria-label={text.label} className="flex flex-col px-1 pt-1.5 pb-3">
      {rows.map((row) => (
        <LayerRow key={row.id} id={row.id} depth={row.depth} document={document} />
      ))}
    </ul>
  );
}

export function Sidebar() {
  const className = useSlotClassName('sidebar');
  const text = useMessages().sidebar;
  return (
    <aside
      data-slot="sidebar"
      aria-label={text.label}
      className={cn('hidden min-h-0 flex-col border-r bg-card @3xl/editor:flex', className)}
    >
      <Tabs defaultValue="add" className="min-h-0 flex-1 gap-0">
        <div className="flex-none border-b px-3 py-2">
          <TabsList className="w-full group-data-horizontal/tabs:h-8">
            <TabsTrigger value="add">{text.addTab}</TabsTrigger>
            <TabsTrigger value="layers">{text.layersTab}</TabsTrigger>
          </TabsList>
        </div>
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
