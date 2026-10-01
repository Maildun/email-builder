import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Op } from '../core/ops';
import { type BlockType, canContain } from '../core/schema/blocks';
import { type BlockInput, type EmailDocument, ROOT_ID } from '../core/schema/document';
import { buildSection, type SectionName } from '../core/sections';
import { descendantIds, findParent } from '../core/tree';
import { useEditorOptions, useEditorStore } from './context';
import { BLOCK_ICONS, blockIcon, blockLabel } from './meta';
import { Icon, type IconSvgElement } from './ui';

/** What is being dragged. */
export type DragData =
  | {
      kind: 'new';
      blockType: BlockType;
      /** The block to insert; defaults to `{ type: blockType }`. */
      input?: BlockInput;
      label?: string;
      icon?: IconSvgElement;
    }
  | { kind: 'section'; section: SectionName; blockType: BlockType }
  | { kind: 'move'; id: string; blockType: BlockType };

export type DropPosition = 'before' | 'after' | 'inside';

/** Droppable ids look like `surface|position|blockId`. */
export function dropId(surface: string, position: DropPosition, id: string): string {
  return `${surface}|${position}|${id}`;
}

export function parseDropId(value: string | number): { position: DropPosition; id: string } | null {
  const [, position, id] = String(value).split('|');
  if (!id || (position !== 'before' && position !== 'after' && position !== 'inside')) return null;
  return { position, id };
}

interface Target {
  parentId: string;
  index: number;
}

/** Resolves a drop position to a parent and index, or null when not allowed. */
export function resolveDrop(
  document: EmailDocument,
  drag: DragData,
  position: DropPosition,
  id: string,
): Target | null {
  let target: Target;
  if (position === 'inside') {
    const children =
      id === ROOT_ID
        ? document.root
        : (() => {
            const block = document.blocks[id];
            return block && 'children' in block ? block.children : null;
          })();
    if (!children) return null;
    target = { parentId: id, index: children.length };
  } else {
    const parent = findParent(document, id);
    if (!parent) return null;
    target = { parentId: parent.parentId, index: parent.index + (position === 'after' ? 1 : 0) };
  }

  const parentType = target.parentId === ROOT_ID ? 'root' : document.blocks[target.parentId]?.type;
  if (!parentType || !canContain(parentType, drag.blockType)) return null;

  if (drag.kind === 'move') {
    if (target.parentId !== ROOT_ID && descendantIds(document, drag.id).includes(target.parentId)) {
      return null;
    }
    const from = findParent(document, drag.id);
    if (from && from.parentId === target.parentId && from.index < target.index) {
      target = { ...target, index: target.index - 1 };
    }
    if (from && from.parentId === target.parentId && from.index === target.index) {
      return null;
    }
  }
  return target;
}

function opsForDrop(drag: DragData, target: Target): Op[] {
  switch (drag.kind) {
    case 'move':
      return [{ op: 'move', id: drag.id, parentId: target.parentId, index: target.index }];
    case 'new':
      return [
        {
          op: 'insert',
          parentId: target.parentId,
          index: target.index,
          blocks: [drag.input ?? ({ type: drag.blockType } as BlockInput)],
        },
      ];
    case 'section':
      return [
        {
          op: 'insert',
          parentId: target.parentId,
          index: target.index,
          blocks: [buildSection(drag.section)],
        },
      ];
  }
}

interface DragSnapshot {
  active: DragData | null;
  overId: string | null;
}

/**
 * The drag in progress, kept outside dnd-kit's context so components can
 * subscribe to just the part they show: hovering a new drop target only
 * re-renders the blocks whose indicator changes, not the whole canvas.
 */
class DragState {
  private snapshot: DragSnapshot = { active: null, overId: null };
  private readonly listeners = new Set<() => void>();

  get = (): DragSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(partial: Partial<DragSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of this.listeners) listener();
  }
}

