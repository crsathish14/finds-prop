/**
 * JobDetailHeader and JobDetailBody: the parts of a job page.
 * Purpose: the page of one open job (ADR-143 section 4). The header holds the department, the page's only level-1
 *   title, the summary and a list of facts (place, work mode, type, experience, pay, posted date, closing date). The
 *   body holds the description (paragraphs), the responsibilities and the requirements (bulleted lists) as plain
 *   text, never as HTML. Owner: design system. They hold no state and fetch nothing.
 * Props: JobDetailHeader: job (title, department, summary, location, workMode, employmentType, experience,
 *   salaryNote, postedAt, closesAt), headingLevel (h1 by default; the Design Lab and any page that
 *   already has a level-1 title use h2), className. JobDetailBody: job (description: paragraphs, responsibilities and
 *   requirements: one point per line), className. A part with no text is left out with its heading.
 * Responsive: the facts are one column on a phone and two from 768 px; the text is capped at a readable width.
 * Accessibility: one level-1 heading (the title); the body sections have level-2 headings; the facts are a
 *   description list, so each value is read with its name; dates are time elements.
 * States: every fact present, only the required facts (title, place, work mode, type), no responsibilities, a very long
 *   title, a place and a pay note with no spaces.
 * Dependencies: Badge, Heading, Icon, Text, format helpers, next-intl. Tests: job-parts.test.tsx; Design Lab
 *   "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the job page, ADR-143 section 4).
 */
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { EmploymentType, WorkMode } from "./job-card";

type JobDetailHeaderData = {
  title: string;
  department?: string | null | undefined;
  summary?: string | undefined;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experience?: string | undefined;
  salaryNote?: string | null | undefined;
  postedAt?: string | null | undefined;
  closesAt?: string | null | undefined;
};

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <dt className="text-caption font-semibold text-muted">{name}</dt>
      <dd className="text-small font-semibold text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function JobDetailHeader({
  job,
  headingLevel = "h1",
  className,
}: {
  job: JobDetailHeaderData;
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const translate = useTranslations();
  const locale = useLocale();
  return (
    <header data-slot="job-detail-header" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {job.department ? (
          <Badge tone="budget" className="max-w-full min-w-0">
            <span className="truncate">{job.department}</span>
          </Badge>
        ) : null}
        <Badge tone="outline">{translate(`careers.workMode.${job.workMode}`)}</Badge>
        <Badge tone="outline">{translate(`careers.employmentType.${job.employmentType}`)}</Badge>
      </div>
      <Heading as={headingLevel} size="1" className="[overflow-wrap:anywhere]">
        {job.title}
      </Heading>
      {job.summary ? (
        <Text tone="muted" className="max-w-prose [overflow-wrap:anywhere]">
          {job.summary}
        </Text>
      ) : null}
      <dl className="grid gap-3 md:grid-cols-2">
        <Fact name={translate("careers.detail.location")}>{job.location}</Fact>
        {job.experience ? (
          <Fact name={translate("careers.detail.experience")}>{job.experience}</Fact>
        ) : null}
        {job.salaryNote ? (
          <Fact name={translate("careers.detail.pay")}>{job.salaryNote}</Fact>
        ) : null}
        {job.postedAt ? (
          <Fact name={translate("careers.detail.posted")}>
            <time dateTime={job.postedAt}>{formatDate(locale, job.postedAt)}</time>
          </Fact>
        ) : null}
        {job.closesAt ? (
          <Fact name={translate("careers.detail.closes")}>
            <time dateTime={job.closesAt}>{formatDate(locale, job.closesAt)}</time>
          </Fact>
        ) : null}
      </dl>
    </header>
  );
}

type JobDetailBodyData = {
  description: string;
  responsibilities?: string | undefined;
  requirements?: string | undefined;
};

/** Paragraphs: a blank line starts a new one. */
function paragraphsOf(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Points: one per line. */
function pointsOf(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((point) => point.trim())
    .filter((point) => point.length > 0);
}

function PointList({ points }: { points: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6 text-body text-ink marker:text-primary">
      {points.map((point, index) => (
        <li key={index} className="[overflow-wrap:anywhere]">
          {point}
        </li>
      ))}
    </ul>
  );
}

function JobDetailBody({ job, className }: { job: JobDetailBodyData; className?: string }) {
  const translate = useTranslations();
  const paragraphs = paragraphsOf(job.description);
  const responsibilities = pointsOf(job.responsibilities);
  const requirements = pointsOf(job.requirements);
  return (
    <div data-slot="job-detail-body" className={cn("flex max-w-prose flex-col gap-8", className)}>
      {paragraphs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Heading as="h2" size="3">
            {translate("careers.detail.description")}
          </Heading>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-body text-ink [overflow-wrap:anywhere]">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}
      {responsibilities.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Heading as="h2" size="3">
            {translate("careers.detail.responsibilities")}
          </Heading>
          <PointList points={responsibilities} />
        </section>
      ) : null}
      {requirements.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Heading as="h2" size="3">
            {translate("careers.detail.requirements")}
          </Heading>
          <PointList points={requirements} />
        </section>
      ) : null}
    </div>
  );
}

export { JobDetailBody, JobDetailHeader };
export type { JobDetailBodyData, JobDetailHeaderData };
