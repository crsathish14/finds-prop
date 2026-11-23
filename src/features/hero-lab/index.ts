/**
 * Hero lab: two experimental homepage heroes (C conversational, D layered) beside the two live ones
 * (A search desk, B split), with a floating switch and ?layout=a|b|c|d to compare them.
 * Preview only: the homepage renders it only where the Design Lab is on (never in production), and
 * the live heroes, search, ads and sections are reused unchanged. Motion: src/styles/hero-lab.css.
 */
export { HeroLabSections } from "./hero-lab.client";
export { HERO_LAB_LAYOUTS, parseHeroLabLayout, type HeroLabLayout } from "./layouts";
export { HeroLabPreview } from "./preview";
