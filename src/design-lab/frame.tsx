/**
 * Small layout helpers for the Design Lab pages. They are not shared components: nothing outside
 * src/design-lab uses them.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One specimen with a caption saying which variant or state it is. */
export function Specimen({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col items-start gap-2", className)}>
      <figcaption className="text-caption font-semibold text-muted">{label}</figcaption>
      {children}
    </figure>
  );
}

/** A wrapping row of specimens. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start gap-x-8 gap-y-6", className)}>{children}</div>
  );
}

/** A column of specimens, each as wide as the stage. */
export function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex max-w-lg flex-col gap-5", className)}>{children}</div>;
}

/** A framed area the demo sits in; "dark" is for components made for dark surfaces. */
export function Stage({
  children,
  tone = "surface",
  className,
}: {
  children: ReactNode;
  tone?: "surface" | "canvas" | "dark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line p-6",
        tone === "surface" && "bg-surface",
        tone === "canvas" && "bg-canvas",
        tone === "dark" && "on-dark border-dark bg-dark text-on-dark",
        className,
      )}
    >
      {children}
    </div>
  );
}

const FRAME_WIDTHS = { phone: "w-97.5", tablet: "w-205", desktop: "w-320" } as const;
const FRAME_NAMES = { phone: "390", tablet: "820", desktop: "1280" } as const;

/**
 * A real page in an iframe at a fixed width, so media queries answer to the frame and not to the
 * window. Used for the organisms that change with the screen (header, bottom bar, portal shell).
 */
export function DeviceFrame({
  preview,
  size,
  height = "h-150",
}: {
  preview: string;
  size: keyof typeof FRAME_WIDTHS;
  height?: string;
}) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-caption font-semibold text-muted">
        {FRAME_NAMES[size]} px wide
      </figcaption>
      <div
        role="region"
        aria-label={`${preview} at ${FRAME_NAMES[size]} px`}
        // Scrolls sideways when the window is narrower than the frame, so it must be reachable by keyboard.
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-lg border border-line-strong bg-surface"
      >
        <iframe
          src={`/design-system/preview/${preview}`}
          title={`${preview} at ${FRAME_NAMES[size]} px`}
          className={cn("block max-w-none", FRAME_WIDTHS[size], height)}
        />
      </div>
    </figure>
  );
}
