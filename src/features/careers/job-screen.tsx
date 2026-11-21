import { useTranslations } from "next-intl";
import { JobApplyButton, type JobApply } from "@/components/domain/job-apply-button";
import { JobDetailBody, JobDetailHeader } from "@/components/domain/job-detail-sections";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { JsonLd } from "@/features/seo";
import { jobBreadcrumbs, jobPostingDocument } from "./json-ld";
import { CAREERS_PATH, jobPath } from "./page-params";
import type { JobDetailView } from "./view";

type JobScreenProps = {
  job: JobDetailView;
  /** False when the job has closed since the page was cached: the page draws the closed note instead of Apply. */
  open: boolean;
  /** The site's origin, for the whole addresses in the structured data. */
  origin: string;
};

/** How to apply, from the two columns the table guarantees one of (a link, or else an email address). */
export function applyOf(job: JobDetailView): JobApply | null {
  if (job.applyUrl) return { kind: "link", url: job.applyUrl };
  if (job.applyEmail) return { kind: "email", address: job.applyEmail };
  return null;
}

/**
 * The public job page below the header (ADR-143 section 4, ADR-147): breadcrumb, the header (department, work mode, type,
 * title, summary and the facts), the body (description, responsibilities and requirements) and the one Apply button,
 * a link or an email, or a note when the job has closed. Everything the admin typed is drawn as React text (R-SEC-10).
 * The structured data is a JobPosting and the breadcrumb trail. The page hands it what to show, so it reads nothing.
 */
export function JobScreen({ job, open, origin }: JobScreenProps) {
  const crumbs = useTranslations("careers.page.crumb");
  const meta = useTranslations("meta");
  const url = `${origin}${jobPath(job.slug)}`;
  const apply = applyOf(job);

  return (
    <Container className="py-6 md:py-8">
      {open ? <JsonLd data={jobPostingDocument(job, { url, siteName: meta("title") })} /> : null}
      <JsonLd
        data={jobBreadcrumbs({
          homeName: crumbs("home"),
          homeUrl: `${origin}/`,
          careersName: crumbs("careers"),
          careersUrl: `${origin}${CAREERS_PATH}`,
          title: job.title,
          url,
        })}
      />
      <Breadcrumb
        navLabel={crumbs("nav")}
        backLabel={crumbs("backCareers")}
        items={[
          { label: crumbs("home"), href: "/" },
          { label: crumbs("careers"), href: CAREERS_PATH },
          { label: job.title },
        ]}
        className="mb-6"
      />
      <article className="flex max-w-3xl flex-col gap-8">
        <JobDetailHeader
          job={{
            title: job.title,
            department: job.department?.name ?? null,
            summary: job.summary === "" ? undefined : job.summary,
            location: job.location,
            workMode: job.workMode,
            employmentType: job.employmentType,
            experience: job.experience === "" ? undefined : job.experience,
            salaryNote: job.salaryNote,
            postedAt: job.postedAt,
            closesAt: job.closesAt,
          }}
        />
        {apply ? (
          <JobApplyButton apply={apply} title={job.title} open={open} openJobsHref={CAREERS_PATH} />
        ) : null}
        <JobDetailBody
          job={{
            description: job.description,
            responsibilities: job.responsibilities === "" ? undefined : job.responsibilities,
            requirements: job.requirements === "" ? undefined : job.requirements,
          }}
        />
      </article>
    </Container>
  );
}
