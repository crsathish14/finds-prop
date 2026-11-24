"use client";

/**
 * SponsorHeroPreview: the preview of the home page's hero on the admin's Hero page, with the sponsored banner in it
 * and a switch between a desktop and a phone drawing.
 * Purpose: shows the admin how the hero will look with the sponsor that comes first, in the chosen layout, and what
 *   visitors see when no sponsor can be shown (S7-T11, FR-ADM-11). Owner: design system. It is a picture, not the
 *   hero: nothing in it can be clicked, and the drawing is hidden from screen readers (the boxes and the list beside
 *   it say the same things). The page works out which sponsor shows (the first active one with the format the layout
 *   needs) and passes it in; this part keeps only which size is drawn.
 * Props: layout ("search_desk" | "split" | "conversational"), title, subtitle and eyebrow (as in SiteHeroPreview), styled (the
 *   ad under the search bar in the chosen style, ADR-190: { style "showcase" | "cinematic", photo, brand, title, line },
 *   drawn small: the photo beside the project and price for the Showcase, the headline on the photo for the Cinematic
 *   banner; used in Search Desk and Conversational), banner ({ desktop,
 *   phone, alt }: the addresses of the two pictures of the format the layout needs, or null when no sponsor can
 *   be shown), reason ("no_sponsors" | "none_eligible", used when the banner is null), caption (the line next to the
 *   layout's name, such as "Sample Developer · first of 2 active"), defaultDevice ("desktop" default | "phone"),
 *   words ({ device (names the switch), desktop, phone, sponsored, layouts: { search_desk, split, conversational }, reasons: {
 *   no_sponsors, none_eligible } (the badge), none: { title, text } (the note under the drawing), phoneNote (the
 *   line under the phone drawing) }), className.
 * Responsive: fills the preview column; the phone drawing is a narrow frame in its middle, with the banner under the
 *   text in both layouts, as on a phone.
 * Loading: the pictures load at once (a preview is small and sits low on a long page; a lazy picture would show as an
 *   empty box in a photograph of the page).
 * Accessibility: the switch is a labelled group of two options (arrow keys move, one stays chosen); the drawing is
 *   aria-hidden; the note about a missing banner is a status. The banner's picture is shown at the slot's true shape
 *   and is never stretched.
 * States: Search Desk and Split, each on desktop and phone, with a banner; no sponsors at all; sponsors but none with
 *   the format the layout needs (Split is drawn as Search Desk without a banner, as visitors see it).
 * Dependencies: SiteHeroPreview, SegmentedControl, Badge, Alert, next/image. Tests: sponsor-hero-preview.test.tsx;
 *   Design Lab "Sponsors" (S7-T11).
 * UX reference: admin-sponsors screen (the live preview card: .live-prev, .lp-bar, .seg).
 */
import Image from "next/image";
import { useState } from "react";
import { SiteHeroPreview } from "@/components/domain/site-hero-preview";
import { Alert } from "@/components/patterns/alert";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { SLOT_RATIOS } from "@/lib/sponsors";

type SponsorHeroLayout = "search_desk" | "split" | "conversational";
type SponsorHeroDevice = "desktop" | "phone";
type SponsorHeroReason = "no_sponsors" | "none_eligible" | "none_ready";

/** The styled hero ad, drawn small in the preview (ADR-190). */
type SponsorHeroStyled = {
  style: "showcase" | "cinematic";
  photo: string;
  brand: string;
  title: string;
  line?: string | undefined;
};

type SponsorHeroBanner = { desktop: string; phone: string; alt: string };

type SponsorHeroPreviewProps = {
  layout: SponsorHeroLayout;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  banner: SponsorHeroBanner | null;
  styled?: SponsorHeroStyled | undefined;
  reason?: SponsorHeroReason;
  caption?: string;
  defaultDevice?: SponsorHeroDevice;
  words: {
    device: string;
    desktop: string;
    phone: string;
    sponsored: string;
    layouts: Record<SponsorHeroLayout, string>;
    reasons: Record<SponsorHeroReason, string>;
    none: { title: string; text: string };
    phoneNote: string;
  };
  className?: string;
};

