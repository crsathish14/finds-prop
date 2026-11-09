import type { Metadata } from "next";
import {
  getFilterOptions,
  getLeadCounts,
  getLeadsPage,
  getSubmissionsPage,
  LeadsBoard,
  leadFilterSchema,
  loadMoreLeads,
  loadMoreSubmissions,
  setLeadStatus,
  submissionFilterSchema,
} from "@/features/leads";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.leads.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The admin's leads page (S7-T07, FR-ADM-06): the leads of every project, with the one thing that can be changed (a
 * lead's state), and the forms people filled in with how each stands with the CRM. The address names the tab and, on
 * the submissions tab, the filters (`?tab=submissions`, `?range=`, `?form=`, `?project=`, `?source=`, `?crm=`); a
 * value that is not valid is dropped. Only the open tab's list is read, with the numbers of both tabs, as the
 * signed-in admin; the role gate in the layout has already sent anyone else away.
 */
export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const actions = {
    setStatus: setLeadStatus,
    loadMore: loadMoreLeads,
    loadMoreSubmissions,
  };

  if (first(params.tab) === "submissions") {
    const filters = submissionFilterSchema.parse(params);
    const [counts, submissions, options] = await Promise.all([
      getLeadCounts(),
      getSubmissionsPage(filters),
      getFilterOptions(),
    ]);
    return (
      <LeadsBoard
        tab="submissions"
        counts={counts}
        actions={actions}
        submissions={submissions}
        filters={{
          range: filters.range,
          crm: filters.crm,
          ...(filters.form ? { form: filters.form } : {}),
          ...(filters.project ? { project: filters.project } : {}),
          ...(filters.source ? { source: filters.source } : {}),
        }}
        options={options}
      />
    );
  }

  const [counts, leads] = await Promise.all([
    getLeadCounts(),
    getLeadsPage(leadFilterSchema.parse({})),
  ]);
  return <LeadsBoard tab="leads" counts={counts} actions={actions} leads={leads} />;
}
