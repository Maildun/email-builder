import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Add01Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Copy01Icon,
  CornerLeftUpIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  SquareDashedIcon,
} from '@hugeicons/core-free-icons';
import DOMPurify from 'dompurify';
import {
  type CSSProperties,
  type MouseEvent,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { BLOCK_DEFINITIONS, type Block, hasChildren } from '../../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { resolvePadding } from '../../core/schema/primitives';
import { findParent } from '../../core/tree';
import { boxDeclarations, columnWidths, renderBlock, typeDeclarations } from '../../render/blocks';
import { createRenderContext, innerWidth, type RenderContext } from '../../render/context';
import { duplicateBlock, removeBlock } from '../actions';
import {
  useEditorOptions,
  useEditorState,
  useEditorStore,
  useSlotClassName,
  useVisibleDocument,
} from '../context';
import { dropId, resolveDrop, useActiveDrag, useOverId } from '../dnd';
import { BLOCK_ICONS } from '../meta';
import { Button, cn, Icon, Tip } from '../ui';
import { InlineText } from './InlineText';

const MOBILE_WIDTH = 375;
/** Toolbar height plus a small gap. */
const TOOLBAR_SPACE = 32;
/**
 * Ghost buttons on the selection-colored block toolbar. The dark hover is
 * restated so it replaces the ghost variant's own dark hover.
 */
const TOOLBAR_BUTTON =
  'text-white hover:bg-white/20 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white dark:hover:bg-white/20';

/** Converts `font-size: 16px` style declarations to a React style object. */
export function toReactStyle(
  declarations: Record<string, string | number | undefined | false>,
): CSSProperties {
  const style: Record<string, string | number> = {};
  for (const [property, value] of Object.entries(declarations)) {
    if (value === undefined || value === false || value === '') continue;
    style[property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())] = value;
  }
  return style as CSSProperties;
}

const subscribeNever = () => () => {};

