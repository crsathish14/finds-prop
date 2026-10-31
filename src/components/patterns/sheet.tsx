"use client";

/**
 * Sheet: a panel that slides over the page: a bottom sheet on phones, a side drawer for forms.
 * Purpose: filters on phones, the enquiry form, long menus, edit panels. Owner: design system.
 *   Wraps Radix Dialog (focus trap, Escape, scroll lock). Drag-to-dismiss is not included.
 * Props: Sheet (open, onOpenChange, defaultOpen), SheetTrigger (use asChild), SheetContent (side
 *   "bottom" default | "right", tone "default" | "dark", title and closeLabel required and already-translated, description
 *   optional, footer optional for sticky actions), SheetClose.
 * Responsive: the bottom sheet is full width, up to 90% of the screen height, with a grabber; the
 *   right drawer is up to 540 px wide and full height.
 * Accessibility: role dialog named by its title; focus moves in, is trapped, and returns to the
 *   trigger on close; Escape and the close button close it. Content behind is inert.
 * States: closed, open. Dependencies: radix Dialog, IconButton, Icon, cn.
 * Tests: overlays.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, sheet and drawer (c-core.css .sheet, .drawer-side).
 */
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

function Sheet(props: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close data-slot="sheet-close" {...props} />;
}

const panelStyles = cva("flex flex-col bg-surface shadow-modal", {
  variants: {
    side: {
      bottom: "max-h-[90vh] w-full rounded-t-xl",
      right: "h-full w-full max-w-135",
    },
  },
  defaultVariants: { side: "bottom" },
});

const placementStyles = {
  bottom: "items-end",
  right: "items-stretch justify-end",
} as const;

type SheetContentProps = Omit<ComponentProps<typeof Dialog.Content>, "title"> & {
  side?: "bottom" | "right";
  /** "dark" is for the portal sidebar drawer: dark green with light text. */
  tone?: "default" | "dark";
  title: string;
  closeLabel: string;
  description?: string;
  footer?: ReactNode;
};

function SheetContent({
  side = "bottom",
  tone = "default",
  title,
  closeLabel,
  description,
  footer,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn("fixed inset-0 z-drawer flex bg-primary-deep/60", placementStyles[side])}
      >
        <Dialog.Content
          data-slot="sheet-content"
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          className={cn(
            panelStyles({ side }),
            tone === "dark" && "on-dark bg-dark text-on-dark",
            className,
          )}
          {...props}
        >
          {side === "bottom" ? (
            <span
              aria-hidden="true"
              className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-pill bg-line-strong"
            />
          ) : null}
          <header
            className={cn(
              "flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4",
              tone === "dark" ? "border-dark-line" : "border-line",
            )}
          >
            <Dialog.Title
              className={cn("text-h3", tone === "dark" ? "text-on-dark" : "text-primary")}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label={closeLabel} tone={tone === "dark" ? "on-dark" : "default"}>
                <Icon icon={X} />
              </IconButton>
            </Dialog.Close>
          </header>
          {description ? (
            <Dialog.Description className="px-6 pt-4 text-small text-muted">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 justify-end gap-3 border-t border-line px-6 py-4">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTrigger };
