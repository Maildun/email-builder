import { createContext, useContext } from 'react';

/**
 * Element popups portal into. It lives inside `.meb-root`, so popups inherit
 * the editor's theme variables and scoped styles.
 */
export const PortalContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContext) ?? undefined;
}
