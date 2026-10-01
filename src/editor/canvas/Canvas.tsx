import { useDraggable, useDroppable } from '@dnd-kit/core';
import DOMPurify from 'dompurify';
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, GripVertical, Plus, Trash } from 'lucide-react';
import { type CSSProperties, type MouseEvent, memo, useMemo } from 'react';
import { BLOCK_DEFINITIONS, type Block, hasChildren } from '../../core/schema/blocks';
import { type EmailDocument, ROOT_ID } from '../../core/schema/document';
import { resolvePadding } from '../../core/schema/primitives';
import { findParent } from '../../core/tree';
import { boxDeclarations, columnWidths, renderBlock, typeDeclarations } from '../../render/blocks';
import { createRenderContext, innerWidth, type RenderContext } from '../../render/context';
import { useEditorOptions, useEditorState, useEditorStore, useVisibleDocument } from '../context';
import { dropId, resolveDrop, useActiveDrag, useOverId } from '../dnd';
import { BLOCK_ICONS } from '../meta';
import { Button, cx, Tip } from '../ui';
import { InlineText } from './InlineText';

const MOBILE_WIDTH = 375;

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
      className={cx('meb-drop-zone', `meb-drop-${position}`, edge && 'meb-drop-edge')}
      aria-hidden
    />
  );
}

function InsideZone({ id }: { id: string }) {
  const drag = useActiveDrag();
  const { setNodeRef } = useDroppable({ id: dropId('canvas', 'inside', id), disabled: !drag });
  return <div ref={setNodeRef} className="meb-drop-inside-zone" aria-hidden />;
}

function EmptySlot({ parentId, label }: { parentId: string; label: string }) {
  const overId = useOverId();
  const over = overId === dropId('canvas', 'inside', parentId);
  return (
    <div className={cx('meb-empty-slot', over && 'meb-empty-slot-over')}>
      <Plus size={14} /> {label}
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
  const Icon = BLOCK_ICONS[block.type];
  const move = (delta: number) => {
    if (!parent) return;
    store.apply({ op: 'move', id, parentId: parent.parentId, index: parent.index + delta });
  };
  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className="meb-block-toolbar" onClick={stop} onDoubleClick={stop}>
      <button
        ref={setNodeRef}
        type="button"
        className="meb-block-handle"
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} />
        <Icon size={13} />
        <span>{BLOCK_DEFINITIONS[block.type].label}</span>
      </button>
      {parent && parent.parentId !== ROOT_ID ? (
        <Tip label="Select parent">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Select parent"
            onClick={() => store.selectParent()}
          >
            <CornerLeftUp size={13} />
          </Button>
        </Tip>
      ) : null}
      <Tip label="Move up">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Move up"
          disabled={!parent || parent.index === 0}
          onClick={() => move(-1)}
        >
          <ArrowUp size={13} />
        </Button>
      </Tip>
      <Tip label="Move down">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Move down"
          disabled={!parent || parent.index >= siblings.length - 1}
          onClick={() => move(1)}
        >
          <ArrowDown size={13} />
        </Button>
      </Tip>
      <Tip label="Duplicate">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Duplicate"
          onClick={() => store.apply({ op: 'duplicate', id })}
        >
          <Copy size={13} />
        </Button>
      </Tip>
      <Tip label="Delete">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete"
          onClick={() => store.apply({ op: 'remove', id })}
        >
          <Trash size={13} />
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

  const leafHtml = useMemo(() => {
    if (!block || hasChildren(block)) return '';
    const html = renderBlock(ctx, id, available);
    return block.type === 'html' ? DOMPurify.sanitize(html) : html;
  }, [ctx, id, block, available]);

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
      className={cx(
        'meb-block',
        `meb-block-${block.type}`,
        selected && 'meb-selected',
        editing && 'meb-editing',
        changed && 'meb-changed',
        dragged && 'meb-dragged',
        indicator && `meb-indicator-${indicator}`,
      )}
      data-block-id={id}
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
          className="meb-columns-row"
          style={{
            gap: stack ? 16 : gap,
            flexDirection: stack ? 'column' : 'row',
            alignItems: stack ? 'stretch' : align,
          }}
        >
          {block.children.map((childId, index) => (
            <div
              key={childId}
              className="meb-column-cell"
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
  return <div ref={setNodeRef} className="meb-drop-inside-zone" aria-hidden />;
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
  const validRootDrop = drag
    ? resolveDrop(store.getState().document, drag, 'inside', ROOT_ID) !== null
    : false;

  return (
    <div
      className="meb-canvas-scroll"
      style={{ background: ctx.color(settings.backdropColor, '$background') }}
      onClick={() => store.select(null)}
    >
      <div className="meb-backdrop" style={{ paddingTop: outer.top, paddingBottom: outer.bottom }}>
        <div
          className={cx(
            'meb-email',
            mobile && 'meb-email-mobile',
            rootOver && validRootDrop && 'meb-root-over',
          )}
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
            <div className="meb-empty-email">
              <p>Your email is empty.</p>
              <p className="meb-muted">
                Drag blocks or sections here, click one in the sidebar, or ask the assistant.
              </p>
              {onAddFirst ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddFirst();
                  }}
                >
                  <Plus size={14} /> Add a text block
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
