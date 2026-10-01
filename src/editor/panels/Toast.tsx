import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { useEffect } from 'react';
import { useEditorState, useEditorStore, useMessages } from '../context';
import { Button, Icon } from '../ui';

const TOAST_MS = 5000;

/** Short confirmations over the canvas, like "Text deleted · Undo". */
export function EditorToast() {
  const store = useEditorStore();
  const toast = useEditorState((state) => state.toast);
  const messages = useMessages();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => store.dismissToast(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [store, toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4"
    >
      {toast ? (
        <div
          key={toast.id}
          data-slot="toast"
          className="pointer-events-auto flex h-9 animate-in items-center gap-1 rounded-lg border bg-popover pr-1 pl-3 text-popover-foreground text-sm shadow-lg duration-150 fade-in-0 slide-in-from-top-2"
        >
          <span className="pr-1">{toast.message}</span>
          {toast.action ? (
            <Button
              size="xs"
              variant="secondary"
              aria-label={messages.toast.actionLabel(toast.action.label, toast.message)}
              onClick={() => {
                toast.action?.run();
                store.dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </Button>
          ) : null}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={messages.common.dismiss}
            onClick={() => store.dismissToast(toast.id)}
          >
            <Icon icon={Cancel01Icon} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
