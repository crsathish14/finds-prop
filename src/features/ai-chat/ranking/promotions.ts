/**
 * Which promotion tier a project or a home is in (ADR-205), from the admin's own settings, read fresh by
 * `getPromotionLists()` (`src/features/sponsored`). Nothing is hard-coded: an admin change shows in the next search.
 *
 * The categories (owner, 26 Nov 2026):
 * - sponsored: the builders on the Sponsored builders page (its "Featured project card" list), and the projects an
 *   active hero or results sponsor ad links to;
 * - featured: a project the super admin featured in project moderation;
 * - spotlight: the builders on the Sponsored builders page's Spotlight list;
 * - top: the builders on the Top developers page.
 * A project in several gets its best tier once. A home has no builder: a home the super admin featured in listing
 * moderation is `featured`, every other home `none` (owner to confirm, question Q-C). The Prime tag is not a tier.
 */
import type { AiPromotionTier } from "@/config/ai-ranking";

/** The admin's promotion lists, as ids and slugs. */
export interface PromotionLists {
  readonly sponsoredBuilders: ReadonlySet<string>;
  readonly sponsoredProjects: ReadonlySet<string>;
  readonly spotlightBuilders: ReadonlySet<string>;
  readonly topBuilders: ReadonlySet<string>;
}

/** No promotion at all: what a failed read of the settings falls back to, so the search still works. */
export const NO_PROMOTIONS: PromotionLists = {
  sponsoredBuilders: new Set(),
  sponsoredProjects: new Set(),
  spotlightBuilders: new Set(),
  topBuilders: new Set(),
};

/** The best tier of one project. */
/**
 * Whether a project of this tier carries the Featured label on its card in the chat (ADR-215): a sponsored builder's or
 * project, one featured in moderation, or a Spotlight builder's (the paid lists). The Top developers page is the admin's
 * own pick, not a paid promotion, so it ranks but carries no label.
 */
export function carriesFeatured(tier: AiPromotionTier): boolean {
  return tier === "sponsored" || tier === "featured" || tier === "spotlight";
}

export function projectTier(
  project: { readonly slug: string; readonly builderId: string | null; readonly featured: boolean },
  lists: PromotionLists,
): AiPromotionTier {
  const builder = project.builderId;
  if (lists.sponsoredProjects.has(project.slug)) return "sponsored";
  if (builder !== null && lists.sponsoredBuilders.has(builder)) return "sponsored";
  if (project.featured) return "featured";
  if (builder !== null && lists.spotlightBuilders.has(builder)) return "spotlight";
  if (builder !== null && lists.topBuilders.has(builder)) return "top";
  return "none";
}

/** The tier of one home: featured or none. */
export function homeTier(home: { readonly featured: boolean }): AiPromotionTier {
  return home.featured ? "featured" : "none";
}
