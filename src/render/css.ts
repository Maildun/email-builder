import { type Padding, resolvePadding } from '../core/schema/primitives';

/** Builds an inline style string, skipping empty values. */
export function css(declarations: Record<string, string | number | undefined | false>): string {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== false && value !== '')
    .map(([property, value]) => `${property}:${value}`)
    .join(';');
}

export function px(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${value}px`;
}

export function paddingCss(padding: Padding | undefined): string | undefined {
  if (padding === undefined) {
    return undefined;
  }
  const p = resolvePadding(padding);
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

export function horizontalPadding(padding: Padding | undefined): number {
  const p = resolvePadding(padding);
  return p.left + p.right;
}

export function fontWeightCss(weight: 'normal' | 'bold' | number | undefined): string | undefined {
  return weight === undefined ? undefined : String(weight);
}
