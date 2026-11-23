"use client";

import { SponsorCinematicBanner } from "@/components/domain/sponsor-cinematic-banner";
import { SponsorShowcaseCard } from "@/components/domain/sponsor-showcase-card";
import { SponsorStyledFrame } from "@/components/layout/sponsor-styled-frame";
import { Text } from "@/components/ui/text";
import type { SponsorAd } from "@/lib/sponsors";
import { STYLED_AD_A, STYLED_AD_B, STYLED_AD_C } from "@/lib/sponsors.fixtures";
import { Specimen, Stage } from "../frame";

/**
 * The hero ad styles the admin chooses between (ADR-187): the Showcase card (A) and the Cinematic banner (B), each on
 * its own and in the frame that turns them. The words are the English messages, typed here so the parts can be shown
 * without the page's translations. The photos are sample drawings, not real projects.
 */

const SHOWCASE_WORDS = {
  viewProject: "View project",
  priceList: "Get price list",
  rera: "RERA registered",
  newTab: "(opens in a new tab)",
};

const CINEMATIC_WORDS = { upNext: "Up next", newTab: "(opens in a new tab)" };

type Ready<K extends "showcase" | "cinematic"> = SponsorAd &
  Required<Pick<SponsorAd, "brand" | "photo" | K>>;

/** The samples carry every field; this narrows their type for the parts. */
function ready<K extends "showcase" | "cinematic">(ad: SponsorAd, key: K): Ready<K> {
  if (!ad.brand || !ad.photo || !ad[key]) throw new Error(`sample ${ad.id} is missing ${key}`);
  return ad as Ready<K>;
}

const THREE = [STYLED_AD_A, STYLED_AD_B, STYLED_AD_C];

export function ShowcaseCardDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        A project from the sponsor form: photo, developer, project, area, homes, size, possession
        and price. The photo stacks above the facts below 768 px. The photo drift is off here so the
        pictures stay still.
      </Text>
      <Specimen
        label="One of our projects: View project and Get price list, with a RERA number"
        className="w-full"
      >
        <SponsorShowcaseCard
          ad={ready(STYLED_AD_A, "showcase")}
          words={SHOWCASE_WORDS}
          drift={false}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="Another site: one button that opens a new tab; only the required facts"
        className="w-full"
      >
        <SponsorShowcaseCard
          ad={ready(STYLED_AD_B, "showcase")}
          words={SHOWCASE_WORDS}
          drift={false}
          className="w-full"
        />
      </Specimen>
      <Specimen label="A very long developer and project name" className="w-full">
        <SponsorShowcaseCard
          ad={ready(STYLED_AD_C, "showcase")}
          words={SHOWCASE_WORDS}
          drift={false}
          className="w-full"
        />
      </Specimen>
    </div>
  );
}

export function CinematicBannerDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        A tall photo with the words laid on a shade: 300 px tall from 768 px with the words on the
        left, 400 px below with the words at the bottom. The gold line and the drift are off here so
        the pictures stay still.
      </Text>
      <Specimen
        label="With eyebrow, line and Up next (the box shows from 768 px)"
        className="w-full"
      >
        <SponsorCinematicBanner
          ad={ready(STYLED_AD_A, "cinematic")}
          next={{ brand: "Sample Builders", photo: ready(STYLED_AD_B, "cinematic").photo }}
          words={CINEMATIC_WORDS}
          drift={false}
          drawLine={false}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="Only the headline and the button; another site (opens a new tab)"
        className="w-full"
      >
        <SponsorCinematicBanner
          ad={ready(STYLED_AD_B, "cinematic")}
          words={CINEMATIC_WORDS}
          drift={false}
          drawLine={false}
          className="w-full"
        />
      </Specimen>
    </div>
  );
}

export function StyledFrameDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Text tone="muted">
        The hero ads in the frame: Sponsored, About this ad, the progress bars and the previous and
        next buttons. The ads turn when the bar is full, wait while the pointer or focus is on them,
        and never turn by themselves for people who prefer less motion.
      </Text>
      <Stage tone="canvas">
        <div className="flex flex-col gap-8">
          <Specimen label="Showcase, three ads (try the buttons)" className="w-full">
            <div className="w-full">
              <SponsorStyledFrame ads={THREE} style="showcase" />
            </div>
          </Specimen>
          <Specimen label="Cinematic, three ads" className="w-full">
            <div className="w-full">
              <SponsorStyledFrame ads={THREE} style="cinematic" />
            </div>
          </Specimen>
          <Specimen label="One ad: no bars and no buttons; About this ad open" className="w-full">
            <div className="w-full pb-24">
              <SponsorStyledFrame ads={[STYLED_AD_B]} style="showcase" defaultInfoOpen />
            </div>
          </Specimen>
        </div>
      </Stage>
    </div>
  );
}
