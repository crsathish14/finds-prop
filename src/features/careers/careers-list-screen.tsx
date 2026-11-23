import { useTranslations } from "next-intl";
import { JobCard, type JobCardData } from "@/components/domain/job-card";
import { JobFilters } from "@/components/domain/job-filters";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { EmptyState } from "@/components/patterns/empty-state";
import { PaginationBar } from "@/components/patterns/pagination-bar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { EMPLOYMENT_TYPES, WORK_MODES } from "./constants";
import { CAREERS_PATH, jobPath, jobsHref, type PublicJobParams } from "./page-params";
import type { CareersPageData } from "./queries";
import type { JobCardView } from "./view";

/** The facts a card draws, from a job of the list (an empty experience is left out, never drawn blank). */
export function jobCardDataOf(job: JobCardView): JobCardData {
  return {
    href: jobPath(job.slug),
    title: job.title,
    department: job.department?.name ?? null,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experience: job.experience === "" ? undefined : job.experience,
    summary: job.summary === "" ? undefined : job.summary,
    snippet: job.snippet,
    salaryNote: job.salaryNote,
    closesAt: job.closesAt,
  };
}

type CareersListScreenProps = {
  data: CareersPageData;
  /** What the address asked for (the department here is the one that really exists, see `data.department`). */
  params: PublicJobParams;
};

/**
 * The public Careers list below the header (ADR-143 section 4): the breadcrumb, the title, the search box with its
 * four filters, the page of job cards and the page links. Every choice is in the address
 * (`?q=&department=&location=&mode=&type=&page=`), so a filtered list can be linked, works without scripts and the back
 * button restores it. Search words are drawn as text with the matches marked (JobCard), never as HTML. Every state is
 * drawn: jobs, nothing open at all, and no match. The page hands it what to show, so it reads nothing itself.
 */
export function CareersListScreen({ data, params }: CareersListScreenProps) {
  const translate = useTranslations("careers");
  const { list, filters, department, nothingOpen } = data;
  const choice: PublicJobParams = { ...params, department };
  const filtering =
    params.query !== "" ||
    department !== "" ||
    params.location !== "" ||
    params.mode !== "" ||
    params.type !== "";
  const summary = translate(filtering ? "filters.summaryFiltered" : "filters.summary", {
    count: list.total,
  });

  return (
    <Container className="py-6 md:py-8">
      <Breadcrumb
        navLabel={translate("page.crumb.nav")}
        backLabel={translate("page.crumb.backHome")}
        items={[
          { label: translate("page.crumb.home"), href: "/" },
          { label: translate("page.crumb.careers") },
        ]}
      />
      <div className="mt-6 mb-6 flex max-w-3xl flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("page.title")}
        </Heading>
        <Text tone="muted">{translate("page.lead")}</Text>
      </div>
      {nothingOpen ? (
        <EmptyState title={translate("empty.title")} description={translate("empty.text")} />
      ) : (
        <div className="flex flex-col gap-6">
          <JobFilters
            action={CAREERS_PATH}
            search={{ value: params.query }}
            filters={[
              {
                name: "department",
                label: translate("filters.department"),
                allLabel: translate("filters.allDepartments"),
                value: department,
                options: filters.departments.map((item) => ({
                  value: item.slug,
                  label: item.name,
                })),
              },
              {
                name: "location",
                label: translate("filters.location"),
                allLabel: translate("filters.allLocations"),
                value: params.location,
                options: filters.locations.map((place) => ({ value: place, label: place })),
              },
              {
                name: "mode",
                label: translate("filters.workMode"),
                allLabel: translate("filters.allWorkModes"),
                value: params.mode,
                options: WORK_MODES.map((mode) => ({
                  value: mode,
                  label: translate(`workMode.${mode}`),
                })),
              },
              {
                name: "type",
                label: translate("filters.type"),
                allLabel: translate("filters.allTypes"),
                value: params.type,
                options: EMPLOYMENT_TYPES.map((type) => ({
                  value: type,
                  label: translate(`employmentType.${type}`),
                })),
              },
            ]}
            summary={summary}
            clearHref={filtering ? CAREERS_PATH : undefined}
          />
          {list.items.length === 0 ? (
            <EmptyState
              title={translate("noMatches.title")}
              description={translate("noMatches.text")}
            >
              <Button asChild variant="primary">
                <Link href={CAREERS_PATH} variant="nav" className="no-underline">
                  {translate("noMatches.reset")}
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {list.items.map((job) => (
                <li key={job.id} className="min-w-0">
                  <JobCard job={jobCardDataOf(job)} />
                </li>
              ))}
            </ul>
          )}
          <PaginationBar
            page={list.page}
            pageCount={list.pageCount}
            hrefFor={(page) => jobsHref({ ...choice, page })}
          />
        </div>
      )}
    </Container>
  );
}
