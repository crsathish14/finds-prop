import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  archiveBlogPostConfig,
  createBlogPostConfig,
  publishBlogPostConfig,
  restoreBlogPostConfig,
  setBlogCoverConfig,
  trashBlogPostConfig,
  unpublishBlogPostConfig,
  updateBlogPostConfig,
} from "../action-config";
import type { PostDone } from "../post-service";

const POST = "00000000-0000-4000-b500-0000000000a1";

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
  const done: PostDone = {
    postId: POST,
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
    create: define({ ...createBlogPostConfig, handler }),
    update: define({ ...updateBlogPostConfig, handler }),
    cover: define({ ...setBlogCoverConfig, handler }),
    publish: define({ ...publishBlogPostConfig, handler }),
    unpublish: define({ ...unpublishBlogPostConfig, handler }),
    archive: define({ ...archiveBlogPostConfig, handler }),
    trash: define({ ...trashBlogPostConfig, handler }),
    restore: define({ ...restoreBlogPostConfig, handler }),
  };
}

const create = { title: "A new guide", authorName: "Asha Rao" };
const editor = {
  postId: POST,
  title: "A new guide",
  slug: "new-slug",
  excerpt: "Short.",
  body: [{ type: "paragraph", text: "Hi" }],
  categoryId: null,
  tags: [],
  authorName: "Asha Rao",
  seoTitle: "",
  seoDescription: "",
};
const cover = { postId: POST, coverPath: null, coverAlt: null };
const idOnly = { postId: POST };

function everyAction(suite: ReturnType<typeof harness>) {
  return [
    () => suite.create(create),
    () => suite.update(editor),
    () => suite.cover(cover),
    () => suite.publish(idOnly),
    () => suite.unpublish(idOnly),
    () => suite.archive(idOnly),
    () => suite.trash(idOnly),
    () => suite.restore(idOnly),
  ];
}

describe("UT-blog-actions: who may manage the Blog, and what it refreshes (ADR-143)", () => {
  it("lets a super admin do each of the eight things: the admin_edit limit, the handler, the Blog's list and both addresses' pages, no audit entry from the app", async () => {
    const suite = harness();
    for (const run of everyAction(suite)) expect((await run()).ok).toBe(true);
    const once = [
      "rateLimit:admin_edit",
      "handler",
      "invalidate:blog|blog-post:old-slug|blog-post:new-slug",
    ];
    expect(suite.calls).toEqual(Array.from({ length: 8 }, () => once).flat());
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

  it("refuses an article that is not valid before the handler, naming the box", async () => {
    const suite = harness();
    expect(await suite.update({ ...editor, slug: "Not A Slug" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { slug: [{ key: "validation.blogSlugInvalid" }] },
    });
    expect(
      await suite.update({ ...editor, body: [{ type: "html", text: "<b>x</b>" }] }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(suite.calls).toEqual([]);
  });

  it("does not pass on a status, a publish date or an author id the caller adds", async () => {
    const suite = harness();
    await suite.update({
      ...editor,
      status: "published",
      publishedAt: "2020-01-01",
      authorId: "00000000-0000-4000-8000-0000000000ff",
    });
    expect(suite.received).toHaveLength(1);
    const input = suite.received[0] as Record<string, unknown>;
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("publishedAt");
    expect(input).not.toHaveProperty("authorId");
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const suite = harness({ rateLimited: true });
    expect(await suite.publish(idOnly)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 900,
    });
    expect(suite.calls).toEqual(["rateLimit:admin_edit"]);
  });
});
