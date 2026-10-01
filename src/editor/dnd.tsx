import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { type ReactNode, useRef, useState } from 'react';
import type { Op } from '../core/ops';
import { BLOCK_DEFINITIONS, type BlockType, canContain } from '../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../core/schema/document';
import { buildSection, SECTIONS, type SectionName } from '../core/sections';
import { descendantIds, findParent } from '../core/tree';
import { useEditorStore } from './context';
import { BLOCK_ICONS } from './meta';
import { Icon } from './ui';

/** What is being dragged. */
export type DragData =
  | { kind: 'new'; blockType: BlockType }
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
          blocks: [{ type: drag.blockType }],
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

/** The drag in progress, if any. */
export function useActiveDrag(): DragData | null {
  const { active } = useDndContext();
  return (active?.data.current as DragData | undefined) ?? null;
}

/** Id of the droppable under the pointer, if any. */
export function useOverId(): string | null {
  const { over } = useDndContext();
  return over ? String(over.id) : null;
}

export function EditorDnd({ children }: { children: ReactNode }) {
  const store = useEditorStore();
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
    store.stopEditing();
  };

  const onDragEnd = (event: DragEndEvent) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    setDragging(null);
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

  const icon = dragging ? BLOCK_ICONS[dragging.blockType] : null;
  const label = dragging
    ? dragging.kind === 'section'
      ? SECTIONS[dragging.section].label
      : BLOCK_DEFINITIONS[dragging.blockType].label
    : '';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        draggingRef.current = null;
        setDragging(null);
      }}
    >
      {children}
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
