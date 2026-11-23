import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  closeJob,
  createJob,
  mapJobError,
  openJob,
  restoreJob,
  saveJob,
  trashJob,
  unpublishJob,
  type JobPatch,
  type JobStore,
  type NewJobRow,
  type StoredJob,
} from "../job-service";
import type { CreateJobInput, UpdateJobInput } from "../schemas";

const JOB = "00000000-0000-4000-b600-0000000000a1";
const DEPARTMENT = "00000000-0000-4000-b600-0000000000d1";
const NOW = new Date("2026-06-01T00:00:00Z");

const READY: StoredJob = {
  id: JOB,
  slug: "site-engineer",
  status: "draft",
  deletedAt: null,
  closesAt: null,
  summary: "Supervise our sites.",
  description: "A description.",
  requirements: "A degree",
};

/** A stand-in store: it holds one job, records every write, and can be told to refuse inserts of some slugs. */
function stand(stored: StoredJob | null = READY, takenSlugs: string[] = []) {
  const inserted: NewJobRow[] = [];
  const updates: JobPatch[] = [];
  const store: JobStore = {
    insert(row) {
      inserted.push(row);
      if (takenSlugs.includes(row.slug)) throw mapJobError({ code: "23505" });
      return Promise.resolve({ jobId: JOB, slug: row.slug });
    },
    read: () => Promise.resolve(stored),
    update(_jobId, patch) {
      updates.push(patch);
      return Promise.resolve();
    },
  };
  return { store, inserted, updates };
}

async function failureOf(run: () => Promise<unknown>): Promise<ActionError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const CREATE: CreateJobInput = {
  title: "Site Engineer",
  departmentId: DEPARTMENT,
  location: "Chennai",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "",
  applyUrl: "https://jobs.example.test/site-engineer",
  applyEmail: null,
};

const SAVE: UpdateJobInput = {
  ...CREATE,
  jobId: JOB,
  slug: "site-engineer-2",
  summary: "Supervise our sites.",
  description: "A description.",
  responsibilities: "Visit sites",
  requirements: "A degree",
  salaryNote: null,
  closesAt: null,
};