/** False while rendering on the server and during hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

const LeafHtml = memo(function LeafHtml({ html }: { html: string }) {
  return <div className="meb-leaf" dangerouslySetInnerHTML={{ __html: html }} />;
});

function DropZone({
  position,
  id,
  edge,
}: {
  position: 'before' | 'after';
  id: string;
  edge?: boolean;
}) {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('canvas', position, id), disabled: !drag });
  return (
    <div
      ref={setNodeRef}
      className="meb-drop-zone"
      data-position={position}
      data-edge={edge || undefined}
      aria-hidden
    />
  );
}

function InsideZone({ id }: { id: string }) {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('canvas', 'inside', id), disabled: !drag });
  return <div ref={setNodeRef} className="meb-drop-zone" data-position="inside" aria-hidden />;
}

function EmptySlot({ parentId, label }: { parentId: string; label: string }) {
  const overId = useOverId();
  const over = overId === dropId('canvas', 'inside', parentId);
  return (
    <div
      data-slot="empty-slot"
      data-over={over || undefined}
      className="m-1 flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-current/30 border-dashed font-sans text-current/55 text-xs data-[over]:border-editor-selection data-[over]:bg-editor-selection-soft data-[over]:text-editor-selection"
    >
      <Icon icon={Add01Icon} className="size-3.5" /> {label}
    </div>
  );
}

function BlockToolbar({ id, block }: { id: string; block: Block }) {
  const store = useEditorStore();
  const document = useEditorState((state) => state.document);
  const parent = findParent(document, id);
  const siblings = parent
    ? parent.parentId === ROOT_ID
      ? document.root
      : (() => {
          const parentBlock = document.blocks[parent.parentId];
          return parentBlock && hasChildren(parentBlock) ? parentBlock.children : [];
        })()
    : [];
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `move|${id}`,
    data: { kind: 'move', id, blockType: block.type },
  });
  const move = (delta: number) => {
    if (!parent) return;
    store.apply({ op: 'move', id, parentId: parent.parentId, index: parent.index + delta });
  };
  const stop = (event: MouseEvent) => event.stopPropagation();

  // The toolbar sits above the block so it never covers the block's content,
  // and flips below it when there is no room at the top of the canvas.
  const toolbar = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    const blockElement = toolbar.current?.parentElement;
    const backdrop = blockElement?.closest('.meb-backdrop');
    if (!blockElement || !backdrop) return;
    const room = blockElement.getBoundingClientRect().top - backdrop.getBoundingClientRect().top;
    setBelow(room < TOOLBAR_SPACE);
  });

  return (
    <div
      ref={toolbar}
      data-slot="block-toolbar"
      className={cn(
        'meb-block-toolbar absolute -top-[30px] left-[-2px] z-5 flex h-7 items-center gap-px rounded-md rounded-bl-none bg-editor-selection px-0.5 font-sans text-white text-xs leading-none shadow-md',
        'data-[placement=bottom]:top-[calc(100%+2px)] data-[placement=bottom]:rounded-bl-md data-[placement=bottom]:rounded-tl-none',
        useSlotClassName('block-toolbar'),
      )}
      data-placement={below ? 'bottom' : 'top'}
      onClick={stop}
      onDoubleClick={stop}
    >
      <Button
        ref={setNodeRef}
        variant="ghost"
        size="xs"
        className={cn(TOOLBAR_BUTTON, 'cursor-grab touch-none gap-1 pr-1.5 pl-0.5 font-semibold')}
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
      >
        <Icon icon={DragDropVerticalIcon} data-icon="inline-start" />
        <Icon icon={BLOCK_ICONS[block.type]} data-icon="inline-start" />
        <span>{BLOCK_DEFINITIONS[block.type].label}</span>
      </Button>
      {parent && parent.parentId !== ROOT_ID ? (
        <Tip label="Select parent">
          <Button
            size="icon-xs"
            variant="ghost"
            className={TOOLBAR_BUTTON}
            aria-label="Select parent"
            onClick={() => store.selectParent()}
          >
            <Icon icon={CornerLeftUpIcon} />
          </Button>
        </Tip>
      ) : null}
      <Tip label="Move up">
        <Button
          size="icon-xs"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          aria-label="Move up"
          disabled={!parent || parent.index === 0}
          onClick={() => move(-1)}
        >
          <Icon icon={ArrowUp02Icon} />
        </Button>
      </Tip>
      <Tip label="Move down">
        <Button
          size="icon-xs"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          aria-label="Move down"
          disabled={!parent || parent.index >= siblings.length - 1}
          onClick={() => move(1)}
        >
          <Icon icon={ArrowDown02Icon} />
        </Button>
      </Tip>
      <Tip label="Duplicate">
        <Button
          size="icon-xs"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          aria-label="Duplicate"
          onClick={(event) => duplicateBlock(store, id, event.currentTarget)}
        >
          <Icon icon={Copy01Icon} />
        </Button>
      </Tip>
      <Tip label="Delete">
        <Button
          size="icon-xs"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          aria-label="Delete"
          onClick={(event) => removeBlock(store, id, event.currentTarget)}
        >
          <Icon icon={Delete02Icon} />
        </Button>
      </Tip>
    </div>
  );
}

interface BlockViewProps {
  id: string;
  ctx: RenderContext;
  available: number;
  mobile: boolean;
}

function BlockView({ id, ctx, available, mobile }: BlockViewProps) {
  const store = useEditorStore();
  const { readOnly } = useEditorOptions();
  const block = ctx.document.blocks[id];
  const selected = useEditorState((state) => state.selectedId === id);
  const editing = useEditorState((state) => state.editingId === id);
  const changed = useEditorState((state) => state.proposal?.changed.includes(id) ?? false);
  const proposing = useEditorState((state) => state.proposal !== null);
  const drag = useActiveDrag();
  const overId = useOverId();
  const hydrated = useHydrated();

  const leafHtml = useMemo(() => {
    if (!block || hasChildren(block)) return '';
    // DOMPurify needs a DOM, so raw HTML blocks render empty on the server.
    if (block.type === 'html') {
      return hydrated ? DOMPurify.sanitize(renderBlock(ctx, id, available)) : '';
    }
    return renderBlock(ctx, id, available);
  }, [ctx, id, block, available, hydrated]);

  if (!block) return null;

  const interactive = !readOnly && !proposing;
  const isContainer = hasChildren(block);
  const indicator =
    overId === dropId('canvas', 'before', id)
      ? 'before'
      : overId === dropId('canvas', 'after', id)
        ? 'after'
        : overId === dropId('canvas', 'inside', id)
          ? 'inside'
          : null;
  const dragged = drag?.kind === 'move' && drag.id === id;

  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (!interactive) return;
    if (selected && (block.type === 'text' || block.type === 'heading')) {
      store.startEditing(id);
    } else {
      store.select(id);
    }
  };
  const onDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (interactive && (block.type === 'text' || block.type === 'heading')) store.startEditing(id);
  };

  let content: React.ReactNode;
  if (editing && (block.type === 'text' || block.type === 'heading')) {
    const box = toReactStyle(boxDeclarations(ctx, block.style));
    const type =
      block.type === 'heading'
        ? toReactStyle({
            ...typeDeclarations(ctx, block.style, {
              fontFamily: ctx.headingFont,
              fontSize: ({ 1: 32, 2: 24, 3: 20 } as const)[block.props.level ?? 2],
              fontWeight: 'bold',
            }),
            'line-height': String(block.style?.lineHeight ?? 1.25),
          })
        : toReactStyle(typeDeclarations(ctx, block.style));
    content = (
      <InlineText
        value={block.type === 'heading' ? (block.props.text ?? '') : (block.props.markdown ?? '')}
        singleLine={block.type === 'heading'}
        style={{ ...box, ...type, ['--meb-link' as string]: ctx.linkColor }}
        onChange={(markdown) =>
          store.apply(
            {
              op: 'update',
              id,
              props: block.type === 'heading' ? { text: markdown } : { markdown },
            },
            { mergeKey: `${id}.inline` },
          )
        }
        onDone={() => store.stopEditing()}
      />
    );
  } else if (isContainer) {
    content = (
      <ContainerView id={id} block={block} ctx={ctx} available={available} mobile={mobile} />
    );
  } else {
    content = <LeafHtml html={leafHtml} />;
  }

  return (
    <div
      className="meb-block"
      data-block-id={id}
      data-block-type={block.type}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      data-changed={changed || undefined}
      data-dragged={dragged || undefined}
      data-indicator={indicator ?? undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {content}
      {interactive && selected && !editing ? <BlockToolbar id={id} block={block} /> : null}
      {drag ? (
        <>
          <DropZone position="before" id={id} edge={isContainer} />
          <DropZone position="after" id={id} edge={isContainer} />
          {isContainer ? <InsideZone id={id} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ContainerView({
  id,
  block,
  ctx,
  available,
  mobile,
}: BlockViewProps & { block: Extract<Block, { children: string[] }> }) {
  const width = innerWidth(available, block.style?.padding, block.style?.border);
  const boxStyle = toReactStyle(boxDeclarations(ctx, block.style));
  const { readOnly } = useEditorOptions();

  if (block.type === 'columns') {
    const widths = columnWidths(ctx, block, available);
    const gap = block.props.gap ?? 0;
    const stack = mobile && (block.props.stackOnMobile ?? true);
    const align = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[
      block.props.verticalAlign ?? 'top'
    ];
    return (
      <div style={boxStyle}>
        <div
          className="flex"
          style={{
            gap: stack ? 16 : gap,
            flexDirection: stack ? 'column' : 'row',
            alignItems: stack ? 'stretch' : align,
          }}
        >
          {block.children.map((childId, index) => (
            <div
              key={childId}
              className="min-w-0"
              style={
                stack ? undefined : { flex: `0 0 ${widths[index] ?? 0}px`, maxWidth: widths[index] }
              }
            >
              <BlockView
                id={childId}
                ctx={ctx}
                available={stack ? width : (widths[index] ?? 0)}
                mobile={mobile}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...boxStyle, minHeight: block.children.length === 0 ? 48 : undefined }}>
      {block.children.map((childId) => (
        <BlockView key={childId} id={childId} ctx={ctx} available={width} mobile={mobile} />
      ))}
      {block.children.length === 0 && !readOnly ? (
        <EmptySlot
          parentId={id}
          label={block.type === 'column' ? 'Drop blocks here' : 'Empty container'}
        />
      ) : null}
    </div>
  );
}

function RootDropZone() {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('canvas', 'inside', ROOT_ID), disabled: !drag });
  return <div ref={setNodeRef} className="meb-drop-zone" data-position="inside" aria-hidden />;
}

export function Canvas({ onAddFirst }: { onAddFirst?: () => void }) {
  const store = useEditorStore();
  const document: EmailDocument = useVisibleDocument();
  const viewport = useEditorState((state) => state.viewport);
  const { readOnly } = useEditorOptions();
  const drag = useActiveDrag();
  const overId = useOverId();
  const ctx = useMemo(() => createRenderContext(document), [document]);
  const mobile = viewport === 'mobile';
  const width = mobile ? MOBILE_WIDTH : document.settings.width;
  const { settings } = document;
  const outer = resolvePadding(settings.padding);
  const canvasBorder = ctx.color(settings.borderColor);
  const rootOver = overId === dropId('canvas', 'inside', ROOT_ID);
  const slotClassName = useSlotClassName('canvas');
  const validRootDrop = drag
    ? resolveDrop(store.getState().document, drag, 'inside', ROOT_ID) !== null
    : false;

  return (
    <div
      data-slot="canvas"
      className={cn('meb-canvas-scroll min-h-0 flex-1 overflow-auto', slotClassName)}
      style={{ background: ctx.color(settings.backdropColor, '$background') }}
      onClick={() => store.select(null)}
    >
      <div
        className="meb-backdrop min-h-full px-6 py-8"
        style={{
          paddingTop: outer.top,
          // Leave room for the floating assistant so the end of the email stays reachable.
          paddingBottom: `calc(${outer.bottom}px + var(--meb-overlay-space, 0px))`,
        }}
      >
        <div
          className="meb-email data-[drop-target]:outline-2 data-[drop-target]:outline-editor-selection data-[drop-target]:outline-offset-4 data-[drop-target]:outline-dashed"
          data-viewport={viewport}
          data-drop-target={(rootOver && validRootDrop) || undefined}
          style={{
            maxWidth: width,
            background: ctx.color(settings.canvasColor, '$surface'),
            borderRadius: settings.borderRadius,
            border: canvasBorder ? `1px solid ${canvasBorder}` : undefined,
            fontFamily: ctx.font(undefined),
            fontSize: ctx.fontSize,
            lineHeight: ctx.lineHeight,
            color: ctx.textColor,
          }}
        >
          {document.root.map((id) => (
            <BlockView key={id} id={id} ctx={ctx} available={width} mobile={mobile} />
          ))}
          {document.root.length === 0 && !readOnly ? (
            <div
              data-slot="empty-email"
              className="flex flex-col items-center gap-4 px-6 py-16 text-center font-sans text-sm"
            >
              <div className="flex max-w-sm flex-col items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon icon={SquareDashedIcon} className="size-5" />
                </div>
                <p className="font-medium">Your email is empty.</p>
                <p className="text-pretty text-muted-foreground">
                  Drag blocks or sections here, click one in the sidebar, or ask the assistant.
                </p>
              </div>
              {onAddFirst ? (
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddFirst();
                  }}
                >
                  <Icon icon={Add01Icon} data-icon="inline-start" /> Add a text block
                </Button>
              ) : null}
            </div>
          ) : null}
          {drag ? <RootDropZone /> : null}
        </div>
      </div>
    </div>
  );
}
