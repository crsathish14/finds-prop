import {
  breadcrumbList,
  compact,
  JSON_LD_CONTEXT,
  postalAddress,
  type JsonLdDocument,
} from "@/features/seo";
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
 * the admin; the page writes the documents with `JsonLd`, which escapes them for a script block. A remote job says so
 * (`jobLocationType` and the country its applicants may live in, which search engines ask for). The fields search
 * engines require are always there: title, description, `datePosted` (the day it was opened, else its last edit),
 * `hiringOrganization` and `jobLocation`; `validThrough` only when the job has a closing date. The page writes the
 * document only while the job is open, so an expired or closed job has none.
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
      datePosted: job.postedAt ?? job.updatedAt,
      validThrough: job.closesAt,
      employmentType: EMPLOYMENT[job.employmentType],
      industry: job.department?.name ?? null,
      experienceRequirements: job.experience,
      jobLocationType: job.workMode === "remote" ? "TELECOMMUTE" : null,
      applicantLocationRequirements:
        job.workMode === "remote" ? { "@type": "Country", name: "IN" } : null,
    }),
    hiringOrganization: { "@type": "Organization", name: input.siteName },
    jobLocation: { "@type": "Place", address: postalAddress({ locality: job.location }) },
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
