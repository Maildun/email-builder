import {
  BracesIcon,
  Cancel01Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from '@hugeicons/core-free-icons';
import { Link } from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorOptions, useEditorStore } from '../context';
import { Button, cn, Icon, Input, Popover, Separator, Tip } from '../ui';
import { SlashMenu } from './SlashMenu';
import {
  buildSlashItems,
  filterSlashItems,
  findSlashQuery,
  runBlockCommand,
  type SlashItem,
} from './slash';

const MERGE_LINK_HOST = 'https://meb-merge.invalid/';

/** The "/" menu's tallest size, in px. */
const SLASH_MENU_HEIGHT = 420;

/** Ghost format-bar buttons; `aria-pressed` marks the active formatting. */
const FORMAT_BUTTON = 'aria-pressed:bg-muted aria-pressed:text-foreground';

function GroupSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-0.5 data-vertical:h-5 data-vertical:self-center"
    />
  );
}

/** Merge tags are not valid markdown link targets; swap them for URLs while editing. */
function toEditorMarkdown(markdown: string): string {
  return markdown.replace(
    /\]\(\s*\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}\s*\)/g,
    (_match, key: string) => `](${MERGE_LINK_HOST}${key})`,
  );
}

/**
 * The markdown serializer escapes characters that could be formatting, like
 * the `_` in `{{ first_name }}`. Inside a merge tag they never are; unescape
 * them so the tag stays exactly what the sending platform expects.
 */
const ESCAPED_MERGE_TAG = /\\?\{\\?\{((?:\\.|[^{}])*?)\\?\}\\?\}/g;

export function fromEditorMarkdown(markdown: string): string {
  return markdown
    .replace(ESCAPED_MERGE_TAG, (_match, inner: string) => `{{${inner.replace(/\\(.)/g, '$1')}}}`)
    .replaceAll(
      new RegExp(
        `${MERGE_LINK_HOST.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([a-zA-Z_][a-zA-Z0-9_.]*)`,
        'g',
      ),
      '{{ $1 }}',
    )
    .replace(/\n+$/, '');
}

export interface InlineTextProps {
  /** The block being edited; the "/" menu adds blocks next to it. */
  blockId: string;
  value: string;
  /** Headings are a single line of inline formatting. */
  singleLine?: boolean;
  style?: CSSProperties;
  className?: string;
  onChange: (markdown: string) => void;
  onDone: () => void;
}

