/**
 * JobCard: one open job in the Careers list and in search results.
 * Purpose: the card of the public Careers page (ADR-143): the title as the card's one link, the department, the
 *   place, the work mode and the type, the experience, a short summary, and when applications close. Owner: design
 *   system. It holds no state and fetches nothing: the page passes the job's facts, already read from the database.
 * Props: job (href, title, department (the name), location, workMode ("onsite" | "hybrid" | "remote"),
 *   employmentType ("full_time" | "part_time" | "contract" | "internship"), experience, summary, snippet (a passage
 *   around the searched words, the matches between [[ and ]], shown instead of the summary; left out when missing),
 *   salaryNote, closesAt (an ISO date)), className. Missing facts are left out, never shown blank.
 * Responsive: one column of text at every width; the grid around it sets the columns.
 * Accessibility: the whole card is one link target: the title link is stretched over the card. A keyboard ring is
 *   drawn around the card when that link has focus. Searched words in a snippet are drawn in a mark element, never
 *   as HTML. The date is a time element. The facts are a list, each with an icon that is hidden from screen readers
 *   and a word that says what it is.
 * States: default, hover (shadow and a stronger border), focus, loading (JobCardSkeleton).
 * Dependencies: Badge, Link, Icon, Skeleton, format helpers, next-intl.
 * Tests: job-parts.test.tsx; Design Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Careers list, ADR-143 section 4).
 */
import { Briefcase, Clock, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

type WorkMode = "onsite" | "hybrid" | "remote";
type EmploymentType = "full_time" | "part_time" | "contract" | "internship";

type JobCardData = {
  href: string;
  title: string;
  department?: string | null | undefined;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experience?: string | undefined;
  summary?: string | undefined;
  snippet?: string | null | undefined;
  salaryNote?: string | null | undefined;
  closesAt?: string | null | undefined;
};

type JobCardProps = { job: JobCardData; className?: string };

/** A search snippet cut into plain text and matched words (the matches are between [[ and ]]). */
function snippetPieces(snippet: string): { text: string; matched: boolean }[] {
  const pieces: { text: string; matched: boolean }[] = [];
  let last = 0;
  for (const match of snippet.matchAll(/\[\[(.*?)\]\]/g)) {
    if (match.index > last) pieces.push({ text: snippet.slice(last, match.index), matched: false });
    pieces.push({ text: match[1] ?? "", matched: true });
    last = match.index + match[0].length;
  }
  if (last < snippet.length) pieces.push({ text: snippet.slice(last), matched: false });
  return pieces;
}

function JobCard({ job, className }: JobCardProps) {
  const translate = useTranslations();
  const locale = useLocale();
  const summary = job.snippet ?? job.summary;

  return (
    <article
      data-slot="job-card"
      className={cn(
        "group/card relative flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5",
        "transition-[box-shadow,border-color] duration-(--dur) hover:border-line-strong hover:shadow-hover",
        "has-[a[data-stretched]:focus-visible]:outline-3 has-[a[data-stretched]:focus-visible]:outline-offset-3 has-[a[data-stretched]:focus-visible]:outline-primary",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {job.department ? <Badge tone="budget">{job.department}</Badge> : null}
        <Badge tone="outline">{translate(`careers.workMode.${job.workMode}`)}</Badge>
        <Badge tone="outline">{translate(`careers.employmentType.${job.employmentType}`)}</Badge>
      </div>
      <h3 className="text-h3 text-primary [overflow-wrap:anywhere]" data-slot="job-card-title">
        <Link
          href={job.href}
          data-stretched=""
          className="rounded-xs font-(weight:--display-weight) text-primary no-underline outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
        >
          {job.title}
        </Link>
      </h3>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted">
        <li className="flex items-center gap-2 [overflow-wrap:anywhere]">
          <Icon icon={MapPin} size="sm" aria-hidden="true" />
          <span>
            <span className="sr-only">{translate("careers.card.location")} </span>
            {job.location}
          </span>
        </li>
        {job.experience ? (
          <li className="flex items-center gap-2 [overflow-wrap:anywhere]">
            <Icon icon={Briefcase} size="sm" aria-hidden="true" />
            <span>
              <span className="sr-only">{translate("careers.card.experience")} </span>
              {job.experience}
            </span>
          </li>
        ) : null}
      </ul>
      {summary ? (
        <p className="line-clamp-3 text-small text-muted [overflow-wrap:anywhere]">
          {job.snippet
            ? snippetPieces(job.snippet).map((piece, index) =>
                piece.matched ? (
                  <mark key={index} className="rounded-xs bg-cta-tint px-1 text-ink">
                    {piece.text}
                  </mark>
                ) : (
                  <span key={index}>{piece.text}</span>
                ),
              )
            : summary}
        </p>
      ) : null}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-caption text-muted">
        {job.salaryNote ? <span className="[overflow-wrap:anywhere]">{job.salaryNote}</span> : null}
        {job.closesAt ? (
          <span className="flex items-center gap-2">
            <Icon icon={Clock} size="sm" aria-hidden="true" />
            <time dateTime={job.closesAt}>
              {translate("careers.card.applyBy", { date: formatDate(locale, job.closesAt) })}
            </time>
          </span>
        ) : null}
      </p>
    </article>
  );
}

/** The loading shape of a card: the badges, the title, the facts and two lines of summary. */
function JobCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="job-card-skeleton"
      aria-hidden="true"
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5",
        className,
      )}
    >
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-pill" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export { JobCard, JobCardSkeleton };
export type { EmploymentType, JobCardData, JobCardProps, WorkMode };
