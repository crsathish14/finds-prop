"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { CrmFilter, SubmissionRange } from "./constants";
import { leadsHref } from "./format";
import { ProjectLeadsPanel, type ProjectLeadsActions } from "./project-leads-panel.client";
import { SubmissionsPanel, type SubmissionsActions } from "./submissions-panel.client";
import type { FilterOptions, LeadCounts, LeadsPage, SubmissionsPage } from "./view";

export type LeadsBoardActions = ProjectLeadsActions & {
  loadMoreSubmissions: SubmissionsActions["loadMore"];
};

type LeadsBoardProps = {
  counts: LeadCounts;
  actions: LeadsBoardActions;
} & (
  | { tab: "leads"; leads: LeadsPage }
  | {
      tab: "submissions";
      submissions: SubmissionsPage;
      filters: {
        range: SubmissionRange;
        crm: CrmFilter;
        form?: string;
        project?: string;
        source?: string;
      };
      options: FilterOptions;
    }
);

/**
 * The admin's Leads page (S7-T07, FR-ADM-06): the heading and two tabs, "Project leads" and "Form submissions",
 * each with its number. The tab and, on the submissions tab, its filters are in the address, so the page is read
 * again for them; only the open tab's list is on the page.
 */
export function LeadsBoard(props: LeadsBoardProps) {
  const translate = useTranslations("admin.leads");
  const locale = useLocale();
  const router = useRouter();
  const number = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale);
  const { tab, counts, actions } = props;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.push(leadsHref({ tab: value === "submissions" ? "submissions" : "leads" }))
        }
      >
        <TabsList aria-label={translate("tabs.label")}>
          <TabsTrigger value="leads" count={number.format(counts.leads)}>
            {translate("tabs.leads")}
          </TabsTrigger>
          <TabsTrigger value="submissions" count={number.format(counts.submissions)}>
            {translate("tabs.submissions")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4 pt-4">
          {props.tab === "leads" ? (
            <ProjectLeadsPanel
              page={props.leads}
              actions={{ setStatus: actions.setStatus, loadMore: actions.loadMore }}
            />
          ) : (
            <SubmissionsPanel
              page={props.submissions}
              filters={props.filters}
              options={props.options}
              actions={{ loadMore: actions.loadMoreSubmissions }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
