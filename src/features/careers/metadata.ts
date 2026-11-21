import type { Metadata } from "next";
import { pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";
import { jobPath, jobsHref, type PublicJobParams } from "./page-params";
import type { JobDetailView } from "./view";

/**
 * The Careers list's title, description and canonical address (ADR-143, FR-PUB-18). A department, a place, a mode, a
 * type or a later page is its own page with its own address; a page found by free words is never indexed (its links
 * are still followed), so a search engine keeps the lists that mean something and not every word anyone typed.
 */
export function careersListMetadata(translate: Translate, params: PublicJobParams): Metadata {
  const base = pageMetadata({
    title: translate("careers.page.metaTitle"),
    description: translate("careers.page.metaDescription"),
    path: jobsHref({
      department: params.department,
      location: params.location,
      mode: params.mode,
      type: params.type,
      page: params.page,
    }),
    siteName: translate("meta.title"),
  });
  return params.query === "" ? base : { ...base, robots: { index: false, follow: true } };
}

/** A job's title, description (its summary) and canonical address. */
export function jobMetadata(translate: Translate, job: JobDetailView): Metadata {
  return pageMetadata({
    title: job.title,
    description: job.summary,
    path: jobPath(job.slug),
    siteName: translate("meta.title"),
  });
}
