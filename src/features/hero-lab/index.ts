/**
 * Hero lab: the homepage heroes side by side: A search desk, B split and C conversational (live,
 * chosen by the super admin, ADR-177) and the experimental D layered, with a floating switch and
 * ?layout=a|b|c|d to compare them. The lab renders only where the Design Lab is on (never in
 * production); the live heroes, search, ads and sections are reused unchanged. C's live render
 * (ConversationalLive) is shared by the lab and the page. Motion: src/styles/hero-lab.css.
 */
export { ConversationalLive } from "./conversational-live";
export { HeroLabSections } from "./hero-lab.client";
export { HERO_LAB_LAYOUTS, parseHeroLabLayout, type HeroLabLayout } from "./layouts";
export { HeroLabPreview } from "./preview";
