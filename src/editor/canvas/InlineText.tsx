import { Link } from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Bold, Braces, Italic, Link2, List, ListOrdered, Strikethrough, X } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { useEditorOptions } from '../context';
import { Button, cx, Popover, Tip } from '../ui';

const MERGE_LINK_HOST = 'https://meb-merge.invalid/';

/** Merge tags are not valid markdown link targets; swap them for URLs while editing. */
function toEditorMarkdown(markdown: string): string {
  return markdown.replace(
    /\]\(\s*\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}\s*\)/g,
    (_match, key: string) => `](${MERGE_LINK_HOST}${key})`,
  );
}

function fromEditorMarkdown(markdown: string): string {
  return markdown
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
  const { mergeTags } = useEditorOptions();
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
      attributes: { class: cx('meb-inline-editor', className), spellcheck: 'true' },
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
    <div className="meb-inline" style={style}>
      <div className="meb-format-bar" onMouseDown={(event) => event.preventDefault()}>
        <Tip label="Bold (⌘B)">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Bold"
            active={active?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={14} />
          </Button>
        </Tip>
        <Tip label="Italic (⌘I)">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Italic"
            active={active?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={14} />
          </Button>
        </Tip>
        <Tip label="Strikethrough">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Strikethrough"
            active={active?.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={14} />
          </Button>
        </Tip>
        <Popover
          open={linkOpen}
          onOpenChange={setLinkOpen}
          trigger={
            <Button size="icon" variant="ghost" aria-label="Link" active={active?.link}>
              <Link2 size={14} />
            </Button>
          }
        >
          <form
            className="meb-row meb-gap-sm"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input
              className="meb-input"
              value={href}
              placeholder="https:// or {{ tag }}"
              aria-label="Link URL"
              onChange={(event) => setHref(event.target.value)}
            />
            <Button type="submit" size="sm" variant="primary">
              Apply
            </Button>
            {active?.link ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove link"
                onClick={() => {
                  setHref('');
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                <X size={14} />
              </Button>
            ) : null}
          </form>
        </Popover>
        {singleLine ? null : (
          <>
            <Tip label="Bulleted list">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Bulleted list"
                active={active?.bulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List size={14} />
              </Button>
            </Tip>
            <Tip label="Numbered list">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Numbered list"
                active={active?.orderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={14} />
              </Button>
            </Tip>
          </>
        )}
        {mergeTags.length > 0 ? (
          <Popover
            trigger={
              <Button size="icon" variant="ghost" aria-label="Insert merge tag">
                <Braces size={14} />
              </Button>
            }
          >
            <div className="meb-menu">
              <p className="meb-menu-title">Insert merge tag</p>
              {mergeTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  className="meb-menu-item"
                  onClick={() => editor.chain().focus().insertContent(`{{ ${tag.key} }}`).run()}
                >
                  <span>{tag.label ?? tag.key}</span>
                  <code>{`{{ ${tag.key} }}`}</code>
                </button>
              ))}
            </div>
          </Popover>
        ) : null}
        <span className="meb-format-spacer" />
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
