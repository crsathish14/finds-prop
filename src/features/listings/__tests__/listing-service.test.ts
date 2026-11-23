import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  discardDraft,
  keepDraft,
  mapListingError,
  saveOwnContactEmail,
  sendForReview,
  startDraft,
  toDraftRow,
  type DraftRow,
  type ListingCallerStore,
} from "../listing-service";
import { draftFieldsSchema } from "../schemas";

const LISTING = "00000000-0000-4000-9000-000000000001";

function store(overrides: Partial<ListingCallerStore> = {}) {
  const calls: string[] = [];
  const rows: DraftRow[] = [];
  const fake: ListingCallerStore = {
    insertDraft: async (row) => {
      calls.push("insert");
      rows.push(row);
      return { id: LISTING, shortId: "abcd2345" };
    },
    updateDraft: async (id, row) => {
      calls.push(`update:${id}`);
      rows.push(row);
      return true;
    },
    deleteDraft: async (id) => {
      calls.push(`delete:${id}`);
      return true;
    },
    submit: async (id) => {
      calls.push(`submit:${id}`);
      return "abcd2345";
    },
    contactEmail: async () => {
      calls.push("contact");
      return "owner@example.test";
    },
    setContactEmail: async (email) => {
      calls.push(`set-contact:${email}`);
      return email;
    },
    ...overrides,
  };
  return { fake, calls, rows };
}

async function failure(run: () => Promise<unknown>): Promise<ActionError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected a failure");
}

