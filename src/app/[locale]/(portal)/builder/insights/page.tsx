import type { Metadata } from "next";
import {
  BuilderInsights,
  getBuilderInsights,
  pendingNotice,
  resolveInsightsRange,
} from "@/features/builder-insights";
import { getMyProjectList } from "@/features/project-editor";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.insights.insights.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The builder's insights page (S7-T03 step E, FR-BLD-06): how visitors find and respond to their projects, as numbers,
 * over the days chosen and for all their projects or one. The address names the dates (`?range=7|month|custom`, with
 * `&from=&to=` for a custom range) and the project (`?project=`); a date choice that is not valid is the last 30
 * days, and a project that is not one of theirs is all of them. Everything is read as the signed-in builder, and the
 * numbers count only their own projects; the role gate in the layout has already sent anyone else away.
 */
export default async function BuilderInsightsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = resolveInsightsRange(
    { range: first(params.range), from: first(params.from), to: first(params.to) },
    new Date(),
  );
  const projects = await getMyProjectList();
  const asked = first(params.project);
  const project = projects.find((candidate) => candidate.id === asked)?.id ?? "";
  const numbers = await getBuilderInsights(range, project === "" ? undefined : project);
  return (
    <BuilderInsights
      variant="insights"
      path="/builder/insights"
      numbers={numbers}
      filters={{ ...range, project }}
      projects={projects.map(({ id, name }) => ({ id, name }))}
      pending={pendingNotice(projects)}
    />
  );
}
