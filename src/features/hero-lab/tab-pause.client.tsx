"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the tab is in the background: the hero's loops pause ([data-hl-paused], src/styles/hero-lab.css). */
export function useTabHidden(): boolean {
  return useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
}

/**
 * PauseWhenHidden: wraps a hero so that its running loops (the light round the search bar) stop
 * while the tab is hidden and start again when it is shown. It adds no box of its own to the layout.
 */
export function PauseWhenHidden({ children }: { children: ReactNode }) {
  const hidden = useTabHidden();
  return (
    <div className="contents" data-hl-paused={hidden ? "" : undefined}>
      {children}
    </div>
  );
}
