import { customBlockMap } from '../core/custom';
import type { EditorMessages } from './messages';
import { blockLabel } from './meta';
import type { EditorStore } from './store';

/**
 * Moves focus to the editor shell before the focused control unmounts, so
 * focus does not fall back to <body> and keyboard shortcuts keep working.
 */
function keepFocus(from: Element | null | undefined): void {
  from?.closest<HTMLElement>('.meb-shell')?.focus({ preventScroll: true });
}

/**
 * Removes a block and offers Undo in a toast. The store has no access to the
 * editor's UI text, so callers pass the messages (from `useMessages()`).
 */
export function removeBlock(
  store: EditorStore,
  id: string,
  messages: EditorMessages,
  from?: Element | null,
): void {
  keepFocus(from);
  const block = store.getState().document.blocks[id];
  if (!block || !store.apply({ op: 'remove', id }).ok) return;
  const label = blockLabel(block, customBlockMap(store.customBlocks), messages);
  store.showToast(messages.toast.deleted(label), {
    label: messages.toast.undo,
    run: () => store.undo(),
  });
}

/** Duplicates a block and selects the copy. */
export function duplicateBlock(store: EditorStore, id: string, from?: Element | null): void {
  keepFocus(from);
  const result = store.apply({ op: 'duplicate', id });
  if (result.inserted[0]) store.select(result.inserted[0]);
}
