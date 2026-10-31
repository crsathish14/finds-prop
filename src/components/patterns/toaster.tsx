"use client";

/**
 * Toaster: the place where short confirmation messages (toasts) appear. Mount it once, in the
 *   layout. Show messages with `notify` (src/lib/notify.ts).
 * Purpose: dark ink toasts at the bottom centre, above the bottom bar on phones. Owner: design
 *   system. Built on sonner. A toast never carries the only copy of an error: show an Alert too.
 * Props: closeLabel and containerLabel (required, already-translated, e.g. "Close" and
 *   "Notifications").
 * Responsive: up to 420 px wide; on phones it sits above the 66 px bottom bar.
 * Accessibility: messages are announced politely in a live region; a toast pauses while hovered
 *   or focused and lasts 6 seconds; the keyboard shortcut Alt+T moves focus to the toasts; the
 *   close button and any Undo button are real buttons.
 * States: success, error, info, with or without an action. Dependencies: sonner, Icon.
 * Tests: toast.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, toast (c-core.css .toast).
 */
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = { closeLabel: string; containerLabel: string };

function Toaster({ closeLabel, containerLabel }: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      duration={6000}
      closeButton
      theme="light"
      // customAriaLabel replaces the whole label; the default appends the English text "alt+T".
      customAriaLabel={containerLabel}
      mobileOffset={{ bottom: "calc(var(--bottombar-h) + var(--s-4))" }}
      icons={{
        success: <CircleCheck className="size-5.5" aria-hidden="true" />,
        error: <CircleAlert className="size-5.5" aria-hidden="true" />,
        info: <Info className="size-5.5" aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: closeLabel,
        classNames: {
          toast:
            "flex w-full max-w-105 items-center gap-3 rounded-lg bg-ink py-3 pr-3 pl-4 text-small font-medium text-on-primary shadow-pop",
          icon: "shrink-0 text-on-dark-muted",
          content: "min-w-0 flex-1",
          title: "font-bold",
          description: "text-on-dark-muted",
          actionButton:
            "shrink-0 rounded-sm px-3 py-2 font-bold text-focus-on-dark hover:bg-dark-hover",
          closeButton:
            "grid size-9 shrink-0 place-items-center rounded-sm text-on-dark-muted hover:bg-dark-hover",
        },
      }}
    />
  );
}

export { Toaster };
