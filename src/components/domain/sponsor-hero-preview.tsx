"use client";

/**
 * SponsorHeroPreview: the preview of the home page's hero on the admin's Hero page, with the sponsored banner in it
 * and a switch between a desktop and a phone drawing.
 * Purpose: shows the admin how the hero will look with the sponsor that comes first, in the chosen layout, and what
 *   visitors see when no sponsor can be shown (S7-T11, FR-ADM-11). Owner: design system. It is a picture, not the
 *   hero: nothing in it can be clicked, and the drawing is hidden from screen readers (the boxes and the list beside
 *   it say the same things). The page works out which sponsor shows (the first active one with the format the layout
 *   needs) and passes it in; this part keeps only which size is drawn.
 * Props: layout ("search_desk" | "split"), title, subtitle and eyebrow (as in SiteHeroPreview), banner ({ desktop,
 *   phone, alt }: the addresses of the two pictures of the format the layout needs, or null when no sponsor can
 *   be shown), reason ("no_sponsors" | "none_eligible", used when the banner is null), caption (the line next to the
 *   layout's name, such as "Sample Developer · first of 2 active"), defaultDevice ("desktop" default | "phone"),
 *   words ({ device (names the switch), desktop, phone, sponsored, layouts: { search_desk, split }, reasons: {
 *   no_sponsors, none_eligible } (the badge), none: { title, text } (the note under the drawing), phoneNote (the
 *   line under the phone drawing) }), className.
 * Responsive: fills the preview column; the phone drawing is a narrow frame in its middle, with the banner under the
 *   text in both layouts, as on a phone.
 * Accessibility: the switch is a labelled group of two options (arrow keys move, one stays chosen); the drawing is
 *   aria-hidden; the note about a missing banner is a status. The banner's picture is shown at the slot's true shape
 *   and is never stretched.
 * States: Search Desk and Split, each on desktop and phone, with a banner; no sponsors at all; sponsors but none with
 *   the format the layout needs (Split is drawn as Search Desk without a banner, as visitors see it).
 * Dependencies: SiteHeroPreview, SegmentedControl, Badge, Alert, next/image. Tests: sponsor-hero-preview.test.tsx;
 *   Design Lab "Sponsor list" (S7-T11).
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

type SponsorHeroLayout = "search_desk" | "split";
type SponsorHeroDevice = "desktop" | "phone";
type SponsorHeroReason = "no_sponsors" | "none_eligible";

type SponsorHeroBanner = { desktop: string; phone: string; alt: string };

type SponsorHeroPreviewProps = {
  layout: SponsorHeroLayout;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  banner: SponsorHeroBanner | null;
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

/** The shape of the banner in each layout: a strip in Search Desk, a panel in Split (the public site's own slot shapes). */
const FORMAT_OF: Record<SponsorHeroLayout, "strip" | "panel"> = {
  search_desk: "strip",
  split: "panel",
};

function SponsorHeroPreview({
  layout,
  title,
  subtitle,
  eyebrow,
  banner,
  reason = "no_sponsors",
  caption,
  defaultDevice = "desktop",
  words,
  className,
}: SponsorHeroPreviewProps) {
  const [device, setDevice] = useState<SponsorHeroDevice>(defaultDevice);
  const phone = device === "phone";
  // With no banner to show, visitors see the search card alone, whichever layout is chosen.
  const drawn: SponsorHeroLayout = banner ? layout : "search_desk";

  const picture = banner ? (
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
        <Badge tone="neutral">{banner ? words.layouts[layout] : words.reasons[reason]}</Badge>
        {banner && caption ? <span className="text-caption text-muted">{caption}</span> : null}
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
      {banner ? null : (
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
};
