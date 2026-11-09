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
  return { title: translate("builderPortal.insights.dashboard.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The builder's dashboard (S7-T03 step E, FR-BLD-05): their portfolio, the activity on their projects over the days
 * chosen, and the actions taken, as numbers, with a notice when a project is waiting for approval. The address names
 * the dates (`?range=7|month|custom`, with `&from=&to=` for a custom range); anything not valid is the last 30 days.
 * Everything is read as the signed-in builder, and the numbers count only their own projects; the role gate in the
 * layout has already sent anyone else away.
 */
export default async function BuilderDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = resolveInsightsRange(
    { range: first(params.range), from: first(params.from), to: first(params.to) },
    new Date(),
  );
  const [numbers, projects] = await Promise.all([getBuilderInsights(range), getMyProjectList()]);
  return (
    <BuilderInsights
      variant="dashboard"
      path="/builder/dashboard"
      numbers={numbers}
      filters={{ ...range, project: "" }}
      projects={[]}
      pending={pendingNotice(projects)}
    />
  );
}
