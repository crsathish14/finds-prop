import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadSessionView } from "@/server/auth/get-session-view";
import { adminClient, visitorClient, type TestClient } from "./support/clients";
import { grantRole, removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { myListingsStore } = await import("@/features/listings/my-listings-store");
const { closeOwnListing, saveOwnChanges } = await import("@/features/listings/my-listings-service");
const { listingCallerStore } = await import("@/features/listings/service");
const { startDraft } = await import("@/features/listings/listing-service");
const { assertAdmin, assertBuilder, assertVerifiedPhone } = await import("@/server/auth/guards");
const { ActionError } = await import("@/server/actions/normalise-error");

// IT-AUTHZ-agent (S6-T06, DEC-08): the `agent` role exists and grants nothing. A signed-in account that holds it
// is exactly a customer, against the real database: it cannot moderate, cannot see or change other people's
// listings and enquiries, and can still do everything a customer can.

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

describe("IT-AUTHZ-agent: an agent is a customer against a real database (S6-T06, DEC-08)", () => {
  const admin = adminClient();
  let agent: TestUser;
  let other: { userId: string };
  const madeListings: string[] = [];
  const madeUsers: string[] = [];

  const newListing = async (ownerId: string, status: "pending" | "approved") => {
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: madeUpShortId(),
        slug: `it-agent-${randomUUID()}`,
        status,
        listing_type: "sale",
        property_type: "apartment",
        title: `Home for the agent tests ${RUN}`,
        description: "A bright flat.",
        price: 8500000,
        area_sqft: 950,
        locality: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600020",
        address: "12 Beach Road",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create a listing (${error.code})`);
    madeListings.push(data.id);
    return data.id;
  };

  beforeAll(async () => {
    agent = await signInTestCustomer();
    await grantRole(agent.userId, "agent");
    const created = await admin.auth.admin.createUser({
      email: `it-agent-other-${RUN}@example.test`,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error("Could not create the other owner");
    other = { userId: created.data.user.id };
    madeUsers.push(other.userId);
  });

  afterAll(async () => {
    if (madeListings.length > 0) await admin.from("properties").delete().in("id", madeListings);
    for (const id of madeUsers) await admin.auth.admin.deleteUser(id);
    await removeTestUser();
  });

  it("is read from the account's own rows as the agent and customer roles, with no builder record", async () => {
    const session = await loadSessionView(agent.client as Parameters<typeof loadSessionView>[0]);
    expect(session).toEqual({
      userId: agent.userId,
      roles: ["agent", "customer"],
      phoneVerified: true,
      builderId: null,
    });
    expect(() => assertVerifiedPhone(session)).not.toThrow();
    expect(() => assertAdmin(session)).toThrow(ActionError);
    expect(() => assertBuilder(session)).toThrow(ActionError);
  });

  it("cannot moderate: not another owner's listing and not their own", async () => {
    const theirs = await newListing(other.userId, "pending");
    const mine = await newListing(agent.userId, "pending");
    for (const id of [theirs, mine]) {
      const refused = await agent.client.rpc("moderate_listing", {
        p_listing: id,
        p_action: "approve",
      });
      expect(refused.error?.code).toBe("42501");
    }
    const queue = await agent.client.rpc("admin_listing_queue");
    expect(queue.error?.code).toBe("42501");
    const { data } = await admin.from("properties").select("status").in("id", [theirs, mine]);
    expect(data?.map((row) => row.status)).toEqual(["pending", "pending"]);
  });

  it("cannot read the administrator's view of every listing, or other people's pending listings and enquiries", async () => {
    const theirsPending = await newListing(other.userId, "pending");
    const theirsLive = await newListing(other.userId, "approved");
    await admin
      .from("enquiries")
      .insert({ property_id: theirsLive, name: "Arjun Menon", phone: "9841055512" });
    const everything = await agent.client.rpc("admin_properties");
    expect(everything.data ?? []).toEqual([]);
    const visible = await agent.client
      .from("properties")
      .select("id")
      .in("id", [theirsPending, theirsLive]);
    expect(visible.data?.map((row) => row.id)).toEqual([theirsLive]);
    const enquiries = await agent.client
      .from("enquiries")
      .select("id")
      .eq("property_id", theirsLive);
    expect(enquiries.data).toEqual([]);
  });

  it("cannot change, close or delete another owner's listing", async () => {
    const theirs = await newListing(other.userId, "approved");
    const store = myListingsStore(agent.client);
    expect(
      (await failureOf(() => closeOwnListing(store, { listingId: theirs, outcome: "sold" }))).code,
    ).toBe("NOT_FOUND");
    expect(
      (
        await failureOf(() =>
          saveOwnChanges(store, { listingId: theirs, fields: { price: 1000000 } }),
        )
      ).code,
    ).toBe("NOT_FOUND");
    const removed = await agent.client.from("properties").delete().eq("id", theirs).select("id");
    expect(removed.data ?? []).toEqual([]);
    const { data } = await admin.from("properties").select("status, price").eq("id", theirs);
    expect(data).toEqual([{ status: "approved", price: 8500000 }]);
  });

  it("cannot give themselves, or anyone, another role", async () => {
    const attempt = await agent.client
      .from("user_roles")
      .insert({ user_id: agent.userId, role: "builder" });
    expect(attempt.error).not.toBeNull();
    const { data } = await admin.from("user_roles").select("role").eq("user_id", agent.userId);
    expect(data?.map((row) => row.role).sort()).toEqual(["agent", "customer"]);
  });

  it("can do what a customer does: start a draft, close and edit their own listing", async () => {
    const draft = await startDraft(listingCallerStore(agent.client), {
      fields: { listingType: "sale", propertyType: "apartment" },
    });
    madeListings.push(draft.listingId);
    expect(draft.shortId).toMatch(/^[a-z0-9]{8}$/);
    const live = await newListing(agent.userId, "approved");
    const store = myListingsStore(agent.client);
    expect(
      await saveOwnChanges(store, { listingId: live, fields: { price: 9000000 } }),
    ).toMatchObject({ status: "approved", wentBackToReview: false });
    expect(await closeOwnListing(store, { listingId: live, outcome: "sold" })).toMatchObject({
      status: "sold",
    });
  });

  it("is refused by the database as a visitor is, when not signed in", async () => {
    const visitor: TestClient = visitorClient();
    const refused = await visitor.rpc("moderate_listing", {
      p_listing: randomUUID(),
      p_action: "approve",
    });
    expect(refused.error).not.toBeNull();
  });
});
