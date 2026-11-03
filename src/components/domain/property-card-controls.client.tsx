"use client";

/**
 * PropertyCard controls: the save heart, the Compare toggle and the cover picture of a property card.
 * Purpose: the three parts of a card that need the browser. Owner: design system. The card itself
 *   (property-card.tsx) holds no state; the page passes these in, wired to saving and comparing
 *   (S5-T01 saved homes, S4-T02 compare).
 * Props: SaveButton (saved, onToggle), CompareToggle (compared, disabled when three homes are
 *   already chosen, onToggle), CardCover (src and alt of the cover picture, sizes, priority).
 * Responsive: the heart is a 44 px target in the corner of the picture; Compare is a 44 px row in the
 *   card's foot. The picture fills its box at a fixed ratio and never changes the card's size.
 * Accessibility: both are real buttons with aria-pressed. The heart is named "Save to shortlist" or
 *   "Remove from saved homes". A disabled Compare says why in its title ("You can compare up to 3
 *   homes"). A picture that fails to load is replaced by the illustrated tile.
 * States: SaveButton: default, hover, focus, saved. CompareToggle: default, hover, focus, added,
 *   disabled. CardCover: loaded, missing, failed.
 * Dependencies: next/image, Icon, ArchIllustration, next-intl. Tests: property-card.test.tsx;
 *   Design Lab "Domain" (S4-T01).
 * UX reference: search screen, property card (c-cards.css .pcard-save, .cmp, .pcard-media).
 */
import { Check, Heart } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArchIllustration } from "@/components/ui/arch-illustration";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type SaveButtonProps = { saved: boolean; onToggle: () => void; className?: string };

function SaveButton({ saved, onToggle, className }: SaveButtonProps) {
  const translate = useTranslations("domain.propertyCard");
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? translate("unsave") : translate("save")}
      onClick={onToggle}
      className={cn(
        "group/save absolute top-2 right-2 z-20 grid size-(--size-icon-btn) place-items-center rounded-pill text-ink",
        "before:absolute before:inset-1 before:rounded-pill before:bg-surface/95 before:shadow-card before:content-['']",
        "hover:before:bg-surface aria-pressed:text-cta",
        className,
      )}
    >
      <Icon icon={Heart} className={cn("relative", saved && "fill-current")} />
    </button>
  );
}

type CompareToggleProps = {
  compared: boolean;
  /** True when three homes are already chosen and this one is not one of them. */
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
};

function CompareToggle({ compared, disabled = false, onToggle, className }: CompareToggleProps) {
  const translate = useTranslations("domain.propertyCard");
  return (
    <button
      type="button"
      aria-pressed={compared}
      disabled={disabled}
      title={disabled ? translate("compareLimit") : undefined}
      onClick={onToggle}
      className={cn(
        "group/compare -ml-2 inline-flex min-h-(--size-touch-min) items-center gap-2 rounded-sm px-2 text-small font-bold text-primary",
        "disabled:cursor-not-allowed disabled:text-subtle",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-xs border-[length:var(--bw-field)] border-line-input bg-surface text-on-primary",
          "group-hover/compare:border-primary group-aria-pressed/compare:border-primary group-aria-pressed/compare:bg-primary",
          "group-disabled/compare:border-line group-disabled/compare:bg-canvas-sunken",
        )}
      >
        <Icon icon={Check} size="sm" className="opacity-0 group-aria-pressed/compare:opacity-100" />
      </span>
      {compared ? translate("compared") : translate("compare")}
    </button>
  );
}

type CardCoverProps = {
  /** The picture's address, or nothing when the home has no picture. */
  src?: string | null | undefined;
  /** What the picture shows; empty for a picture that only decorates. */
  alt?: string | undefined;
  /** next/image `sizes` for the grid column this card sits in (R-FE-12). */
  sizes: string;
  priority?: boolean;
};

function CardCover({ src, alt = "", sizes, priority = false }: CardCoverProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        data-slot="card-cover-fallback"
        className="absolute inset-0 grid place-items-center bg-canvas-sunken text-line-strong"
      >
        <ArchIllustration className="size-18 opacity-70" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Drawn placeholders (the Design Lab) are SVG, which Next.js does not optimise; photographs do.
      unoptimized={src.endsWith(".svg")}
      onError={() => setFailed(true)}
      className="object-cover transition-transform duration-500 group-hover/card:scale-105 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
    />
  );
}

export { CardCover, CompareToggle, SaveButton };
