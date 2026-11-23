import { cn } from "@/lib/cn";

const RINGS = [250, 190, 130] as const;

/** One half-circle: from its left foot up over the top and down to its right foot. */
function archPath(centreX: number, centreY: number, radius: number): string {
  return ["M", centreX - radius, centreY, "a", radius, radius, 0, 0, 1, radius * 2, 0].join(" ");
}

/**
 * The live hero's faint teal arches (three half-circles at each side), drawn the same way, with one
 * extra for the experiments: `animated` draws them on and then lets them drift slowly (D).
 * Decoration only: hidden from screen readers; the picture is cropped, never squeezed, as the box
 * changes.
 */
export function LabArches({
  animated = false,
  className,
}: {
  animated?: boolean;
  className?: string;
}) {
  const arcs = (centreX: number, centreY: number) =>
    RINGS.map((radius) => (
      <path
        key={[centreX, radius].join("-")}
        d={archPath(centreX, centreY, radius)}
        pathLength={1}
      />
    ));
  return (
    <svg
      viewBox="0 0 1440 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full text-primary", className)}
      fill="none"
      stroke="currentColor"
      strokeOpacity={animated ? 0.12 : 0.08}
      strokeWidth="2"
    >
      <g className={animated ? "hl-arcs-drift" : undefined}>
        <g className={animated ? "hl-arcs-draw" : undefined}>
          {arcs(80, 470)}
          {arcs(1360, 430)}
        </g>
      </g>
    </svg>
  );
}
