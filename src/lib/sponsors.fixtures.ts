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
      height: 117,
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
      height: 150,
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

const PHOTO_PATH = "/design-lab/sponsor-photos";

const photo = (name: string) => ({
  src: `${PHOTO_PATH}/${name}.svg`,
  width: 1600,
  height: 900,
  unoptimized: true,
});

/** A sample ready for both styles that links to one of our projects (ADR-182, ADR-187). Not a real advertiser. */
export const STYLED_AD_A: SponsorAd = {
  id: "styled-a",
  active: true,
  placements: ["hero", "results"],
  alt: "Sample Homes: Lakeview Residences",
  href: "/projects/lakeview-residences",
  external: false,
  projectSlug: "lakeview-residences",
  brand: "Sample Homes",
  photo: photo("photo-a"),
  showcase: {
    project: "Lakeview Residences",
    locality: "Sholinganallur, OMR, Chennai",
    homes: "2 & 3 BHK",
    size: "1,120 to 1,640 sq ft",
    possession: "Ready Dec 2027",
    price: "₹78 L onwards",
    rera: "TN/00/SAMPLE/0000/2026",
  },
  cinematic: {
    eyebrow: "New launch · OMR",
    headline: "Homes that open onto the lake",
    line: "2 & 3 BHK at Lakeview Residences, from ₹78 L. Site visits every weekend.",
    button: "Explore Lakeview",
  },
};

/** A sample that links to another site, with only the words each style needs. */
export const STYLED_AD_B: SponsorAd = {
  id: "styled-b",
  active: true,
  placements: ["hero", "results"],
  alt: "Sample Builders: Coastal Greens villas",
  href: "https://samplebuilders.example/coastal-greens",
  external: true,
  brand: "Sample Builders",
  photo: photo("photo-b"),
  showcase: {
    project: "Coastal Greens",
    locality: "ECR, Chennai",
    homes: "4 BHK villas",
    price: "₹2.1 Cr onwards",
  },
  cinematic: {
    headline: "Villas a short walk from the sea",
    button: "Visit Coastal Greens",
  },
};

/** A third sample, with a very long project name and headline. */
export const STYLED_AD_C: SponsorAd = {
  id: "styled-c",
  active: true,
  placements: ["hero", "results"],
  alt: "Sample Developers: Velachery One",
  href: "/projects/velachery-one",
  external: false,
  projectSlug: "velachery-one",
  brand: "Sample Developers and Promoters",
  photo: photo("photo-c"),
  showcase: {
    project: "Velachery One Grand Residences Phase Two",
    locality: "Velachery, Chennai",
    homes: "3 BHK",
    possession: "Ready to move",
    price: "₹1.2 Cr onwards",
  },
  cinematic: {
    eyebrow: "Ready to move",
    headline: "Three bedroom homes in Velachery",
    line: "Move in this month.",
    button: "See Velachery One",
  },
};
