import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { listingCallerStore } = await import("@/features/listings/service");
const { discardDraft, keepDraft, sendForReview, startDraft } =
  await import("@/features/listings/listing-service");
const { DRAFT_COLUMNS, toDraftView } = await import("@/features/listings/view");
const { ActionError } = await import("@/server/actions/normalise-error");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

const stepOne = {
  listingType: "sale",
  propertyType: "apartment",
  address: "12, Second Cross Street, Velachery",
  locality: "Velachery",
  city: "Chennai",
  pincode: "600042",
} as const;

const restOfListing = {
  bhk: 3,
  bathrooms: 2,
  areaSqft: 1420,
  price: 12500000,
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  title: `3 BHK apartment ${RUN}`,
  description: "A bright apartment.",
} as const;

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-actions-listing: the wizard's server side against a real database (S6-T02, ADR-060)", () => {
  let owner: TestUser;
  let otherOwnerId: string;
  let otherListingId: string;
  const admin = adminClient();

  const store = () => listingCallerStore(owner.client);
  const row = async (listingId: string) => {
    const { data, error } = await admin.from("properties").select("*").eq("id", listingId).single();
    if (error) throw new Error(`Could not read the listing (${error.code})`);
    return data;
  };
  const clearOwnerListings = async () => {
    const { error } = await admin.from("properties").delete().eq("owner_id", owner.userId);
    if (error) throw new Error("Could not clear the listings");
  };
  const addPhoto = async (listingId: string) => {
    const { error } = await admin.from("listing_media").insert({
      listing_id: listingId,
      storage_path: `${owner.userId}/${listingId}/${randomUUID()}.jpg`,
      mime: "image/jpeg",
      bytes: 200000,
      width: 1600,
      height: 1200,
    });
    if (error) throw new Error(`Could not add a photo (${error.code})`);
  };

  beforeAll(async () => {
    owner = await signInTestCustomer();
    const other = await admin.auth.admin.createUser({
      email: `it-listings-other-${RUN}@example.test`,
      email_confirm: true,
    });
    if (other.error || !other.data.user) throw new Error("Could not create the other owner");
    otherOwnerId = other.data.user.id;
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: otherOwnerId,
        short_id: madeUpShortId(),
        slug: `it-listings-theirs-${RUN}`,
        status: "draft",
        title: `Somebody else's draft ${RUN}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the other listing (${error.code})`);
    otherListingId = data.id;
  });

  afterAll(async () => {
    await admin.from("properties").delete().eq("id", otherListingId);
    await admin.auth.admin.deleteUser(otherOwnerId);
    await removeTestUser();
  });

  it("starts a draft owned by the signed-in account, in Tamil Nadu, with the fields it was given", async () => {
    await clearOwnerListings();
    const { listingId, shortId } = await startDraft(store(), { fields: stepOne });
    const saved = await row(listingId);
    expect(saved).toMatchObject({
      owner_id: owner.userId,
      status: "draft",
      short_id: shortId,
      listing_type: "sale",
      property_type: "apartment",
      locality: "Velachery",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600042",
    });
    expect(saved.slug).toMatch(/^[a-z0-9-]+$/);
    expect(saved.location).toBeNull();
  });

  it("saves later steps, clears a field sent as null, and clears bedrooms when the type is land", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: stepOne });
    await keepDraft(store(), { listingId, fields: restOfListing });
    expect(await row(listingId)).toMatchObject({
      bhk: 3,
      bathrooms: 2,
      area_sqft: 1420,
      price: 12500000,
      furnishing: "semi",
      amenities: ["Gym", "Lift"],
      description: "A bright apartment.",
    });
    await keepDraft(store(), { listingId, fields: { description: null } });
    expect((await row(listingId)).description).toBeNull();
    await keepDraft(store(), { listingId, fields: { propertyType: "plot" } });
    expect(await row(listingId)).toMatchObject({ property_type: "plot", bhk: null });
  });

  it("reads a saved draft back with the columns the wizard asks for", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: stepOne });
    await keepDraft(store(), { listingId, fields: restOfListing });
    await addPhoto(listingId);
    const { data, error } = await owner.client
      .rpc("my_properties")
      .select(DRAFT_COLUMNS)
      .eq("id", listingId)
      .maybeSingle();
    expect(error).toBeNull();
    const photos = await owner.client.from("listing_media").select("id, storage_path, position");
    const view = toDraftView(data, photos.data ?? []);
    expect(view).toMatchObject({
      id: listingId,
      status: "draft",
      listingType: "sale",
      areaSqft: 1420,
      price: 12500000,
      amenities: ["Gym", "Lift"],
    });
    expect(view?.photos).toHaveLength(1);
  });

  it("does not let an owner change someone else's draft, or a listing that is no longer a draft", async () => {
    await clearOwnerListings();
    const theirs = await failureOf(() =>
      keepDraft(store(), { listingId: otherListingId, fields: { title: "Taken over now" } }),
    );
    expect(theirs.code).toBe("NOT_FOUND");
    expect((await row(otherListingId)).title).toBe(`Somebody else's draft ${RUN}`);

    const { listingId } = await startDraft(store(), { fields: { ...stepOne, ...restOfListing } });
    await addPhoto(listingId);
    await sendForReview(store(), { listingId });
    const pending = await failureOf(() =>
      keepDraft(store(), { listingId, fields: { title: "Changed after submitting" } }),
    );
    expect(pending.code).toBe("NOT_FOUND");
    expect((await row(listingId)).title).toBe(restOfListing.title);
  });

  it("holds a person to five open listings, and gives room back when one is deleted", async () => {
    await clearOwnerListings();
    const ids: string[] = [];
    for (let count = 1; count <= 5; count += 1) {
      ids.push((await startDraft(store(), { fields: { locality: `Draft ${count}` } })).listingId);
    }
    const sixth = await failureOf(() => startDraft(store(), { fields: { locality: "Draft 6" } }));
    expect(sixth.code).toBe("VALIDATION");
    expect(sixth.fieldErrors?.listing).toEqual([
      { key: "validation.openListingLimit", values: { maximum: 5 } },
    ]);
    const [first] = ids;
    if (!first) throw new Error("no draft was made");
    await discardDraft(store(), { listingId: first });
    await expect(startDraft(store(), { fields: { locality: "Draft 7" } })).resolves.toBeDefined();
  });

  it("deletes a draft of the caller's, and nothing else", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: stepOne });
    await discardDraft(store(), { listingId });
    const { data } = await admin.from("properties").select("id").eq("id", listingId);
    expect(data).toEqual([]);
    expect((await failureOf(() => discardDraft(store(), { listingId }))).code).toBe("NOT_FOUND");
    expect((await failureOf(() => discardDraft(store(), { listingId: otherListingId }))).code).toBe(
      "NOT_FOUND",
    );
    expect((await row(otherListingId)).id).toBe(otherListingId);
  });

  it("refuses to submit an incomplete draft, naming what is missing", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: stepOne });
    await addPhoto(listingId);
    const refused = await failureOf(() => sendForReview(store(), { listingId }));
    expect(refused.code).toBe("VALIDATION");
    expect(Object.keys(refused.fieldErrors ?? {}).sort()).toEqual(["areaSqft", "price", "title"]);
    expect((await row(listingId)).status).toBe("draft");
  });

  it("refuses to submit a complete draft with no photo", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: { ...stepOne, ...restOfListing } });
    const refused = await failureOf(() => sendForReview(store(), { listingId }));
    expect(refused.fieldErrors?.photos).toEqual([{ key: "validation.photoRequired" }]);
  });

  it("submits a complete draft with a photo and no location: it becomes pending (DEC-19 fallback)", async () => {
    await clearOwnerListings();
    const { listingId, shortId } = await startDraft(store(), {
      fields: { ...stepOne, ...restOfListing, description: null },
    });
    await addPhoto(listingId);
    expect(await sendForReview(store(), { listingId })).toEqual({ listingId, shortId });
    const saved = await row(listingId);
    expect(saved).toMatchObject({ status: "pending", location: null, description: null });
    expect(saved.submitted_at).not.toBeNull();
    const { data: trail } = await admin
      .from("audit_log")
      .select("diff")
      .eq("entity_type", "property")
      .eq("entity_id", listingId)
      .eq("action", "listing.status_changed");
    expect(trail?.some((entry) => (entry.diff as { to?: string }).to === "pending")).toBe(true);
  });

  it("does not submit twice, or someone else's draft", async () => {
    await clearOwnerListings();
    const { listingId } = await startDraft(store(), { fields: { ...stepOne, ...restOfListing } });
    await addPhoto(listingId);
    await sendForReview(store(), { listingId });
    expect((await failureOf(() => sendForReview(store(), { listingId }))).code).toBe("CONFLICT");
    expect(
      (await failureOf(() => sendForReview(store(), { listingId: otherListingId }))).code,
    ).toBe("NOT_FOUND");
    expect((await row(otherListingId)).status).toBe("draft");
  });
});