describe("UT-listing-service: the wizard's server rules (S6-T02)", () => {
  describe("toDraftRow", () => {
    it("always sets the state to Tamil Nadu and writes only the fields that were given", () => {
      expect(toDraftRow({})).toEqual({ state: "Tamil Nadu" });
      expect(toDraftRow(draftFieldsSchema.parse({ locality: "Adyar", pincode: "600020" }))).toEqual(
        {
          state: "Tamil Nadu",
          locality: "Adyar",
          pincode: "600020",
        },
      );
    });

    it("turns a field sent as null into a cleared column", () => {
      expect(toDraftRow({ description: null, price: null })).toMatchObject({
        description: null,
        price: null,
      });
    });

    it("clears the bedrooms for land and commercial space, because the database refuses them", () => {
      expect(toDraftRow({ propertyType: "plot", bhk: 3 })).toMatchObject({ bhk: null });
      expect(toDraftRow({ propertyType: "commercial" })).toMatchObject({ bhk: null });
      expect(toDraftRow({ propertyType: "apartment", bhk: 3 })).toMatchObject({ bhk: 3 });
    });

    it("maps every field to its column", () => {
      const row = toDraftRow({
        listingType: "rent",
        propertyType: "villa",
        address: "1 Beach Road",
        locality: "Adyar",
        city: "Chennai",
        pincode: "600020",
        bhk: 4,
        bathrooms: 3,
        areaSqft: 2000,
        price: 90000,
        furnishing: "full",
        amenities: ["Gym"],
        title: "Sea view villa",
        description: "Near the beach.",
      });
      expect(row).toEqual({
        state: "Tamil Nadu",
        listing_type: "rent",
        property_type: "villa",
        address: "1 Beach Road",
        locality: "Adyar",
        city: "Chennai",
        pincode: "600020",
        bhk: 4,
        bathrooms: 3,
        area_sqft: 2000,
        price: 90000,
        furnishing: "full",
        amenities: ["Gym"],
        title: "Sea view villa",
        description: "Near the beach.",
      });
    });
  });

  describe("startDraft, keepDraft, discardDraft, sendForReview", () => {
    it("starts a draft and answers its id and short id", async () => {
      const { fake, calls } = store();
      expect(await startDraft(fake, { fields: { locality: "Adyar" } })).toEqual({
        listingId: LISTING,
        shortId: "abcd2345",
      });
      expect(calls).toEqual(["insert"]);
    });

    it("saves a draft of the caller's, and says not found when there is none", async () => {
      const ok = store();
      expect(await keepDraft(ok.fake, { listingId: LISTING, fields: { title: null } })).toEqual({
        listingId: LISTING,
      });
      const none = store({ updateDraft: async () => false });
      expect(
        (await failure(() => keepDraft(none.fake, { listingId: LISTING, fields: {} }))).code,
      ).toBe("NOT_FOUND");
    });

    it("deletes a draft, and says not found for one that is not the caller's or not a draft", async () => {
      expect(await discardDraft(store().fake, { listingId: LISTING })).toEqual({
        listingId: LISTING,
      });
      const none = store({ deleteDraft: async () => false });
      expect((await failure(() => discardDraft(none.fake, { listingId: LISTING }))).code).toBe(
        "NOT_FOUND",
      );
    });

    it("submits through the database function and answers the short id", async () => {
      const { fake, calls } = store();
      expect(await sendForReview(fake, { listingId: LISTING })).toEqual({
        listingId: LISTING,
        shortId: "abcd2345",
      });
      expect(calls).toEqual(["contact", `submit:${LISTING}`]);
    });

    it("submits with the account's saved email, saving nothing new", async () => {
      const { fake, calls } = store();
      await sendForReview(fake, { listingId: LISTING });
      expect(calls).toEqual(["contact", `submit:${LISTING}`]);
    });

    it("saves the email given with the submit to the account first", async () => {
      const { fake, calls } = store();
      await sendForReview(fake, { listingId: LISTING, contactEmail: "new@example.test" });
      expect(calls).toEqual(["set-contact:new@example.test", `submit:${LISTING}`]);
    });

    it("refuses a submit when the account has no email and none was given, names the field and does not submit", async () => {
      const { fake, calls } = store({ contactEmail: async () => null });
      const error = await failure(() => sendForReview(fake, { listingId: LISTING }));
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors?.contactEmail).toEqual([{ key: "validation.contactEmailRequired" }]);
      expect(calls).not.toContain(`submit:${LISTING}`);
    });

    it("does not submit when the email given is refused by the database", async () => {
      const { fake, calls } = store({
        setContactEmail: async () => {
          throw mapListingError({ code: "22023", message: "profile.contact_email_invalid" });
        },
      });
      const error = await failure(() =>
        sendForReview(fake, { listingId: LISTING, contactEmail: "bad@example.test" }),
      );
      expect(error.fieldErrors?.contactEmail).toEqual([{ key: "validation.emailInvalid" }]);
      expect(calls).not.toContain(`submit:${LISTING}`);
    });

    it("lets a refusal from the database through", async () => {
      const refused = store({
        submit: async () => {
          throw mapListingError({ code: "23514", message: "listing.no_photo" });
        },
      });
      const error = await failure(() => sendForReview(refused.fake, { listingId: LISTING }));
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors?.photos).toEqual([{ key: "validation.photoRequired" }]);
    });
  });

  describe("mapListingError", () => {
    it("tells a person at the limit how many listings they may have", () => {
      const error = mapListingError({ code: "P0001", message: "properties.open_limit" });
      expect(error.code).toBe("VALIDATION");
      expect(error.fieldErrors?.listing).toEqual([
        { key: "validation.openListingLimit", values: { maximum: 5 } },
      ]);
    });

    it("names the fields a submit found missing", () => {
      const error = mapListingError({
        code: "23514",
        message: "listing.incomplete",
        details: "title,area_sqft,pincode",
      });
      expect(error.code).toBe("VALIDATION");
      expect(Object.keys(error.fieldErrors ?? {})).toEqual(["title", "areaSqft", "pincode"]);
      expect(error.fieldErrors?.title).toEqual([{ key: "validation.required" }]);
    });

    it("does not lose an incomplete listing whose missing column it cannot name", () => {
      const error = mapListingError({
        code: "23514",
        message: "listing.incomplete",
        details: "mystery",
      });
      expect(Object.keys(error.fieldErrors ?? {})).toEqual(["listing"]);
    });

    it("maps a missing or foreign listing to not found, a wrong state to conflict, no access to forbidden", () => {
      expect(mapListingError({ code: "P0002", message: "listing.not_found" }).code).toBe(
        "NOT_FOUND",
      );
      expect(mapListingError({ code: "55000", message: "listing.not_submittable" }).code).toBe(
        "CONFLICT",
      );
      expect(mapListingError({ code: "42501", message: "listing.not_allowed" }).code).toBe(
        "FORBIDDEN",
      );
      expect(
        mapListingError({ code: "42501", message: "permission denied for table properties" }).code,
      ).toBe("FORBIDDEN");
    });

    it("maps the bedrooms-for-land check to the bedrooms field, and anything else unknown to internal", () => {
      const land = mapListingError({
        code: "23514",
        message: 'violates check constraint "properties_no_bhk_for_land"',
      });
      expect(land.fieldErrors?.bhk).toEqual([{ key: "validation.invalid" }]);
      expect(mapListingError({ code: "XX000", message: "boom" }).code).toBe("INTERNAL");
      expect(mapListingError({}).code).toBe("INTERNAL");
    });

    it("never puts the database's own words in the safe message", () => {
      const error = mapListingError({
        code: "XX000",
        message: "relation public.properties exploded",
      });
      expect(error.message).not.toContain("properties");
    });
  });

  describe("the email for enquiries (ADR-186)", () => {
    it("maps the database's refusals to a problem on the email field, never naming the reserved list", () => {
      expect(
        mapListingError({ code: "22023", message: "profile.contact_email_invalid" }).fieldErrors,
      ).toEqual({ contactEmail: [{ key: "validation.emailInvalid" }] });
      expect(
        mapListingError({ code: "22023", message: "profile.contact_email_reserved" }).fieldErrors,
      ).toEqual({ contactEmail: [{ key: "validation.emailTaken" }] });
      expect(mapListingError({ code: "42501", message: "profile.not_allowed" }).code).toBe(
        "FORBIDDEN",
      );
    });

    it("saves it from the dashboard and answers the address as stored", async () => {
      const { fake } = store({ setContactEmail: async (email) => email.toLowerCase() });
      expect(await saveOwnContactEmail(fake, { email: "Owner@Example.Test" })).toEqual({
        email: "owner@example.test",
      });
    });

    it("names the problem on the dashboard's box, which is called email", async () => {
      const refused = store({
        setContactEmail: async () => {
          throw mapListingError({ code: "22023", message: "profile.contact_email_reserved" });
        },
      });
      const error = await failure(() => saveOwnContactEmail(refused.fake, { email: "a@b.test" }));
      expect(error.fieldErrors).toEqual({ email: [{ key: "validation.emailTaken" }] });
    });

    it("lets any other failure through as it was", async () => {
      const broken = store({
        setContactEmail: async () => {
          throw mapListingError({ code: "42501", message: "profile.not_allowed" });
        },
      });
      const error = await failure(() => saveOwnContactEmail(broken.fake, { email: "a@b.test" }));
      expect(error.code).toBe("FORBIDDEN");
    });
  });
});
