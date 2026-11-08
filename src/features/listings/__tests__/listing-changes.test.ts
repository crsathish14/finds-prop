import { describe, expect, it, vi } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { saveListingChangesConfig } from "../action-config";
import { saveOwnChanges, type MyListingsStore } from "../my-listings-service";
import { saveListingChangesSchema } from "../schemas";

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
  const save = define({
    ...saveListingChangesConfig,
    handler: async () => {
      calls.push("handler");
      return { listingId: LISTING, shortId: "abcd2345", status: "approved" };
    },
  });
  return { calls, save };
}

describe("UT-listing-changes-schema: saving changes to a listing (S6-T05)", () => {
  it("takes a listing id and any of the wizard's fields, each checked by its own rule", () => {
    expect(
      saveListingChangesSchema.parse({
        listingId: LISTING.toUpperCase(),
        fields: { price: "9,500,000", title: "  A bright flat in Adyar  " },
      }),
    ).toEqual({ listingId: LISTING, fields: { price: 9500000, title: "A bright flat in Adyar" } });
  });

  it.each([
    {},
    { listingId: LISTING },
    { fields: {} },
    { listingId: "nope", fields: {} },
    { listingId: LISTING, fields: { title: "short" } },
    { listingId: LISTING, fields: { price: -1 } },
  ])("refuses %j", (input) => {
    expect(saveListingChangesSchema.safeParse(input).success).toBe(false);
  });
});

describe("UT-listing-changes-action: who may save changes, and what it refreshes (S6-T05)", () => {
  it("needs a verified phone, has no limit or key, and refreshes that home's tags", async () => {
    const { save, calls } = harness();
    const answer = await save({ listingId: LISTING, fields: { price: 9500000 } });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual(["handler", "invalidate:home-listings|property:abcd2345"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["an account with no verified phone", noPhone, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs", async (_who, session, code) => {
    const { save, calls } = harness({ session });
    expect(await save({ listingId: LISTING, fields: {} })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });
});

describe("UT-listing-changes-service: saving changes and telling a send back to review (S6-T05)", () => {
  const store = (status: string, after: string | null) => {
    const update = vi.fn<MyListingsStore["update"]>().mockResolvedValue(after);
    const made: MyListingsStore = {
      close: vi.fn(),
      remove: vi.fn(),
      current: async () => ({ shortId: "abcd2345", status }),
      update,
    };
    return { made, update };
  };
  const input = { listingId: LISTING, fields: { price: 9500000, propertyType: "villa" } } as const;

  it("saves the columns of the fields given, as read in the state it saw", async () => {
    const { made, update } = store("approved", "approved");
    expect(await saveOwnChanges(made, input)).toEqual({
      listingId: LISTING,
      shortId: "abcd2345",
      status: "approved",
      wentBackToReview: false,
    });
    expect(update).toHaveBeenCalledWith(
      LISTING,
      { state: "Tamil Nadu", price: 9500000, property_type: "villa" },
      "approved",
    );
  });

  it("says a Live listing went back to review when the database moved it to pending", async () => {
    const { made } = store("approved", "pending");
    expect(await saveOwnChanges(made, input)).toMatchObject({
      status: "pending",
      wentBackToReview: true,
    });
  });

  it("does not call a listing that was in review, or not approved, sent back", async () => {
    expect(await saveOwnChanges(store("pending", "pending").made, input)).toMatchObject({
      wentBackToReview: false,
    });
    expect(await saveOwnChanges(store("rejected", "rejected").made, input)).toMatchObject({
      status: "rejected",
      wentBackToReview: false,
    });
  });

  it("looks the same for someone else's listing as for one that does not exist", async () => {
    const made: MyListingsStore = {
      close: vi.fn(),
      remove: vi.fn(),
      current: async () => null,
      update: vi.fn(),
    };
    await expect(saveOwnChanges(made, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(made.update).not.toHaveBeenCalled();
  });

  it.each(["draft", "sold", "rented"])("refuses a %s listing without writing", async (status) => {
    const { made, update } = store(status, status);
    await expect(saveOwnChanges(made, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers a conflict when the listing changed state between the read and the write", async () => {
    const { made } = store("pending", null);
    await expect(saveOwnChanges(made, input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
