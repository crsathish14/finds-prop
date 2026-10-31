import type { LabEntry } from "../types";
import {
  AlertsDemo,
  ToastDemo,
  DialogDemo,
  SheetDemo,
  PopoverTooltipDemo,
  EmptyDemo,
  LoadingDemo,
} from "./feedback-demos";

export const FEEDBACK: LabEntry[] = [
  {
    id: "alerts",
    name: "Alerts",
    description:
      "Five tones, each with its own icon; an error is announced at once, the rest politely.",
    sources: ["patterns/alert.tsx"],
    Demo: AlertsDemo,
  },
  {
    id: "toasts",
    name: "Toasts",
    description:
      "Short confirmations at the bottom centre (above the bottom bar on phones), with Undo. Never the only copy of an error.",
    sources: ["patterns/toaster.tsx"],
    Demo: ToastDemo,
  },
  {
    id: "dialogs",
    name: "Confirm dialogs",
    description:
      "A destructive action focuses the safe button first; a plain confirmation focuses Confirm.",
    sources: ["patterns/confirm-dialog.tsx"],
    Demo: DialogDemo,
  },
  {
    id: "sheets",
    name: "Sheets and drawers",
    description: "A bottom sheet for filters and a side drawer for forms.",
    sources: ["patterns/sheet.tsx"],
    Demo: SheetDemo,
  },
  {
    id: "popover-and-tooltip",
    name: "Popover and tooltip",
    description: "A small panel anchored to a button, and a hint on hover or focus.",
    sources: ["patterns/popover.tsx", "ui/tooltip.tsx"],
    Demo: PopoverTooltipDemo,
  },
  {
    id: "empty-states",
    name: "Empty states",
    description: "The arch drawing, what is missing, one sentence and at most one next step.",
    sources: ["patterns/empty-state.tsx", "ui/arch-illustration.tsx"],
    Demo: EmptyDemo,
  },
  {
    id: "loading",
    name: "Loading",
    description: "Spinner sizes and skeleton shapes; the shimmer stops under reduced motion.",
    sources: ["ui/spinner.tsx", "ui/skeleton.tsx"],
    Demo: LoadingDemo,
  },
];
