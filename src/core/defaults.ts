import type { EmailDocument, Settings, Theme } from './schema/document';

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
