import { breadcrumbList, compact, JSON_LD_CONTEXT, type JsonLdDocument } from "@/features/seo";
import type { JobDetailView } from "./view";

/** The words search engines use for the type of work (schema.org employmentType). */
const EMPLOYMENT: Record<JobDetailView["employmentType"], string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
};

/**
 * The job page's structured data for search engines (ADR-143, FR-PUB-18): a JobPosting with its title, description,
 * dates, place, type and employer, and the BreadcrumbList of Home, Careers and the job. Every value is plain text from
 * the admin; the page writes the documents with `JsonLd`, which escapes them for a script block. A remote job says so.
 */
export function jobPostingDocument(
  job: JobDetailView,
  input: { url: string; siteName: string },
): JsonLdDocument {
  const description = [job.description, job.responsibilities, job.requirements]
    .filter((part) => part.trim() !== "")
    .join("\n\n");
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "JobPosting",
    ...compact({
      title: job.title,
      description,
      datePosted: job.postedAt,
      validThrough: job.closesAt,
      employmentType: EMPLOYMENT[job.employmentType],
      industry: job.department?.name ?? null,
      experienceRequirements: job.experience,
      jobLocationType: job.workMode === "remote" ? "TELECOMMUTE" : null,
    }),
    hiringOrganization: { "@type": "Organization", name: input.siteName },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location },
    },
    url: input.url,
  };
}

export function jobBreadcrumbs(input: {
  homeName: string;
  homeUrl: string;
  careersName: string;
  careersUrl: string;
  title: string;
  url: string;
}): JsonLdDocument {
  return breadcrumbList([
    { name: input.homeName, url: input.homeUrl },
    { name: input.careersName, url: input.careersUrl },
    { name: input.title, url: input.url },
  ]);
}
