"use client";

/**
 * Tabs: switch between views of the same page (Listings, Enquiries, Saved...).
 * Purpose: a row of tabs that each show their own panel, built on Radix Tabs so the keyboard and
 *   screen reader behaviour is right. Owner: design system. To make a tab deep-linkable, control it from the
 *   URL: pass `value` from `?tab=` and change the URL in `onValueChange`.
 * Props: Tabs (value or defaultValue, onValueChange), TabsList (aria-label, required, already-
 *   translated), TabsTrigger (value, count, countTone "default" | "new"), TabsContent (value).
 * Responsive: the list scrolls sideways on phones and the active tab stays visible.
 * Accessibility: role tablist; arrow keys move between tabs, Home and End jump; the selected tab
 *   is announced. A count is part of the tab name, so say what it counts in the tab text.
 * States: default, hover, focus, selected, disabled. Dependencies: radix Tabs, cn.
 * Tests: overlays.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, tabs (c-core.css .tabs, .tab).
 */
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
  );
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex gap-5 overflow-x-auto border-b border-line-strong [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & {
  count?: number | string;
  countTone?: "default" | "new";
};

function TabsTrigger({
  className,
  count,
  countTone = "default",
  children,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group relative inline-flex h-(--size-tab) flex-none items-center gap-2 px-1 text-title-sm whitespace-nowrap text-muted",
        "transition-colors duration-(--dur-fast) hover:text-primary",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:content-[''] data-[state=active]:text-primary data-[state=active]:after:bg-cta",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? " " : null}
      {count !== undefined ? (
        <span
          className={cn(
            "inline-grid h-5.5 min-w-5.5 place-items-center rounded-pill px-2 text-caption font-bold",
            countTone === "new"
              ? "bg-cta text-on-cta"
              : "bg-canvas-sunken text-ink group-data-[state=active]:bg-primary group-data-[state=active]:text-on-primary",
          )}
        >
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn("pt-6", className)} {...props} />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
