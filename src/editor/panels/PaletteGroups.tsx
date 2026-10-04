import { useDraggable } from '@dnd-kit/core';
import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { applyOps } from '../../core/ops';
import type { BlockInput } from '../../core/schema/document';
import { renderEmail } from '../../render/html';
import { useEditorOptions, useEditorState, useEditorStore } from '../context';
import type { DragData } from '../dnd';
import { BLOCK_ICONS } from '../meta';
import { cn } from '../ui';

/** Something a host-defined palette group offers, e.g. a section the user saved. */
export interface PaletteGroupItem {
  /** Unique within its group. */
  id: string;
  label: string;
  /** Tooltip text. */
  description?: string;
  /** Inserted on click (after the selection) or drop. Ids are dropped, so every insert gets fresh ones. */
  blocks: BlockInput[];
  /** Replaces the default thumbnail, a small render of the blocks in the email's theme. */
  thumbnail?: ReactNode;
  /** Controls shown over the item on hover, e.g. a menu to rename or delete it. */
  actions?: ReactNode;
}

/** A group of items the host adds to the palette, beside the built-in blocks and sections. */
export interface PaletteGroup {
  /** Unique among the groups; also part of the drag ids. */
  id: string;
  label: string;
  items: PaletteGroupItem[];
  /** Where the group goes. Default `end`, after the built-in sections. */
  position?: 'start' | 'beforeSections' | 'end';
  /** Controls beside the group's heading, e.g. "Save selection". */
  actions?: ReactNode;
  /** Shown when there are no items. Without it, an empty group is hidden. */
  empty?: ReactNode;
}

export const PaletteGroupsContext = createContext<readonly PaletteGroup[]>([]);

export function usePaletteGroups(position: NonNullable<PaletteGroup['position']>) {
  return useContext(PaletteGroupsContext).filter(
    (group) => (group.position ?? 'end') === position && (group.items.length > 0 || group.empty),
  );
}

/** Each insert gets fresh ids, so an item can go into the same email more than once. */
export function withoutIds(block: BlockInput): BlockInput {
  const { id: _id, ...rest } = block as BlockInput & { id?: string };
  const children = (rest as { children?: BlockInput[] }).children;
  return (children ? { ...rest, children: children.map(withoutIds) } : rest) as BlockInput;
}

/** The blocks on their own, rendered with the email's theme and settings, scaled to the tile. */
function BlocksThumb({ blocks, label }: { blocks: BlockInput[]; label: string }) {
  const { customBlocks, assetsUrl } = useEditorOptions();
  const theme = useEditorState((state) => state.document.theme);
  const settings = useEditorState((state) => state.document.settings);
  const store = useEditorStore();
  const html = useMemo(() => {
    const base = { ...store.getState().document, theme, settings, root: [], blocks: {} };
    const result = applyOps(
      base,
      { op: 'insert', blocks: blocks.map(withoutIds) },
      { customBlocks },
    );
    if (!result.ok) return '';
    try {
      return renderEmail(result.document, { customBlocks, assetsUrl }).html;
    } catch {
      return '';
    }
  }, [store, blocks, theme, settings, customBlocks, assetsUrl]);
  const width = settings.width;
  const frame = useRef<HTMLDivElement>(null);
  const [tileWidth, setTileWidth] = useState(0);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    setTileWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTileWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frame}
      className="pointer-events-none relative h-16 w-full overflow-hidden rounded-sm border bg-card"
    >
      {html && tileWidth ? (
        <iframe
          title={label}
          aria-hidden
          tabIndex={-1}
          sandbox=""
          srcDoc={html}
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{ width, height: width, transform: `scale(${tileWidth / width})` }}
        />
      ) : null}
    </div>
  );
}

export function PaletteGroupTile({
  group,
  item,
  surface,
  onInsert,
}: {
  group: PaletteGroup;
  item: PaletteGroupItem;
  surface: string;
  onInsert: (blocks: BlockInput[]) => void;
}) {
  const blocks = useMemo(() => item.blocks.map(withoutIds), [item.blocks]);
  const blockType = blocks[0]?.type ?? 'container';
  const data: DragData = {
    kind: 'new',
    blockType,
    blocks,
    label: item.label,
    icon: BLOCK_ICONS[blockType],
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${surface}:group|${group.id}|${item.id}`,
    data,
  });

  return (
    <div
      data-slot="palette-group-item"
      data-dragging={isDragging || undefined}
      className="group/item relative data-dragging:opacity-50"
    >
      <button
        ref={setNodeRef}
        type="button"
        className="flex w-full cursor-grab touch-none flex-col gap-1.5 rounded-md p-1 pb-1.5 text-left text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        title={item.description ?? item.label}
        onClick={() => onInsert(blocks)}
        {...attributes}
        {...listeners}
      >
        {item.thumbnail ?? <BlocksThumb blocks={blocks} label={item.label} />}
        <span className={cn('truncate px-0.5 text-xs font-medium', item.actions && 'pr-6')}>
          {item.label}
        </span>
      </button>
      {item.actions ? (
        <div className="absolute right-1 bottom-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100">
          {item.actions}
        </div>
      ) : null}
    </div>
  );
}
