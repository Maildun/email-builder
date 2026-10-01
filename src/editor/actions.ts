import type { EditorStore } from './store';

/**
 * Moves focus to the editor shell before the focused control unmounts, so
 * focus does not fall back to <body> and keyboard shortcuts keep working.
 */
function keepFocus(from: Element | null | undefined): void {
  from?.closest<HTMLElement>('.meb-shell')?.focus({ preventScroll: true });
}

export function removeBlock(store: EditorStore, id: string, from?: Element | null): void {
  keepFocus(from);
  store.apply({ op: 'remove', id });
}

/** Duplicates a block and selects the copy. */
export function duplicateBlock(store: EditorStore, id: string, from?: Element | null): void {
  keepFocus(from);
  const result = store.apply({ op: 'duplicate', id });
  if (result.inserted[0]) store.select(result.inserted[0]);
}
