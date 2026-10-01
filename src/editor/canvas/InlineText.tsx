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
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { type CSSProperties, useEffect, useState } from 'react';
import { useEditorOptions } from '../context';
import { Button, cn, Icon, Input, Popover, Separator, Tip } from '../ui';

const MERGE_LINK_HOST = 'https://meb-merge.invalid/';

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
  value,
  singleLine,
  style,
  className,
  onChange,
  onDone,
}: InlineTextProps) {
  const { mergeTags, messages } = useEditorOptions();
  const text = messages.formatBar;
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: 'end',
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        underline: false,
        link: false,
        ...(singleLine
          ? { bulletList: false, orderedList: false, listItem: false, listKeymap: false }
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
    },
  });

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
    <div className="relative" style={style}>
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
    </div>
  );
}
