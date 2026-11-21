"use client";

import { useTranslations } from "next-intl";
import { JobApplyButton } from "@/components/domain/job-apply-button";
import { JobCard, JobCardSkeleton, type JobCardData } from "@/components/domain/job-card";
import { JobDetailBody, JobDetailHeader } from "@/components/domain/job-detail-sections";
import { JobFilters, type JobFilterChoice } from "@/components/domain/job-filters";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The public Careers parts (ADR-143 section 4): the job card, the search and filters, the job page's header, body and
 * Apply button, and the empty and loading states. Made-up jobs and demo addresses; nothing here goes anywhere. The words
 * the parts say come from en.json and are draft wording for the owner to approve.
 */

const FULL: JobCardData = {
  href: "#job",
  title: "Site Engineer",
  department: "Engineering",
  location: "Chennai",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "2 to 4 years",
  summary: "Supervise our building sites and keep every project on schedule and on budget.",
  salaryNote: "4 to 6 lakh a year",
  closesAt: "2026-12-31T18:30:00+05:30",
};

const SEARCH_HIT: JobCardData = {
  ...FULL,
  title: "Sales Executive",
  department: "Sales",
  location: "Madurai",
  workMode: "hybrid",
  employmentType: "contract",
  snippet: "Talk to buyers about flats and [[plots]] and help families find the right [[home]].",
};

const MINIMAL: JobCardData = {
  href: "#job",
  title: "Office Assistant",
  location: "Coimbatore",
  workMode: "remote",
  employmentType: "internship",
};

const LONG: JobCardData = {
  ...FULL,
  title:
    "Senior Regional Manager for Residential Projects Across Tamil Nadu and Neighbouring States",
  department: "Operations and a very long department name that has to wrap",
  location: "Supercalifragilisticexpialidocious-Nagar-0123456789-0123456789",
  experience: "10 or more years, with at least five in a leadership role",
  summary:
    "A summary with a very long unbroken word: Pneumonoultramicroscopicsilicovolcanoconiosis-0123456789-0123456789-0123456789 and then more words to fill the lines of the card.",
  salaryNote: "Negotiable",
};

export function JobCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        One open job in the Careers list (ADR-143): the department, work mode and type as badges,
        the title as the card&apos;s one link, the place and experience, a short summary and when
        applications close. Missing facts are left out. A search result shows a passage with the
        matched words marked. Made-up jobs.
      </Text>
      <Specimen label="Every fact">
        <div className="w-full max-w-md">
          <JobCard job={FULL} />
        </div>
      </Specimen>
      <Specimen label="A search result, with the matched words marked, and a job with only the required facts">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <JobCard job={SEARCH_HIT} />
          <JobCard job={MINIMAL} />
        </div>
      </Specimen>
      <Specimen label="A very long title, department, place and word">
        <div className="w-full max-w-md">
          <JobCard job={LONG} />
        </div>
      </Specimen>
      <Specimen label="Loading">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <JobCardSkeleton />
          <JobCardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

function useChoices(chosen: Record<string, string> = {}): JobFilterChoice[] {
  const translate = useTranslations();
  return [
    {
      name: "department",
      label: translate("careers.filters.department"),
      allLabel: translate("careers.filters.allDepartments"),
      value: chosen.department ?? "",
      options: [
        { value: "engineering", label: "Engineering" },
        { value: "sales", label: "Sales" },
        { value: "operations", label: "Operations" },
      ],
    },
    {
      name: "location",
      label: translate("careers.filters.location"),
      allLabel: translate("careers.filters.allLocations"),
      value: chosen.location ?? "",
      options: [
        { value: "Chennai", label: "Chennai" },
        { value: "Coimbatore", label: "Coimbatore" },
        { value: "Madurai", label: "Madurai" },
      ],
    },
    {
      name: "mode",
      label: translate("careers.filters.workMode"),
      allLabel: translate("careers.filters.allWorkModes"),
      value: chosen.mode ?? "",
      options: (["onsite", "hybrid", "remote"] as const).map((mode) => ({
        value: mode,
        label: translate(`careers.workMode.${mode}`),
      })),
    },
    {
      name: "type",
      label: translate("careers.filters.type"),
      allLabel: translate("careers.filters.allTypes"),
      value: chosen.type ?? "",
      options: (["full_time", "part_time", "contract", "internship"] as const).map((type) => ({
        value: type,
        label: translate(`careers.employmentType.${type}`),
      })),
    },
  ];
}

