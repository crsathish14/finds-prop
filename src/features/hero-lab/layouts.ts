import type { CSSProperties } from "react";

/**
 * The homepage hero layouts the hero lab can show. A "desk" (Search desk) and B "split" are the live
 * ones, chosen by the super admin; C "conversational" and D "layered" are experiments
 * shown only where the Design Lab is on, never in production.
 */
export const HERO_LAB_LAYOUTS = ["desk", "split", "conversational", "layered"] as const;
export type HeroLabLayout = (typeof HERO_LAB_LAYOUTS)[number];

/** The letter of each layout, as the address and the switch use it (/?layout=c). */
const LETTERS: Record<HeroLabLayout, string> = {
  desk: "a",
  split: "b",
  conversational: "c",
  layered: "d",
};

/** The address name that picks a layout. */
export const HERO_LAB_PARAM = "layout";

/** The id of the hero's headline, which names the hero section (one hero is on the page at a time). */
export const HERO_TITLE_ID = "home-hero-title";

/** A layout from the address, by letter (c) or name (conversational); null when there is none. */
export function parseHeroLabLayout(value: string | null | undefined): HeroLabLayout | null {
  const wanted = value?.trim().toLowerCase() ?? "";
  return HERO_LAB_LAYOUTS.find((layout) => layout === wanted || LETTERS[layout] === wanted) ?? null;
}

/** The letter the address carries for a layout. */
export function heroLabLetter(layout: HeroLabLayout): string {
  return LETTERS[layout];
}

/** C and D bring their own motion, and the sections under them reveal as they scroll in. */
export function isExperiment(layout: HeroLabLayout | null): boolean {
  return layout === "conversational" || layout === "layered";
}

type MotionVariables = CSSProperties & Record<`--hl-${string}`, string | number>;

/** The place of an item in the entrance (src/styles/hero-lab.css, .hl-in and .hl-pop). */
export function entranceOrder(index: number): MotionVariables {
  return { "--hl-i": index };
}

/** How far a layer of the layered hero moves with the pointer and the scroll (.hl-layer). */
export function layerDepth(depth: number): MotionVariables {
  return { "--hl-depth": depth };
}
