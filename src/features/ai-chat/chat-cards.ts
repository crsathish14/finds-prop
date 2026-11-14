import "server-only";
import type { ProjectCardData } from "@/components/domain/project-card";
import type { PropertyCardData } from "@/components/domain/property-card";
import { getProject, toProjectCard } from "@/features/projects";
import { getProperty } from "@/features/property";
import { toSavedCard } from "@/features/saved";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import type { ChatCardReference } from "./schemas";

/** One card the chat draws under an answer: the card's facts, and what the Compare control needs. */
export type ChatCardView =
  | {
      readonly kind: "home";
      readonly key: string;
      readonly shortId: string;
      readonly card: PropertyCardData;
    }
  | { readonly kind: "project"; readonly key: string; readonly card: ProjectCardData };

/**
 * The cards for the references an answer named, in the same order. A card is built from the public pages' own
 * cached reads (as a visitor, approved and visible items only), so a card cannot show more than its page does. A
 * home or project that is not there any more is left out, never an error. A read that fails throws, and the chat
 * shows the answer without its cards. The model never writes a link: the card's address is built here from the id
 * or the slug the database returned.
 */
export async function readChatCards(
  references: readonly ChatCardReference[],
): Promise<ChatCardView[]> {
  const translate = await getTranslate();
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const cards = await Promise.all(
    references.map(async (reference): Promise<ChatCardView | null> => {
      if (reference.kind === "home") {
        const result = await getProperty(reference.homeId);
        if (result.status !== "found") return null;
        return {
          kind: "home",
          key: `home:${result.property.shortId}`,
          shortId: result.property.shortId,
          card: toSavedCard(result.property, { translate, supabaseUrl }),
        };
      }
      const result = await getProject(reference.slug);
      if (result.status !== "found") return null;
      const project = result.project;
      return {
        kind: "project",
        key: `project:${project.slug}`,
        card: toProjectCard(
          {
            slug: project.slug,
            name: project.name,
            developerName: project.developer.name,
            status: project.status,
            priceMin: project.priceMin,
            priceMax: project.priceMax,
            bhkOptions: project.bhkOptions,
            locality: project.locality,
            coverPath: project.images[0] ?? null,
            featured: project.featured,
          },
          supabaseUrl,
        ),
      };
    }),
  );
  return cards.filter((card): card is ChatCardView => card !== null);
}
