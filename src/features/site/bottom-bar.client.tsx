"use client";

import type { ReactNode } from "react";
import { BottomBar } from "@/components/layout/bottom-bar";
import { useBottomBarRequested } from "@/lib/bottom-bar-request";
import { bottomBarCurrentKey, isBottomBarVisible, type BottomBarKey } from "./chrome";
import { useClientPathname } from "@/lib/client-pathname";

type BottomBarNavProps = {
  navLabel: string;
  items: { key: BottomBarKey; label: string; href: string; icon: ReactNode; raised?: boolean }[];
};

/**
 * The phone bottom bar on the pages the navigation doc lists (and nowhere else), with the current
 * item marked. It is fixed to the screen, so an empty block of the same height follows the footer
 * and the last line of the page is never hidden behind it. From 768 px both disappear.
 *
 * Error pages ask for it explicitly (see bottom-bar-request), because they keep the address of the
 * page that failed.
 *
 * Which pages show it depends on the pathname, which the server cannot be sure of (see
 * useClientPathname), so it appears once the page has been hydrated.
 */
export function BottomBarNav({ navLabel, items }: BottomBarNavProps) {
  const pathname = useClientPathname();
  const requested = useBottomBarRequested();
  if (pathname === undefined || !(requested || isBottomBarVisible(pathname))) return null;
  const current = bottomBarCurrentKey(pathname);
  return (
    <>
      <div aria-hidden="true" className="h-(--bottombar-h) md:hidden" />
      <BottomBar
        navLabel={navLabel}
        items={items.map(({ key, ...item }) => ({ ...item, current: key === current }))}
      />
    </>
  );
}
