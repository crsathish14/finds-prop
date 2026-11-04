/**
 * DeveloperCard: one developer (builder) with a short introduction and two of their projects.
 * Purpose: the "Builders" cards on the homepage and the Projects page. Owner: design system. It
 *   holds no state and fetches nothing: the page passes the developer's facts and projects.
 * Props: developer (name, monogram (the letters in the square; the first letters of the first two
 *   words of the name when left out), tint "green" | "copper" | "sand", projectCount, about,
 *   projects: up to two of { href, name, cover (a picture address or nothing) }), sizes (next/image
 *   `sizes` for a thumbnail), className. A missing count, introduction or project is left out,
 *   never shown blank or as zero. Only the first two projects are shown.
 * Responsive: one column of content; the two thumbnails sit side by side at every width.
 * Accessibility: each thumbnail is a link named by the project's name (its picture only decorates,
 *   so it has empty alt text). The developer's name is a heading; the monogram is decoration.
 * States: default, thumbnail hover and focus, picture missing or failed (illustrated tile), loading
 *   (DeveloperCardSkeleton).
 * Dependencies: Link, Skeleton, CardCover, next-intl.
 * Tests: developer-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: home screens, Builders section (c-cards.css .bcard).
 */
import { useTranslations } from "next-intl";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { Translate } from "@/lib/format";
import { CardCover } from "./property-card-controls.client";

type DeveloperTint = "green" | "copper" | "sand";

type DeveloperCardData = {
  name: string;
  monogram?: string | undefined;
  tint?: DeveloperTint | undefined;
  projectCount?: number | null | undefined;
  about?: string | undefined;
  projects?:
    readonly { href: string; name: string; cover?: string | null | undefined }[] | undefined;
};

type DeveloperCardProps = {
  developer: DeveloperCardData;
  sizes?: string;
  className?: string;
};

const TINTS: Record<DeveloperTint, string> = {
  green: "bg-primary-tint text-primary",
  copper: "bg-cta-tint text-cta-text",
  sand: "bg-neutral-tint text-neutral",
};

const DEFAULT_SIZES = "(min-width: 1100px) 15vw, (min-width: 640px) 25vw, 45vw";

/** "Kadal Homes" becomes "KH"; one word gives one letter. */
function monogramOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

function DeveloperCard({ developer, sizes = DEFAULT_SIZES, className }: DeveloperCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const projects = (developer.projects ?? []).slice(0, 2);
  return (
    <article
      data-slot="developer-card"
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          data-slot="developer-card-monogram"
          className={cn(
            "grid size-13 shrink-0 place-items-center rounded-md text-h3 leading-none",
            TINTS[developer.tint ?? "green"],
          )}
        >
          {developer.monogram ?? monogramOf(developer.name)}
        </span>
        <div className="min-w-0">
          <h3 className="text-title text-ink">{developer.name}</h3>
          {developer.projectCount ? (
            <p className="text-small text-muted">
              {translate("domain.developerCard.projects", { count: developer.projectCount })}
            </p>
          ) : null}
        </div>
      </div>
      {developer.about ? <p className="text-small text-muted">{developer.about}</p> : null}
      {projects.length > 0 ? (
        <ul className="mt-auto grid grid-cols-2 gap-3">
          {projects.map((project) => (
            <li key={project.href} className="min-w-0">
              <Link
                href={project.href}
                className="block overflow-hidden rounded-md border border-line bg-canvas font-semibold text-ink no-underline"
              >
                <span className="relative block aspect-16/10 overflow-hidden bg-canvas-sunken">
                  <CardCover src={project.cover} sizes={sizes} />
                </span>
                <span className="line-clamp-2 block px-3 py-2 text-caption">{project.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** The card while its data loads: the same box, so the page does not jump. */
function DeveloperCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="developer-card-skeleton"
      aria-hidden="true"
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-13 shrink-0 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton shape="text" className="w-3/5" />
          <Skeleton shape="text" className="w-2/5" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" />
        <Skeleton shape="text" className="w-4/5" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <Skeleton className="aspect-16/10 w-full rounded-md" />
        <Skeleton className="aspect-16/10 w-full rounded-md" />
      </div>
    </div>
  );
}

export { DeveloperCard, DeveloperCardSkeleton, monogramOf };
export type { DeveloperCardData, DeveloperTint };
