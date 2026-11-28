import { useSyncExternalStore } from "react";

/**
 * True while the browser's window matches the media query, and false while the page is built on the server and for the
 * first paint (so server and browser agree), then live. Use it for what only exists on some sizes, such as the AI
 * chat's cards page, which is drawn at the lg breakpoint and up.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
