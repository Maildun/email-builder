import type { ComponentProps } from 'react';
import type { EmailDocument } from '../../core/schema/document';
import type { Viewport } from '../store';
import { cn } from '../ui';

const MOBILE_WIDTH = 375;
/** Backdrop visible on each side of the email (`px-6`). */
const GUTTER = 24;

/** The email's content width on screen for a viewport. */
export function emailWidth(document: EmailDocument, viewport: Viewport): number {
  return viewport === 'mobile' ? MOBILE_WIDTH : document.settings.width;
}

/**
 * The email's backdrop (what recipients see around the content) as a framed
 * card on the stage. Design and Preview share it, so switching views keeps the
 * email the same size and in the same place, while the stage follows the
 * editor's theme and the email keeps its own colors.
 */
export function EmailFrame({
  width,
  backdrop,
  className,
  style,
  ...props
}: ComponentProps<'div'> & {
  /** The email's content width; the frame adds the gutters. */
  width: number;
  /** The backdrop color. */
  backdrop: string | undefined;
}) {
  return (
    <div
      data-slot="email-frame"
      className={cn(
        'meb-backdrop mx-auto rounded-lg shadow-sm ring-1 ring-foreground/5 transition-[max-width] duration-200 ease-out',
        className,
      )}
      style={{
        background: backdrop,
        maxWidth: width + GUTTER * 2,
        paddingInline: GUTTER,
        ...style,
      }}
      {...props}
    />
  );
}