describe("UT-careers-service: making a job", () => {
  it("makes a draft whose address comes from the title", async () => {
    const { store, inserted } = stand();
    const done = await createJob(store, CREATE);
    expect(done).toEqual({
      jobId: JOB,
      slug: "site-engineer",
      status: "draft",
      slugs: ["site-engineer"],
    });
    expect(inserted[0]).toMatchObject({
      slug: "site-engineer",
      department_id: DEPARTMENT,
      work_mode: "onsite",
      employment_type: "full_time",
      apply_url: "https://jobs.example.test/site-engineer",
      apply_email: null,
    });
  });

  it("numbers a made address that is taken, then adds a random tail", async () => {
    const numbered = stand(READY, ["site-engineer"]);
    expect((await createJob(numbered.store, CREATE)).slug).toBe("site-engineer-2");

    const many = stand(READY, [
      "site-engineer",
      "site-engineer-2",
      "site-engineer-3",
      "site-engineer-4",
      "site-engineer-5",
    ]);
    expect((await createJob(many.store, CREATE, () => "ab12")).slug).toBe("site-engineer-ab12");
  });

  it("refuses a typed address that is taken, naming the box", async () => {
    const { store, inserted } = stand(READY, ["mine"]);
    const failure = await failureOf(() => createJob(store, { ...CREATE, slug: "mine" }));
    expect(failure).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { slug: [{ key: "validation.jobSlugTaken" }] },
    });
    expect(inserted).toHaveLength(1);
  });

  it("passes on any other refusal from the database", async () => {
    const store: JobStore = {
      insert: () => Promise.reject(mapJobError({ code: "42501" })),
      read: () => Promise.resolve(null),
      update: () => Promise.resolve(),
    };
    expect(await failureOf(() => createJob(store, CREATE))).toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("UT-careers-service: saving a job", () => {
  it("writes what the editor sent and reports both addresses after a rename", async () => {
    const { store, updates } = stand();
    const done = await saveJob(store, SAVE, () => NOW);
    expect(done).toMatchObject({ slug: "site-engineer-2", status: "draft" });
    expect(done.slugs).toEqual(["site-engineer", "site-engineer-2"]);
    expect(updates[0]).toMatchObject({
      slug: "site-engineer-2",
      summary: "Supervise our sites.",
      requirements: "A degree",
      closes_at: null,
    });
    expect(updates[0]).not.toHaveProperty("status");
    expect(updates[0]).not.toHaveProperty("deleted_at");
  });

  it("lets a draft be saved with the long text still empty", async () => {
    const { store, updates } = stand();
    await saveJob(store, { ...SAVE, summary: "", description: "", requirements: "" }, () => NOW);
    expect(updates).toHaveLength(1);
  });

  it("keeps an open job complete: a save that empties a part is refused, naming each box", async () => {
    const { store, updates } = stand({ ...READY, status: "open" });
    const failure = await failureOf(() =>
      saveJob(store, { ...SAVE, summary: "", description: "", requirements: "" }, () => NOW),
    );
    expect(failure.fieldErrors).toEqual({
      summary: [{ key: "validation.jobNeedsSummary" }],
      description: [{ key: "validation.jobNeedsDescription" }],
      requirements: [{ key: "validation.jobNeedsRequirements" }],
    });
    expect(updates).toEqual([]);
  });

  it("refuses to save an open job with a closing date that has passed", async () => {
    const { store } = stand({ ...READY, status: "open" });
    const failure = await failureOf(() =>
      saveJob(store, { ...SAVE, closesAt: "2026-05-01T00:00:00.000Z" }, () => NOW),
    );
    expect(failure.fieldErrors).toEqual({ closesAt: [{ key: "validation.jobClosesPast" }] });
  });

  it("treats a job in Trash, or one that is not there, as not found", async () => {
    const trashed = stand({ ...READY, deletedAt: "2026-05-01T00:00:00Z" });
    expect(await failureOf(() => saveJob(trashed.store, SAVE, () => NOW))).toMatchObject({
      code: "NOT_FOUND",
    });
    const missing = stand(null);
    expect(await failureOf(() => saveJob(missing.store, SAVE, () => NOW))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(trashed.updates).toEqual([]);
  });
});

describe("UT-careers-service: opening, closing and Trash", () => {
  it("opens a complete job", async () => {
    const { store, updates } = stand();
    const done = await openJob(store, { jobId: JOB }, () => NOW);
    expect(done).toMatchObject({ status: "open", slugs: ["site-engineer"] });
    expect(updates).toEqual([{ status: "open" }]);
  });

  it("refuses to open a job that lacks a part, naming each box", async () => {
    const { store, updates } = stand({ ...READY, summary: " ", requirements: "" });
    const failure = await failureOf(() => openJob(store, { jobId: JOB }, () => NOW));
    expect(failure.fieldErrors).toEqual({
      summary: [{ key: "validation.jobNeedsSummary" }],
      requirements: [{ key: "validation.jobNeedsRequirements" }],
    });
    expect(updates).toEqual([]);
  });

  it("refuses to open a job whose closing moment has passed, and opens one that closes later", async () => {
    const past = stand({ ...READY, closesAt: "2026-05-31T00:00:00Z" });
    expect(
      (await failureOf(() => openJob(past.store, { jobId: JOB }, () => NOW))).fieldErrors,
    ).toEqual({ closesAt: [{ key: "validation.jobClosesPast" }] });
    const later = stand({ ...READY, closesAt: "2026-07-01T00:00:00Z" });
    expect((await openJob(later.store, { jobId: JOB }, () => NOW)).status).toBe("open");
  });

  it("opens a closed job again", async () => {
    const { store } = stand({ ...READY, status: "closed" });
    expect((await openJob(store, { jobId: JOB }, () => NOW)).status).toBe("open");
  });

  it("closes a job and takes one back to a draft", async () => {
    const closing = stand({ ...READY, status: "open" });
    expect(await closeJob(closing.store, { jobId: JOB })).toMatchObject({ status: "closed" });
    expect(closing.updates).toEqual([{ status: "closed" }]);
    const drafting = stand({ ...READY, status: "open" });
    expect(await unpublishJob(drafting.store, { jobId: JOB })).toMatchObject({ status: "draft" });
    expect(drafting.updates).toEqual([{ status: "draft" }]);
  });

  it("does not close or open a job in Trash", async () => {
    const { store } = stand({ ...READY, deletedAt: "2026-05-01T00:00:00Z" });
    expect(await failureOf(() => closeJob(store, { jobId: JOB }))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await failureOf(() => openJob(store, { jobId: JOB }, () => NOW))).toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("moves an open job to Trash closed, so restoring never puts it back on the site", async () => {
    const { store, updates } = stand({ ...READY, status: "open" });
    const done = await trashJob(store, { jobId: JOB }, () => NOW);
    expect(done.status).toBe("closed");
    expect(updates).toEqual([{ status: "closed", deleted_at: "2026-06-01T00:00:00.000Z" }]);
  });

  it("keeps a draft a draft in Trash, and does nothing for a job already there", async () => {
    const draft = stand();
    expect((await trashJob(draft.store, { jobId: JOB }, () => NOW)).status).toBe("draft");
    const again = stand({ ...READY, deletedAt: "2026-05-01T00:00:00Z" });
    await trashJob(again.store, { jobId: JOB }, () => NOW);
    expect(again.updates).toEqual([]);
  });

  it("restores a job from Trash with the status it had", async () => {
    const { store, updates } = stand({
      ...READY,
      status: "closed",
      deletedAt: "2026-05-01T00:00:00Z",
    });
    expect((await restoreJob(store, { jobId: JOB })).status).toBe("closed");
    expect(updates).toEqual([{ deleted_at: null }]);
  });
});

describe("UT-careers-service: what the database says becomes an action error", () => {
  it.each([
    [{ code: "23505" }, "VALIDATION", "slug"],
    [{ code: "23503" }, "VALIDATION", "departmentId"],
    [
      { code: "23514", message: "a job belongs to a department category" },
      "VALIDATION",
      "departmentId",
    ],
    [{ code: "23514", message: "new row violates check constraint" }, "VALIDATION", "_form"],
    [{ code: "22023" }, "VALIDATION", "_form"],
    [{ code: "P0002" }, "NOT_FOUND", undefined],
    [{ code: "PGRST116" }, "NOT_FOUND", undefined],
    [{ code: "42501" }, "FORBIDDEN", undefined],
    [{ code: "XX000" }, "INTERNAL", undefined],
    [{}, "INTERNAL", undefined],
  ] as const)("%j is %s", (failure, code, field) => {
    const error = mapJobError(failure);
    expect(error.code).toBe(code);
    if (field) expect(Object.keys(error.fieldErrors ?? {})).toEqual([field]);
  });
});
