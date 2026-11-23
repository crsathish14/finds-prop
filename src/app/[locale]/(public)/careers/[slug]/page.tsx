import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobScreen, getJob, isJobOpenAt, jobMetadata, parseJobSlug } from "@/features/careers";
import { siteOrigin } from "@/features/seo";
import { getContentModuleOn, getTranslate, requireContentModule } from "@/features/site";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const translate = await getTranslate();
  const parsed = parseJobSlug(slug);
  // A hidden module, a draft, a closed job and a wrong address all read the same: a title and no index (the page itself
  // answers 404). The module is asked first, so a hidden job's title and summary never reach the head of the 404 answer.
  const job =
    parsed === null || !(await getContentModuleOn("careers")) ? null : await getJob(parsed);
  if (job === null) return { title: translate("notFound.title") };
  return jobMetadata(translate, job);
}

/**
 * One open job (ADR-143, ADR-147). The address is the job's own slug. A switched-off module, an address that is not a
 * slug, and a job that is a draft, closed, past its closing date, in the Trash or does not exist all answer the normal
 * not-found page (the table's row policy hides the rest, so there is no separate check). The text is drawn as React
 * text; the JobPosting and Breadcrumb structured data and the canonical address are made from the same job. The job is
 * read through the cache under the `careers` tag and the job's own tag; because a cached job may have passed its closing
 * date a few minutes ago, the page asks again and draws the closed note instead of the Apply button.
 */
export default async function JobPage({ params }: PageProps) {
  await requireContentModule("careers");
  const { slug } = await params;
  const parsed = parseJobSlug(slug);
  if (parsed === null) notFound();
  const job = await getJob(parsed);
  if (job === null) notFound();
  return (
    <main id="main" className="flex-1">
      <JobScreen job={job} open={isJobOpenAt(job, new Date())} origin={siteOrigin()} />
    </main>
  );
}
