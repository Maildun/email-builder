import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';
import type { EditorState, EditorStore } from './store';

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
  onUploadImage?: (file: File) => Promise<ImageResult>;
  onPickImage?: () => Promise<ImageResult | null>;
}

const StoreContext = createContext<EditorStore | null>(null);
const OptionsContext = createContext<EditorOptions>({ readOnly: false, mergeTags: [] });

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
