import { describe, expect, it, vi } from "vitest";
import type { JobFormValues } from "@/components/domain/job-form-fields";
import type { ActionResult } from "@/types/action";
import {
  closesAtFromInput,
  closesAtToInput,
  saveJobForm,
  type JobEditorActions,
} from "../job-save";
import type { JobDone } from "../job-service";

const DONE: JobDone = { jobId: "job-1", slug: "site-engineer", status: "draft", slugs: [] };
const ok = (data: JobDone = DONE): ActionResult<JobDone> => ({ ok: true, data });

const VALUES: JobFormValues = {
  title: "Site engineer",
  slug: "",
  departmentId: "d1",
  location: "Chennai",
  workMode: "hybrid",
  employmentType: "full_time",
  experience: "3 years",
  summary: "Run our sites.",
  description: "Paragraph one.\n\nParagraph two.",
  responsibilities: "Plan\nBuild",
  requirements: "Degree",
  salaryNote: " ",
  applyKind: "link",
  applyUrl: " https://jobs.example.com/apply ",
  applyEmail: "ignored@example.com",
  closesAt: "2026-12-31T18:00",
};

function actions() {
  const create = vi.fn<JobEditorActions["create"]>().mockResolvedValue(ok());
  const update = vi.fn<JobEditorActions["update"]>().mockResolvedValue(ok());
  return { create, update };
}

describe("closing moments are typed and shown in India time", () => {
  it("round-trips a moment with the +05:30 offset", () => {
    expect(closesAtFromInput("2026-12-31T18:00")).toBe("2026-12-31T18:00:00+05:30");
    expect(closesAtToInput("2026-12-31T12:30:00.000Z")).toBe("2026-12-31T18:00");
    expect(closesAtToInput(closesAtFromInput("2026-01-02T00:05"))).toBe("2026-01-02T00:05");
  });

  it("leaves an empty box empty, and a bad text as typed for the server to refuse", () => {
    expect(closesAtFromInput("  ")).toBe("");
    expect(closesAtFromInput("tomorrow")).toBe("tomorrow");
    expect(closesAtToInput(null)).toBe("");
    expect(closesAtToInput("not a date")).toBe("");
  });
});

describe("saveJobForm (ADR-143, ADR-147): one press of Save stores the whole form", () => {
  it("makes a new job first, then saves everything else with the address the job was made with", async () => {
    const stand = actions();
    const result = await saveJobForm({ jobId: null, values: VALUES, actions: stand });
    expect(stand.create).toHaveBeenCalledWith({
      title: "Site engineer",
      departmentId: "d1",
      location: "Chennai",
      workMode: "hybrid",
      employmentType: "full_time",
      experience: "3 years",
      applyUrl: "https://jobs.example.com/apply",
      applyEmail: null,
    });
    expect(stand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        slug: "site-engineer",
        summary: "Run our sites.",
        salaryNote: null,
        closesAt: "2026-12-31T18:00:00+05:30",
        applyUrl: "https://jobs.example.com/apply",
        applyEmail: null,
      }),
    );
    expect(result).toEqual({ ok: true, jobId: "job-1", slug: "site-engineer", created: true });
  });

  it("sends the address the admin typed with the new job, and an email apply with no link", async () => {
    const stand = actions();
    await saveJobForm({
      jobId: null,
      values: { ...VALUES, slug: "my-own", applyKind: "email", applyEmail: " HR@Example.com " },
      actions: stand,
    });
    expect(stand.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "my-own", applyUrl: null, applyEmail: "HR@Example.com" }),
    );
  });

  it("only updates a job that exists, and makes no second job", async () => {
    const stand = actions();
    const result = await saveJobForm({
      jobId: "job-9",
      values: { ...VALUES, slug: "kept-address" },
      actions: stand,
    });
    expect(stand.create).not.toHaveBeenCalled();
    expect(stand.update).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-9", slug: "kept-address" }),
    );
    expect(result).toMatchObject({ ok: true, jobId: "job-9", created: false });
  });

  it("stops at a refused create with no job id, so nothing is saved", async () => {
    const stand = actions();
    const failure = { ok: false as const, code: "VALIDATION" as const };
    stand.create.mockResolvedValue(failure);
    const result = await saveJobForm({ jobId: null, values: VALUES, actions: stand });
    expect(stand.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, step: "create", jobId: null, slug: null, failure });
  });

  it("keeps the job id when the update is refused, so the next save updates the same job", async () => {
    const stand = actions();
    const failure = { ok: false as const, code: "VALIDATION" as const };
    stand.update.mockResolvedValue(failure);
    const result = await saveJobForm({ jobId: null, values: VALUES, actions: stand });
    expect(result).toEqual({
      ok: false,
      step: "update",
      jobId: "job-1",
      slug: "site-engineer",
      failure,
    });
  });
});
