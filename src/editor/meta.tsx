import {
  ArrowVerticalIcon,
  CodeIcon,
  CursorPointer01Icon,
  Heading01Icon,
  Image01Icon,
  LayoutThreeColumnIcon,
  MinusSignIcon,
  ParagraphIcon,
  RectangularIcon,
  SquareIcon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import type { BlockType } from '../core/schema/blocks';
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
  container: SquareIcon,
  columns: LayoutThreeColumnIcon,
  column: RectangularIcon,
};
