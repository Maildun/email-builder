/**
 * The editor's UI kit: thin wrappers over the shadcn/ui components in this
 * folder, shaped for the editor's call sites. Generated shadcn files live next
 * to this one; see scripts/fix-shadcn-imports.ts after adding new ones.
 */
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../lib/utils';
import { FieldDescription, FieldLabel, Field as FieldRoot } from './field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from './input-group';
import { PopoverContent, Popover as PopoverRoot, PopoverTrigger } from './popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Switch } from './switch';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export { PortalContext, usePortalContainer } from '../lib/portal';
export { cn } from '../lib/utils';
export { Badge } from './badge';
export { Button, buttonVariants } from './button';
export { Input } from './input';
export { Kbd, KbdGroup } from './kbd';
export { Separator } from './separator';
export { Spinner } from './spinner';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Textarea } from './textarea';
export { TooltipProvider } from './tooltip';

export type { IconSvgElement };

/** A Hugeicons icon. Sized by its parent component, or with a `size-*` class. */
export function Icon({
  icon,
  ...props
}: { icon: IconSvgElement } & Omit<ComponentProps<typeof HugeiconsIcon>, 'icon'>) {
  return <HugeiconsIcon icon={icon} strokeWidth={2} {...props} />;
}

/** Wraps a single interactive element with a tooltip. */
export function Tip({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} delay={400} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  className,
  open,
  onOpenChange,
}: {
  trigger: ReactElement;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <PopoverRoot
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn('w-64 gap-3 p-3', className)}
      >
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}

/** Labelled form row. `children` receives the id to put on the control. */
export function Field({
  label,
  hint,
  children,
  inline,
  invalid,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  inline?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <FieldRoot
      orientation={inline ? 'horizontal' : 'vertical'}
      data-invalid={invalid || undefined}
      className={cn('gap-1.5', inline && 'items-center justify-between')}
    >
      <FieldLabel htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </FieldLabel>
      {children(id)}
      {hint ? <FieldDescription className="text-xs">{hint}</FieldDescription> : null}
    </FieldRoot>
  );
}

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible label when `label` is an icon. */
  title?: string;
}

/**
 * Where the selected item sits in its group, kept current as items resize.
 * `animate` turns on after the first measurement, so the thumb appears in
 * place instead of sliding in from the edge.
 */
function useThumb(group: RefObject<HTMLElement | null>) {
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const measure = useCallback(() => {
    const item = group.current?.querySelector<HTMLElement>(':scope > [data-pressed]');
    setThumb((previous) => {
      if (!item) return null;
      const next = { left: item.offsetLeft, width: item.offsetWidth };
      return previous?.left === next.left && previous.width === next.width ? previous : next;
    });
  }, [group]);
  // After every render, since the selection or the labels may have changed.
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const element = group.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [group, measure]);
  return { thumb, animate };
}

/** A row of mutually exclusive options, with a thumb that slides to the selected one. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  fill = true,
  className,
}: {
  value: T | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
  id?: string;
  ariaLabel?: string;
  /** Stretch to the container width (the default for inspector fields). */
  fill?: boolean;
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const { thumb, animate } = useThumb(group);
  return (
    <ToggleGroup
      ref={group}
      id={id}
      aria-label={ariaLabel}
      data-slot="segmented"
      spacing={0}
      className={cn(
        'relative isolate h-8 gap-0 rounded-lg bg-muted p-[3px]',
        fill && 'w-full',
        className,
      )}
      value={value === undefined ? [] : [value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (picked !== undefined) onChange(picked as T);
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.title}
          className={cn(
            'h-full min-w-0 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-transparent aria-pressed:bg-transparent data-pressed:text-foreground [&_svg:not([class*=size-])]:size-3.5',
            fill && 'flex-1',
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
      {thumb ? (
        <span
          aria-hidden
          data-slot="segmented-thumb"
          className={cn(
            'absolute inset-y-[3px] left-0 -z-1 rounded-md bg-background shadow-sm ring-1 ring-foreground/5 dark:bg-input dark:ring-0',
            animate &&
              'transition-[translate,width] duration-200 ease-out motion-reduce:transition-none',
          )}
          style={{ width: thumb.width, translate: `${thumb.left}px 0` }}
        />
      ) : null}
    </ToggleGroup>
  );
}

export function SelectInput<T extends string>({
  value,
  options,
  onChange,
  id,
  placeholder = 'Select…',
}: {
  value: T | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
  id?: string;
  placeholder?: string;
}) {
  return (
    <Select
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value ?? null}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
    >
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function SwitchInput({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return <Switch id={id} checked={checked} onCheckedChange={onChange} />;
}

export function NumberInput({
  value,
  onChange,
  id,
  min,
  max,
  step = 1,
  unit,
  placeholder,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  id?: string;
  ariaLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}) {
  // What the user is typing. Intermediate values ("1" on the way to "14", or an
  // empty field) stay local and are only committed once they are in range.
  const [draft, setDraft] = useState<string | null>(null);
  const inRange = (number: number) =>
    (min === undefined || number >= min) && (max === undefined || number <= max);
  const finish = () => {
    if (draft === null) return;
    setDraft(null);
    if (draft.trim() === '') {
      onChange(undefined);
      return;
    }
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min ?? Number.NEGATIVE_INFINITY, parsed),
    );
    if (clamped !== value) onChange(clamped);
  };

  return (
    <InputGroup className="h-8">
      <InputGroupInput
        id={id}
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        className="h-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft ?? value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === '') return;
          const parsed = Number(raw);
          if (!Number.isNaN(parsed) && inRange(parsed)) onChange(parsed);
        }}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter') finish();
          else if (event.key === 'Escape' && draft !== null) {
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {unit ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-xs">{unit}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
