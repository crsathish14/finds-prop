/**
 * Alert: a message that stays on the page: a success, warning, error, tip or note.
 * Purpose: inline feedback near what it is about (use a toast only for brief confirmations, and
 *   never as the only copy of an error). Owner: design system.
 * Props: tone ("info" default | "success" | "warning" | "danger" | "neutral"), title (optional,
 *   already-translated), children (the message), action (an optional Link or Button), urgent (read
 *   at once even when the tone is not danger, as the chat's "too many messages" notice is), className.
 * Responsive: full width of its container; the action wraps under the text on narrow screens.
 * Accessibility: danger, or any tone with urgent, renders role="alert" (read at once); the other
 *   tones render role="status" (read politely). Each tone has its own icon, so colour is not the only signal.
 * States: five tones. Dependencies: Icon, cva, cn.
 * Tests: display.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, alerts (c-core.css .alert).
 */
import { cva } from "class-variance-authority";
import {
  CircleAlert,
  CircleCheck,
  Info,
  StickyNote,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

const alertStyles = cva("flex items-start gap-3 rounded-md border px-4 py-3 text-small", {
  variants: {
    tone: {
      info: "border-info/30 bg-info-tint text-info",
      success: "border-success/30 bg-success-tint text-success",
      warning: "border-warning/30 bg-warning-tint text-warning",
      danger: "border-danger/30 bg-danger-tint text-danger",
      neutral: "border-line-strong bg-canvas-sunken text-ink",
    },
  },
  defaultVariants: { tone: "info" },
});

const TONE_ICONS: Record<NonNullable<AlertProps["tone"]>, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: StickyNote,
};

type AlertProps = {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  urgent?: boolean;
  className?: string;
};

function Alert({ tone = "info", title, children, action, urgent, className }: AlertProps) {
  const readAtOnce = urgent ?? tone === "danger";
  return (
    <div
      data-slot="alert"
      role={readAtOnce ? "alert" : "status"}
      className={cn(alertStyles({ tone }), className)}
    >
      <Icon icon={TONE_ICONS[tone]} className="mt-px" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="font-medium">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 font-bold">{action}</div> : null}
    </div>
  );
}

export { Alert };
