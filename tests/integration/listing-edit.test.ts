import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SaveListingChangesInput } from "@/features/listings";
import { adminClient, visitorClient, type TestClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { myListingsStore } = await import("@/features/listings/my-listings-store");
const { saveOwnChanges } = await import("@/features/listings/my-listings-service");
const { listingCallerStore } = await import("@/features/listings/service");
const { sendForReview } = await import("@/features/listings/listing-service");
const { changesNeedReview } = await import("@/features/listings/review-rule");
const { ActionError } = await import("@/server/actions/normalise-error");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

/** Signs in someone with an email address, without a mail: a one-time link made by the service role, redeemed here. */
async function signInByLink(email: string): Promise<TestClient> {
  const admin = adminClient();
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error("Could not make a sign-in link");
  const client = visitorClient();
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error || !verified.data.user) throw new Error("Could not sign in");
  return client;
}

const BASE = {
  listingType: "sale",
  propertyType: "apartment",
  title: "Home for the edit tests in Adyar",
  description: "A bright flat.",
  address: "12 Beach Road",
} as const;

describe("IT-listing-edit: saving changes to a listing against a real database (S6-T05, DEC-09)", () => {
  const admin = adminClient();
  let owner: TestUser;
  let stranger: { userId: string; client: TestClient };
  const madeListings: string[] = [];
  const madeUsers: string[] = [];

  const store = () => myListingsStore(owner.client);

  const newListing = async (
    status: "pending" | "approved" | "rejected" | "sold" | "draft",
    ownerId = owner.userId,
  ) => {
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: madeUpShortId(),
        slug: `it-listing-edit-${randomUUID()}`,
        status,
        ...(status === "rejected" ? { rejection_reason: "Add a photo of the home." } : {}),
        listing_type: BASE.listingType,
        property_type: BASE.propertyType,
        title: BASE.title,
        description: BASE.description,
        price: 8500000,
        area_sqft: 950,
        locality: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: BASE.address,
      })
      .select("id, short_id")
      .single();
    if (error) throw new Error(`Could not create a listing (${error.code})`);
    madeListings.push(data.id);
    return { id: data.id, shortId: data.short_id };
  };

  const rowOf = async (listingId: string) => {
    const { data, error } = await admin
      .from("properties")
      .select("*")
      .eq("id", listingId)
      .maybeSingle();
    if (error) throw new Error(`Could not read the listing (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    owner = await signInTestCustomer();
    const email = `it-listing-edit-other-${RUN}@example.test`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not create the other owner");
    madeUsers.push(created.data.user.id);
    stranger = { userId: created.data.user.id, client: await signInByLink(email) };
  });

  afterAll(async () => {
    if (madeListings.length > 0) await admin.from("properties").delete().in("id", madeListings);
    for (const id of madeUsers) await admin.auth.admin.deleteUser(id);
    await removeTestUser();
  });

  describe("policy C: the rule on screen and the trigger agree", () => {
    const moderated = [
      ["listingType", { listingType: "rent" }, { listing_type: "rent" }],
      ["propertyType", { propertyType: "villa" }, { property_type: "villa" }],
      [
        "title",
        { title: "A different title for the edit tests" },
        { title: "A different title for the edit tests" },
      ],
      [
        "description",
        { description: "Now with a longer description." },
        { description: "Now with a longer description." },
      ],
      ["address", { address: "14 Beach Road" }, { address: "14 Beach Road" }],
    ] as const;

    it.each(moderated)(
      "a change of %s sends a Live listing back to review, as the rule says",
      async (_field, fields, columns) => {
        const listing = await newListing("approved");
        const done = await saveOwnChanges(store(), { listingId: listing.id, fields });
        expect(done).toMatchObject({
          shortId: listing.shortId,
          status: "pending",
          wentBackToReview: true,
        });
        expect(changesNeedReview("approved", BASE, { ...BASE, ...fields })).toBe(true);
        const row = await rowOf(listing.id);
        expect(row).toMatchObject({ status: "pending", ...columns });
        expect(row?.submitted_at).not.toBeNull();
      },
    );

    const kept: [string, SaveListingChangesInput["fields"]][] = [
      ["price", { price: 9000000 }],
      ["areaSqft", { areaSqft: 1000 }],
      ["bhk", { bhk: 3 }],
      ["bathrooms", { bathrooms: 2 }],
      ["furnishing", { furnishing: "semi" }],
      ["amenities", { amenities: ["Lift", "Gym"] }],
      ["locality", { locality: "Mylapore" }],
      ["city", { city: "Chennai" }],
      ["pincode", { pincode: "600004" }],
    ];

    it.each(kept)(
      "a change of %s keeps a Live listing Live, as the rule says",
      async (_field, fields) => {
        const listing = await newListing("approved");
        const done = await saveOwnChanges(store(), { listingId: listing.id, fields });
        expect(done).toMatchObject({ status: "approved", wentBackToReview: false });
        expect(changesNeedReview("approved", BASE, BASE)).toBe(false);
        expect((await rowOf(listing.id))?.status).toBe("approved");
      },
    );

    it("keeps a Live listing Live when the same title is saved again, spacing aside", async () => {
      const listing = await newListing("approved");
      const done = await saveOwnChanges(store(), {
        listingId: listing.id,
        fields: { title: BASE.title, address: BASE.address, price: 8600000 },
      });
      expect(done.status).toBe("approved");
    });
  });

  describe("listings that are not Live", () => {
    it("saves a change to a listing in review and leaves it in review", async () => {
      const listing = await newListing("pending");
      const done = await saveOwnChanges(store(), {
        listingId: listing.id,
        fields: { title: "A better title while in review" },
      });
      expect(done).toMatchObject({ status: "pending", wentBackToReview: false });
      expect((await rowOf(listing.id))?.title).toBe("A better title while in review");
    });

    it("saves a change to a rejected listing, keeps it rejected with its reason, and lets it be resubmitted", async () => {
      const listing = await newListing("rejected");
      const photo = await admin.from("listing_media").insert({
        listing_id: listing.id,
        storage_path: `${owner.userId}/${listing.id}/${RUN}.jpg`,
        mime: "image/jpeg",
        bytes: 1000,
        width: 800,
        height: 600,
        position: 0,
      });
      expect(photo.error).toBeNull();
      // The Live listings changed above are in review now and count towards the limit of five open ones.
      await admin
        .from("properties")
        .delete()
        .eq("owner_id", owner.userId)
        .in("status", ["draft", "pending"]);
      const done = await saveOwnChanges(store(), {
        listingId: listing.id,
        fields: { description: "Now with a photo of the home itself." },
      });
      expect(done).toMatchObject({ status: "rejected", wentBackToReview: false });
      expect(await rowOf(listing.id)).toMatchObject({
        status: "rejected",
        rejection_reason: "Add a photo of the home.",
      });
      const shortId = await sendForReview(listingCallerStore(owner.client), {
        listingId: listing.id,
      });
      expect(shortId.shortId).toBe(listing.shortId);
      expect(await rowOf(listing.id)).toMatchObject({ status: "pending", rejection_reason: null });
    });
  });

  describe("what is refused", () => {
    it("refuses a sold listing: it is final", async () => {
      const listing = await newListing("sold");
      const error = await failureOf(() =>
        saveOwnChanges(store(), { listingId: listing.id, fields: { price: 1 } }),
      );
      expect(error.code).toBe("CONFLICT");
    });

    it("refuses a draft here: the wizard saves those", async () => {
      const listing = await newListing("draft");
      const error = await failureOf(() =>
        saveOwnChanges(store(), { listingId: listing.id, fields: { price: 1 } }),
      );
      expect(error.code).toBe("CONFLICT");
    });

    it("looks the same for someone else's listing as for one that does not exist, and leaves it alone", async () => {
      const theirs = await newListing("approved", stranger.userId);
      expect(
        (
          await failureOf(() =>
            saveOwnChanges(store(), { listingId: theirs.id, fields: { price: 1 } }),
          )
        ).code,
      ).toBe("NOT_FOUND");
      expect(
        (
          await failureOf(() =>
            saveOwnChanges(store(), { listingId: randomUUID(), fields: { price: 1 } }),
          )
        ).code,
      ).toBe("NOT_FOUND");
      expect((await rowOf(theirs.id))?.price).toBe(8500000);
    });

    it("refuses an edit that would leave a required field empty", async () => {
      const listing = await newListing("pending");
      const error = await failureOf(() =>
        saveOwnChanges(store(), { listingId: listing.id, fields: { title: null } }),
      );
      expect(error.code).toBe("VALIDATION");
      expect((await rowOf(listing.id))?.title).toBe(BASE.title);
    });
  });
});
