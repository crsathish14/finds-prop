import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { setListingLocationConfig } from "../action-config";
import { mapLocationError, setOwnLocation, type ListingLocationStore } from "../location-service";

const LISTING = "00000000-0000-4000-9000-000000000001";
// Distinctive numbers: any copy of them in an answer, an error or a log line is found by a plain search.
const LAT = 12.345678;
const LNG = 80.876543;
const POINT_TEXT = /12\.345678|80\.876543|12\.3457|80\.8765/;

const owner: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const noPhone: SessionView = { ...owner, phoneVerified: false };

type StoreOptions = {
  mine?: { shortId: string; status: string } | null;
  status?: string;
  failure?: { code?: string; message?: string };
};

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; store?: StoreOptions } = {},
) {
  const calls: string[] = [];
  const lines: string[] = [];
  const written: { listingId: string; lat: number; lng: number }[] = [];
  const stored: StoreOptions = {
    mine: { shortId: "abcd2345", status: "draft" },
    status: "draft",
    ...options.store,
  };
  const store: ListingLocationStore = {
    current: async () => (stored.mine === undefined ? null : stored.mine),
    setLocation: async (listingId, lat, lng) => {
      if (stored.failure) throw mapLocationError(stored.failure);
      written.push({ listingId, lat, lng });
      return stored.status ?? "draft";
    },
  };
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? owner : options.session),
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
    log: createLogger({}, { write: (line) => lines.push(line), level: "debug" }),
  };
  const define = createDefineAction(deps);
  // The same handler as the real action (actions.ts), which cannot be imported here ("use server", the real store).
  const action = define({
    ...setListingLocationConfig,
    handler: async ({ input, session, log }) => {
      calls.push("handler");
      if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
      const done = await setOwnLocation(store, input);
      log.info("listing location set", {
        listingId: done.listingId,
        status: done.status,
        wentBackToReview: done.wentBackToReview,
      });
      return done;
    },
  });
  return { calls, lines, written, action };
}

