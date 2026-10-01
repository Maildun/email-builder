import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';
import type { CustomBlockDefinition, CustomBlocks } from '../core/custom';
import type { BlockType } from '../core/schema/blocks';
import type { SectionName } from '../core/sections';
import { DEFAULT_ASSETS_URL } from '../core/social';
import { type EditorMessages, EN_MESSAGES } from './messages';
import type { EditorAgent } from './panels/AgentPanel';
import type { EditorState, EditorStore, EditorView } from './store';

export interface MergeTag {
  /** Tag key, rendered as `{{ key }}`. */
  key: string;
  label?: string;
}

export interface ImageResult {
  url: string;
  alt?: string;
}

/** Parts of the editor that accept a class name and carry a matching `data-slot`. */
export type EditorSlot =
  | 'root'
  | 'topbar'
  | 'sidebar'
  | 'stage'
  | 'canvas'
  | 'inspector'
  | 'assistant'
  | 'block-toolbar';

export type EditorClassNames = Partial<Record<EditorSlot, string>>;

export interface EditorOptions {
  readOnly: boolean;
  mergeTags: MergeTag[];
  classNames?: EditorClassNames;
  /** Enables the assistant. */
  agent?: EditorAgent;
  /** Host-defined block types, and the same list by name. */
  customBlocks: CustomBlocks;
  customBlockMap: ReadonlyMap<string, CustomBlockDefinition>;
  /** Built-in block types offered in the palette (all when undefined). */
  blockTypes?: readonly BlockType[];
  /** Sections offered in the palette (all when undefined, none when empty). */
  sections?: readonly SectionName[];
  /** Views offered in the top bar. */
  views: readonly EditorView[];
  onUploadImage?: (file: File) => Promise<ImageResult>;
  onPickImage?: () => Promise<ImageResult | null>;
  /** The UI text, already merged over the English defaults. */
  messages: EditorMessages;
  /** Where the social icons are hosted (see `RenderOptions.assetsUrl`). */
  assetsUrl: string;
}

const StoreContext = createContext<EditorStore | null>(null);
export const DEFAULT_OPTIONS: EditorOptions = {
  readOnly: false,
  mergeTags: [],
  customBlocks: [],
  customBlockMap: new Map(),
  views: ['design', 'preview', 'code'],
  messages: EN_MESSAGES,
  assetsUrl: DEFAULT_ASSETS_URL,
};

const OptionsContext = createContext<EditorOptions>(DEFAULT_OPTIONS);

export function EditorProvider({
  store,
  options,
  children,
}: {
  store: EditorStore;
  options: EditorOptions;
  children: ReactNode;
}) {
  return (
    <StoreContext.Provider value={store}>
      <OptionsContext.Provider value={options}>{children}</OptionsContext.Provider>
    </StoreContext.Provider>
  );
}

/** The editor store of the nearest `<EmailEditor>`. */
export function useEditorStore(): EditorStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useEditorStore must be used inside <EmailEditor>.');
  }
  return store;
}

/** Subscribes to a slice of editor state. Selectors must return stable values. */
export function useEditorState<T>(selector: (state: EditorState) => T): T {
  const store = useEditorStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** The document on screen: the pending proposal, or the committed document. */
export function useVisibleDocument() {
  return useEditorState((state) => state.proposal?.document ?? state.document);
}

export function useEditorOptions(): EditorOptions {
  return useContext(OptionsContext);
}

/** The host's extra class name for one part of the editor. */
export function useSlotClassName(slot: EditorSlot): string | undefined {
  return useContext(OptionsContext).classNames?.[slot];
}

/** The editor's UI text (translated when the host passed `messages`). */
export function useMessages(): EditorMessages {
  return useContext(OptionsContext).messages;
}
