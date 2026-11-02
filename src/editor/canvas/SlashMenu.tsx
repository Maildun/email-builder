import { Add01Icon } from '@hugeicons/core-free-icons';
import { type CSSProperties, useEffect, useId, useRef } from 'react';
import { useMessages } from '../context';
import { cn, Icon } from '../ui';
import type { SlashItem } from './slash';

/** Resets the email's own type styles, which the menu would otherwise inherit. */
const MENU_RESET =
  'text-left font-normal font-sans text-popover-foreground not-italic leading-normal tracking-normal normal-case';

export interface SlashMenuProps {
  items: SlashItem[];
  activeIndex: number;
  style: CSSProperties;
  onActiveChange: (index: number) => void;
  onChoose: (item: SlashItem) => void;
}

/** The "/" menu: blocks to insert, a personalized section and merge fields. */
export function SlashMenu({ items, activeIndex, style, onActiveChange, onChoose }: SlashMenuProps) {
  const text = useMessages().slashMenu;
  const baseId = useId();
  const list = useRef<HTMLDivElement>(null);
  const activeId = `${baseId}-${activeIndex}`;

  useEffect(() => {
    list.current
      ?.querySelector(`[id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const option = (item: SlashItem) => {
    const index = items.indexOf(item);
    return {
      id: `${baseId}-${index}`,
      role: 'option',
      'aria-selected': index === activeIndex,
      'data-active': index === activeIndex || undefined,
      onMouseEnter: () => onActiveChange(index),
      onClick: () => onChoose(item),
    } as const;
  };

  const blocks = items.filter((item) => item.group === 'blocks');
  const sections = items.filter((item) => item.group === 'personalize');
  const fields = items.filter((item) => item.group === 'fields');

  return (
    <div
      ref={list}
      data-slot="slash-menu"
      role="listbox"
      aria-label={text.label}
      aria-activedescendant={items.length ? activeId : undefined}
      tabIndex={-1}
      className={cn(
        'absolute z-8 flex w-[344px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl border bg-popover text-sm shadow-lg',
        MENU_RESET,
      )}
      style={style}
      // Keep the caret in the text while clicking the menu.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-muted-foreground text-xs">{text.noResults}</p>
      ) : null}
      {blocks.length > 0 ? (
        <div className="grid grid-cols-4 gap-0.5 p-1.5">
          {blocks.map((item) => (
            <button
              key={item.id}
              type="button"
              {...option(item)}
              className="flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2 outline-none data-active:bg-muted"
            >
              <span className="flex size-8 items-center justify-center rounded-md border bg-background">
                {item.icon ? <Icon icon={item.icon} className="size-4" /> : null}
              </span>
              <span className="w-full truncate text-center text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {sections.length > 0 || fields.length > 0 ? (
        <div
          className={cn('flex flex-col gap-2 bg-muted/40 p-2.5', blocks.length > 0 && 'border-t')}
        >
          {sections.length > 0 ? (
            <>
              <p className="font-medium text-muted-foreground text-xs">{text.personalize}</p>
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  {...option(item)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed bg-background px-2.5 py-2 text-left outline-none data-active:border-editor-selection data-active:bg-editor-selection-soft"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    {item.icon ? <Icon icon={item.icon} className="size-4" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.description ? (
                      <span className="truncate text-muted-foreground text-xs">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </>
          ) : null}
          {fields.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-muted-foreground text-xs">{text.fields}</span>
              {fields.map((item) =>
                item.command.kind === 'addField' ? (
                  <button
                    key={item.id}
                    type="button"
                    {...option(item)}
                    className="flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-2 py-1 text-muted-foreground text-xs outline-none data-active:border-editor-selection data-active:text-foreground"
                  >
                    <Icon icon={Add01Icon} className="size-3" />
                    {item.label}
                  </button>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    {...option(item)}
                    className="cursor-pointer rounded-md bg-muted px-2 py-1 text-xs outline-none data-active:bg-editor-selection data-active:text-white"
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