export function JobFiltersDemo() {
  const translate = useTranslations();
  const nothing = useChoices();
  const chosen = useChoices({ department: "engineering", mode: "onsite" });
  const missing = useChoices({ location: "Madurai" });
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The search box and the four filters above the Careers list (ADR-143). Everything lives in
        the address, so a filtered list can be shared and works without scripts: the whole bar is
        one form that sends its boxes. Made-up jobs.
      </Text>
      <Specimen label="Nothing chosen: every open job">
        <div className="w-full max-w-4xl">
          <JobFilters
            action="#careers"
            search={{ value: "" }}
            filters={nothing}
            summary={translate("careers.filters.summary", { count: 14 })}
          />
        </div>
      </Specimen>
      <Specimen label="Words and two filters chosen: the summary counts the matches, and Clear shows">
        <div className="w-full max-w-4xl">
          <JobFilters
            action="#careers"
            search={{ value: "site engineer" }}
            filters={chosen}
            summary={translate("careers.filters.summaryFiltered", { count: 2 })}
            clearHref="#careers"
          />
        </div>
      </Specimen>
      <Specimen label="Nothing found: the bar stays, and the page shows an empty state under it">
        <div className="flex w-full max-w-4xl flex-col gap-6">
          <JobFilters
            action="#careers"
            search={{ value: "zzzz" }}
            filters={missing}
            summary={translate("careers.filters.summaryFiltered", { count: 0 })}
            clearHref="#careers"
          />
          <EmptyState
            title={translate("careers.noMatches.title")}
            description={translate("careers.noMatches.text")}
          >
            <Button asChild variant="primary">
              <Link href="#careers" variant="nav" className="no-underline">
                {translate("careers.noMatches.reset")}
              </Link>
            </Button>
          </EmptyState>
        </div>
      </Specimen>
      <Specimen label="No open jobs at all">
        <div className="w-full max-w-4xl">
          <EmptyState
            title={translate("careers.empty.title")}
            description={translate("careers.empty.text")}
          />
        </div>
      </Specimen>
    </div>
  );
}

const DETAIL = {
  title: "Site Engineer",
  department: "Engineering",
  summary: "Supervise our building sites and keep every project on schedule and on budget.",
  location: "Chennai",
  workMode: "onsite" as const,
  employmentType: "full_time" as const,
  experience: "2 to 4 years",
  salaryNote: "4 to 6 lakh a year",
  postedAt: "2026-11-01T10:00:00+05:30",
  closesAt: "2026-12-31T18:30:00+05:30",
};

const BODY = {
  description:
    "You will supervise the construction of apartments and villas from the first foundation to the handover.\n\nYou report to the project head and work with our architects, contractors and the families who will live in the homes.",
  responsibilities:
    "Visit each site every day and record the progress\nCheck that the work follows the drawings\nKeep the material and labour account\nWrite a weekly progress report",
  requirements:
    "A civil engineering degree or diploma\nTwo years of site experience\nComfortable reading drawings\nFluent in Tamil and English",
};

export function JobDetailDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The parts of a job page (ADR-143): the header (department and badges, the page&apos;s only
        level-1 title, the summary and the facts), the body (the description in paragraphs, the
        responsibilities and the requirements as lists, all plain text so typed markup shows as
        typed). Made-up job.
      </Text>
      <Specimen label="A full header and body">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <JobDetailHeader job={DETAIL} />
          <JobDetailBody job={BODY} />
        </div>
      </Specimen>
      <Specimen label="Only the required facts, no responsibilities, and typed markup shown as text">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <JobDetailHeader
            job={{
              title: "Office Assistant",
              location: "Coimbatore",
              workMode: "remote",
              employmentType: "internship",
            }}
          />
          <JobDetailBody
            job={{
              description: "Help the team with <b>papers</b> and calls.",
              requirements: "Good with people",
            }}
          />
        </div>
      </Specimen>
      <Specimen label="A very long title and unbroken words">
        <div className="w-full max-w-3xl">
          <JobDetailHeader
            job={{
              ...DETAIL,
              title:
                "Senior Regional Manager for Residential Projects Across Tamil Nadu and Neighbouring States",
              location: "Supercalifragilisticexpialidocious-Nagar-0123456789-0123456789",
              salaryNote: "Negotiable-and-an-unbroken-note-0123456789-0123456789-0123456789",
            }}
          />
        </div>
      </Specimen>
    </div>
  );
}

export function JobApplyDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        How a visitor applies (ADR-143, decision D4): the platform stores no applications, so the
        button is a link to the employer&apos;s own page (opens in a new tab) or an email with the
        subject filled in. When the job has closed the button gives way to a note and a link back to
        the open jobs. It is the one copper button of the page. Demo addresses.
      </Text>
      <Specimen label="Apply by link">
        <JobApplyButton
          apply={{ kind: "link", url: "https://jobs.example.test/site-engineer" }}
          title="Site Engineer"
          openJobsHref="#careers"
        />
      </Specimen>
      <Specimen label="Apply by email">
        <JobApplyButton
          apply={{ kind: "email", address: "careers@example.test" }}
          title="Site Engineer"
          openJobsHref="#careers"
        />
      </Specimen>
      <Specimen label="The job has closed">
        <JobApplyButton
          apply={{ kind: "link", url: "https://jobs.example.test/site-engineer" }}
          title="Site Engineer"
          open={false}
          openJobsHref="#careers"
        />
      </Specimen>
    </div>
  );
}
