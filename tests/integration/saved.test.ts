import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

const session: { current: TestUser | null } = { current: null };
vi.mock("@/server/supabase/server", () => ({
  // The real one reads the browser's cookies; here the signed-in test client plays the visitor.
  createServerSupabase: async () => session.current?.client,
}));

const { saveHome, unsaveHome } = await import("@/features/saved/service");
const { savedStore } = await import("@/features/saved/store");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

/**
 * S8-T04 (ADR-125, R-BE-04): saving a home works only for a home the visitor may see. A home that is
 * waiting for review, or that does not exist, is "not found" and leaves no row, so nobody can learn
 * about a home that is not listed. The rule is the service's; the visibility is the database's.
 */
describe("IT-saved: saving a home against a real database (S8-T04, R-BE-04)", () => {
  let visitor: TestUser;
  let ownerId: string;
  let approvedId: string;
  let approvedShortId: string;
  let pendingId: string;
  let pendingShortId: string;

  async function addHome(status: "approved" | "pending", shortId: string): Promise<string> {
    const admin = adminClient();
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: ownerId,
        short_id: shortId,
        slug: `it-saved-${status}-${RUN}`,
        status: "pending",
        listing_type: "sale",
        property_type: "apartment",
        title: `IT saved ${status} ${RUN}`,
        description: "A made-up home for the saved-homes tests.",
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

  const savedRows = async (propertyId: string): Promise<number> => {
    const { count, error } = await adminClient()
      .from("saved_properties")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not count the saved rows");
    return count ?? 0;
  };

  beforeAll(async () => {
    visitor = await signInTestCustomer();
    session.current = visitor;
    const owner = await adminClient().auth.admin.createUser({
      email: `it-saved-owner-${RUN}@example.test`,
      email_confirm: true,
    });
    if (owner.error || !owner.data.user) throw new Error("Could not create the owner");
    ownerId = owner.data.user.id;
    approvedShortId = madeUpShortId();
    pendingShortId = madeUpShortId();
    approvedId = await addHome("approved", approvedShortId);
    pendingId = await addHome("pending", pendingShortId);
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("saved_properties").delete().in("property_id", [approvedId, pendingId]);
    await admin.from("properties").delete().in("id", [approvedId, pendingId]);
    await admin.auth.admin.deleteUser(ownerId);
    await removeTestUser();
  });

  it("saves a listed home for the signed-in visitor, and saving it again leaves one row", async () => {
    await expect(saveHome(await savedStore(), approvedShortId)).resolves.toEqual({ saved: true });
    await expect(saveHome(await savedStore(), approvedShortId)).resolves.toEqual({ saved: true });
    expect(await savedRows(approvedId)).toBe(1);
  });

  it("says not found for a home waiting for review, and for one that does not exist, and saves nothing", async () => {
    await expect(saveHome(await savedStore(), pendingShortId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(saveHome(await savedStore(), madeUpShortId())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await savedRows(pendingId)).toBe(0);
  });

  it("answers an unsave of a home that is not listed as done, and changes nothing", async () => {
    await expect(unsaveHome(await savedStore(), pendingShortId)).resolves.toEqual({
      saved: false,
    });
    expect(await savedRows(approvedId)).toBe(1);
  });

  it("removes the visitor's saved row on an unsave, and a second unsave changes nothing", async () => {
    await expect(unsaveHome(await savedStore(), approvedShortId)).resolves.toEqual({
      saved: false,
    });
    await expect(unsaveHome(await savedStore(), approvedShortId)).resolves.toEqual({
      saved: false,
    });
    expect(await savedRows(approvedId)).toBe(0);
  });
});
