import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient, type TestClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { myListingsStore } = await import("@/features/listings/my-listings-store");
const { closeOwnListing, deleteOwnListing } =
  await import("@/features/listings/my-listings-service");
const { MY_LISTING_COLUMNS, toMyListings } = await import("@/features/listings/view");
const { enquiryStatusStore } = await import("@/features/enquiries/status-store");
const { moveEnquiry } = await import("@/features/enquiries/status-service");
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

describe("IT-actions-listing: closing, deleting and enquiry status against a real database (S6-T03, ADR-067)", () => {
  const admin = adminClient();
  let owner: TestUser;
  let stranger: { userId: string; client: TestClient };
  const madeListings: string[] = [];
  const madeUsers: string[] = [];

  const store = () => myListingsStore(owner.client);

  const newListing = async (
    status: "pending" | "approved" | "sold",
    kind: "sale" | "rent" = "sale",
    ownerId = owner.userId,
  ) => {
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: madeUpShortId(),
        slug: `it-my-listings-${randomUUID()}`,
        status,
        listing_type: kind,
        property_type: "apartment",
        title: `Home for the dashboard ${RUN}`,
        description: "A bright flat.",
        price: kind === "sale" ? 8500000 : 48000,
        area_sqft: 950,
        locality: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: "12 Beach Road",
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

  const newEnquiry = async (listingId: string, name = "Arjun Menon") => {
    const { data, error } = await admin
      .from("enquiries")
      .insert({ property_id: listingId, name, phone: "9841055512", message: "Is it available?" })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create an enquiry (${error.code})`);
    return data.id;
  };

  beforeAll(async () => {
    owner = await signInTestCustomer();
    const email = `it-my-listings-other-${RUN}@example.test`;
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

  describe("closing a listing", () => {
    it("marks a Live sale listing sold: closed_at is stamped, it is no longer featured, and the owner is in the audit log", async () => {
      const listing = await newListing("approved");
      await admin.from("properties").update({ featured: true }).eq("id", listing.id);
      const done = await closeOwnListing(store(), { listingId: listing.id, outcome: "sold" });
      expect(done).toEqual({ listingId: listing.id, shortId: listing.shortId, status: "sold" });
      expect(await rowOf(listing.id)).toMatchObject({ status: "sold", featured: false });
      expect((await rowOf(listing.id))?.closed_at).not.toBeNull();
      const { data, error } = await admin
        .from("audit_log")
        .select("actor_id, actor_role, diff")
        .eq("entity_id", listing.id)
        .eq("action", "listing.status_changed")
        .contains("diff", { to: "sold" });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]).toMatchObject({ actor_id: owner.userId, actor_role: "customer" });
    });

    it("marks a Live rent listing rented", async () => {
      const listing = await newListing("approved", "rent");
      const done = await closeOwnListing(store(), { listingId: listing.id, outcome: "rented" });
      expect(done.status).toBe("rented");
    });

    it("refuses the wrong outcome for the listing's type", async () => {
      const sale = await newListing("approved");
      const rent = await newListing("approved", "rent");
      const wrongForSale = await failureOf(() => store().close(sale.id, "rented"));
      const wrongForRent = await failureOf(() => store().close(rent.id, "sold"));
      expect(wrongForSale.code).toBe("VALIDATION");
      expect(wrongForSale.fieldErrors).toHaveProperty("outcome");
      expect(wrongForRent.code).toBe("VALIDATION");
      expect((await rowOf(sale.id))?.status).toBe("approved");
    });

    it("answers CONFLICT for a listing that is not Live (pending, or already closed)", async () => {
      const pending = await newListing("pending");
      const closed = await newListing("sold");
      expect((await failureOf(() => store().close(pending.id, "sold"))).code).toBe("CONFLICT");
      expect((await failureOf(() => store().close(closed.id, "sold"))).code).toBe("CONFLICT");
      expect((await rowOf(pending.id))?.status).toBe("pending");
    });

    it("looks the same for someone else's listing as for one that does not exist", async () => {
      const theirs = await newListing("approved", "sale", stranger.userId);
      expect((await failureOf(() => store().close(theirs.id, "sold"))).code).toBe("NOT_FOUND");
      expect((await failureOf(() => store().close(randomUUID(), "sold"))).code).toBe("NOT_FOUND");
      expect((await rowOf(theirs.id))?.status).toBe("approved");
    });

    it("leaves the status to the function: an owner cannot set it directly", async () => {
      const listing = await newListing("approved");
      const attempt = await owner.client
        .from("properties")
        .update({ status: "sold" })
        .eq("id", listing.id);
      expect(attempt.error).not.toBeNull();
      expect((await rowOf(listing.id))?.status).toBe("approved");
    });

    it("cannot be undone by the owner: a closed listing refuses any later change", async () => {
      const listing = await newListing("approved");
      await closeOwnListing(store(), { listingId: listing.id, outcome: "sold" });
      const attempt = await owner.client
        .from("properties")
        .update({ title: "A changed title for a sold home" })
        .eq("id", listing.id);
      expect(attempt.error).not.toBeNull();
    });
  });

  describe("deleting a listing", () => {
    it("deletes a Live listing with its enquiries and returns the short id for the cache tags", async () => {
      const listing = await newListing("approved");
      const enquiry = await newEnquiry(listing.id);
      const done = await deleteOwnListing(store(), { listingId: listing.id });
      expect(done).toEqual({ listingId: listing.id, shortId: listing.shortId });
      expect(await rowOf(listing.id)).toBeNull();
      const { data } = await admin.from("enquiries").select("id").eq("id", enquiry);
      expect(data).toEqual([]);
    });

    it("deletes a sold listing too", async () => {
      const listing = await newListing("sold");
      expect((await deleteOwnListing(store(), { listingId: listing.id })).shortId).toBe(
        listing.shortId,
      );
    });

    it("finds nothing to delete for someone else's listing, and leaves it", async () => {
      const theirs = await newListing("approved", "sale", stranger.userId);
      const error = await failureOf(() => deleteOwnListing(store(), { listingId: theirs.id }));
      expect(error.code).toBe("NOT_FOUND");
      expect(await rowOf(theirs.id)).not.toBeNull();
    });
  });

  describe("enquiries received", () => {
    it("lets the owner of the listing move an enquiry forward, step by step", async () => {
      const listing = await newListing("approved");
      const enquiry = await newEnquiry(listing.id);
      const status = () => admin.from("enquiries").select("status").eq("id", enquiry).single();
      const ownerStore = enquiryStatusStore(owner.client);
      expect(await moveEnquiry(ownerStore, { enquiryId: enquiry, status: "contacted" })).toEqual({
        enquiryId: enquiry,
        status: "contacted",
      });
      expect((await status()).data?.status).toBe("contacted");
      await moveEnquiry(ownerStore, { enquiryId: enquiry, status: "closed" });
      expect((await status()).data?.status).toBe("closed");
    });

    it("refuses to move a closed enquiry back (CONFLICT)", async () => {
      const listing = await newListing("approved");
      const enquiry = await newEnquiry(listing.id);
      const ownerStore = enquiryStatusStore(owner.client);
      await moveEnquiry(ownerStore, { enquiryId: enquiry, status: "closed" });
      const error = await failureOf(() =>
        moveEnquiry(ownerStore, { enquiryId: enquiry, status: "contacted" }),
      );
      expect(error.code).toBe("CONFLICT");
    });

    it("finds nothing for someone who does not own the listing, even the sender", async () => {
      const listing = await newListing("approved");
      const enquiry = await newEnquiry(listing.id);
      const error = await failureOf(() =>
        moveEnquiry(enquiryStatusStore(stranger.client), {
          enquiryId: enquiry,
          status: "contacted",
        }),
      );
      expect(error.code).toBe("NOT_FOUND");
      expect(
        (await admin.from("enquiries").select("status").eq("id", enquiry).single()).data?.status,
      ).toBe("new");
    });

    it("shows the owner the enquiries on their listings and not those on other people's, in the shape the list reads", async () => {
      const mine = await newListing("approved");
      const theirs = await newListing("approved", "sale", stranger.userId);
      const mineEnquiry = await newEnquiry(mine.id, "Divya Krishnan");
      const theirsEnquiry = await newEnquiry(theirs.id, "Karthik S");
      const { data, error } = await owner.client
        .from("enquiries")
        .select(
          "id, created_at, status, name, phone, email, message, properties(short_id, slug, title, status)",
        )
        .in("property_id", [mine.id, theirs.id]);
      expect(error).toBeNull();
      expect(data?.map((row) => row.id)).toEqual([mineEnquiry]);
      expect(data?.map((row) => row.id)).not.toContain(theirsEnquiry);
      expect(data?.[0]).toMatchObject({
        name: "Divya Krishnan",
        properties: { short_id: mine.shortId, status: "approved" },
      });
    });
  });

  describe("my listings", () => {
    it("reads the owner's own rows, outside the drafts, in the shape the list maps", async () => {
      const live = await newListing("approved");
      await admin.from("properties").insert({
        owner_id: owner.userId,
        short_id: madeUpShortId(),
        slug: `it-my-listings-draft-${randomUUID()}`,
        status: "draft",
        title: `A draft ${RUN}`,
      });
      const theirs = await newListing("approved", "sale", stranger.userId);
      const { data, error } = await owner.client
        .rpc("my_properties")
        .select(MY_LISTING_COLUMNS)
        .neq("status", "draft");
      expect(error).toBeNull();
      const listings = toMyListings(data ?? [], [], (path) => path);
      const ids = listings.map((listing) => listing.id);
      expect(ids).toContain(live.id);
      expect(ids).not.toContain(theirs.id);
      expect(listings.every((listing) => listing.status !== ("draft" as string))).toBe(true);
    });
  });

  describe("the numbers on the dashboard tabs", () => {
    it("counts the owner's listings outside the drafts in the database, the same rows the list reads", async () => {
      await newListing("approved");
      await newListing("pending");
      await newListing("approved", "sale", stranger.userId);
      const rows = await owner.client.rpc("my_properties").select("id").neq("status", "draft");
      const counted = await owner.client
        .rpc("my_properties", undefined, { count: "exact", head: true })
        .neq("status", "draft");
      expect(rows.error).toBeNull();
      expect(counted.error).toBeNull();
      expect(counted.count).toBe(rows.data?.length);
      expect(counted.count).toBeGreaterThanOrEqual(2);
    });

    it("counts the enquiries received and the New ones among them, over the owner's own listings only", async () => {
      const mine = await newListing("approved");
      const theirs = await newListing("approved", "sale", stranger.userId);
      const first = await newEnquiry(mine.id, "Divya Krishnan");
      await newEnquiry(mine.id, "Arjun Menon");
      await newEnquiry(theirs.id, "Karthik S");
      const ids = [mine.id, theirs.id];
      const total = () =>
        owner.client
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .in("property_id", ids);
      const fresh = () =>
        owner.client
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .in("property_id", ids)
          .eq("status", "new");
      expect((await total()).count).toBe(2);
      expect((await fresh()).count).toBe(2);
      await moveEnquiry(enquiryStatusStore(owner.client), {
        enquiryId: first,
        status: "contacted",
      });
      expect((await total()).count).toBe(2);
      expect((await fresh()).count).toBe(1);
    });

    it("counts the enquiries a visitor sent, by their own id", async () => {
      const listing = await newListing("approved", "sale", stranger.userId);
      const sent = await admin
        .from("enquiries")
        .insert({
          property_id: listing.id,
          user_id: owner.userId,
          name: "Priya Raman",
          phone: "9841055512",
        })
        .select("id")
        .single();
      expect(sent.error).toBeNull();
      const counted = await owner.client
        .from("enquiries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owner.userId);
      expect(counted.error).toBeNull();
      expect(counted.count).toBeGreaterThanOrEqual(1);
    });

    it("counts the saved homes through the same inner join as the list", async () => {
      const listing = await newListing("approved", "sale", stranger.userId);
      const saved = await owner.client.from("saved_properties").insert({ property_id: listing.id });
      expect(saved.error).toBeNull();
      const rows = await owner.client
        .from("saved_properties")
        .select("created_at, properties!inner(short_id)");
      const counted = await owner.client
        .from("saved_properties")
        .select("properties!inner(short_id)", { count: "exact", head: true });
      expect(rows.error).toBeNull();
      expect(counted.error).toBeNull();
      expect(counted.count).toBe(rows.data?.length);
      expect(counted.count).toBeGreaterThanOrEqual(1);
    });
  });
});
