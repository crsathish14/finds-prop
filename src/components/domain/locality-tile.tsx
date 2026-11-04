/**
 * LocalityTile: a coloured tile that links to the homes in one locality.
 * Purpose: the "Popular localities" row on the homepage. Owner: design system. It holds no state
 *   and fetches nothing: the page passes the locality, where the tile leads and the line under the
 *   name (already translated, such as "Apartments · Villas").
 * Props: name, href, subtitle, tint (1 to 5, the five tints of the UX in order; the page cycles
 *   them across a row), className. A missing subtitle is left out.
 * Responsive: 150 px high; 190 px from the portal width (1100 px) up. The grid around it sets the
 *   columns (2, then 3, then 5 in the UX).
 * Accessibility: the whole tile is one link named by the locality and its subtitle. The arch is
 *   decoration. Every tint keeps the text above 4.5 : 1.
 * States: default, hover (lifts three pixels), focus, loading (LocalityTileSkeleton).
 * Dependencies: Link, Skeleton.
 * Tests: locality-tile.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: home screens, Popular localities (c-cards.css .tile). The UX tints are hard-coded
 *   colours; these use the nearest palette tokens, and tint 4 matches tint 1.
 */
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

type LocalityTint = 1 | 2 | 3 | 4 | 5;

type LocalityTileProps = {
  name: string;
  href: string;
  /** Already translated by the page, such as "Apartments · Villas". */
  subtitle?: string | undefined;
  tint?: LocalityTint;
  className?: string;
};

// The arch is green on the odd tints and copper on the even ones, as in the UX.
const TINTS: Record<LocalityTint, string> = {
  1: "bg-linear-160 from-primary-tint to-primary-tint-2 [&_svg]:text-primary",
  2: "bg-linear-160 from-cta-tint to-cta-tint-2 [&_svg]:text-cta-text",
  3: "bg-linear-160 from-neutral-tint to-line [&_svg]:text-primary",
  4: "bg-linear-160 from-primary-tint to-primary-tint-2 [&_svg]:text-cta-text",
  5: "bg-linear-160 from-cta-tint to-neutral-tint [&_svg]:text-primary",
};

/** The tint for the tile at this place in a row: 0 gives 1, 4 gives 5, 5 gives 1 again. */
function tintAt(index: number): LocalityTint {
  return ((((index % 5) + 5) % 5) + 1) as LocalityTint;
}

function LocalityTile({ name, href, subtitle, tint = 1, className }: LocalityTileProps) {
  return (
    <Link
      href={href}
      data-slot="locality-tile"
      data-tint={tint}
      className={cn(
        "relative flex h-37.5 flex-col justify-end overflow-hidden rounded-lg px-4 py-3 text-title text-primary no-underline",
        "transition-[transform,box-shadow] duration-(--dur) hover:-translate-y-0.75 hover:shadow-hover",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "portal:h-47.5 portal:px-5 portal:py-4",
        TINTS[tint],
        className,
      )}
    >
      <svg
        viewBox="0 0 46 64"
        aria-hidden="true"
        className="absolute top-4 right-4 h-14 w-10 opacity-60"
      >
        <path
          d="M5 62V27a18 18 0 0 1 36 0V62"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="23" cy="40" r="3.2" fill="currentColor" />
      </svg>
      {/* Positioned, so a long name that wraps up to the arch is drawn above it, not under it. */}
      <span className="relative">
        {name}
        {subtitle ? (
          <>
            {/* A real space, so the link's name reads "Adyar Apartments · Villas" everywhere. */}{" "}
            <small className="mt-1 block text-caption font-medium text-muted">{subtitle}</small>
          </>
        ) : null}
      </span>
    </Link>
  );
}

/** The tile while its data loads: the same box, so the row does not jump. */
function LocalityTileSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      data-slot="locality-tile-skeleton"
      className={cn("h-37.5 w-full rounded-lg portal:h-47.5", className)}
    />
  );
}

export { LocalityTile, LocalityTileSkeleton, tintAt };
export type { LocalityTint };
