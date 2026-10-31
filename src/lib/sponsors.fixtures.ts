/**
 * Sample sponsors for tests and the Design Lab: the approved UX sample pictures, copied to
 * public/design-lab/ads. They are SVG, so they skip image optimisation. Not real advertisers.
 */
import type { SponsorAd, SponsorCreatives } from "./sponsors";

const AD_PATH = "/design-lab/ads";

function creatives(strip: string, panel: string): Pick<SponsorAd, "strip" | "panel"> {
  const stripCreatives: SponsorCreatives = {
    desktop: {
      src: `${AD_PATH}/strip-970x90-${strip}.svg`,
      width: 970,
      height: 90,
      unoptimized: true,
    },
    compact: {
      src: `${AD_PATH}/strip-m-320x100-${strip}.svg`,
      width: 320,
      height: 100,
      unoptimized: true,
    },
  };
  const panelCreatives: SponsorCreatives = {
    desktop: {
      src: `${AD_PATH}/panel-524x494-${panel}.svg`,
      width: 524,
      height: 494,
      unoptimized: true,
    },
    compact: {
      src: `${AD_PATH}/panel-m-640x320-${panel}.svg`,
      width: 640,
      height: 320,
      unoptimized: true,
    },
  };
  return { strip: stripCreatives, panel: panelCreatives };
}

function sampleAd(letter: "a" | "b" | "c", overrides: Partial<SponsorAd> = {}): SponsorAd {
  return {
    id: `sample-${letter}`,
    active: true,
    placements: ["hero", "results"],
    alt: `Sample advertiser banner ${letter.toUpperCase()}`,
    href: `https://sponsor.example/${letter}`,
    ...creatives(letter, letter),
    ...overrides,
  };
}

export const SAMPLE_AD_A = sampleAd("a");
export const SAMPLE_AD_B = sampleAd("b");
export const SAMPLE_AD_C = sampleAd("c");

/** The pictures the UX drew to be a little off the slot shape: shown whole, not cropped. */
export const NEAR_MISS_AD: SponsorAd = sampleAd("a", {
  id: "sample-near-miss",
  alt: "Sample near-miss banner",
  strip: {
    desktop: {
      src: `${AD_PATH}/near-miss-strip-970x120.svg`,
      width: 970,
      height: 120,
      unoptimized: true,
    },
    compact: {
      src: `${AD_PATH}/strip-m-320x100-a.svg`,
      width: 320,
      height: 100,
      unoptimized: true,
    },
  },
  panel: {
    desktop: {
      src: `${AD_PATH}/near-miss-panel-524x600.svg`,
      width: 524,
      height: 600,
      unoptimized: true,
    },
    compact: {
      src: `${AD_PATH}/panel-m-640x320-a.svg`,
      width: 640,
      height: 320,
      unoptimized: true,
    },
  },
});
