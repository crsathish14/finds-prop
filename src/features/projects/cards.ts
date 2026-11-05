import type { ProjectCardData } from "@/components/domain/project-card";
import { PROJECT_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import { projectPath } from "./address";
import type { ProjectListItem } from "./types";

/**
 * A project as the project card takes it. The picture is drawn only when the project has one, from the
 * public project bucket; its description is the project's name, since the developer gives none. A
 * project has no city of its own, so the card is given none (the page draws the locality alone).
 */
export function toProjectCard(item: ProjectListItem, supabaseUrl: string): ProjectCardData {
  return {
    href: projectPath(item.slug),
    name: item.name,
    developerName: item.developerName,
    locality: item.locality,
    city: "",
    minRupees: item.priceMin,
    maxRupees: item.priceMax,
    bedrooms: item.bhkOptions,
    status: item.status,
    featured: item.featured,
    cover: item.coverPath
      ? { src: publicStorageUrl(supabaseUrl, PROJECT_BUCKET, item.coverPath), alt: item.name }
      : null,
  };
}
