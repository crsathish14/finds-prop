import { projectRowSchema, type DeveloperRow } from "./schemas";

/** How many developers the "New launches" section shows, and how many of their projects each card shows. */
export const DEVELOPER_COUNT = 3;
export const PROJECTS_PER_DEVELOPER = 2;

/**
 * The builders of the public projects, best first, with how many public projects each has. The rows
 * must already be in the order the section wants (featured first, then newest); a builder is ranked
 * where its first project appears.
 */
export function rankBuilders(
  rows: readonly { builder_id: string }[],
  limit: number = DEVELOPER_COUNT,
): { builderId: string; projectCount: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.builder_id, (counts.get(row.builder_id) ?? 0) + 1);
  return [...counts]
    .slice(0, limit)
    .map(([builderId, projectCount]) => ({ builderId, projectCount }));
}

/**
 * One developer card's facts from that builder's first projects (already in the section's order).
 * A row that does not fit the schema is left out; without any usable project the builder is left
 * out (the visitor sees only builders with a public project, BR-94). The first picture of a project
 * is its cover.
 */
export function developerFromProjects(
  builderId: string,
  projectCount: number,
  rows: readonly unknown[],
): DeveloperRow | null {
  const projects = rows
    .map((row) => projectRowSchema.safeParse(row))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .filter((project) => project.builder_id === builderId);
  const first = projects[0];
  if (!first) return null;
  return {
    builderId,
    name: first.builders.name,
    description: first.builders.description,
    projectCount,
    projects: projects.slice(0, PROJECTS_PER_DEVELOPER).map((project) => ({
      slug: project.slug,
      name: project.name,
      coverPath: project.images?.[0] ?? null,
    })),
  };
}