const DragStateContext = createContext<DragState | null>(null);
const noDrag: DragSnapshot = { active: null, overId: null };
const subscribeNever = () => () => {};

function useDragState<T>(selector: (snapshot: DragSnapshot) => T): T {
  const state = useContext(DragStateContext);
  return useSyncExternalStore(
    state?.subscribe ?? subscribeNever,
    () => selector(state?.get() ?? noDrag),
    () => selector(noDrag),
  );
}

/** The drag in progress, if any. */
export function useActiveDrag(): DragData | null {
  return useDragState((snapshot) => snapshot.active);
}

/** Whether the pointer is over this droppable. */
export function useIsOver(droppableId: string): boolean {
  return useDragState((snapshot) => snapshot.overId === droppableId);
}

/** Where a drop on this block of `surface` would land, for showing an indicator. */
export function useDropIndicator(surface: string, id: string): DropPosition | null {
  return useDragState((snapshot) => {
    for (const position of ['before', 'after', 'inside'] as const) {
      if (snapshot.overId === dropId(surface, position, id)) return position;
    }
    return null;
  });
}

export function EditorDnd({ children }: { children: ReactNode }) {
  const store = useEditorStore();
  const [dragState] = useState(() => new DragState());
  const [dragging, setDragging] = useState<DragData | null>(null);
  const draggingRef = useRef<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /** Smallest valid droppable under the pointer wins (deepest block). */
  const collision: CollisionDetection = (args) => {
    const drag = draggingRef.current;
    if (!drag) return [];
    const document = store.getState().document;
    const area = (id: string | number) => {
      const rect = args.droppableRects.get(id);
      return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
    };
    return pointerWithin(args)
      .filter((collision) => {
        const parsed = parseDropId(collision.id);
        return parsed ? resolveDrop(document, drag, parsed.position, parsed.id) !== null : false;
      })
      .sort((a, b) => area(a.id) - area(b.id))
      .slice(0, 1);
  };

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    draggingRef.current = data ?? null;
    setDragging(data ?? null);
    dragState.set({ active: data ?? null, overId: null });
    store.stopEditing();
  };

  const onDragOver = (event: DragOverEvent) => {
    dragState.set({ overId: event.over ? String(event.over.id) : null });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    setDragging(null);
    dragState.set(noDrag);
    if (!drag || !event.over) return;
    const parsed = parseDropId(event.over.id);
    if (!parsed) return;
    const target = resolveDrop(store.getState().document, drag, parsed.position, parsed.id);
    if (!target) return;
    const result = store.apply(opsForDrop(drag, target));
    if (result.ok) {
      store.select(drag.kind === 'move' ? drag.id : (result.inserted[0] ?? null));
    }
  };

  const { customBlockMap: custom, messages } = useEditorOptions();
  const moving = dragging?.kind === 'move' ? store.getState().document.blocks[dragging.id] : null;
  const icon = !dragging
    ? null
    : moving
      ? blockIcon(moving, custom)
      : dragging.kind === 'new' && dragging.icon
        ? dragging.icon
        : BLOCK_ICONS[dragging.blockType];
  const label = !dragging
    ? ''
    : dragging.kind === 'section'
      ? messages.sections[dragging.section].label
      : moving
        ? blockLabel(moving, custom, messages)
        : dragging.kind === 'new' && dragging.label
          ? dragging.label
          : messages.blocks[dragging.blockType].label;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        draggingRef.current = null;
        setDragging(null);
        dragState.set(noDrag);
      }}
    >
      <DragStateContext.Provider value={dragState}>{children}</DragStateContext.Provider>
      <DragOverlay dropAnimation={null}>
        {dragging && icon ? (
          <div
            data-slot="drag-chip"
            className="inline-flex h-7 cursor-grabbing items-center gap-1.5 whitespace-nowrap rounded-md bg-editor-selection px-2 font-medium font-sans text-white text-xs shadow-md"
          >
            <Icon icon={icon} className="size-3.5" /> {label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
