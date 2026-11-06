"use client";

import { useEffect, useRef } from "react";
import { trackProjectEvent } from "./actions";

/**
 * Records that a project page was opened (FR-SYS-03, BR-71): once for each project this page shows,
 * from the browser, so a crawler that only reads the HTML is not counted. It draws nothing and never
 * shows an error: a view that could not be recorded is not worth interrupting a reader for. The
 * database keeps one view per visitor per project per hour, so a reload counts once.
 */
export function ProjectViewTracker({ slug }: { slug: string }) {
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (recorded.current === slug) return;
    recorded.current = slug;
    trackProjectEvent({ slug, event: "view" }).catch(() => undefined);
  }, [slug]);
  return null;
}
