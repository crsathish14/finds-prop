/**
 * SponsorSlot: the sponsored banner area of a page. It shows nothing when there is nothing to show.
 * Purpose: picks the banners that qualify for a placement and layout (selectSponsors in
 *   src/lib/sponsors.ts) and renders them in SponsorFrame. Owner: design system. The ads come from
 *   the admin sponsor settings; until Stage 8 the Design Lab passes fixtures.
 * Props: ads (SponsorAd list in admin order), placement ("hero" | "results"), layout ("search_desk"
 *   | "split", the live hero layout), defaultInfoOpen, className.
 * Responsive: see SponsorFrame. When nothing qualifies there is no frame, no label, no "your ad
 *   here" and no empty space; the page continues as if the slot did not exist.
 * Accessibility: see SponsorFrame.
 * States: no ad, one ad, several ads, near-miss shape (shown whole), info open, a picture failed.
 * Dependencies: SponsorFrame, selectSponsors. Tests: sponsor.test.tsx; Design Lab "Ads" (S2-T07).
 * UX reference: ds-ads; homepage-ad-variations (variations A and B, and the fallback).
 */
import {
  selectSponsors,
  type HeroLayout,
  type SponsorAd,
  type SponsorPlacement,
} from "@/lib/sponsors";
import { SponsorFrame } from "./sponsor-frame";

type SponsorSlotProps = {
  ads: SponsorAd[];
  placement: SponsorPlacement;
  layout?: HeroLayout;
  defaultInfoOpen?: boolean;
  className?: string;
};

function SponsorSlot({
  ads,
  placement,
  layout = "search_desk",
  defaultInfoOpen,
  className,
}: SponsorSlotProps) {
  const { format, sponsors } = selectSponsors({ ads, placement, layout });
  if (sponsors.length === 0) return null;
  return (
    <SponsorFrame
      sponsors={sponsors}
      format={format}
      {...(defaultInfoOpen === undefined ? {} : { defaultInfoOpen })}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export { SponsorSlot };
