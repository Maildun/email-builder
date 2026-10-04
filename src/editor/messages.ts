import { BLOCK_DEFINITIONS, BLOCK_TYPES, type BlockType } from '../core/schema/blocks';
import { SECTION_NAMES, SECTIONS, type SectionName } from '../core/sections';

/** A palette category of blocks. */
export type BlockCategory = 'content' | 'media' | 'layout' | 'advanced';

export type PaddingSide = 'top' | 'right' | 'bottom' | 'left';

/** A name and a one-line description, for palette tiles and sections. */
export interface LabelledItem {
  label: string;
  description: string;
}

/**
 * Every user-visible string in the editor UI, grouped by area. Pass a partial
 * copy to `<EmailEditor messages={…}>` to translate or reword it; anything left
 * out falls back to English (`EN_MESSAGES`).
 */
export interface EditorMessages {
  common: {
    /** Label of a custom block whose definition is missing. */
    unknownBlock: (name: string) => string;
    dragToMove: string;
    dismiss: string;
    loading: string;
  };
  topBar: {
    views: string;
    design: string;
    preview: string;
    code: string;
    add: string;
    undo: string;
    undoTip: string;
    redo: string;
    redoTip: string;
    viewport: string;
    desktop: string;
    mobile: string;
    showSidebar: string;
    hideSidebar: string;
    showInspector: string;
    hideInspector: string;
    /** Tooltip hint for the shortcut that hides or shows both panels. */
    panelsTip: string;
  };
  sidebar: {
    label: string;
    addTab: string;
    layersTab: string;
  };
  palette: {
    categories: Record<BlockCategory, string>;
    sections: string;
  };
  layers: {
    label: string;
    empty: string;
  };
  canvas: {
    label: string;
    /** `aria-roledescription` of a block on the canvas. */
    blockRole: string;
    emptyTitle: string;
    emptyDescription: string;
    addFirst: string;
    dropBlocksHere: string;
    emptyContainer: string;
    /** A known custom block that rendered nothing. */
    customInvalid: (name: string) => string;
    /** A custom block with no definition. */
    customUnknown: (name: string) => string;
    /** Screen reader name of a block: "Heading: The October update". */
    blockAriaLabel: (label: string, summary: string) => string;
    /** Screen reader announcement when the selection changes. */
    selected: (label: string) => string;
  };
  blockToolbar: {
    selectParent: string;
    moveUp: string;
    moveDown: string;
    duplicate: string;
    delete: string;
  };
  inspector: {
    label: string;
    blockTab: string;
    emailTab: string;
    proposalNotice: string;
    breadcrumb: string;
    duplicate: string;
    duplicateTip: string;
    delete: string;
    deleteTip: string;
    unknownCustom: (name: string) => string;
    invalidJson: string;
    /** Social block links. `network` is the network's display name. */
    addSocialLink: string;
    removeSocialLink: (network: string) => string;
    socialNetwork: string;
    socialUrl: (network: string) => string;
    socialIcon: (network: string) => string;
    customIcon: string;
    customIconHint: string;
    useBuiltInIcon: string;
    selectPlaceholder: string;
    widthMode: string;
    widthFill: string;
    widthNatural: string;
    widthFixed: string;
    inPixels: (label: string) => string;
    inbox: string;
    preheader: string;
    preheaderHint: string;
    preheaderPlaceholder: string;
    themeColors: string;
    typography: string;
    bodyFont: string;
    headingFont: string;
    baseSize: string;
    lineHeight: string;
    components: string;
    buttonStyle: string;
    buttonShape: string;
    buttonRadius: string;
    imageRadius: string;
    cardRadius: string;
    cardBorder: string;
    cardShadow: string;
    dividerStyle: string;
    layout: string;
    contentWidth: string;
    outerPadding: string;
    backdrop: string;
    canvas: string;
    text: string;
    links: string;
    canvasBorder: string;
    canvasRadius: string;
    none: string;
    insertMergeTag: string;
    urlPlaceholder: string;
    imagePlaceholder: string;
    choose: string;
    upload: string;
    uploading: string;
    uploadFailed: string;
    colorDefault: string;
    themeSwatches: string;
    colorSwatches: string;
    themeSwatch: (token: string) => string;
    pickColor: string;
    colorValue: string;
    colorPlaceholder: string;
    useDefault: string;
    useDefaultColor: string;
    paddingAll: string;
    paddingSide: (side: PaddingSide) => string;
    /** The one-letter side marker next to each padding input. */
    paddingSideShort: (side: PaddingSide) => string;
    separateSides: string;
    sameSides: string;
    /**
     * Translations of block field labels, section titles, option labels,
     * hints and placeholders, keyed by their English text. Missing keys show
     * the English as is.
     */
    fields: Record<string, string>;
  };
  /** The review bar for pending changes (`editor.propose()`). */
  proposal: {
    blocksChanged: (count: number) => string;
    blocksRemoved: (count: number) => string;
    themeUpdated: string;
    settingsUpdated: string;
    noVisibleChanges: string;
    showChange: string;
    showNextChange: string;
    show: string;
    reject: string;
    accept: string;
  };
  toast: {
    deleted: (label: string) => string;
    changesApplied: string;
    undo: string;
    /** Accessible name of a toast's action button: "Undo: Text deleted". */
    actionLabel: (action: string, message: string) => string;
  };
  preview: {
    frameTitle: string;
  };
  code: {
    html: string;
    text: string;
    json: string;
    size: (kilobytes: number) => string;
    copy: string;
    copied: string;
    /** Toggle: indent the HTML for reading (copying always gives the exact output). */
    format: string;
    /** Toggle: wrap long lines. */
    wrap: string;
    /** Badge on a collapsed run of a repeated entity, e.g. "× 80". */
    repeated: (count: number) => string;
    /** Tooltip on that run. */
    repeatedTip: string;
  };
  formatBar: {
    bold: string;
    boldTip: string;
    italic: string;
    italicTip: string;
    strikethrough: string;
    link: string;
    linkUrl: string;
    linkPlaceholder: string;
    apply: string;
    removeLink: string;
    bulletedList: string;
    numberedList: string;
    insertMergeTag: string;
    done: string;
  };
  /** Built-in block names and palette descriptions. */
  blocks: Record<BlockType, LabelledItem>;
  /** Palette section names and descriptions. */
  sections: Record<SectionName, LabelledItem>;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const EN_MESSAGES: EditorMessages = {
  common: {
    unknownBlock: (name) => `Unknown block (${name})`,
    dragToMove: 'Drag to move',
    dismiss: 'Dismiss',
    loading: 'Loading',
  },
  topBar: {
    views: 'View',
    design: 'Design',
    preview: 'Preview',
    code: 'Code',
    add: 'Add',
    undo: 'Undo',
    undoTip: 'Undo (⌘Z)',
    redo: 'Redo',
    redoTip: 'Redo (⇧⌘Z)',
    viewport: 'Viewport',
    desktop: 'Desktop',
    mobile: 'Mobile',
    showSidebar: 'Show sidebar',
    hideSidebar: 'Hide sidebar',
    showInspector: 'Show inspector',
    hideInspector: 'Hide inspector',
    panelsTip: '⌘\\ hides or shows both',
  },
  sidebar: {
    label: 'Blocks and layers',
    addTab: 'Add',
    layersTab: 'Layers',
  },
  palette: {
    categories: {
      content: 'Content',
      media: 'Media',
      layout: 'Layout',
      advanced: 'Advanced',
    },
    sections: 'Sections',
  },
  layers: {
    label: 'Layers',
    empty: 'No blocks yet.',
  },
  canvas: {
    label: 'Email canvas. Use the arrow keys to move between blocks.',
    blockRole: 'block',
    emptyTitle: 'Your email is empty.',
    emptyDescription: 'Drag blocks or sections here, or click one in the sidebar.',
    addFirst: 'Add a text block',
    dropBlocksHere: 'Drop blocks here',
    emptyContainer: 'Empty container',
    customInvalid: (name) =>
      `This ${name} block can't be shown: its data is invalid or its render failed.`,
    customUnknown: (name) => `Unknown custom block "${name}". Add its definition to show it.`,
    blockAriaLabel: (label, summary) => `${label}: ${summary}`,
    selected: (label) => `${label} selected`,
  },
  blockToolbar: {
    selectParent: 'Select parent',
    moveUp: 'Move up',
    moveDown: 'Move down',
    duplicate: 'Duplicate',
    delete: 'Delete',
  },
  inspector: {
    label: 'Inspector',
    blockTab: 'Block',
    emailTab: 'Email',
    proposalNotice: 'Accept or reject the proposed changes to keep editing.',
    breadcrumb: 'Breadcrumb',
    duplicate: 'Duplicate block',
    duplicateTip: 'Duplicate (⌘D)',
    delete: 'Delete block',
    deleteTip: 'Delete (⌫)',
    unknownCustom: (name) =>
      `This email uses a custom block called "${name}" that this editor doesn't know. It's kept as is and won't appear in the sent email until its definition is added.`,
    invalidJson: 'This is not valid JSON.',
    addSocialLink: 'Add link',
    removeSocialLink: (network) => `Remove ${network}`,
    socialNetwork: 'Network',
    socialUrl: (network) => `${network} link`,
    socialIcon: (network) => `${network} icon`,
    customIcon: 'Custom icon',
    customIconHint: 'Use your own image instead of the built-in icon. Square images work best.',
    useBuiltInIcon: 'Use built-in icon',
    selectPlaceholder: 'Select…',
    widthMode: 'Width mode',
    widthFill: 'Fill',
    widthNatural: 'Natural',
    widthFixed: 'Fixed',
    inPixels: (label) => `${label} in pixels`,
    inbox: 'Inbox',
    preheader: 'Preheader',
    preheaderHint: 'Preview text shown after the subject line.',
    preheaderPlaceholder: 'A short summary…',
    themeColors: 'Theme colors',
    typography: 'Typography',
    bodyFont: 'Body font',
    headingFont: 'Heading font',
    baseSize: 'Base size',
    lineHeight: 'Line height',
    components: 'Components',
    buttonStyle: 'Button style',
    buttonShape: 'Button shape',
    buttonRadius: 'Button radius',
    imageRadius: 'Image radius',
    cardRadius: 'Card radius',
    cardBorder: 'Card border',
    cardShadow: 'Card shadow',
    dividerStyle: 'Divider style',
    layout: 'Layout',
    contentWidth: 'Content width',
    outerPadding: 'Outer padding',
    backdrop: 'Backdrop',
    canvas: 'Canvas',
    text: 'Text',
    links: 'Links',
    canvasBorder: 'Canvas border',
    canvasRadius: 'Canvas radius',
    none: 'None',
    insertMergeTag: 'Insert merge tag',
    urlPlaceholder: 'https://',
    imagePlaceholder: 'https://…/image.png',
    choose: 'Choose',
    upload: 'Upload',
    uploading: 'Uploading…',
    uploadFailed: 'Upload failed.',
    colorDefault: 'Default',
    themeSwatches: 'Theme',
    colorSwatches: 'Colors',
    themeSwatch: (token) => `Theme ${token}`,
    pickColor: 'Pick a color',
    colorValue: 'Color value',
    colorPlaceholder: '#1f6feb or $primary',
    useDefault: 'Use default',
    useDefaultColor: 'Use default color',
    paddingAll: 'Padding all sides',
    paddingSide: (side) => `Padding ${side}`,
    paddingSideShort: (side) => side[0]?.toUpperCase() ?? '',
    separateSides: 'Set sides separately',
    sameSides: 'Same on all sides',
    fields: {},
  },
  proposal: {
    blocksChanged: (count) => `${plural(count, 'block')} changed`,
    blocksRemoved: (count) => `${count} removed`,
    themeUpdated: 'Theme updated',
    settingsUpdated: 'Settings updated',
    noVisibleChanges: 'No visible changes',
    showChange: 'Show the change',
    showNextChange: 'Show the next change',
    show: 'Show',
    reject: 'Reject',
    accept: 'Accept',
  },
  toast: {
    deleted: (label) => `${label} deleted`,
    changesApplied: 'Changes applied',
    undo: 'Undo',
    actionLabel: (action, message) => `${action}: ${message}`,
  },
  preview: {
    frameTitle: 'Email preview',
  },
  code: {
    html: 'HTML',
    text: 'Plain text',
    json: 'JSON',
    size: (kilobytes) => `${kilobytes} KB`,
    copy: 'Copy',
    copied: 'Copied',
    format: 'Format HTML',
    wrap: 'Wrap lines',
    repeated: (count) => `× ${count}`,
    repeatedTip:
      'Preheader filler, repeated so inboxes don’t pull body text into the preview. Collapsed here; copied in full.',
  },
  formatBar: {
    bold: 'Bold',
    boldTip: 'Bold (⌘B)',
    italic: 'Italic',
    italicTip: 'Italic (⌘I)',
    strikethrough: 'Strikethrough',
    link: 'Link',
    linkUrl: 'Link URL',
    linkPlaceholder: 'https:// or {{ tag }}',
    apply: 'Apply',
    removeLink: 'Remove link',
    bulletedList: 'Bulleted list',
    numberedList: 'Numbered list',
    insertMergeTag: 'Insert merge tag',
    done: 'Done',
  },
  blocks: Object.fromEntries(
    BLOCK_TYPES.map((type) => [
      type,
      { label: BLOCK_DEFINITIONS[type].label, description: BLOCK_DEFINITIONS[type].description },
    ]),
  ) as Record<BlockType, LabelledItem>,
  sections: Object.fromEntries(
    SECTION_NAMES.map((name) => [
      name,
      { label: SECTIONS[name].label, description: SECTIONS[name].description },
    ]),
  ) as Record<SectionName, LabelledItem>,
};

/** Optional all the way down; functions and arrays are replaced whole. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = merge(base[key], value);
  }
  return result;
}

/** Deep-merges a partial set of messages over the English defaults. */
export function resolveMessages(partial?: DeepPartial<EditorMessages>): EditorMessages {
  return partial ? (merge(EN_MESSAGES, partial) as EditorMessages) : EN_MESSAGES;
}

/** The translation of a block field label, option, hint or title; the English when there is none. */
export function translate(messages: EditorMessages, english: string): string {
  const { fields } = messages.inspector;
  return Object.hasOwn(fields, english) ? (fields[english] ?? english) : english;
}
