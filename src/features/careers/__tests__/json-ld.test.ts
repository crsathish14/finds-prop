import { describe, expect, it } from "vitest";
import { jobBreadcrumbs, jobPostingDocument } from "../json-ld";
import type { JobDetailView } from "../view";

const JOB: JobDetailView = {
  id: "j1",
  slug: "site-engineer",
  title: "Site engineer",
  departmentId: "d1",
  department: { slug: "construction", name: "Construction" },
  location: "Madurai",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "3 years",
  summary: "Run our sites.",
  description: "Paragraph one.",
  responsibilities: "Plan the work\nBuild it",
  requirements: "A degree",
  salaryNote: null,
  applyUrl: "https://jobs.example.com/apply",
  applyEmail: null,
  closesAt: "2026-12-31T18:29:59+00:00",
  postedAt: "2026-11-10T08:00:00+00:00",
  updatedAt: "2026-11-12T08:00:00+00:00",
};
const INPUT = { url: "https://findsprop.test/careers/site-engineer", siteName: "findsprop" };

describe("UT-job-ld: the JobPosting structured data (ADR-143, FR-PUB-18)", () => {
  it("carries every field search engines require: title, description, datePosted, hiringOrganization and jobLocation", () => {
    const document = jobPostingDocument(JOB, INPUT);
    expect(document["@context"]).toBe("https://schema.org");
    expect(document["@type"]).toBe("JobPosting");
    expect(document["title"]).toBe("Site engineer");
    expect(document["description"]).toBe("Paragraph one.\n\nPlan the work\nBuild it\n\nA degree");
    expect(document["datePosted"]).toBe("2026-11-10T08:00:00+00:00");
    expect(document["hiringOrganization"]).toEqual({ "@type": "Organization", name: "findsprop" });
    expect(document["jobLocation"]).toEqual({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Madurai", addressCountry: "IN" },
    });
    expect(document["employmentType"]).toBe("FULL_TIME");
    expect(document["url"]).toBe(INPUT.url);
  });

  it("carries the closing date as validThrough, and no validThrough for a job with none", () => {
    expect(jobPostingDocument(JOB, INPUT)["validThrough"]).toBe("2026-12-31T18:29:59+00:00");
    expect(jobPostingDocument({ ...JOB, closesAt: null }, INPUT)).not.toHaveProperty(
      "validThrough",
    );
  });

  it("falls back to the last edit when the job has no posted date, so datePosted is never missing", () => {
    expect(jobPostingDocument({ ...JOB, postedAt: null }, INPUT)["datePosted"]).toBe(
      "2026-11-12T08:00:00+00:00",
    );
  });

  it("names each type of work with the words schema.org uses", () => {
    const type = (employmentType: JobDetailView["employmentType"]) =>
      jobPostingDocument({ ...JOB, employmentType }, INPUT)["employmentType"];
    expect(type("part_time")).toBe("PART_TIME");
    expect(type("contract")).toBe("CONTRACTOR");
    expect(type("internship")).toBe("INTERN");
  });

  it("says a remote job is remote and who may apply, and says nothing of the kind for an on-site or hybrid one", () => {
    const remote = jobPostingDocument({ ...JOB, workMode: "remote" }, INPUT);
    expect(remote["jobLocationType"]).toBe("TELECOMMUTE");
    expect(remote["applicantLocationRequirements"]).toEqual({ "@type": "Country", name: "IN" });
    for (const workMode of ["onsite", "hybrid"] as const) {
      const document = jobPostingDocument({ ...JOB, workMode }, INPUT);
      expect(document).not.toHaveProperty("jobLocationType");
      expect(document).not.toHaveProperty("applicantLocationRequirements");
    }
  });

  it("leaves out the parts that are empty instead of writing blanks, and never carries the apply link or email", () => {
    const document = jobPostingDocument(
      { ...JOB, responsibilities: "", requirements: "", experience: "", department: null },
      INPUT,
    );
    expect(document["description"]).toBe("Paragraph one.");
    expect(document).not.toHaveProperty("experienceRequirements");
    expect(document).not.toHaveProperty("industry");
    expect(JSON.stringify(document)).not.toContain("jobs.example.com/apply");
  });

  it("makes the trail Home, Careers and the job, each with its whole address", () => {
    const document = jobBreadcrumbs({
      homeName: "Home",
      homeUrl: "https://findsprop.test/",
      careersName: "Careers",
      careersUrl: "https://findsprop.test/careers",
      title: "Site engineer",
      url: INPUT.url,
    });
    expect(document["@type"]).toBe("BreadcrumbList");
    expect(document["itemListElement"]).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://findsprop.test/" },
      { "@type": "ListItem", position: 2, name: "Careers", item: "https://findsprop.test/careers" },
      { "@type": "ListItem", position: 3, name: "Site engineer", item: INPUT.url },
    ]);
  });
});
