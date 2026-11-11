import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import {
  AdminOverview,
  getAdminOverview,
  resolveOverviewRange,
  type OverviewState,
} from "@/features/admin-overview";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.overview.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The admin's Overview page (S7-T06 part 3, FR-ADM-01): numbers for listings, people and leads, a chart of leads,
 * enquiries and shortlists per day, where the leads came from, the projects with the most enquiries and the newest
 * leads. The address names the dates (`?range=today|yesterday|7|month|custom`, with `&from=&to=` for a custom range);
 * a choice that is not valid is the last 30 days. Everything is read as the signed-in admin (the database function
 * refuses anyone else) and is never cached; the role gate in the layout has already sent anyone else away. A failed
 * read does not throw: the page says so and offers to try again (and keeps the numbers that last arrived).
 */
export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const range = resolveOverviewRange(
    { range: first(params.range), from: first(params.from), to: first(params.to) },
    now,
  );
  let state: OverviewState;
  try {
    state = { ok: true, overview: await getAdminOverview(range, now), range };
  } catch (problem) {
    // Next's own signals (a redirect, a page that must be rendered per visit) are not read failures.
    unstable_rethrow(problem);
    // The reading code has logged why; the page tells the admin and offers to try again.
    state = { ok: false };
  }
  return <AdminOverview path="/admin/dashboard" state={state} filters={range} />;
}
