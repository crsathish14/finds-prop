import { describe, expect, it, vi } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { closeListingConfig, deleteListingConfig } from "../action-config";
import { mapListingError } from "../listing-service";
import {
  closeOwnListing,
  deleteOwnListing,
  type ClosedListing,
  type MyListingsStore,
} from "../my-listings-service";
import { closeListingSchema, deleteListingSchema } from "../schemas";
import { toMyListings } from "../view";

const LISTING = "00000000-0000-4000-9000-000000000001";

const owner: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const noPhone: SessionView = { ...owner, phoneVerified: false };

function harness(options: { session?: SessionView | null } = {}) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? owner : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
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
  const handler = async () => {
    calls.push("handler");
    return { listingId: LISTING, shortId: "abcd2345", status: "sold" };
  };
  return {
    calls,
    close: define({ ...closeListingConfig, handler }),
    remove: define({ ...deleteListingConfig, handler }),
  };
}

describe("UT-my-listings-schemas: closing and deleting (S6-T03)", () => {
  it("accepts sold and rented for a listing id", () => {
    expect(closeListingSchema.safeParse({ listingId: LISTING, outcome: "sold" }).success).toBe(
      true,
    );
    expect(closeListingSchema.safeParse({ listingId: LISTING, outcome: "rented" }).success).toBe(
      true,
    );
  });

  it.each([
    {},
    { listingId: LISTING },
    { listingId: LISTING, outcome: "gone" },
    { listingId: LISTING, outcome: "approved" },
    { listingId: "nope", outcome: "sold" },
    { outcome: "sold" },
  ])("refuses closing with %j", (input) => {
    expect(closeListingSchema.safeParse(input).success).toBe(false);
  });

  it("takes a listing id to delete, in lower case, and nothing else", () => {
    expect(deleteListingSchema.parse({ listingId: LISTING.toUpperCase() })).toEqual({
      listingId: LISTING,
    });
    expect(deleteListingSchema.safeParse({}).success).toBe(false);
    expect(deleteListingSchema.safeParse({ listingId: "nope" }).success).toBe(false);
  });
});

describe("UT-my-listings-actions: who may close or delete, and what it refreshes (S6-T03)", () => {
  it("closing needs a verified phone, has no limit or key, and refreshes that home's tags", async () => {
    const { close, calls } = harness();
    const answer = await close({ listingId: LISTING, outcome: "sold" });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual(["handler", "invalidate:home-listings|property:abcd2345"]);
  });

  it("deleting refreshes the same tags", async () => {
    const { remove, calls } = harness();
    const answer = await remove({ listingId: LISTING });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual(["handler", "invalidate:home-listings|property:abcd2345"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["an account with no verified phone", noPhone, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs", async (_who, session, code) => {
    const { close, remove, calls } = harness({ session });
    expect(await close({ listingId: LISTING, outcome: "sold" })).toMatchObject({ ok: false, code });
    expect(await remove({ listingId: LISTING })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses an outcome that is not sold or rented, before the handler", async () => {
    const { close, calls } = harness();
    const answer = await close({ listingId: LISTING, outcome: "approved" });
    expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });
});

describe("UT-my-listings-service: what the owner's calls hand back (S6-T03)", () => {
  const closed: ClosedListing = { listingId: LISTING, shortId: "abcd2345", status: "sold" };

  it("closes with the listing and the outcome, and returns what the database answered", async () => {
    const close = vi.fn<MyListingsStore["close"]>().mockResolvedValue(closed);
    const store: MyListingsStore = { close, remove: vi.fn() };
    expect(await closeOwnListing(store, { listingId: LISTING, outcome: "sold" })).toEqual(closed);
    expect(close).toHaveBeenCalledWith(LISTING, "sold");
  });

  it("deletes and returns the short id for the cache tags", async () => {
    const store: MyListingsStore = { close: vi.fn(), remove: async () => "abcd2345" };
    expect(await deleteOwnListing(store, { listingId: LISTING })).toEqual({
      listingId: LISTING,
      shortId: "abcd2345",
    });
  });

  it("answers not found when nothing was deleted (not theirs, or already gone)", async () => {
    const store: MyListingsStore = { close: vi.fn(), remove: async () => null };
    await expect(deleteOwnListing(store, { listingId: LISTING })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("UT-my-listings-errors: the database's answers as action errors (S6-T03)", () => {
  it.each([
    [{ message: "listing.not_closable", code: "55000" }, "CONFLICT"],
    [{ message: "listing.not_found", code: "P0002" }, "NOT_FOUND"],
    [{ message: "listing.not_allowed", code: "42501" }, "FORBIDDEN"],
    [{ message: "listing.wrong_outcome", code: "22023" }, "VALIDATION"],
    [{ message: "listing.bad_outcome", code: "22023" }, "VALIDATION"],
  ])("maps %j to %s", (failure, code) => {
    const error = mapListingError(failure);
    expect(error).toBeInstanceOf(ActionError);
    expect(error.code).toBe(code);
  });

  it("puts a wrong outcome on the outcome field", () => {
    expect(mapListingError({ message: "listing.wrong_outcome" }).fieldErrors).toEqual({
      outcome: [{ key: "validation.invalid" }],
    });
  });
});

describe("UT-my-listings-view: the rows of My listings (S6-T03)", () => {
  const row = (extra: Record<string, unknown> = {}) => ({
    id: "l1",
    short_id: "abcd2345",
    slug: "flat-in-adyar",
    status: "approved",
    listing_type: "sale",
    property_type: "apartment",
    title: "Flat in Adyar",
    price: 8500000,
    locality: "Adyar",
    rejection_reason: null,
    created_at: "2026-11-05T10:00:00+00:00",
    ...extra,
  });
  const address = (path: string) => `https://files.example/${path}`;

  it("maps a row and gives it the first photo by position as its cover", () => {
    const [listing] = toMyListings(
      [row()],
      [
        { listing_id: "l1", storage_path: "u/l1/second.jpg", position: 1 },
        { listing_id: "l1", storage_path: "u/l1/first.jpg", position: 0 },
        { listing_id: "other", storage_path: "u/x/other.jpg", position: 0 },
      ],
      address,
    );
    expect(listing).toMatchObject({
      id: "l1",
      shortId: "abcd2345",
      slug: "flat-in-adyar",
      status: "approved",
      listingType: "sale",
      propertyType: "apartment",
      price: 8500000,
      coverUrl: "https://files.example/u/l1/first.jpg",
    });
  });

  it("has no cover for a listing with no photos", () => {
    expect(toMyListings([row()], [], address)[0]?.coverUrl).toBeNull();
  });

  it("keeps the reason only while the listing is rejected", () => {
    const [rejected, approved] = toMyListings(
      [
        row({ id: "l2", status: "rejected", rejection_reason: "Add a photo of the home." }),
        row({ rejection_reason: "left over" }),
      ],
      [],
      address,
    );
    expect(rejected?.rejectionReason).toBe("Add a photo of the home.");
    expect(approved?.rejectionReason).toBeNull();
  });

  it("leaves out a draft or a row that is not shaped as a listing, and reads unknown kinds as none", () => {
    const listings = toMyListings(
      [
        row({ status: "draft" }),
        { id: 1 },
        null,
        row({ listing_type: "lease", property_type: "castle" }),
      ],
      [],
      address,
    );
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({ listingType: null, propertyType: null });
  });

  it("keeps the order the rows came in", () => {
    const listings = toMyListings([row({ id: "b" }), row({ id: "a" })], [], address);
    expect(listings.map((listing) => listing.id)).toEqual(["b", "a"]);
  });
});
