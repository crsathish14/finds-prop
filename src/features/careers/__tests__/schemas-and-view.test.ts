import { describe, expect, it } from "vitest";
import { createJobSchema, jobIdSchema, updateJobSchema } from "../schemas";
import { slugFromTitle, slugWithSuffix, slugWithTail } from "../slug";
import {
  descriptionParagraphs,
  isJobOpenAt,
  pageCountOf,
  pointsOf,
  snippetParts,
  toAdminJobView,
  toAdminRowView,
  toCardView,
  toDetailView,
  toListView,
  type AdminJobRow,
  type JobRow,
  type SearchRow,
} from "../view";

const DEPARTMENT = "00000000-0000-4000-b600-0000000000d1";
const JOB = "00000000-0000-4000-b600-0000000000a1";

const NEW_JOB = {
  title: "  Site   Engineer ",
  departmentId: DEPARTMENT.toUpperCase(),
  location: " Chennai ",
  workMode: "onsite",
  employmentType: "full_time",
  applyUrl: " https://jobs.example.test/site-engineer ",
};

describe("UT-careers-schemas: what the admin may send", () => {
  it("tidies a new job and leaves the optional parts empty", () => {
    const parsed = createJobSchema.parse(NEW_JOB);
    expect(parsed).toEqual({
      title: "Site Engineer",
      departmentId: DEPARTMENT,
      location: "Chennai",
      workMode: "onsite",
      employmentType: "full_time",
      experience: "",
      applyUrl: "https://jobs.example.test/site-engineer",
      applyEmail: null,
    });
  });

  it("accepts an email address as the way to apply, kept in lower case", () => {
    const parsed = createJobSchema.parse({
      ...NEW_JOB,
      applyUrl: "",
      applyEmail: " Jobs@Example.Test ",
    });
    expect(parsed.applyUrl).toBeNull();
    expect(parsed.applyEmail).toBe("jobs@example.test");
  });

  it.each([
    ["http", "http://jobs.example.test/x"],
    ["a script address", "javascript:alert(1)"],
    ["a data address", "data:text/html,hi"],
    ["a sign-in part", "https://jobs.example.test@evil.test/x"],
    ["spaces", "https://jobs.example.test/a b"],
    ["no host", "https://"],
    ["a bare word", "jobs"],
  ])("refuses an apply link with %s", (_name, applyUrl) => {
    const result = createJobSchema.safeParse({ ...NEW_JOB, applyUrl });
    expect(result.success).toBe(false);
  });

  it("refuses two ways to apply, and none", () => {
    expect(createJobSchema.safeParse({ ...NEW_JOB, applyEmail: "jobs@example.test" }).success).toBe(
      false,
    );
    expect(createJobSchema.safeParse({ ...NEW_JOB, applyUrl: "" }).success).toBe(false);
  });

  it("refuses an unknown work mode and an unknown type", () => {
    expect(createJobSchema.safeParse({ ...NEW_JOB, workMode: "moon" }).success).toBe(false);
    expect(createJobSchema.safeParse({ ...NEW_JOB, employmentType: "forever" }).success).toBe(
      false,
    );
  });

  it("keeps the lines of the long text apart: paragraphs for the description, one point per line for the lists", () => {
    const parsed = updateJobSchema.parse({
      ...NEW_JOB,
      jobId: JOB,
      slug: "site-engineer",
      summary: "  Supervise\nour sites. ",
      description: "One.  \r\n\r\n\r\n\r\nTwo.\r\n",
      responsibilities: "  Visit sites \n\n  Write   reports  \n",
      requirements: "",
      salaryNote: "  ",
      closesAt: "",
    });
    expect(parsed.summary).toBe("Supervise our sites.");
    expect(parsed.description).toBe("One.\n\nTwo.");
    expect(parsed.responsibilities).toBe("Visit sites\nWrite reports");
    expect(parsed.requirements).toBe("");
    expect(parsed.salaryNote).toBeNull();
    expect(parsed.closesAt).toBeNull();
  });

  it("turns a closing moment into one standard form and refuses text that is not a date", () => {
    const base = { ...NEW_JOB, jobId: JOB, slug: "site-engineer" };
    expect(updateJobSchema.parse({ ...base, closesAt: "2026-12-31T18:30:00+05:30" }).closesAt).toBe(
      "2026-12-31T13:00:00.000Z",
    );
    expect(updateJobSchema.safeParse({ ...base, closesAt: "next week" }).success).toBe(false);
  });

  it("refuses text above the table's limits", () => {
    const base = { ...NEW_JOB, jobId: JOB, slug: "site-engineer" };
    expect(updateJobSchema.safeParse({ ...base, description: "x".repeat(8001) }).success).toBe(
      false,
    );
    expect(updateJobSchema.safeParse({ ...base, description: "x".repeat(8000) }).success).toBe(
      true,
    );
    expect(updateJobSchema.safeParse({ ...base, summary: "x".repeat(321) }).success).toBe(false);
    expect(updateJobSchema.safeParse({ ...base, experience: "x".repeat(81) }).success).toBe(false);
  });

  it("names the failing box with a validation key", () => {
    const result = updateJobSchema.safeParse({
      ...NEW_JOB,
      jobId: JOB,
      slug: "Not A Slug",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("validation.jobSlugInvalid");
  });

  it("takes an id and nothing else for a status change, and drops anything extra", () => {
    expect(jobIdSchema.parse({ jobId: JOB.toUpperCase(), status: "open" })).toEqual({ jobId: JOB });
    expect(jobIdSchema.safeParse({ jobId: "nope" }).success).toBe(false);
  });
});

describe("UT-careers-slug: the address made from a title", () => {
  it("makes lower case words joined by hyphens and drops accents", () => {
    expect(slugFromTitle("Site Engineer (Chennai)")).toBe("site-engineer-chennai");
    expect(slugFromTitle("Café Manager")).toBe("cafe-manager");
  });

  it("numbers a taken address and stays within the limit", () => {
    expect(slugWithSuffix("site-engineer", 2)).toBe("site-engineer-2");
    expect(slugWithTail("site-engineer", "ab12")).toBe("site-engineer-ab12");
    expect(slugWithSuffix("a".repeat(120), 3)).toHaveLength(120);
    expect(slugWithTail("a".repeat(120), "ab12")).toHaveLength(120);
  });

  it("makes nothing from a title with no letters or digits", () => {
    expect(slugFromTitle("???")).toBe("");
  });
});

const SEARCH_ROW: SearchRow = {
  id: JOB,
  slug: "site-engineer",
  title: "Site Engineer",
  department_id: DEPARTMENT,
  department_slug: "engineering",
  department_name: "Engineering",
  location: "Chennai",
  work_mode: "hybrid",
  employment_type: "contract",
  experience: "2 years",
  summary: "Supervise our sites.",
  snippet: "Supervise our sites.",
  salary_note: null,
  closes_at: null,
  posted_at: "2026-03-01T10:00:00+00:00",
  total_count: 25,
};

const JOB_ROW: JobRow = {
  id: JOB,
  slug: "site-engineer",
  title: "Site Engineer",
  department_id: DEPARTMENT,
  location: "Chennai",
  work_mode: "remote",
  employment_type: "internship",
  experience: "",
  summary: "Supervise our sites.",
  description: "One.\n\nTwo.",
  responsibilities: "Visit sites\nWrite reports",
  requirements: "A degree",
  salary_note: "Negotiable",
  apply_url: "https://jobs.example.test/site-engineer",
  apply_email: null,
  closes_at: "2026-12-31T00:00:00+00:00",
  posted_at: "2026-03-01T10:00:00+00:00",
  updated_at: "2026-03-02T10:00:00+00:00",
};

describe("UT-careers-view: rows become what the pages draw", () => {
  it("turns a search row into a card, with no snippet when it only repeats the summary", () => {
    const card = toCardView(SEARCH_ROW);
    expect(card).toMatchObject({
      slug: "site-engineer",
      department: { slug: "engineering", name: "Engineering" },
      workMode: "hybrid",
      employmentType: "contract",
      snippet: null,
    });
    expect(toCardView({ ...SEARCH_ROW, snippet: "a [[site]] passage" }).snippet).toBe(
      "a [[site]] passage",
    );
  });

  it("has no department when the row has none (a hidden department)", () => {
    expect(
      toCardView({ ...SEARCH_ROW, department_slug: null, department_name: null }).department,
    ).toBeNull();
  });

  it("falls back to safe values for a stored value it does not know", () => {
    const card = toCardView({ ...SEARCH_ROW, work_mode: "moon", employment_type: "forever" });
    expect(card).toMatchObject({ workMode: "onsite", employmentType: "full_time" });
  });

  it("counts the pages from the total on the first row", () => {
    const list = toListView([SEARCH_ROW], 2, 12);
    expect(list).toMatchObject({ total: 25, page: 2, pageSize: 12, pageCount: 3 });
    expect(toListView([], 1, 12)).toMatchObject({ total: 0, pageCount: 1 });
    expect(pageCountOf(0, 12)).toBe(1);
    expect(pageCountOf(12, 12)).toBe(1);
    expect(pageCountOf(13, 12)).toBe(2);
  });

  it("draws a job page, whichever way of applying it has", () => {
    const detail = toDetailView(JOB_ROW, { slug: "engineering", name: "Engineering" });
    expect(detail).toMatchObject({
      workMode: "remote",
      employmentType: "internship",
      applyUrl: "https://jobs.example.test/site-engineer",
      applyEmail: null,
      salaryNote: "Negotiable",
    });
  });

  it("says a job is open until its closing moment", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isJobOpenAt({ closesAt: null }, now)).toBe(true);
    expect(isJobOpenAt({ closesAt: "2026-06-01T00:00:01Z" }, now)).toBe(true);
    expect(isJobOpenAt({ closesAt: "2026-06-01T00:00:00Z" }, now)).toBe(false);
    expect(isJobOpenAt({ closesAt: "2026-05-31T00:00:00Z" }, now)).toBe(false);
  });

  it("maps the admin's rows, with Trash as a flag and an unknown status as a draft", () => {
    const row: AdminJobRow = {
      ...JOB_ROW,
      status: "paused",
      deleted_at: "2026-03-05T00:00:00Z",
      created_at: "2026-02-01T00:00:00Z",
    };
    expect(toAdminRowView(row)).toMatchObject({ status: "draft", trashed: true });
    expect(toAdminJobView(row)).toMatchObject({
      salaryNote: "Negotiable",
      createdAt: "2026-02-01T00:00:00Z",
    });
    expect(toAdminRowView({ ...row, status: "open", deleted_at: null })).toMatchObject({
      status: "open",
      trashed: false,
    });
  });

  it("splits the long text into paragraphs and points, dropping empty ones", () => {
    expect(descriptionParagraphs("One.\n\n\nTwo.\n\n")).toEqual(["One.", "Two."]);
    expect(descriptionParagraphs("")).toEqual([]);
    expect(pointsOf("Visit sites\n\n Write reports \n")).toEqual(["Visit sites", "Write reports"]);
  });

  it("cuts a snippet into plain text and matched words, never HTML", () => {
    expect(snippetParts("a [[site]] and <b>[[more]]</b> text")).toEqual([
      { text: "a ", matched: false },
      { text: "site", matched: true },
      { text: " and <b>", matched: false },
      { text: "more", matched: true },
      { text: "</b> text", matched: false },
    ]);
    expect(snippetParts("no matches")).toEqual([{ text: "no matches", matched: false }]);
  });
});
