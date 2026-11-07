import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { moderationStore } = await import("@/features/moderation/service");
const { decideListing } = await import("@/features/moderation/moderation-service");
const { toCounts, toLocalities, toQueueItems } = await import("@/features/moderation/view");
const { ActionError } = await import("@/server/actions/normalise-error");
const { loadSessionView } = await import("@/server/auth/get-session-view");
const { assertAdmin } = await import("@/server/auth/guards");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");
const PLACE = `Moderation Town ${RUN}`;

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-actions-listing and IT-AUTHZ-admin: the admin's queue and decisions against a real database (S6-T04, ADR-064)", () => {
  const admin = adminClient();
  let owner: TestUser;
  let staff: TestUser;
  const made: string[] = [];

  const store = (user: TestUser) => moderationStore(user.client);

  const newListing = async (status: "pending" | "approved" | "draft", withPhoto = false) => {
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: owner.userId,
        short_id: madeUpShortId(),
        slug: `it-moderation-${randomUUID()}`,
        status,
        listing_type: "sale",
        property_type: "apartment",
        title: `Home for review ${RUN}`,
        description: "A bright flat.",
        price: 8500000,
        area_sqft: 950,
        locality: PLACE,
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: "12 Beach Road",
      })
      .select("id, short_id")
      .single();
    if (error) throw new Error(`Could not create a listing (${error.code})`);
    made.push(data.id);
    if (withPhoto) {
      const photo = await admin.from("listing_media").insert({
        listing_id: data.id,
        storage_path: `${owner.userId}/${data.id}/${randomUUID()}.jpg`,
        mime: "image/jpeg",
        bytes: 200000,
        width: 1600,
        height: 1200,
      });
      if (photo.error) throw new Error(`Could not add a photo (${photo.error.code})`);
    }
    return { id: data.id, shortId: data.short_id };
  };

  const row = async (listingId: string) => {
    const { data, error } = await admin.from("properties").select("*").eq("id", listingId).single();
    if (error) throw new Error(`Could not read the listing (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    owner = await signInTestCustomer();
    await admin
      .from("profiles")
      .update({ full_name: `Owner ${RUN}` })
      .eq("id", owner.userId);
    staff = await signInTestAdmin();
  });

  afterAll(async () => {
    if (made.length > 0) await admin.from("properties").delete().in("id", made);
    await removeTestUser();
    await removeTestAdmin();
  });

  describe("decisions as the signed-in administrator", () => {
    it("approves a pending listing and answers what the page needs to refresh its cache tags", async () => {
      const listing = await newListing("pending");
      const done = await decideListing(store(staff), {
        decision: "approve",
        listingId: listing.id,
      });
      expect(done).toEqual({
        listingId: listing.id,
        shortId: listing.shortId,
        status: "approved",
        featured: false,
      });
      expect(await row(listing.id)).toMatchObject({
        status: "approved",
        rejection_reason: null,
        moderated_by: staff.userId,
      });
    });

    it("rejects a pending listing with its reason, and keeps the reason in the audit log with the admin as actor", async () => {
      const listing = await newListing("pending");
      const done = await decideListing(store(staff), {
        decision: "reject",
        listingId: listing.id,
        reason: "Add a photo of the home.",
      });
      expect(done.status).toBe("rejected");
      expect(await row(listing.id)).toMatchObject({
        status: "rejected",
        rejection_reason: "Add a photo of the home.",
        moderated_by: staff.userId,
      });
      const { data, error } = await admin
        .from("audit_log")
        .select("actor_id, actor_role, diff")
        .eq("entity_id", listing.id)
        .eq("action", "listing.status_changed");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]).toMatchObject({
        actor_id: staff.userId,
        actor_role: "super_admin",
        diff: { from: "pending", to: "rejected", reason: "Add a photo of the home." },
      });
    });

    it("features an approved listing and takes the feature away again", async () => {
      const listing = await newListing("approved");
      const featured = await decideListing(store(staff), {
        decision: "feature",
        listingId: listing.id,
      });
      expect(featured).toMatchObject({ status: "approved", featured: true });
      expect((await row(listing.id)).featured).toBe(true);
      const plain = await decideListing(store(staff), {
        decision: "unfeature",
        listingId: listing.id,
      });
      expect(plain).toMatchObject({ status: "approved", featured: false });
      expect((await row(listing.id)).featured).toBe(false);
    });

    it("answers CONFLICT when the listing is not in the state the decision needs", async () => {
      const decided = await newListing("pending");
      await decideListing(store(staff), { decision: "approve", listingId: decided.id });
      // A second admin, or an out-of-date page, approving or rejecting what is already decided.
      for (const input of [
        { decision: "approve", listingId: decided.id },
        { decision: "reject", listingId: decided.id, reason: "Too late." },
        { decision: "feature", listingId: (await newListing("pending")).id },
        { decision: "unfeature", listingId: decided.id },
      ] as const) {
        const error = await failureOf(() => decideListing(store(staff), input));
        expect(error.code).toBe("CONFLICT");
      }
      const alreadyFeatured = await newListing("approved");
      await decideListing(store(staff), { decision: "feature", listingId: alreadyFeatured.id });
      const again = await failureOf(() =>
        decideListing(store(staff), { decision: "feature", listingId: alreadyFeatured.id }),
      );
      expect(again.code).toBe("CONFLICT");
    });

    it("never decides a draft", async () => {
      const draft = await newListing("draft");
      const error = await failureOf(() =>
        decideListing(store(staff), { decision: "approve", listingId: draft.id }),
      );
      expect(error.code).toBe("CONFLICT");
      expect((await row(draft.id)).status).toBe("draft");
    });

    it("answers NOT_FOUND for a listing that does not exist", async () => {
      const error = await failureOf(() =>
        decideListing(store(staff), { decision: "approve", listingId: randomUUID() }),
      );
      expect(error.code).toBe("NOT_FOUND");
    });

    it("answers VALIDATION on the reason field when the database gets a rejection with no usable reason", async () => {
      // The schema stops this before it gets here; the database holds the rule for any other caller.
      const listing = await newListing("pending");
      for (const reason of [null, "   ", "a".repeat(501)]) {
        const error = await failureOf(() => store(staff).decide(listing.id, "reject", reason));
        expect(error.code).toBe("VALIDATION");
        expect(error.fieldErrors).toHaveProperty("reason");
      }
      expect((await row(listing.id)).status).toBe("pending");
    });
  });

  describe("IT-AUTHZ-admin: nobody else may decide or read the queue", () => {
    const decisionsRefused = async (user: TestUser) => {
      const listing = await newListing("pending");
      for (const decision of ["approve", "reject", "feature", "unfeature"] as const) {
        const error = await failureOf(() => store(user).decide(listing.id, decision, "No."));
        expect(error.code).toBe("FORBIDDEN");
      }
      expect((await row(listing.id)).status).toBe("pending");
      for (const [name, args] of [
        ["admin_listing_queue", {}],
        ["admin_listing_counts", {}],
        ["admin_listing_localities", {}],
      ] as const) {
        const answer = await user.client.rpc(name, args);
        expect(answer.error, name).not.toBeNull();
        expect(answer.data, name).toBeNull();
      }
    };

    it("refuses a visitor with no session", async () => {
      const visitor: TestUser = { userId: "", client: visitorClient() };
      await decisionsRefused(visitor);
    });

    it("refuses a customer, even with a verified phone", async () => {
      await decisionsRefused(owner);
    });

    it("refuses a builder", async () => {
      await grantRole(owner.userId, "builder");
      await createBuilderRecord(owner.userId, { active: true });
      try {
        await decisionsRefused(owner);
      } finally {
        await admin.from("builders").delete().eq("user_id", owner.userId);
        await admin.from("user_roles").delete().eq("user_id", owner.userId).eq("role", "builder");
      }
    });

    it("sees the administrator as one, and nobody else, in the session the action guard reads", async () => {
      const seen = await loadSessionView(staff.client as Parameters<typeof loadSessionView>[0]);
      expect(seen?.roles).toContain("super_admin");
      expect(() => assertAdmin(seen)).not.toThrow();
      const customer = await loadSessionView(owner.client as Parameters<typeof loadSessionView>[0]);
      expect(customer?.roles).not.toContain("super_admin");
      expect(() => assertAdmin(customer)).toThrow(ActionError);
    });
  });

  describe("the queue's reads, as the signed-in administrator", () => {
    it("gives the rows the view models expect: the owner, the photos and the cursor order", async () => {
      const older = await newListing("pending", true);
      const newer = await newListing("pending");
      await admin
        .from("properties")
        .update({ submitted_at: new Date(Date.now() - 3_600_000).toISOString() })
        .eq("id", older.id);
      const { data, error } = await staff.client.rpc("admin_listing_queue", {
        p_tab: "pending",
        p_locality: PLACE,
      });
      expect(error).toBeNull();
      const { items, skipped } = toQueueItems(data, "http://127.0.0.1:54321");
      expect(skipped).toBe(0);
      const mine = items.filter((item) => [older.id, newer.id].includes(item.id));
      expect(mine.map((item) => item.id)).toEqual([newer.id, older.id]);
      expect(mine[1]).toMatchObject({
        status: "pending",
        ownerName: `Owner ${RUN}`,
        locality: PLACE,
        price: 8500000,
        listingType: "sale",
      });
      expect(mine[1]?.ownerEmail === null || typeof mine[1]?.ownerEmail === "string").toBe(true);
      expect(mine[1]?.photos).toHaveLength(1);
      expect(mine[1]?.photos[0]?.url).toContain("/storage/v1/object/public/listing-photos/");
    });

    it("pages by the last row seen, so a decision made meanwhile skips no row", async () => {
      const first = await staff.client.rpc("admin_listing_queue", {
        p_tab: "all",
        p_locality: PLACE,
        p_limit: 2,
      });
      expect(first.error).toBeNull();
      const [one, two] = toQueueItems(first.data, "http://127.0.0.1:54321").items;
      if (!one || !two) throw new Error("expected at least two listings in the queue");
      const second = await staff.client.rpc("admin_listing_queue", {
        p_tab: "all",
        p_locality: PLACE,
        p_limit: 100,
        p_after_at: two.submittedAt,
        p_after_id: two.id,
      });
      const rest = toQueueItems(second.data, "http://127.0.0.1:54321").items.map((item) => item.id);
      expect(rest).not.toContain(one.id);
      expect(rest).not.toContain(two.id);
    });

    it("counts every listing that is not a draft, and lists the localities of those", async () => {
      await newListing("draft");
      const counts = toCounts((await staff.client.rpc("admin_listing_counts")).data);
      const stored = await admin
        .from("properties")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft");
      expect(stored.error).toBeNull();
      expect(counts.total).toBe(stored.count);
      expect(counts.pending + counts.approved + counts.rejected + counts.closed).toBe(counts.total);
      const localities = toLocalities((await staff.client.rpc("admin_listing_localities")).data);
      expect(localities).toContain(PLACE);
    });
  });
});
