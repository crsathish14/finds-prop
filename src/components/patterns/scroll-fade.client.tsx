"use client";

/**
 * ScrollFade: the box a wide table scrolls sideways in, with a soft fade that says there is more.
 * Purpose: the comparison table and the project's units table are wider than a phone, so they scroll
 *   sideways (a sticky label column stays); the fade at the right edge tells the visitor there is more.
 *   Owner: design system. It measures its own box and holds only whether there is more to the right.
 * Props: children (the table, as the box's first element), className (added to the scrolling box),
 *   labelledBy (the id of the heading that names the table: when given, the box is a named group that
 *   takes keyboard focus, so a keyboard user can scroll it with the arrow keys; give it when the table has
 *   nothing focusable inside, as a table of plain text has).
 * Responsive: the fade shows only while the table is wider than the box and the end is not reached, so a
 *   tablet or a desktop that fits the table never sees it.
 * Accessibility: the fade is decoration: it takes no clicks and is hidden from screen readers. The
 *   scrolling itself is the browser's. With `labelledBy` the box is focusable (a scrollable area must be
 *   reachable by keyboard) and shows the focus ring; without it the box is a plain overflow area.
 * States: everything fits (no fade), more to the right (fade), at the end (no fade).
 * Dependencies: React, cn.
 * Tests: scroll-fade.test.tsx; Design Lab "Discovery" and "Projects" (S4-T02, S4-T09).
 * UX reference: none: the owner asked for the hint on 5 Nov 2026; it is not in the UX.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** How close to the end counts as being at it, in pixels (fractions of a pixel appear when zoomed). */
const END_SLACK = 2;

export function ScrollFade({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const node = box.current;
    if (!node) return;
    setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - END_SLACK);
  }, []);

  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    // The observer reports once when it starts and again whenever the box or the table changes size.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const table = node.firstElementChild;
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="relative">
      <div
        ref={box}
        onScroll={measure}
        {...(labelledBy === undefined
          ? {}
          : { role: "group", "aria-labelledby": labelledBy, tabIndex: 0 })}
        className={cn(
          "overflow-x-auto rounded-xl border border-line bg-surface shadow-card outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary",
          className,
        )}
      >
        {children}
      </div>
      {more ? (
        <div
          data-slot="scroll-fade-hint"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-xl bg-linear-to-l from-surface to-transparent"
        />
      ) : null}
    </div>
  );
}
