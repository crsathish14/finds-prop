"use client";

import { ArrowRight, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { compareBarMode, compareHref, COMPARE_MAX, COMPARE_MIN, type CompareEntry } from "./store";
import { useCompare } from "./use-compare.client";

/** How the bar is placed: above the phone's bottom bar, beside a home's page from 1024 px, or in the flow (the Design Lab). */
export type CompareBarPlacement = "above-bottom-bar" | "wide-only" | "inline";

type CompareBarViewProps = {
  entries: readonly CompareEntry[];
  placement: CompareBarPlacement;
  onRemove: (id: string) => void;
  onClear: () => void;
};

/**
 * The bar itself (S4-T02, ADR-044, FR-PUB-10): three slots with the chosen homes' pictures, "N of 3
 * selected" with what to do next, Clear all, and "Compare now", which stays off until two are chosen.
 * Each filled slot has its own remove button. It holds nothing: the connected bar below (or the Design
 * Lab) gives it the entries.
 */
export function CompareBarView({ entries, placement, onRemove, onClear }: CompareBarViewProps) {
  const translate = useTranslations("compare");
  const hint = useTranslations("domain.propertyCard");
  const count = entries.length;
  const ready = count >= COMPARE_MIN;
  const slots = Array.from({ length: COMPARE_MAX }, (_, index) => entries[index]);
  const inline = placement === "inline";

  return (
    <div
      role="region"
      aria-label={translate("bar.label")}
      data-slot="compare-bar"
      className={cn(
        !inline && "pointer-events-none fixed inset-x-4 bottom-5 z-sticky",
        placement === "above-bottom-bar" && "max-md:bottom-(--bottombar-h)",
        placement === "wide-only" && "max-lg:hidden",
        inline && "w-full",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-line-strong bg-surface px-3 py-2 shadow-pop md:gap-4 md:pl-4",
          !inline && "pointer-events-auto",
          placement === "above-bottom-bar" && "max-md:mb-3",
        )}
      >
        <ul className="flex gap-1 md:gap-2">
          {slots.map((entry, index) => (
            <li
              key={entry?.id ?? `empty-${index}`}
              className={cn(
                "relative h-10 w-11 overflow-hidden rounded-md bg-canvas-sunken md:h-12 md:w-16",
                entry
                  ? "border-0"
                  : "border-[length:var(--bw-field)] max-md:hidden border-dashed border-line-strong",
              )}
            >
              {entry ? (
                <>
                  {entry.cover ? (
                    <Image
                      src={entry.cover}
                      alt=""
                      fill
                      sizes="64px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                  <IconButton
                    aria-label={
                      entry.title === ""
                        ? translate("bar.removeUntitled")
                        : translate("bar.remove", { title: entry.title })
                    }
                    onClick={() => onRemove(entry.id)}
                    className="absolute top-0.5 right-0.5 size-5 bg-ink/80 text-on-primary hover:bg-ink"
                  >
                    <Icon icon={X} size="sm" />
                  </IconButton>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="min-w-0 flex-1 text-small font-bold text-ink max-md:flex-none max-md:whitespace-nowrap">
          <span aria-live="polite" className="max-md:sr-only">
            {translate("bar.count", { count })}
          </span>
          <span aria-hidden="true" className="md:hidden">
            {translate("bar.countShort", { count })}
          </span>
          <small className="block text-caption font-medium text-muted max-md:hidden">
            {ready ? hint("compareLimit") : translate("bar.chooseMore")}
          </small>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="max-md:hidden">
          {translate("bar.clearAll")}
        </Button>
        {ready ? (
          <Button asChild size="sm" className="max-md:ml-auto">
            <Link
              href={compareHref(entries.map((entry) => entry.id))}
              className="text-on-primary no-underline hover:text-on-primary"
            >
              {translate("bar.compareNow")}
              <Icon icon={ArrowRight} size="sm" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled className="max-md:ml-auto">
            {translate("bar.compareNow")}
            <Icon icon={ArrowRight} size="sm" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The bar that appears after the first home is chosen for comparing. It reads the browser's selection,
 * so it draws nothing on the server and on the first render, then appears; it is drawn on the homepage
 * and the results (above the phone's bottom bar) and beside a home's page from 1024 px, and nowhere else
 * (`compareBarMode`).
 */
export function CompareBar() {
  const pathname = usePathname();
  const compare = useCompare();
  const mode = compareBarMode(pathname);
  if (compare.list.length === 0 || mode === "hidden") return null;
  return (
    <CompareBarView
      entries={compare.list}
      placement={mode}
      onRemove={compare.remove}
      onClear={compare.clear}
    />
  );
}
