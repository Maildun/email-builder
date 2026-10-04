import { type ComponentProps, type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
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
 * How much to shrink a frame of `frameWidth` so it fits the space `outer`
 * gets, and the frame's unscaled height (to reserve the scaled height).
 */
function useFitScale(frameWidth: number) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outerElement = outer.current;
    const innerElement = inner.current;
    if (!outerElement || !innerElement) return;
    const measure = () => {
      const available = outerElement.clientWidth;
      const scale = available > 0 ? Math.min(1, available / frameWidth) : 1;
      const height = innerElement.offsetHeight;
      setFit((current) =>
        Math.abs(current.scale - scale) < 0.001 && current.height === height
          ? current
          : { scale, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outerElement);
    observer.observe(innerElement);
    return () => observer.disconnect();
  }, [frameWidth]);

  return { outer, inner, ...fit };
}

/**
 * The email's backdrop (what recipients see around the content) as a framed
 * card on the stage. Design and Preview share it, so switching views keeps the
 * email the same size and in the same place, while the stage follows the
 * editor's theme and the email keeps its own colors.
 *
 * When the stage is narrower than the email, the frame scales down to fit
 * instead of reflowing, so the layout stays exactly what recipients get at
 * that viewport. `--meb-scale` holds the factor for overlays that should keep
 * their size (the block toolbar and format bar).
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
  const frameWidth = width + GUTTER * 2;
  const { outer, inner, scale, height } = useFitScale(frameWidth);
  const scaled = scale < 1;

  return (
    <div
      ref={outer}
      data-slot="email-frame-fit"
      data-scaled={scaled || undefined}
      style={scaled ? { height: height * scale } : undefined}
    >
      <div
        ref={inner}
        data-slot="email-frame"
        className={cn(
          'meb-backdrop mx-auto rounded-lg shadow-sm ring-1 ring-foreground/5 transition-[max-width] duration-200 ease-out',
          className,
        )}
        style={
          {
            background: backdrop,
            maxWidth: frameWidth,
            paddingInline: GUTTER,
            '--meb-scale': scale,
            ...(scaled
              ? { width: frameWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }
              : {}),
            ...style,
          } as CSSProperties
        }
        {...props}
      />
    </div>
  );
}
