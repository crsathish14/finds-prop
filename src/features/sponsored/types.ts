import type { DeveloperSpotlightData } from "@/components/domain/developer-spotlight";
import type { FeaturedProjectCardData } from "@/components/domain/featured-project-card";

/**
 * The Featured project card as the page draws it (ADR-192): one sponsored project, ready to draw, with its builder's
 * id, which the sponsor report counts it by (ADR-194).
 */
export type FeaturedProjectData = FeaturedProjectCardData & { builderId: string };

/** The Developer spotlight as the page draws it (ADR-193), with the builder's id the report counts it by (ADR-194). */
export type SpotlightData = DeveloperSpotlightData & { builderId: string };
