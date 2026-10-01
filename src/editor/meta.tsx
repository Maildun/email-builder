import {
  CircleUser,
  Code,
  Columns3,
  Heading,
  Image,
  type LucideIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Pilcrow,
  RectangleVertical,
  Square,
} from 'lucide-react';
import type { BlockType } from '../core/schema/blocks';

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  heading: Heading,
  text: Pilcrow,
  button: MousePointerClick,
  image: Image,
  avatar: CircleUser,
  divider: Minus,
  spacer: MoveVertical,
  html: Code,
  container: Square,
  columns: Columns3,
  column: RectangleVertical,
};
