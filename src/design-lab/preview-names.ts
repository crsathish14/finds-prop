/** The whole-page previews, served at /design-system/preview/<name>. A plain list so the browser tests can read it. */
export const PREVIEW_NAMES = [
  "header-signed-out",
  "header-signed-in",
  "bottom-bar",
  "footer",
  "portal-admin",
  "hero-a-one-ad",
  "hero-a-three-ads",
  "hero-a-near-miss",
  "hero-b-one-ad",
  "hero-b-three-ads",
  "hero-b-near-miss",
  "hero-none",
  "hero-split-without-ad",
  "wizard-basics",
  "wizard-review",
  "admin-listings",
  "admin-review",
  "admin-reject",
] as const;

export type PreviewName = (typeof PREVIEW_NAMES)[number];
