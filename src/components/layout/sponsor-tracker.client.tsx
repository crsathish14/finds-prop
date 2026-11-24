"use client";

/**
 * SponsorTracker: counts a paid placement for the sponsor report (ADR-194): once when it is seen and once when one of
 *   its links is followed.
 * Purpose: wraps a placement (a hero ad, the Featured project card, the Developer spotlight) and tells the server
 *   through the action it is handed. Seen means at least half of it on screen for a second (SPONSOR_VIEW_MS), which
 *   a crawler reading the HTML never does. Owner: design system. It draws nothing of its own and never shows an error:
 *   a count that could not be sent is not worth interrupting a reader for.
 * Props: slot ("hero" | "results" | "spotlight"), sponsorKey (the hero ad's id or the builder's id), record (the
 *   server action; left out, nothing is counted, as in the Design Lab), active (false while a hero ad waits its turn in
 *   the frame: it is not on show, so it is not seen), children, className (for the wrapper, such as a full row).
 * Responsive: the wrapper is a plain block around the placement.
 * Accessibility: no role, no focus, no text; the placement inside keeps its own.
 * States: waiting to be seen, seen (counted once while it stays on the page), clicked (counted once).
 * Dependencies: IntersectionObserver (where the browser has none, views are not counted). Tests:
 *   sponsor-tracker.test.tsx.
 * UX reference: none (it draws nothing).
 */
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import {
  SPONSOR_VIEW_MS,
  SPONSOR_VIEW_SHARE,
  type SponsorEventSlot,
  type SponsorRecorder,
} from "@/lib/sponsor-events";

type SponsorTrackerProps = {
  slot: SponsorEventSlot;
  sponsorKey: string;
  record?: SponsorRecorder | undefined;
  active?: boolean;
  children: ReactNode;
  className?: string;
};

function SponsorTracker({
  slot,
  sponsorKey,
  record,
  active = true,
  children,
  className,
}: SponsorTrackerProps) {
  const box = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);
  const clicked = useRef(false);

  useEffect(() => {
    const node = box.current;
    if (!record || !active || viewed.current || !node) return;
    if (typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= SPONSOR_VIEW_SHARE,
        );
        if (seen && timer === undefined) {
          timer = setTimeout(() => {
            viewed.current = true;
            observer.disconnect();
            record({ slot, key: sponsorKey, kind: "view" }).catch(() => undefined);
          }, SPONSOR_VIEW_MS);
        } else if (!seen && timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, SPONSOR_VIEW_SHARE] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [record, active, slot, sponsorKey]);

  const countClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!record || clicked.current) return;
    if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
    clicked.current = true;
    record({ slot, key: sponsorKey, kind: "click" }).catch(() => undefined);
  };

  return (
    <div ref={box} data-slot="sponsor-tracker" className={className} onClickCapture={countClick}>
      {children}
    </div>
  );
}

export { SponsorTracker };
export type { SponsorTrackerProps };
