import {
  ArrowVerticalIcon,
  CodeIcon,
  CursorPointer01Icon,
  Heading01Icon,
  Image01Icon,
  LayoutThreeColumnIcon,
  MinusSignIcon,
  ParagraphIcon,
  PuzzleIcon,
  RectangularIcon,
  SquareIcon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import type { CustomBlockDefinition } from '../core/custom';
import type { Block, BlockType } from '../core/schema/blocks';
import type { EditorMessages } from './messages';
import type { IconSvgElement } from './ui';

export const BLOCK_ICONS: Record<BlockType, IconSvgElement> = {
  heading: Heading01Icon,
  text: ParagraphIcon,
  button: CursorPointer01Icon,
  image: Image01Icon,
  avatar: UserCircleIcon,
  divider: MinusSignIcon,
  spacer: ArrowVerticalIcon,
  html: CodeIcon,
  custom: PuzzleIcon,
  container: SquareIcon,
  columns: LayoutThreeColumnIcon,
  column: RectangularIcon,
};

type CustomMap = ReadonlyMap<string, CustomBlockDefinition>;

function customDefinition(block: Block, custom: CustomMap): CustomBlockDefinition | undefined {
  return block.type === 'custom' ? custom.get(block.props.name) : undefined;
}

/** "Heading" (translated), or a custom block's own label ("Product"). */
export function blockLabel(
  block: Block,
  custom: CustomMap,
  messages: Pick<EditorMessages, 'blocks' | 'common'>,
): string {
  if (block.type === 'custom') {
    return customDefinition(block, custom)?.label ?? messages.common.unknownBlock(block.props.name);
  }
  return messages.blocks[block.type].label;
}

export function blockIcon(block: Block, custom: CustomMap): IconSvgElement {
  return (
    (customDefinition(block, custom)?.icon as IconSvgElement | undefined) ?? BLOCK_ICONS[block.type]
  );
}
