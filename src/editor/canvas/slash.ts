import {
  CodeIcon,
  CursorMagicSelection01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  ImageAdd01Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  ParagraphIcon,
  RectangularIcon,
  SquareDashedIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { createId } from '../../core/ids';
import type { BlockType } from '../../core/schema/blocks';
import type { BlockInput } from '../../core/schema/document';
import { findParent } from '../../core/tree';
import type { ConditionOption, MergeTag } from '../context';
import { starterConditions } from '../inspector/VisibleIf';
import type { EditorMessages } from '../messages';
import type { EditorStore } from '../store';

/** What a "/" menu item does. */
export type SlashCommand =
  | { kind: 'text' }
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | { kind: 'bulletList' }
  | { kind: 'orderedList' }
  | { kind: 'blockquote' }
  | { kind: 'block'; type: 'divider' | 'image' | 'button' | 'html' }
  | { kind: 'box' }
  | { kind: 'section' }
  | { kind: 'field'; key: string }
  | { kind: 'addField' };

export type SlashGroup = 'blocks' | 'personalize' | 'fields';

export interface SlashItem {
  id: string;
  group: SlashGroup;
  label: string;
  description?: string;
  icon?: IconSvgElement;
  /** Extra words the query also matches, in English. */
  keywords?: string;
  command: SlashCommand;
}

/**
 * The query after a "/" typed at the start of a line or after a space, given
 * the text before the cursor; null when no menu should open.
 */
export function findSlashQuery(textBefore: string): string | null {
  const match = /(?:^|\s)\/([^\s/]{0,24})$/.exec(textBefore);
  return match ? (match[1] ?? '') : null;
}

export function buildSlashItems({
  messages,
  mergeTags,
  singleLine,
  blockTypes,
  canCreateField,
  canPersonalize,
}: {
  messages: EditorMessages;
  mergeTags: readonly MergeTag[];
  /** Headings hold one line: no lists or quotes. */
  singleLine: boolean;
  /** Block types the host offers; all when undefined. */
  blockTypes?: readonly BlockType[] | undefined;
  canCreateField: boolean;
  /** The host offers reader groups, so sections can be personalized. */
  canPersonalize: boolean;
}): SlashItem[] {
  const text = messages.slashMenu;
  const offers = (type: BlockType) => !blockTypes || blockTypes.includes(type);
  const items: SlashItem[] = [];
  const add = (item: SlashItem, type?: BlockType) => {
    if (!type || offers(type)) items.push(item);
  };

  add(
    {
      id: 'text',
      group: 'blocks',
      label: text.text,
      icon: ParagraphIcon,
      command: { kind: 'text' },
    },
    'text',
  );
  for (const level of [1, 2, 3] as const) {
    add(
      {
        id: `heading-${level}`,
        group: 'blocks',
        label: text.heading(level),
        icon: [Heading01Icon, Heading02Icon, Heading03Icon][level - 1] as IconSvgElement,
        keywords: `h${level} title`,
        command: { kind: 'heading', level },
      },
      'heading',
    );
  }
  if (!singleLine) {
    add({
      id: 'bullets',
      group: 'blocks',
      label: text.bullets,
      icon: LeftToRightListBulletIcon,
      keywords: 'list unordered',
      command: { kind: 'bulletList' },
    });
    add({
      id: 'numbers',
      group: 'blocks',
      label: text.numbers,
      icon: LeftToRightListNumberIcon,
      keywords: 'list ordered numbered',
      command: { kind: 'orderedList' },
    });
    add({
      id: 'quote',
      group: 'blocks',
      label: text.quote,
      icon: LeftToRightBlockQuoteIcon,
      keywords: 'blockquote citation',
      command: { kind: 'blockquote' },
    });
  }
  add(
    {
      id: 'divider',
      group: 'blocks',
      label: text.divider,
      icon: MinusSignIcon,
      keywords: 'line rule separator hr',
      command: { kind: 'block', type: 'divider' },
    },
    'divider',
  );
  add(
    {
      id: 'image',
      group: 'blocks',
      label: text.image,
      icon: ImageAdd01Icon,
      keywords: 'picture photo',
      command: { kind: 'block', type: 'image' },
    },
    'image',
  );
  add(
    {
      id: 'button',
      group: 'blocks',
      label: text.button,
      icon: CursorMagicSelection01Icon,
      keywords: 'cta link',
      command: { kind: 'block', type: 'button' },
    },
    'button',
  );
  add(
    {
      id: 'box',
      group: 'blocks',
      label: text.box,
      icon: RectangularIcon,
      keywords: 'container group card',
      command: { kind: 'box' },
    },
    'container',
  );
  add(
    {
      id: 'html',
      group: 'blocks',
      label: text.html,
      icon: CodeIcon,
      keywords: 'code raw',
      command: { kind: 'block', type: 'html' },
    },
    'html',
  );
  if (canPersonalize) {
    add(
      {
        id: 'section',
        group: 'personalize',
        label: text.section,
        description: text.sectionDescription,
        icon: SquareDashedIcon,
        keywords: 'personalize condition conditional if audience readers',
        command: { kind: 'section' },
      },
      'container',
    );
  }
  for (const tag of mergeTags) {
    items.push({
      id: `field-${tag.key}`,
      group: 'fields',
      label: tag.label ?? tag.key,
      keywords: `${tag.key} field merge tag`,
      command: { kind: 'field', key: tag.key },
    });
  }
  if (canCreateField) {
    items.push({
      id: 'add-field',
      group: 'fields',
      label: text.addField,
      keywords: 'new field merge tag create',
      command: { kind: 'addField' },
    });
  }
  return items;
}

/** Items whose label or keywords have a word starting with the query. */
export function filterSlashItems(items: readonly SlashItem[], query: string): SlashItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) =>
    `${item.label} ${item.keywords ?? ''}`
      .toLowerCase()
      .split(/[\s_.-]+/)
      .some((word) => word.startsWith(needle)),
  );
}

