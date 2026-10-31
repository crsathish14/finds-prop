"use client";

import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { Text } from "@/components/ui/text";
import { NEAR_MISS_AD, SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C } from "@/lib/sponsors.fixtures";
import { DeviceFrame, Row, Specimen, Stage } from "../frame";

const THREE = [SAMPLE_AD_A, SAMPLE_AD_B, SAMPLE_AD_C];

export function AnatomyDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Text tone="muted">
        The platform owns the frame, the Sponsored label, About this ad and the pager; the
        advertiser owns only the picture. Strip: 970 by 90 from 1024 px, a 16 to 5 banner below.
        Panel: 540 by 510 from 1024 px, a 2 to 1 banner below.
      </Text>
      <Stage tone="canvas">
        <div className="flex flex-col gap-8">
          <Specimen
            label="Strip, one ad (resize the window to see the compact banner below 1024 px)"
            className="w-full"
          >
            <div className="w-full">
              <SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" />
            </div>
          </Specimen>
          <Specimen label="Strip, three ads (manual pager, no autoplay)" className="w-full">
            <div className="w-full">
              <SponsorSlot ads={THREE} placement="hero" />
            </div>
          </Specimen>
          <Specimen label="Strip, About this ad open" className="w-full">
            <div className="w-full pb-24">
              <SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" defaultInfoOpen />
            </div>
          </Specimen>
          <Specimen
            label="Strip, near-miss picture (shown whole on a neutral ground)"
            className="w-full"
          >
            <div className="w-full">
              <SponsorSlot ads={[NEAR_MISS_AD]} placement="hero" />
            </div>
          </Specimen>
        </div>
      </Stage>
      <Row>
        <Specimen label="Panel, one ad">
          <div className="w-full max-w-lg">
            <SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" layout="split" />
          </div>
        </Specimen>
        <Specimen label="Panel, three ads">
          <div className="w-full max-w-lg">
            <SponsorSlot ads={THREE} placement="hero" layout="split" />
          </div>
        </Specimen>
        <Specimen label="Panel, near-miss picture">
          <div className="w-full max-w-lg">
            <SponsorSlot ads={[NEAR_MISS_AD]} placement="hero" layout="split" />
          </div>
        </Specimen>
      </Row>
      <Specimen label="No qualifying ad: nothing is rendered, not even a label or a gap">
        <Stage className="w-full border-dashed">
          <SponsorSlot ads={[]} placement="hero" />
          <Text variant="small" tone="muted">
            (This box holds an empty slot. The next section starts straight away.)
          </Text>
        </Stage>
      </Specimen>
    </div>
  );
}

export function HeroDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        The home hero in its three arrangements, shown at real phone, tablet and desktop widths. The
        search card is a stand-in until Stage 4.
      </Text>
      <Row>
        <DeviceFrame preview="hero-a-one-ad" size="phone" height="h-200" />
        <DeviceFrame preview="hero-a-one-ad" size="tablet" height="h-200" />
      </Row>
      <DeviceFrame preview="hero-a-three-ads" size="desktop" height="h-200" />
      <Text tone="muted">
        Variation B (split): the ad sits beside the search card on a wide screen and below it on
        small ones.
      </Text>
      <Row>
        <DeviceFrame preview="hero-b-one-ad" size="phone" height="h-200" />
        <DeviceFrame preview="hero-b-one-ad" size="tablet" height="h-200" />
      </Row>
      <DeviceFrame preview="hero-b-three-ads" size="desktop" height="h-200" />
      <Text tone="muted">
        No sponsor, and the split layout without a panel ad: Search Desk, with no banner and no gap.
      </Text>
      <Row>
        <DeviceFrame preview="hero-none" size="phone" height="h-200" />
        <DeviceFrame preview="hero-split-without-ad" size="tablet" height="h-200" />
      </Row>
      <DeviceFrame preview="hero-none" size="desktop" height="h-200" />
    </div>
  );
}
