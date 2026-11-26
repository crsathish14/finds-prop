import type { Metadata } from "next";
import { getBuilderOverview } from "@/features/builders";
import { getTranslate } from "@/features/site";
import { indiaToday } from "@/lib/india-days";
import { TOP_DEVELOPERS_MAX } from "@/lib/top-developers";
import {
  getSiteContent,
  saveTopDevelopers,
  TopDevelopersForm,
  typedDatesOf,
} from "@/features/site-content";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.topDevelopers.metaTitle") };
}

/**
 * The super admin's Top developers page: which developers the home page shows, and in what order (at most ten). It
 * opens on what is saved, read as the signed-in admin and never cached; the role gate in the layout has already sent
 * anyone else away. Only active developers can be picked.
 */
export default async function TopDevelopersPage() {
  const [{ settings }, { builders }] = await Promise.all([getSiteContent(), getBuilderOverview()]);
  const options = builders
    .filter((builder) => builder.status !== "inactive")
    .map((builder) => ({ id: builder.id, name: builder.name, projects: builder.projects }));
  const initial = settings.top_developers.builderIds;
  const today = indiaToday(new Date());
  return (
    <TopDevelopersForm
      key={JSON.stringify(initial)}
      options={options}
      initial={initial}
      initialDates={typedDatesOf(settings.top_developers.dates)}
      today={today}
      max={TOP_DEVELOPERS_MAX}
      save={saveTopDevelopers}
    />
  );
}