/**
 * Runs a block-level command for the block being edited: changes it in place
 * when it is empty (a heading's level, or text into a heading), otherwise adds
 * the new block right after it. Then edits or selects the new content.
 */
export function runBlockCommand(
  store: EditorStore,
  id: string,
  command: SlashCommand,
  { empty, conditions }: { empty: boolean; conditions?: readonly ConditionOption[] | undefined },
): void {
  const document = store.getState().document;
  const block = document.blocks[id];
  const parent = findParent(document, id);
  if (!block || !parent) return;

  let input: BlockInput;
  let editId: string | null = null;
  switch (command.kind) {
    case 'text':
      if (block.type === 'text') return;
      input = { type: 'text', props: { markdown: '' } };
      break;
    case 'heading':
      if (block.type === 'heading') {
        store.apply({ op: 'update', id, props: { level: command.level } });
        return;
      }
      input = { type: 'heading', props: { text: '', level: command.level } };
      break;
    case 'block':
      input = { type: command.type };
      break;
    case 'box':
    case 'section': {
      editId = createId();
      input = {
        type: 'container',
        props:
          command.kind === 'section'
            ? { visibleIf: { conditions: starterConditions(conditions) } }
            : {},
        children: [{ id: editId, type: 'text', props: { markdown: '' } }],
      };
      break;
    }
    default:
      return;
  }

  const result = empty
    ? store.apply({ op: 'replace', id, block: input })
    : store.apply({
        op: 'insert',
        parentId: parent.parentId,
        index: parent.index + 1,
        blocks: [input],
      });
  if (!result.ok) return;

  const newId = empty ? id : result.inserted[0];
  if (!newId) return;
  if (editId) {
    store.startEditing(editId);
  } else if (input.type === 'text' || input.type === 'heading') {
    store.startEditing(newId);
  } else {
    store.select(newId);
  }
}