/** The shape of the banner in each layout: a strip in Search Desk and Conversational, a panel in Split (the public site's own slot shapes). */
const FORMAT_OF: Record<SponsorHeroLayout, "strip" | "panel"> = {
  search_desk: "strip",
  split: "panel",
  conversational: "strip",
};

function SponsorHeroPreview({
  layout,
  title,
  subtitle,
  eyebrow,
  banner,
  styled,
  reason = "no_sponsors",
  caption,
  defaultDevice = "desktop",
  words,
  className,
}: SponsorHeroPreviewProps) {
  const [device, setDevice] = useState<SponsorHeroDevice>(defaultDevice);
  const phone = device === "phone";
  // With no ad to show, visitors see the search card alone, whichever layout is chosen.
  const shown = banner !== null || styled !== undefined;
  const drawn: SponsorHeroLayout = shown ? layout : "search_desk";

  const picture = styled ? (
    <span className="flex flex-col gap-1">
      <span className="text-overline text-muted">{words.sponsored}</span>
      {styled.style === "showcase" ? (
        <span
          className={cn(
            "grid overflow-hidden rounded-md border border-line bg-surface",
            phone ? "grid-cols-1" : "grid-cols-[1.15fr_1fr]",
          )}
        >
          <span className="relative block aspect-16/10 bg-canvas-sunken">
            <Image
              src={styled.photo}
              alt=""
              fill
              unoptimized
              loading="eager"
              sizes="200px"
              className="object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-col gap-1 p-2">
            <span className="truncate text-caption text-muted">{styled.brand}</span>
            <span className="truncate text-small font-bold text-ink">{styled.title}</span>
            {styled.line ? (
              <span className="truncate text-caption text-ink">{styled.line}</span>
            ) : null}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "relative block overflow-hidden rounded-md bg-dark",
            phone ? "aspect-3/4" : "aspect-[970/300]",
          )}
        >
          <Image
            src={styled.photo}
            alt=""
            fill
            unoptimized
            loading="eager"
            sizes="320px"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-linear-to-t from-dark/90 to-transparent md:bg-linear-to-r" />
          <span className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
            <span className="truncate text-caption text-on-dark-muted">{styled.brand}</span>
            <span className="text-small font-bold text-on-dark">{styled.title}</span>
          </span>
        </span>
      )}
    </span>
  ) : banner ? (
    <span className="flex flex-col gap-1">
      <span className="text-overline text-muted">{words.sponsored}</span>
      <span
        style={{ aspectRatio: SLOT_RATIOS[FORMAT_OF[layout]][phone ? "compact" : "desktop"] }}
        className={cn(
          "relative block w-full overflow-hidden border border-line bg-canvas-sunken",
          layout === "split" ? "rounded-lg" : "rounded-md",
        )}
      >
        <Image
          src={phone ? banner.phone : banner.desktop}
          alt=""
          fill
          unoptimized
          loading="eager"
          sizes="320px"
          className="object-cover"
        />
      </span>
    </span>
  ) : null;

  return (
    <div data-slot="sponsor-hero-preview" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SegmentedControl
        size="sm"
        aria-label={words.device}
        value={device}
        onValueChange={(next) => setDevice(next === "phone" ? "phone" : "desktop")}
        options={[
          { value: "desktop", label: words.desktop },
          { value: "phone", label: words.phone },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{shown ? words.layouts[layout] : words.reasons[reason]}</Badge>
        {shown && caption ? <span className="text-caption text-muted">{caption}</span> : null}
      </div>
      <div className={cn("min-w-0", phone && "mx-auto w-full max-w-56")}>
        <SiteHeroPreview
          title={title}
          layout={drawn}
          banner={picture}
          stacked={phone}
          {...(subtitle ? { subtitle } : {})}
          {...(eyebrow ? { eyebrow } : {})}
        />
      </div>
      {banner && phone ? <p className="text-caption text-muted">{words.phoneNote}</p> : null}
      {shown ? null : (
        <Alert tone="neutral" title={words.none.title}>
          {words.none.text}
        </Alert>
      )}
    </div>
  );
}

export { SponsorHeroPreview };
export type {
  SponsorHeroBanner,
  SponsorHeroDevice,
  SponsorHeroLayout,
  SponsorHeroPreviewProps,
  SponsorHeroReason,
  SponsorHeroStyled,
};
