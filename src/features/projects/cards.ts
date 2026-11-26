import type { ProjectCardData } from "@/components/domain/project-card";
import { isPrimeProject, type ProjectPrimeRules } from "@/lib/project-prime";
import { PROJECT_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import { projectPath } from "./address";
import type { ProjectListItem } from "./types";

/**
 * A project as the project card takes it. The picture is drawn only when the project has one, from the
 * public project bucket; its description is the project's name, since the developer gives none. A
 * project has no city of its own, so the card is given none (the page draws the locality alone). The Prime badge comes
 * from the admin's current Prime amounts (ADR-208), which the page reads from the site settings.
 */
export function toProjectCard(
  item: ProjectListItem,
  supabaseUrl: string,
  primeRules: ProjectPrimeRules,
): ProjectCardData {
  return {
    href: projectPath(item.slug),
    name: item.name,
    developerName: item.developerName,
    locality: item.locality,
    city: "",
    priceRupees: item.price,
    priceType: item.priceType,
    offerType: item.offerType,
    bedrooms: item.bhkOptions,
    status: item.status,
    featured: item.featured,
    prime: isPrimeProject(primeRules, item),
    cover: item.coverPath
      ? { src: publicStorageUrl(supabaseUrl, PROJECT_BUCKET, item.coverPath), alt: item.name }
      : null,
  };
}
