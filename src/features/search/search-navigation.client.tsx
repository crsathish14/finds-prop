"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { buildSearchHref } from "./params";
import type { SearchParams } from "./schemas";

/**
 * How the results page changes its address (frontend.md 6.1 rule 3). One place decides it, so the
 * rail, the bar, the chips and "Show more" cannot differ:
 * - a change from the wide rail, the bar or a chip replaces the address and keeps the scroll position;
 * - the phone sheet's Show button pushes once and starts at the top;
 * - Try again asks the server again without changing the address.
 * While the new page is on its way `pending` is true, and the list shows its loading skeleton.
 * In the Design Lab (`preview`) nothing navigates, so a specimen cannot leave the board.
 */
type SearchNavigation = {
  params: SearchParams;
  pending: boolean;
  /** True while the page that is on its way is a longer list ("Show more"): the cards stay put. */
  pendingMore: boolean;
  go: (next: Partial<SearchParams>, mode?: "replace" | "push") => void;
  retry: () => void;
};

const NavigationContext = createContext<SearchNavigation | null>(null);

export function SearchNavigationProvider({
  params,
  preview = false,
  children,
}: {
  params: SearchParams;
  preview?: boolean;
  children: ReactNode;
}) {
  return preview ? (
    <PreviewNavigation params={params}>{children}</PreviewNavigation>
  ) : (
    <LiveNavigation params={params}>{children}</LiveNavigation>
  );
}

/** The Design Lab's navigation: it shows the state it is given and goes nowhere. */
function PreviewNavigation({ params, children }: { params: SearchParams; children: ReactNode }) {
  const value = useMemo<SearchNavigation>(
    () => ({
      params,
      pending: false,
      pendingMore: false,
      go: () => undefined,
      retry: () => undefined,
    }),
    [params],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

function LiveNavigation({ params, children }: { params: SearchParams; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asksMore, setAsksMore] = useState(false);

  const go = useCallback(
    (next: Partial<SearchParams>, mode: "replace" | "push" = "replace") => {
      const href = buildSearchHref(next);
      setAsksMore(next.show !== undefined && next.show > params.show);
      startTransition(() => {
        if (mode === "push") router.push(href);
        else router.replace(href, { scroll: false });
      });
    },
    [params.show, router],
  );

  const retry = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const value = useMemo(
    () => ({ params, pending, pendingMore: pending && asksMore, go, retry }),
    [params, pending, asksMore, go, retry],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useSearchNavigation(): SearchNavigation {
  const value = useContext(NavigationContext);
  if (value === null) throw new Error("useSearchNavigation needs a SearchNavigationProvider");
  return value;
}
