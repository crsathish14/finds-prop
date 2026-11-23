import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  closeJobConfig,
  createJobConfig,
  openJobConfig,
  restoreJobConfig,
  trashJobConfig,
  unpublishJobConfig,
  updateJobConfig,
} from "../action-config";
import type { JobDone } from "../job-service";

const JOB = "00000000-0000-4000-b600-0000000000a1";
const DEPARTMENT = "00000000-0000-4000-b600-0000000000d1";

const admin: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000ad",
  roles: ["customer", "super_admin"],
  phoneVerified: false,
  builderId: null,
};
const customer: SessionView = { ...admin, roles: ["customer"], phoneVerified: true };
const builder: SessionView = {
  ...admin,
  roles: ["customer", "builder"],
  builderId: "00000000-0000-4000-8000-0000000000b1",
};

function harness(options: { session?: SessionView | null; rateLimited?: boolean } = {}) {
  const calls: string[] = [];
  const received: unknown[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? admin : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 900 }))
        : Promise.resolve();
    },
    beginIdempotent: () => {
      calls.push("begin");
      return Promise.resolve({ replay: false as const });
    },
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => {
      calls.push("audit");
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const done: JobDone = {
    jobId: JOB,
    slug: "new-slug",
    status: "draft",
    slugs: ["old-slug", "new-slug"],
  };
  const handler = ({ input }: { input: unknown }) => {
    calls.push("handler");
    received.push(input);
    return Promise.resolve(done);
  };
  return {
    calls,
    received,
    create: define({ ...createJobConfig, handler }),
    update: define({ ...updateJobConfig, handler }),
    open: define({ ...openJobConfig, handler }),
    close: define({ ...closeJobConfig, handler }),
    unpublish: define({ ...unpublishJobConfig, handler }),
    trash: define({ ...trashJobConfig, handler }),
    restore: define({ ...restoreJobConfig, handler }),
  };
}

const create = {
  title: "Site Engineer",
  departmentId: DEPARTMENT,
  location: "Chennai",
  workMode: "onsite",
  employmentType: "full_time",
  experience: "2 to 4 years",
  applyUrl: "https://jobs.example.test/site-engineer",
  applyEmail: "",
};
const editor = {
  jobId: JOB,
  ...create,
  slug: "new-slug",
  summary: "Supervise our sites.",
  description: "A description.",
  responsibilities: "Visit sites",
  requirements: "A degree",
  salaryNote: "",
  closesAt: "",
};
const idOnly = { jobId: JOB };

function everyAction(suite: ReturnType<typeof harness>) {
  return [
    () => suite.create(create),
    () => suite.update(editor),
    () => suite.open(idOnly),
    () => suite.close(idOnly),
    () => suite.unpublish(idOnly),
    () => suite.trash(idOnly),
    () => suite.restore(idOnly),
  ];
}

describe("UT-careers-actions: who may manage the Careers module, and what it refreshes (ADR-143)", () => {
  it("lets a super admin do each of the seven things: the admin_edit limit, the handler, the careers list and both addresses' pages, no audit entry from the app", async () => {
    const suite = harness();
    for (const run of everyAction(suite)) expect((await run()).ok).toBe(true);
    const once = [
      "rateLimit:admin_edit",
      "handler",
      "invalidate:careers|job:old-slug|job:new-slug",
    ];
    expect(suite.calls).toEqual(Array.from({ length: 7 }, () => once).flat());
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const suite = harness({ session });
    for (const run of everyAction(suite)) expect(await run()).toMatchObject({ ok: false, code });
    expect(suite.calls).toEqual([]);
  });

  it("refuses a job that is not valid before the handler, naming the box", async () => {
    const suite = harness();
    expect(await suite.update({ ...editor, slug: "Not A Slug" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { slug: [{ key: "validation.jobSlugInvalid" }] },
    });
    expect(await suite.update({ ...editor, applyUrl: "http://jobs.example.test/x" })).toMatchObject(
      {
        ok: false,
        code: "VALIDATION",
        fieldErrors: { applyUrl: [{ key: "validation.jobApplyUrlInvalid" }] },
      },
    );
    expect(suite.calls).toEqual([]);
  });

  it("refuses a job with both ways to apply, and one with neither", async () => {
    const suite = harness();
    const both = await suite.create({ ...create, applyEmail: "jobs@example.test" });
    expect(both).toMatchObject({
      ok: false,
      fieldErrors: { applyUrl: [{ key: "validation.jobApplyOne" }] },
    });
    const neither = await suite.create({ ...create, applyUrl: "" });
    expect(neither).toMatchObject({
      ok: false,
      fieldErrors: { applyUrl: [{ key: "validation.jobApplyOne" }] },
    });
    expect(suite.calls).toEqual([]);
  });

  it("does not pass on a status, a posted date or a Trash date the caller adds", async () => {
    const suite = harness();
    await suite.update({
      ...editor,
      status: "open",
      postedAt: "2020-01-01",
      deletedAt: "2020-01-01",
      ownerId: "00000000-0000-4000-8000-0000000000ff",
    });
    expect(suite.received).toHaveLength(1);
    const input = suite.received[0] as Record<string, unknown>;
    for (const name of ["status", "postedAt", "deletedAt", "ownerId"]) {
      expect(input).not.toHaveProperty(name);
    }
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const suite = harness({ rateLimited: true });
    expect(await suite.open(idOnly)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 900,
    });
    expect(suite.calls).toEqual(["rateLimit:admin_edit"]);
  });
});
