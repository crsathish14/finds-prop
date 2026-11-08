import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * The page the visitor is on, or undefined until the page has been hydrated in the browser.
 *
 * A page is prerendered for its own address, but the visitor can reach it through the language
 * rewrite in the proxy, so on the server and on first load in the browser the pathname can differ
 * and React reports a hydration mismatch (Next.js: usePathname, "Avoid hydration mismatch with
 * rewrites"). Everything that depends on the pathname must therefore render the same thing on the
 * server and on first hydration, and fill in the page afterwards. Components that call this hook
 * show a version without the page-dependent part until then.
 */
export function useClientPathname(): string | undefined {
  const pathname = usePathname();
  return useSyncExternalStore(
    noSubscription,
    () => pathname,
    () => undefined,
  );
}
