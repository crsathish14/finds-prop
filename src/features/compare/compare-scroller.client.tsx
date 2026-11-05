"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** How close to the end counts as being at it, in pixels (fractions of a pixel appear when zoomed). */
const END_SLACK = 2;

/**
 * The box the comparison table scrolls in. On a narrow screen the table is wider than the box, so it scrolls
 * sideways (the label column stays); a soft fade at the right edge tells the visitor there is more, and goes
 * when the end is reached or when everything fits (a tablet or a desktop). The fade is decoration: it takes
 * no clicks and is hidden from screen readers.
 */
export function CompareScroller({ children }: { children: ReactNode }) {
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
        className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card"
      >
        {children}
      </div>
      {more ? (
        <div
          data-slot="compare-scroll-hint"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-xl bg-linear-to-l from-surface to-transparent"
        />
      ) : null}
    </div>
  );
}
