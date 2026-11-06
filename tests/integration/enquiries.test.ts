import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { createEnquiryWriteStore } = await import("@/features/enquiries/service");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

describe("IT-enquiries: submit_enquiry against a real database (S5-T03, BR-50, DEC-26)", () => {
  let sender: TestUser;
  let ownerId: string;
  let homeId: string;
  let homeShortId: string;
  let pendingShortId: string;
  const pendingIds: string[] = [];
  const store = createEnquiryWriteStore(randomUUID());

  async function addHome(status: "approved" | "pending", shortId: string): Promise<string> {
    const admin = adminClient();
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: shortId,
        slug: `it-enquiry-${status}-${RUN}`,
        status: "pending",
        listing_type: "sale",
        property_type: "apartment",
        title: `IT enquiry ${status} ${RUN}`,
        description: "A made-up home for the enquiry tests.",
        price: 5_000_000,
        area_sqft: 900,
        locality: "Integration Test Locality",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        address: "1 Test Street",
        location: "SRID=4326;POINT(80.27074 13.08274)",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the ${status} home (${error.code})`);
    if (status === "approved") {
      const approved = await admin.from("properties").update({ status }).eq("id", data.id);
      if (approved.error) throw new Error(`Could not approve the home (${approved.error.code})`);
    }
    return data.id;
  }

  beforeAll(async () => {
    sender = await signInTestCustomer();
    const owner = await adminClient().auth.admin.createUser({
      email: `it-enquiry-owner-${RUN}@example.test`,
      email_confirm: true,
    });
    if (owner.error || !owner.data.user) throw new Error("Could not create the owner");
    ownerId = owner.data.user.id;
    homeShortId = madeUpShortId();
    pendingShortId = madeUpShortId();
    homeId = await addHome("approved", homeShortId);
    pendingIds.push(await addHome("pending", pendingShortId));
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("enquiries").delete().eq("property_id", homeId);
    await admin
      .from("properties")
      .delete()
      .in("id", [homeId, ...pendingIds]);
    await admin.auth.admin.deleteUser(ownerId);
    await removeTestUser();
  });

  const row = (overrides: Partial<Parameters<typeof store.insertEnquiry>[0]> = {}) => ({
    shortId: homeShortId,
    userId: sender.userId,
    name: "Priya Raman",
    phone: "919900000001",
    email: "priya@example.test",
    message: "Is a 3 BHK left?",
    ...overrides,
  });

  it("stores an enquiry for the account the server names, as new", async () => {
    const id = await store.insertEnquiry(row());
    const { data, error } = await adminClient()
      .from("enquiries")
      .select("property_id, user_id, name, phone, email, message, status")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      property_id: homeId,
      user_id: sender.userId,
      name: "Priya Raman",
      phone: "919900000001",
      email: "priya@example.test",
      message: "Is a 3 BHK left?",
      status: "new",
    });
  });

  it("refuses a second enquiry about the same home within 24 hours as a conflict, and stores nothing more", async () => {
    await expect(store.insertEnquiry(row({ message: "again" }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const { count } = await adminClient()
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("property_id", homeId)
      .eq("user_id", sender.userId);
    expect(count).toBe(1);
  });

  it("refuses the owner's own home", async () => {
    await expect(store.insertEnquiry(row({ userId: ownerId }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("says not found for a home waiting for review and for one that does not exist", async () => {
    await expect(store.insertEnquiry(row({ shortId: pendingShortId }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(store.insertEnquiry(row({ shortId: "zzzzzzzz" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("cannot be called by a signed-in user with their own session", async () => {
    const { error } = await sender.client.rpc("submit_enquiry", {
      p_short_id: homeShortId,
      p_user_id: sender.userId,
      p_name: "Priya Raman",
      p_phone: "919900000001",
    });
    expect(error).not.toBeNull();
  });
});