describe("UT-listing-location-action: setting where a listing is (ADR-141, FR-GEO-02)", () => {
  it("needs a verified phone, counts the existing project_save limit, and writes the point it was given", async () => {
    const { action, calls, written } = harness();
    const answer = await action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(answer).toEqual({
      ok: true,
      data: { listingId: LISTING, shortId: "abcd2345", status: "draft", wentBackToReview: false },
    });
    // A draft is not public, so the refresh after the write names no tag.
    expect(calls).toEqual(["rateLimit:project_save", "handler", "invalidate:"]);
    expect(written).toEqual([{ listingId: LISTING, lat: LAT, lng: LNG }]);
  });

  it("never answers with the point, and logs the listing and its state but not the point", async () => {
    const { action, lines } = harness();
    const answer = await action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(JSON.stringify(answer)).not.toMatch(POINT_TEXT);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).not.toMatch(POINT_TEXT);
    expect(lines.join("\n")).toContain("listing location set");
  });

  it("refuses a visitor and a signed-in account with no verified phone, before anything is counted", async () => {
    const visitor = harness({ session: null });
    expect(await visitor.action({ listingId: LISTING, lat: LAT, lng: LNG })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    const phoneless = harness({ session: noPhone });
    expect(await phoneless.action({ listingId: LISTING, lat: LAT, lng: LNG })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    for (const one of [visitor, phoneless]) {
      expect(one.calls).toEqual([]);
      expect(one.written).toEqual([]);
    }
  });

  it.each([
    ["a latitude past the pole", { lat: 90.5, lng: LNG }, "lat"],
    ["a latitude past the other pole", { lat: -90.1, lng: LNG }, "lat"],
    ["a longitude past the date line", { lat: LAT, lng: 180.5 }, "lng"],
    ["a longitude past the other side", { lat: LAT, lng: -181 }, "lng"],
    ["a latitude that is not a number", { lat: Number.NaN, lng: LNG }, "lat"],
    ["a longitude that is infinite", { lat: LAT, lng: Number.POSITIVE_INFINITY }, "lng"],
    ["a latitude typed as text", { lat: "12.3", lng: LNG }, "lat"],
    ["no latitude", { lng: LNG }, "lat"],
    ["no longitude", { lat: LAT }, "lng"],
    ["nothing at all", {}, "lat"],
  ])("refuses %s as a field error, and writes nothing", async (_name, numbers, field) => {
    const { action, written, calls, lines } = harness();
    const answer = await action({ listingId: LISTING, ...numbers });
    expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    if (answer.ok) throw new Error("expected a refusal");
    expect(answer.fieldErrors?.[field]).toBeDefined();
    expect(written).toEqual([]);
    expect(calls).not.toContain("handler");
    expect(JSON.stringify(answer)).not.toMatch(POINT_TEXT);
    expect(lines.join("\n")).not.toMatch(POINT_TEXT);
  });

  it("refuses a listing id that is not an id", async () => {
    const { action, written } = harness();
    expect(await action({ listingId: "nope", lat: LAT, lng: LNG })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(written).toEqual([]);
  });

  it("ignores who and what the request says it is: the owner is the session, nothing else is taken", async () => {
    const { action, written } = harness();
    const forged = {
      listingId: LISTING,
      lat: LAT,
      lng: LNG,
      ownerId: "someone-else",
      status: "approved",
    };
    const answer = await action(forged);
    expect(answer.ok).toBe(true);
    expect(written).toEqual([{ listingId: LISTING, lat: LAT, lng: LNG }]);
  });

  it("answers NOT_FOUND for a listing that is not the caller's, and never asks the database to store anything", async () => {
    const { action, written, lines } = harness({ store: { mine: null } });
    const answer = await action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(answer).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(written).toEqual([]);
    expect(JSON.stringify(answer)).not.toMatch(POINT_TEXT);
    expect(lines.join("\n")).not.toMatch(POINT_TEXT);
  });

  it("answers a validation problem on the place when the point is outside the region, without the point", async () => {
    const { action, lines } = harness({
      store: { failure: { code: "22023", message: "listing.location_out_of_region" } },
    });
    const answer = await action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(answer).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { location: [{ key: "validation.locationOutOfRegion" }] },
    });
    expect(JSON.stringify(answer)).not.toMatch(POINT_TEXT);
    expect(lines.join("\n")).not.toMatch(POINT_TEXT);
  });

  it("is limited: the answer is RATE_LIMITED with when to try again, and nothing runs", async () => {
    const { action, calls, written } = harness({ rateLimited: true });
    expect(await action({ listingId: LISTING, lat: LAT, lng: LNG })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:project_save"]);
    expect(written).toEqual([]);
  });

  it("refreshes the site only when a Live listing went back to review", async () => {
    const live = harness({
      store: { mine: { shortId: "abcd2345", status: "approved" }, status: "pending" },
    });
    const answer = await live.action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(answer).toMatchObject({ ok: true, data: { status: "pending", wentBackToReview: true } });
    expect(
      live.calls.some((call) => call.startsWith("invalidate:") && call.includes("abcd2345")),
    ).toBe(true);
    // The same point on a Live listing leaves it Live: nothing public changed.
    const same = harness({
      store: { mine: { shortId: "abcd2345", status: "approved" }, status: "approved" },
    });
    expect(await same.action({ listingId: LISTING, lat: LAT, lng: LNG })).toMatchObject({
      ok: true,
      data: { wentBackToReview: false },
    });
    expect(same.calls.filter((call) => call.startsWith("invalidate:"))).toEqual(["invalidate:"]);
    // A draft is not public either.
    const draft = harness();
    await draft.action({ listingId: LISTING, lat: LAT, lng: LNG });
    expect(draft.calls.filter((call) => call.startsWith("invalidate:"))).toEqual(["invalidate:"]);
  });
});

describe("UT-listing-location-service: what the database says, as the closed error set", () => {
  it.each([
    [
      { code: "22023", message: "listing.location_out_of_region" },
      "VALIDATION",
      "validation.locationOutOfRegion",
    ],
    [{ code: "22023", message: "listing.location_invalid" }, "VALIDATION", "validation.invalid"],
    [{ code: "22023" }, "VALIDATION", "validation.invalid"],
  ])("maps %j to a validation problem on the place", (failure, code, key) => {
    const error = mapLocationError(failure);
    expect(error.code).toBe(code);
    expect(error.fieldErrors).toEqual({ location: [{ key }] });
  });

  it.each([
    [{ code: "P0002", message: "listing.not_found" }, "NOT_FOUND"],
    [{ code: "55000", message: "listing.not_editable" }, "CONFLICT"],
    [{ code: "42501", message: "listing.not_allowed" }, "FORBIDDEN"],
    [{ code: "XX000", message: "boom" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    expect(mapLocationError(failure).code).toBe(code);
  });

  it("holds no point in any message it makes", () => {
    for (const failure of [
      { code: "22023", message: "listing.location_out_of_region", details: `(${LAT},${LNG})` },
      { code: "P0002", message: "listing.not_found", details: `(${LAT},${LNG})` },
      { code: "XX000", message: `bad ${LAT} ${LNG}`, details: `${LAT}` },
    ]) {
      const error = mapLocationError(failure);
      expect(error.message).not.toMatch(POINT_TEXT);
      expect(JSON.stringify(error.fieldErrors ?? {})).not.toMatch(POINT_TEXT);
    }
  });

  it("looks for the listing before it stores anything, and says whether it went back to review", async () => {
    const asked: string[] = [];
    const store: ListingLocationStore = {
      current: async (listingId) => {
        asked.push(`current:${listingId}`);
        return { shortId: "abcd2345", status: "approved" };
      },
      setLocation: async () => {
        asked.push("setLocation");
        return "pending";
      },
    };
    expect(await setOwnLocation(store, { listingId: LISTING, lat: LAT, lng: LNG })).toEqual({
      listingId: LISTING,
      shortId: "abcd2345",
      status: "pending",
      wentBackToReview: true,
    });
    expect(asked).toEqual([`current:${LISTING}`, "setLocation"]);
  });

  it("a listing in review that stays in review did not go back to review", async () => {
    const store: ListingLocationStore = {
      current: async () => ({ shortId: "abcd2345", status: "pending" }),
      setLocation: async () => "pending",
    };
    expect(
      (await setOwnLocation(store, { listingId: LISTING, lat: LAT, lng: LNG })).wentBackToReview,
    ).toBe(false);
  });
});
