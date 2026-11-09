import type { Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { getTranslate } from "@/features/site";
import {
  addUnit,
  deleteUnit,
  getProjectOptions,
  getUnitsPage,
  loadMoreUnits,
  unitFilterSchema,
  UnitsBoard,
  updateUnit,
} from "@/features/units";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.units.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The admin's units page (S7-T07, FR-ADM-05): the units of one project, with the add, edit and delete actions. The
 * address names the project, the state and a unit number to look for (`?project=`, `?state=`, `?search=`); a
 * project that is not one of ours, or no project at all, shows the first project, and a state or search that is not
 * valid is dropped. The projects and the page of units are read as the signed-in admin; the role gate in the layout
 * has already sent anyone else away.
 */
export default async function UnitsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projects = await getProjectOptions();
  const [firstProject] = projects;
  if (!firstProject) {
    const translate = await getTranslate();
    return (
      <EmptyState
        as="h1"
        title={translate("admin.units.noProjects.title")}
        description={translate("admin.units.noProjects.text")}
      />
    );
  }
  const asked = first(params.project);
  const projectId = projects.some((project) => project.id === asked) ? asked : firstProject.id;
  const filters = unitFilterSchema.parse({
    projectId,
    state: params.state,
    search: params.search,
  });
  const page = await getUnitsPage(filters);
  return (
    <UnitsBoard
      key={`${filters.projectId}|${filters.state}`}
      projects={projects}
      filters={{ projectId: filters.projectId, state: filters.state, search: filters.search }}
      page={page}
      actions={{ add: addUnit, update: updateUnit, remove: deleteUnit, loadMore: loadMoreUnits }}
    />
  );
}
