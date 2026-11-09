import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/patterns/empty-state";
import { getTranslate } from "@/features/site";
import {
  addMyUnit,
  BUILDER_UNITS_PATH,
  deleteMyUnit,
  getMyProjectOptions,
  getMyUnitsPage,
  loadMoreMyUnits,
  unitFilterSchema,
  UnitsBoard,
  updateMyUnit,
} from "@/features/units";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.units.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The builder's units page (S7-T03, FR-BLD-03): the units of one of the builder's own projects, with the add, edit and
 * delete actions, as the admin's page but only for their own projects. The address names the project, the state and a
 * unit number to look for (`?project=`, `?state=`, `?search=`); a project that is not one of theirs, or no project at
 * all, shows their first project, and a state or search that is not valid is dropped. The projects and the page of
 * units are read as the signed-in builder; the role gate in the layout has already sent anyone else away.
 */
export default async function BuilderUnitsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const translate = await getTranslate();
  const projects = await getMyProjectOptions();
  const [firstProject] = projects;
  if (!firstProject) {
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
  const page = await getMyUnitsPage(filters);
  // The project was just read from the builder's own list, so a missing page means it was removed in between.
  if (!page) notFound();
  return (
    <UnitsBoard
      key={`${filters.projectId}|${filters.state}`}
      projects={projects}
      filters={{ projectId: filters.projectId, state: filters.state, search: filters.search }}
      page={page}
      actions={{
        add: addMyUnit,
        update: updateMyUnit,
        remove: deleteMyUnit,
        loadMore: loadMoreMyUnits,
      }}
      path={BUILDER_UNITS_PATH}
      intro={translate("builderPortal.units.intro")}
    />
  );
}
