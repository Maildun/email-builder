import type { EmailDocument, Settings, Theme, ThemeStyles } from './schema/document';

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: '#1f6feb',
    secondary: '#6e40c9',
    text: '#1f2328',
    muted: '#656d76',
    background: '#f4f5f7',
    surface: '#ffffff',
    border: '#d8dee4',
    link: '#1f6feb',
  },
  fonts: {
    body: 'MODERN_SANS',
    heading: 'MODERN_SANS',
  },
};

type Styles = NonNullable<ThemeStyles>;

export type ResolvedThemeStyles = { [K in keyof Styles]-?: Required<NonNullable<Styles[K]>> };

/**
 * What blocks look like when neither they nor `theme.styles` say otherwise.
 * These match how emails rendered before theme styles existed.
 */
export const DEFAULT_THEME_STYLES: ResolvedThemeStyles = {
  button: {
    variant: 'solid',
    shape: 'rounded',
    radius: 6,
    size: 'md',
    fontWeight: 'bold',
    uppercase: false,
    letterSpacing: 0,
  },
  image: { radius: 0 },
  card: { radius: 8, border: false, shadow: 'none' },
  divider: { style: 'solid', thickness: 1 },
};

/** The theme's component styles with every gap filled from `DEFAULT_THEME_STYLES`. */
export function resolveThemeStyles(theme: Theme): ResolvedThemeStyles {
  const styles: Styles = theme.styles ?? {};
  const merge = <K extends keyof ResolvedThemeStyles>(key: K): ResolvedThemeStyles[K] => {
    const own = Object.entries(styles[key] ?? {}).filter(([, value]) => value !== undefined);
    return { ...DEFAULT_THEME_STYLES[key], ...Object.fromEntries(own) };
  };
  return {
    button: merge('button'),
    image: merge('image'),
    card: merge('card'),
    divider: merge('divider'),
  };
}

export const DEFAULT_SETTINGS: Settings = {
  width: 600,
  padding: { top: 32, right: 0, bottom: 32, left: 0 },
  backdropColor: '$background',
  canvasColor: '$surface',
  textColor: '$text',
  linkColor: '$link',
  fontSize: 16,
  lineHeight: 1.5,
};

export function emptyDocument(): EmailDocument {
  return {
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    theme: structuredClone(DEFAULT_THEME),
    root: [],
    blocks: {},
  };
}
