import { useEffect, useSyncExternalStore } from "react";

/**
 * Lets an error page ask the phone bottom bar to show. The bar decides by the page address which
 * pages show it, but an error page keeps the address of the page that failed (a missing property
 * is /properties/some-slug, where the bar is hidden), and the approved UX shows the bar on error
 * pages. The page asks while it is on screen and stops asking when it goes away.
 */
let requests = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while some error page on screen has asked for the bar. False on the server. */
export function useBottomBarRequested(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => requests > 0,
    () => false,
  );
}

/** Call from an error page: the bottom bar shows for as long as the page is mounted. */
export function useRequestBottomBar(): void {
  useEffect(() => {
    requests += 1;
    notify();
    return () => {
      requests -= 1;
      notify();
    };
  }, []);
}