/** In-place rich text editing that reads and writes restricted markdown. */
export function InlineText({
  blockId,
  value,
  singleLine,
  style,
  className,
  onChange,
  onDone,
}: InlineTextProps) {
  const { mergeTags, conditions, messages, blockTypes, onCreateMergeTag } = useEditorOptions();
  const store = useEditorStore();
  const text = messages.formatBar;
  const wrapper = useRef<HTMLDivElement>(null);

  /** The open "/" menu: the range of "/query" and where to show the menu. */
  const [slash, setSlash] = useState<{
    from: number;
    to: number;
    query: string;
    left: number;
    /** Distance from the editor's top to the menu's top, or its bottom when `above`. */
    top: number;
    above: boolean;
    maxHeight: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Where Escape closed the menu, so it stays closed until the "/" goes. */
  const dismissedAt = useRef<number | null>(null);

  const allItems = useMemo(
    () =>
      buildSlashItems({
        messages,
        mergeTags,
        singleLine: singleLine ?? false,
        blockTypes,
        canCreateField: onCreateMergeTag !== undefined,
        canPersonalize: conditions !== undefined,
      }),
    [messages, mergeTags, singleLine, blockTypes, onCreateMergeTag, conditions],
  );
  const items = useMemo(
    () => (slash ? filterSlashItems(allItems, slash.query) : []),
    [allItems, slash],
  );

  const detectSlash = (current: Editor) => {
    const { selection } = current.state;
    const { $from } = selection;
    const query =
      selection.empty && $from.parent.isTextblock
        ? findSlashQuery($from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc'))
        : null;
    if (query === null) {
      dismissedAt.current = null;
      setSlash(null);
      return;
    }
    const from = $from.pos - query.length - 1;
    const box = wrapper.current?.getBoundingClientRect();
    if (dismissedAt.current === from || !box) {
      setSlash(null);
      return;
    }
    const caret = current.view.coordsAtPos(from);
    const spaceBelow = window.innerHeight - caret.bottom - 16;
    const spaceAbove = caret.top - 16;
    // Open upwards when the menu would not fit below the caret and fits better above.
    const above = spaceBelow < SLASH_MENU_HEIGHT && spaceAbove > spaceBelow;
    setSlash((previous) => {
      if (previous?.query !== query) setActiveIndex(0);
      return {
        from,
        to: $from.pos,
        query,
        left: caret.left - box.left,
        top: above ? caret.top - box.top - 6 : caret.bottom - box.top + 6,
        above,
        maxHeight: Math.max(160, Math.min(SLASH_MENU_HEIGHT, above ? spaceAbove : spaceBelow)),
      };
    });
  };

  const choose = (item: SlashItem) => {
    const current = editorRef.current;
    if (!slash || !current) return;
    setSlash(null);
    current.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
    const { command } = item;
    switch (command.kind) {
      case 'bulletList':
        current.chain().focus().toggleBulletList().run();
        return;
      case 'orderedList':
        current.chain().focus().toggleOrderedList().run();
        return;
      case 'blockquote':
        current.chain().focus().toggleBlockquote().run();
        return;
      case 'field':
        current.chain().focus().insertContent(`{{ ${command.key} }}`).run();
        return;
      case 'addField': {
        const at = current.state.selection.from;
        void onCreateMergeTag?.().then((tag) => {
          if (tag && !current.isDestroyed) {
            current.chain().focus().insertContentAt(at, `{{ ${tag.key} }}`).run();
          }
        });
        return;
      }
      default:
        runBlockCommand(store, blockId, command, { empty: current.isEmpty, conditions });
    }
  };

  /** Latest menu state for the editor's key handler, which is created once. */
  const menu = useRef({ open: false, count: 0, activeIndex, choose: () => {} });
  menu.current = {
    open: slash !== null,
    count: items.length,
    activeIndex,
    choose: () => {
      const item = items[activeIndex];
      if (item) choose(item);
    },
  };

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: 'end',
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: false,
        ...(singleLine
          ? {
              bulletList: false,
              orderedList: false,
              listItem: false,
              listKeymap: false,
              blockquote: false,
            }
          : {}),
      }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] }),
      Markdown,
    ],
    content: toEditorMarkdown(value),
    contentType: 'markdown',
    editorProps: {
      attributes: { class: cn('meb-inline-editor', className), spellcheck: 'true' },
      handleKeyDown: (_view, event) => {
        const slashMenu = menu.current;
        if (slashMenu.open) {
          if (event.key === 'Escape') {
            dismissedAt.current = editorRef.current
              ? editorRef.current.state.selection.from - 1
              : null;
            setSlash(null);
            return true;
          }
          if (slashMenu.count > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((slashMenu.activeIndex + step + slashMenu.count) % slashMenu.count);
            return true;
          }
          if (slashMenu.count > 0 && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault();
            slashMenu.choose();
            return true;
          }
        }
        if (event.key === 'Escape') {
          onDone();
          return true;
        }
        if (singleLine && event.key === 'Enter') {
          event.preventDefault();
          onDone();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      let markdown = fromEditorMarkdown(current.getMarkdown());
      if (singleLine) markdown = markdown.replace(/\s*\n+\s*/g, ' ');
      onChange(markdown);
      detectSlash(current);
    },
    onSelectionUpdate: ({ editor: current }) => detectSlash(current),
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      strike: current?.isActive('strike') ?? false,
      link: current?.isActive('link') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      href: (current?.getAttributes('link').href as string | undefined) ?? '',
    }),
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  useEffect(() => {
    if (linkOpen) setHref(active?.href.replace(MERGE_LINK_HOST, '') ?? '');
  }, [linkOpen, active?.href]);

  if (!editor) return null;

  const applyLink = () => {
    const trimmed = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (trimmed === '') {
      chain.unsetLink().run();
    } else {
      const merge = /^\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}$/.exec(trimmed);
      chain.setLink({ href: merge ? `${MERGE_LINK_HOST}${merge[1]}` : trimmed }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div ref={wrapper} className="relative" style={style}>
      <div
        data-slot="format-bar"
        className="absolute -top-10 left-0 z-7 flex h-9 items-center gap-px whitespace-nowrap rounded-md border bg-popover px-1 text-left font-normal font-sans text-popover-foreground text-xs not-italic leading-none tracking-normal normal-case shadow-md"
        onMouseDown={(event) => event.preventDefault()}
        // Keep clicks from reaching the block, whose click handler would
        // start editing again right after Done.
        onClick={(event) => event.stopPropagation()}
      >
        <Tip label={text.boldTip}>
          <Button
            size="icon-xs"
            variant="ghost"
            className={FORMAT_BUTTON}
            aria-label={text.bold}
            aria-pressed={active?.bold ?? false}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Icon icon={TextBoldIcon} />
          </Button>
        </Tip>
        <Tip label={text.italicTip}>
          <Button
            size="icon-xs"
            variant="ghost"
            className={FORMAT_BUTTON}
            aria-label={text.italic}
            aria-pressed={active?.italic ?? false}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Icon icon={TextItalicIcon} />
          </Button>
        </Tip>
        <Tip label={text.strikethrough}>
          <Button
            size="icon-xs"
            variant="ghost"
            className={FORMAT_BUTTON}
            aria-label={text.strikethrough}
            aria-pressed={active?.strike ?? false}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Icon icon={TextStrikethroughIcon} />
          </Button>
        </Tip>
        <Popover
          open={linkOpen}
          onOpenChange={setLinkOpen}
          className="w-80"
          trigger={
            <Button
              size="icon-xs"
              variant="ghost"
              className={FORMAT_BUTTON}
              aria-label={text.link}
              aria-pressed={active?.link ?? false}
            >
              <Icon icon={Link01Icon} />
            </Button>
          }
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <Input
              className="h-8"
              value={href}
              placeholder={text.linkPlaceholder}
              aria-label={text.linkUrl}
              onChange={(event) => setHref(event.target.value)}
            />
            <Button type="submit" size="sm">
              {text.apply}
            </Button>
            {active?.link ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={text.removeLink}
                onClick={() => {
                  setHref('');
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                <Icon icon={Cancel01Icon} />
              </Button>
            ) : null}
          </form>
        </Popover>
        {singleLine ? null : (
          <>
            <GroupSeparator />
            <Tip label={text.bulletedList}>
              <Button
                size="icon-xs"
                variant="ghost"
                className={FORMAT_BUTTON}
                aria-label={text.bulletedList}
                aria-pressed={active?.bulletList ?? false}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <Icon icon={LeftToRightListBulletIcon} />
              </Button>
            </Tip>
            <Tip label={text.numberedList}>
              <Button
                size="icon-xs"
                variant="ghost"
                className={FORMAT_BUTTON}
                aria-label={text.numberedList}
                aria-pressed={active?.orderedList ?? false}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <Icon icon={LeftToRightListNumberIcon} />
              </Button>
            </Tip>
          </>
        )}
        {mergeTags.length > 0 ? (
          <>
            <GroupSeparator />
            <Popover
              className="w-auto min-w-56 gap-0 p-1"
              trigger={
                <Button size="icon-xs" variant="ghost" aria-label={text.insertMergeTag}>
                  <Icon icon={BracesIcon} />
                </Button>
              }
            >
              <div
                data-slot="merge-tag-menu"
                className="flex max-h-[300px] flex-col overflow-y-auto"
              >
                <p className="px-2 pt-1 pb-1.5 font-medium text-muted-foreground text-xs">
                  {text.insertMergeTag}
                </p>
                {mergeTags.map((tag) => (
                  <Button
                    key={tag.key}
                    variant="ghost"
                    size="sm"
                    className="justify-between gap-3 px-2 font-normal"
                    onClick={() => editor.chain().focus().insertContent(`{{ ${tag.key} }}`).run()}
                  >
                    <span className="truncate">{tag.label ?? tag.key}</span>
                    <code className="font-mono text-muted-foreground text-xs">{`{{ ${tag.key} }}`}</code>
                  </Button>
                ))}
              </div>
            </Popover>
          </>
        ) : null}
        <GroupSeparator />
        <Button size="xs" variant="ghost" onClick={onDone}>
          {text.done}
        </Button>
      </div>
      <EditorContent editor={editor} />
      {slash ? (
        <SlashMenu
          items={items}
          activeIndex={Math.min(activeIndex, Math.max(items.length - 1, 0))}
          style={{
            left: Math.max(slash.left, 0),
            top: slash.top,
            maxHeight: slash.maxHeight,
            ...(slash.above ? { translate: '0 -100%' } : {}),
          }}
          onActiveChange={setActiveIndex}
          onChoose={choose}
        />
      ) : null}
    </div>
  );
}
