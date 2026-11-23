import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the store below takes its client directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { jobStore } = await import("@/features/careers/service");
const { closeJob, createJob, openJob, restoreJob, saveJob, trashJob, unpublishJob } =
  await import("@/features/careers/job-service");
const { readAdminJob, readAdminJobCounts, readAdminJobList, readJobList } =
  await import("@/features/careers/queries");
const { ActionError } = await import("@/server/actions/normalise-error");

// ADR-143 phase 4, IT-careers: the Careers admin's store and the public search, against a real database. Every job
// belongs to this run's own departments, so nothing else in the database is touched, and the rows are removed at the end.

const RUN = randomUUID().slice(0, 8);

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-careers: the Careers module against a real database (ADR-143)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let customer: TestUser;
  let departmentId = "";
  let otherDepartmentId = "";
  let faqCategoryId = "";
  let jobId = "";
  let slug = "";
  const departmentSlug = `it-jobs-${RUN}`;
  const TITLE = `Integration engineer ${RUN}`;

  const newJob = () => ({
    title: TITLE,
    departmentId,
    location: "Chennai",
    workMode: "onsite" as const,
    employmentType: "full_time" as const,
    experience: "2 years",
    applyUrl: "https://jobs.example.test/integration",
    applyEmail: null,
  });

  const editor = () => ({
    ...newJob(),
    jobId,
    slug,
    summary: "A job written by the integration test.",
    description: `Surveying work for ${RUN} is described here.`,
    responsibilities: "Visit sites\nWrite reports",
    requirements: "A civil engineering degree",
    salaryNote: null,
    closesAt: null,
  });

  const visibleSlugs = async (words?: string) =>
    (
      await readJobList(visitorClient(), {
        department: departmentSlug,
        ...(words ? { query: words } : {}),
        page: 1,
      })
    ).items.map((card) => card.slug);

  async function addCategory(module: string, name: string, suffix: string) {
    const { data, error } = await admin
      .from("content_categories")
      .insert({ module, slug: `${departmentSlug}${suffix}`, name, active: true })
      .select("id")
      .single();
    if (error) throw new Error(`Could not add the category (${error.code})`);
    return data.id;
  }

  beforeAll(async () => {
    staff = await signInTestAdmin();
    customer = await signInTestCustomer();
    departmentId = await addCategory("department", `Jobs ${RUN}`, "");
    otherDepartmentId = await addCategory("department", `More jobs ${RUN}`, "-more");
    faqCategoryId = await addCategory("faq", `Questions ${RUN}`, "-faq");
  });

  afterAll(async () => {
    await admin
      .from("job_postings")
      .delete()
      .in("department_id", [departmentId, otherDepartmentId]);
    await admin
      .from("content_categories")
      .delete()
      .in("id", [departmentId, otherDepartmentId, faqCategoryId]);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("only the super admin makes a job: a customer and a visitor are refused", async () => {
    for (const client of [customer.client, visitorClient()]) {
      const refused = await failureOf(() => createJob(jobStore(client), newJob()));
      expect(refused.code).toBe("FORBIDDEN");
    }
  });

  it("makes a draft whose address comes from the title, and a second one gets a number", async () => {
    const done = await createJob(jobStore(staff.client), newJob());
    jobId = done.jobId;
    slug = done.slug;
    expect(slug).toMatch(/^integration-engineer-/);
    const second = await createJob(jobStore(staff.client), newJob());
    expect(second.slug).toBe(`${slug}-2`);
  });

  it("refuses a department that is not a department, naming the box", async () => {
    const refused = await failureOf(() =>
      createJob(jobStore(staff.client), { ...newJob(), departmentId: faqCategoryId }),
    );
    expect(refused.fieldErrors?.departmentId?.[0]?.key).toBe("validation.invalid");
  });

  it("keeps a draft from every visitor, found by address or by words", async () => {
    await saveJob(jobStore(staff.client), editor());
    expect(await visibleSlugs()).toEqual([]);
    const { data } = await visitorClient().from("job_postings").select("id").eq("id", jobId);
    expect(data).toEqual([]);
  });

  it("opens, and the visitor's search then finds it by a word in the description, with the matched word marked", async () => {
    const done = await openJob(jobStore(staff.client), { jobId });
    expect(done.status).toBe("open");
    expect(await visibleSlugs()).toContain(slug);
    const list = await readJobList(visitorClient(), {
      department: departmentSlug,
      query: "surveying",
      page: 1,
    });
    const card = list.items.find((item) => item.slug === slug);
    expect(card?.snippet).toContain("[[Surveying]]");
    expect(card?.department?.name).toBe(`Jobs ${RUN}`);
    const { data } = await admin.from("job_postings").select("posted_at").eq("id", jobId).single();
    expect(data?.posted_at).not.toBeNull();
  });

  it("filters by place, work mode and type", async () => {
    const find = async (filter: Record<string, string>) =>
      (await readJobList(visitorClient(), { department: departmentSlug, ...filter, page: 1 })).items
        .length;
    expect(await find({ location: "chennai" })).toBe(1);
    expect(await find({ location: "Madurai" })).toBe(0);
    expect(await find({ workMode: "onsite" })).toBe(1);
    expect(await find({ workMode: "remote" })).toBe(0);
    expect(await find({ type: "full_time" })).toBe(1);
    expect(await find({ type: "internship" })).toBe(0);
  });

  it("a job whose closing date has passed disappears from visitors with no scheduled job", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error } = await admin.from("job_postings").update({ closes_at: past }).eq("id", jobId);
    expect(error).toBeNull();
    expect(await visibleSlugs()).toEqual([]);
    const { data } = await visitorClient().from("job_postings").select("id").eq("id", jobId);
    expect(data).toEqual([]);
    const refused = await failureOf(() => openJob(jobStore(staff.client), { jobId }));
    expect(refused.fieldErrors?.closesAt?.[0]?.key).toBe("validation.jobClosesPast");

    const later = new Date(Date.now() + 86_400_000).toISOString();
    await admin.from("job_postings").update({ closes_at: later }).eq("id", jobId);
    expect(await visibleSlugs()).toContain(slug);
    await admin.from("job_postings").update({ closes_at: null }).eq("id", jobId);
  });

  it("closing hides a job at once, and opening a closed job shows it again", async () => {
    const closed = await closeJob(jobStore(staff.client), { jobId });
    expect(closed.status).toBe("closed");
    expect(await visibleSlugs()).toEqual([]);
    expect((await openJob(jobStore(staff.client), { jobId })).status).toBe("open");
    expect(await visibleSlugs()).toContain(slug);
    await unpublishJob(jobStore(staff.client), { jobId });
    expect(await visibleSlugs()).toEqual([]);
    await openJob(jobStore(staff.client), { jobId });
  });

  it("Trash closes an open job and hides it at once, and restoring never opens it again", async () => {
    const trashed = await trashJob(jobStore(staff.client), { jobId });
    expect(trashed.status).toBe("closed");
    expect(await visibleSlugs()).toEqual([]);
    const restored = await restoreJob(jobStore(staff.client), { jobId });
    expect(restored.status).toBe("closed");
    expect(await visibleSlugs()).toEqual([]);
    await openJob(jobStore(staff.client), { jobId });
    expect(await visibleSlugs()).toContain(slug);
  });

  it("the admin's list and counts see every status, and Trash apart", async () => {
    const all = await readAdminJobList(staff.client, { departmentId, page: 1 });
    expect(all.rows.map((row) => row.slug)).toContain(slug);
    const counts = await readAdminJobCounts(staff.client);
    expect(counts.open).toBeGreaterThanOrEqual(1);
    const one = await readAdminJob(staff.client, jobId);
    expect(one).toMatchObject({
      status: "open",
      applyUrl: "https://jobs.example.test/integration",
    });
  });

  it("the table itself refuses what the checks do not allow, whatever the application did before", async () => {
    const both = await staff.client
      .from("job_postings")
      .update({ apply_email: "jobs@example.test" })
      .eq("id", jobId);
    expect(both.error?.code).toBe("23514");
    const plain = await staff.client
      .from("job_postings")
      .update({ apply_url: "http://jobs.example.test/x" })
      .eq("id", jobId);
    expect(plain.error?.code).toBe("23514");
    const moved = await staff.client
      .from("job_postings")
      .update({ department_id: faqCategoryId })
      .eq("id", jobId);
    expect(moved.error?.code).toBe("23514");
  });

  it("no client deletes a job, not even the admin", async () => {
    const { data, error } = await staff.client
      .from("job_postings")
      .delete()
      .eq("id", jobId)
      .select("id");
    expect(error?.code ?? "no rows").toMatch(/42501|no rows/);
    expect(data ?? []).toEqual([]);
    const { data: still } = await admin.from("job_postings").select("id").eq("id", jobId);
    expect(still).toHaveLength(1);
  });
});
