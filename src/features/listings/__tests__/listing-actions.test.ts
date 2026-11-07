import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  createDraftConfig,
  deleteDraftConfig,
  saveDraftConfig,
  submitListingConfig,
} from "../action-config";

const LISTING = "00000000-0000-4000-9000-000000000001";
const KEY = "00000000-0000-4000-8000-000000000001";

const verified: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const noPhone: SessionView = { ...verified, phoneVerified: false };

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; replay?: unknown } = {},
) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? verified : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 3600 }))
        : Promise.resolve();
    },
    beginIdempotent: ({ scope, key }) => {
      calls.push(`begin:${scope}:${key}`);
      return Promise.resolve(
        options.replay === undefined
          ? { replay: false as const }
          : { replay: true as const, result: options.replay },
      );
    },
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const handler = async () => {
    calls.push("handler");
    return { listingId: LISTING, shortId: "abcd2345" };
  };
  return {
    calls,
    create: define({ ...createDraftConfig, handler }),
    save: define({ ...saveDraftConfig, handler }),
    remove: define({ ...deleteDraftConfig, handler }),
    submit: define({ ...submitListingConfig, handler }),
  };
}

describe("UT-listing-actions: who may post, and what it costs (S6-T02)", () => {
  it("starting a draft needs a verified phone, counts the listing_create limit and claims the key", async () => {
    const { create, calls } = harness();
    const answer = await create({ fields: { locality: "Adyar" }, idempotencyKey: KEY });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:listing_create",
      `begin:createListingDraft:${KEY}`,
      "handler",
    ]);
  });

  it("answers rate limited with when to try again, and never runs the handler", async () => {
    const { create, calls } = harness({ rateLimited: true });
    const answer = await create({ fields: {}, idempotencyKey: KEY });
    expect(answer).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 3600 });
    expect(calls).not.toContain("handler");
  });

  it("a double click with the same key gets the first answer and does not start a second draft", async () => {
    const first = { ok: true, data: { listingId: LISTING, shortId: "abcd2345" } };
    const { create, calls } = harness({ replay: first });
    const answer = await create({ fields: {}, idempotencyKey: KEY });
    expect(answer).toEqual(first);
    expect(calls).not.toContain("handler");
  });

  it("every action refuses a visitor, and an account with no verified phone", async () => {
    for (const session of [null, noPhone]) {
      const { create, save, remove, submit, calls } = harness({ session });
      const answers = await Promise.all([
        create({ fields: {}, idempotencyKey: KEY }),
        save({ listingId: LISTING, fields: {} }),
        remove({ listingId: LISTING }),
        submit({ listingId: LISTING, idempotencyKey: KEY }),
      ]);
      for (const answer of answers) expect(answer.ok).toBe(false);
      expect(answers.map((answer) => (answer.ok ? "ok" : answer.code))).toEqual(
        session === null
          ? ["UNAUTHENTICATED", "UNAUTHENTICATED", "UNAUTHENTICATED", "UNAUTHENTICATED"]
          : ["FORBIDDEN", "FORBIDDEN", "FORBIDDEN", "FORBIDDEN"],
      );
      expect(calls).not.toContain("handler");
    }
  });

  it("saving, deleting and submitting are not rate limited by listing_create, and nothing is refreshed on the site", async () => {
    const { save, remove, submit, calls } = harness();
    await save({ listingId: LISTING, fields: { title: "3 BHK apartment" } });
    await remove({ listingId: LISTING });
    await submit({ listingId: LISTING, idempotencyKey: KEY });
    expect(calls.filter((call) => call.startsWith("rateLimit"))).toEqual([]);
    expect(calls.filter((call) => call.startsWith("invalidate"))).toEqual([]);
  });

  it("submitting claims its key", async () => {
    const { submit, calls } = harness();
    await submit({ listingId: LISTING, idempotencyKey: KEY });
    expect(calls).toContain(`begin:submitListing:${KEY}`);
  });

  it("refuses a bad listing id or a field that breaks its rule before anything else runs", async () => {
    const { save, calls } = harness();
    const bad = await save({ listingId: "nope", fields: {} });
    expect(bad).toMatchObject({ ok: false, code: "VALIDATION" });
    const short = await save({ listingId: LISTING, fields: { title: "Flat" } });
    expect(short).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "fields.title": [{ key: "validation.titleTooShort" }] },
    });
    expect(calls).not.toContain("handler");
  });
});
