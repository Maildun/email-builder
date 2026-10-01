import type { ReactNode } from 'react';
import type { SectionName } from '../../core/sections';
import { cn } from '../ui';

/*
 * Wireframe previews of the built-in sections, drawn with `currentColor` so
 * they follow the editor's theme (and darken with the tile on hover).
 */

/** A line of body copy. */
function Line({ className }: { className?: string }) {
  return <i className={cn('block h-[3px] rounded-full bg-current/25', className)} />;
}

/** A heading. */
function Title({ className }: { className?: string }) {
  return <i className={cn('block h-[5px] rounded-full bg-current/55', className)} />;
}

/** An image or logo placeholder. */
function Media({ className }: { className?: string }) {
  return <i className={cn('block rounded-[3px] bg-current/12', className)} />;
}

/** A button, in the selection color so the call to action stands out. */
function Pill({ className }: { className?: string }) {
  return <i className={cn('block h-[7px] w-7 rounded-full bg-editor-selection/75', className)} />;
}

const THUMBS: Record<SectionName, ReactNode> = {
  header: (
    <div className="flex h-full flex-col items-center gap-2 pt-1">
      <Media className="h-3 w-10" />
      <i className="block h-px w-full bg-current/12" />
    </div>
  ),
  hero: (
    <div className="flex h-full flex-col items-center gap-1">
      <Media className="h-5 w-full" />
      <Title className="mt-0.5 w-14" />
      <Line className="w-10" />
      <Pill className="mt-0.5" />
    </div>
  ),
  article: (
    <div className="flex h-full flex-col justify-center gap-1">
      <Title className="mb-0.5 w-12" />
      <Line className="w-full" />
      <Line className="w-full" />
      <Line className="w-3/5" />
    </div>
  ),
  features: (
    <div className="grid h-full grid-cols-3 items-center gap-1.5">
      {[0, 1, 2].map((column) => (
        <div key={column} className="flex flex-col gap-1">
          <Media className="aspect-square w-full" />
          <Title className="w-4/5" />
          <Line className="w-full" />
        </div>
      ))}
    </div>
  ),
  cta: (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-[3px] bg-current/8">
      <Title className="w-14" />
      <Pill />
    </div>
  ),
  footer: (
    <div className="flex h-full flex-col items-center justify-end gap-1 pb-0.5">
      <Line className="w-12" />
      <Line className="w-16" />
      <Line className="w-8 bg-current/40" />
    </div>
  ),
};

/** A schematic of a section's layout; nothing for sections it doesn't know. */
export function SectionThumb({ name }: { name: SectionName }) {
  return (
    <span
      aria-hidden
      data-slot="section-thumb"
      className="block h-16 w-full rounded-[5px] border bg-background p-2 text-muted-foreground transition-colors group-hover/section:text-foreground"
    >
      {THUMBS[name] ?? null}
    </span>
  );
}
