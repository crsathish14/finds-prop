import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { finalizePhotoConfig, removePhotoConfig, requestPhotoUploadConfig } from "../action-config";

const LISTING = "00000000-0000-4000-9000-000000000001";
const PHOTO = "00000000-0000-4000-8000-0000000000e1";

const verified: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

function harness(options: { session?: SessionView | null; rateLimited?: boolean } = {}) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? verified : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 600 }))
        : Promise.resolve();
    },
    beginIdempotent: () => Promise.resolve({ replay: false as const }),
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  return {
    calls,
    request: define({ ...requestPhotoUploadConfig, handler: async () => ({ token: "t" }) }),
    finalize: define({
      ...finalizePhotoConfig,
      handler: async () => ({ photoId: PHOTO, path: "p", shortId: "abcd2345" }),
    }),
    remove: define({ ...removePhotoConfig, handler: async () => ({ shortId: "abcd2345" }) }),
  };
}

describe("UT-photo-actions: who may add and remove photos, and what it costs (S6-T01)", () => {
  it("asking for an upload address needs a verified phone and counts the upload_url limit", async () => {
    const { request, calls } = harness();
    const answer = await request({ listingId: LISTING, mime: "image/jpeg", bytes: 1000 });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual(["rateLimit:upload_url"]);
  });

  it("answers rate limited, with when to try again", async () => {
    const { request } = harness({ rateLimited: true });
    const answer = await request({ listingId: LISTING, mime: "image/jpeg", bytes: 1000 });
    expect(answer).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 600 });
  });

  it.each([
    ["signed out", null],
    ["signed in without a verified phone", { ...verified, phoneVerified: false }],
  ])("refuses every photo action when %s", async (_label, session) => {
    const { request, finalize, remove } = harness({ session });
    const failed = [
      await request({ listingId: LISTING, mime: "image/jpeg", bytes: 1000 }),
      await finalize({ listingId: LISTING, path: "x" }),
      await remove({ listingId: LISTING, photoId: PHOTO }),
    ];
    for (const answer of failed) expect(answer.ok).toBe(false);
  });

  it("refuses an SVG, a GIF or any other declared type before anything else", async () => {
    const { request, calls } = harness();
    for (const mime of [
      "image/svg+xml",
      "image/gif",
      "text/html",
      "application/pdf",
      "image/heic",
    ]) {
      const answer = await request({ listingId: LISTING, mime, bytes: 1000 });
      expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    expect(calls).toEqual([]);
  });

  it("refuses a listing id that is not a UUID, and an empty size", async () => {
    const { request, remove } = harness();
    expect(
      await request({ listingId: "1; drop table", mime: "image/png", bytes: 10 }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await request({ listingId: LISTING, mime: "image/png", bytes: 0 })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await remove({ listingId: LISTING, photoId: "nope" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
  });

  it("does not take an owner from the request (a user id sent along is ignored)", async () => {
    const { request } = harness();
    const answer = await request({
      listingId: LISTING,
      mime: "image/png",
      bytes: 10,
      ownerId: "00000000-0000-4000-8000-0000000000a2",
    });
    expect(answer.ok).toBe(true);
  });

  it("refreshes the home's public pages after a photo is added or removed (policy C can take it off the site)", async () => {
    const { finalize, remove, calls } = harness();
    await finalize({ listingId: LISTING, path: "p" });
    await remove({ listingId: LISTING, photoId: PHOTO });
    expect(calls).toEqual([
      "invalidate:home-listings|property:abcd2345",
      "invalidate:home-listings|property:abcd2345",
    ]);
  });
});
