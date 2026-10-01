import { Popover as BasePopover } from '@base-ui/react/popover';
import { Select } from '@base-ui/react/select';
import { Switch } from '@base-ui/react/switch';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Tooltip } from '@base-ui/react/tooltip';
import { Check, ChevronDown } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  createContext,
  forwardRef,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
} from 'react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Element popups portal into, so they inherit the editor's CSS variables. */
export const PortalContext = createContext<HTMLElement | null>(null);

function usePortal() {
  return useContext(PortalContext) ?? undefined;
}

type ButtonVariant = 'default' | 'ghost' | 'primary' | 'danger' | 'outline';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'icon';
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', active, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-active={active ? '' : undefined}
      className={cx('meb-btn', `meb-btn-${variant}`, `meb-btn-${size}`, className)}
      {...props}
    />
  );
});

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
  const container = usePortal();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} delay={400} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner side={side} sideOffset={6}>
          <Tooltip.Popup className="meb-tooltip">{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const TooltipProvider = Tooltip.Provider;

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
  const container = usePortal();
  return (
    <BasePopover.Root
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal container={container}>
        <BasePopover.Positioner side={side} align={align} sideOffset={6} className="meb-positioner">
          <BasePopover.Popup className={cx('meb-popover', className)}>{children}</BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

/** Labelled form row. */
export function Field({
  label,
  hint,
  children,
  inline,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  return (
    <div className={cx('meb-field', inline && 'meb-field-inline')}>
      <label className="meb-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint ? <p className="meb-hint">{hint}</p> : null}
    </div>
  );
}

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible label when `label` is an icon. */
  title?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  ariaLabel,
}: {
  value: T | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      id={id}
      aria-label={ariaLabel}
      className="meb-segmented"
      value={value === undefined ? [] : [value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (picked !== undefined) onChange(picked as T);
      }}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="meb-segment"
          aria-label={option.title}
        >
          {option.label}
        </Toggle>
      ))}
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
  const container = usePortal();
  return (
    <Select.Root
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value ?? null}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
    >
      <Select.Trigger id={id} className="meb-input meb-select-trigger">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="meb-select-icon">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner sideOffset={4} className="meb-positioner" alignItemWithTrigger={false}>
          <Select.Popup className="meb-popover meb-select-popup">
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="meb-select-item">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="meb-select-check">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
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
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      className="meb-switch"
      nativeButton
      render={<button type="button" />}
    >
      <Switch.Thumb className="meb-switch-thumb" />
    </Switch.Root>
  );
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
  return (
    <div className="meb-number">
      <input
        id={id}
        aria-label={ariaLabel}
        className="meb-input"
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
      />
      {unit ? <span className="meb-unit">{unit}</span> : null}
    </div>
  );
}
