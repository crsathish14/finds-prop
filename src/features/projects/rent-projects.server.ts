import "server-only";
import type { SearchParams } from "@/features/search";
import { getProjectKinds, getProjects } from "./queries";
import { pickRentProjects, rentProjectFits, wantsRentProjects } from "./rent-projects";
import type { ProjectListItem } from "./types";

/**
 * The projects for rent a rent search shows under its homes (ADR-219), from the same list the projects page reads
 * (live projects of active builders in the selected city). A search that lists none reads nothing; a failed read
 * shows none, and the homes still answer.
 */
export async function getRentProjects(
  params: SearchParams,
  cityKey: string,
): Promise<ProjectListItem[]> {
  if (!wantsRentProjects(params)) return [];
  const list = await getProjects(cityKey);
  if (list.status === "failed") return [];
  const candidates = list.projects.filter((project) => rentProjectFits(project, params));
  if (candidates.length === 0) return [];
  const kinds = await getProjectKinds(candidates.map((project) => project.slug));
  return pickRentProjects(candidates, kinds, params);
}
