import type { Theme } from './schema/document';

/** Resolves `$token` references against the theme; other values pass through. */
export function resolveColor(color: string | undefined, theme: Theme): string | undefined {
  if (color === undefined) {
    return undefined;
  }
  if (color.startsWith('$')) {
    return theme.colors[color.slice(1) as keyof Theme['colors']] ?? undefined;
  }
  return color;
}

function toRgb(hex: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) {
    return undefined;
  }
  const value =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((char) => char + char)
          .join('')
      : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Blends `color` into `base`: `amount` 0 is `base`, 1 is `color`. Both must be
 * hex colors; otherwise `color` is returned unchanged.
 */
export function mixColors(color: string, base: string, amount: number): string {
  const fg = toRgb(color);
  const bg = toRgb(base);
  if (!fg || !bg) {
    return color;
  }
  const hex = fg
    .map((channel, index) => {
      const value = Math.round(channel * amount + (bg[index] ?? 0) * (1 - amount));
      return value.toString(16).padStart(2, '0');
    })
    .join('');
  return `#${hex}`;
}

/** WCAG contrast ratio between two hex colors, or undefined if either is not hex. */
export function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = toRgb(foreground);
  const bg = toRgb(background);
  if (!fg || !bg) {
    return undefined;
  }
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
